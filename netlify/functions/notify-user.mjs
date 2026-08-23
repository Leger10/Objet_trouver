import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;
const ONESIGNAL_REST_KEY = process.env.ONESIGNAL_REST_API_KEY;

export default async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

  try {
    const { userId, title, body, url } = await req.json();

    if (!userId || !title || !body) {
      return new Response(JSON.stringify({ error: "Missing fields" }), { status: 400 });
    }

    // 1. Send push via OneSignal REST API
    let pushSent = false;
    if (ONESIGNAL_APP_ID && ONESIGNAL_REST_KEY) {
      try {
        const pushRes = await fetch("https://onesignal.com/api/v1/notifications", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Basic ${ONESIGNAL_REST_KEY}`,
          },
          body: JSON.stringify({
            app_id: ONESIGNAL_APP_ID,
            include_external_user_ids: [userId],
            contents: { fr: body },
            headings: { fr: title },
            url: url || "https://retrouvemoi.netlify.app/",
            chrome_web_image: "https://retrouvemoi.netlify.app/images/icon-192.png",
          }),
        });
        pushSent = pushRes.ok;
      } catch (_) {}
    }

    // 2. Send email via Resend (if configured)
    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    let emailSent = false;
    if (RESEND_API_KEY) {
      try {
        const { data: user } = await supabase
          .from("users")
          .select("email, name")
          .eq("id", userId)
          .single();

        if (user?.email) {
          const emailRes = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${RESEND_API_KEY}`,
            },
            body: JSON.stringify({
              from: "RetrouveMoi <noreply@retrouvemoi.netlify.app>",
              to: user.email,
              subject: title,
              html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;">
                <h2 style="color:#059669;">🔔 ${title}</h2>
                <p style="font-size:16px;color:#333;white-space:pre-line;">${body}</p>
                ${url ? `<a href="https://retrouvemoi.netlify.app${url}" style="display:inline-block;margin-top:16px;padding:12px 24px;background:#059669;color:white;text-decoration:none;border-radius:12px;font-weight:bold;">Voir la déclaration</a>` : ""}
                <hr style="margin-top:32px;border:none;border-top:1px solid #eee;" />
                <p style="font-size:12px;color:#999;">RetrouveMoi — Service de retrouvaille d'objets</p>
              </div>`,
            }),
          });
          emailSent = emailRes.ok;
        }
      } catch (_) {}
    }

    return new Response(
      JSON.stringify({ pushSent, emailSent }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500 }
    );
  }
};
