import { NextResponse } from 'next/server';
import { prisma } from '@/lib/server/db';
import { activatePayment } from '@/lib/server/activation';

const VERIFY_URL = 'https://pay.moneyfusion.net/paiementNotif';

async function verifyWithMoneyFusion(token) {
  const res = await fetch(`${VERIFY_URL}/${encodeURIComponent(token)}`);
  return res.json();
}

export async function POST(request) {
  try {
    const { token, type: forcedType, itemKey: forcedItemKey, userId: forcedUserId } = await request.json().catch(() => ({}));

    if (!token) {
      return NextResponse.json({ statut: false, message: 'Token requis' }, { status: 400 });
    }

    const payment = await prisma.payment.findUnique({
      where: { moneyfusionToken: token },
    });

    if (payment?.status === 'confirmed') {
      return NextResponse.json({
        statut: true,
        status: 'paid',
        alreadyActivated: true,
        type: payment.type,
        itemKey: payment.itemKey,
      });
    }

    const mfResult = await verifyWithMoneyFusion(token);
    const mfStatus = mfResult?.data?.statut;

    if (mfStatus !== 'paid') {
      return NextResponse.json({
        statut: true,
        status: mfStatus || 'pending',
        message: mfStatus === 'failure' ? 'Paiement échoué' : 'Paiement en cours de traitement',
      });
    }

    if (!payment) {
      return NextResponse.json({
        statut: true,
        status: 'paid',
        activated: false,
        error: 'Paiement payé mais aucun enregistrement trouvé en base',
      });
    }

    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'confirmed',
        moneyfusionMoyen: mfResult?.data?.moyen || '',
        moneyfusionTransaction: mfResult?.data?.numeroTransaction || '',
        moneyfusionFrais: mfResult?.data?.frais || 0,
        confirmedAt: new Date(),
      },
    });

    const activation = await activatePayment({
      ...payment,
      type: payment.type || forcedType,
      itemKey: payment.itemKey || forcedItemKey,
      userId: payment.userId || forcedUserId,
    });

    return NextResponse.json({
      statut: true,
      status: 'paid',
      activated: activation.activated,
      type: payment.type || forcedType,
      itemKey: payment.itemKey || forcedItemKey,
      error: activation.error || null,
    });
  } catch (err) {
    return NextResponse.json({ statut: false, message: err?.message || 'Erreur interne' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';