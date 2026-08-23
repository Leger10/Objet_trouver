import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  BadgeCheck,
  Bell,
  ChevronRight,
  Copy,
  Coins,
  Gift,
  Handshake,
  ShieldCheck,
  Users,
  ShoppingBag,
  ArrowDownToLine,
  History,
  Download,
  FileText,
  ChevronDown,
  Target,
  AlertTriangle,
  CheckCircle2,
  Package,
  Star,
  Banknote,
} from "lucide-react";
import { pb, supabase } from "@/lib/supabaseClient";
import Layout from "@/components/Layout";
import PullToRefresh from "@/components/PullToRefresh";
import AdSlot from "@/components/AdSlot";
import { useAuth } from "@/contexts/AuthContext";
import { REWARDS, BADGES, getBadge, notify } from "@/lib/retrouve";
import { groupCategories, metaForSlug, groupStyle } from "@/lib/categories";
import { printPV, TYPE_LABELS, TYPE_BADGE, formatDateTimeFr } from "@/lib/pv";
import { usePaginate, ListFooter } from "@/components/PaginatedList";
import EtiquetteDecl from "@/components/EtiquetteDecl";
import InstallPopup from "@/components/InstallPopup";

const DECL_STATUS_LABELS = {
  restitue: { label: "Objet restitué", cls: "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400", dot: "bg-emerald-500" },
  depose: { label: "Déposé", cls: "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400", dot: "bg-blue-500" },
  open: { label: "En cours", cls: "bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400", dot: "bg-amber-500" },
  closed: { label: "Fermé", cls: "bg-muted text-muted-foreground", dot: "bg-muted-foreground/50" },
  matched: { label: "Match trouvé", cls: "bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400", dot: "bg-purple-500" },
  returned: { label: "Restitué", cls: "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400", dot: "bg-emerald-500" },
};

