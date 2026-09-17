import { pb } from "@/lib/pbClient";

// Métadonnées par slug de catégorie : icône, libellé court, groupe
export const CATEGORY_META = {
  "enfant-disparu": { emoji: "👦", label: "Enfant égaré", group: "personnes" },
  "personne-disparue": { emoji: "🧑", label: "Personne disparue", group: "personnes" },
  cni: { emoji: "🆔", label: "CNI", group: "documents" },
  passeport: { emoji: "📕", label: "Passeport", group: "documents" },
  permis: { emoji: "🪪", label: "Permis", group: "documents" },
  "carte-grise": { emoji: "📋", label: "Carte grise", group: "documents" },
  plaque: { emoji: "🔢", label: "Plaque d'immat.", group: "vehicules" },
  moto: { emoji: "🏍️", label: "Moto", group: "vehicules" },
  voiture: { emoji: "🚙", label: "Voiture", group: "vehicules" },
  velo: { emoji: "🚲", label: "Vélo", group: "vehicules" },
  telephone: { emoji: "📱", label: "Téléphone", group: "personnels" },
  portefeuille: { emoji: "👛", label: "Portefeuille", group: "personnels" },
  sac: { emoji: "🎒", label: "Sac", group: "personnels" },
  cles: { emoji: "🔑", label: "Clés", group: "personnels" },
  documents: { emoji: "📄", label: "Documents", group: "autres" },
  autres: { emoji: "📦", label: "Autres", group: "autres" },
};

// Groupes logiques ordonnés
export const CATEGORY_GROUPS = [
  {
    key: "personnes",
    label: "Personnes",
    emoji: "🧑",
    slugs: ["enfant-disparu", "personne-disparue"],
  },
  {
    key: "documents",
    label: "Documents",
    emoji: "📄",
    slugs: ["cni", "passeport", "permis", "carte-grise"],
  },
  {
    key: "vehicules",
    label: "Véhicules",
    emoji: "🚗",
    slugs: ["plaque", "moto", "voiture", "velo"],
  },
  {
    key: "personnels",
    label: "Objets personnels",
    emoji: "🎒",
    slugs: ["telephone", "portefeuille", "sac", "cles"],
  },
  {
    key: "autres",
    label: "Autres",
    emoji: "📦",
    slugs: ["documents", "autres"],
  },
];

// Palette par groupe (classes Tailwind)
export const GROUP_STYLES = {
  personnes: {
    tile: "bg-rose-50 border-rose-200 text-rose-700",
    active: "bg-rose-600 border-rose-600 text-white",
    dot: "bg-rose-500",
    soft: "bg-rose-50 text-rose-700",
    bar: "bg-rose-500",
  },
  documents: {
    tile: "bg-blue-50 border-blue-200 text-blue-700",
    active: "bg-blue-600 border-blue-600 text-white",
    dot: "bg-blue-500",
    soft: "bg-blue-50 text-blue-700",
    bar: "bg-blue-500",
  },
  vehicules: {
    tile: "bg-orange-50 border-orange-200 text-orange-700",
    active: "bg-orange-500 border-orange-500 text-white",
    dot: "bg-orange-500",
    soft: "bg-orange-50 text-orange-700",
    bar: "bg-orange-500",
  },
  personnels: {
    tile: "bg-emerald-50 border-emerald-200 text-emerald-700",
    active: "bg-emerald-600 border-emerald-600 text-white",
    dot: "bg-emerald-500",
    soft: "bg-emerald-50 text-emerald-700",
    bar: "bg-emerald-500",
  },
  autres: {
    tile: "bg-purple-50 border-purple-200 text-purple-700",
    active: "bg-purple-600 border-purple-600 text-white",
    dot: "bg-purple-500",
    soft: "bg-purple-50 text-purple-700",
    bar: "bg-purple-500",
  },
};

export const metaForSlug = (slug) =>
  CATEGORY_META[slug] || { emoji: "📦", label: slug, group: "autres" };
export const groupStyle = (groupKey) =>
  GROUP_STYLES[groupKey] || GROUP_STYLES.autres;

// Renvoie les catégories rangées par groupe (conserve l'ordre des groupes)
export const groupCategories = (categories) => {
  const bySlug = {};
  (categories || []).forEach((c) => {
    bySlug[c.slug] = c;
  });
  return CATEGORY_GROUPS.map((g) => ({
    ...g,
    items: g.slugs.map((s) => bySlug[s]).filter(Boolean),
  })).filter((g) => g.items.length > 0);
};

// Catégories sensibles : détails + photo jointes réservés au déclarant et aux admins.
export const SENSITIVE_SLUGS = new Set([
  "cni",
  "passeport",
  "permis",
  "carte-grise",
  "plaque",
  "documents",
]);

// Une déclaration appartient-elle à une catégorie sensible ?
export const isSensitiveCategory = (item) =>
  SENSITIVE_SLUGS.has(item?.expand?.category?.slug || "");

// L'utilisateur (déclarant ou admin) peut-il voir les détails d'une catégorie sensible ?
export const canViewSensitiveDetails = (item, user, isAdmin) =>
  isAdmin || Boolean(user && item && user.id === item.owner);

// Compte les déclarations par catégorie : { [categoryId]: { lost, found, total } }
export const fetchCategoryCounts = async () => {
  const counts = {};
  try {
    const items = await pb.collection("declarations").getFullList({
      filter: 'status != "blocked"',
      fields: "id,kind,category",
      requestKey: "cat-counts",
    });
    for (const d of items) {
      const c = counts[d.category] || { lost: 0, found: 0, total: 0 };
      if (d.kind === "lost") c.lost += 1;
      else c.found += 1;
      c.total += 1;
      counts[d.category] = c;
    }
  } catch (_) {
    /* best-effort */
  }
  return counts;
};
