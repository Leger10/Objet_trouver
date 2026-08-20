import { pb } from "@/lib/supabaseClient";
import { BRANDING_DEFAULTS, LOGO_URL } from "@/lib/brandingDefaults";

let cachedBranding = null;

export const getBrandingForPV = async () => {
  if (cachedBranding) return cachedBranding;
  try {
    const rec = await pb
      .collection("branding_settings")
      .getFirstListItem("id = 'default'", { requestKey: "pv-branding" });
    const logoFile = rec.logo_file ? pb.files.getURL(rec, rec.logo_file) : "";
    cachedBranding = {
      ...BRANDING_DEFAULTS,
      app_name: rec.app_name || BRANDING_DEFAULTS.app_name,
      logo_url: logoFile || rec.logo_url || LOGO_URL,
      tagline: rec.tagline || BRANDING_DEFAULTS.tagline,
      color_red: rec.color_red || BRANDING_DEFAULTS.color_red,
      color_green: rec.color_green || BRANDING_DEFAULTS.color_green,
      color_blue: rec.color_blue || BRANDING_DEFAULTS.color_blue,
      color_yellow: rec.color_yellow || BRANDING_DEFAULTS.color_yellow,
      address: rec.address || BRANDING_DEFAULTS.address,
      phone: rec.phone || BRANDING_DEFAULTS.phone,
      email: rec.email || BRANDING_DEFAULTS.email,
    };
  } catch (_) {
    cachedBranding = { ...BRANDING_DEFAULTS, logo_url: LOGO_URL };
  }
  return cachedBranding;
};

// ── Helpers ────────────────────────────────────────────────────────────────

export const maskIdNumber = (num) => {
  if (!num) return "—";
  const s = String(num).replace(/\s+/g, "");
  if (s.length <= 4) return s;
  return `********${s.slice(-4)}`;
};

export const maskPhonePV = (phone) => {
  if (!phone) return "—";
  const s = String(phone).replace(/\s+/g, "");
  if (s.length <= 4) return s;
  return `${s.slice(0, 3)} ** ** ** ${s.slice(-2)}`;
};

// Generate a unique PV number: PV-YYYYMMDD-XXXX
export const generatePVNumber = (type = "deposit") => {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  const prefix = type === "restitution" ? "PV-R" : "PV-D";
  return `${prefix}-${ymd}-${rand}`;
};

export const qrUrl = (pvNumber) =>
  `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(
    `${typeof window !== "undefined" ? window.location.origin : "https://objetrouve.app"}/pv/${pvNumber}`,
  )}`;

export const formatDateFr = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
};

export const formatDateTimeFr = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" })} à ${d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
};

// ── Save a PV record to PocketBase ─────────────────────────────────────────

export const savePV = async ({
  type,
  data,
  relatedDeclaration = null,
  generatedBy,
  generatedByName = "",
}) => {
  const pvNumber = generatePVNumber(type);
  const enrichedData = { ...data, adminName: generatedByName || data?.adminName || "" };
  const payload = {
    pv_number: pvNumber,
    type,
    generated_by: generatedBy,
    related_declaration: relatedDeclaration || null,
    signatory_name: data.signatoryName || "",
    signatory_phone: data.signatoryPhone || "",
    signatory_id_type: data.signatoryIdType || "",
    signatory_id_number: maskIdNumber(data.signatoryIdNumber),
    object_category: data.objectCategory || "",
    object_description: data.objectDescription || "",
    location: data.location || "Locaux RetrouveMoi",
    data: enrichedData,
  };
  const rec = await pb
    .collection("pvs")
    .create(payload, { requestKey: `pv-${pvNumber}` });
  return rec;
};

// ── HTML document builder for print / PDF ──────────────────────────────────

const sectionRow = (label, value) => `
    <tr><td class="lbl">${label}</td><td class="val">${value || "—"}</td></tr>`;

const verifRow = (label, ok) => `
    <tr><td class="lbl">${label}</td><td class="val"><span class="box">${ok ? "☒" : "☐"}</span> OUI &nbsp;&nbsp; <span class="box">${!ok ? "☒" : "☐"}</span> NON</td></tr>`;

