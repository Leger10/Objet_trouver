import { Prisma } from '@prisma/client';
import { prisma } from './db';

// ════════════════════════════════════════════════════════════
// REGISTRE MODÈLES → COLONNES
// ════════════════════════════════════════════════════════════

const MODEL_INFO = {};
for (const model of Prisma.dmmf.datamodel.models) {
  const scalars = {};
  for (const f of model.fields) {
    if (f.isRelation) continue;
    scalars[f.name] = { dbName: f.dbName || f.name, type: f.type };
  }
  MODEL_INFO[model.name] = { scalars };
}

export function getModelInfo(modelName) {
  return MODEL_INFO[modelName];
}

export function prismaFieldForDbName(modelName, dbName) {
  const info = MODEL_INFO[modelName];
  if (!info) return null;
  for (const [field, meta] of Object.entries(info.scalars)) {
    if (meta.dbName === dbName) return { field, type: meta.type };
  }
  return null;
}

// Nom de table (collection) → modèle Prisma
const COLLECTION_TO_MODEL = {
  users: 'User',
  categories: 'Category',
  declarations: 'Declaration',
  matches: 'Match',
  claims: 'Claim',
  reports: 'Report',
  notifications: 'Notification',
  points_ledger: 'PointsLedger',
  payments: 'Payment',
  donations: 'Donation',
  donation_totals: 'DonationTotal',
  pro_accounts: 'ProAccount',
  subscriptions: 'Subscription',
  point_purchases: 'PointPurchase',
  gift_orders: 'GiftOrder',
  withdrawals: 'Withdrawal',
  ad_events: 'AdEvent',
  branding_settings: 'BrandingSetting',
  pvs: 'Pv',
  signatures: 'Signature',
  app_installations: 'AppInstallation',
  email_queue: 'EmailQueue',
  hero_images: 'HeroImage',
  sponsor_banners: 'SponsorBanner',
  support_messages: 'SupportMessage',
  fcfa_services: 'FcfaService',
};

export function modelForCollection(collection) {
  return COLLECTION_TO_MODEL[collection] || null;
}

// ════════════════════════════════════════════════════════════
// SÉRIALISATION Prisma (camelCase) → DB (snake_case)
// ════════════════════════════════════════════════════════════

export function dbShape(modelName, row) {
  const info = MODEL_INFO[modelName];
  if (!info || !row) return row;
  const out = {};
  for (const [field, meta] of Object.entries(info.scalars)) {
    if (row[field] !== undefined) out[meta.dbName] = row[field];
  }
  return out;
}

export function dbShapeMany(modelName, rows) {
  if (!rows) return rows;
  return rows.map((r) => dbShape(modelName, r));
}

export function coerceValue(type, value) {
  if (value === undefined || value === null) return value;
  switch (type) {
    case 'Boolean':
      if (typeof value === 'boolean') return value;
      if (value === 'true' || value === '1' || value === 1) return true;
      if (value === 'false' || value === '0' || value === 0) return false;
      return Boolean(value);
    case 'Int':
    case 'BigInt':
      if (typeof value === 'number') return value;
      if (value === '') return null;
      return Number(value);
    case 'Float':
      if (typeof value === 'number') return value;
      if (value === '') return null;
      return Number(value);
    case 'DateTime':
      if (value instanceof Date) return value;
      if (typeof value === 'string' && value) return new Date(value);
      return value;
    case 'Json':
      if (typeof value === 'string' && value) {
        try {
          return JSON.parse(value);
        } catch {
          return value;
        }
      }
      return value;
    default:
      return value;
  }
}

