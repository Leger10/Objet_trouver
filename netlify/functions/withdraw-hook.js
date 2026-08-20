// Netlify Function: Webhook receiver for MoneyFusion payout events
// Handles: payout.session.completed, payout.session.cancelled

const POCKETBASE_URL = process.env.POCKETBASE_URL || "https://retrouveobjet.pockethost.io";
const POCKETBASE_ADMIN_TOKEN = process.env.POCKETBASE_ADMIN_TOKEN || "";

const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
};

const pbRequest = async (method, path, body) => {
  const res = await fetch(`${POCKETBASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(POCKETBASE_ADMIN_TOKEN ? { Authorization: `Bearer ${POCKETBASE_ADMIN_TOKEN}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    const payload = JSON.parse(event.body);
    const { event: eventType, tokenPay, montant, numeroRetrait, moyen } = payload;

    console.log("[withdraw-hook] Event:", eventType, "Token:", tokenPay);

    if (!tokenPay) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "Missing tokenPay" }) };
    }

    // Find withdrawal by moneyfusion_token
    const withdrawals = await pbRequest(
      "GET",
      `/api/collections/withdrawals/records?filter=moneyfusion_token='${tokenPay}'&limit=1`
    );

    if (!withdrawals.items || withdrawals.items.length === 0) {
      console.log("[withdraw-hook] Withdrawal not found for token:", tokenPay);
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, message: "Not found" }) };
    }

    const withdrawal = withdrawals.items[0];

    // Deduplicate
    if (withdrawal.status === "paid" || withdrawal.status === "rejected") {
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, message: "Already processed" }) };
    }

    if (eventType === "payout.session.completed") {
      await pbRequest("PATCH", `/api/collections/withdrawals/records/${withdrawal.id}`, {
        status: "paid",
        moneyfusion_moyen: moyen || "",
        paid_at: new Date().toISOString(),
      });
      console.log("[withdraw-hook] Withdrawal paid:", withdrawal.id);

    } else if (eventType === "payout.session.cancelled") {
      // Return points to user
      if (withdrawal.user && withdrawal.amount_points) {
        try {
          const users = await pbRequest("GET", `/api/collections/users/records/${withdrawal.user}`);
          if (users.points !== undefined) {
            await pbRequest("PATCH", `/api/collections/users/records/${withdrawal.user}`, {
              points: (users.points || 0) + withdrawal.amount_points,
            });
          }
        } catch (_) {}
      }

      await pbRequest("PATCH", `/api/collections/withdrawals/records/${withdrawal.id}`, {
        status: "rejected",
        rejection_reason: "Retrait annulé par MoneyFusion",
      });
      console.log("[withdraw-hook] Withdrawal cancelled:", withdrawal.id);
    }

    return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    console.error("[withdraw-hook] Error:", err.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
