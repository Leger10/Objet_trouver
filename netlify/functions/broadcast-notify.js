// netlify/functions/broadcast-notify.js
// Diffusion push administrateur : envoie un message push à tous les
// utilisateurs inscrits, même quand l'app est fermée. Au clic, l'app
// s'ouvre sur le lien choisi.

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://uudgiamuqutgljakelkb.supabase.co";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY || "";
const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;
const ONESIGNAL_REST_KEY = process.env.ONESIGNAL_REST_API_KEY;
const SITE_URL = "https://retrouvemoi.netlify.app";

const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
};

const sbHeaders = () => ({
  apikey: SUPABASE_SERVICE_KEY,
  Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
});

const sendPush = async (ids, title, body, url) => {
  if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_KEY) return { sentChunk: 0, totalUsers: ids.length };
  // OneSignal limite include_external_user_ids à 2000 par requête
  const CHUNK = 1900;
  let sent = 0;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);
    try {
      const res = await fetch("https://onesignal.com/api/v1/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Basic ${ONESIGNAL_REST_KEY}` },
        body: JSON.stringify({
          app_id: ONESIGNAL_APP_ID,
          include_external_user_ids: chunk,
          headings: { fr: title.slice(0, 80) },
          contents: { fr: body.slice(0, 300) },
          url,
        }),
      });
      const data = await res.json();
      if (data.id) sent += chunk.length;
    } catch (_) {}
  }
  return { sentChunk: sent, totalUsers: ids.length };
};

export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ statut: false, message: "Méthode non autorisée" }) };
  }

  try {
    const { title, body, link } = JSON.parse(event.body || "{}");
    if (!title || !body) {
      return { statusCode: 400, headers, body: JSON.stringify({ statut: false, message: "title et body requis" }) };
    }
    if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_KEY) {
      return { statusCode: 500, headers, body: JSON.stringify({ statut: false, message: "Clés OneSignal manquantes" }) };
    }
    if (!SUPABASE_SERVICE_KEY) {
      return { statusCode: 500, headers, body: JSON.stringify({ statut: false, message: "Clé Supabase manquante" }) };
    }

    // Tous les utilisateurs inscrits
    const res = await fetch(`${SUPABASE_URL}/rest/v1/users?select=id`, { headers: sbHeaders() });
    const users = await res.json();
    const ids = (users || []).map((u) => u && u.id).filter(Boolean);

    const { sentChunk, totalUsers } = await sendPush(
      ids,
      title,
      body,
      `${SITE_URL}${(link || "/").replace(/^\/?\//, "/")}`,
    );

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ statut: true, sent: sentChunk, totalUsers }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ statut: false, message: err.message }),
    };
  }
};