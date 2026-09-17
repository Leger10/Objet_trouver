import React, { useMemo, useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  FileCheck2,
  FileText,
  Download,
  Eye,
  ShieldAlert,
  Loader2,
  CheckCircle2,
  MapPin,
  QrCode,
} from "lucide-react";
import { pb } from "@/lib/pbClient";
import Layout from "@/components/Layout";
import SearchableSelect from "@/components/SearchableSelect";
import { useAuth } from "@/contexts/AuthContext";
import { useBranding } from "@/contexts/BrandingContext";
import { LOGO_URL } from "@/lib/brandingDefaults";
import { metaForSlug } from "@/lib/categories";
import {
  savePV,
  downloadPV,
  generatePVNumber,
  formatDateFr,
  formatDateTimeFr,
  maskIdNumber,
  maskPhonePV,
  qrUrl,
} from "@/lib/pv";
import { onCompleteRestitution, findNearestAdmin, sendPush } from "@/lib/notificationService";
import { notify } from "@/lib/retrouve";

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
  lossNumber: "",
  lossDate: "",
  lossLocation: "",
  lossDescription: "",
  objectCategory: "",
  objectDescription: "",
  objectState: "",
  objectDistinctive: "",
  conformObject: true,
  conformLossDeclaration: true,
  conformId: true,
  location: "Locaux RetrouveMoi",
};

const DEFAULT_LOCATION = EMPTY.location;

const adminLocationLabel = (admin) => {
  if (!admin) return "";
  const place = [admin.quarter, admin.city].filter(Boolean).join(", ");
  return place ? `${admin.name} · ${place}` : admin.name;
};

const userLocationLabel = (u) => {
  if (!u) return "";
  return [u.quarter, u.city].filter(Boolean).join(", ") || "";
};

