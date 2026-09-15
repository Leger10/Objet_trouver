import { NextResponse } from 'next/server';
import { prisma } from '@/lib/server/db';

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

export const dynamic = 'force-dynamic';