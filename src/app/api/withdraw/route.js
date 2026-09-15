import { NextResponse } from 'next/server';

const PAYOUT_URL = 'https://pay.moneyfusion.net/api/v1/withdraw';
const API_KEY = process.env.VITE_MONEFUSION_API_KEY || '';

export async function POST(request) {
  try {
    const { countryCode, phone, amount, withdraw_mode, webhook_url } = await request.json().catch(() => ({}));

    if (!countryCode || !phone || !amount || !withdraw_mode) {
      return NextResponse.json(
        {
          statut: false,
          message: 'Tous les champs (countryCode, phone, amount, withdraw_mode) sont requis.',
        },
        { status: 400 },
      );
    }

    const origin = new URL(request.url).origin;
    const res = await fetch(PAYOUT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'moneyfusion-private-key': API_KEY,
      },
      body: JSON.stringify({
        countryCode,
        phone,
        amount,
        withdraw_mode,
        webhook_url: webhook_url || `${origin}/api/withdraw-hook`,
      }),
    });

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ statut: false, message: err?.message || 'Erreur interne' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';