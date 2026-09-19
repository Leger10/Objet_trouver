// Données de démonstration pour montrer le produit à un client.
// Usage :  npm run db:demo       (locale)
//          npm run db:demo prod  (PROD — attention, crée des données visibles publiquement)
//
// Ce script :
//   1. s'assure que les catégories existent (id = slug) et que le branding par défaut est présent
//   2. crée les utilisateurs de démonstration (propriétaire, trouveur, admin de secteur) si absents
//   3. crée des déclarations de test réalistes (perdu/retrouvé)
//   4. crée un SCÉNARIO COMPLET et terminé :
//        - une CNI perdue + une CNI trouvée qui correspondent
//        - un match (correspondance) avec score
//        - une demande de restitution (claim) acceptée
//        - un PV de dépôt et un PV de restitution (tous deux « ok »)
//        - la restitution effective chez l'admin de secteur
//        - la CNI remise à son propriétaire → processus terminé (statut « returned »)
//   5. N'efface JAMAIS de données réelles (uniquement les enregistrements de démo à IDs fixes)
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const isProd = process.argv[2] === 'prod';

function loadEnv() {
  const envPath = join(root, '.env');
  if (!existsSync(envPath)) return {};
  const out = {};
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!m) continue;
    let value = m[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    out[m[1]] = value;
  }
  return out;
}

const url = isProd ? (process.env.DATABASE_URL_PROD || loadEnv().DATABASE_URL_PROD) : (process.env.DATABASE_URL || loadEnv().DATABASE_URL);
if (!url) throw new Error('DATABASE_URL manquante.');

// Passe la base à Prisma au lieu de recharger .env (l'instance prisma n'embarque pas le moteur de .env loading)
process.env.DATABASE_URL = url;

const { PrismaClient } = await import('@prisma/client');
const prisma = new PrismaClient();

const CATEGORIES = [
  ['cni', 'CNI'], ['passeport', 'Passeport'], ['permis', 'Permis'], ['telephone', 'Téléphone'],
  ['portefeuille', 'Portefeuille'], ['cles', 'Clés'], ['sac', 'Sac'], ['velo', 'Vélo'], ['documents', 'Documents'],
];

async function ensureCategories() {
  for (const [id, name] of CATEGORIES) {
    const exists = await prisma.category.findUnique({ where: { id } });
    if (!exists) {
      await prisma.category.create({ data: { id, slug: id, name, position: 0 } });
      console.log(`  + catégorie ${id}`);
    }
  }
}

async function ensureBranding() {
  const exists = await prisma.brandingSetting.findUnique({ where: { id: 'default' } });
  if (!exists) {
    await prisma.brandingSetting.create({
      data: { id: 'default', appName: 'RetrouveMoi', tagline: 'DÉCLAREZ • RECHERCHEZ • RETROUVEZ', logoUrl: '/images/icon-192.png' },
    });
    console.log('  + branding par défaut');
  }
}

// ── Utilisateurs de démonstration ──────────────────────────────────────────

const DEMO_USERS = [
  {
    id: 'demo-owner-cni',
    email: 'demo.perdant@retrouvemoi.app',
    name: 'Awa Ouédraogo',
    phone: '+226 70 12 34 56',
    city: 'Ouagadougou',
    quarter: 'Rood Woko',
    role: 'user',
    referralCode: 'DEM-OWN-001',
  },
  {
    id: 'demo-finder-cni',
    email: 'demo.trouveur@retrouvemoi.app',
    name: 'Issouf Kaboré',
    phone: '+226 76 98 76 54',
    city: 'Ouagadougou',
    quarter: 'Rood Woko',
    role: 'user',
    referralCode: 'DEM-FND-001',
  },
  {
    id: 'demo-admin-ouaga',
    email: 'demo.admin@retrouvemoi.app',
    name: 'Abdoulaye Compaoré',
    phone: '+226 70 00 11 22',
    city: 'Ouagadougou',
    quarter: 'Rood Woko',
    role: 'admin',
    referralCode: 'DEM-ADM-001',
  },
];

