import { NextResponse } from 'next/server';
import { prisma } from '@/lib/server/db';

export async function POST(request) {
  try {
    const payload = await request.json().catch(() => ({}));
    const { event: eventType, tokenPay, moyen } = payload;

    if (!tokenPay) {
      return NextResponse.json({ error: 'Missing tokenPay' }, { status: 400 });
    }

    const withdrawal = await prisma.withdrawal.findFirst({
      where: { moneyfusionToken: tokenPay },
    });

    if (!withdrawal) {
      return NextResponse.json({ ok: true, message: 'Not found' });
    }

    if (withdrawal.status === 'paid' || withdrawal.status === 'rejected') {
      return NextResponse.json({ ok: true, message: 'Already processed' });
    }

    if (eventType === 'payout.session.completed') {
      await prisma.withdrawal.update({
        where: { id: withdrawal.id },
        data: {
          status: 'paid',
          moneyfusionMoyen: moyen || '',
          paidAt: new Date(),
        },
      });
    } else if (eventType === 'payout.session.cancelled') {
      if (withdrawal.userId && withdrawal.amountPoints) {
        try {
          const user = await prisma.user.findUnique({ where: { id: withdrawal.userId } });
          await prisma.user.update({
            where: { id: withdrawal.userId },
            data: { points: (user?.points || 0) + withdrawal.amountPoints },
          });
        } catch (e) {
          console.error('[withdraw-hook] Error returning points:', e?.message);
        }
      }

      await prisma.withdrawal.update({
        where: { id: withdrawal.id },
        data: {
          status: 'rejected',
          rejectionReason: 'Retrait annulé par MoneyFusion',
        },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[withdraw-hook] Error:', err?.message);
    return NextResponse.json({ error: err?.message || 'Erreur interne' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';