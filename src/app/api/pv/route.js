import { NextResponse } from 'next/server';
import { auth } from '@/lib/server/auth';
import { prisma } from '@/lib/server/db';

function generatePVNumber(type) {
  const prefix = type === 'deposit' ? 'PV-DEP' : 'PV-RET';
  const date = new Date();
  const ymd = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
  const rand = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `${prefix}-${ymd}-${rand}`;
}

function maskIdNumber(id) {
  if (!id || id.length < 4) return id || '';
  return '*'.repeat(id.length - 4) + id.slice(-4);
}

export async function POST(request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  try {
    const { type, form, generatedBy } = await request.json().catch(() => ({}));
    if (!type || !form || !generatedBy) {
      return NextResponse.json({ error: 'Données manquantes' }, { status: 400 });
    }

    const pvNumber = generatePVNumber(type);

    const payload = {
      pv_number: pvNumber,
      type: type,
      generated_by: generatedBy,
      signatory_name: form.signatoryName || '',
      signatory_phone: form.signatoryPhone || '',
      signatory_id_type: form.signatoryIdType || '',
      signatory_id_number: maskIdNumber(form.signatoryIdNumber),
      object_category: form.objectCategory || '',
      object_description: form.objectDescription || '',
      location: form.location || 'Locaux RetrouveMoi',
      data: form,
    };

    const pvData = await prisma.pv.create({
      data: {
        pvNumber,
        type,
        generatedById: generatedBy,
        relatedDeclarationId: form.relatedDeclaration || null,
        signatoryName: payload.signatory_name,
        signatoryPhone: payload.signatory_phone,
        signatoryIdType: payload.signatory_id_type,
        signatoryIdNumber: payload.signatory_id_number,
        objectCategory: payload.object_category,
        objectDescription: payload.object_description,
        location: payload.location,
        data: form,
        status: 'active',
      },
    });

    return NextResponse.json({
      success: true,
      data: pvData,
      pvNumber,
      message: 'Procès-verbal généré avec succès',
    });
  } catch (error) {
    console.error('[pv] Error:', error?.message);
    return NextResponse.json({ success: false, error: error?.message || 'Erreur interne' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';