async function ensureDemoUsers() {
  for (const u of DEMO_USERS) {
    const exists = await prisma.user.findUnique({ where: { id: u.id } });
    if (exists) continue;
    const byEmail = await prisma.user.findUnique({ where: { email: u.email } });
    if (byEmail) continue;
    await prisma.user.create({
      data: {
        id: u.id,
        email: u.email,
        emailVerified: false,
        name: u.name,
        phone: u.phone,
        city: u.city,
        quarter: u.quarter,
        role: u.role,
        referralCode: u.referralCode,
      },
    });
    console.log(`  + utilisateur démo ${u.email} (${u.role})`);
  }
}

// ── Nettoyage idempotent (uniquement les enregistrements de démo) ──────────

async function cleanupDemo() {
  const demoDeclIds = ['demo-found-cni', 'demo-lost-cni', 'demo-phone-01', 'demo-wallet-01', 'demo-bike-01', 'demo-keys-01'];

  // Toutes les déclarations de démo (IDs fixes + anciennes déclarations [DÉMO] à IDs aléatoires)
  const oldDemoDecls = await prisma.declaration.findMany({
    where: { title: { contains: '[DÉMO]' } },
    select: { id: true },
  });
  const declIds = [...new Set([...demoDeclIds, ...oldDemoDecls.map((d) => d.id)])];

  // PVs de démo (nums fixes + PVs dont le titre est marqué [DÉMO])
  const demoPvRows = await prisma.pv.findMany({
    where: { OR: [{ pvNumber: { in: ['PV-D-DEMO', 'PV-R-DEMO'] } }, { title: { contains: '[DÉMO]' } }] },
    select: { id: true },
  });
  const demoPvIds = demoPvRows.map((p) => p.id);
  if (demoPvIds.length) {
    await prisma.signature.deleteMany({ where: { pvId: { in: demoPvIds } } });
    await prisma.pv.deleteMany({ where: { id: { in: demoPvIds } } });
    console.log(`  - supprimé ${demoPvIds.length} PV de démo`);
  }

  // Matchs de démo liés aux déclarations (id match fixe + matchs des déclarations démo)
  const demoMatches = await prisma.match.findMany({
    where: { OR: [{ lostId: { in: declIds } }, { foundId: { in: declIds } }, { id: 'demo-match-cni' }] },
    select: { id: true },
  });
  const demoMatchIds = demoMatches.map((m) => m.id);
  await prisma.match.deleteMany({ where: { id: { in: demoMatchIds } } });
  if (demoMatchIds.length) console.log(`  - supprimé ${demoMatchIds.length} match(s) de démo`);

  // Claims de démo (liés aux déclarations démo)
  const demoClaims = await prisma.claim.findMany({
    where: { declarationId: { in: declIds } },
    select: { id: true },
  });
  const demoClaimIds = demoClaims.map((c) => c.id);
  await prisma.claim.deleteMany({ where: { id: { in: demoClaimIds } } });
  if (demoClaimIds.length) console.log(`  - supprimé ${demoClaimIds.length} demande(s) de démo`);

  // Déclarations de démo
  const oldCount = await prisma.declaration.deleteMany({ where: { id: { in: declIds } } });
  if (oldCount.count) console.log(`  - supprimé ${oldCount.count} ancienne(s) déclaration(s) de démo`);
}

// ── Déclarations simples (état « ouvert ») ─────────────────────────────────

