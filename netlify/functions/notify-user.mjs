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

    // Send push via OneSignal REST API
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

    return new Response(
      JSON.stringify({ pushSent }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500 }
    );
  }
};
