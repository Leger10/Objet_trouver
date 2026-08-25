// Netlify Function: Proxy d'initialisation de paiement MoneyFusion (payin)
// Ã‰vite le blocage CORS : le navigateur appelle /api/create-payment (mÃªme origine),
// la fonction serveur relaie vers MoneyFusion.

const PAYIN_URL =
  "https://pay.moneyfusion.net/retrounvemoi/98df8c5290593912/pay/";

const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
};

export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    const payload = JSON.parse(event.body);

    if (!payload.totalPrice || !payload.article) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          statut: false,
          message: "Champs requis manquants (totalPrice, article).",
        }),
      };
    }

    const res = await fetch(PAYIN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

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
