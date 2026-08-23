import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  MapPin,
  Building2,
  Phone,
  ArrowRight,
  Sparkles,
  Star,
  X,
  Clock,
  ShieldCheck,
} from "lucide-react";
import { findNearestAdmin } from "@/lib/notificationService";

const MatchVerifyPopup = ({ isOpen, onClose, matches, declaration, kind }) => {
  const [admin, setAdmin] = useState(null);
  const [loadingAdmin, setLoadingAdmin] = useState(true);
  const isFound = kind === "found";
  const hasMatches = matches && matches.length > 0;

  useEffect(() => {
    if (!isOpen || !declaration) return;
    setLoadingAdmin(true);
    findNearestAdmin(declaration.city || "", declaration.zone || "")
      .then(setAdmin)
      .catch(() => setAdmin(null))
      .finally(() => setLoadingAdmin(false));
  }, [isOpen, declaration]);

  if (!isOpen) return null;

  const bestMatch = hasMatches ? matches[0] : null;
  const bestScore = bestMatch?.score || 0;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 24 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="relative w-full max-w-md overflow-hidden rounded-3xl border border-border/60 bg-card shadow-2xl"
          >
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute right-3 top-3 z-10 grid h-8 w-8 place-items-center rounded-full bg-muted/60 text-muted-foreground hover:bg-muted transition-colors"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Header with gradient */}
            {hasMatches ? (
              <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 px-6 pt-8 pb-6 text-white">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: "spring" }}
                  className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-white/20"
                >
                  <CheckCircle2 className="h-8 w-8" />
                </motion.div>
                <h2 className="mt-4 text-center text-xl font-extrabold">
                  Correspondance trouvée !
                </h2>
                <p className="mt-1 text-center text-sm text-white/80">
                  {matches.length} déclaration{matches.length > 1 ? "s" : ""} de
                  perte correspond{matches.length > 1 ? "ent" : "ant"} à votre
                  objet
                </p>
                {bestMatch && (
                  <div className="mt-3 flex items-center justify-center gap-2">
                    <span className="rounded-full bg-white/20 px-3 py-1 text-sm font-extrabold">
                      {bestScore}% similaire
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-gradient-to-br from-primary to-primary/80 px-6 pt-8 pb-6 text-white">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: "spring" }}
                  className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-white/20"
                >
                  <Clock className="h-8 w-8" />
                </motion.div>
                <h2 className="mt-4 text-center text-xl font-extrabold">
                  Déclaration enregistrée
                </h2>
                <p className="mt-1 text-center text-sm text-white/80">
                  Aucune correspondance immédiate. Le système continue de
                  comparer.
                </p>
              </div>
            )}

            {/* Body */}
            <div className="space-y-4 p-6">
              {/* Match details */}
              {hasMatches && bestMatch && (
                <div className="space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Détail de la correspondance
                  </h3>
                  {matches.slice(0, 3).map((m, i) => {
                    const bd = m.breakdown || {};
                    const otherTitle =
                      m.expand?.lost?.title || m.expand?.found?.title || "—";
                    return (
                      <div
                        key={m.id || i}
                        className="rounded-xl border border-border/60 bg-muted/30 p-3"
                      >
                        <div className="flex items-center justify-between">
                          <span className="truncate text-sm font-bold">
                            {otherTitle}
                          </span>
                          <span
                            className={`ml-2 shrink-0 rounded-full px-2 py-0.5 text-xs font-extrabold ${
                              m.score >= 80
                                ? "bg-emerald-500/10 text-emerald-600"
                                : m.score >= 60
                                ? "bg-primary/10 text-primary"
                                : "bg-amber-500/10 text-amber-600"
                            }`}
                          >
                            {m.score}%
                          </span>
                        </div>
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {bd.ville > 0 && (
                            <span className="rounded bg-primary/8 px-1.5 py-0.5 text-[9px] font-bold text-primary">
                              🏙️ Ville
                            </span>
                          )}
                          {bd.zone > 0 && (
                            <span className="rounded bg-primary/8 px-1.5 py-0.5 text-[9px] font-bold text-primary">
                              📍 Quartier
                            </span>
                          )}
                          {bd.categorie > 0 && (
                            <span className="rounded bg-primary/8 px-1.5 py-0.5 text-[9px] font-bold text-primary">
                              📁 Catégorie
                            </span>
                          )}
                          {bd.identifiant > 0 && (
                            <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-bold text-emerald-600">
                              🔢 ID ✓
                            </span>
                          )}
                          {bd.nom > 0 && (
                            <span className="rounded bg-primary/8 px-1.5 py-0.5 text-[9px] font-bold text-primary">
                              👤 Nom
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Nearest admin - for found declarations */}
              {isFound && (
                <div className="space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    <Building2 className="mr-1 inline h-3.5 w-3.5" />
                    {hasMatches
                      ? "Déposez l'objet chez cet administrateur"
                      : "Administrateur le plus proche"}
                  </h3>
                  {loadingAdmin ? (
                    <div className="flex items-center gap-2 rounded-xl bg-muted/40 p-4">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                      <span className="text-sm text-muted-foreground">
                        Recherche en cours...
                      </span>
                    </div>
                  ) : admin ? (
                    <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                      <div className="flex items-start gap-3">
                        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10">
                          <ShieldCheck className="h-5 w-5 text-primary" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-extrabold">{admin.name || "Administrateur"}</p>
                          {admin.city && (
                            <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                              <MapPin className="h-3 w-3" />
                              {admin.city}
                              {admin.quarter ? ` · ${admin.quarter}` : ""}
                              {admin.matchLevel === "exact" && (
                                <span className="ml-1 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-bold text-emerald-600">
                                  Même quartier
                                </span>
                              )}
                              {admin.matchLevel === "city" && (
                                <span className="ml-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold text-primary">
                                  Même ville
                                </span>
                              )}
                            </p>
                          )}
                          {admin.phone && (
                            <a
                              href={`tel:${admin.phone}`}
                              className="mt-1.5 inline-flex items-center gap-1 rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary"
                            >
                              <Phone className="h-3 w-3" /> Appeler
                            </a>
                          )}
                        </div>
                      </div>
                      {hasMatches && (
                        <div className="mt-3 rounded-lg bg-emerald-500/10 px-3 py-2">
                          <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                            📋 Instructions :
                          </p>
                          <ol className="mt-1 space-y-1 text-xs text-emerald-600 dark:text-emerald-400">
                            <li>1. Apportez l&apos;objet chez {admin.name}</li>
                            <li>2. Un PV de dépôt sera établi</li>
                            <li>3. Le propriétaire sera notifié</li>
                          </ol>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-xl bg-muted/40 p-4 text-center text-sm text-muted-foreground">
                      Aucun administrateur disponible
                    </div>
                  )}
                </div>
              )}

              {/* For lost declarations - what to do */}
              {!isFound && hasMatches && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800/30 dark:bg-amber-900/20">
                  <p className="text-sm font-bold text-amber-700 dark:text-amber-300">
                    🎉 Bonne nouvelle !
                  </p>
                  <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                    Un objet correspondant à votre déclaration a été retrouvé.
                    Consultez votre tableau de bord pour voir les détails et
                    contacter le déposant.
                  </p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="border-t border-border/60 px-6 py-4">
              {hasMatches && isFound ? (
                <div className="grid grid-cols-2 gap-2">
                  <Link
                    to="/tableau-de-bord"
                    onClick={onClose}
                    className="flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/25 transition-transform active:scale-[0.98]"
                  >
                    Voir les détails <ArrowRight className="h-4 w-4" />
                  </Link>
                  <button
                    onClick={onClose}
                    className="rounded-xl border border-border px-4 py-3 text-sm font-bold transition-colors hover:bg-muted/50"
                  >
                    Plus tard
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <Link
                    to="/tableau-de-bord"
                    onClick={onClose}
                    className="flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/25 transition-transform active:scale-[0.98]"
                  >
                    Mon espace
                  </Link>
                  <Link
                    to="/"
                    onClick={onClose}
                    className="rounded-xl border border-border px-4 py-3 text-center text-sm font-bold transition-colors hover:bg-muted/50"
                  >
                    Accueil
                  </Link>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default MatchVerifyPopup;
