import { NextResponse } from 'next/server';
import { auth } from '@/lib/server/auth';
import { prisma } from '@/lib/server/db';

const ADMIN_EMAIL = 'digihouse10@gmail.com';
const TOP_LIMIT = 30;

function errorResponse(status, message) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function normCity(s) {
  return (s || '').trim();
}

function zoneWhere(city, quarter) {
  const w = {};
  if (city) w.city = city;
  if (quarter) w.zone = quarter;
  return w;
}

export async function POST(request) {
  const session = await auth.api.getSession({ headers: request.headers });
  const caller = session?.user || null;
  if (!caller) return errorResponse(401, 'Non connecté');

  const userRow = caller.id
    ? await prisma.user.findUnique({ where: { id: caller.id } })
    : null;
  const isAdmin = userRow?.role === 'admin';
  if (!isAdmin) return errorResponse(403, 'Accès réservé aux administrateurs');

  let body = {};
  try {
    body = await request.json();
  } catch (_) {
    body = {};
  }

  const isMainAdmin = userRow.email === ADMIN_EMAIL && userRow.role === 'admin';

  // ── Périmètre de la zone ─────────────────────────────────────────────
  // Zone admin : ville forcée sur la sienne, quartier libre à l'intérieur.
  // Main admin : choisit n'importe quelle ville/quartier (vide = tout).
  let city = '';
  let quarter = '';
  if (!isMainAdmin) {
    city = normCity(userRow.city);
    quarter = (body.quarter || '').trim();
  } else {
    city = normCity(body.city);
    quarter = (body.quarter || '').trim();
  }

  const scope = { city, quarter, isMainAdmin, adminId: userRow.id, adminName: userRow.name || userRow.email };

  // ── Déclarations de la zone ──────────────────────────────────────────
  const declWhere = zoneWhere(city, quarter);
  const declarations = await prisma.declaration.findMany({
    where: declWhere,
    select: {
      id: true,
      kind: true,
      status: true,
      city: true,
      zone: true,
      ownerId: true,
      category: true,
      createdAt: true,
    },
  });
  const declIds = declarations.map((d) => d.id);

  // ── Correspondances (matchs) liées à la zone ─────────────────────────
  let matches = [];
  if (declIds.length) {
    matches = await prisma.match.findMany({
      where: { OR: [{ lostId: { in: declIds } }, { foundId: { in: declIds } }] },
    });
  }

  // ── PV de la zone (via déclarations liées ou ville) ──────────────────
  const pvOrs = [];
  if (declIds.length) {
    pvOrs.push({ declarationId: { in: declIds } });
    pvOrs.push({ relatedDeclarationId: { in: declIds } });
  }
  if (city) pvOrs.push({ city });
  const pvWhere = pvOrs.length ? { OR: pvOrs } : { city: '' };
  const pvs = await prisma.pv.findMany({ where: pvWhere });

  // ── Demandes de restitution de la zone ───────────────────────────────
  let claims = [];
  if (declIds.length) {
    claims = await prisma.claim.findMany({
      where: { declarationId: { in: declIds } },
    });
  }

  // ── Listes disponibles pour les sélecteurs (toujours globales pour le
//    main admin, limitées à sa ville pour un admin de zone) ──────────
  const availWhere = !isMainAdmin && city ? { city: { equals: city } } : { city: { not: '' } };
  const availCities = await prisma.declaration.groupBy({
    by: ['city'],
    where: availWhere,
    _count: { _all: true },
    orderBy: { _count: { city: 'desc' } },
  });
  const availableCities = availCities
    .map((g) => ({ city: g.city, count: g._count._all }))
    .filter((g) => g.city);

  const availQuarters = await prisma.declaration.groupBy({
    by: ['city', 'zone'],
    where: { ...availWhere, zone: { not: '' } },
    _count: { _all: true },
    orderBy: { _count: { city: 'desc' } },
  });
  const availableQuarters = availQuarters
    .map((g) => ({ city: g.city, quarter: g.zone, count: g._count._all }))
    .filter((g) => g.city && g.quarter);

  // ── Agrégations ──────────────────────────────────────────────────────
  const countBy = (arr, keyFn) => {
    const m = {};
    for (const it of arr) {
      const k = keyFn(it);
      if (!k) continue;
      m[k] = (m[k] || 0) + 1;
    }
    return m;
  };

  // Par ville
  const byCityMap = {};
  for (const d of declarations) {
    const c = normCity(d.city);
    if (!c) continue;
    if (!byCityMap[c]) byCityMap[c] = { city: c, total: 0, lost: 0, found: 0, returned: 0 };
    byCityMap[c].total += 1;
    if (d.kind === 'lost') byCityMap[c].lost += 1;
    if (d.kind === 'found') byCityMap[c].found += 1;
    if (d.status === 'returned') byCityMap[c].returned += 1;
  }
  const byCity = Object.values(byCityMap).sort((a, b) => b.total - a.total);

  // Par quartier
  const byQuarterMap = {};
  for (const d of declarations) {
    const c = normCity(d.city);
    const q = (d.zone || '').trim();
    if (!c || !q) continue;
    const key = `${c} :: ${q}`;
    if (!byQuarterMap[key]) byQuarterMap[key] = { city: c, quarter: q, total: 0, lost: 0, found: 0, returned: 0 };
    byQuarterMap[key].total += 1;
    if (d.kind === 'lost') byQuarterMap[key].lost += 1;
    if (d.kind === 'found') byQuarterMap[key].found += 1;
    if (d.status === 'returned') byQuarterMap[key].returned += 1;
  }
  const byQuarter = Object.values(byQuarterMap).sort((a, b) => b.total - a.total);

  const matchesByStatus = countBy(matches, (m) => m.status || 'suggested');
  const pvsByType = countBy(pvs, (p) => p.type || 'deposit');
  const pvsByStatus = countBy(pvs, (p) => p.status || 'active');
  const claimsByStatus = countBy(claims, (c) => c.status || 'pending');

  const totals = {
    declarations: declarations.length,
    lost: declarations.filter((d) => d.kind === 'lost').length,
    found: declarations.filter((d) => d.kind === 'found').length,
    returned: declarations.filter((d) => d.status === 'returned').length,
    matches: matches.length,
    depositPvs: pvs.filter((p) => (p.type || 'deposit') === 'deposit').length,
    restitutionPvs: pvs.filter((p) => (p.type || 'deposit') === 'restitution').length,
    claims: claims.length,
  };

  // ── Top utilisateurs (cérémonie de remise de cadeaux) ────────────────
  const foundByOwner = {};
  const depositPvsByUser = {};
  for (const d of declarations) {
    if (d.kind !== 'found') continue;
    if (!d.ownerId) continue;
    foundByOwner[d.ownerId] = (foundByOwner[d.ownerId] || 0) + 1;
  }
  for (const p of pvs) {
    if ((p.type || 'deposit') !== 'deposit') continue;
    if (!p.userId) continue;
    depositPvsByUser[p.userId] = (depositPvsByUser[p.userId] || 0) + 1;
  }

  const userIds = new Set([
    ...Object.keys(foundByOwner),
    ...Object.keys(depositPvsByUser),
  ]);
  const usersById = {};
  if (userIds.size) {
    const users = await prisma.user.findMany({
      where: { id: { in: [...userIds] } },
      select: { id: true, name: true, email: true, city: true, quarter: true, points: true, pointsEarned: true },
    });
    for (const u of users) usersById[u.id] = u;
  }

  const returnedByOwner = countBy(
    declarations.filter((d) => d.status === 'returned' && d.ownerId),
    (d) => d.ownerId
  );

  const topUsers = Object.keys(usersById)
    .map((id) => {
      const u = usersById[id];
      const foundCount = foundByOwner[id] || 0;
      const depositCount = depositPvsByUser[id] || 0;
      return {
        userId: id,
        name: u?.name || '',
        email: u?.email || '',
        city: u?.city || '',
        quarter: u?.quarter || '',
        points: u?.points || 0,
        pointsEarned: u?.pointsEarned || 0,
        foundCount,
        depositCount,
        returnedCount: returnedByOwner[id] || 0,
        score: foundCount + depositCount,
      };
    })
    .sort((a, b) => b.score - a.score || b.pointsEarned - a.pointsEarned)
    .slice(0, TOP_LIMIT);

  // ── Vue admin principal : données de chaque autre admin ──────────────
  let admins = [];
  if (isMainAdmin) {
    const adminRows = await prisma.user.findMany({
      where: { role: 'admin' },
      select: { id: true, name: true, email: true, city: true, quarter: true },
    });
    admins = [];
    for (const a of adminRows) {
      const aWhere = zoneWhere(normCity(a.city), (a.quarter || '').trim());
      const [declCount, lostCount, foundCount, pvCount, matchCount] = await Promise.all([
        prisma.declaration.count({ where: aWhere }),
        prisma.declaration.count({ where: { ...aWhere, kind: 'lost' } }),
        prisma.declaration.count({ where: { ...aWhere, kind: 'found' } }),
        prisma.pv.count({ where: a.city ? { city: normCity(a.city) } : {} }),
        (async () => {
          const ids = await prisma.declaration.findMany({ where: aWhere, select: { id: true } });
          if (!ids.length) return 0;
          return prisma.match.count({
            where: { OR: [{ lostId: { in: ids.map((x) => x.id) } }, { foundId: { in: ids.map((x) => x.id) } }] },
          });
        })(),
      ]);
      admins.push({
        adminId: a.id,
        name: a.name || a.email,
        email: a.email,
        city: a.city || '',
        quarter: a.quarter || '',
        declarations: declCount,
        lost: lostCount,
        found: foundCount,
        pvs: pvCount,
        matches: matchCount,
      });
    }
    admins.sort((a, b) => b.declarations - a.declarations);
  }

  return NextResponse.json({
    ok: true,
    scope,
    totals,
    matchesByStatus,
    pvsByType,
    pvsByStatus,
    claimsByStatus,
    byCity,
    byQuarter,
    availableCities,
    availableQuarters,
    topUsers,
    admins: isMainAdmin ? admins : [],
  });
}

export const dynamic = 'force-dynamic';