const DEMO_RECORDS = [
  {
    id: 'demo-phone-01', kind: 'found', category: 'telephone', title: 'Téléphone Samsung trouvé au cinéma',
    description: 'Smartphone Samsung Galaxy trouvé dans la salle de cinéma du Centre, écran bleu.', city: 'Ouagadougou', zone: 'Centre-ville', status: 'open', brand: 'Samsung', color: 'Bleu',
  },
  {
    id: 'demo-wallet-01', kind: 'lost', category: 'portefeuille', title: 'Portefeuille noir perdu à Karpala',
    description: 'Portefeuille en cuir noir contenant de l\'argent et une carte bancaire.', city: 'Ouagadougou', zone: 'Karpala', status: 'open', color: 'Noir',
  },
  {
    id: 'demo-bike-01', kind: 'found', category: 'velo', title: 'Vélo abandonné rue 12.55',
    description: 'Vélo de ville de couleur verte retrouvé stationné depuis plusieurs jours.', city: 'Bobo-Dioulasso', zone: 'Accart-Ville', status: 'open', color: 'Vert',
  },
  {
    id: 'demo-keys-01', kind: 'found', category: 'cles', title: 'Trousseau de clés trouvé au stade',
    description: 'Trousseau avec 4 clés et un porte-clés rouge, déposé au stade municipal.', city: 'Ouagadougou', zone: 'Stade', status: 'open', color: 'Rouge',
  },
];

async function seedDemoDeclarations() {
  let n = 0;
  for (const d of DEMO_RECORDS) {
    const cat = await prisma.category.findUnique({ where: { id: d.category } });
    if (!cat) continue;
    await prisma.declaration.create({
      data: {
        id: d.id,
        kind: d.kind,
        category: d.category,
        title: `[DÉMO] ${d.title}`,
        description: d.description,
        city: d.city,
        zone: d.zone || '',
        status: d.status,
        brand: d.brand || '',
        color: d.color || '',
        eventDate: new Date(Date.now() - 3 * 24 * 3600 * 1000),
      },
    });
    n += 1;
  }
  console.log(`  + ${n} déclaration(s) de démo simple(s) créée(s)`);
}

// ── SCÉNARIO COMPLET ET TERMINÉ ────────────────────────────────────────────

// Déroulé raconté par ces données :
//  1. Awa perd sa CNI au marché de Rood Woko (Ouagadougou)
//  2. Issouf trouve une CNI au même endroit et la signale
//  3. Le moteur de correspondance fait un match à ~75 %
//  4. Awa dépose une demande de restitution (claim) — acceptée par l'admin
//  5. L'admin de secteur (Abdoulaye Compaoré) établit le PV de dépôt
//  6. L'admin remet officiellement la CNI à Awa → PV de restitution + signature
//  7. Les 2 PV passent en « restitution_done », les 2 déclarations en « returned »
//     → la CNI est bien remise à son propriétaire, processus terminé.

const DAY = 24 * 3600 * 1000;
const NOW = new Date();

