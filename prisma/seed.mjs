// Script de seed : catégories (id = slug pour matcher category des déclarations)
// Usage : npm run db:seed   (lit DATABASE_URL)
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Slugs ordonnés (mêmes groupes/ordres que src/lib/categories.js)
const CATEGORIES = [
  { id: "enfant-disparu", name: "Enfant égaré", position: 0 },
  { id: "personne-disparue", name: "Personne disparue", position: 1 },
  { id: "cni", name: "CNI", position: 2 },
  { id: "passeport", name: "Passeport", position: 3 },
  { id: "permis", name: "Permis", position: 4 },
  { id: "carte-grise", name: "Carte grise", position: 5 },
  { id: "plaque", name: "Plaque d'immat.", position: 6 },
  { id: "moto", name: "Moto", position: 7 },
  { id: "voiture", name: "Voiture", position: 8 },
  { id: "velo", name: "Vélo", position: 9 },
  { id: "telephone", name: "Téléphone", position: 10 },
  { id: "portefeuille", name: "Portefeuille", position: 11 },
  { id: "sac", name: "Sac", position: 12 },
  { id: "cles", name: "Clés", position: 13 },
  { id: "documents", name: "Documents", position: 14 },
  { id: "autres", name: "Autres", position: 15 },
];

let created = 0;
let updated = 0;

// Nettoyage : supprime les catégories non standard laissées par d'anciennes tentatives
const standardIds = new Set(CATEGORIES.map((c) => c.id));
const legacy = await prisma.category.findMany({ where: { id: { notIn: [...standardIds] } } });
for (const l of legacy) {
  await prisma.category.delete({ where: { id: l.id } });
  console.log(`Supprimée (non standard) : ${l.id} "${l.name}"`);
}

for (const c of CATEGORIES) {
  const existing = await prisma.category.findUnique({ where: { id: c.id } });
  if (existing) {
    await prisma.category.update({
      where: { id: c.id },
      data: { slug: c.id, name: c.name, position: c.position },
    });
    updated += 1;
  } else {
    await prisma.category.create({ data: { id: c.id, slug: c.id, name: c.name, position: c.position } });
    created += 1;
  }
}

const total = await prisma.category.count();
console.log(`Seed terminé : ${created} créées, ${updated} mises à jour, ${total} en base.`);
await prisma.$disconnect();