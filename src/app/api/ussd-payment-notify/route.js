import { NextResponse } from 'next/server';
import { prisma } from '@/lib/server/db';
import {
  ADMIN_EMAIL,
  SITE_URL,
  renderTypeLabel,
  notifyAdmins,
} from '@/lib/server/activation';

async function sendEmail({ userName, userEmail, type, itemLabel, amount, proofUrl }) {
  const subject = `Paiement USSD reçu — ${amount} FCFA (${renderTypeLabel(type)})`;
  try {
    const res = await fetch(`https://formsubmit.co/ajax/${ADMIN_EMAIL}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        _subject: subject,
        _template: 'table',
        _captcha: 'false',
        _replyto: userEmail || ADMIN_EMAIL,
        Plateforme: 'RetrouveMoi',
        Type: renderTypeLabel(type),
        'Article / service': itemLabel || '—',
        Montant: `${amount} FCFA`,
        Utilisateur: userName || '—',
        'Email utilisateur': userEmail || '—',
        'Capture du dépôt (cliquez pour voir)': proofUrl || 'non fournie',
        "Valider dans l'admin": `${SITE_URL}/admin?tab=paiements`,
      }),
    });
    const data = await res.json().catch(() => ({}));
    return !!data?.success;
  } catch (err) {
    console.warn('[ussd-payment-notify] FormSubmit error:', err?.message);
    return false;
  }
}

export async function POST(request) {
  try {
    const { paymentId, type, itemLabel, amount, proofUrl } = await request.json().catch(() => ({}));

    let userName = '';
    let userEmail = '';
    if (paymentId) {
      const p = await prisma.payment.findUnique({ where: { id: paymentId }, select: { userId: true, itemLabel: true } });
      if (p?.userId) {
        const u = await prisma.user.findUnique({ where: { id: p.userId }, select: { name: true, email: true } });
        userName = u?.name || '';
        userEmail = u?.email || '';
      }
    }

    const title = `🔔 Paiement USSD — ${amount} FCFA`;
    const body = `${renderTypeLabel(type)}${itemLabel ? ` — ${itemLabel}` : ''} — ${amount} FCFA à valider`;

    const email = await sendEmail({ userName, userEmail, type, itemLabel, amount, proofUrl });
    const notify = await notifyAdmins({ title, body, link: '/admin?tab=paiements' });

    return NextResponse.json({ statut: true, email, ...notify });
  } catch (err) {
    return NextResponse.json({ statut: false, message: err?.message || 'Erreur interne' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';