import { pb } from "@/lib/pbClient";
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

// Checkboxes stay EMPTY on purpose : the admin ticks them by hand with a pen
// after printing the document.
const verifRow = (label) => `
    <tr>
      <td class="lbl">${label}</td>
      <td class="val">
        <span class="chk"><span class="box"></span> OUI</span>
        <span class="chk"><span class="box"></span> NON</span>
      </td>
    </tr>`;

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
          ${verifRow("L'objet restitué correspond à la déclaration de perte")}
          ${verifRow("Le propriétaire a présenté une copie de la déclaration de perte")}
          ${verifRow("Le propriétaire a présenté une pièce d'identité")}
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
  .pv-pagebreak { height: 0; margin: 0; padding: 0; }
  .doc { max-width: 760px; margin: 0 auto; }
  .head { display: flex; align-items: center; gap: 14px; border-bottom: 3px solid ${brandBlue}; padding-bottom: 14px; }
  .logo-img { width: 64px; height: 64px; object-fit: contain; border-radius: 12px; background: #000; }
  .brand { font-size: 20px; font-weight: 800; letter-spacing: -0.02em; color: ${brandBlue}; }
  .brand small { display: block; font-size: 11px; font-weight: 600; color: #5a6b7a; letter-spacing: 0.04em; text-transform: uppercase; }
  .pv-title { margin: 18px 0 4px; font-size: 17px; font-weight: 800; text-transform: uppercase; text-align: center; color: ${brandBlue}; }
  .pv-meta { display: flex; justify-content: space-between; font-size: 12px; color: #5a6b7a; margin-bottom: 16px; }
  h3 { font-size: 13px; font-weight: 800; text-transform: uppercase; color: ${brandBlue}; margin: 18px 0 6px; border-left: 4px solid ${brandGreen}; padding-left: 8px; }
  table.info { width: 100%; border-collapse: collapse; font-size: 12.5px; }
  table.info td { border: 1px solid #d8e0e6; padding: 8px 12px; vertical-align: middle; }
  td.lbl { width: 46%; background: #f4f7f9; font-weight: 700; color: #33475a; line-height: 1.45; }
  td.val { font-weight: 600; }
  .chk { display: inline-flex; align-items: center; gap: 6px; margin-right: 22px; white-space: nowrap; }
  .box { display: inline-block; width: 13px; height: 13px; border: 1.5px solid #33475a; border-radius: 2px; }
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

    <div class="pv-pagebreak"></div>

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

const toImage = async (url) => {
  if (!url) return null;
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) return null;
    const blob = await res.blob();
    const type = blob.type || "";
    if (/svg|webp/i.test(type)) return null;
    let format = "";
    if (/jpeg|jpg/i.test(type)) format = "JPEG";
    else if (/png/i.test(type)) format = "PNG";
    const dataUrl = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => resolve("");
      reader.readAsDataURL(blob);
    });
    if (!dataUrl) return null;
    return { dataUrl, format };
  } catch (_) {
    return null;
  }
};

// ── PDF download (mobile-friendly) ────────────────────────────────────────
//
// Generated with the jsPDF text engine (vector text): word spacing is always
// respected and the text stays selectable. The layout mirrors the HTML print
// view: header, titles, bordered "table" sections, empty OUI/NON squares that
// the admin ticks by hand, declaration box, signatures and QR footer.

const hexToRgb = (hex) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ""));
  if (!m) return [0, 31, 63];
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

