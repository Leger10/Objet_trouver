import { NextResponse } from 'next/server';
import { deleteFile } from '@/lib/server/cloudinary';

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { publicId } = body;
    if (!publicId) {
      return NextResponse.json({ ok: false, error: 'publicId requis' }, { status: 400 });
    }
    const result = await deleteFile(publicId);
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    console.error('Suppression fichier erreur:', err?.message);
    return NextResponse.json({ ok: false, error: err?.message || 'Erreur suppression' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';