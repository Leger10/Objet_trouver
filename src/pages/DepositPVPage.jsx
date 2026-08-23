import React, { useMemo, useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  FileText,
  Printer,
  Download,
  Eye,
  ShieldAlert,
  Loader2,
} from "lucide-react";
import { pb } from "@/lib/supabaseClient";
import Layout from "@/components/Layout";
import SearchableSelect from "@/components/SearchableSelect";
import { useAuth } from "@/contexts/AuthContext";
import { useBranding } from "@/contexts/BrandingContext";
import { LOGO_URL } from "@/lib/brandingDefaults";
import { metaForSlug } from "@/lib/categories";
import {
  savePV,
  printPV,
  generatePVNumber,
  formatDateFr,
  formatDateTimeFr,
  maskIdNumber,
  maskPhonePV,
  qrUrl,
} from "@/lib/pv";

const card = "rounded-2xl border border-border bg-card p-5";
const inputCls =
  "w-full rounded-xl border border-input bg-background px-4 py-3 text-sm outline-none focus:border-primary";
const labelCls = "block text-sm font-semibold mb-1.5";

const EMPTY = {
  signatoryName: "",
  signatoryFirstName: "",
  signatoryPhone: "",
  signatoryAddress: "",
  signatoryIdType: "CNI",
  signatoryIdNumber: "",
  objectCategory: "",
  objectDescription: "",
  objectFoundLocation: "",
  objectFoundDate: "",
  objectState: "",
  objectDistinctive: "",
  location: "Locaux RetrouveMoi",
};

