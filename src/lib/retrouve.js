import { pb } from "@/lib/supabaseClient";
import { onMatchFound } from "@/lib/notificationService";

export const maskId = (last4) => (last4 ? `********${last4}` : "Non renseigné");

export const maskPhone = (phone) => {
  if (!phone) return "Masqué";
  const clean = String(phone).replace(/\s+/g, "");

  return `${clean.slice(0, 3)}****${clean.slice(-2)}`;
};

const norm = (v) =>
  (v || "")
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const nameOverlap = (a, b) => {
  const A = norm(a)
    .split(/[\s-]+/)
    .filter(Boolean);
  const B = norm(b)
    .split(/[\s-]+/)
    .filter(Boolean);
  if (!A.length || !B.length) return 0;
  const hits = A.filter((w) => w.length > 2 && B.includes(w)).length;

  return hits / Math.max(A.length, B.length);
};

const wordOverlap = (a, b) => {
  const A = new Set(
    norm(a)
      .split(/[^a-z0-9àâçéèêëîïôûùüÿñ]+/)
      .filter((w) => w.length > 3),
  );
  const B = new Set(
    norm(b)
      .split(/[^a-z0-9àâçéèêëîïôûùüÿñ]+/)
      .filter((w) => w.length > 3),
  );
  if (!A.size || !B.size) return 0;
  let hits = 0;
  A.forEach((w) => {
    if (B.has(w)) hits += 1;
  });

  return hits / Math.max(A.size, B.size);
};

// Score de correspondance 0-100
export const scoreMatch = (lost, found) => {
  const b = {};

  // Category must match for a valid score
  if (!lost.category || lost.category !== found.category) {
    return { total: 0, breakdown: { categorie: 0 } };
  }
  b.categorie = 20;

  b.ville = norm(lost.city) && norm(lost.city) === norm(found.city) ? 15 : 0;
  b.zone = norm(lost.zone) && norm(lost.zone) === norm(found.zone) ? 15 : 0;

  let dateScore = 0;
  if (lost.event_date && found.event_date) {
    const days =
      Math.abs(new Date(lost.event_date) - new Date(found.event_date)) /
      86400000;
    if (days <= 2) dateScore = 10;
    else if (days <= 7) dateScore = 7;
    else if (days <= 30) dateScore = 4;
  }
  b.date = dateScore;

  b.nom = Math.round(nameOverlap(lost.person_name, found.person_name) * 20);
  b.identifiant = lost.doc_last4 && lost.doc_last4 === found.doc_last4 ? 15 : 0;
  b.description = Math.round(
    wordOverlap(
      `${lost.title} ${lost.description} ${lost.brand} ${lost.color}`,
      `${found.title} ${found.description} ${found.brand} ${found.color}`,
    ) * 5,
  );

  const total = Math.min(
    100,
    Object.values(b).reduce((s, n) => s + n, 0),
  );

  return { total, breakdown: b };
};

export const notify = async (
  userId,
  title,
  body,
  link = "/tableau-de-bord",
) => {
  try {
    await pb
      .collection("notifications")
      .create({ user: userId, title, body, link, read: false });
  } catch (_) {
    /* notification best-effort */
  }
};

// Cherche les correspondances pour une nouvelle déclaration et les enregistre
export const runMatching = async (declaration) => {
  const opposite = declaration.kind === "lost" ? "found" : "lost";
  let candidates;
  try {
    candidates = await pb.collection("declarations").getList(1, 200, {
      filter: `kind = '${opposite}' && status != 'returned' && status != 'blocked'`,
      sort: "-created",
    });
  } catch (err) {
    console.error("❌ runMatching candidates fetch failed:", err);
    return [];
  }

  const created = [];
  for (const cand of candidates.items) {
    const lost = declaration.kind === "lost" ? declaration : cand;
    const found = declaration.kind === "lost" ? cand : declaration;
    const { total, breakdown } = scoreMatch(lost, found);
    if (total < 25) continue;
    try {
      const rec = await pb.collection("matches").create(
        {
          lost: lost.id,
          found: found.id,
          score: total,
          breakdown,
          status: "suggested",
        },
      );
      created.push({ ...rec, other: cand });
      // Notification push + email au propriétaire de la déclaration perdue
      onMatchFound({ ...rec, score: total }, lost, found).catch(() => {});
    } catch (err) {
      console.error("❌ runMatching match create failed:", err);
    }
  }

  if (created.length) {
    try {
      await pb
        .collection("declarations")
        .update(declaration.id, { status: "matched" });
    } catch (_) {
      /* ignore */
    }
  }

  return created.sort((a, b) => b.score - a.score);
};

