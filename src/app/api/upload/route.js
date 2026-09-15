import { NextResponse } from 'next/server';
import { uploadFile, FOLDERS, getPublicUrl } from '@/lib/server/cloudinary';

export async function POST(request) {
  try {
    const form = await request.formData();
    const file = form.get('file');
    const folder = form.get('folder') || FOLDERS.uploads;
    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: 'Fichier requis' }, { status: 400 });
    }
    const result = await uploadFile(file, folder);
    return NextResponse.json({
      ok: true,
      url: getPublicUrl(result),
      publicId: result.public_id,
      width: result.width,
      height: result.height,
    });
  } catch (err) {
    console.error('Upload erreur:', err?.message);
    return NextResponse.json({ ok: false, error: err?.message || 'Erreur upload' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';