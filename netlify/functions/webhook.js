// Netlify Function: Webhook receiver for MoneyFusion payin events
// Handles: payin.session.completed, payin.session.pending, payin.session.cancelled

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
    const { event: eventType, tokenPay, personal_Info, Montant, frais, moyen, numeroTransaction } = payload;

    console.log("[webhook] Event:", eventType, "Token:", tokenPay);

    if (!tokenPay) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "Missing tokenPay" }) };
    }

    // Find the payment by moneyfusion_token
    const payments = await pbRequest("GET", `/api/collections/payments/records?filter=moneyfusion_token='${tokenPay}'&limit=1`);

    if (!payments.items || payments.items.length === 0) {
      console.log("[webhook] Payment not found for token:", tokenPay);
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, message: "Payment not found, ignoring" }) };
    }

    const payment = payments.items[0];

    // Deduplicate: if already confirmed/completed, skip
    if (payment.status === "confirmed" || payment.status === "completed") {
      console.log("[webhook] Already processed:", tokenPay);
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, message: "Already processed" }) };
    }

    if (eventType === "payin.session.completed") {
      // Update payment to confirmed
      await pbRequest("PATCH", `/api/collections/payments/records/${payment.id}`, {
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
      await pbRequest("PATCH", `/api/collections/payments/records/${payment.id}`, {
        status: "failed",
        description: `${payment.description || ""} — Annulé via MoneyFusion`,
      });
      console.log("[webhook] Payment cancelled:", payment.id);
    }
    // payin.session.pending — ignore, just log
    else {
      console.log("[webhook] Pending event, no action:", eventType);
    }

    return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    console.error("[webhook] Error:", err.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};

// Activate the corresponding service after successful payment
async function activateService(payment) {
  const { type, item_key, user, item_label } = payment;

  try {
    if (type === "subscription") {
      // Activate subscription
      const now = new Date();
      const renewsAt = new Date(now);
      renewsAt.setMonth(renewsAt.getMonth() + 1);

      // Check for existing active subscription
      const existing = await pbRequest(
        "GET",
        `/api/collections/subscriptions/records?filter=user='${user}' && plan='${item_key}' && status='active'&limit=1`
      );

      if (existing.items && existing.items.length > 0) {
        // Extend
        await pbRequest("PATCH", `/api/collections/subscriptions/records/${existing.items[0].id}`, {
          renews_at: renewsAt.toISOString(),
        });
      } else {
        // Create new
        await pbRequest("POST", "/api/collections/subscriptions/records", {
          user,
          plan: item_key,
          status: "active",
          renews_at: renewsAt.toISOString(),
          auto_renew: true,
        });
      }

      // Update user plan
      await pbRequest("PATCH", `/api/collections/users/records/${user}`, {
        plan: item_key,
      });

    } else if (type === "service") {
      // Activate point purchase
      const svc = await pbRequest(
        "GET",
        `/api/collections/fcfa_services/records?filter=key='${item_key}'&limit=1`
      );
      const duration = svc.items?.[0]?.duration || 30;
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + duration);

      await pbRequest("POST", "/api/collections/point_purchases/records", {
        user,
        service: item_key,
        points_cost: 0,
        fcfa_cost: payment.amount_fcfa,
        status: "active",
        expires_at: expiresAt.toISOString(),
      });

    } else if (type === "pro_account") {
      // Activate pro account
      const pros = await pbRequest(
        "GET",
        `/api/collections/pro_accounts/records?filter=owner='${user}'&limit=1&sort=-created`
      );
      if (pros.items && pros.items.length > 0) {
        await pbRequest("PATCH", `/api/collections/pro_accounts/records/${pros.items[0].id}`, {
          status: "active",
        });
      }

    } else if (type === "donation") {
      // Record donation
      const personalInfo = payment.moneyfusion_personal_info || {};
      await pbRequest("POST", "/api/collections/donations/records", {
        user,
        donor_name: personalInfo.nomclient || "Anonyme",
        donor_phone: personalInfo.numeroSend || "",
        amount_fcfa: payment.amount_fcfa,
        payment_method: "moneyfusion",
        message: "",
        status: "completed",
      });

      // Update totals
      try {
        const totals = await pbRequest("GET", "/api/collections/donation_totals/records?filter=label='global'&limit=1");
        if (totals.items && totals.items.length > 0) {
          await pbRequest("PATCH", `/api/collections/donation_totals/records/${totals.items[0].id}`, {
            total_fcfa: (totals.items[0].total_fcfa || 0) + payment.amount_fcfa,
            donors: (totals.items[0].donors || 0) + 1,
          });
        }
      } catch (_) {}

    } else if (type === "priority") {
      // Activate priority on declaration
      const declId = item_key;
      if (declId) {
        await pbRequest("PATCH", `/api/collections/declarations/records/${declId}`, {
          priority: true,
          priority_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        });
      }
    }
  } catch (err) {
    console.error("[webhook] activateService error:", err.message);
  }
}
