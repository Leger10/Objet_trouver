import { NextResponse } from 'next/server';
import { prisma } from '@/lib/server/db';
import { activatePayment, notifyPaymentRejected } from '@/lib/server/activation';

export async function POST(request) {
  try {
    const { paymentId, status } = await request.json().catch(() => ({}));

    if (!paymentId || !status) {
      return NextResponse.json(
        { statut: false, message: 'paymentId et status requis' },
        { status: 400 },
      );
    }

    const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) {
      return NextResponse.json({ statut: false, message: 'Paiement introuvable' }, { status: 404 });
    }

    await prisma.payment.update({ where: { id: paymentId }, data: { status } });

    let activation = { activated: false };
    if (status === 'confirmed') {
      activation = await activatePayment(payment);
    }

    let rejection = null;
    if (status === 'failed') {
      rejection = await notifyPaymentRejected(payment);
    }

    return NextResponse.json({
      statut: true,
      status,
      activated: activation.activated,
      error: activation.error || null,
      rejection,
    });
  } catch (err) {
    return NextResponse.json({ statut: false, message: err?.message || 'Erreur interne' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';