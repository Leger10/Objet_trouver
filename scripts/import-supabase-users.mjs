#!/usr/bin/env node
/**
 * Import des anciens utilisateurs Supabase vers le nouveau projet (Better Auth / Prisma MySQL).
 *
 * Prérequis :
 *   - La base cible est joignable (DATABASE_URL dans .env, ou $env:DATABASE_URL pour une base distante).
 *   - Le schéma y existe déjà (prisma db push fait au préalable).
 *   - Un fichier JSON exporté depuis Supabase (voir commande SQL ci-dessous).
 *
 * Export depuis Supabase → SQL Editor :
 *   select au.id::text as id, au.email,
 *     (au.email_confirmed_at is not null) as email_verified, au.created_at,
 *     p.name, p.phone, p.city, p."quarter", p.referred_by, p.referral_code,
 *     p.points, p.points_earned, p.plan, p.role
 *   from auth.users au
 *   left join public."users" p on p.id = au.id
 *   order by au.created_at;
 *   → Résultat → Export → JSON.
 *
 * Utilisation :
 *   node --env-file=.env scripts/import-supabase-users.mjs --file=users-export.json --password="Temp@Abcd1234"
 *   Par défaut : dry-run (ne modifie rien). Ajouter --apply pour importer réellement.
 */
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '@better-auth/utils/password';

const prisma = new PrismaClient();

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const eq = a.indexOf('=');
    if (eq === -1) return [a.replace(/^--/, ''), 'true'];
    return [a.slice(0, eq).replace(/^--/, ''), a.slice(eq + 1)];
  }),
);

const APPLY = args.apply === 'true' || args.apply === '1';
const FILE = args.file;
const TEMP_PASSWORD = args.password || 'RetrouveMoi@2026';

if (!FILE) {
  console.error('Usage: node scripts/import-supabase-users.mjs --file=users-export.json --password="..." [--apply]');
  process.exit(1);
}

function genReferralCode() {
  return `OBJ-${Array.from({ length: 6 }, () => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[Math.floor(Math.random() * 36)]).join('')}`;
}

async function main() {
  const raw = JSON.parse(await import('node:fs/promises').then((fs) => fs.readFile(FILE, 'utf8')));
  const users = Array.isArray(raw) ? raw : raw.data && Array.isArray(raw.data) ? raw.data : [];

  const existing = new Set((await prisma.user.findMany({ select: { email: true } })).map((u) => u.email.toLowerCase()));
  const usedCodes = new Set((await prisma.user.findMany({ select: { referralCode: true } })).map((u) => u.referralCode).filter(Boolean));

  let created = 0, skipped = 0, errors = 0;

  for (const u of users) {
    const email = String(u.email || '').trim().toLowerCase();
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { skipped++; continue; }
    if (existing.has(email)) { skipped++; continue; }

    let referralCode = (u.referral_code || '').trim() || genReferralCode();
    while (usedCodes.has(referralCode)) referralCode = genReferralCode();
    usedCodes.add(referralCode);

    const data = {
      id: u.id ? String(u.id) : undefined,
      email,
      name: u.name || email.split('@')[0],
      emailVerified: Boolean(u.email_verified),
      createdAt: u.created_at ? new Date(u.created_at) : undefined,
      phone: u.phone ?? '',
      city: u.city ?? '',
      quarter: u.quarter ?? '',
      referredBy: u.referred_by ?? '',
      referralCode,
      points: Number(u.points) || 0,
      pointsEarned: Number(u.points_earned) || 0,
      plan: u.plan || 'free',
      role: u.role || 'user',
    };

    try {
      if (!APPLY) {
        console.log(`[dry-run] importerait: ${email} (role=${data.role})`);
        created++;
        continue;
      }
      const passwordHash = await hashPassword(TEMP_PASSWORD);
      await prisma.$transaction(async (tx) => {
        const user = await tx.user.upsert({
          where: { email },
          update: data,
          create: data,
        });
        await tx.account.create({
          data: {
            id: `acc-${user.id}-${Math.random().toString(36).slice(2, 10)}`,
            accountId: user.id,
            providerId: 'credential',
            userId: user.id,
            password: passwordHash,
          },
        });
      });
      console.log(`[import] ${email} -> ${data.id || 'id auto'}`);
      created++;
    } catch (e) {
      errors++;
      console.error(`[erreur] ${email}: ${e.message}`);
    }
  }

  console.log(`\nRésumé: ${created} importé(s), ${skipped} ignoré(s), ${errors} erreur(s). ${APPLY ? '' : '(dry-run — relancez avec --apply pour appliquer)'}`);
}

main()
  .finally(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });