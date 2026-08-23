import React, { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  FileText,
  Loader2,
  Lock,
  MapPin,
  Phone,
  Rocket,
  Sparkles,
  Tag,
} from "lucide-react";
import { pb } from "@/lib/supabaseClient";
import Layout from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { useBranding } from "@/contexts/BrandingContext";
import { runMatching } from "@/lib/retrouve";
import { onDeclarationCreated } from "@/lib/notificationService";
import CategoryGrid from "@/components/CategoryGrid";
import MatchVerifyPopup from "@/components/MatchVerifyPopup";
import { CATEGORY_GROUPS, CATEGORY_META } from "@/lib/categories";
import { formatNumber } from "@/lib/format";
import { initPayment, computeTotalWithFee, computeFee } from "@/lib/moneyfusion";
import { detectDocument } from "@/lib/documentDetector";

const field =
  "w-full rounded-xl border-2 border-input bg-background px-4 py-3 text-base outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring/20 placeholder:text-muted-foreground/50";
const labelCls = "flex flex-col gap-1.5 text-sm font-bold";
const card = "rounded-2xl border border-border/60 bg-card p-4 sm:p-5 shadow-sm";
const sectionTitle = "flex items-center gap-2 text-sm font-extrabold tracking-tight";

const DeclarePage = () => {
  const { kind: kindParam } = useParams();
  const kind = kindParam === "retrouve" ? "found" : "lost";
  const { user } = useAuth();
  const { branding } = useBranding();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState({
    title: "",
    category: "",
    person_name: "",
    brand: "",
    color: "",
    city: "",
    zone: "",
    event_date: "",
    description: "",
    doc_number: "",
    phone: "",
    priority: false,
  });
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [paying, setPaying] = useState(false);
  const [result, setResult] = useState(null);
  const [showMatchPopup, setShowMatchPopup] = useState(false);

  useEffect(() => {
    pb.collection("categories")
      .getFullList({ sort: "position", requestKey: "cats" })
      .then((cats) => {
        if (cats.length > 0) setCategories(cats);
        else throw new Error("empty");
      })
      .catch(() => {
        setCategories(
          CATEGORY_GROUPS.flatMap((g) =>
            g.slugs.map((slug, pos) => ({
              id: slug,
              slug,
              name: CATEGORY_META[slug]?.label || slug,
              position: pos,
            }))
          )
        );
      });
  }, []);

  const selectedCat = useMemo(
    () => categories.find((c) => c.id === form.category),
    [categories, form.category]
  );

  const set = (k) => (e) =>
    setForm((f) => ({
      ...f,
      [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value,
    }));

  const handlePhoto = (e) => {
    const file = e.target.files?.[0] || null;
    setPhoto(file);
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setPhotoPreview(ev.target.result);
      reader.readAsDataURL(file);
    } else {
      setPhotoPreview(null);
    }
  };

  const step1Valid = form.title && form.category;
  const step2Valid = form.city;

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!user) {
      navigate("/connexion");
      return;
    }
    if (!form.title || !form.category || !form.city) {
      setError("Titre, catégorie et ville sont obligatoires.");
      return;
    }
    setSaving(true);
    try {
      const digits = form.doc_number.replace(/\D/g, "");
      const payload = {
        kind,
        category: form.category,
        title: form.title,
        person_name: form.person_name,
        brand: form.brand,
        color: form.color,
        city: form.city,
        zone: form.zone,
        event_date: form.event_date || null,
        description: form.description,
        doc_last4: digits ? digits.slice(-4) : "",
        status: "open",
        priority: false,
        owner: user.id,
        phone: form.phone,
      };

      if (photo) {
        const ext = photo.name?.split(".").pop() || "jpg";
        const fileName = `${Date.now()}.${ext}`;
        const { data: uploaded } = await pb.supabase.storage
          .from("uploads")
          .upload(fileName, photo, { cacheControl: "3600", upsert: false });
        if (uploaded) {
          const { data: urlData } = pb.supabase.storage
            .from("uploads")
            .getPublicUrl(uploaded.path);
          payload.photo_url = urlData?.publicUrl || "";
        }
        try {
          const detection = await detectDocument(photo);
          payload.is_document_photo = detection.isDocument;
          payload.doc_photo_type = detection.docType || "";
        } catch (_) {
          payload.is_document_photo = false;
        }
      }

      const rec = await pb.collection("declarations").create(payload);

      // If priority selected, redirect to MoneyFusion for 500 FCFA payment
      if (form.priority) {
        try {
          const mfResult = await initPayment({
            amount: 500,
            items: [{ "Mise en avant déclaration": 500 }],
            phone: form.phone || "",
            name: user.name || user.email || "Utilisateur",
            userId: user.id,
            type: "priority",
            itemId: rec.id,
            extraInfo: { declarationId: rec.id },
          });
          if (mfResult.url) {
            // Save pending payment record
            await pb.collection("payments").create({
              user: user.id,
              type: "priority",
              item_key: rec.id,
              item_label: `Mise en avant déclaration: ${rec.id}`,
              amount_fcfa: 500,
              fee_fcfa: computeFee(500),
              total_charged: computeTotalWithFee(500),
              status: "pending",
              payment_method: "moneyfusion",
              moneyfusion_token: mfResult.token || "",
              description: `Mise en avant déclaration: ${rec.id}`,
            });
            // Redirect to MoneyFusion
            window.location.href = mfResult.url;
            return;
          }
        } catch (payErr) {
          console.error("Payment init error:", payErr);
          // Declaration is still created, just payment failed
        }
      }

      const matches = await runMatching({ ...rec, category: form.category });

      // Envoyer notifications push + email à tous les users
      onDeclarationCreated({ ...rec, category: form.category }, user).catch(() => {});
      toast.success(
        kind === "lost" ? "Perte enregistrée" : "Objet retrouvé enregistré",
        { description: kind === "found" ? "Les points seront attribués après restitution" : undefined }
      );
      setResult({ rec, matches });
      if (matches.length > 0) {
        setShowMatchPopup(true);
      }
    } catch (err) {
      console.error("Erreur déclaration:", err);
      setError(
        err?.message?.includes("row-level security")
          ? "Erreur de permission. Vérifiez que les tables sont créées dans Supabase."
          : err?.message || "La déclaration n'a pas pu être enregistrée."
      );
    } finally {
      setSaving(false);
    }
  };

  if (result) {
    const isFound = kind === "found";
    return (
      <>
        <MatchVerifyPopup
          isOpen={showMatchPopup}
          onClose={() => setShowMatchPopup(false)}
          matches={result.matches}
          declaration={{ ...result.rec, category: form.category }}
          kind={kind}
        />
        <Layout>
          <Helmet>
            <title>Déclaration enregistrée — {branding.app_name}</title>
          </Helmet>
          <div className="mx-auto w-full max-w-lg px-4 py-10">
            <div className={`${card} text-center`}>
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-accent/10">
                <CheckCircle2 className="h-8 w-8 text-accent" />
              </div>
              <h1 className="mt-4 text-xl font-extrabold">Déclaration enregistrée</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Elle est comparée en continu à toute la base.
              </p>

              {result.matches.length > 0 && !showMatchPopup && (
                <button
                  type="button"
                  onClick={() => setShowMatchPopup(true)}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-500/10 px-4 py-2.5 text-sm font-bold text-emerald-600 dark:text-emerald-400"
                >
                  <Sparkles className="h-4 w-4" />
                  {result.matches.length} correspondance(s) — Voir les résultats
                </button>
              )}

              {isFound && result.matches.length === 0 && (
                <div className="mt-4 rounded-xl border border-dashed border-border/60 bg-muted/20 p-4">
                  <p className="text-sm text-muted-foreground">
                    Aucune correspondance immédiate. Le système continue de
                    comparer votre déclaration avec les objets perdus.
                  </p>
                </div>
              )}

              {!isFound && result.matches.length > 0 && (
                <div className="mt-4 rounded-xl bg-amber-500/10 p-4 text-left">
                  <p className="text-sm font-bold text-amber-700 dark:text-amber-300">
                    🎉 Un objet correspondant a été trouvé !
                  </p>
                  <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                    Consultez les détails dans votre tableau de bord.
                  </p>
                </div>
              )}

              <div className="mt-6 grid grid-cols-2 gap-2">
                <Link
                  to="/tableau-de-bord"
                  className="rounded-xl bg-primary px-4 py-3 text-center text-sm font-bold text-primary-foreground"
                >
                  Mon espace
                </Link>
                <Link
                  to="/"
                  className="rounded-xl border border-border px-4 py-3 text-center text-sm font-bold"
                >
                  Accueil
                </Link>
              </div>
            </div>
          </div>
        </Layout>
      </>
    );
  }

  return (
    <Layout>
      <Helmet>
        <title>
          {kind === "lost" ? "J'ai égaré" : "J'ai retrouvé"} — {branding.app_name}
        </title>
      </Helmet>

      <div className="mx-auto w-full max-w-lg px-4 py-5 pb-8">
        {/* ── Switch perdu / retrouvé ── */}
        <div className="flex gap-1.5 rounded-2xl bg-muted p-1 text-sm font-bold">
          <button
            type="button"
            onClick={() => navigate("/declarer/perdu")}
            className={`flex-1 flex items-center justify-center gap-2 rounded-xl px-4 py-3 transition-all ${
              kind === "lost" ? "bg-card shadow-sm text-primary" : "text-muted-foreground"
            }`}
          >
            <FileText className="h-4 w-4" />
            J'AI ÉGARÉ
          </button>
          <button
            type="button"
            onClick={() => navigate("/declarer/retrouve")}
            className={`flex-1 flex items-center justify-center gap-2 rounded-xl px-4 py-3 transition-all ${
              kind === "found" ? "bg-card shadow-sm text-accent" : "text-muted-foreground"
            }`}
          >
            <CheckCircle2 className="h-4 w-4" />
            J'AI RETROUVÉ
          </button>
        </div>

        {/* ── Progress ── */}
        <div className="mt-5 flex items-center gap-2">
          {[1, 2, 3].map((s) => (
            <React.Fragment key={s}>
              <button
                type="button"
                onClick={() => {
                  if (s === 1) setStep(1);
                  if (s === 2 && step1Valid) setStep(2);
                  if (s === 3 && step1Valid && step2Valid) setStep(3);
                }}
                className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-extrabold transition-all ${
                  step >= s
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                } ${((s === 1) || (s === 2 && step1Valid) || (s === 3 && step1Valid && step2Valid)) ? "cursor-pointer" : ""}`}
              >
                {s}
              </button>
              {s < 3 && (
                <div className={`h-0.5 flex-1 rounded-full transition-colors ${step > s ? "bg-primary" : "bg-muted"}`} />
              )}
            </React.Fragment>
          ))}
        </div>
        <div className="mt-1.5 flex justify-between text-[10px] font-bold text-muted-foreground">
          <span>Objet</span>
          <span>Lieu</span>
          <span>Options</span>
        </div>

        <form onSubmit={submit}>
          {/* ══════ ÉTAPE 1 : L'objet ══════ */}
          {step === 1 && (
            <div className="mt-6 grid gap-4 animate-fade-in">
              <h2 className="text-lg font-extrabold">
                {kind === "lost" ? "Qu'avez-vous égaré ?" : "Qu'avez-vous retrouvé ?"}
              </h2>

              {/* Catégorie */}
              <div className={card}>
                <p className={sectionTitle}>
                  <Tag className="h-4 w-4 text-primary" /> Catégorie *
                </p>
                <div className="mt-3">
                  {categories.length === 0 ? (
                    <div className="grid grid-cols-2 gap-2">
                      {[0, 1, 2, 3, 4, 5].map((k) => (
                        <div key={k} className="h-20 animate-pulse rounded-xl bg-muted" />
                      ))}
                    </div>
                  ) : (
                    <CategoryGrid
                      categories={categories}
                      selected={form.category || null}
                      onSelect={(c) => setForm((f) => ({ ...f, category: c.id }))}
                      size="md"
                    />
                  )}
                </div>
              </div>

              {/* Titre */}
              <div className={card}>
                <label className={labelCls}>
                  <span className={sectionTitle}>
                    <FileText className="h-4 w-4 text-primary" /> Titre *
                  </span>
                  <input
                    className={field}
                    value={form.title}
                    onChange={set("title")}
                    placeholder={
                      kind === "lost"
                        ? "Ex : CNI au nom de Aïcha Diallo"
                        : "Ex : Portefeuille noir trouvé à Ouaga 2000"
                    }
                  />
                </label>
              </div>

              {/* Description + Photo */}
              <div className={card}>
                <label className={labelCls}>
                  <span className={sectionTitle}>Description</span>
                  <textarea
                    rows={3}
                    className={field}
                    value={form.description}
                    onChange={set("description")}
                    placeholder="Signes distinctifs, circonstances..."
                  />
                </label>

                <label className={`${labelCls} mt-3`}>
                  <span className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
                    <Camera className="h-3.5 w-3.5" /> Photo
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handlePhoto}
                    className="hidden"
                    id="photo-input"
                  />
                  <label
                    htmlFor="photo-input"
                    className="flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border p-4 text-sm text-muted-foreground cursor-pointer active:scale-[0.98] transition-all"
                  >
                    {photoPreview ? (
                      <img
                        src={photoPreview}
                        alt="Aperçu"
                        className="h-20 w-20 rounded-lg object-cover"
                      />
                    ) : (
                      <>
                        <Camera className="h-5 w-5" />
                        Ajouter une photo
                      </>
                    )}
                  </label>
                </label>
              </div>

              {/* Détails */}
              <div className={card}>
                <p className={sectionTitle}>Détails de l'objet</p>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <label className={labelCls}>
                    <span className="text-xs text-muted-foreground">Marque</span>
                    <input className={field} value={form.brand} onChange={set("brand")} placeholder="Ex: Tecno" />
                  </label>
                  <label className={labelCls}>
                    <span className="text-xs text-muted-foreground">Couleur</span>
                    <input className={field} value={form.color} onChange={set("color")} placeholder="Ex: noir" />
                  </label>
                </div>
                <label className={`${labelCls} mt-3`}>
                  <span className="text-xs text-muted-foreground">Nom sur l'objet</span>
                  <input className={field} value={form.person_name} onChange={set("person_name")} placeholder="Prénom et nom" />
                </label>
              </div>

              <button
                type="button"
                disabled={!step1Valid}
                onClick={() => setStep(2)}
                className="flex items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-4 text-base font-extrabold text-primary-foreground transition-all active:scale-[0.98] disabled:opacity-40 shadow-lg shadow-primary/25"
              >
                Continuer
              </button>
            </div>
          )}

          {/* ══════ ÉTAPE 2 : Lieu & Date ══════ */}
          {step === 2 && (
            <div className="mt-6 grid gap-4 animate-fade-in">
              <h2 className="text-lg font-extrabold">Où et quand ?</h2>

              <div className={card}>
                <div className="grid grid-cols-1 gap-3">
                  <label className={labelCls}>
                    <span className={sectionTitle}>
                      <MapPin className="h-4 w-4 text-primary" /> Ville *
                    </span>
                    <input
                      className={field}
                      value={form.city}
                      onChange={set("city")}
                      placeholder="Ex : Ouagadougou"
                    />
                  </label>
                  <label className={labelCls}>
                    <span className="text-xs text-muted-foreground">Zone / quartier</span>
                    <input
                      className={field}
                      value={form.zone}
                      onChange={set("zone")}
                      placeholder="Ex : Ouaga 2000"
                    />
                  </label>
                  <label className={labelCls}>
                    <span className="text-xs text-muted-foreground">
                      Date {kind === "lost" ? "de la perte" : "de la découverte"}
                    </span>
                    <input
                      type="date"
                      className={field}
                      value={form.event_date}
                      onChange={set("event_date")}
                    />
                  </label>
                </div>
              </div>

              <div className={card}>
                <label className={labelCls}>
                  <span className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
                    <Phone className="h-3.5 w-3.5" /> Téléphone de contact
                  </span>
                  <input
                    className={field}
                    value={form.phone}
                    onChange={set("phone")}
                    placeholder="+226 01 01 01 01"
                    type="tel"
                  />
                </label>
              </div>

              {/* Numéro document */}
              <div className={card}>
                <div className="flex items-start gap-2 rounded-xl bg-secondary/50 p-3">
                  <Lock className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <div>
                    <p className="text-sm font-bold">Numéro du document</p>
                    <p className="text-[11px] text-muted-foreground">
                      Seuls les 4 derniers chiffres sont conservés (ex: ********4821)
                    </p>
                  </div>
                </div>
                <label className={`${labelCls} mt-3`}>
                  <input
                    className={field}
                    value={form.doc_number}
                    onChange={set("doc_number")}
                    inputMode="text"
                    placeholder="Ex : BF0012345678"
                  />
                </label>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="rounded-2xl border-2 border-border px-5 py-3.5 text-sm font-bold active:scale-[0.98]"
                >
                  Retour
                </button>
                <button
                  type="button"
                  disabled={!step2Valid}
                  onClick={() => setStep(3)}
                  className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-3.5 text-base font-extrabold text-primary-foreground transition-all active:scale-[0.98] disabled:opacity-40 shadow-lg shadow-primary/25"
                >
                  Continuer
                </button>
              </div>
            </div>
          )}

          {/* ══════ ÉTAPE 3 : Options & finalisation ══════ */}
          {step === 3 && (
            <div className="mt-6 grid gap-4 animate-fade-in">
              <h2 className="text-lg font-extrabold">Options & finalisation</h2>

              {/* ── MISE EN AVANT ── */}
              <div
                className={`rounded-2xl border-2 p-4 transition-all ${
                  form.priority
                    ? "border-primary bg-primary/5 shadow-md shadow-primary/10"
                    : "border-border/60 bg-card shadow-sm"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500">
                    <Rocket className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-extrabold">Mise en avant</p>
                    <p className="text-[11px] text-muted-foreground">
                      En tête des résultats pendant 30 jours
                    </p>
                    <p className="mt-1 text-lg font-extrabold text-primary">500 FCFA</p>
                    {form.priority && (
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        Total avec frais (3%) : {formatNumber(computeTotalWithFee(500))} FCFA
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, priority: !f.priority }))}
                    className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
                      form.priority ? "bg-primary" : "bg-muted"
                    }`}
                  >
                    <span
                       className={`absolute top-0.5 h-6 w-6 rounded-full bg-background shadow transition-all ${
                        form.priority ? "left-[calc(100%-1.65rem)]" : "left-0.5"
                      }`}
                    />
                  </button>
                </div>
                {form.priority && (
                  <p className="mt-3 text-xs text-muted-foreground">
                    Vous serez redirigé vers MoneyFusion pour payer (Orange Money, Wave, MTN, Moov, Carte).
                  </p>
                )}
              </div>

              {error && (
                <div className="flex items-start gap-2 rounded-xl bg-destructive/10 px-4 py-3 text-sm font-semibold text-destructive">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="rounded-2xl border-2 border-border px-5 py-3.5 text-sm font-bold active:scale-[0.98]"
                >
                  Retour
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-4 text-base font-extrabold text-primary-foreground transition-all active:scale-[0.98] disabled:opacity-60 shadow-lg shadow-primary/25"
                >
                  {saving && <Loader2 className="h-5 w-5 animate-spin" />}
                  {saving ? "Envoi en cours..." : "Publier ma déclaration"}
                </button>
              </div>
            </div>
          )}
        </form>
      </div>
    </Layout>
  );
};

export default DeclarePage;