// Convertit un payload orienté colonnes (snake_case) en données Prisma (camelCase)
export function toModelData(modelName, payload) {
  const info = MODEL_INFO[modelName];
  if (!info) return payload;
  const out = {};
  for (const [key, value] of Object.entries(payload)) {
    const match = prismaFieldForDbName(modelName, key);
    if (match) {
      out[match.field] = coerceValue(match.type, value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

// ════════════════════════════════════════════════════════════
// FILTRES POCKETBASE → PRISMA WHERE
// ════════════════════════════════════════════════════════════

const OP_MAP = {
  '=': 'equals',
  '!=': 'not',
  '~': 'contains',
  '>=': 'gte',
  '<=': 'lte',
  '>': 'gt',
  '<': 'lt',
};

function normValue(v) {
  if (v === 'true') return true;
  if (v === 'false') return false;
  return v;
}

export function parsePocketBaseFilter(filter) {
  const conditions = [];
  if (!filter) return conditions;
  const parts = filter.split(/\s*&&\s*/);
  const fieldRe = /^"?([a-zA-Z_][a-zA-Z0-9_.]*)"?\s*(=|!=|~|>=|<=|>|<)\s*['"]?(.+?)['"]?$/;

  for (const part of parts) {
    const trimmed = part.trim();
    const orMatch = trimmed.match(/^\((.+)\)$/);
    if (orMatch && orMatch[1].includes('||')) {
      const orParts = orMatch[1].split(/\s*\|\|\s*/);
      const orConds = [];
      for (const orPart of orParts) {
        const m = orPart.trim().match(fieldRe);
        if (m) orConds.push({ field: m[1], operator: m[2], value: normValue(m[3]) });
      }
      if (orConds.length) conditions.push({ type: 'or', conditions: orConds });
      continue;
    }
    const m = trimmed.match(fieldRe);
    if (m) conditions.push({ field: m[1], operator: m[2], value: normValue(m[3]) });
  }
  return conditions;
}

function fieldToPrisma(modelName, dbField) {
  let name = dbField;
  if (name === 'created') name = 'created_at';
  if (name === 'updated') name = 'updated_at';
  const match = prismaFieldForDbName(modelName, name);
  if (match) return { prismaField: match.field, type: match.type };
  return null;
}

function singleCondition(modelName, cond) {
  const f = fieldToPrisma(modelName, cond.field);
  if (!f) return null;
  const op = OP_MAP[cond.operator] || 'equals';
  const value = coerceValue(f.type, cond.value);
  if (op === 'not') return { [f.prismaField]: { not: value } };
  return { [f.prismaField]: { [op]: value } };
}

export function buildWhere(modelName, conditions) {
  const ands = [];
  for (const cond of conditions) {
    if (cond.type === 'or' && cond.conditions?.length) {
      const ors = cond.conditions
        .map((c) => singleCondition(modelName, c))
        .filter(Boolean);
      if (ors.length) ands.push({ OR: ors });
    } else {
      const single = singleCondition(modelName, cond);
      if (single) ands.push(single);
    }
  }
  return ands.length ? { AND: ands } : {};
}

export function buildOrderBy(modelName, sort) {
  if (!sort) return undefined;
  const fields = sort.split(',').map((s) => s.trim()).filter(Boolean);
  const out = [];
  for (const field of fields) {
    const isDesc = field.startsWith('-');
    let clean = isDesc ? field.slice(1) : field;
    if (clean === 'created') clean = 'created_at';
    if (clean === 'updated') clean = 'updated_at';
    const f = fieldToPrisma(modelName, clean);
    if (f) out.push({ [f.prismaField]: isDesc ? 'desc' : 'asc' });
  }
  return out.length ? out : undefined;
}

// ════════════════════════════════════════════════════════════
// EXPANSION DES RELATIONS (expand)
// ════════════════════════════════════════════════════════════

const EXPAND_RULES = {
  claims: [
    { name: 'declaration', model: 'Declaration', fk: 'declarationId', key: 'id' },
    { name: 'claimant', model: 'User', fk: 'claimantId', key: 'id' },
    { name: 'match', model: 'Match', fk: 'matchId', key: 'id' },
  ],
  matches: [
    { name: 'lost', model: 'Declaration', fk: 'lostId', key: 'id' },
    { name: 'found', model: 'Declaration', fk: 'foundId', key: 'id' },
  ],
  reports: [
    { name: 'declaration', model: 'Declaration', fk: 'declarationId', key: 'id' },
    { name: 'reporter', model: 'User', fk: 'reporterId', key: 'id' },
  ],
  declarations: [
    { name: 'owner', model: 'User', fk: 'ownerId', key: 'id' },
    { name: 'category', model: 'Category', fk: 'category', keyCol: 'slug' },
    { name: 'pv', model: 'Pv', fk: 'pvId', key: 'id' },
  ],
  withdrawals: [{ name: 'user', model: 'User', fk: 'userId', key: 'id' }],
  payments: [{ name: 'user', model: 'User', fk: 'userId', key: 'id' }],
  subscriptions: [{ name: 'user', model: 'User', fk: 'userId', key: 'id' }],
  pro_accounts: [
    { name: 'user', model: 'User', fk: 'userId', key: 'id' },
    { name: 'owner', model: 'User', fk: 'ownerId', key: 'id' },
  ],
  pvs: [
    { name: 'user', model: 'User', fk: 'userId', key: 'id' },
    { name: 'generated_by', model: 'User', fk: 'generatedById', key: 'id' },
    { name: 'related_declaration', model: 'Declaration', fk: 'relatedDeclarationId', key: 'id' },
    { name: 'declaration_id', model: 'Declaration', fk: 'declarationId', key: 'id' },
  ],
  notifications: [{ name: 'user', model: 'User', fk: 'userId', key: 'id' }],
  point_purchases: [{ name: 'user', model: 'User', fk: 'userId', key: 'id' }],
  gift_orders: [{ name: 'user', model: 'User', fk: 'userId', key: 'id' }],
  donations: [{ name: 'user', model: 'User', fk: 'userId', key: 'id' }],
  point_purchases: [{ name: 'user', model: 'User', fk: 'userId', key: 'id' }],
  support_messages: [{ name: 'user', model: 'User', fk: 'userId', key: 'id' }],
  hero_images: [{ name: 'user', model: 'User', fk: 'userId', key: 'id' }],
  sponsor_banners: [{ name: 'user', model: 'User', fk: 'userId', key: 'id' }],
  app_installations: [{ name: 'user', model: 'User', fk: 'userId', key: 'id' }],
};

export async function expandItems(collection, items, expandStr) {
  if (!items?.length || !expandStr) return items;
  const names = expandStr.split(',').map((s) => s.trim()).filter(Boolean);
  const rules = EXPAND_RULES[collection] || [];
  for (const name of names) {
    const rule = rules.find((r) => r.name === name);
    if (!rule) continue;
    const keyCol = rule.keyCol || rule.key;
    const values = [...new Set(items.map((i) => i[rule.fk]).filter(Boolean))];
    if (values.length === 0) {
      items.forEach((i) => {
        i.expand = i.expand || {};
        i.expand[name] = null;
      });
      continue;
    }
    const queryKey = rule.key || rule.keyCol;
    const related = await prisma[rule.model].findMany({
      where: { [queryKey]: { in: values } },
    });
    const map = new Map(dbShapeMany(rule.model, related).map((r) => [r[keyCol], r]));
    items.forEach((i) => {
      i.expand = i.expand || {};
      i.expand[name] = map.get(i[rule.fk]) || null;
    });
  }
  return items;
}

export default {
  modelForCollection,
  parsePocketBaseFilter,
  buildWhere,
  buildOrderBy,
  dbShape,
  dbShapeMany,
  toModelData,
  expandItems,
};