// Ré-exécute le matching sur TOUTES les déclarations existantes
export const bulkRematch = async (onProgress) => {
  let allDecls = [];
  let page = 1;
  const perPage = 200;

  while (true) {
    const { items } = await pb.collection("declarations").getList(page, perPage, {
      sort: "-created",
    });
    allDecls = [...allDecls, ...items];
    if (items.length < perPage) break;
    page++;
  }

  const losts = allDecls.filter((d) => d.kind === "lost");
  const founds = allDecls.filter((d) => d.kind === "found");

  let totalCreated = 0;
  const totalPairs = losts.length * founds.length;

  for (let i = 0; i < losts.length; i++) {
    for (let j = 0; j < founds.length; j++) {
      const lost = losts[i];
      const found = founds[j];
      const { total, breakdown } = scoreMatch(lost, found);
      if (total < 25) continue;

      try {
        const existing = await pb.collection("matches").getFullList({
          filter: `lost = '${lost.id}' && found = '${found.id}'`,
        });
        if (existing.length > 0) continue;

        await pb.collection("matches").create({
          lost: lost.id,
          found: found.id,
          score: total,
          breakdown,
          status: "suggested",
        });
        totalCreated++;

        // Update statuses
        await pb.collection("declarations").update(lost.id, { status: "matched" });
        await pb.collection("declarations").update(found.id, { status: "matched" });

        // Notifications in-app
        await onMatchFound(
          { id: crypto.randomUUID(), score: total, lost: lost.id, found: found.id },
          lost,
          found
        ).catch(() => {});
      } catch (_) {}
    }
    if (onProgress) onProgress(i + 1, losts.length, totalCreated);
  }

  return { total: totalCreated, scanned: allDecls.length };
};

export const REWARDS = [
  { label: "Correspondance confirmée", points: "+50" },
  { label: "Restitution confirmée", points: "+100" },
  { label: "Parrainage validé", points: "+20" },
];

export const BADGES = [
  { key: "citizen", emoji: "🥉", label: "Citoyen actif", threshold: 100 },
  { key: "engaged", emoji: "🥈", label: "Citoyen engagé", threshold: 500 },
  {
    key: "exemplary",
    emoji: "🥇",
    label: "Citoyen exemplaire",
    threshold: 1000,
  },
  { key: "ambassador", emoji: "💎", label: "Ambassadeur", threshold: 5000 },
];

export const getBadge = (pointsEarned = 0) => {
  const earned = pointsEarned || 0;
  let badge = null;
  for (const b of BADGES) {
    if (earned >= b.threshold) badge = b;
  }
  return badge;
};

export const SERVICES = [
  {
    key: "alerts_priority",
    label: "Alertes prioritaires",
    desc: "Recevez les correspondances en premier",
    cost: 500,
    emoji: "🔔",
    duration: 30,
  },
  {
    key: "listing_boost",
    label: "Mise en avant",
    desc: "Votre déclaration en tête des résultats",
    cost: 300,
    emoji: "🚀",
    duration: 30,
  },
  {
    key: "advanced_search",
    label: "Recherche avancée",
    desc: "Filtres supplémentaires et export",
    cost: 200,
    emoji: "🔎",
    duration: 30,
  },
  {
    key: "verified_profile",
    label: "Profil vérifié",
    desc: "Badge de confiance sur votre profil",
    cost: 1000,
    emoji: "⭐",
    duration: 365,
  },
  {
    key: "priority_post",
    label: "Publication prioritaire",
    desc: "Déclaration traitée en priorité",
    cost: 250,
    emoji: "📢",
    duration: 30,
  },
  {
    key: "daily_limit_boost",
    label: "Déclarations illimitées",
    desc: "Augmente votre limite de déclarations par jour",
    cost: 150,
    emoji: "♾️",
    duration: 30,
  },
  {
    key: "advanced_filters",
    label: "Filtres avancés",
    desc: "Débloquez les filtres de recherche avancés",
    cost: 200,
    emoji: "🎛️",
    duration: 30,
  },
  {
    key: "detailed_stats",
    label: "Statistiques détaillées",
    desc: "Accédez à des statistiques avancées",
    cost: 350,
    emoji: "📊",
    duration: 30,
  },
  {
    key: "visibility_boost",
    label: "Visibilité accrue",
    desc: "Augmente la visibilité de vos déclarations",
    cost: 400,
    emoji: "👁️",
    duration: 30,
  },
];

export const serviceByKey = (key) => SERVICES.find((s) => s.key === key);

// Check whether a purchase record is still active (not expired)
export const isServiceActive = (purchase) => {
  if (!purchase || purchase.status !== "active") return false;
  if (!purchase.expires_at) return true;
  return new Date(purchase.expires_at) > new Date();
};

export const daysLeft = (expiresAt) => {
  if (!expiresAt) return null;
  const ms = new Date(expiresAt) - new Date();
  return Math.max(0, Math.ceil(ms / 86400000));
};

export const GIFTS = [
  {
    key: "phone_recharge",
    label: "Recharge téléphonique",
    value: "500 FCFA",
    cost: 2000,
    emoji: "🎁",
  },
  {
    key: "internet_pack",
    label: "Forfait Internet",
    value: "1 000 FCFA",
    cost: 5000,
    emoji: "🎁",
  },
  {
    key: "partner_gift",
    label: "Cadeau partenaire",
    value: "2 000 FCFA",
    cost: 10000,
    emoji: "🎁",
  },
  {
    key: "special_reward",
    label: "Récompense spéciale",
    value: "5 000 FCFA",
    cost: 20000,
    emoji: "💎",
  },
];