async function seedCompleteScenario() {
  const category = await prisma.category.findUnique({ where: { id: 'cni' } });
  if (!category) {
    console.log('  ! catégorie "cni" absente, scénario ignoré');
    return;
  }

  const owner = await prisma.user.findUnique({ where: { id: 'demo-owner-cni' } });
  const finder = await prisma.user.findUnique({ where: { id: 'demo-finder-cni' } });
  const admin = await prisma.user.findUnique({ where: { id: 'demo-admin-ouaga' } });
  if (!owner || !finder || !admin) {
    console.log('  ! utilisateurs démo absents, scénario ignoré');
    return;
  }

  // ── Déclarations perdue + trouvée (avec eventDate proches pour un bon score) ──
  await prisma.declaration.create({
    data: {
      id: 'demo-lost-cni',
      kind: 'lost',
      category: 'cni',
      title: '[DÉMO] CNI perdue au marché de Rood Woko',
      description: 'Carte nationale d\'identité perdue dans la grande allée du marché de Rood Woko pendant les courses du samedi.',
      personName: 'Awa Ouédraogo',
      docLast4: '4821',
      city: 'Ouagadougou',
      zone: 'Rood Woko',
      eventDate: new Date(NOW.getTime() - 7 * DAY),
      ownerId: owner.id,
      status: 'returned',
    },
  });

  await prisma.declaration.create({
    data: {
      id: 'demo-found-cni',
      kind: 'found',
      category: 'cni',
      title: '[DÉMO] CNI retrouvée au marché de Rood Woko',
      description: 'Carte nationale d\'identité ramassée dans la grande allée du marché de Rood Woko, déposée au stand des surveillants.',
      personName: 'Issouf Kaboré',
      docLast4: '4821',
      city: 'Ouagadougou',
      zone: 'Rood Woko',
      eventDate: new Date(NOW.getTime() - 6 * DAY),
      ownerId: finder.id,
      status: 'returned',
    },
  });

  // ── Match (même catégorie, même ville, même quartier, même n° de doc) ~78 % ──
  const match = await prisma.match.create({
    data: {
      id: 'demo-match-cni',
      lostId: 'demo-lost-cni',
      foundId: 'demo-found-cni',
      score: 78,
      breakdown: { categorie: 20, ville: 15, zone: 15, date: 10, nom: 0, identifiant: 15, description: 3 },
      status: 'confirmed',
    },
  });

  // Relier les déclarations entre elles
  await prisma.declaration.update({
    where: { id: 'demo-lost-cni' },
    data: { matchedDeclarationId: 'demo-found-cni' },
  });
  await prisma.declaration.update({
    where: { id: 'demo-found-cni' },
    data: { matchedDeclarationId: 'demo-lost-cni' },
  });

  // ── Demande de restitution (claim) effectuée et acceptée ──
  await prisma.claim.create({
    data: {
      declarationId: 'demo-found-cni',
      claimantId: owner.id,
      matchId: match.id,
      status: 'returned',
      securityAnswer: '4821 – CNI de Awa Ouédraogo, marché de Rood Woko',
      message: 'Je reconnais cet objet : les 4 derniers chiffres de ma CNI sont 4821.',
    },
  });

  // ── PV de DÉPÔT (établi par l'admin de secteur) ──
  const depositPv = await prisma.pv.create({
    data: {
      pvNumber: 'PV-D-DEMO',
      type: 'deposit',
      userId: finder.id,
      generatedById: admin.id,
      relatedDeclarationId: 'demo-found-cni',
      declarationId: 'demo-found-cni',
      signatoryName: 'Kaboré',
      signatoryPhone: '76 98 76 54',
      signatoryIdType: 'CNI',
      signatoryIdNumber: '********7654',
      objectCategory: 'CNI',
      objectDescription: 'Carte nationale d\'identité ramassée dans la grande allée du marché de Rood Woko.',
      location: `Locaux RetrouveMoi — quartier ${admin.quarter || admin.city || ''}`,
      data: {
        signatoryName: 'Kaboré',
        signatoryFirstName: 'Issouf',
        signatoryPhone: '+226 76 98 76 54',
        signatoryAddress: 'Ouagadougou, quartier Rood Woko',
        signatoryIdType: 'CNI',
        signatoryIdNumber: '********7654',
        objectCategory: 'CNI',
        objectDescription: 'Carte nationale d\'identité ramassée dans la grande allée du marché de Rood Woko.',
        objectFoundLocation: 'Marché de Rood Woko, Ouagadougou',
        objectFoundDate: new Date(NOW.getTime() - 6 * DAY).toISOString().slice(0, 10),
        objectState: 'Bon état',
        objectDistinctive: 'Photocarte avec photo d\'identité',
        location: `Locaux RetrouveMoi — quartier ${admin.quarter || admin.city || ''}`,
        adminName: `Abdoulaye Compaoré (Ouagadougou · Rood Woko)`,
      },
      status: 'restitution_done',
      title: '[DÉMO] PV de dépôt — CNI de Rood Woko',
      city: 'Ouagadougou',
    },
  });

  // ── PV de RESTITUTION (établi à la remise de l'objet au propriétaire) ──
  const restitutionPv = await prisma.pv.create({
    data: {
      pvNumber: 'PV-R-DEMO',
      type: 'restitution',
      userId: owner.id,
      generatedById: admin.id,
      relatedDeclarationId: 'demo-found-cni',
      declarationId: 'demo-found-cni',
      signatoryName: 'Ouédraogo',
      signatoryPhone: '70 12 34 56',
      signatoryIdType: 'CNI',
      signatoryIdNumber: '********3456',
      objectCategory: 'CNI',
      objectDescription: 'Carte nationale d\'identité remise à sa propriétaire.',
      location: `Locaux RetrouveMoi — quartier ${admin.quarter || admin.city || ''}`,
      data: {
        signatoryName: 'Ouédraogo',
        signatoryFirstName: 'Awa',
        signatoryPhone: '+226 70 12 34 56',
        signatoryAddress: 'Ouagadougou, quartier Rood Woko',
        signatoryIdType: 'CNI',
        signatoryIdNumber: '********3456',
        lossNumber: 'DCL-CNI-ROODWOKO',
        lossDate: new Date(NOW.getTime() - 7 * DAY).toISOString().slice(0, 10),
        lossLocation: 'Marché de Rood Woko, Ouagadougou',
        lossDescription: 'Carte nationale d\'identité perdue dans la grande allée du marché de Rood Woko.',
        objectCategory: 'CNI',
        objectDescription: 'Carte nationale d\'identité remise à sa propriétaire après vérification.',
        objectState: 'Bon état',
        objectDistinctive: 'Photocarte avec photo d\'identité',
        conformObject: true,
        conformLossDeclaration: true,
        conformId: true,
        location: `Locaux RetrouveMoi — quartier ${admin.quarter || admin.city || ''}`,
        adminName: `Abdoulaye Compaoré (Ouagadougou · Rood Woko)`,
      },
      status: 'restitution_done',
      title: '[DÉMO] PV de restitution — CNI de Rood Woko',
      city: 'Ouagadougou',
    },
  });

  // ── Lien entre déclarations et PVs (la CNI a bien un PV de dépôt et un PV de restitution) ──
  await prisma.declaration.update({ where: { id: 'demo-found-cni' }, data: { pvId: depositPv.id } });
  await prisma.declaration.update({ where: { id: 'demo-lost-cni' }, data: { pvId: restitutionPv.id } });

  // ── Signature du propriétaire sur le PV de restitution ──
  await prisma.signature.create({
    data: {
      pvId: restitutionPv.id,
      signerName: 'Awa Ouédraogo',
      signatureData: 'DÉMO',
    },
  });

  console.log('  + scénario complet créé : CNI perdue ↔ trouvée, match 78%, demande de restitution acceptée,');
  console.log('    PV de dépôt (PV-D-DEMO) et PV de restitution (PV-R-DEMO) « restitution_done »,');
  console.log('    CNI remise à sa propriétaire → déclarations en « returned » (processus terminé).');
}

// ── Point d'entrée ─────────────────────────────────────────────────────────

console.log(`Seed démo sur la base ${isProd ? 'PROD' : 'locale'} :`);
await ensureCategories();
await ensureBranding();
await ensureDemoUsers();
await cleanupDemo();
await seedDemoDeclarations();
await seedCompleteScenario();

const counts = {
  categories: await prisma.category.count(),
  declarations: await prisma.declaration.count(),
  matches: await prisma.match.count(),
  claims: await prisma.claim.count(),
  pvs: await prisma.pv.count(),
};
console.log(`Terminé. Catégories : ${counts.categories}, déclarations : ${counts.declarations}, matchs : ${counts.matches}, demandes : ${counts.claims}, PVs : ${counts.pvs}.`);
await prisma.$disconnect();