const RestitutionPVPage = () => {
  const { user } = useAuth();
  const { branding } = useBranding();
  const isAdmin = user?.role === "admin";
  const [searchParams] = useSearchParams();
  const claimDeclId = searchParams.get("claim");
  const matchId = searchParams.get("match");
  const isClaimantFlow = !!claimDeclId && !isAdmin;

  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [lastPV, setLastPV] = useState(null);
  const [declarations, setDeclarations] = useState([]);
  const [selectedDecl, setSelectedDecl] = useState(claimDeclId || "");
  const [categories, setCategories] = useState([]);
  const [loadingClaim, setLoadingClaim] = useState(!!claimDeclId);
  const [depositAdmin, setDepositAdmin] = useState(null);

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const pvNumber = useMemo(() => generatePVNumber("restitution"), []);

  useEffect(() => {
    if (!isAdmin) return;
    pb.collection("declarations")
      .getFullList({ sort: "-created", requestKey: "rpv-decl" })
      .then((list) => setDeclarations(list))
      .catch(() => {});
    pb.collection("categories")
      .getFullList({ sort: "position", requestKey: "rpv-cat" })
      .then((list) => setCategories(list))
      .catch(() => {});
  }, [isAdmin]);

  // Préremplir le lieu de la restitution avec le lieu de l'admin connecté
  useEffect(() => {
    if (!isAdmin) return;
    const ownLocation = userLocationLabel(user);
    setForm((p) => (p.location.trim() && p.location !== DEFAULT_LOCATION ? p : { ...p, location: ownLocation || p.location }));
  }, [isAdmin, user]);

  useEffect(() => {
    if (!claimDeclId) return;
    setLoadingClaim(true);
    Promise.all([
      pb.collection("declarations").getOne(claimDeclId).catch(() => null),
      matchId
        ? pb.collection("matches").getFirstListItem(`id = "${matchId}"`).catch(() => null)
        : Promise.resolve(null),
      pb.collection("categories").getFullList({ sort: "position" }).catch(() => []),
    ]).then(async ([claimDecl, match, cats]) => {
      setCategories(cats);
      if (claimDecl) setSelectedDecl(claimDecl.id);

      const lostDecl = match?.lost
        ? await pb.collection("declarations").getOne(match.lost).catch(() => null)
        : null;

      // Personne remplissant le PV = propriétaire de l'objet perdu (celui qui réclame)
      const foundDecl = claimDecl;
      const claimantUserId = lostDecl?.owner || foundDecl?.owner || null;

      const [claimantUser] = await Promise.all([
        claimantUserId
          ? pb.collection("users").getOne(claimantUserId).catch(() => null)
          : Promise.resolve(null),
      ]);

      const lossDateStr = lostDecl?.event_date
        ? new Date(lostDecl.event_date).toISOString().slice(0, 10)
        : "";
      const foundDateStr = foundDecl?.event_date
        ? new Date(foundDecl.event_date).toISOString().slice(0, 10)
        : "";
      const catName = cats.find((c) => c.slug === foundDecl?.category)?.name || foundDecl?.category || "";

      setForm((p) => ({
        ...p,
        signatoryName: claimantUser?.name?.split(" ").slice(-1)[0] || claimantUser?.name || "",
        signatoryFirstName: claimantUser?.name?.split(" ").slice(0, -1).join(" ") || "",
        signatoryPhone: claimantUser?.phone || "",
        lossNumber: lostDecl?.id?.slice(0, 8).toUpperCase() || "",
        lossDate: lossDateStr,
        lossLocation: lostDecl ? `${lostDecl.zone || ""}, ${lostDecl.city || ""}`.replace(/^, |, $/g, "") : "",
        lossDescription: lostDecl?.description || lostDecl?.title || "",
        objectCategory: catName,
        objectDescription: [foundDecl?.brand, foundDecl?.color, foundDecl?.description].filter(Boolean).join(" · ") || foundDecl?.title || "",
        objectFoundLocation: foundDecl ? `${foundDecl.zone || ""}, ${foundDecl.city || ""}`.replace(/^, |, $/g, "") : "",
        objectFoundDate: foundDateStr,
      }));

      if (foundDecl) {
        findNearestAdmin(foundDecl.city || "", foundDecl.zone || "").then((admin) => {
          setDepositAdmin(admin);
          const loc = adminLocationLabel(admin);
          setForm((p) =>
            p.location.trim() && p.location !== DEFAULT_LOCATION
              ? p
              : { ...p, location: loc || p.location },
          );
        });
      }
    }).finally(() => setLoadingClaim(false));
  }, [claimDeclId, matchId]);

  const previewPV = useMemo(
    () => ({
      pv_number: pvNumber,
      type: "restitution",
      created: new Date().toISOString(),
      location: form.location,
      data: form,
    }),
    [pvNumber, form],
  );

  if (!isAdmin && !isClaimantFlow) {
    return (
      <Layout>
        <Helmet>
          <title>Procès-verbal de restitution — RetrouveMoi</title>
        </Helmet>
        <div className="mx-auto max-w-md px-4 py-20 text-center">
          <ShieldAlert className="mx-auto h-10 w-10 text-destructive" />
          <p className="mt-4 text-lg font-bold">Accès réservé</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Connectez-vous ou accédez via une demande de restitution.
          </p>
          <Link to="/connexion" className="mt-4 inline-block text-sm font-bold text-primary underline">
            Se connecter
          </Link>
        </div>
      </Layout>
    );
  }

  if (loadingClaim) {
    return (
      <Layout>
        <div className="flex flex-col items-center gap-3 py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Chargement des données de correspondance…</p>
        </div>
      </Layout>
    );
  }

  const validate = () => {
    if (!form.signatoryName.trim()) { toast.error("Nom du propriétaire requis"); return false; }
    if (!form.signatoryPhone.trim()) { toast.error("Téléphone du propriétaire requis"); return false; }
    if (!form.objectCategory.trim()) { toast.error("Catégorie de l'objet requise"); return false; }
    if (!form.objectDescription.trim()) { toast.error("Description de l'objet requise"); return false; }
    return true;
  };

  const handleGenerate = async () => {
    if (!validate()) return;
    setBusy(true);
    try {
      const rec = await savePV({
        type: "restitution",
        data: form,
        relatedDeclaration: selectedDecl || null,
        generatedBy: user.id,
      });
      const full = { ...rec, data: form };
      setLastPV(full);
      downloadPV(full);

      if (selectedDecl) {
        try {
          // Flow admin : restitution faite sur place → on marque la déclaration restituée
          if (!isClaimantFlow) {
            const decl = await pb.collection("declarations").getOne(selectedDecl);
            await pb.collection("declarations").update(selectedDecl, {
              status: "returned",
              pv_id: rec.id,
            });
            onCompleteRestitution(rec, decl, null).catch(() => {});
          }
        } catch (_) {}
      }

      if (isClaimantFlow && claimDeclId) {
        const foundDecl = await pb.collection("declarations").getOne(claimDeclId).catch(() => null);
        if (foundDecl) {
          const admin = await findNearestAdmin(foundDecl.city || "", foundDecl.zone || "");
          const adminLine = admin ? adminLocationLabel(admin) : "l'administration RetrouveMoi la plus proche";
          const claimantLabel = [form.signatoryFirstName, form.signatoryName].filter(Boolean).join(" ") || "Le propriétaire";

          await notify(
            foundDecl.owner,
            "Le propriétaire a demandé la restitution — Déposez l'objet",
            `Le propriétaire de "${foundDecl?.title || "l'objet"}" a complété son PV de restitution.\n\nRendez-vous chez ${adminLine} pour déposer l'objet et signer le PV de dépôt.\n\nPrésentez-vous avec une pièce d'identité. Un PV de dépôt sera établi par l'administrateur.`,
            `/objet/${foundDecl.id}`,
          ).catch(() => {});
          sendPush(
            foundDecl.owner,
            "Déposez l'objet chez l'admin",
            `Le propriétaire a complété son PV de restitution. Rendez-vous chez ${adminLine} pour déposer l'objet.`,
            `/objet/${foundDecl.id}`,
          ).catch(() => {});

          // Notifier l'admin : le client est attendu avec son PV (QR code) pour valider la restitution
          if (admin) {
            await notify(
              admin.id,
              "Demande de restitution en attente",
              `${claimantLabel} a généré le PV de restitution N° ${rec.pv_number} pour "${foundDecl?.title || "l'objet"}".\n\nIl se présentera dans vos locaux avec ce PV et une pièce d'identité.\nScannez le QR code ou renseignez le N° du PV (menu « Scanner un PV ») pour le retrouver et valider la restitution.`,
              `/admin/scan`,
            ).catch(() => {});
            sendPush(
              admin.id,
              "Demande de restitution en attente",
              `PV ${rec.pv_number} — ${claimantLabel} attendu. Scannez le QR / numéro pour valider la restitution.`,
              `/admin/scan`,
            ).catch(() => {});
          }
        }
      }

      toast.success("Procès-verbal généré", { description: `N° ${rec.pv_number}` });
    } catch (e) {
      toast.error("Génération impossible", { description: e?.message || "Erreur" });
    } finally {
      setBusy(false);
    }
  };

  const Checkbox = ({ k, label }) => (
    <label className="flex items-center gap-3 rounded-xl border border-border bg-background px-4 py-3 text-sm font-semibold active:scale-[0.99]">
      <input type="checkbox" checked={!!form[k]} onChange={(e) => set(k, e.target.checked)} className="h-5 w-5 accent-primary" />
      {label}
    </label>
  );

  return (
    <Layout>
      <Helmet>
        <title>Procès-verbal de restitution — RetrouveMoi</title>
        <meta name="description" content="Générer un procès-verbal de restitution d'objet trouvé (PDF imprimable) avec vérifications de conformité et code QR." />
      </Helmet>

      <div className="mx-auto w-full max-w-[64rem] px-4 py-8">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-accent text-accent-foreground">
            <FileCheck2 className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold">Procès-verbal de restitution</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              {isClaimantFlow ? "Remplissez ce formulaire pour votre demande de restitution" : "Objet restitué au propriétaire"} — N° {pvNumber}
            </p>
          </div>
        </div>

        {isClaimantFlow && (
          <div className="mt-4 rounded-2xl border border-accent/30 bg-accent/5 p-4">
            <p className="text-sm font-bold text-accent">Informations importantes</p>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              La plupart des informations sont pré-remplies automatiquement : vous ne complétez que ce qui manque. Après génération de ce PV, le déposant sera notifié de déposer l&apos;objet dans l&apos;administration recommandée. Présentez-vous sur place avec ce PV (QR code) et une pièce d&apos;identité : l&apos;admin scannera votre PV et validera la restitution. La déclaration sera marquée « Restitué » et ne sera plus d&apos;actualité.
            </p>
            {depositAdmin && (
              <div className="mt-3 rounded-xl bg-accent/10 p-3">
                <p className="flex items-center gap-1.5 text-xs font-bold text-accent">
                  <MapPin className="h-3.5 w-3.5" /> Admin recommandé pour la restitution
                </p>
                <p className="mt-1 text-sm font-extrabold">{depositAdmin.name}</p>
                <p className="text-xs text-muted-foreground">{depositAdmin.quarter}{depositAdmin.city ? ` · ${depositAdmin.city}` : ""} — ce lieu sera pré-rempli ci-dessous</p>
              </div>
            )}
          </div>
        )}

        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          <div className="space-y-5">
            <div className={card}>
              <p className="text-sm font-extrabold mb-3">Propriétaire de l'objet</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className={labelCls}>Nom *</label>
                  <input className={inputCls} value={form.signatoryName} onChange={(e) => set("signatoryName", e.target.value)} placeholder="Nom" />
                </div>
                <div>
                  <label className={labelCls}>Prénom</label>
                  <input className={inputCls} value={form.signatoryFirstName} onChange={(e) => set("signatoryFirstName", e.target.value)} placeholder="Prénom" />
                </div>
                <div>
                  <label className={labelCls}>Téléphone *</label>
                  <input className={inputCls} value={form.signatoryPhone} onChange={(e) => set("signatoryPhone", e.target.value)} placeholder="Ex : 01 01 01 01" />
                </div>
                <div>
                  <label className={labelCls}>Adresse</label>
                  <input className={inputCls} value={form.signatoryAddress} onChange={(e) => set("signatoryAddress", e.target.value)} placeholder="Quartier, ville" />
                </div>
                <div>
                  <label className={labelCls}>Type de pièce</label>
                  <select className={inputCls} value={form.signatoryIdType} onChange={(e) => set("signatoryIdType", e.target.value)}>
                    <option value="CNI">Carte d'identité (CNI)</option>
                    <option value="Passeport">Passeport</option>
                    <option value="Permis">Permis de conduire</option>
                    <option value="Autre">Autre</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>N° de pièce</label>
                  <input className={inputCls} value={form.signatoryIdNumber} onChange={(e) => set("signatoryIdNumber", e.target.value)} placeholder="Sera masqué sur le PV" />
                </div>
              </div>
            </div>

            <div className={card}>
              <p className="text-sm font-extrabold mb-3">Déclaration de perte</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className={labelCls}>Numéro de la déclaration</label>
                  <input className={inputCls} value={form.lossNumber} onChange={(e) => set("lossNumber", e.target.value)} placeholder="Référence" />
                </div>
                <div>
                  <label className={labelCls}>Date de la déclaration</label>
                  <input type="date" className={inputCls} value={form.lossDate} onChange={(e) => set("lossDate", e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>Lieu de la perte</label>
                  <input className={inputCls} value={form.lossLocation} onChange={(e) => set("lossLocation", e.target.value)} />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelCls}>Description de l'objet perdu</label>
                  <textarea rows={2} className={inputCls} value={form.lossDescription} onChange={(e) => set("lossDescription", e.target.value)} />
                </div>
              </div>
            </div>

            <div className={card}>
              <p className="text-sm font-extrabold mb-3">Objet restitué</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className={labelCls}>Catégorie *</label>
                  {isAdmin ? (
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
                  ) : (
                    <input className={inputCls} value={form.objectCategory} onChange={(e) => set("objectCategory", e.target.value)} placeholder="Catégorie" />
                  )}
                </div>
                <div>
                  <label className={labelCls}>État</label>
                  <input className={inputCls} value={form.objectState} onChange={(e) => set("objectState", e.target.value)} />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelCls}>Description *</label>
                  <textarea rows={2} className={inputCls} value={form.objectDescription} onChange={(e) => set("objectDescription", e.target.value)} />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelCls}>Caractéristiques distinctives</label>
                  <input className={inputCls} value={form.objectDistinctive} onChange={(e) => set("objectDistinctive", e.target.value)} />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelCls}>Lieu de la restitution</label>
                  <input className={inputCls} value={form.location} onChange={(e) => set("location", e.target.value)} />
                </div>
              </div>
            </div>

            {isAdmin && (
              <div className={card}>
                <p className="text-sm font-extrabold mb-3">Déclaration associée</p>
                <p className="text-xs text-muted-foreground mb-2">Sélectionnez la déclaration de perte correspondante (optionnel).</p>
                <SearchableSelect
                  placeholder="Rechercher une déclaration…"
                  value={selectedDecl}
                  onChange={setSelectedDecl}
                  items={declarations.filter((d) => d.kind === "lost").map((d) => ({
                    value: d.id,
                    label: d.title,
                    sub: `— ${d.status}`,
                  }))}
                />
              </div>
            )}

            <div className={card}>
              <p className="text-sm font-extrabold mb-3">Vérification de conformité</p>
              <div className="grid gap-2.5">
                <Checkbox k="conformObject" label="L'objet restitué correspond à la déclaration de perte" />
                <Checkbox k="conformLossDeclaration" label="Le propriétaire a présenté une copie de la déclaration de perte" />
                <Checkbox k="conformId" label="Le propriétaire a présenté une pièce d'identité" />
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleGenerate}
                disabled={busy}
                className="flex items-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-extrabold text-accent-foreground active:scale-[0.98] disabled:opacity-60"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                Générer le procès-verbal PDF
              </button>
              <button
                type="button"
                onClick={() => downloadPV(previewPV)}
                className="flex items-center gap-2 rounded-xl border border-border px-4 py-3 text-sm font-bold active:scale-[0.98]"
              >
                <Download className="h-4 w-4" /> Télécharger le PDF
              </button>
              <button
                type="button"
                onClick={() => setShowPreview((s) => !s)}
                className="flex items-center gap-2 rounded-xl border border-border px-4 py-3 text-sm font-bold active:scale-[0.98]"
              >
                <Eye className="h-4 w-4" /> {showPreview ? "Masquer" : "Aperçu"}
              </button>
            </div>
          </div>

          {showPreview && (
            <div className="lg:sticky lg:top-20 self-start">
              <div className={`${card} overflow-hidden`}>
                <p className="text-sm font-extrabold mb-3">Aperçu du document</p>
                <PreviewRestitution pv={previewPV} />
              </div>
            </div>
          )}
        </div>

        {lastPV && (
          <div className="mt-6 rounded-2xl border border-green-200 bg-green-50 dark:bg-green-900/20 dark:border-green-800/30 p-5">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-extrabold text-green-700 dark:text-green-300">PV généré avec succès !</p>
                <p className="mt-1 text-xs text-green-600 dark:text-green-400">
                  N° <span className="font-mono font-bold">{lastPV.pv_number}</span> · {formatDateTimeFr(lastPV.created)}
                </p>

                {isClaimantFlow && (
                  <div className="mt-3 rounded-xl bg-white dark:bg-green-900/10 border border-green-200 dark:border-green-800/20 p-3">
                    <p className="text-xs font-bold text-green-700 dark:text-green-300 mb-2">Prochaines étapes :</p>
                    <ol className="text-xs text-green-600 dark:text-green-400 space-y-1.5 list-decimal list-inside leading-relaxed">
                      <li>Téléchargez ou imprimez ce PV (ci-dessous) — un code QR permet de le vérifier</li>
                      <li>Le déposant a été notifié : il déposera l&apos;objet chez l&apos;admin et un PV de dépôt sera établi</li>
                      {depositAdmin && (
                        <li className="font-bold">
                          Admin recommandé : {depositAdmin.name} ({depositAdmin.quarter}{depositAdmin.city ? ` · ${depositAdmin.city}` : ""})
                        </li>
                      )}
                      <li>Présentez-vous sur place avec ce PV (QR code) et une pièce d&apos;identité</li>
                      <li>L&apos;admin scannera votre QR code (ou saisira le N° du PV) et validera la restitution — la déclaration sera marquée « Restitué » et ne sera plus d&apos;actualité</li>
                    </ol>
                  </div>
                )}

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => downloadPV(lastPV)}
                    className="inline-flex items-center gap-2 rounded-xl bg-green-600 px-4 py-2.5 text-sm font-extrabold text-white active:scale-[0.98]"
                  >
                    <Download className="h-4 w-4" /> Télécharger le PDF
                  </button>
                  <Link
                    to={`/pv/${lastPV.pv_number}`}
                    target="_blank"
                    className="inline-flex items-center gap-2 rounded-xl border border-green-300 bg-white px-4 py-2.5 text-sm font-bold text-green-700 active:scale-[0.98]"
                  >
                    <QrCode className="h-4 w-4" /> Voir le PV en ligne
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

const PreviewRestitution = ({ pv }) => {
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
  const V = ({ label }) => (
    <div className="flex items-center justify-between gap-2 py-1 text-[11px]">
      <span className="font-semibold">{label}</span>
      <span className="flex shrink-0 items-center gap-3">
        <span className="inline-flex items-center gap-1 font-bold">
          <span className="inline-block h-3.5 w-3.5 rounded border-2 border-slate-500 bg-white" /> OUI
        </span>
        <span className="inline-flex items-center gap-1 font-bold">
          <span className="inline-block h-3.5 w-3.5 rounded border-2 border-slate-500 bg-white" /> NON
        </span>
      </span>
    </div>
  );
  return (
    <div className="rounded-xl border border-border bg-background p-4 text-foreground">
      <div className="flex items-center gap-2 border-b-2 border-accent pb-2">
        <img src={logoSrc} alt={brandName} className="h-8 w-8 rounded-lg object-contain" />
        <span className="font-extrabold text-sm">{brandName}</span>
      </div>
      <p className="mt-3 text-center text-xs font-extrabold uppercase">Procès-verbal de restitution d'objet trouvé</p>
      <p className="text-center text-[10px] text-muted-foreground">N° {pv.pv_number} · {formatDateTimeFr(pv.created)}</p>
      <div className="mt-3">
        <Row l="Nom" v={d.signatoryName} />
        <Row l="Prénom" v={d.signatoryFirstName} />
        <Row l="Téléphone" v={maskPhonePV(d.signatoryPhone)} />
        <Row l="Pièce" v={`${d.signatoryIdType} — ${maskIdNumber(d.signatoryIdNumber)}`} />
        <Row l="N° déclaration" v={d.lossNumber} />
        <Row l="Date déclaration" v={formatDateFr(d.lossDate)} />
        <Row l="Lieu de la perte" v={d.lossLocation} />
        <Row l="Catégorie" v={d.objectCategory} />
        <Row l="Description" v={d.objectDescription} />
        <Row l="État" v={d.objectState} />
        <Row l="Lieu de la restitution" v={pv.location} />
      </div>
      <div className="mt-2 space-y-0.5">
        <p className="text-[10px] font-extrabold uppercase text-muted-foreground">Vérification de conformité</p>
        <V label="Correspond à la déclaration de perte" />
        <V label="Copie de la déclaration présentée" />
        <V label="Pièce d'identité présentée" />
      </div>
      <p className="mt-3 rounded-lg bg-muted p-2 text-[10px] font-semibold leading-relaxed">
        Je certifie par la présente avoir reçu l'objet décrit ci-dessus et reconnaître qu'il correspond à ma déclaration de perte.
      </p>
      <div className="mt-4 flex justify-between text-[9px] text-muted-foreground">
        <span>Signature du propriétaire</span>
        <span>Signature du responsable</span>
      </div>
      <div className="mt-6 flex items-end justify-between border-t-2 border-accent pt-2">
        <img src={qrUrl(pv.pv_number)} alt="QR" className="h-16 w-16" />
        <span className="text-[9px] text-muted-foreground text-right">
          Vérifiable via QR<br />N° {pv.pv_number}
        </span>
      </div>
    </div>
  );
};

export default RestitutionPVPage;
