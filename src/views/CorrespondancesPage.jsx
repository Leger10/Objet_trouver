import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { pb } from "@/lib/pbClient";
import Layout from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { useBranding } from "@/contexts/BrandingContext";
import { isSensitiveCategory, canViewSensitiveDetails } from "@/lib/categories";
import {
  Handshake,
  Search,
  MapPin,
  Building2,
  Phone,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  FileText,
  Clock,
  AlertTriangle,
  ExternalLink,
  Loader2,
} from "lucide-react";

const DECL_STATUS = {
  open: { label: "Ouverte", cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
  matched: { label: "Correspondance", cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" },
  depose: { label: "Déposé", cls: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300" },
  returned: { label: "Restitué", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
  blocked: { label: "Bloqué", cls: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" },
};

const MATCH_STATUS = {
  suggested: { label: "En attente", cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300", icon: Clock },
  confirmed: { label: "Confirmée", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300", icon: CheckCircle2 },
  rejected: { label: "Rejetée", cls: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300", icon: XCircle },
};

const CorrespondancesPage = () => {
  const { user, isAdmin } = useAuth();
  const { branding } = useBranding();
  const [declarations, setDeclarations] = useState([]);
  const [matches, setMatches] = useState([]);
  const [pvs, setPvs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedDecl, setExpandedDecl] = useState(null);
  const [busyMatch, setBusyMatch] = useState(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [decls, mts, pvList] = await Promise.all([
        pb.collection("declarations").getFullList({
          filter: pb.filter("owner = {:u}", { u: user.id }),
          sort: "-created",
          expand: "category",
        }),
        pb.collection("matches").getFullList({
          sort: "-score",
          expand: "lost,found",
        }),
        pb.collection("pvs").getFullList({
          sort: "-created",
        }),
      ]);
      setDeclarations(decls || []);
      setMatches(mts || []);
      setPvs(pvList || []);
    } catch (e) {
      console.error("CorrespondancesPage load error:", e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const pvByDecl = useMemo(() => {
    const map = new Map();
    (pvs || []).forEach((p) => {
      const declId = p.declaration_id || p.related_declaration;
      if (declId) {
        const existing = map.get(declId);
        if (!existing || new Date(p.created_at) > new Date(existing.created_at)) {
          map.set(declId, p);
        }
      }
    });
    return map;
  }, [pvs]);

  const userDeclIds = useMemo(() => new Set(declarations.map((d) => d.id)), [declarations]);

  const myMatches = useMemo(() => {
    return matches.filter(
      (m) => userDeclIds.has(m.lost) || userDeclIds.has(m.found)
    );
  }, [matches, userDeclIds]);

  const matchesByLost = useMemo(() => {
    const map = {};
    myMatches.forEach((m) => {
      if (!map[m.lost]) map[m.lost] = [];
      map[m.lost].push(m);
    });
    Object.values(map).forEach((arr) => arr.sort((a, b) => b.score - a.score));
    return map;
  }, [myMatches]);

  const lostDeclarations = useMemo(
    () => declarations.filter((d) => d.kind === "lost"),
    [declarations]
  );

  const updateMatch = async (m, status) => {
    setBusyMatch(m.id);
    try {
      await pb.collection("matches").update(m.id, { status });
      const other =
        m.expand?.lost?.owner === user.id
          ? m.expand?.found?.owner
          : m.expand?.lost?.owner;
      if (status === "confirmed" && other) {
        try {
          await pb.collection("notifications").create({
            user: other,
            title: "Correspondance confirmée",
            body: "Une correspondance a été confirmée. Lancez la restitution.",
            link: "/mes-correspondances",
            read: false,
          });
        } catch (_) {}
        toast.success("Correspondance confirmée", {
          description: "+50 points crédités.",
        });
      } else if (status === "rejected") {
        toast("Correspondance rejetée");
      }
      load();
    } catch (e) {
      toast.error("Action impossible", { description: e?.message });
    } finally {
      setBusyMatch(null);
    }
  };

  const scoreColor = (score) =>
    score >= 80
      ? "text-emerald-600 bg-emerald-500/10 border-emerald-300"
      : score >= 60
      ? "text-primary bg-primary/10 border-primary/30"
      : score >= 40
      ? "text-amber-600 bg-amber-500/10 border-amber-300"
      : "text-muted-foreground bg-muted border-border";

  return (
    <Layout>
      <Helmet>
        <title>Mes correspondances — {branding.app_name}</title>
        <meta name="description" content={`Consultez les correspondances pour vos objets perdus sur ${branding.app_name}.`} />
      </Helmet>

      <div className="mx-auto w-full max-w-2xl px-4 sm:px-6 py-8 sm:py-12">
        <div className="mb-6">
          <h1 className="text-2xl font-extrabold flex items-center gap-2">
            <Handshake className="h-6 w-6 text-primary" />
            Mes correspondances
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Vérifiez si un objet perdu a été retrouvé et déposé chez un administrateur.
          </p>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted" />
            ))}
          </div>
        ) : lostDeclarations.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-8 text-center">
            <AlertTriangle className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
            <p className="font-bold text-lg">Aucune déclaration de perte</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Vous n&apos;avez pas encore déclaré d&apos;objet perdu.
            </p>
            <Link
              to="/declarer/perdu"
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-extrabold text-primary-foreground"
            >
              Déclarer un objet perdu
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {lostDeclarations.map((decl) => {
              const declMatches = matchesByLost[decl.id] || [];
              const statusInfo = DECL_STATUS[decl.status] || DECL_STATUS.open;
              const isExpanded = expandedDecl === decl.id;

              return (
                <motion.div
                  key={decl.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden"
                >
                  {/* Declaration header */}
                  <button
                    onClick={() => setExpandedDecl(isExpanded ? null : decl.id)}
                    className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/30 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${statusInfo.cls}`}>
                          {statusInfo.label}
                        </span>
                        {declMatches.length > 0 && (
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                            {declMatches.length} match{declMatches.length > 1 ? "es" : ""}
                          </span>
                        )}
                      </div>
                      <p className="font-bold text-sm truncate">{decl.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {decl.city}{decl.zone ? ` · ${decl.zone}` : ""} · {new Date(decl.created_at).toLocaleDateString("fr-FR")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {declMatches.length > 0 && (
                        <span className={`h-7 w-7 grid place-items-center rounded-full text-xs font-extrabold ${scoreColor(declMatches[0].score)}`}>
                          {declMatches[0].score}%
                        </span>
                      )}
                      {isExpanded ? (
                        <ChevronUp className="h-5 w-5 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                  </button>

                  {/* Expanded content */}
                  {isExpanded && (
                    <div className="border-t border-border px-4 pb-4 pt-3 space-y-3">
                      {/* Declaration details */}
                      <div className="rounded-xl bg-muted/40 p-3 text-sm">
                        <p className="font-bold mb-1">Description de la perte</p>
                        <p className="text-muted-foreground whitespace-pre-wrap">{decl.description || "Aucune description."}</p>
                        {decl.event_date && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Date de perte : {new Date(decl.event_date).toLocaleDateString("fr-FR")}
                          </p>
                        )}
                      </div>

                      {declMatches.length === 0 ? (
                        <div className="rounded-xl bg-muted/40 p-4 text-center">
                          <Search className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                          <p className="text-sm font-bold">Aucune correspondance trouvée</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Le moteur de recherche continue de comparer. Vous serez notifié.
                          </p>
                        </div>
                      ) : (
                        declMatches.map((m) => {
                          const found = m.expand?.found;
                          const isMyLost = m.expand?.lost?.owner === user.id;
                          const matchedDecl = isMyLost ? found : m.expand?.lost;
                          const matchedTitle =
                            isSensitiveCategory(matchedDecl) && !canViewSensitiveDetails(matchedDecl, user, isAdmin)
                              ? (matchedDecl?.expand?.category?.name || "Document protégé")
                              : (matchedDecl?.title || "Inconnu");
                          const ms = MATCH_STATUS[m.status] || MATCH_STATUS.suggested;
                          const MsIcon = ms.icon;
                          const bd = m.breakdown || {};

                          const depositPV = pvByDecl.get(m.found);
                          const adminName = depositPV?.data?.adminName || depositPV?.admin_name || "";
                          const adminLocation = depositPV?.location || "";
                          const pvNumber = depositPV?.pv_number || "";

                          return (
                            <motion.div
                              key={m.id}
                              initial={{ opacity: 0, scale: 0.97 }}
                              animate={{ opacity: 1, scale: 1 }}
                              className="rounded-xl border border-border/60 bg-background p-3"
                            >
                              {/* Score + status */}
                              <div className="flex items-center gap-3 mb-2">
                                <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl border font-mono text-sm font-extrabold ${scoreColor(m.score)}`}>
                                  {m.score}%
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <MsIcon className="h-4 w-4 shrink-0" />
                                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${ms.cls}`}>
                                      {ms.label}
                                    </span>
                                  </div>
                                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                                    Objet : {matchedTitle}
                                  </p>
                                </div>
                              </div>

                              {/* Breakdown chips */}
                              <div className="flex flex-wrap gap-1.5 mb-2">
                                {bd.ville > 0 && (
                                  <span className="inline-flex items-center gap-0.5 rounded bg-primary/8 px-1.5 py-0.5 text-[9px] font-bold text-primary">🏙️ Ville</span>
                                )}
                                {bd.zone > 0 && (
                                  <span className="inline-flex items-center gap-0.5 rounded bg-primary/8 px-1.5 py-0.5 text-[9px] font-bold text-primary">📍 Quartier</span>
                                )}
                                {bd.categorie > 0 && (
                                  <span className="inline-flex items-center gap-0.5 rounded bg-primary/8 px-1.5 py-0.5 text-[9px] font-bold text-primary">📁 Catégorie</span>
                                )}
                                {bd.identifiant > 0 && (
                                  <span className="inline-flex items-center gap-0.5 rounded bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-bold text-emerald-600">🔢 ID ✓</span>
                                )}
                                {bd.nom > 0 && (
                                  <span className="inline-flex items-center gap-0.5 rounded bg-primary/8 px-1.5 py-0.5 text-[9px] font-bold text-primary">👤 Nom</span>
                                )}
                                {bd.date > 0 && (
                                  <span className="inline-flex items-center gap-0.5 rounded bg-primary/8 px-1.5 py-0.5 text-[9px] font-bold text-primary">📅 Date</span>
                                )}
                                {bd.description > 0 && (
                                  <span className="inline-flex items-center gap-0.5 rounded bg-primary/8 px-1.5 py-0.5 text-[9px] font-bold text-primary">📝 Desc</span>
                                )}
                              </div>

                              {/* Admin deposit info */}
                              {depositPV && (adminName || adminLocation) && (
                                <div className="rounded-xl bg-primary/5 border border-primary/20 p-3 mb-2">
                                  <p className="text-[10px] font-bold uppercase text-primary mb-2 flex items-center gap-1">
                                    <Building2 className="h-3 w-3" />
                                    Objet déposé chez l&apos;administrateur
                                  </p>
                                  {adminName && (
                                    <p className="text-sm font-bold flex items-center gap-1.5">
                                      <Building2 className="h-3.5 w-3.5 text-primary shrink-0" />
                                      {adminName}
                                    </p>
                                  )}
                                  {adminLocation && (
                                    <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-1">
                                      <MapPin className="h-3.5 w-3.5 shrink-0" />
                                      {adminLocation}
                                    </p>
                                  )}
                                  {pvNumber && (
                                    <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-1">
                                      <FileText className="h-3.5 w-3.5 shrink-0" />
                                      PV : {pvNumber}
                                    </p>
                                  )}
                                </div>
                              )}

                              {/* Actions */}
                              <div className="flex flex-wrap gap-2">
                                <Link
                                  to={`/objet/${matchedDecl?.id}`}
                                  className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-bold hover:bg-muted/50 transition"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                  Voir l&apos;objet
                                </Link>
                                {m.status === "suggested" && (
                                  <>
                                    <button
                                      onClick={() => updateMatch(m, "confirmed")}
                                      disabled={busyMatch === m.id}
                                      className="inline-flex items-center gap-1 rounded-lg bg-accent px-3 py-1.5 text-xs font-bold text-accent-foreground disabled:opacity-50"
                                    >
                                      {busyMatch === m.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                                      Confirmer +50
                                    </button>
                                    <button
                                      onClick={() => updateMatch(m, "rejected")}
                                      disabled={busyMatch === m.id}
                                      className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-bold text-muted-foreground disabled:opacity-50"
                                    >
                                      <XCircle className="h-3 w-3" />
                                      Rejeter
                                    </button>
                                  </>
                                )}
                              </div>
                            </motion.div>
                          );
                        })
                      )}
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default CorrespondancesPage;
