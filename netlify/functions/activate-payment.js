// Netlify Function: Verify payment status + activate service
// Called by SuccessPage as fallback when webhook is slow
// Reuses same activation logic as webhook.js

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

const sbPost = async (table, body) => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: sbHeaders(),
    body: JSON.stringify(body),
  });
  return res.json();
};

// ── Verify with MoneyFusion ──────────────────────────────────────────────
const VERIFY_URL = "https://pay.moneyfusion.net/paiementNotif";

async function verifyWithMoneyFusion(token) {
  const res = await fetch(`${VERIFY_URL}/${token}`);
  const data = await res.json();
  return data;
}

// ── Activate service (same as webhook) ───────────────────────────────────
async function activateService(payment) {
  const { type, item_key: itemKey, user: userId, item_label: itemLabel } = payment;

  try {
    if (type === "subscription") {
      const now = new Date();
      const renewsAt = new Date(now);
      renewsAt.setMonth(renewsAt.getMonth() + 1);

      const existing = await sbGet("subscriptions", `user=eq.${userId}&plan=eq.${itemKey}&status=eq.active&limit=1`);

      if (existing && existing.length > 0) {
        await sbPatch("subscriptions", existing[0].id, {
          renews_at: renewsAt.toISOString(),
        });
      } else {
        await sbPost("subscriptions", {
          user: userId,
          plan: itemKey,
          status: "active",
          renews_at: renewsAt.toISOString(),
          auto_renew: true,
        });
      }

      await sbPatch("users", userId, { plan: itemKey });
      return { activated: true, type: "subscription", plan: itemKey };

    } else if (type === "service") {
      const svc = await sbGet("fcfa_services", `key=eq.${itemKey}&limit=1`);
      const duration = svc?.[0]?.duration_days || 30;
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + duration);

      await sbPost("point_purchases", {
        user: userId,
        service: itemKey,
        points_cost: 0,
        fcfa_cost: payment.amount_fcfa || payment.amount || 0,
        status: "active",
        expires_at: expiresAt.toISOString(),
      });
      return { activated: true, type: "service" };

    } else if (type === "pro_account") {
      const pros = await sbGet("pro_accounts", `owner=eq.${userId}&limit=1&order=created_at.desc`);
      if (pros && pros.length > 0) {
        await sbPatch("pro_accounts", pros[0].id, { status: "active" });
      }
      return { activated: true, type: "pro_account" };

    } else if (type === "priority") {
      const declId = itemKey;
      if (declId) {
        await sbPatch("declarations", declId, {
          priority: true,
          priority_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        });
      }
      return { activated: true, type: "priority" };

    } else if (type === "donation") {
      await sbPost("donations", {
        user: userId,
        donor_name: payment.description || "Anonyme",
        amount_fcfa: payment.amount_fcfa || payment.amount || 0,
        payment_method: "moneyfusion",
        status: "completed",
      });
      return { activated: true, type: "donation" };
    }
  } catch (err) {
    console.error("[activate-payment] activateService error:", err.message);
    return { activated: false, error: err.message };
  }

  return { activated: false, error: "Unknown payment type" };
}

// ── Handler ──────────────────────────────────────────────────────────────
export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    const { token, type: forcedType, itemKey: forcedItemKey, userId: forcedUserId } = JSON.parse(event.body || "{}");

    if (!token) {
      return { statusCode: 400, headers, body: JSON.stringify({ statut: false, message: "Token requis" }) };
    }

    // 1. Check if payment already confirmed + activated
    const payments = await sbGet("payments", `moneyfusion_token=eq.${token}&limit=1`);
    const payment = payments?.[0];

    if (payment?.status === "confirmed") {
      // Already activated by webhook — just return success
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          statut: true,
          status: "paid",
          alreadyActivated: true,
          type: payment.type,
          itemKey: payment.item_key,
        }),
      };
    }

    // 2. Verify with MoneyFusion
    const mfResult = await verifyWithMoneyFusion(token);
    const mfStatus = mfResult?.data?.statut;

    if (mfStatus !== "paid") {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          statut: true,
          status: mfStatus || "pending",
          message: mfStatus === "failure" ? "Paiement échoué" : "Paiement en cours de traitement",
        }),
      };
    }

    // 3. Payment is paid — confirm + activate
    if (!payment) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          statut: true,
          status: "paid",
          activated: false,
          error: "Paiement payé mais aucun enregistrement trouvé en base",
        }),
      };
    }

    // Confirm payment record
    await sbPatch("payments", payment.id, {
      status: "confirmed",
      moneyfusion_moyen: mfResult?.data?.moyen || "",
      moneyfusion_transaction: mfResult?.data?.numeroTransaction || "",
      moneyfusion_frais: mfResult?.data?.frais || 0,
      confirmed_at: new Date().toISOString(),
    });

    // Activate service
    const activation = await activateService({
      ...payment,
      type: payment.type || forcedType,
      item_key: payment.item_key || forcedItemKey,
      user: payment.user || forcedUserId,
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        statut: true,
        status: "paid",
        activated: activation.activated,
        type: payment.type || forcedType,
        itemKey: payment.item_key || forcedItemKey,
        error: activation.error || null,
      }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ statut: false, message: err.message }),
    };
  }
};
