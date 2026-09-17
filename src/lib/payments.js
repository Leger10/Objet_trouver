import { pb } from "@/lib/pbClient";

// Mobile money accounts (same as donations)
export const ORANGE_NUMBER = "46598281";
export const MOVE_NUMBER = "00226 73 79 09 78";
export const WAVE_NUMBER = "00226 54 32 92 99";

// ── USSD helpers ───────────────────────────────────────────────────────────
// Payer ici Orange Money à composer : *144*10*NUMERO_MARCHAND*MONTANT#
export const ussdCode = (amount) => `*144*10*${ORANGE_NUMBER}*${amount || 0}#`;

// Lien tap-to-dial (mobile) : le '#' de fin reste littéral pour déclencher
// l'USSD sur iOS et Android ; '*' n'a pas besoin d'être encodé dans tel:.
export const ussdTelLink = (amount) => `tel:${ussdCode(amount)}`;

// Instructions pas-à-pas affichées sous le code
export const USSD_STEPS = [
  "Composez le code ci-contre puis appuyez sur Appeler.",
  "Confirmez le montant avec votre code secret Orange Money.",
  "Validez la transaction : vous recevez un SMS de confirmation.",
  "Revenez ici et appuyez sur « J'ai payé » pour finaliser.",
];

export const PAYMENT_METHODS = [
  {
    key: "orange_money",
    label: "Orange Money",
    hint: "Paiement USSD instantané",
    color: "from-[hsl(22_90%_50%)] to-[hsl(14_88%_46%)]",
    ring: "border-[hsl(22_90%_50%)]",
    chip: "bg-[hsl(22_90%_50%)]",
    text: "text-[hsl(22_90%_42%)]",
    soft: "bg-[hsl(22_90%_50%/0.10)]",
    type: "ussd",
  },
  {
    key: "move_money",
    label: "Move Money",
    hint: "Transfert par numéro",
    color: "from-[hsl(262_70%_52%)] to-[hsl(272_66%_46%)]",
    ring: "border-[hsl(262_70%_52%)]",
    chip: "bg-[hsl(262_70%_52%)]",
    text: "text-[hsl(262_70%_44%)]",
    soft: "bg-[hsl(262_70%_52%/0.10)]",
    type: "phone",
  },
  {
    key: "wave",
    label: "Wave",
    hint: "Transfert gratuit par numéro",
    color: "from-[hsl(199_90%_45%)] to-[hsl(205_85%_42%)]",
    ring: "border-[hsl(199_90%_45%)]",
    chip: "bg-[hsl(199_90%_45%)]",
    text: "text-[hsl(199_90%_38%)]",
    soft: "bg-[hsl(199_90%_45%/0.10)]",
    type: "phone",
  },
  {
    key: "card",
    label: "Carte bancaire",
    hint: "Visa / Mastercard (simulation)",
    color: "from-[hsl(160_60%_40%)] to-[hsl(168_64%_34%)]",
    ring: "border-[hsl(160_60%_40%)]",
    chip: "bg-[hsl(160_60%_40%)]",
    text: "text-[hsl(160_60%_32%)]",
    soft: "bg-[hsl(160_60%_40%/0.10)]",
    type: "card",
  },
];

export const methodByKey = (key) => PAYMENT_METHODS.find((m) => m.key === key);

export const transferNumber = (key) =>
  key === "wave" ? WAVE_NUMBER : MOVE_NUMBER;

export const copyToClipboard = async (text, label) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (_) {
    return false;
  }
};

// Create a pending payment record
export const createPayment = async ({
  user,
  type,
  itemKey,
  itemLabel,
  amountFcfa,
  method,
  description = "",
}) => {
  return pb.collection("payments").create({
    user: user || null,
    type,
    item_key: itemKey,
    item_label: itemLabel,
    amount: amountFcfa,
    amount_fcfa: amountFcfa,
    payment_method: method,
    status: "pending",
    description,
  });
};

