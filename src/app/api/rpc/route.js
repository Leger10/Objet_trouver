import { NextResponse } from 'next/server';
import { auth } from '@/lib/server/auth';
import { prisma } from '@/lib/server/db';

const ADMIN_EMAIL = 'digihouse10@gmail.com';

function errorResponse(status, message) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const { name, params } = body || {};

  const session = await auth.api.getSession({ headers: request.headers });
  const caller = session?.user || null;

  if (!caller) return errorResponse(401, 'Non connecté');

  try {
    switch (name) {
      case 'find_nearest_admin': {
        const { p_city, p_quarter } = params || {};
        const city = String(p_city || '').trim().toLowerCase();
        const quarter = String(p_quarter || '').trim().toLowerCase();
        const norm = (s = '') => String(s).trim().toLowerCase();

        const all = await prisma.user.findMany({
          where: { role: 'admin' },
          orderBy: { createdAt: 'asc' },
          select: { id: true, name: true, city: true, quarter: true, email: true, phone: true },
        });

        let row = null;
        let matchLevel = 'any';
        if (city && quarter) {
          row = all.find((u) => norm(u.city) === city && norm(u.quarter) === quarter) || null;
          if (row) matchLevel = 'exact';
        }
        if (!row && city) {
          row = all.find((u) => norm(u.city) === city) || null;
          if (row) matchLevel = 'city';
        }
        if (!row) row = all[0] || null;

        return NextResponse.json({
          ok: true,
          data: row
            ? [{ admin_id: row.id, admin_name: row.name, admin_city: row.city, admin_quarter: row.quarter, admin_email: row.email, admin_phone: row.phone, match_level: matchLevel }]
            : [],
        });
      }

      case 'debit_points_safe': {
        const { p_user, p_amount, p_reason, p_reference } = params || {};
        if (p_user !== caller.id) return errorResponse(403, 'Vous ne pouvez débiter que vos propres points');
        const amount = Number(p_amount) || 0;
        if (amount <= 0) return errorResponse(400, 'Montant invalide');

        const user = await prisma.user.findUnique({ where: { id: p_user } });
        if (!user) throw new Error('Utilisateur introuvable');
        if ((user.points || 0) < amount) {
          throw new Error(`Points insuffisants: ${user.points || 0} disponibles, ${amount} demandés`);
        }

        await prisma.$transaction([
          prisma.user.update({
            where: { id: p_user },
            data: { points: { decrement: amount } },
          }),
          prisma.pointsLedger.create({
            data: {
              userId: p_user,
              amount: -amount,
              reason: p_reason || 'withdrawal',
              referenceId: p_reference || null,
            },
          }),
        ]);

        return NextResponse.json({ ok: true, data: true });
      }

      case 'admin_set_role': {
        if (caller.role !== 'admin') return errorResponse(403, 'Accès réservé aux administrateurs');
        const { target_user_id, new_role } = params || {};
        if (caller.email !== ADMIN_EMAIL) return errorResponse(403, "Seul l'administrateur principal peut modifier les rôles");
        const target = await prisma.user.findUnique({ where: { id: target_user_id } });
        if (!target) return errorResponse(404, 'Utilisateur introuvable');
        if (target.email === ADMIN_EMAIL) return errorResponse(403, "Impossible de modifier l'administrateur principal");
        await auth.api.setRole({
          body: { userId: target_user_id, role: new_role },
          headers: request.headers,
        });
        await prisma.user.update({ where: { id: target_user_id }, data: { role: new_role } });
        return NextResponse.json({ ok: true });
      }

      case 'admin_set_zone': {
        if (caller.role !== 'admin') return errorResponse(403, 'Accès réservé aux administrateurs');
        const { target_id, city, quarter } = params || {};
        if (caller.email !== ADMIN_EMAIL) return errorResponse(403, "Seul l'administrateur principal peut définir la zone d'un admin");
        const target = await prisma.user.findUnique({ where: { id: target_id } });
        if (!target) return errorResponse(404, 'Utilisateur introuvable');
        if (target.email === ADMIN_EMAIL) return errorResponse(403, "Impossible de modifier l'administrateur principal");
        await prisma.user.update({
          where: { id: target_id },
          data: {
            city: String(city || '').trim(),
            quarter: String(quarter || '').trim(),
          },
        });
        return NextResponse.json({ ok: true });
      }

      case 'admin_set_password': {
        if (caller.role !== 'admin') return errorResponse(403, 'Accès réservé aux administrateurs');
        const { target_id, new_password } = params || {};
        if (caller.email !== ADMIN_EMAIL) return errorResponse(403, "Seul l'administrateur principal peut réinitialiser les mots de passe");
        await auth.api.setUserPassword({
          body: { userId: target_id, newPassword: new_password || '00000000' },
          headers: request.headers,
        });
        return NextResponse.json({
          ok: true,
          message: `Mot de passe réinitialisé à ${new_password || '00000000'}`,
        });
      }

      case 'admin_block_user': {
        if (caller.role !== 'admin') return errorResponse(403, 'Accès réservé aux administrateurs');
        const { target_id } = params || {};
        if (caller.email !== ADMIN_EMAIL) return errorResponse(403, "Seul l'administrateur principal peut bloquer un utilisateur");
        const target = await prisma.user.findUnique({ where: { id: target_id } });
        if (!target) return errorResponse(404, 'Utilisateur introuvable');
        if (target.email === ADMIN_EMAIL) return errorResponse(403, "Impossible de bloquer l'administrateur principal");
        await auth.api.banUser({ body: { userId: target_id }, headers: request.headers });
        await prisma.user.update({ where: { id: target_id }, data: { blocked: true } });
        return NextResponse.json({ ok: true });
      }

      case 'admin_unblock_user': {
        if (caller.role !== 'admin') return errorResponse(403, 'Accès réservé aux administrateurs');
        const { target_id } = params || {};
        if (caller.email !== ADMIN_EMAIL) return errorResponse(403, "Seul l'administrateur principal peut débloquer un utilisateur");
        await auth.api.unbanUser({ body: { userId: target_id }, headers: request.headers });
        await prisma.user.update({ where: { id: target_id }, data: { blocked: false } });
        return NextResponse.json({ ok: true });
      }

      case 'admin_update_user_email': {
        if (caller.role !== 'admin') return errorResponse(403, 'Accès réservé aux administrateurs');
        const { target_id, new_email } = params || {};
        if (caller.email !== ADMIN_EMAIL) return errorResponse(403, "Seul l'administrateur principal peut modifier les emails");
        const target = await prisma.user.findUnique({ where: { id: target_id } });
        if (!target) return errorResponse(404, 'Utilisateur introuvable');
        if (target.email === ADMIN_EMAIL) return errorResponse(403, "Impossible de modifier l'administrateur principal");
        await prisma.user.update({ where: { id: target_id }, data: { email: new_email } });
        return NextResponse.json({ ok: true });
      }

      case 'admin_delete_user': {
        if (caller.role !== 'admin') return errorResponse(403, 'Accès réservé aux administrateurs');
        const { target_id } = params || {};
        if (caller.email !== ADMIN_EMAIL) return errorResponse(403, "Seul l'administrateur principal peut supprimer un utilisateur");
        const target = await prisma.user.findUnique({ where: { id: target_id } });
        if (!target) return errorResponse(404, 'Utilisateur introuvable');
        if (target.email === ADMIN_EMAIL) return errorResponse(403, "Impossible de supprimer l'administrateur principal");
        await auth.api.removeUser({ body: { userId: target_id }, headers: request.headers });
        return NextResponse.json({ ok: true });
      }

      default:
        return errorResponse(400, `RPC inconnu: ${name}`);
    }
  } catch (err) {
    console.error(`Erreur /api/rpc (${name}):`, err?.message);
    return errorResponse(500, err?.message || 'Erreur interne');
  }
}

export const dynamic = 'force-dynamic';