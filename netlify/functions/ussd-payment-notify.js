// netlify/functions/ussd-payment-notify.js
// Après un paiement USSD : envoie la capture du dépôt au mail principal
// (digihouse10@gmail.com) via FormSubmit (gratuit, sans clé), notifie les
// admins (in-app + push OneSignal) et met un lien de validation.

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://uudgiamuqutgljakelkb.supabase.co";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY || "";
const ADMIN_EMAIL = "digihouse10@gmail.com";
const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;
const ONESIGNAL_REST_KEY = process.env.ONESIGNAL_REST_API_KEY;
const SITE_URL = "https://retrouvemoi.netlify.app";

const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
};

const sbHeaders = () => ({
  "Content-Type": "application/json",
  apikey: SUPABASE_SERVICE_KEY,
  Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
  Prefer: "return=representation",
});

const sbGet = async (table, filter) => {
  const hasSelect = /(^|&)select=/.test(filter);
  const url = `${SUPABASE_URL}/rest/v1/${table}?${encodeURI(filter)}${hasSelect ? "" : "&select=*"}`;
  const res = await fetch(url, { headers: sbHeaders() });
  return res.json();
};

const renderType = (type) =>
  ({
    subscription: "Abonnement",
    service: "Service / Récompense",
    pro_account: "Compte Pro",
    priority: "Mise en avant",
    donation: "Don",
  }[type] || type || "Paiement");

const sendEmail = async ({ userName, userEmail, type, itemLabel, amount, proofUrl }) => {
  // FormSubmit.co — envoi d'email gratuit (aucune clé API)
  const subject = `Paiement USSD reçu — ${amount} FCFA (${renderType(type)})`;
  try {
    const res = await fetch(`https://formsubmit.co/ajax/${ADMIN_EMAIL}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        _subject: subject,
        _template: "table",
        _captcha: "false",
        _replyto: userEmail || ADMIN_EMAIL,
        "Plateforme": "RetrouveMoi",
        "Type": renderType(type),
        "Article / service": itemLabel || "—",
        "Montant": `${amount} FCFA`,
        "Utilisateur": userName || "—",
        "Email utilisateur": userEmail || "—",
        "Capture du dépôt (cliquez pour voir)": proofUrl || "non fournie",
        "Valider dans l'admin": `${SITE_URL}/admin?tab=paiements`,
      }),
    });
    const data = await res.json().catch(() => ({}));
    return !!data?.success;
  } catch (err) {
    console.warn("[ussd-payment-notify] FormSubmit error:", err.message);
    return false;
  }
};

const notifyAdmins = async ({ title, body }) => {
  try {
    // Admins = rôle admin + admin principal (par email) même si pas de rôle
    const [roleAdmins, mainAdmin] = await Promise.all([
      sbGet("users", 'role=in.("admin")'),
      sbGet("users", `email=eq.${encodeURIComponent(ADMIN_EMAIL)}`),
    ]);
    const byId = new Map();
    [...(roleAdmins || []), ...(mainAdmin || [])].forEach((u) => {
      if (u?.id) byId.set(u.id, u);
    });
    const admins = [...byId.values()];
    if (admins.length === 0) return { notified: 0 };

    const notifications = admins.map((a) => ({
      user: a.id,
      title,
      body: body.slice(0, 160),
      link: "/admin?tab=paiements",
      read: false,
    }));

    await fetch(`${SUPABASE_URL}/rest/v1/notifications`, {
      method: "POST",
      headers: sbHeaders(),
      body: JSON.stringify(notifications),
    });

    // Push OneSignal
    let push = 0;
    if (ONESIGNAL_APP_ID && ONESIGNAL_REST_KEY) {
      try {
        const pushRes = await fetch("https://onesignal.com/api/v1/notifications", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Basic ${ONESIGNAL_REST_KEY}` },
          body: JSON.stringify({
            app_id: ONESIGNAL_APP_ID,
            include_external_user_ids: admins.map((a) => a.id),
            headings: { fr: title },
            contents: { fr: body.slice(0, 200) },
            url: `${SITE_URL}/admin?tab=paiements`,
          }),
        });
        const d = await pushRes.json();
        push = d.id ? admins.length : 0;
      } catch (_) {}
    }
    return { notified: admins.length, push };
  } catch (err) {
    console.warn("[ussd-payment-notify] notifyAdmins error:", err.message);
    return { notified: 0 };
  }
};

export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    const { paymentId, type, itemLabel, amount, proofUrl } = JSON.parse(event.body || "{}");

    // Récupère l'utilisateur associé au paiement (si possible)
    let userName = "";
    let userEmail = "";
    if (paymentId) {
      const payments = await sbGet("payments", `id=eq.${paymentId}&select=user,item_label`);
      const p = payments?.[0];
      if (p?.user) {
        const users = await sbGet("users", `id=eq.${p.user}&select=name,email`);
        const u = users?.[0];
        userName = u?.name || "";
        userEmail = u?.email || "";
      }
    }

    const typeLabel = renderType(type);
    const title = `🧾 Paiement USSD — ${amount} FCFA`;
    const body = `${typeLabel}${itemLabel ? ` · ${itemLabel}` : ""} · ${amount} FCFA à valider`;

    // 1. Email au mail principal
    const email = await sendEmail({ userName, userEmail, type, itemLabel, amount, proofUrl });

    // 2. Notifications in-app + push admins
    const notify = await notifyAdmins({ title, body });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ statut: true, email, ...notify }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ statut: false, message: err.message }),
    };
  }
};