export const downloadPV = async (pv) => {
  const { jsPDF } = await import("jspdf");
  const branding = await getBrandingForPV();
  const [logo, qr] = await Promise.all([
    toImage(branding.logo_url || LOGO_URL),
    toImage(qrUrl(pv.pv_number)),
  ]);

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const d = pv.data || {};
  const isDeposit = pv.type === "deposit";

  const M = 14; // page margin
  const W = 210; // page width
  const CONTENT = W - M * 2; // 182 mm
  const LABEL_W = Math.round(CONTENT * 0.46); // ≈ 84 mm
  const VALUE_W = CONTENT - LABEL_W;
  const BLUE = hexToRgb(branding.color_blue);
  const GREEN = hexToRgb(branding.color_green);
  const DARK = [15, 31, 47];
  const GRAY = [90, 107, 122];
  const LBL_GRAY = [51, 71, 90];
  const BRAND_NAME = branding.app_name || "RetrouveMoi";
  const TAGLINE = branding.tagline || "";
  const DATE_TIME = formatDateTimeFr(pv.created || new Date().toISOString());
  const TITLE = isDeposit
    ? "PROCÈS-VERBAL DE DÉPÔT D'OBJET TROUVÉ"
    : "PROCÈS-VERBAL DE RESTITUTION D'OBJET TROUVÉ";
  const SIGNATORY_LABEL = isDeposit
    ? "Personne ayant retrouvé l'objet"
    : "Propriétaire de l'objet";

  let y = 14;

  const ensure = (needed) => {
    if (y + needed > 262) {
      doc.addPage();
      y = 24;
    }
  };

  const section = (label) => {
    ensure(12);
    y += 6;
    doc.setFillColor(...GREEN);
    doc.roundedRect(M, y - 4, 1.6, 5, 0.4, 0.4, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(...BLUE);
    doc.text(label.toUpperCase(), M + 4.5, y);
    y += 4;
  };

  const rowText = (label, value) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    const valLines = doc.splitTextToSize(String(value || "—"), VALUE_W - 5);
    const labLines = doc.splitTextToSize(String(label), LABEL_W - 5);
    const lines = Math.max(valLines.length, labLines.length, 1);
    const rowH = lines * 3.9 + 4;
    ensure(rowH + 1.2);
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(216, 224, 230);
    doc.setLineWidth(0.2);
    doc.rect(M, y, CONTENT, rowH, "FD");
    doc.setFillColor(244, 247, 249);
    doc.rect(M, y, LABEL_W, rowH, "F");
    doc.line(M + LABEL_W, y, M + LABEL_W, y + rowH);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(...LBL_GRAY);
    doc.text(labLines, M + 3, y + 4);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...DARK);
    doc.text(valLines, M + LABEL_W + 3, y + 4);
    y += rowH + 0.8;
  };

  const checkRow = (label) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    const labLines = doc.splitTextToSize(String(label), LABEL_W - 5);
    const rowH = Math.max(1, labLines.length) * 3.9 + 4;
    ensure(rowH + 1.2);
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(216, 224, 230);
    doc.setLineWidth(0.2);
    doc.rect(M, y, CONTENT, rowH, "FD");
    doc.setFillColor(244, 247, 249);
    doc.rect(M, y, LABEL_W, rowH, "F");
    doc.line(M + LABEL_W, y, M + LABEL_W, y + rowH);
    doc.setTextColor(...LBL_GRAY);
    doc.text(labLines, M + 3, y + 4);
    const bs = y + rowH / 2 + 1.1;
    const boxTop = bs - 3.5;
    const boxSize = 3.3;
    let sx = M + LABEL_W + 4;
    doc.setDrawColor(...LBL_GRAY);
    doc.setLineWidth(0.3);
    doc.setFillColor(255, 255, 255);
    doc.rect(sx, boxTop, boxSize, boxSize, "FD");
    doc.setTextColor(...DARK);
    doc.text("OUI", sx + boxSize + 1.2, bs);
    sx += 21;
    doc.rect(sx, boxTop, boxSize, boxSize, "FD");
    doc.text("NON", sx + boxSize + 1.2, bs);
    y += rowH + 0.8;
  };

  const footer = () => {
    doc.setDrawColor(...BLUE);
    doc.setLineWidth(0.8);
    doc.line(M, 271, W - M, 271);
    if (qr) {
      try {
        doc.addImage(qr.dataUrl, qr.format || "PNG", M, 274.5, 20, 20);
      } catch (_) {}
    }
    const fx = W - M;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...DARK);
    doc.text(BRAND_NAME, fx, 279, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...GRAY);
    const cbits = [branding.address, branding.phone, branding.email].filter(Boolean).join(" · ");
    if (cbits) doc.text(cbits, fx, 283, { align: "right", maxWidth: CONTENT - 26 });
    doc.setFontSize(7);
    doc.text(`Document généré électroniquement — ${DATE_TIME}`, fx, 286.5, { align: "right", maxWidth: CONTENT - 26 });
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...DARK);
    doc.text(`Vérifiable via le code QR · N° ${pv.pv_number}`, fx, 290, { align: "right", maxWidth: CONTENT - 26 });
    doc.setLineWidth(0.2);
  };

  // ── Header ──
  let lx = M;
  if (logo) {
    try {
      doc.addImage(logo.dataUrl, logo.format || "PNG", M, 9, 15, 15);
      lx = M + 19;
    } catch (_) {}
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...BLUE);
  doc.text(BRAND_NAME, lx, 15, { maxWidth: CONTENT - (lx - M) - 30 });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  doc.text(TAGLINE, lx, 19, { maxWidth: CONTENT - (lx - M) - 30 });
  doc.text(DATE_TIME, W - M, 15, { align: "right" });
  doc.setDrawColor(...BLUE);
  doc.setLineWidth(0.8);
  doc.line(M, 24, W - M, 24);
  y = 28;

  // ── Title ──
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12.5);
  doc.setTextColor(...BLUE);
  doc.text(TITLE, W / 2, y + 3.5, { align: "center" });
  y += 8;

  // ── Document info ──
  section("Informations du document");
  rowText("Numéro du procès-verbal", pv.pv_number);
  rowText("Date et heure", DATE_TIME);
  rowText("Lieu", pv.location || branding.address || `Locaux ${BRAND_NAME}`);

  // ── Signatory ──
  section(SIGNATORY_LABEL);
  rowText("Nom", d.signatoryName);
  rowText("Prénom", d.signatoryFirstName);
  rowText("Numéro de téléphone", maskPhonePV(d.signatoryPhone));
  rowText("Adresse", d.signatoryAddress);
  rowText("Pièce d'identité (type)", d.signatoryIdType);
  rowText("N° de pièce (masqué)", maskIdNumber(d.signatoryIdNumber));

  // ── Loss declaration ──
  if (!isDeposit) {
    section("Déclaration de perte");
    rowText("Numéro de la déclaration de perte", d.lossNumber);
    rowText("Date de la déclaration", formatDateFr(d.lossDate));
    rowText("Lieu de la perte", d.lossLocation);
    rowText("Description de l'objet perdu", d.lossDescription);
  }

  // ── Object ──
  section("Informations de l'objet");
  rowText("Catégorie", d.objectCategory);
  rowText("Description détaillée", d.objectDescription);
  rowText("Lieu de découverte", d.objectFoundLocation);
  rowText("Date de découverte", formatDateFr(d.objectFoundDate));
  rowText("État de l'objet", d.objectState);
  rowText("Caractéristiques distinctives", d.objectDistinctive);

  // ── Admin pickup block (deposit only, stays on page 1) ──
  const adminName = d.adminName || "";
  if (isDeposit && (adminName || pv.location)) {
    section("Informations de retrait pour le propriétaire");
    const boxLines = [];
    if (adminName) boxLines.push(`Administrateur responsable : ${adminName}`);
    if (pv.location) boxLines.push(`Lieu de dépôt : ${pv.location}`);
    boxLines.push("Le propriétaire doit se présenter sur ce lieu avec une pièce d'identité pour récupérer son objet.");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    const parsed = [];
    for (const line of boxLines) parsed.push(...doc.splitTextToSize(line, CONTENT - 10));
    const boxH = parsed.length * 4 + 7;
    ensure(boxH + 2);
    doc.setFillColor(232, 244, 253);
    doc.setDrawColor(59, 130, 246);
    doc.setLineWidth(0.4);
    doc.roundedRect(M, y, CONTENT, boxH, 1.5, 1.5, "FD");
    doc.setTextColor(30, 64, 175);
    doc.text(parsed, M + 5, y + 5.5);
    y += boxH + 3;
    doc.setLineWidth(0.2);
  }

  // ── Page 2 : conformity + declaration + signatures + QR footer ──
  doc.addPage();
  y = 24;

  if (!isDeposit) {
    section("Vérification de conformité");
    checkRow("L'objet restitué correspond à la déclaration de perte");
    checkRow("Le propriétaire a présenté une copie de la déclaration de perte");
    checkRow("Le propriétaire a présenté une pièce d'identité");
  }

  section("Déclaration");
  const declaration = isDeposit
    ? `Je certifie par la présente avoir trouvé l'objet décrit ci-dessus et le déposer auprès de ${BRAND_NAME} pour le restituer à son propriétaire.`
    : `Je certifie par la présente avoir reçu l'objet décrit ci-dessus et reconnaître qu'il correspond à ma déclaration de perte.`;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  const decLines = doc.splitTextToSize(declaration, CONTENT - 8);
  const boxH = decLines.length * 4 + 7;
  ensure(boxH + 6);
  y += 4;
  doc.setFillColor(244, 247, 249);
  doc.setDrawColor(216, 224, 230);
  doc.roundedRect(M, y, CONTENT, boxH, 2, 2, "FD");
  doc.setTextColor(...DARK);
  doc.text(decLines, M + 4, y + 5.5);
  y += boxH + 8;

  // ── Signatures ──
  ensure(38);
  y += 6;
  const sigY = y + 24;
  doc.setDrawColor(...DARK);
  doc.setLineWidth(0.4);
  doc.line(M, sigY, M + 56, sigY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...GRAY);
  doc.text(`Signature ${isDeposit ? "du déposant" : "du propriétaire"}`, M, sigY + 4);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text("(et empreinte digitale, optionnel)", M, sigY + 7, { maxWidth: 56 });
  const rx = W - M - 56;
  doc.line(rx, sigY, W - M, sigY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text(`Signature du responsable ${BRAND_NAME}`, W - M, sigY + 4, { align: "right" });
  doc.text("Cachet & date", W - M, sigY + 7, { align: "right" });
  y = sigY + 10;

  footer();
  doc.save(`${pv.pv_number}.pdf`);
};

export const TYPE_LABELS = {
  deposit: "Dépôt d'objet trouvé",
  restitution: "Restitution d'objet",
};

export const TYPE_BADGE = {
  deposit: "bg-primary/15 text-primary",
  restitution: "bg-accent/15 text-accent",
};
