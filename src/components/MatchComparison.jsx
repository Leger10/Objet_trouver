import React from "react";
import { motion } from "framer-motion";
import {
  MapPin,
  CalendarDays,
  Tag,
  FileText,
  User,
  Hash,
  AlignLeft,
} from "lucide-react";

const CRITERIA = [
  { key: "categorie", label: "Catégorie", icon: Tag, max: 20, emoji: "📁" },
  { key: "ville", label: "Ville", icon: MapPin, max: 15, emoji: "🏙️" },
  { key: "zone", label: "Quartier", icon: MapPin, max: 15, emoji: "📍" },
  { key: "date", label: "Proximité date", icon: CalendarDays, max: 10, emoji: "📅" },
  { key: "nom", label: "Nom相似", icon: User, max: 20, emoji: "👤" },
  { key: "identifiant", label: "Identifiant", icon: Hash, max: 15, emoji: "🔢" },
  { key: "description", label: "Description", icon: AlignLeft, max: 5, emoji: "📝" },
];

const CRITERIA_FR = [
  { key: "categorie", label: "Catégorie identique", icon: Tag, max: 20, emoji: "📁" },
  { key: "ville", label: "Même ville", icon: MapPin, max: 15, emoji: "🏙️" },
  { key: "zone", label: "Même quartier", icon: MapPin, max: 15, emoji: "📍" },
  { key: "date", label: "Proximité date", icon: CalendarDays, max: 10, emoji: "📅" },
  { key: "nom", label: "Nom sur document", icon: User, max: 20, emoji: "👤" },
  { key: "identifiant", label: "Identifiant ID", icon: Hash, max: 15, emoji: "🔢" },
  { key: "description", label: "Description/Marque", icon: AlignLeft, max: 5, emoji: "📝" },
];

const scoreColor = (pct) => {
  if (pct >= 80) return "text-emerald-500";
  if (pct >= 60) return "text-primary";
  if (pct >= 40) return "text-amber-500";
  return "text-muted-foreground";
};

const barColor = (pct) => {
  if (pct >= 80) return "bg-emerald-500";
  if (pct >= 60) return "bg-primary";
  if (pct >= 40) return "bg-amber-500";
  return "bg-muted-foreground/40";
};

const ringBg = (pct) => {
  if (pct >= 80) return "from-emerald-500 to-emerald-400";
  if (pct >= 60) return "from-primary to-primary/80";
  if (pct >= 40) return "from-amber-500 to-amber-400";
  return "from-muted-foreground/60 to-muted-foreground/40";
};

export const MatchScoreRing = ({ score, size = 64, strokeWidth = 5 }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = scoreColor(score);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted/40"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          className={color}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={`text-sm font-extrabold ${color}`}>{score}%</span>
      </div>
    </div>
  );
};

export const MatchBreakdownBar = ({ criterion, value, max, delay = 0 }) => {
  const pct = max > 0 ? (value / max) * 100 : 0;
  const isMatch = value > 0;

  return (
    <div className="flex items-center gap-3">
      <span className="w-28 shrink-0 text-xs font-bold text-muted-foreground">
        {criterion.emoji} {criterion.label}
      </span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted/60">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, delay, ease: "easeOut" }}
          className={`h-full rounded-full ${barColor(pct)}`}
        />
      </div>
      <span
        className={`w-10 shrink-0 text-right text-xs font-extrabold ${
          isMatch ? scoreColor(pct) : "text-muted-foreground/50"
        }`}
      >
        {value}/{max}
      </span>
    </div>
  );
};

export const MatchComparison = ({ match, lostDecl, foundDecl, maskLost = false, maskFound = false }) => {
  const breakdown = match.breakdown || {};
  const score = match.score || 0;
  const criteria = CRITERIA_FR;

  const lostLabel = maskLost ? "Déclaration protégée" : (lostDecl?.title || "Déclaration perdue");
  const foundLabel = maskFound ? "Déclaration protégée" : (foundDecl?.title || "Déclaration retrouvée");

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm"
    >
      <div className="flex items-start gap-4">
        <MatchScoreRing score={score} size={72} strokeWidth={6} />
        <div className="min-w-0 flex-1">
          <h3 className="font-extrabold">Analyse de correspondance</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Comparaison automatique entre les deux déclarations
          </p>
          <div className="mt-2 flex items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 font-bold text-destructive">
              📉 {lostLabel}
            </span>
            <span className="text-muted-foreground">↔</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 font-bold text-accent">
              📈 {foundLabel}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-5 space-y-2.5">
        {criteria.map((c, i) => (
          <MatchBreakdownBar
            key={c.key}
            criterion={c}
            value={breakdown[c.key] || 0}
            max={c.max}
            delay={i * 0.08}
          />
        ))}
      </div>

      <div className="mt-4 rounded-xl bg-muted/40 p-3">
        <p className="text-xs text-muted-foreground">
          Score total : <span className={`font-extrabold ${scoreColor(score)}`}>{score}/100</span>
          {score >= 80
            ? " — Correspondance très élevante !"
            : score >= 60
            ? " — Bonne correspondance"
            : score >= 40
            ? " — Correspondance possible"
            : " — Faible correspondance"}
        </p>
        <p className="mt-1 text-[11px] text-muted-foreground/70">
          Algorithme basé sur : catégorie, ville, quartier, date, nom, identifiant et description.
        </p>
      </div>
    </motion.div>
  );
};

export default MatchComparison;
