// Netlify Function: Webhook receiver for MoneyFusion payin events
// Uses Supabase REST API (PostgREST) instead of PocketBase

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

// GET rows: /rest/v1/table?column=eq.value&select=*
const sbGet = async (table, filter) => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${filter}&select=*`, {
    headers: sbHeaders(),
  });
  return res.json();
};

// PATCH row by id
const sbPatch = async (table, id, body) => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
    method: "PATCH",
    headers: sbHeaders(),
    body: JSON.stringify(body),
  });
  return res.json();
};

// POST row
const sbPost = async (table, body) => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: sbHeaders(),
    body: JSON.stringify(body),
  });
  return res.json();
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
    const { event: eventType, tokenPay, personal_Info, Montant, frais, moyen, numeroTransaction } = payload;

    console.log("[webhook] Event:", eventType, "Token:", tokenPay);

    if (!tokenPay) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "Missing tokenPay" }) };
    }

    // Find the payment by moneyfusion_token
    const payments = await sbGet("payments", `moneyfusion_token=eq.${tokenPay}&limit=1`);

    if (!payments || payments.length === 0) {
      console.log("[webhook] Payment not found for token:", tokenPay);
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, message: "Payment not found, ignoring" }) };
    }

    const payment = payments[0];

    // Deduplicate: if already confirmed, skip
    if (payment.status === "confirmed") {
      console.log("[webhook] Already processed:", tokenPay);
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, message: "Already processed" }) };
    }

    if (eventType === "payin.session.completed") {
      // Update payment to confirmed
      await sbPatch("payments", payment.id, {
        status: "confirmed",
        moneyfusion_moyen: moyen || "",
        moneyfusion_transaction: numeroTransaction || "",
        moneyfusion_frais: frais || 0,
        confirmed_at: new Date().toISOString(),
      });

      // Activate service based on payment type
      await activateService(payment);

      console.log("[webhook] Payment confirmed:", payment.id);
    } else if (eventType === "payin.session.cancelled") {
      await sbPatch("payments", payment.id, {
        status: "failed",
        description: `${payment.description || ""} — Annulé via MoneyFusion`,
      });
      console.log("[webhook] Payment cancelled:", payment.id);
    } else {
      console.log("[webhook] Pending event, no action:", eventType);
    }

    return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    console.error("[webhook] Error:", err.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};

async function activateService(payment) {
  const { type, item_key, user: userId, item_label } = payment;

  try {
    if (type === "subscription") {
      const now = new Date();
      const renewsAt = new Date(now);
      renewsAt.setMonth(renewsAt.getMonth() + 1);

      const existing = await sbGet("subscriptions", `user=eq.${userId}&plan=eq.${item_key}&status=eq.active&limit=1`);

      if (existing && existing.length > 0) {
        await sbPatch("subscriptions", existing[0].id, {
          renews_at: renewsAt.toISOString(),
        });
      } else {
        await sbPost("subscriptions", {
          user: userId,
          plan: item_key,
          status: "active",
          renews_at: renewsAt.toISOString(),
          auto_renew: true,
        });
      }

      await sbPatch("users", userId, { plan: item_key });

    } else if (type === "service") {
      const svc = await sbGet("fcfa_services", `key=eq.${item_key}&limit=1`);
      const duration = svc?.[0]?.duration_days || 30;
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + duration);

      await sbPost("point_purchases", {
        user: userId,
        service: item_key,
        points_cost: 0,
        fcfa_cost: payment.amount_fcfa,
        status: "active",
        expires_at: expiresAt.toISOString(),
      });

    } else if (type === "pro_account") {
      const pros = await sbGet("pro_accounts", `owner=eq.${userId}&limit=1&order=created_at.desc`);
      if (pros && pros.length > 0) {
        await sbPatch("pro_accounts", pros[0].id, { status: "active" });
      }

    } else if (type === "donation") {
      const personalInfo = payment.moneyfusion_personal_info || {};
      await sbPost("donations", {
        user: userId,
        donor_name: personalInfo.nomclient || "Anonyme",
        donor_phone: personalInfo.numeroSend || "",
        amount_fcfa: payment.amount_fcfa,
        payment_method: "moneyfusion",
        message: "",
        status: "completed",
        anonymous: !userId,
      });

      // Update totals
      try {
        const totals = await sbGet("donation_totals", "label=eq.global&limit=1");
        if (totals && totals.length > 0) {
          await sbPatch("donation_totals", totals[0].id, {
            total_fcfa: (totals[0].total_fcfa || 0) + payment.amount_fcfa,
            donors: (totals[0].donors || 0) + 1,
            updated_at: new Date().toISOString(),
          });
        }
      } catch (_) {}

    } else if (type === "priority") {
      const declId = item_key;
      if (declId) {
        await sbPatch("declarations", declId, {
          priority: true,
          priority_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        });
      }
    }
  } catch (err) {
    console.error("[webhook] activateService error:", err.message);
  }
}
