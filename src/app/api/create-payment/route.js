import { NextResponse } from 'next/server';

const PAYIN_URL = 'https://pay.moneyfusion.net/retrounvemoi/98df8c5290593912/pay/';

export async function POST(request) {
  try {
    const payload = await request.json().catch(() => ({}));

    if (!payload.totalPrice || !payload.article) {
      return NextResponse.json(
        { statut: false, message: 'Champs requis manquants (totalPrice, article).' },
        { status: 400 },
      );
    }

    const res = await fetch(PAYIN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    let data;
    try {
      data = await res.json();
    } catch {
      data = { statut: false, message: `Réponse invalide de la passerelle (${res.status})` };
    }
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ statut: false, message: err?.message || 'Erreur interne' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';