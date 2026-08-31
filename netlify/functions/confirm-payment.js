// Netlify Function: Confirmation manuelle d'un paiement + activation du service
// Utilisée par l'admin pour les paiements USSD / manuels (pas de webhook MoneyFusion).

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

// ── Activation du service (identique à webhook.js / activate-payment.js) ──
async function activateService(payment) {
  const { type, item_key: itemKey, user: userId } = payment;

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
      return { activated: true, type: "subscription" };

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
        payment_method: payment.payment_method || "manual",
        status: "completed",
        anonymous: !userId,
      });

      // Met à jour le compteur public (chiffre d'affaires / dons)
      try {
        const totals = await sbGet("donation_totals", "label=eq.global&limit=1");
        if (totals && totals.length > 0) {
          await sbPatch("donation_totals", totals[0].id, {
            total_fcfa: (totals[0].total_fcfa || 0) + (payment.amount_fcfa || 0),
            donors: (totals[0].donors || 0) + 1,
            updated_at: new Date().toISOString(),
          });
        }
      } catch (err) {
        console.error("[confirm-payment] donation_totals update:", err.message);
      }
      return { activated: true, type: "donation" };
    }
  } catch (err) {
    console.error("[confirm-payment] activateService error:", err.message);
    return { activated: false, error: err.message };
  }

  return { activated: false, error: "Unknown payment type" };
}

// ── Notification de rejet : invite l'utilisateur à terminer son dépôt ──────
const RETRY_LINKS = {
  subscription: "/abonnement",
  service: "/recompenses",
  pro_account: "/comptes-pro",
  donation: "/don",
  priority: "/recherche",
};

async function notifyRejected(payment) {
  const userId = payment.user;
  if (!userId) return { notified: false, push: 0 };

  const amount = payment.amount_fcfa || payment.amount || 0;
  const title = "Dépôt non reçu";
  const body = `Votre paiement de ${amount} FCFA n'a pas été confirmé : nous n'avons pas reçu votre dépôt. Merci de terminer votre dépôt pour activer votre service.`;
  const link = RETRY_LINKS[payment.type] || "/";

  // Notification in-app
  try {
    await sbPost("notifications", {
      user: userId,
      title,
      body: body.slice(0, 160),
      link,
      read: false,
    });
  } catch (err) {
    console.error("[confirm-payment] notification in-app:", err.message);
  }

  // Push sur l'appareil
  let push = 0;
  if (ONESIGNAL_APP_ID && ONESIGNAL_REST_KEY) {
    try {
      const pushRes = await fetch("https://onesignal.com/api/v1/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Basic ${ONESIGNAL_REST_KEY}` },
        body: JSON.stringify({
          app_id: ONESIGNAL_APP_ID,
          include_external_user_ids: [userId],
          headings: { fr: title },
          contents: { fr: body.slice(0, 200) },
          url: `${SITE_URL}${link}`,
        }),
      });
      const d = await pushRes.json();
      push = d.id ? 1 : 0;
    } catch (_) {}
  }

  return { notified: true, push };
}

export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    const { paymentId, status } = JSON.parse(event.body || "{}");

    if (!paymentId || !status) {
      return { statusCode: 400, headers, body: JSON.stringify({ statut: false, message: "paymentId et status requis" }) };
    }

    // Read payment
    const payments = await sbGet("payments", `id=eq.${paymentId}&limit=1`);
    const payment = payments?.[0];
    if (!payment) {
      return { statusCode: 404, headers, body: JSON.stringify({ statut: false, message: "Paiement introuvable" }) };
    }

    // Update status
    await sbPatch("payments", paymentId, { status });

    // Activate service if confirmed
    let activation = { activated: false };
    if (status === "confirmed") {
      activation = await activateService(payment);
    }

    // If rejected, notify user on their device to finish the deposit
    let rejection = null;
    if (status === "failed") {
      rejection = await notifyRejected(payment);
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        statut: true,
        status,
        activated: activation.activated,
        error: activation.error || null,
        rejection,
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