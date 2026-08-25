// Netlify Function: Initiate withdrawal via MoneyFusion Payout API
// API key stays server-side, never exposed to frontend

const MONEYFUSION_API_KEY =
  "moneyfusion_v1_6792ec8b397ffaad8e15485a_592AB0ACB52355F3584500F7801387737F43CF9305D0D00BEAFC6989FFC56C06";
const PAYOUT_URL = "https://pay.moneyfusion.net/api/v1/withdraw";

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
    const { countryCode, phone, amount, withdraw_mode, webhook_url } = JSON.parse(event.body);

    if (!countryCode || !phone || !amount || !withdraw_mode) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          statut: false,
          message: "Tous les champs (countryCode, phone, amount, withdraw_mode) sont requis.",
        }),
      };
    }

    const res = await fetch(PAYOUT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "moneyfusion-private-key": MONEYFUSION_API_KEY,
      },
      body: JSON.stringify({
        countryCode,
        phone,
        amount,
        withdraw_mode,
        webhook_url: webhook_url || "https://retrouvemoi.netlify.app/api/withdraw-hook",
      }),
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
