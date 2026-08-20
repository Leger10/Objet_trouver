// Netlify Function: Webhook receiver for MoneyFusion payout events
// Uses Supabase REST API (PostgREST)

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://uudgiamuqutgljakelkb.supabase.co";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

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
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${filter}&select=*`, {
    headers: sbHeaders(),
  });
  return res.json();
};

const sbPatch = async (table, id, body) => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
    method: "PATCH",
    headers: sbHeaders(),
    body: JSON.stringify(body),
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
    const withdrawals = await sbGet("withdrawals", `moneyfusion_token=eq.${tokenPay}&limit=1`);

    if (!withdrawals || withdrawals.length === 0) {
      console.log("[withdraw-hook] Withdrawal not found for token:", tokenPay);
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, message: "Not found" }) };
    }

    const withdrawal = withdrawals[0];

    // Deduplicate
    if (withdrawal.status === "paid" || withdrawal.status === "rejected") {
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, message: "Already processed" }) };
    }

    if (eventType === "payout.session.completed") {
      await sbPatch("withdrawals", withdrawal.id, {
        status: "paid",
        moneyfusion_moyen: moyen || "",
        paid_at: new Date().toISOString(),
      });
      console.log("[withdraw-hook] Withdrawal paid:", withdrawal.id);

    } else if (eventType === "payout.session.cancelled") {
      // Return points to user
      if (withdrawal.user && withdrawal.amount_points) {
        try {
          await sbPatch("users", withdrawal.user, {
            points: withdrawal.amount_points, // will be set to correct value
          });
          // Better: use RPC for atomic increment
          // For now, get current points then set
          const users = await sbGet("users", `id=eq.${withdrawal.user}&limit=1`);
          if (users && users.length > 0 && users[0].points !== undefined) {
            await sbPatch("users", withdrawal.user, {
              points: (users[0].points || 0) + withdrawal.amount_points,
            });
          }
        } catch (e) {
          console.error("[withdraw-hook] Error returning points:", e.message);
        }
      }

      await sbPatch("withdrawals", withdrawal.id, {
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
