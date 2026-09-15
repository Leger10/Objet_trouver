import { NextResponse } from 'next/server';
import { auth } from '@/lib/server/auth';
import { prisma } from '@/lib/server/db';
import { sendPush, SITE_URL } from '@/lib/server/activation';

export async function POST(request) {
  const session = await auth.api.getSession({ headers: request.headers });
  const caller = session?.user || null;

  if (!caller || caller.role !== 'admin') {
    return NextResponse.json({ statut: false, message: 'Accès réservé aux administrateurs' }, { status: 403 });
  }

  try {
    const { title, body, link } = await request.json().catch(() => ({}));
    if (!title || !body) {
      return NextResponse.json({ statut: false, message: 'title et body requis' }, { status: 400 });
    }

    const users = await prisma.user.findMany({ where: { role: { not: null } }, select: { id: true } });
    const ids = users.map((u) => u.id).filter(Boolean);

    const { sent, total } = await sendPush({
      ids,
      title,
      body,
      url: `${SITE_URL}${String(link || '/').replace(/^\/?\//, '/')}`,
    });

    return NextResponse.json({ statut: true, sent, totalUsers: total });
  } catch (err) {
    return NextResponse.json({ statut: false, message: err?.message || 'Erreur interne' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';