// ── Subscription plans ──────────────────────────────────────────────────────
export const SUBSCRIPTION_PLANS = [
  {
    key: "free",
    name: "Gratuit",
    price: 0,
    emoji: "🥉",
    accent: "border-border",
    features: [
      "Déclarations et recherche illimitées",
      "Correspondances automatiques",
      "Avec publicités",
      "1 mise en avant par mois (points)",
    ],
    cta: "Plan actuel",
  },
  {
    key: "premium",
    name: "Premium",
    price: 2500,
    emoji: "🥈",
    accent: "border-primary",
    popular: true,
    features: [
      "Sans publicité",
      "Alertes illimitées",
      "Mise en avant gratuite (1x/mois)",
      "Recherche avancée incluse",
      "Support prioritaire",
    ],
    cta: "S'abonner",
  },
  {
    key: "pro",
    name: "Pro",
    price: 5000,
    emoji: "🥇",
    accent: "border-accent",
    features: [
      "Tout le plan Premium",
      "Mise en avant gratuite (5x/mois)",
      "Profil vérifié automatique",
      "Statistiques détaillées",
      "Badge « Pro » sur le profil",
    ],
    cta: "S'abonner",
  },
];

// ── Professional / institutional plans ──────────────────────────────────────
export const PRO_PLANS = [
  {
    key: "starter",
    name: "Starter",
    price: 10000,
    maxUsers: 3,
    emoji: "🏛️",
    features: [
      "Jusqu'à 3 utilisateurs",
      "Déclarations illimitées",
      "Badge « Compte vérifié »",
      "Statistiques de base",
      "Support par email",
    ],
  },
  {
    key: "business",
    name: "Business",
    price: 25000,
    maxUsers: 10,
    emoji: "🏢",
    popular: true,
    features: [
      "Jusqu'à 10 utilisateurs",
      "Tout le plan Starter",
      "Statistiques détaillées",
      "Priorité dans les résultats",
      "Rapports mensuels",
      "Support dédié",
    ],
  },
  {
    key: "enterprise",
    name: "Enterprise",
    price: 50000,
    maxUsers: 9999,
    emoji: "🏫",
    features: [
      "Utilisateurs illimités",
      "Tout le plan Business",
      "Gestion d'équipe avancée",
      "API & intégrations",
      "Account manager dédié",
      "Formation sur site",
    ],
  },
];

export const ORG_TYPES = [
  { key: "mairie", label: "Mairies et administrations", emoji: "🏛️" },
  { key: "entreprise", label: "Entreprises et commerces", emoji: "🏢" },
  { key: "universite", label: "Universités et écoles", emoji: "🏫" },
  { key: "police", label: "Commissariats et police", emoji: "🚔" },
  { key: "hopital", label: "Hôpitaux et cliniques", emoji: "🏥" },
  { key: "transport", label: "Transports et gares", emoji: "🚌" },
];

export const orgTypeLabel = (key) =>
  ORG_TYPES.find((t) => t.key === key)?.label || key;
export const orgTypeEmoji = (key) =>
  ORG_TYPES.find((t) => t.key === key)?.emoji || "🏢";

// ── Services available for FCFA purchase ────────────────────────────────────
export const FCFA_SERVICES = [
  {
    key: "alerts_priority",
    label: "Alertes prioritaires",
    price: 500,
    duration: 30,
    emoji: "🔔",
  },
  {
    key: "listing_boost",
    label: "Mise en avant",
    price: 300,
    duration: 30,
    emoji: "🚀",
  },
  {
    key: "advanced_search",
    label: "Recherche avancée",
    price: 200,
    duration: 30,
    emoji: "🔎",
  },
  {
    key: "verified_profile",
    label: "Profil vérifié",
    price: 1000,
    duration: 365,
    emoji: "⭐",
  },
  {
    key: "priority_post",
    label: "Publication prioritaire",
    price: 250,
    duration: 30,
    emoji: "📢",
  },
];

// Withdrawal commission (5%)
export const COMMISSION_RATE = 0.05;
export const computeCommission = (pts) => Math.round(pts * COMMISSION_RATE);
export const computeNet = (pts) => pts - computeCommission(pts);