const Section = ({ title, icon: Icon, count, children, defaultOpen = true }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left active:bg-muted/50 transition-colors"
      >
        {Icon && <Icon className="h-5 w-5 text-primary shrink-0" />}
        <span className="flex-1 text-sm font-extrabold">{title}</span>
        {count > 0 && (
          <span className="grid h-5 min-w-5 place-items-center rounded-full bg-primary/10 px-1.5 text-[10px] font-bold text-primary">
            {count}
          </span>
        )}
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="border-t border-border/40 px-4 py-3">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const StatCard = ({ icon: Icon, value, label, color, gradient }) => (
  <motion.div
    whileTap={{ scale: 0.97 }}
    className={`relative overflow-hidden rounded-2xl p-4 shadow-sm ${gradient || "bg-card border border-border/60"}`}
  >
    <div className="flex items-start justify-between">
      <div>
        <p className={`text-2xl font-extrabold ${color || "text-foreground"}`}>{value}</p>
        <p className={`mt-0.5 text-[11px] font-semibold ${gradient ? "text-white/70" : "text-muted-foreground"}`}>
          {label}
        </p>
      </div>
      <div className={`grid h-9 w-9 place-items-center rounded-xl ${gradient ? "bg-white/15" : "bg-primary/10"}`}>
        <Icon className={`h-4.5 w-4.5 ${gradient ? "text-white" : "text-primary"}`} />
      </div>
    </div>
  </motion.div>
);

const QuickAction = ({ to, icon: Icon, label, sub, accent }) => (
  <Link
    to={to}
    className={`flex items-center gap-3 rounded-2xl border border-border/60 bg-card px-4 py-3.5 shadow-sm active:scale-[0.98] transition-all hover:shadow-md ${accent ? "border-primary/20 bg-primary/5" : ""}`}
  >
    <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${accent ? "bg-primary/15" : "bg-muted"}`}>
      <Icon className={`h-5 w-5 ${accent ? "text-primary" : "text-muted-foreground"}`} />
    </div>
    <div className="min-w-0 flex-1">
      <p className="text-sm font-bold">{label}</p>
      <p className="text-[11px] text-muted-foreground">{sub}</p>
    </div>
    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50" />
  </Link>
);

const DashboardPage = () => {
  const { user } = useAuth();
  const [declarations, setDeclarations] = useState([]);
  const [matches, setMatches] = useState([]);
  const [claimsIn, setClaimsIn] = useState([]);
  const [claimsOut, setClaimsOut] = useState([]);
  const [notifs, setNotifs] = useState([]);
  const [referralCount, setReferralCount] = useState(0);
  const [referralPoints, setReferralPoints] = useState(0);
  const [referrals, setReferrals] = useState([]);
  const [ledger, setLedger] = useState([]);
  const [pvs, setPvs] = useState([]);
  const [txFilter, setTxFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [catFilter, setCatFilter] = useState("all");

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [
        decl,
        mts,
        cout,
        nt,
        refUsers,
        refLedger,
        userLedger,
        pvList,
      ] = await Promise.all([
        pb.collection("declarations").getFullList({
          filter: pb.filter("owner = {:u}", { u: user.id }),
          sort: "-created",
          expand: "category",
          requestKey: "db-decl",
        }),
        pb.collection("matches").getFullList({
          sort: "-score",
          expand: "lost,found",
          requestKey: "db-matches",
        }),
        pb.collection("claims").getFullList({
          filter: pb.filter("claimant = {:u}", { u: user.id }),
          sort: "-created",
          expand: "declaration",
          requestKey: "db-claims-out",
        }),
        pb
          .collection("notifications")
          .getList(1, 12, { sort: "-created", requestKey: "db-notifs" }),
        user?.referral_code
          ? pb.collection("users").getList(1, 20, {
              filter: pb.filter("referred_by = {:c}", {
                c: user.referral_code,
              }),
              sort: "-created",
              requestKey: "db-refs",
            })
          : Promise.resolve({ totalItems: 0, items: [] }),
        pb.collection("points_ledger").getList(1, 200, {
          filter: pb.filter('"user" = {:u} && reason = "referral"', {
            u: user.id,
          }),
          requestKey: "db-ref-ledger",
        }),
        pb.collection("points_ledger").getFullList({
          filter: pb.filter('"user" = {:u}', { u: user.id }),
          sort: "-created",
          requestKey: "db-ledger",
        }),
        pb
          .collection("pvs")
          .getFullList({ sort: "-created", requestKey: "db-pvs" }),
      ]);
      setDeclarations(decl);
      setMatches(mts);
      setClaimsOut(cout);

      const declIds = (decl || []).map(d => d.id);
      let claimsInItems = [];
      if (declIds.length > 0) {
        try {
          const { data } = await supabase
            .from('claims')
            .select('*')
            .in('declaration', declIds)
            .order('created_at', { ascending: false });
          claimsInItems = data || [];
          if (claimsInItems.length > 0) {
            const { data: decls } = await supabase
              .from('declarations')
              .select('*')
              .in('id', declIds);
            const declMap = new Map((decls || []).map(d => [d.id, d]));
            claimsInItems.forEach(c => {
              c.expand = { declaration: declMap.get(c.declaration) || null };
            });
          }
        } catch (_) {
          claimsInItems = [];
        }
      }
      setClaimsIn(claimsInItems);

      setNotifs(nt.items);
      setReferralCount(refUsers.totalItems || 0);
      setReferralPoints(
        (refLedger.items || []).reduce((sum, r) => sum + (r.amount || 0), 0),
      );
      setReferrals(refUsers.items || []);
      setLedger(userLedger || []);
      setPvs(pvList || []);
    } catch (_) {
      setDeclarations([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const updateMatch = async (m, status) => {
    try {
      await pb.collection("matches").update(m.id, { status });
      const other =
        m.expand?.lost?.owner === user.id
          ? m.expand?.found?.owner
          : m.expand?.lost?.owner;
      if (status === "confirmed" && other) {
        await notify(
          other,
          "Correspondance confirmée",
          "Une correspondance a été confirmée. Lancez la restitution.",
        );
        toast.success("Correspondance confirmée", {
          description: "+50 points crédités.",
        });
      } else if (status === "rejected") {
        toast("Correspondance rejetée");
      }
      load();
    } catch (_) {
      toast.error("Action impossible");
    }
  };

  const updateClaim = async (c, status) => {
    try {
      await pb.collection("claims").update(c.id, { status });
      const label =
        status === "verified"
          ? "Vérification réussie : le déclarant va vous contacter."
          : status === "returned"
            ? "Restitution confirmée. Merci !"
            : "Votre demande a été refusée (réponse incorrecte).";
      await notify(c.claimant, "Mise à jour de votre demande", label);
      if (status === "returned")
        toast.success("Restitution confirmée", {
          description: "+100 points crédités.",
        });
      else if (status === "verified") toast.success("Demande vérifiée");
      else toast("Demande refusée");
      load();
    } catch (_) {
      toast.error("Action impossible");
    }
  };

  const markRead = async (n) => {
    try {
      await pb.collection("notifications").update(n.id, { read: true });
      setNotifs((prev) =>
        prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)),
      );
    } catch (_) {}
  };

  const copyCode = () => {
    if (navigator.clipboard && user?.referral_code) {
      navigator.clipboard.writeText(user.referral_code).catch(() => {});
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const referralLink = user?.referral_code
    ? `${window.location.origin}/inscription?ref=${user.referral_code}`
    : "";

  const copyLink = () => {
    if (navigator.clipboard && referralLink) {
      navigator.clipboard.writeText(referralLink).catch(() => {});
    }
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const monthStart = useMemo(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  }, []);
  const monthEarned = useMemo(
    () =>
      ledger
        .filter((l) => new Date(l.created) >= monthStart && (l.amount || 0) > 0)
        .reduce((s, l) => s + (l.amount || 0), 0),
    [ledger, monthStart],
  );
  const monthSpent = useMemo(
    () =>
      ledger
        .filter((l) => new Date(l.created) >= monthStart && (l.amount || 0) < 0)
        .reduce((s, l) => s + Math.abs(l.amount || 0), 0),
    [ledger, monthStart],
  );

  const filteredLedger = useMemo(() => {
    if (txFilter === "gains") return ledger.filter((l) => (l.amount || 0) > 0);
    if (txFilter === "depenses")
      return ledger.filter((l) => (l.amount || 0) < 0);
    if (txFilter === "retraits")
      return ledger.filter((l) => l.reason === "withdrawal");
    return ledger;
  }, [ledger, txFilter]);
  const ledgerWithBalance = useMemo(() => {
    const sorted = [...filteredLedger].sort(
      (a, b) => new Date(a.created) - new Date(b.created),
    );
    let bal = 0;
    return sorted
      .map((l) => {
        bal += l.amount || 0;
        return { ...l, balanceAfter: bal };
      })
      .reverse();
  }, [filteredLedger]);

  const filteredDecls = useMemo(() => {
    return catFilter === "all" ? declarations : declarations.filter((d) => d.expand?.category?.id === catFilter);
  }, [declarations, catFilter]);

  const pvByDecl = useMemo(() => {
    const map = new Map();
    (pvs || []).forEach((p) => {
      const declId = p.declaration_id || p.related_declaration;
      if (declId) {
        const existing = map.get(declId);
        if (!existing || new Date(p.created) > new Date(existing.created)) {
          map.set(declId, p);
        }
      }
    });
    return map;
  }, [pvs]);

  const myDeclIds = useMemo(() => new Set(declarations.map((d) => d.id)), [declarations]);
  const myMatches = useMemo(
    () => matches.filter((m) => myDeclIds.has(m.lost) || myDeclIds.has(m.found)),
    [matches, myDeclIds]
  );

  const matchesPaginate = usePaginate(myMatches);
  const claimsInPaginate = usePaginate(claimsIn);
  const filteredDeclPaginate = usePaginate(filteredDecls);
  const ledgerPaginate = usePaginate(ledgerWithBalance);
  const pvPaginate = usePaginate(pvs);
  const referralPaginate = usePaginate(referrals);

  const earned = user?.points_earned || 0;
  const badge = getBadge(earned);
  const nextBadge = BADGES.find((b) => earned < b.threshold);
  const badgePct = nextBadge
    ? Math.min(100, Math.round((earned / nextBadge.threshold) * 100))
    : 100;

  return (
    <Layout>
      <Helmet>
        <title>Mon espace — RetrouveMoi</title>
        <meta name="description" content="Suivez vos déclarations, correspondances et récompenses." />
      </Helmet>

      <PullToRefresh onRefresh={load}>
        <div className="mx-auto w-full max-w-lg px-4 pt-5 pb-8 space-y-4">

          {/* ── HERO CARD ── */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary to-[hsl(200_85%_45%)] p-5 text-white shadow-lg shadow-primary/20"
          >
            <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/10" />
            <div className="absolute -right-2 top-12 h-16 w-16 rounded-full bg-white/5" />
            <p className="text-sm font-semibold text-white/70">
              Bonjour {user?.name?.split(" ")[0] || user?.email?.split("@")[0]}
            </p>
            <div className="mt-3 flex items-end gap-3">
              <p className="text-4xl font-extrabold tracking-tight">{user?.points || 0}</p>
              <p className="mb-1 text-sm font-bold text-white/70">points</p>
            </div>
            <div className="mt-3 flex items-center gap-3">
              {badge && (
                <span className="flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-xs font-bold">
                  {badge.emoji} {badge.label}
                </span>
              )}
              {nextBadge && (
                <span className="text-[11px] font-semibold text-white/60">
                  {earned}/{nextBadge.threshold} pts
                </span>
              )}
            </div>
            {nextBadge && (
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/20">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${badgePct}%` }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                  className="h-full rounded-full bg-white"
                />
              </div>
            )}
          </motion.div>

          {/* ── PWA INSTALL POPUP ── */}
          <InstallPopup />

          {/* ── STATS GRID ── */}
          <div className="grid grid-cols-2 gap-3">
            <StatCard icon={ShieldCheck} value={declarations.length} label="Déclarations" gradient="bg-gradient-to-br from-blue-500 to-blue-600" color="text-white" />
            <StatCard icon={Handshake} value={matches.length} label="Correspondances" gradient="bg-gradient-to-br from-amber-500 to-orange-500" color="text-white" />
            <StatCard icon={FileText} value={pvs.length} label="PV établis" gradient="bg-gradient-to-br from-purple-500 to-purple-600" color="text-white" />
            <StatCard icon={Gift} value={referralCount} label="Parrainages" gradient="bg-gradient-to-br from-emerald-500 to-emerald-600" color="text-white" />
          </div>

          {/* ── QUICK ACTIONS ── */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.4 }}
            className="space-y-2"
          >
            <QuickAction to="/declarer/perdu" icon={AlertTriangle} label="Déclarer un objet perdu" sub="Enregistrer une perte" accent />
            <QuickAction to="/declarer/retrouvé" icon={Package} label="Déclarer un objet trouvé" sub="Aider quelqu'un à récupérer son bien" />
            <QuickAction to="/rechercher" icon={Target} label="Rechercher un objet" sub="Parcourir les objets trouvés" />
            <QuickAction to="/recompenses" icon={Banknote} label="Retirer mes gains" sub={`${(user?.points || 0).toLocaleString()} pts → FCFA`} />
            {myMatches.length > 0 && (
              <QuickAction to="/mes-correspondances" icon={Handshake} label={`${myMatches.length} correspondance${myMatches.length > 1 ? "s" : ""}`} sub="Voir les objets retrouvés" />
            )}
          </motion.div>

          {/* ── CORRESPONDANCES ── */}
          <Section title="Correspondances" icon={Handshake} count={myMatches.length} defaultOpen={myMatches.length > 0}>
            {loading ? (
              <div className="space-y-2">
                {[1, 2].map((i) => (
                  <div key={i} className="h-16 animate-pulse rounded-2xl bg-muted" />
                ))}
              </div>
            ) : matches.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Aucune correspondance. Le moteur continue de comparer.
              </p>
            ) : (
              <div className="space-y-2">
                {matchesPaginate.shown.map((m) => {
                  const bd = m.breakdown || {};
                  const scoreColor =
                    m.score >= 80
                      ? "text-emerald-500 bg-emerald-500/10"
                      : m.score >= 60
                      ? "text-primary bg-primary/10"
                      : m.score >= 40
                      ? "text-amber-500 bg-amber-500/10"
                      : "text-muted-foreground bg-muted";
                  return (
                    <motion.div
                      key={m.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="rounded-2xl border border-border/60 bg-background p-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl font-mono text-sm font-extrabold ${scoreColor}`}>
                          {m.score}%
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold">
                            {m.expand?.lost?.title} ↔ {m.expand?.found?.title}
                          </p>
                          <div className="mt-1 flex flex-wrap gap-1.5">
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
                        </div>
                      </div>
                      <div className="mt-2.5 flex gap-2">
                        <Link
                          to={`/objet/${m.expand?.lost?.owner === user?.id ? m.found : m.lost}`}
                          className="rounded-lg border border-border px-3 py-1.5 text-xs font-bold"
                        >
                          Voir
                        </Link>
                        <Link
                          to={`/objet/${m.expand?.lost?.owner === user?.id ? m.lost : m.found}`}
                          className="rounded-lg border border-border px-3 py-1.5 text-xs font-bold"
                        >
                          Voir l&apos;autre
                        </Link>
                        {m.status === "suggested" && (
                          <>
                            <button
                              onClick={() => updateMatch(m, "confirmed")}
                              className="rounded-lg bg-accent px-3 py-1.5 text-xs font-bold text-accent-foreground"
                            >
                              Confirmer +50
                            </button>
                            <button
                              onClick={() => updateMatch(m, "rejected")}
                              className="rounded-lg border border-border px-3 py-1.5 text-xs font-bold text-muted-foreground"
                            >
                              Rejeter
                            </button>
                          </>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
                <ListFooter {...matchesPaginate} total={myMatches.length} />
              </div>
            )}
          </Section>

          {/* ── DEMANDES REÇUES ── */}
          <Section title="Demandes reçues" icon={Users} count={claimsIn.length} defaultOpen={claimsIn.length > 0}>
            {claimsIn.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">Aucune demande reçue.</p>
            ) : (
              <div className="space-y-2">
                {claimsInPaginate.shown.map((c) => (
                  <div key={c.id} className="rounded-2xl border border-border/60 bg-background p-3">
                    <p className="text-sm font-bold">{c.expand?.declaration?.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Réponse : <span className="font-semibold text-foreground">{c.answer}</span>
                    </p>
                    <span className="mt-2 inline-block rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase text-muted-foreground">
                      {c.status}
                    </span>
                    <div className="mt-2.5 flex gap-2">
                      {c.status === "pending" && (
                        <>
                          <button onClick={() => updateClaim(c, "verified")} className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground">
                            Accepter
                          </button>
                          <button onClick={() => updateClaim(c, "rejected")} className="rounded-lg border border-border px-3 py-1.5 text-xs font-bold">
                            Refuser
                          </button>
                        </>
                      )}
                      {c.status === "verified" && (
                        <button onClick={() => updateClaim(c, "returned")} className="rounded-lg bg-accent px-3 py-1.5 text-xs font-bold text-accent-foreground">
                          Restituer +100
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                <ListFooter {...claimsInPaginate} total={claimsIn.length} />
              </div>
            )}
          </Section>

          {/* ── MES DÉCLARATIONS ── */}
          <Section title="Mes déclarations" icon={ShieldCheck} count={declarations.length}>
            {declarations.length > 0 && (
              <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
                <button
                  onClick={() => setCatFilter("all")}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold transition active:scale-95 ${
                    catFilter === "all"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  Tout ({declarations.length})
                </button>
                {(() => {
                  const used = new Map();
                  declarations.forEach((d) => {
                    const cat = d.expand?.category;
                    if (cat) used.set(cat.id, cat);
                  });
                  return Array.from(used.values()).map((cat) => {
                    const meta = metaForSlug(cat.slug);
                    const n = declarations.filter((d) => d.expand?.category?.id === cat.id).length;
                    return (
                      <button
                        key={cat.id}
                        onClick={() => setCatFilter(catFilter === cat.id ? "all" : cat.id)}
                        className={`shrink-0 flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold transition active:scale-95 ${
                          catFilter === cat.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {meta.emoji} ({n})
                      </button>
                    );
                  });
                })()}
              </div>
            )}

            {filteredDeclPaginate.total === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                {declarations.length === 0 ? (
                  <>Aucune déclaration. <Link to="/declarer/perdu" className="font-bold text-primary">Déclarer</Link></>
                ) : "Aucune dans cette catégorie."}
              </p>
            ) : (
              <div className="space-y-1.5">
                {filteredDeclPaginate.shown.map((d) => {
                  const statusInfo = DECL_STATUS_LABELS[d.status] || DECL_STATUS_LABELS.open;
                  const linkedPV = pvByDecl.get(d.id);
                  const showEtiquette = linkedPV && d.kind === "found" && d.status !== "returned";
                  return (
                    <div key={d.id}>
                      <Link
                        to={`/objet/${d.id}`}
                        className="flex items-center gap-3 rounded-2xl bg-background border border-border/60 px-3 py-3 active:scale-[0.98] transition-all"
                      >
                        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${d.kind === "lost" ? "bg-red-500" : "bg-emerald-500"}`} />
                        <span className="min-w-0 flex-1 truncate text-sm font-bold">{d.title}</span>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${statusInfo.cls}`}>
                          {statusInfo.label}
                        </span>
                      </Link>
                      {showEtiquette && <EtiquetteDecl pv={linkedPV} compact />}
                    </div>
                  );
                })}
                <ListFooter {...filteredDeclPaginate} total={filteredDecls.length} />
              </div>
            )}
          </Section>

          {/* ── HISTORIQUE ── */}
          <Section title="Historique des points" icon={Coins} count={ledgerWithBalance.length} defaultOpen={false}>
            <div className="mb-2.5 flex gap-1">
              {[
                ["all", "Tout"],
                ["gains", "+ Gains"],
                ["depenses", "- Dépenses"],
              ].map(([k, label]) => (
                <button
                  key={k}
                  onClick={() => setTxFilter(k)}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition ${
                    txFilter === k ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {ledgerWithBalance.length === 0 ? (
              <p className="py-3 text-center text-sm text-muted-foreground">Aucune transaction.</p>
            ) : (
              <div className="space-y-1">
                {ledgerPaginate.shown.map((l) => (
                  <div key={l.id} className="flex items-center gap-2 rounded-2xl bg-background px-3 py-2 text-sm">
                    <span className={`font-mono text-xs font-extrabold ${(l.amount || 0) > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"}`}>
                      {(l.amount || 0) > 0 ? "+" : ""}{(l.amount || 0).toLocaleString()}
                    </span>
                    <span className="flex-1 truncate text-xs text-muted-foreground capitalize">
                      {l.reason?.replace(/_/g, " ")}
                    </span>
                    <span className="text-[10px] text-muted-foreground/70">
                      {new Date(l.created).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
                    </span>
                  </div>
                ))}
                <ListFooter {...ledgerPaginate} total={ledgerWithBalance.length} />
              </div>
            )}
          </Section>

          {/* ── PVs ── */}
          {pvs.length > 0 && (
            <Section title="Mes procès-verbaux" icon={FileText} count={pvs.length} defaultOpen={false}>
              <div className="space-y-2">
                {pvPaginate.shown.map((p) => (
                  <div key={p.id} className="rounded-2xl border border-border/60 bg-background p-3">
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${TYPE_BADGE[p.type] || "bg-muted text-muted-foreground"}`}>
                        {TYPE_LABELS[p.type] || p.type}
                      </span>
                      <span className="text-xs font-bold">{p.pv_number}</span>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {formatDateTimeFr(p.created)}
                    </p>
                    <button
                      onClick={() => printPV(p)}
                      className="mt-2 inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-[11px] font-bold"
                    >
                      <Download className="h-3 w-3" /> Imprimer
                    </button>
                  </div>
                ))}
                <ListFooter {...pvPaginate} total={pvs.length} />
              </div>
            </Section>
          )}

          {/* ── PARRAINAGE ── */}
          <Section title="Parrainage" icon={Gift} count={referralCount} defaultOpen={false}>
            <div className="rounded-2xl bg-primary/5 p-3">
              <div className="flex items-center gap-2">
                <span className="flex-1 rounded-lg bg-muted px-3 py-2 font-mono text-sm font-extrabold tracking-wider">
                  {user?.referral_code || "—"}
                </span>
                <button
                  onClick={copyCode}
                  className="rounded-lg bg-primary p-2.5 text-white active:scale-95"
                >
                  <Copy className="h-4 w-4" />
                </button>
              </div>
              {copied && <p className="mt-1 text-xs font-bold text-accent">Copié !</p>}
              <p className="mt-2 text-[11px] text-muted-foreground">
                Partagez ce lien. Chaque inscription vous rapporte <span className="font-bold text-primary">+20 points</span>.
              </p>
            </div>
            {referrals.length > 0 && (
              <div className="mt-2 space-y-1">
                {referralPaginate.shown.map((r) => (
                  <div key={r.id} className="flex items-center gap-2 rounded-2xl bg-background px-3 py-2">
                    <Users className="h-3.5 w-3.5 shrink-0 text-accent" />
                    <span className="flex-1 truncate text-xs font-semibold">{r.name || r.email}</span>
                    <span className="text-[10px] font-bold text-primary">+20 pts</span>
                  </div>
                ))}
                <ListFooter {...referralPaginate} total={referrals.length} />
              </div>
            )}
          </Section>

          {/* ── BARÈME ── */}
          <Section title="Barème des points" icon={Star} defaultOpen={false}>
            <div className="space-y-1.5">
              {REWARDS.map((r) => (
                <div key={r.label} className="flex items-center justify-between rounded-2xl bg-background px-3 py-2">
                  <span className="text-xs text-muted-foreground">{r.label}</span>
                  <span className="font-mono text-xs font-bold text-primary">{r.points}</span>
                </div>
              ))}
            </div>
          </Section>

          {/* ── AD ── */}
          <AdSlot placement="dashboard" />
        </div>
      </PullToRefresh>
    </Layout>
  );
};

export default DashboardPage;
