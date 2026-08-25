// Netlify Function: Proxy de vérification de paiement MoneyFusion
// GET /api/verify-payment?token=xxx  →  MoneyFusion /paiementNotif/{token}

const VERIFY_BASE = "https://pay.moneyfusion.net/paiementNotif";

const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
};

export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  if (event.httpMethod !== "GET") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  const token = event.queryStringParameters?.token;
  if (!token) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ statut: false, message: "Paramètre 'token' requis." }),
    };
  }

  try {
    const res = await fetch(`${VERIFY_BASE}/${encodeURIComponent(token)}`);
    const data = await res.json();
    return { statusCode: 200, headers, body: JSON.stringify(data) };
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ statut: false, message: err.message }),
    };
  }
};
