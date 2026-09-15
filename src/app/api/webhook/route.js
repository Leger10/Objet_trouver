import { NextResponse } from 'next/server';
import { prisma } from '@/lib/server/db';
import { activatePayment } from '@/lib/server/activation';

export async function POST(request) {
  try {
    const payload = await request.json().catch(() => ({}));
    const { event: eventType, tokenPay, frais, moyen, numeroTransaction } = payload;

    if (!tokenPay) {
      return NextResponse.json({ error: 'Missing tokenPay' }, { status: 400 });
    }

    const payment = await prisma.payment.findUnique({
      where: { moneyfusionToken: tokenPay },
    });

    if (!payment) {
      return NextResponse.json({ ok: true, message: 'Payment not found, ignoring' });
    }

    if (payment.status === 'confirmed') {
      return NextResponse.json({ ok: true, message: 'Already processed' });
    }

    if (eventType === 'payin.session.completed') {
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'confirmed',
          moneyfusionMoyen: moyen || '',
          moneyfusionTransaction: numeroTransaction || '',
          moneyfusionFrais: frais || 0,
          confirmedAt: new Date(),
        },
      });

      await activatePayment(payment);
    } else if (eventType === 'payin.session.cancelled') {
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'failed',
          description: `${payment.description || ''} — Annulé via MoneyFusion`,
        },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[webhook] Error:', err?.message);
    return NextResponse.json({ error: err?.message || 'Erreur interne' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';