export const buildPVHtml = (pv, branding = BRANDING_DEFAULTS) => {
  const d = pv.data || {};
  const isDeposit = pv.type === "deposit";
  const brand = { ...BRANDING_DEFAULTS, ...branding };
  const brandName = brand.app_name || "RetrouveMoi";
  const brandBlue = brand.color_blue || "#001F3F";
  const brandGreen = brand.color_green || "#2D6A4F";
  const logoSrc = brand.logo_url || LOGO_URL;
  const title = isDeposit
    ? "PROCÈS-VERBAL DE DÉPÔT D'OBJET TROUVÉ"
    : "PROCÈS-VERBAL DE RESTITUTION D'OBJET TROUVÉ";
  const signatoryLabel = isDeposit
    ? "Personne ayant retrouvé l'objet"
    : "Propriétaire de l'objet";

  const signatoryRows = [
    sectionRow("Nom", d.signatoryName),
    sectionRow("Prénom", d.signatoryFirstName),
    sectionRow("Numéro de téléphone", maskPhonePV(d.signatoryPhone)),
    sectionRow("Adresse", d.signatoryAddress),
    sectionRow("Pièce d'identité (type)", d.signatoryIdType),
    sectionRow("N° de pièce (masqué)", maskIdNumber(d.signatoryIdNumber)),
  ].join("");

  const objectRows = [
    sectionRow("Catégorie", d.objectCategory),
    sectionRow("Description détaillée", d.objectDescription),
    sectionRow("Lieu de découverte", d.objectFoundLocation),
    sectionRow("Date de découverte", formatDateFr(d.objectFoundDate)),
    sectionRow("État de l'objet", d.objectState),
    sectionRow("Caractéristiques distinctives", d.objectDistinctive),
  ].join("");

  const lossRows = isDeposit
    ? ""
    : [
        sectionRow("Numéro de la déclaration de perte", d.lossNumber),
        sectionRow("Date de la déclaration", formatDateFr(d.lossDate)),
        sectionRow("Lieu de la perte", d.lossLocation),
        sectionRow("Description de l'objet perdu", d.lossDescription),
      ].join("");

  const verifBlock = isDeposit
    ? ""
    : `
        <h3>Vérification de conformité</h3>
        <table class="info">
          ${verifRow("L'objet restitué correspond à la déclaration de perte", d.conformObject)}
          ${verifRow("Le propriétaire a présenté une copie de la déclaration de perte", d.conformLossDeclaration)}
          ${verifRow("Le propriétaire a présenté une pièce d'identité", d.conformId)}
        </table>`;

  const adminName = d.adminName || "";
  const adminBlock = isDeposit && (adminName || pv.location) ? `
        <h3>Informations de retrait pour le propriétaire</h3>
        <div style="background: #e8f4fd; border: 2px solid #3b82f6; border-radius: 10px; padding: 14px 16px; margin: 14px 0;">
          ${adminName ? `<p style="margin: 4px 0; font-size: 12.5px;"><b>Administrateur responsable :</b> ${adminName}</p>` : ""}
          ${pv.location ? `<p style="margin: 4px 0; font-size: 12.5px;"><b>Lieu de dépôt :</b> ${pv.location}</p>` : ""}
          <p style="margin: 8px 0 0; font-size: 11.5px; color: #1e40af; font-weight: 700;">
            Le propriétaire doit se présenter sur ce lieu avec une pièce d'identité pour récupérer son objet.
          </p>
        </div>`
    : "";

  const declaration = isDeposit
    ? `Je certifie par la présente avoir trouvé l'objet décrit ci-dessus et le déposer auprès de ${brandName} pour le restituer à son propriétaire.`
    : `Je certifie par la présente avoir reçu l'objet décrit ci-dessus et reconnaître qu'il correspond à ma déclaration de perte.`;

  const contactBits = [brand.address, brand.phone, brand.email]
    .filter(Boolean)
    .join(" · ");

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<title>${title} — ${pv.pv_number}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: "Manrope", "Segoe UI", Arial, sans-serif; color: #0f1f2e; margin: 0; padding: 28px 32px; }
  .doc { max-width: 760px; margin: 0 auto; }
  .head { display: flex; align-items: center; gap: 14px; border-bottom: 3px solid ${brandBlue}; padding-bottom: 14px; }
  .logo-img { width: 64px; height: 64px; object-fit: contain; border-radius: 12px; background: #000; }
  .brand { font-size: 20px; font-weight: 800; letter-spacing: -0.02em; color: ${brandBlue}; }
  .brand small { display: block; font-size: 11px; font-weight: 600; color: #5a6b7a; letter-spacing: 0.04em; text-transform: uppercase; }
  .pv-title { margin: 18px 0 4px; font-size: 17px; font-weight: 800; text-transform: uppercase; text-align: center; color: ${brandBlue}; }
  .pv-meta { display: flex; justify-content: space-between; font-size: 12px; color: #5a6b7a; margin-bottom: 16px; }
  h3 { font-size: 13px; font-weight: 800; text-transform: uppercase; color: ${brandBlue}; margin: 18px 0 6px; border-left: 4px solid ${brandGreen}; padding-left: 8px; }
  table.info { width: 100%; border-collapse: collapse; font-size: 12.5px; }
  table.info td { border: 1px solid #d8e0e6; padding: 7px 10px; vertical-align: top; }
  td.lbl { width: 38%; background: #f4f7f9; font-weight: 700; color: #33475a; }
  td.val { font-weight: 600; }
  .box { font-family: monospace; font-size: 14px; }
  .declaration { margin: 18px 0; padding: 14px 16px; background: #f4f7f9; border: 1px solid #d8e0e6; border-radius: 10px; font-size: 12.5px; font-weight: 600; line-height: 1.5; }
  .signs { display: flex; gap: 28px; margin-top: 36px; }
  .sign { flex: 1; text-align: center; }
  .sign .line { border-top: 1.5px solid #0f1f2e; margin-top: 44px; padding-top: 6px; font-size: 11px; font-weight: 700; }
  .sign .sub { font-size: 10px; color: #5a6b7a; }
  .foot { display: flex; align-items: flex-end; justify-content: space-between; margin-top: 28px; border-top: 2px solid ${brandBlue}; padding-top: 12px; }
  .qr { width: 96px; height: 96px; }
  .foot-info { font-size: 10.5px; color: #5a6b7a; text-align: right; line-height: 1.5; }
  .foot-info b { color: #0f1f2e; }
  @media print { body { padding: 12px; } .doc { max-width: 100%; } }
</style>
</head>
<body>
  <div class="doc">
    <div class="head">
      <img class="logo-img" src="${logoSrc}" alt="${brandName}" />
      <div class="brand">${brandName}<small>${brand.tagline || ""}</small></div>
    </div>

    <h1 class="pv-title">${title}</h1>
    <div class="pv-meta">
      <span><b>N° ${pv.pv_number}</b></span>
      <span>${formatDateTimeFr(pv.created || new Date().toISOString())}</span>
    </div>

    <h3>Informations du document</h3>
    <table class="info">
      ${sectionRow("Numéro du procès-verbal", pv.pv_number)}
      ${sectionRow("Date et heure", formatDateTimeFr(pv.created || new Date().toISOString()))}
      ${sectionRow("Lieu", pv.location || brand.address || `Locaux ${brandName}`)}
    </table>

    <h3>${signatoryLabel}</h3>
    <table class="info">${signatoryRows}</table>

    ${isDeposit ? "" : `<h3>Déclaration de perte</h3><table class="info">${lossRows}</table>`}

    <h3>Informations de l'objet</h3>
    <table class="info">${objectRows}</table>

    ${verifBlock}

    ${adminBlock}

    <div class="declaration">${declaration}</div>

    <div class="signs">
      <div class="sign"><div class="line">Signature ${isDeposit ? "du déposant" : "du propriétaire"}<div class="sub">(et empreinte digitale, optionnel)</div></div></div>
      <div class="sign"><div class="line">Signature du responsable ${brandName}<div class="sub">Cachet & date</div></div></div>
    </div>

    <div class="foot">
      <img class="qr" src="${qrUrl(pv.pv_number)}" alt="Code QR de traçabilité" />
      <div class="foot-info">
        <b>${brandName}</b><br/>
        ${contactBits ? `${contactBits}<br/>` : ""}
        Document généré électroniquement — ${formatDateTimeFr(pv.created || new Date().toISOString())}<br/>
        Vérifiable via le code QR · N° ${pv.pv_number}
      </div>
    </div>
  </div>
</body>
</html>`;
};

// Open the PV in a new window and trigger the print dialog (Save as PDF available there)
export const printPV = async (pv) => {
  const branding = await getBrandingForPV();
  const html = buildPVHtml(pv, branding);
  const w = window.open("", "_blank", "width=820,height=1000");
  if (!w) {
    alert("Veuillez autoriser les pop-ups pour générer le procès-verbal.");
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => {
    try {
      w.print();
    } catch (_) {
      /* ignore */
    }
  }, 700);
};

export const TYPE_LABELS = {
  deposit: "Dépôt d'objet trouvé",
  restitution: "Restitution d'objet",
};

export const TYPE_BADGE = {
  deposit: "bg-primary/15 text-primary",
  restitution: "bg-accent/15 text-accent",
};
