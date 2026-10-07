import { NextResponse } from 'next/server';
import { auth } from '@/lib/server/auth';
import { prisma } from '@/lib/server/db';
import {
  modelForCollection,
  parsePocketBaseFilter,
  buildWhere,
  buildOrderBy,
  dbShape,
  dbShapeMany,
  toModelData,
  expandItems,
} from '@/lib/server/pb-helpers';
import { uploadFile, FOLDERS } from '@/lib/server/cloudinary';

const ADMIN_EMAIL = 'digihouse10@gmail.com';

function errorResponse(status, message, extra = {}) {
  return NextResponse.json({ ok: false, error: message, ...extra }, { status });
}

function parseFormData(form) {
  const data = {};
  const files = [];
  for (const [key, value] of form.entries()) {
    if (key === 'action' || key === 'collection' || key === 'id') continue;
    if (value instanceof File && value.size > 0) {
      files.push({ field: key, file: value });
    } else if (value !== undefined && value !== null) {
      data[key] = typeof value === 'string' ? value : String(value);
    }
  }
  return { data, files };
}

export async function POST(request) {
  const contentType = request.headers.get('content-type') || '';
  const isMultipart = contentType.includes('multipart/form-data');

  let body = {};
  let form = null;
  if (isMultipart) {
    form = await request.formData();
    body = {};
  } else {
    body = await request.json().catch(() => ({}));
  }

  const action = isMultipart ? form.get('action') : body.action;
  const collection = isMultipart ? form.get('collection') : body.collection;

  if (!collection || !action) {
    return errorResponse(400, 'action et collection requis');
  }
  const model = modelForCollection(collection);
  if (!model) {
    return errorResponse(404, `Collection inconnue: ${collection}`);
  }

  const args = isMultipart
    ? Object.fromEntries([...form.entries()].filter(([k]) => k !== 'action' && k !== 'collection'))
    : body;

  const session = await auth.api.getSession({ headers: request.headers });
  const caller = session?.user || null;

  // Sécurité : toute écriture sur users doit être authentifiée,
  // et seule digihouse10@gmail.com peut modifier le rôle de quelqu'un.
  if (collection === 'users' && (action === 'create' || action === 'update' || action === 'delete')) {
    if (!caller) return errorResponse(401, 'Non connecté');
    const changesRole = isMultipart
      ? form.get('role') !== null
      : (args.data && 'role' in args.data);
    if (changesRole) {
      if (caller.email !== ADMIN_EMAIL) {
        return errorResponse(403, "Seul l'administrateur principal peut gérer les rôles");
      }
      if (action === 'update' && args.id) {
        const targetUser = await prisma.user.findUnique({ where: { id: args.id } });
        if (targetUser?.email === ADMIN_EMAIL) {
          return errorResponse(403, "Impossible de modifier l'administrateur principal");
        }
      }
    }
  }

  try {
    if (action === 'getList') {
      const page = Math.max(1, Number(args.page) || 1);
      const perPage = Math.max(1, Number(args.perPage) || 50);
      const where = buildWhere(model, parsePocketBaseFilter(args.filter || ''));
      const orderBy = buildOrderBy(model, args.sort);
      const [rows, total] = await Promise.all([
        prisma[model].findMany({
          where,
          orderBy,
          skip: (page - 1) * perPage,
          take: perPage,
        }),
        prisma[model].count({ where }),
      ]);
      const items = dbShapeMany(model, rows);
      await expandItems(collection, items, args.expand);
      return NextResponse.json({ ok: true, items, totalItems: total, page, perPage });
    }

    if (action === 'getFullList') {
      const where = buildWhere(model, parsePocketBaseFilter(args.filter || ''));
      const orderBy = buildOrderBy(model, args.sort);
      const rows = await prisma[model].findMany({ where, orderBy });
      const items = dbShapeMany(model, rows);
      await expandItems(collection, items, args.expand);
      return NextResponse.json({ ok: true, items });
    }

    if (action === 'getOne') {
      const row = await prisma[model].findUnique({ where: { id: args.id } });
      if (!row) return errorResponse(404, 'Enregistrement introuvable');
      let item = dbShape(model, row);
      if (args.expand) {
        const arr = await expandItems(collection, [item], args.expand);
        item = arr[0];
      }
      return NextResponse.json({ ok: true, item });
    }

    if (action === 'getFirstListItem') {
      const where = buildWhere(model, parsePocketBaseFilter(args.filter || ''));
      const orderBy = buildOrderBy(model, args.sort);
      const row = await prisma[model].findFirst({ where, orderBy });
      if (!row) {
        // PocketBase renvoie 404 dans ce cas, pas 500.
        return errorResponse(404, 'Aucun enregistrement trouvé');
      }
      let item = dbShape(model, row);
      if (args.expand) {
        const arr = await expandItems(collection, [item], args.expand);
        item = arr[0];
      }
      return NextResponse.json({ ok: true, item });
    }

    if (action === 'count') {
      const where = buildWhere(model, parsePocketBaseFilter(args.filter || ''));
      const total = await prisma[model].count({ where });
      return NextResponse.json({ ok: true, count: total });
    }

    if (action === 'create' || action === 'update') {
      let data = {};
      let files = [];
      if (isMultipart) {
        ({ data, files } = parseFormData(form));
      } else {
        data = args.data || {};
      }

      const bucket = collection === 'branding_settings' ? FOLDERS.branding : FOLDERS.uploads;

      for (const { field, file } of files) {
        try {
          const result = await uploadFile(file, bucket);
          data[field] = result.secure_url;
          if (field === 'photo') data.photo_url = result.secure_url;
          if (field === 'signature_data') data.signature_url = result.secure_url;
        } catch (err) {
          console.warn(`Upload ${field} échoué:`, err?.message);
        }
      }

      const payload = toModelData(model, data);

      // ── CREATE ──
      if (action === 'create') {
        // Cas spécial : si un id est fourni et existe déjà → upsert silencieux.
        // Utile pour les créations idempotentes (auth, migrations, retry client).
        if (payload.id) {
          const existing = await prisma[model]
            .findUnique({ where: { id: payload.id } })
            .catch(() => null);
          if (existing) {
            // On met à jour les champs fournis, on ne touche pas au reste.
            const updated = await prisma[model].update({
              where: { id: payload.id },
              data: payload,
            });
            return NextResponse.json({ ok: true, item: dbShape(model, updated) });
          }
        }

        try {
          const row = await prisma[model].create({ data: payload });
          return NextResponse.json({ ok: true, item: dbShape(model, row) });
        } catch (err) {
          if (err?.code === 'P2002') {
            // Contrainte unique (PRIMARY, email, etc.)
            const target = Array.isArray(err?.meta?.target)
              ? err.meta.target.join(', ')
              : err?.meta?.target || 'champ unique';
            return errorResponse(409, `Enregistrement déjà existant (${target})`, {
              code: 'P2002',
              target,
            });
          }
          throw err;
        }
      }

      // ── UPDATE ──
      if (!args.id) return errorResponse(400, 'id requis pour update');
      try {
        const row = await prisma[model].update({ where: { id: args.id }, data: payload });
        return NextResponse.json({ ok: true, item: dbShape(model, row) });
      } catch (err) {
        if (err?.code === 'P2025') {
          return errorResponse(404, 'Enregistrement introuvable');
        }
        throw err;
      }
    }

    if (action === 'delete') {
      if (!args.id) return errorResponse(400, 'id requis pour delete');
      try {
        await prisma[model].delete({ where: { id: args.id } });
        return NextResponse.json({ ok: true, deleted: true });
      } catch (err) {
        if (err?.code === 'P2025') {
          return errorResponse(404, 'Enregistrement introuvable');
        }
        throw err;
      }
    }

    return errorResponse(400, `Action inconnue: ${action}`);
  } catch (err) {
    console.error(`Erreur /api/pb (${action} ${collection}):`, err);
    return errorResponse(500, err?.message || 'Erreur interne');
  }
}

export const dynamic = 'force-dynamic';