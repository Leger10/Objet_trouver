import { NextResponse } from 'next/server';
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

function errorResponse(status, message) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function parseFormData(form) {
  const data = {};
  const files = [];
  for (const [key, value] of form.entries()) {
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
      if (!row) throw new Error('Aucun enregistrement trouvé');
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

      if (action === 'create') {
        const row = await prisma[model].create({ data: payload });
        return NextResponse.json({ ok: true, item: dbShape(model, row) });
      }

      if (!args.id) return errorResponse(400, 'id requis pour update');
      const row = await prisma[model].update({ where: { id: args.id }, data: payload });
      return NextResponse.json({ ok: true, item: dbShape(model, row) });
    }

    if (action === 'delete') {
      if (!args.id) return errorResponse(400, 'id requis pour delete');
      await prisma[model].delete({ where: { id: args.id } });
      return NextResponse.json({ ok: true, deleted: true });
    }

    return errorResponse(400, `Action inconnue: ${action}`);
  } catch (err) {
    console.error(`Erreur /api/pb (${action} ${collection}):`, err);
    return errorResponse(500, err?.message || 'Erreur interne');
  }
}

export const dynamic = 'force-dynamic';