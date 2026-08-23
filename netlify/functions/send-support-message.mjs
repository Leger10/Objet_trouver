// netlify/functions/send-support-message.mjs
// Notifie tous les admins when a support message is submitted

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;
const ONESIGNAL_REST_KEY = process.env.ONESIGNAL_REST_API_KEY;

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  try {
    const body = await req.json();
    const { message_id, sender_name, subject, message_preview } = body;

    // 1. Fetch all admin users
    const { data: admins, error: adminErr } = await supabase
      .from('users')
      .select('id, name, email')
      .in('role', ['admin', 'main_admin']);

    if (adminErr || !admins?.length) {
      console.warn('No admins found or error:', adminErr?.message);
      return new Response(JSON.stringify({ ok: true, notified: 0 }));
    }

    const subjectLabels = {
      compte_supprime: 'Compte supprimé',
      compte_bloque: 'Compte bloqué',
      mot_de_passe: 'Mot de passe',
      objet: 'Objet perdu/retrouvé',
      point: 'Points / Récompenses',
      signalement: 'Signalement',
      autre: 'Autre',
    };
    const subjectLabel = subjectLabels[subject] || subject;

    // 2. Create in-app notifications for each admin
    const notifications = admins.map((admin) => ({
      user: admin.id,
      title: `Message de support — ${sender_name}`,
      body: `[${subjectLabel}] ${message_preview.slice(0, 120)}`,
      link: '/admin',
      read: false,
    }));

    await supabase.from('notifications').insert(notifications);

    // 3. Send push notifications
    let pushCount = 0;
    if (ONESIGNAL_APP_ID && ONESIGNAL_REST_KEY) {
      const adminIds = admins.map((a) => a.id);
      try {
        const pushRes = await fetch(`https://onesignal.com/api/v1/notifications`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Basic ${ONESIGNAL_REST_KEY}`,
          },
          body: JSON.stringify({
            app_id: ONESIGNAL_APP_ID,
            include_external_user_ids: adminIds,
            headings: { fr: `Message de support — ${sender_name}` },
            contents: { fr: `[${subjectLabel}] ${message_preview.slice(0, 200)}` },
            url: '/admin',
          }),
        });
        const pushData = await pushRes.json();
        pushCount = pushData.id ? adminIds.length : 0;
      } catch (e) {
        console.warn('Push notification error:', e.message);
      }
    }

    return new Response(JSON.stringify({
      ok: true,
      notified: admins.length,
      push: pushCount,
    }), { status: 200 });
  } catch (e) {
    console.error('send-support-message error:', e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
