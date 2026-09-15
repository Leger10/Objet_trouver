import { NextResponse } from 'next/server';

const VERIFY_BASE = 'https://pay.moneyfusion.net/paiementNotif';

export async function GET(request) {
  const token = request.nextUrl.searchParams.get('token');
  if (!token) {
    return NextResponse.json({ statut: false, message: "Paramètre 'token' requis." }, { status: 400 });
  }

  try {
    const res = await fetch(`${VERIFY_BASE}/${encodeURIComponent(token)}`);
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ statut: false, message: err?.message || 'Erreur interne' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';