const DepositPVPage = () => {
  const { user } = useAuth();
  const { branding } = useBranding();
  const isAdmin = user?.role === "admin";
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [lastPV, setLastPV] = useState(null);
  const [declarations, setDeclarations] = useState([]);
  const [selectedDecl, setSelectedDecl] = useState("");
  const [categories, setCategories] = useState([]);

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const pvNumber = useMemo(() => generatePVNumber("deposit"), []);

  useEffect(() => {
    if (!isAdmin) return;
    pb.collection("declarations")
      .getFullList({ sort: "-created", requestKey: "dpv-decl" })
      .then((list) => setDeclarations(list))
      .catch(() => {});
    pb.collection("categories")
      .getFullList({ sort: "position", requestKey: "dpv-cat" })
      .then((list) => setCategories(list))
      .catch(() => {});
  }, [isAdmin]);

  const previewPV = useMemo(
    () => ({
      pv_number: pvNumber,
      type: "deposit",
      created: new Date().toISOString(),
      location: form.location,
      data: form,
    }),
    [pvNumber, form],
  );

  if (!isAdmin) {
    return (
      <Layout>
        <Helmet>
          <title>Procès-verbal de dépôt — RetrouveMoi</title>
          <meta
            name="description"
            content="Génération du procès-verbal de dépôt d'objet trouvé, réservée aux administrateurs."
          />
        </Helmet>
        <div className="mx-auto max-w-md px-4 py-20 text-center">
          <ShieldAlert className="mx-auto h-10 w-10 text-destructive" />
          <p className="mt-4 text-lg font-bold">
            Accès réservé aux administrateurs
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Seuls les responsables RetrouveMoi peuvent générer un procès-verbal
            de dépôt.
          </p>
          <Link
            to="/connexion"
            className="mt-4 inline-block text-sm font-bold text-primary underline"
          >
            Se connecter
          </Link>
        </div>
      </Layout>
    );
  }

  const validate = () => {
    if (!form.signatoryName.trim()) {
      toast.error("Nom du déposant requis");
      return false;
    }
    if (!form.signatoryPhone.trim()) {
      toast.error("Téléphone du déposant requis");
      return false;
    }
    if (!form.objectCategory.trim()) {
      toast.error("Catégorie de l'objet requise");
      return false;
    }
    if (!form.objectDescription.trim()) {
      toast.error("Description de l'objet requise");
      return false;
    }
    return true;
  };

  const handleGenerate = async () => {
    if (!validate()) return;
    setBusy(true);
    try {
      const rec = await savePV({
        type: "deposit",
        data: form,
        relatedDeclaration: selectedDecl || null,
        generatedBy: user.id,
        generatedByName: user.name || user.email || "",
      });
      const full = { ...rec, data: form };
      setLastPV(full);
      printPV(full);

      if (selectedDecl) {
        try {
          await pb.collection("declarations").update(selectedDecl, {
            status: "depose",
            pv_id: rec.id,
          });
          toast.success("Déclaration marquée 'Objet déposé dans nos locaux'");
        } catch (_) {}
      }

      toast.success("Procès-verbal généré", {
        description: `N° ${rec.pv_number}`,
      });
    } catch (e) {
      toast.error("Génération impossible", {
        description: e?.message || "Erreur",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Layout>
      <Helmet>
        <title>Procès-verbal de dépôt — RetrouveMoi</title>
        <meta
          name="description"
          content="Générer un procès-verbal de dépôt d'objet trouvé (PDF imprimable) avec traçabilité par code QR."
        />
      </Helmet>

      <div className="mx-auto w-full max-w-[64rem] px-4 py-8">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-primary text-primary-foreground">
            <FileText className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold">
              Procès-verbal de dépôt
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Objet trouvé — N° {pvNumber}
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          {/* FORM */}
          <div className="space-y-5">
            <div className={card}>
              <p className="text-sm font-extrabold mb-3">
                Personne ayant retrouvé l'objet
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className={labelCls}>Nom *</label>
                  <input
                    className={inputCls}
                    value={form.signatoryName}
                    onChange={(e) => set("signatoryName", e.target.value)}
                    placeholder="Nom"
                  />
                </div>
                <div>
                  <label className={labelCls}>Prénom</label>
                  <input
                    className={inputCls}
                    value={form.signatoryFirstName}
                    onChange={(e) => set("signatoryFirstName", e.target.value)}
                    placeholder="Prénom"
                  />
                </div>
                <div>
                  <label className={labelCls}>Téléphone *</label>
                  <input
                    className={inputCls}
                    value={form.signatoryPhone}
                    onChange={(e) => set("signatoryPhone", e.target.value)}
                    placeholder="Ex : 01 01 01 01"
                  />
                </div>
                <div>
                  <label className={labelCls}>Adresse</label>
                  <input
                    className={inputCls}
                    value={form.signatoryAddress}
                    onChange={(e) => set("signatoryAddress", e.target.value)}
                    placeholder="Quartier, ville"
                  />
                </div>
                <div>
                  <label className={labelCls}>Type de pièce</label>
                  <select
                    className={inputCls}
                    value={form.signatoryIdType}
                    onChange={(e) => set("signatoryIdType", e.target.value)}
                  >
                    <option value="CNI">Carte d'identité (CNI)</option>
                    <option value="Passeport">Passeport</option>
                    <option value="Permis">Permis de conduire</option>
                    <option value="Autre">Autre</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>N° de pièce</label>
                  <input
                    className={inputCls}
                    value={form.signatoryIdNumber}
                    onChange={(e) => set("signatoryIdNumber", e.target.value)}
                    placeholder="Sera masqué sur le PV"
                  />
                </div>
              </div>
            </div>

            <div className={card}>
              <p className="text-sm font-extrabold mb-3">
                Déclaration associée
              </p>
              <p className="text-xs text-muted-foreground mb-2">
                Sélectionnez une déclaration existante (optionnel).
              </p>
              <SearchableSelect
                placeholder="Rechercher une déclaration…"
                value={selectedDecl}
                onChange={setSelectedDecl}
                items={declarations.map((d) => ({
                  value: d.id,
                  label: d.title,
                  sub: `— ${d.kind === "lost" ? "Perdu" : "Trouvé"} · ${d.status}`,
                }))}
              />
            </div>

            <div className={card}>
              <p className="text-sm font-extrabold mb-3">Objet retrouvé</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className={labelCls}>Catégorie *</label>
                  <SearchableSelect
                    placeholder="Rechercher une catégorie…"
                    value={form.objectCategory}
                    onChange={(v) => set("objectCategory", v)}
                    items={categories.map((c) => ({
                      value: c.name,
                      label: `${metaForSlug(c.slug).emoji} ${c.name}`,
                      sub: metaForSlug(c.slug).group,
                    }))}
                  />
                </div>
                <div>
                  <label className={labelCls}>Lieu de découverte</label>
                  <input
                    className={inputCls}
                    value={form.objectFoundLocation}
                    onChange={(e) => set("objectFoundLocation", e.target.value)}
                    placeholder="Quartier, ville"
                  />
                </div>
                <div>
                  <label className={labelCls}>Date de découverte</label>
                  <input
                    type="date"
                    className={inputCls}
                    value={form.objectFoundDate}
                    onChange={(e) => set("objectFoundDate", e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelCls}>État de l'objet</label>
                  <input
                    className={inputCls}
                    value={form.objectState}
                    onChange={(e) => set("objectState", e.target.value)}
                    placeholder="Bon, abîmé…"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelCls}>Description détaillée *</label>
                  <textarea
                    rows={3}
                    className={inputCls}
                    value={form.objectDescription}
                    onChange={(e) => set("objectDescription", e.target.value)}
                    placeholder="Marque, modèle, couleur…"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelCls}>
                    Caractéristiques distinctives
                  </label>
                  <input
                    className={inputCls}
                    value={form.objectDistinctive}
                    onChange={(e) => set("objectDistinctive", e.target.value)}
                    placeholder="Rayures, autocollants, accessoires…"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelCls}>Lieu du dépôt</label>
                  <input
                    className={inputCls}
                    value={form.location}
                    onChange={(e) => set("location", e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleGenerate}
                disabled={busy}
                className="flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-extrabold text-primary-foreground active:scale-[0.98] disabled:opacity-60"
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                Générer le procès-verbal PDF
              </button>
              <button
                type="button"
                onClick={() => printPV(previewPV)}
                className="flex items-center gap-2 rounded-xl border border-border px-4 py-3 text-sm font-bold active:scale-[0.98]"
              >
                <Printer className="h-4 w-4" /> Imprimer l'aperçu
              </button>
              <button
                type="button"
                onClick={() => setShowPreview((s) => !s)}
                className="flex items-center gap-2 rounded-xl border border-border px-4 py-3 text-sm font-bold active:scale-[0.98]"
              >
                <Eye className="h-4 w-4" /> {showPreview ? "Masquer" : "Aperçu"}
              </button>
            </div>
            {lastPV && (
              <div className={`${card} bg-accent/10`}>
                <p className="text-sm font-bold text-accent">
                  Dernier PV généré : {lastPV.pv_number}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatDateTimeFr(lastPV.created)}
                </p>
                <button
                  type="button"
                  onClick={() => printPV(lastPV)}
                  className="mt-2 text-sm font-bold text-primary underline"
                >
                  Réimprimer / Télécharger
                </button>
              </div>
            )}
          </div>

          {/* PREVIEW */}
          {showPreview && (
            <div className="lg:sticky lg:top-20 self-start">
              <div className={`${card} overflow-hidden`}>
                <p className="text-sm font-extrabold mb-3">
                  Aperçu du document
                </p>
                <PreviewDeposit pv={previewPV} />
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

const PreviewDeposit = ({ pv }) => {
  const d = pv.data;
  const { branding } = useBranding();
  const logoSrc = branding?.logo_url || LOGO_URL;
  const brandName = branding?.app_name || "RetrouveMoi";
  const Row = ({ l, v }) => (
    <div className="flex gap-2 py-1.5 border-b border-border/60 text-xs">
      <span className="w-36 shrink-0 font-bold text-muted-foreground">{l}</span>
      <span className="font-semibold">{v || "—"}</span>
    </div>
  );
  return (
    <div className="rounded-xl border border-border bg-background p-4 text-foreground">
      <div className="flex items-center gap-2 border-b-2 border-primary pb-2">
        <img
          src={logoSrc}
          alt={brandName}
          className="h-8 w-8 rounded-lg object-contain"
        />
        <span className="font-extrabold text-sm">{brandName}</span>
      </div>
      <p className="mt-3 text-center text-xs font-extrabold uppercase">
        Procès-verbal de dépôt d'objet trouvé
      </p>
      <p className="text-center text-[10px] text-muted-foreground">
        N° {pv.pv_number} · {formatDateTimeFr(pv.created)}
      </p>
      <div className="mt-3">
        <Row l="Nom" v={d.signatoryName} />
        <Row l="Prénom" v={d.signatoryFirstName} />
        <Row l="Téléphone" v={maskPhonePV(d.signatoryPhone)} />
        <Row l="Adresse" v={d.signatoryAddress} />
        <Row
          l="Pièce"
          v={`${d.signatoryIdType} — ${maskIdNumber(d.signatoryIdNumber)}`}
        />
        <Row l="Catégorie" v={d.objectCategory} />
        <Row l="Description" v={d.objectDescription} />
        <Row l="Lieu découverte" v={d.objectFoundLocation} />
        <Row l="Date découverte" v={formatDateFr(d.objectFoundDate)} />
        <Row l="État" v={d.objectState} />
        <Row l="Caractéristiques" v={d.objectDistinctive} />
        <Row l="Lieu du dépôt" v={pv.location} />
      </div>
      <p className="mt-3 rounded-lg bg-muted p-2 text-[10px] font-semibold leading-relaxed">
        Je certifie par la présente avoir trouvé l'objet décrit ci-dessus et le
        déposer auprès de RetrouveMoi pour le restituer à son propriétaire.
      </p>
      <div className="mt-4 flex justify-between text-[9px] text-muted-foreground">
        <span>Signature du déposant</span>
        <span>Signature du responsable</span>
      </div>
      <div className="mt-6 flex items-end justify-between border-t-2 border-primary pt-2">
        <img src={qrUrl(pv.pv_number)} alt="QR" className="h-16 w-16" />
        <span className="text-[9px] text-muted-foreground text-right">
          Vérifiable via QR
          <br />
          N° {pv.pv_number}
        </span>
      </div>
    </div>
  );
};

export default DepositPVPage;
