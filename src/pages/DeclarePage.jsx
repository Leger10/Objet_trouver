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
  MapPin,
  Phone,
  Rocket,
  Sparkles,
  Tag,
  Upload,
  X,
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
import {
  initPayment,
  computeTotalWithFee,
  computeFee,
  savePaymentContext,
} from "@/lib/moneyfusion";
import { detectDocument } from "@/lib/documentDetector";
import UssdPayment from "@/components/UssdPayment";

const field =
  "w-full rounded-xl border-2 border-input bg-background px-4 py-3 text-base outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring/20 placeholder:text-muted-foreground/50";
const labelCls = "flex flex-col gap-1.5 text-sm font-bold";
const card = "rounded-2xl border border-border/60 bg-card p-4 sm:p-5 shadow-sm";
const hint = "text-[11px] text-muted-foreground leading-snug";
const sectionTitle =
  "flex items-center gap-2 text-sm font-extrabold tracking-tight";

const PERSON_CATEGORIES = ["enfant-disparu", "personne-disparue"];

const DeclarePage = () => {
  const { kind: kindParam } = useParams();
  const kind = kindParam === "retrouve" ? "found" : "lost";
  const isLost = kind === "lost";
  const { user } = useAuth();
  const { branding } = useBranding();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState({
    title: "",
    category: "",
    person_name: "",
    age: "",
    sex: "",
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
  const [result, setResult] = useState(null);
  const [showMatchPopup, setShowMatchPopup] = useState(false);
  const [payMode, setPayMode] = useState("online");
  const [ussdPayment, setUssdPayment] = useState(null);

  useEffect(() => {
    pb.collection("categories")
      .getFullList({ sort: "position", requestKey: "cats" })
      .then((cats) => {
        if (cats.length > 0) {
          const dbSlugs = new Set(cats.map((c) => c.slug || c.id));
          const localMissing = CATEGORY_GROUPS.flatMap((g) =>
            g.slugs
              .filter((s) => !dbSlugs.has(s))
              .map((slug, i) => ({
                id: slug,
                slug,
                name: CATEGORY_META[slug]?.label || slug,
                position: (cats.length || 0) + i,
              })),
          );
          setCategories([...cats, ...localMissing]);
        } else {
          throw new Error("empty");
        }
      })
      .catch(() => {
        setCategories(
          CATEGORY_GROUPS.flatMap((g) =>
            g.slugs.map((slug, pos) => ({
              id: slug,
              slug,
              name: CATEGORY_META[slug]?.label || slug,
              position: pos,
            })),
          ),
        );
      });
  }, []);

  const selectedCat = useMemo(
    () => categories.find((c) => c.id === form.category),
    [categories, form.category],
  );

  const catSlug = selectedCat?.slug || selectedCat?.id || form.category;

  const isDocument = useMemo(
    () =>
      ["cni", "passeport", "permis", "carte-grise", "documents"].includes(
        catSlug,
      ),
    [catSlug],
  );

  const isPerson = useMemo(
    () => PERSON_CATEGORIES.includes(catSlug),
    [catSlug],
  );

  const set = (k) => (e) =>
    setForm((f) => ({
      ...f,
      [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value,
    }));

  const handlePhotoFile = async (file) => {
    setPhoto(file);
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setPhotoPreview(ev.target.result);
      reader.readAsDataURL(file);
    } else {
      setPhotoPreview(null);
    }
  };

  const handlePhotoInput = (e) => {
    const file = e.target.files?.[0] || null;
    if (file) handlePhotoFile(file);
  };

  const openCamera = () => {
    const input = document.getElementById("photo-camera");
    if (input) input.click();
  };

  const openGallery = () => {
    const input = document.getElementById("photo-upload");
    if (input) input.click();
  };

  const step1Valid = form.category;
  const step2Valid = form.city && form.phone;

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!user) {
      navigate(
        `/connexion?notice=${encodeURIComponent(
          "Pour déclarer un objet perdu ou retrouvé, connectez-vous d'abord (ou créez un compte gratuit).",
        )}`,
      );
      return;
    }
    if (!form.category || !form.city || !form.phone) {
      setError("La catégorie, la ville et le téléphone sont obligatoires.");
      return;
    }
    if (isPerson && !form.person_name.trim()) {
      setError("Le nom complet de la personne est obligatoire.");
      return;
    }
    setSaving(true);
    try {
      const digits = form.doc_number.replace(/\D/g, "");
      let title = form.title.trim();
      if (!title) {
        const catLabel = CATEGORY_META[catSlug]?.label || "Objet";
        const loc = form.zone ? `${form.zone}, ${form.city}` : form.city;
        if (isPerson) {
          title = isLost
            ? `${catLabel} : ${form.person_name.trim()} — ${loc}`
            : `${catLabel} retrouvé(e) : ${form.person_name.trim()} — ${loc}`;
        } else {
          title = isLost
            ? `${catLabel} perdu(e) à ${loc}`
            : `${catLabel} retrouvé(e) à ${loc}`;
        }
      }

      const payload = {
        kind,
        category: form.category,
        title,
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

      if (isPerson) {
        payload.person_age = form.age;
        payload.person_sex = form.sex;
      }

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

      // Always run matching first, before any payment redirect
      const matches = await runMatching({ ...rec, category: form.category });
      onDeclarationCreated({ ...rec, category: form.category }, user).catch(
        () => {},
      );

      if (form.priority) {
        if (payMode === "ussd") {
          // Payer ici : l'enregistrement se fait quand l'utilisateur confirme
          setUssdPayment(rec.id);
        } else {
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
              await pb.collection("payments").create({
                user: user.id,
                type: "priority",
                item_key: rec.id,
                item_label: `Mise en avant déclaration: ${rec.id}`,
                amount: 500,
                amount_fcfa: 500,
                fee_fcfa: computeFee(500),
                total_charged: computeTotalWithFee(500),
                status: "pending",
                payment_method: "moneyfusion",
                moneyfusion_token: mfResult.token || "",
                description: `Mise en avant déclaration: ${rec.id}`,
              });
              savePaymentContext({
                token: mfResult.token,
                type: "priority",
                itemKey: rec.id,
                userId: user.id,
              });
              window.location.href = mfResult.url;
              return;
            }
          } catch (payErr) {
            console.error("Payment init error:", payErr);
          }
        }
      }

      const verb = isPerson
        ? isLost
          ? "Disparition déclarée"
          : "Personne retrouvée déclarée"
        : isLost
          ? "Perte enregistrée"
          : "Objet retrouvé enregistré";
      toast.success(verb, {
        description: !isLost
          ? "Les points seront attribués après restitution"
          : undefined,
      });
      setResult({ rec, matches });
      if (matches.length > 0) {
        setShowMatchPopup(true);
      }
    } catch (err) {
      console.error("Erreur déclaration:", err);
      setError(
        err?.message?.includes("row-level security")
          ? "Erreur de permission. Vérifiez que les tables sont créées dans Supabase."
          : err?.message || "La déclaration n'a pas pu être enregistrée.",
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
              <h1 className="mt-4 text-xl font-extrabold">
                {isPerson
                  ? "Déclaration enregistrée"
                  : "Déclaration enregistrée"}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {isPerson
                  ? "La description est comparée en continu à toutes les déclarations."
                  : "Elle est comparée en continu à toute la base."}
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
                    {isPerson
                      ? "Aucune correspondance immédiate. Le système continue de comparer."
                      : "Aucune correspondance immédiate. Le système continue de comparer."}
                  </p>
                </div>
              )}

              {!isFound && result.matches.length > 0 && (
                <div className="mt-4 rounded-xl bg-amber-500/10 p-4 text-left">
                  <p className="text-sm font-bold text-amber-700 dark:text-amber-300">
                    {isPerson
                      ? "Une correspondance a été trouvée !"
                      : "Un objet correspondant a été trouvé !"}
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

        {/* Paiement prioritaire USSD */}
        {ussdPayment && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4">
            <div
              className="w-full max-w-md rounded-2xl bg-card p-6 sheet-up sm:page-enter max-h-[92dvh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <p className="font-extrabold text-lg">
                  Mise en avant prioritaire
                </p>
                <button
                  type="button"
                  onClick={() => setUssdPayment(null)}
                  className="rounded-lg p-1.5 text-muted-foreground"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <UssdPayment
                amount={500}
                itemLabel="Mise en avant prioritaire"
                payload={{
                  userId: user?.id || "",
                  type: "priority",
                  itemKey: ussdPayment,
                  itemLabel: `Mise en avant déclaration: ${ussdPayment}`,
                  amountFcfa: 500,
                  description: `Mise en avant déclaration: ${ussdPayment}`,
                }}
              />
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <Layout>
      <Helmet>
        <title>
          {isLost ? "J'ai égaré" : "J'ai retrouvé"} — {branding.app_name}
        </title>
      </Helmet>

      <div className="mx-auto w-full max-w-lg px-4 py-5 pb-8">
        {/* ── Switch perdu / retrouvé ── */}
        <div className="flex gap-1.5 rounded-2xl bg-muted p-1 text-sm font-bold">
          <button
            type="button"
            onClick={() => navigate("/declarer/perdu")}
            className={`flex-1 flex items-center justify-center gap-2 rounded-xl px-4 py-3 transition-all ${
              isLost
                ? "bg-card shadow-sm text-primary"
                : "text-muted-foreground"
            }`}
          >
            <FileText className="h-4 w-4" />
            J&apos;AI ÉGARÉ
          </button>
          <button
            type="button"
            onClick={() => navigate("/declarer/retrouve")}
            className={`flex-1 flex items-center justify-center gap-2 rounded-xl px-4 py-3 transition-all ${
              !isLost
                ? "bg-card shadow-sm text-accent"
                : "text-muted-foreground"
            }`}
          >
            <CheckCircle2 className="h-4 w-4" />
            J&apos;AI RETROUVÉ
          </button>
        </div>

        {/* ── Progress ── */}
        <div className="mt-5 flex items-center gap-2">
          {[1, 2].map((s) => (
            <React.Fragment key={s}>
              <button
                type="button"
                onClick={() => {
                  if (s === 1) setStep(1);
                  if (s === 2 && step1Valid) setStep(2);
                }}
                className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-extrabold transition-all ${
                  step >= s
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                } ${s === 1 || (s === 2 && step1Valid) ? "cursor-pointer" : ""}`}
              >
                {s}
              </button>
              <div
                className={`h-0.5 flex-1 rounded-full transition-colors ${step > s ? "bg-primary" : "bg-muted"}`}
              />
            </React.Fragment>
          ))}
        </div>
        <div className="mt-1.5 flex justify-between text-[10px] font-bold text-muted-foreground">
          <span>Qui / Quoi ?</span>
          <span>Où ?</span>
        </div>

        <form onSubmit={submit}>
          {/* ══════ ÉTAPE 1 : Qui / Quoi ══════ */}
          {step === 1 && (
            <div className="mt-6 grid gap-4 animate-fade-in">
              <h2 className="text-lg font-extrabold">
                {!form.category
                  ? isLost
                    ? "Que cherchez-vous ?"
                    : "Qu'avez-vous retrouvé ?"
                  : isPerson
                    ? isLost
                      ? "Qui recherchez-vous ?"
                      : "Qui avez-vous retrouvé ?"
                    : isLost
                      ? "Qu'avez-vous égaré ?"
                      : "Qu'avez-vous retrouvé ?"}
              </h2>
              <p className={hint}>
                {!form.category
                  ? "Sélectionnez une catégorie pour commencer."
                  : isPerson
                    ? isLost
                      ? "Décrivez la personne disparue pour faciliter sa recherche."
                      : "Décrivez la personne que vous avez retrouvée."
                    : isLost
                      ? "Sélectionnez la catégorie puis décrivez brièvement."
                      : "Sélectionnez la catégorie et décrivez l'objet trouvé."}
              </p>

              {/* Catégorie */}
              <div className={card}>
                <p className={sectionTitle}>
                  <Tag className="h-4 w-4 text-primary" /> Catégorie *
                </p>
                <div className="mt-3">
                  {categories.length === 0 ? (
                    <div className="grid grid-cols-2 gap-2">
                      {[0, 1, 2, 3, 4, 5].map((k) => (
                        <div
                          key={k}
                          className="h-20 animate-pulse rounded-xl bg-muted"
                        />
                      ))}
                    </div>
                  ) : (
                    <CategoryGrid
                      categories={categories}
                      selected={form.category || null}
                      onSelect={(c) =>
                        setForm((f) => ({ ...f, category: c.id }))
                      }
                      size="md"
                    />
                  )}
                </div>
              </div>

              {/* ── PERSONNE : champs dédiés ── */}
              {isPerson && (
                <div className={`${card} animate-fade-in`}>
                  <p className={sectionTitle}>
                    {isLost
                      ? "Identité de la personne recherchée"
                      : "Identité de la personne retrouvée"}
                  </p>
                  <div className="mt-3 space-y-3">
                    <label className={labelCls}>
                      <span className="text-xs text-muted-foreground">
                        Nom complet *
                      </span>
                      <input
                        className={field}
                        value={form.person_name}
                        onChange={set("person_name")}
                        placeholder="Ex : Aïcha Diallo"
                        autoComplete="name"
                      />
                      <span className={hint}>Prénom et nom de la personne</span>
                    </label>

                    <div className="grid grid-cols-2 gap-3">
                      <label className={labelCls}>
                        <span className="text-xs text-muted-foreground">
                          Sexe *
                        </span>
                        <select
                          className={field}
                          value={form.sex}
                          onChange={set("sex")}
                        >
                          <option value="">— Choisir —</option>
                          <option value="M">Masculin</option>
                          <option value="F">Féminin</option>
                        </select>
                      </label>
                      <label className={labelCls}>
                        <span className="text-xs text-muted-foreground">
                          Âge approximatif
                        </span>
                        <input
                          className={field}
                          value={form.age}
                          onChange={set("age")}
                          placeholder="Ex : 8 ans"
                          inputMode="text"
                        />
                        <span className={hint}>Tranche d'âge ou âge exact</span>
                      </label>
                    </div>

                    <label className={labelCls}>
                      <span className="text-xs text-muted-foreground">
                        Description physique
                      </span>
                      <textarea
                        rows={3}
                        className={field}
                        value={form.brand}
                        onChange={set("brand")}
                        placeholder="Ex : Taille 1m20, cheveux courts, porte un t-shirt bleu, cicatrice au front..."
                      />
                      <span className={hint}>
                        Taille, couleur de peau, vêtements, particularités
                        physiques
                      </span>
                    </label>
                  </div>
                </div>
              )}

              {/* ── DOCUMENT : champs dédiés ── */}
              {isDocument && !isPerson && (
                <div className={`${card} animate-fade-in`}>
                  <p className={sectionTitle}>
                    {isLost
                      ? "Détails du document perdu"
                      : "Détails du document trouvé"}
                  </p>
                  <div className="mt-3 space-y-3">
                    <label className={labelCls}>
                      <span className="text-xs text-muted-foreground">
                        Nom sur le document
                      </span>
                      <input
                        className={field}
                        value={form.person_name}
                        onChange={set("person_name")}
                        placeholder="Ex : Aïcha Diallo"
                        autoComplete="name"
                      />
                    </label>
                    <label className={labelCls}>
                      <span className="text-xs text-muted-foreground">
                        Référence du document{" "}
                        <span className="text-muted-foreground/60">
                          (optionnel)
                        </span>
                      </span>
                      <input
                        className={field}
                        value={form.doc_number}
                        onChange={set("doc_number")}
                        placeholder="Ex : BF0012345678"
                        inputMode="text"
                      />
                      <span className={hint}>
                        Seuls les 4 derniers chiffres sont conservés.
                      </span>
                    </label>
                  </div>
                </div>
              )}

              {/* ── OBJET : champs dédiés ── */}
              {!isDocument && !isPerson && form.category && (
                <div className={`${card} animate-fade-in`}>
                  <p className={sectionTitle}>
                    {isLost
                      ? "Détails de l'objet perdu"
                      : "Détails de l'objet trouvé"}
                  </p>
                  <div className="mt-3 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <label className={labelCls}>
                        <span className="text-xs text-muted-foreground">
                          Marque
                        </span>
                        <input
                          className={field}
                          value={form.brand}
                          onChange={set("brand")}
                          placeholder="Ex : Tecno, Samsung..."
                        />
                      </label>
                      <label className={labelCls}>
                        <span className="text-xs text-muted-foreground">
                          Couleur
                        </span>
                        <input
                          className={field}
                          value={form.color}
                          onChange={set("color")}
                          placeholder="Ex : noir, bleu..."
                        />
                      </label>
                    </div>
                    <label className={labelCls}>
                      <span className="text-xs text-muted-foreground">
                        Nom sur l&apos;objet{" "}
                        <span className="text-muted-foreground/60">
                          (optionnel)
                        </span>
                      </span>
                      <input
                        className={field}
                        value={form.person_name}
                        onChange={set("person_name")}
                        placeholder="Prénom et nom si inscrit"
                      />
                    </label>
                  </div>
                </div>
              )}

              {/* Description */}
              {form.category && (
                <div className={`${card} animate-fade-in`}>
                  <label className={labelCls}>
                    <span className={sectionTitle}>
                      {isPerson
                        ? isLost
                          ? "Circonstances de la disparition"
                          : "Où et comment l'avez-vous retrouvé ?"
                        : "Décrivez brièvement"}
                    </span>
                    <textarea
                      rows={3}
                      className={field}
                      value={form.description}
                      onChange={set("description")}
                      placeholder={
                        isPerson
                          ? isLost
                            ? "Où la personne a-t-elle été vue pour la dernière fois ? Circonstances, direction prise..."
                            : "Où l'avez-vous trouvé ? État, circonstances..."
                          : isLost
                            ? "Comment l'avez-vous perdu ? Où exactement ? Circonstances..."
                            : "Où l'avez-vous trouvé ? Description pour aider le propriétaire..."
                      }
                    />
                  </label>
                </div>
              )}

              {/* Photo */}
              {form.category && (
                <div className={`${card} animate-fade-in`}>
                  <p className={sectionTitle}>
                    <Camera className="h-4 w-4 text-primary" /> Photo
                    <span className="text-[10px] font-normal text-muted-foreground ml-1">
                      {isPerson ? "(fortement recommandée)" : "(recommandée)"}
                    </span>
                  </p>
                  <p className={`${hint} mt-1`}>
                    {isPerson
                      ? "Une photo récente aide énormément à identifier la personne."
                      : "Une photo aide énormément à retrouver le propriétaire."}
                  </p>

                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handlePhotoInput}
                    className="hidden"
                    id="photo-camera"
                  />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoInput}
                    className="hidden"
                    id="photo-upload"
                  />

                  {photoPreview ? (
                    <div className="mt-3 relative">
                      <img
                        src={photoPreview}
                        alt="Aperçu"
                        className="w-full h-48 rounded-xl object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setPhoto(null);
                          setPhotoPreview(null);
                        }}
                        className="absolute top-2 right-2 grid h-7 w-7 place-items-center rounded-full bg-black/50 text-white text-xs"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={openCamera}
                        className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border p-4 text-sm text-muted-foreground hover:border-primary/50 hover:text-primary transition-all active:scale-[0.98]"
                      >
                        <Camera className="h-6 w-6" />
                        <span className="text-xs font-bold">
                          Prendre une photo
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={openGallery}
                        className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border p-4 text-sm text-muted-foreground hover:border-primary/50 hover:text-primary transition-all active:scale-[0.98]"
                      >
                        <Upload className="h-6 w-6" />
                        <span className="text-xs font-bold">
                          Choisir une image
                        </span>
                      </button>
                    </div>
                  )}
                </div>
              )}

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

          {/* ══════ ÉTAPE 2 : Lieu & Contact ══════ */}
          {step === 2 && (
            <div className="mt-6 grid gap-4 animate-fade-in">
              <h2 className="text-lg font-extrabold">Où et quand ?</h2>
              <p className={hint}>
                {isPerson
                  ? isLost
                    ? "Dernier lieu et date connus de la personne."
                    : "Lieu et date où vous avez retrouvé la personne."
                  : isLost
                    ? "Indiquez le lieu et la date de la perte."
                    : "Indiquez le lieu où vous avez trouvé l'objet."}
              </p>

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
                      autoComplete="address-level2"
                    />
                  </label>
                  <label className={labelCls}>
                    <span className="text-xs text-muted-foreground">
                      Quartier / secteur{" "}
                      <span className="text-muted-foreground/60">
                        (optionnel)
                      </span>
                    </span>
                    <input
                      className={field}
                      value={form.zone}
                      onChange={set("zone")}
                      placeholder="Ex : Ouaga 2000, Tampouy..."
                    />
                  </label>
                  <label className={labelCls}>
                    <span className="text-xs text-muted-foreground">
                      {isPerson
                        ? isLost
                          ? "Date de la disparition"
                          : "Date de la découverte"
                        : isLost
                          ? "Date de la perte"
                          : "Date de la découverte"}
                      <span className="text-muted-foreground/60">
                        {" "}
                        (optionnel)
                      </span>
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
                    <Phone className="h-3.5 w-3.5" /> Téléphone de contact *
                  </span>
                  <input
                    className={field}
                    value={form.phone}
                    onChange={set("phone")}
                    placeholder="+226 01 01 01 01"
                    type="tel"
                    autoComplete="tel"
                  />
                  <span className={hint}>
                    {isPerson
                      ? isLost
                        ? "Le retrouveur pourra vous joindre pour localiser la personne."
                        : "La famille pourra vous contacter pour récupérer la personne."
                      : isLost
                        ? "Le retrouveur pourra vous contacter directement."
                        : "Le propriétaire pourra vous contacter pour récupérer l'objet."}
                  </span>
                </label>
              </div>

              {/* Mise en avant */}
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
                    <p className="text-sm font-extrabold">
                      {isPerson ? "Mise en avant prioritaire" : "Mise en avant"}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {isPerson
                        ? "Votre déclaration passe en tête des résultats pendant 30 jours"
                        : "En tête des résultats pendant 30 jours"}
                    </p>
                    <p className="mt-1 text-lg font-extrabold text-primary">
                      500 FCFA
                    </p>
                    {form.priority && (
                      <>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          Paiement Payer En ligne avec code OTP : Total avec
                          frais (3%) : {formatNumber(computeTotalWithFee(500))}{" "}
                          FCFA
                        </p>
                        <div className="mt-2 grid grid-cols-2 gap-1 rounded-xl bg-muted/70 p-1">
                          <button
                            type="button"
                            onClick={() => setPayMode("online")}
                            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                              payMode === "online"
                                ? "bg-background text-foreground shadow-sm"
                                : "text-muted-foreground"
                            }`}
                          >
                            Payer En ligne avec code OTP
                          </button>
                          <button
                            type="button"
                            onClick={() => setPayMode("ussd")}
                            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                              payMode === "ussd"
                                ? "bg-background text-foreground shadow-sm"
                                : "text-muted-foreground"
                            }`}
                          >
                            Payer ici
                          </button>
                        </div>
                        {payMode === "ussd" && (
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            Composez le Payer ici affiché après envoi · 500
                            FCFA, sans frais.
                          </p>
                        )}
                      </>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setForm((f) => ({ ...f, priority: !f.priority }))
                    }
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
                  onClick={() => setStep(1)}
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
                  {saving
                    ? "Envoi en cours..."
                    : isPerson
                      ? isLost
                        ? "Publier l'alerte disparition"
                        : "Déclarer la personne retrouvée"
                      : "Publier ma déclaration"}
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
