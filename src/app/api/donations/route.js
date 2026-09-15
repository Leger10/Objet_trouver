import { NextResponse } from 'next/server';
import { prisma } from '@/lib/server/db';
import { updateDonationTotals } from '@/lib/server/activation';

export async function GET() {
  try {
    const row = await prisma.donationTotal.findUnique({ where: { id: 'global' } });
    const data = row
      ? { id: row.id, label: row.label, total_fcfa: row.totalFcfa || 0, donors: row.donors || 0 }
      : { total_fcfa: 0, donors: 0 };
    return NextResponse.json({ success: true, data });
  } catch (err) {
    return NextResponse.json({ success: false, error: err?.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { donor_name, donor_phone, amount_fcfa, payment_method, message, usr_id } = await request.json().catch(() => ({}));

    if (!donor_name || !amount_fcfa || amount_fcfa < 100) {
      return NextResponse.json(
        { success: false, error: 'Données invalides. Montant minimum 100 FCFA.' },
        { status: 400 },
      );
    }

    const donation = await prisma.donation.create({
      data: {
        usr: usr_id || null,
        userId: usr_id || null,
        donorName: String(donor_name).trim(),
        donorPhone: donor_phone || '',
        amountFcfa: amount_fcfa,
        amount: amount_fcfa,
        paymentMethod: payment_method || 'other',
        message: message || '',
        status: 'completed',
        anonymous: !usr_id,
      },
    });

    await updateDonationTotals(amount_fcfa);

    const totals = await prisma.donationTotal.findUnique({ where: { id: 'global' } });

    return NextResponse.json({
      success: true,
      data: donation,
      totals: { total_fcfa: totals?.totalFcfa || 0, donors: totals?.donors || 0 },
      message: 'Don enregistré avec succès',
    });
  } catch (err) {
    console.error('[donations] Error:', err?.message);
    return NextResponse.json({ success: false, error: err?.message || 'Erreur interne' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';