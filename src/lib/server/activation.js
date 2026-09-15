import { prisma } from '@/lib/server/db';

export const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'digihouse10@gmail.com';
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;
const ONESIGNAL_REST_KEY = process.env.ONESIGNAL_REST_API_KEY;

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function addMonths(date, months) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

export async function sendPush({ ids, title, body, url }) {
  if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_KEY) return { sent: 0, total: ids.length };
  const CHUNK = 1900;
  let sent = 0;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);
    if (chunk.length === 0) continue;
    try {
      const res = await fetch('https://onesignal.com/api/v1/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Basic ${ONESIGNAL_REST_KEY}` },
        body: JSON.stringify({
          app_id: ONESIGNAL_APP_ID,
          include_external_user_ids: chunk,
          headings: { fr: title.slice(0, 80) },
          contents: { fr: body.slice(0, 300) },
          url,
        }),
      });
      const data = await res.json();
      if (data.id) sent += chunk.length;
    } catch (_) {}
  }
  return { sent, total: ids.length };
}

export async function notifyAdmins({ title, body, link = '/admin' }) {
  try {
    const users = await prisma.user.findMany({
      where: { OR: [{ role: 'admin' }, { email: ADMIN_EMAIL }] },
      select: { id: true },
    });
    const byId = new Map();
    users.forEach((u) => byId.set(u.id, u));
    const admins = [...byId.values()];
    if (admins.length === 0) return { notified: 0 };

    await prisma.notification.createMany({
      data: admins.map((a) => ({
        userId: a.id,
        title,
        body: body.slice(0, 160),
        link,
      })),
    });

    const push = await sendPush({
      ids: admins.map((a) => a.id),
      title,
      body,
      url: `${SITE_URL}${link}`,
    });

    return { notified: admins.length, push: push.sent };
  } catch (err) {
    console.warn('[notifyAdmins] error:', err?.message);
    return { notified: 0, push: 0 };
  }
}

export async function updateDonationTotals(amountFcfa) {
  try {
    const row = await prisma.donationTotal.findUnique({ where: { id: 'global' } });
    const data = {
      totalFcfa: (row?.totalFcfa || 0) + (amountFcfa || 0),
      donors: (row?.donors || 0) + 1,
    };
    await prisma.donationTotal.upsert({
      where: { id: 'global' },
      create: { id: 'global', label: 'global', totalFcfa: amountFcfa || 0, donors: 1 },
      update: data,
    });
    return true;
  } catch (err) {
    console.error('[updateDonationTotals]', err?.message);
    return false;
  }
}

// payment: Prisma Payment row (camelCase fields)
export async function activatePayment(payment) {
  const { type, itemKey, userId, amountFcfa, description, moneyfusionPersonalInfo } = payment || {};
  if (!payment || !type) return { activated: false, error: 'Unknown payment type' };

  try {
    if (type === 'subscription') {
      const renewsAt = addMonths(new Date(), 1);

      const existing = await prisma.subscription.findFirst({
        where: { userId, plan: itemKey, status: 'active' },
      });

      if (existing) {
        await prisma.subscription.update({
          where: { id: existing.id },
          data: { renewsAt },
        });
      } else {
        await prisma.subscription.create({
          data: { userId, plan: itemKey || 'free', status: 'active', renewsAt, autoRenew: true },
        });
      }

      if (userId && itemKey) {
        await prisma.user.update({ where: { id: userId }, data: { plan: itemKey } });
      }
      return { activated: true, type: 'subscription', plan: itemKey };
    }

    if (type === 'service') {
      const svc = itemKey
        ? await prisma.fcfaService.findUnique({ where: { key: itemKey } })
        : null;
      const duration = svc?.durationDays || 30;
      const expiresAt = addDays(new Date(), duration);

      await prisma.pointPurchase.create({
        data: {
          userId,
          service: itemKey || '',
          serviceKey: itemKey || '',
          pointsCost: 0,
          fcfaCost: amountFcfa || 0,
          status: 'active',
          expiresAt,
        },
      });
      return { activated: true, type: 'service' };
    }

    if (type === 'pro_account') {
      const pros = await prisma.proAccount.findFirst({
        where: { userId, status: { not: 'active' } },
        orderBy: { createdAt: 'desc' },
      });
      if (pros) {
        await prisma.proAccount.update({ where: { id: pros.id }, data: { status: 'active' } });
      }
      return { activated: true, type: 'pro_account' };
    }

    if (type === 'priority') {
      if (itemKey) {
        await prisma.declaration.update({
          where: { id: itemKey },
          data: {
            priority: true,
            priorityUntil: addDays(new Date(), 30),
          },
        });
      }
      return { activated: true, type: 'priority' };
    }

    if (type === 'donation') {
      const personalInfo = moneyfusionPersonalInfo || {};
      const donorName = personalInfo.nomclient || 'Anonyme';
      await prisma.donation.create({
        data: {
          userId,
          donorName,
          donorPhone: personalInfo.numeroSend || '',
          amountFcfa: amountFcfa || 0,
          amount: amountFcfa || 0,
          message: '',
          paymentMethod: 'moneyfusion',
          status: 'completed',
          anonymous: !userId,
          usr: userId || null,
        },
      });
      await updateDonationTotals(amountFcfa || 0);
      return { activated: true, type: 'donation' };
    }
  } catch (err) {
    console.error('[activatePayment] error:', err?.message);
    return { activated: false, error: err?.message };
  }

  return { activated: false, error: 'Unknown payment type' };
}

const RETRY_LINKS = {
  subscription: '/abonnement',
  service: '/recompenses',
  pro_account: '/comptes-pro',
  donation: '/don',
  priority: '/recherche',
};

export async function notifyPaymentRejected(payment) {
  const userId = payment?.userId;
  if (!userId) return { notified: false, push: 0 };

  const amount = payment.amountFcfa || payment.amount || 0;
  const title = 'Dépôt non reçu';
  const body = `Votre paiement de ${amount} FCFA n'a pas été confirmé : nous n'avons pas reçu votre dépôt. Merci de terminer votre dépôt pour activer votre service.`;
  const link = RETRY_LINKS[payment.type] || '/';

  try {
    await prisma.notification.create({
      data: { userId, title, body: body.slice(0, 160), link },
    });
  } catch (err) {
    console.error('[notifyPaymentRejected] in-app:', err?.message);
  }

  const push = await sendPush({
    ids: [userId],
    title,
    body,
    url: `${SITE_URL}${link}`,
  });

  return { notified: true, push: push.sent };
}

export const renderTypeLabel = (type) =>
  ({
    subscription: 'Abonnement',
    service: 'Service / Récompense',
    pro_account: 'Compte Pro',
    priority: 'Mise en avant',
    donation: 'Don',
  }[type] || type || 'Paiement');