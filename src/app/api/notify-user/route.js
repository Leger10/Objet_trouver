import { NextResponse } from 'next/server';
import { sendPush, SITE_URL } from '@/lib/server/activation';

export async function POST(request) {
  try {
    const { userId, title, body, url } = await request.json().catch(() => ({}));

    if (!userId || !title || !body) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    const result = await sendPush({
      ids: [userId],
      title,
      body,
      url: url || `${SITE_URL}/`,
    });

    return NextResponse.json({ pushSent: result.sent > 0 });
  } catch (err) {
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';