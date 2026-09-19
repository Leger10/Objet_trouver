// Données de démonstration pour montrer le produit à un client.
// Usage :  npm run db:demo       (locale)
//          npm run db:demo prod  (PROD — attention, crée des données visibles publiquement)
//
// Ce script :
//   1. s'assure que les catégories existent (id = slug) et que le branding par défaut est présent
//   2. ajoute quelques déclarations de test réalistes (perdu/retrouvé)
//   3. N'efface JAMAIS de données existantes (sauf les déclarations de démo qu'il a marquées "demo")
import { execSync } from 'node:child_process';
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

const DEMO_RECORDS = [
  {
    ref: 'demo-cni-01', kind: 'lost', category: 'cni', title: 'CNI perdue au marché de Rood Woko',
    description: 'Carte nationale d\'identité perdue près du grand marché, quartier Rood Woko.', city: 'Ouagadougou', zone: 'Rood Woko', status: 'open', docLast4: '4821',
  },
  {
    ref: 'demo-phone-01', kind: 'found', category: 'telephone', title: 'Téléphone Samsung trouvé au cinéma',
    description: 'Smartphone Samsung Galaxy trouvé dans la salle de cinéma du Centre, écran bleu.', city: 'Ouagadougou', zone: 'Centre-ville', status: 'open', brand: 'Samsung', color: 'Bleu',
  },
  {
    ref: 'demo-wallet-01', kind: 'lost', category: 'portefeuille', title: 'Portefeuille noir perdu à Karpala',
    description: 'Portefeuille en cuir noir contenant de l\'argent et une carte bancaire.', city: 'Ouagadougou', zone: 'Karpala', status: 'open', color: 'Noir',
  },
  {
    ref: 'demo-bike-01', kind: 'found', category: 'velo', title: 'Vélo abandonné rue 12.55',
    description: 'Vélo de ville de couleur verte retrouvé stationné depuis plusieurs jours.', city: 'Bobo-Dioulasso', zone: 'Accart-Ville', status: 'open', color: 'Vert',
  },
  {
    ref: 'demo-keys-01', kind: 'found', category: 'cles', title: 'Trousseau de clés trouvé au stade',
    description: 'Trousseau avec 4 clés et un porte-clés rouge, déposé au stade municipal.', city: 'Ouagadougou', zone: 'Stade', status: 'open', color: 'Rouge',
  },
];

async function seedDemoDeclarations() {
  const existing = await prisma.declaration.findMany({ where: { title: { contains: '[DÉMO]' } }, select: { id: true } });
  if (existing.length) {
    await prisma.declaration.deleteMany({ where: { id: { in: existing.map((d) => d.id) } } });
    console.log(`  - supprimé ${existing.length} ancienne(s) déclaration(s) de démo`);
  }

  let n = 0;
  for (const d of DEMO_RECORDS) {
    const cat = await prisma.category.findUnique({ where: { id: d.category } });
    if (!cat) continue;
    await prisma.declaration.create({
      data: {
        id: d.ref + '-' + Date.now().toString(36),
        kind: d.kind,
        category: d.category,
        title: `[DÉMO] ${d.title}`,
        description: d.description,
        city: d.city,
        zone: d.zone || '',
        status: d.status,
        brand: d.brand || '',
        color: d.color || '',
        docLast4: d.docLast4 || '',
        eventDate: new Date(Date.now() - 3 * 24 * 3600 * 1000),
      },
    });
    n += 1;
  }
  console.log(`  + ${n} déclaration(s) de démo créée(s)`);
}

console.log(`Seed démo sur la base ${isProd ? 'PROD' : 'locale'} :`);
await ensureCategories();
await ensureBranding();
await seedDemoDeclarations();

const counts = {
  categories: await prisma.category.count(),
  declarations: await prisma.declaration.count(),
};
console.log(`Terminé. Catégories : ${counts.categories}, déclarations : ${counts.declarations}.`);
await prisma.$disconnect();