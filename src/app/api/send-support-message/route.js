import { NextResponse } from 'next/server';
import { prisma } from '@/lib/server/db';
import { ADMIN_EMAIL, SITE_URL, notifyAdmins } from '@/lib/server/activation';

const SUBJECT_LABELS = {
  compte_supprime: 'Compte supprimé',
  compte_bloque: 'Compte bloqué',
  mot_de_passe: 'Mot de passe',
  objet: 'Objet perdu/retrouvé',
  point: 'Points / Récompenses',
  signalement: 'Signalement',
  autre: 'Autre',
};

export async function POST(request) {
  try {
    const { message_id, sender_name, subject, message_preview } = await request.json().catch(() => ({}));
    const subjectLabel = SUBJECT_LABELS[subject] || subject || 'Autre';
    const title = `Message de support — ${sender_name || 'Utilisateur'}`;
    const body = `[${subjectLabel}] ${String(message_preview || '').slice(0, 120)}`;

    const notify = await notifyAdmins({ title, body, link: '/admin' });

    return NextResponse.json({ ok: true, notified: notify.notified, push: notify.push });
  } catch (e) {
    console.error('send-support-message error:', e);
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';