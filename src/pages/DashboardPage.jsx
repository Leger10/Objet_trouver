import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  BadgeCheck,
  Bell,
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
} from "lucide-react";
import { pb } from "@/lib/supabaseClient";
import Layout from "@/components/Layout";
import PullToRefresh from "@/components/PullToRefresh";
import AdSlot from "@/components/AdSlot";
import { useAuth } from "@/contexts/AuthContext";
import { REWARDS, BADGES, getBadge, notify } from "@/lib/retrouve";
import { groupCategories, metaForSlug, groupStyle } from "@/lib/categories";
import { printPV, TYPE_LABELS, TYPE_BADGE, formatDateTimeFr } from "@/lib/pv";

const card = "rounded-2xl border border-border bg-card p-5";

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
        cin,
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
          filter: pb.filter("declaration.owner = {:u}", { u: user.id }),
          sort: "-created",
          expand: "declaration,claimant",
          requestKey: "db-claims-in",
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
          filter: pb.filter('user = {:u} && reason = "referral"', {
            u: user.id,
          }),
          requestKey: "db-ref-ledger",
        }),
        pb.collection("points_ledger").getFullList({
          filter: pb.filter("user = {:u}", { u: user.id }),
          sort: "-created",
          requestKey: "db-ledger",
        }),
        pb
          .collection("pvs")
          .getFullList({ sort: "-created", requestKey: "db-pvs" }),
      ]);
      setDeclarations(decl);
      setMatches(mts);
      setClaimsIn(cin);
      setClaimsOut(cout);
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
    } catch (_) {
      /* ignore */
    }
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

  // This-month points stats
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

  // Transaction history with running balance
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

  return (
    <Layout>
      <Helmet>
        <title>Mon espace — RetrouveMoi</title>
        <meta
          name="description"
          content="Suivez vos déclarations, correspondances, demandes de restitution, points et parrainages sur RetrouveMoi."
        />
      </Helmet>

      <PullToRefresh onRefresh={load}>
        <div className="mx-auto w-full max-w-[90rem] px-4 py-10">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold">
            Bonjour {user?.name || user?.email}
          </h1>
          <p className="mt-2 text-sm sm:text-base text-muted-foreground">
            Vos déclarations, correspondances et récompenses en un coup d'œil.
          </p>

          <div className="mt-6 sm:mt-8 grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
            <div className={`${card} bg-primary text-primary-foreground`}>
              <Coins className="h-5 w-5 sm:h-6 sm:w-6" />
              <p className="mt-2 sm:mt-3 text-2xl sm:text-3xl font-extrabold">
                {user?.points || 0}
              </p>
              <p className="text-xs sm:text-sm opacity-85">points</p>
            </div>
            <div className={card}>
              <ShieldCheck className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
              <p className="mt-2 sm:mt-3 text-2xl sm:text-3xl font-extrabold">
                {declarations.length}
              </p>
              <p className="text-xs sm:text-sm text-muted-foreground">
                déclarations
              </p>
            </div>
            <div className={card}>
              <Handshake className="h-5 w-5 sm:h-6 sm:w-6 text-accent" />
              <p className="mt-2 sm:mt-3 text-2xl sm:text-3xl font-extrabold">
                {matches.length}
              </p>
              <p className="text-xs sm:text-sm text-muted-foreground">
                correspondances
              </p>
            </div>
            <div className={card}>
              <Gift className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
              <p className="mt-2 text-xs sm:text-sm font-semibold text-muted-foreground">
                Parrainages
              </p>
              <p className="mt-1 text-2xl sm:text-3xl font-extrabold">
                {referralCount}
              </p>
              <p className="text-xs text-muted-foreground">
                <span className="font-bold text-primary">
                  {referralPoints} pts
                </span>
              </p>
            </div>
          </div>

          {/* Mes points — this month + quick actions */}
          <div className="mt-6 sm:mt-8 grid gap-4 lg:grid-cols-[1fr_1.2fr]">
            <div
              className={`${card} bg-gradient-to-br from-primary to-[hsl(199_80%_42%)] text-primary-foreground`}
            >
              <p className="flex items-center gap-2 text-sm font-semibold opacity-85">
                <Coins className="h-4 w-4" /> Mes points
              </p>
              <p className="mt-2 text-4xl font-extrabold">
                {user?.points || 0}
                <span className="text-lg font-bold opacity-80"> pts</span>
              </p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-white/15 px-3 py-2">
                  <p className="text-[11px] opacity-80">Gagnés ce mois</p>
                  <p className="font-extrabold">
                    +{monthEarned.toLocaleString()}
                  </p>
                </div>
                <div className="rounded-xl bg-white/15 px-3 py-2">
                  <p className="text-[11px] opacity-80">Dépensés ce mois</p>
                  <p className="font-extrabold">
                    -{monthSpent.toLocaleString()}
                  </p>
                </div>
              </div>
              {(() => {
                const earned = user?.points_earned || 0;
                const b = getBadge(earned);
                const next = BADGES.find((x) => earned < x.threshold);
                const pct = next
                  ? Math.min(100, Math.round((earned / next.threshold) * 100))
                  : 100;
                return (
                  <div className="mt-4">
                    {b && (
                      <p className="text-sm font-bold">
                        {b.emoji} {b.label}
                      </p>
                    )}
                    {next && (
                      <>
                        <div className="mt-1.5 h-2 rounded-full bg-white/25 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-white"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <p className="mt-1 text-[11px] opacity-80">
                          {earned} / {next.threshold} pts vers {next.label}
                        </p>
                      </>
                    )}
                  </div>
                );
              })()}
            </div>
            <div className={card}>
              <p className="text-sm font-extrabold mb-3">Actions rapides</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Link
                  to="/recompenses"
                  className="flex flex-col items-start gap-2 rounded-xl bg-secondary/60 px-4 py-3.5 transition active:scale-[0.98] hover:bg-secondary"
                >
                  <ShoppingBag className="h-5 w-5 text-primary" />
                  <span className="text-sm font-bold">Utiliser mes points</span>
                  <span className="text-xs text-muted-foreground">
                    Boutique de services
                  </span>
                </Link>
                <Link
                  to="/recompenses"
                  className="flex flex-col items-start gap-2 rounded-xl bg-muted px-4 py-3.5 transition active:scale-[0.98] hover:bg-muted/80"
                >
                  <ArrowDownToLine className="h-5 w-5 text-primary" />
                  <span className="text-sm font-bold">Retirer mes gains</span>
                  <span className="text-xs text-muted-foreground">
                    Convertir en FCFA
                  </span>
                </Link>
                <Link
                  to="/recompenses"
                  className="flex flex-col items-start gap-2 rounded-xl bg-muted px-4 py-3.5 transition active:scale-[0.98] hover:bg-muted/80"
                >
                  <History className="h-5 w-5 text-primary" />
                  <span className="text-sm font-bold">Voir l'historique</span>
                  <span className="text-xs text-muted-foreground">
                    Toutes les transactions
                  </span>
                </Link>
              </div>
            </div>
          </div>

          {/* Transaction history */}
          <div className="mt-6">
            <div className={card}>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <h2 className="text-lg font-extrabold">
                  Historique des transactions
                </h2>
                <div className="flex flex-wrap gap-1">
                  {[
                    ["all", "Tout"],
                    ["gains", "Gains"],
                    ["depenses", "Dépenses"],
                    ["retraits", "Retraits"],
                  ].map(([k, label]) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setTxFilter(k)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                        txFilter === k
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              {ledgerWithBalance.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Aucune transaction pour le moment.
                </p>
              ) : (
                <ul className="space-y-2">
                  {ledgerWithBalance.slice(0, 12).map((l) => (
                    <li
                      key={l.id}
                      className="flex items-center gap-3 rounded-xl bg-muted/40 px-4 py-3 text-sm"
                    >
                      <span
                        className={`font-mono font-extrabold ${(l.amount || 0) > 0 ? "text-accent" : "text-destructive"}`}
                      >
                        {(l.amount || 0) > 0 ? "+" : ""}
                        {(l.amount || 0).toLocaleString()}
                      </span>
                      <span className="flex-1 text-muted-foreground capitalize">
                        {l.reason?.replace(/_/g, " ")}
                      </span>
                      <span className="font-mono text-xs text-muted-foreground">
                        solde: {l.balanceAfter.toLocaleString()}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(l.created).toLocaleDateString("fr-FR")}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <Link
                to="/recompenses"
                className="mt-3 inline-block text-sm font-bold text-primary underline underline-offset-4"
              >
                Voir tout l'historique →
              </Link>
            </div>
          </div>

          <div className="mt-8 sm:mt-10 grid gap-6 sm:gap-8 lg:grid-cols-[2fr_1fr]">
            <div className="space-y-8">
              <section>
                <h2 className="text-xl font-extrabold">
                  Correspondances à vérifier
                </h2>
                {loading && (
                  <div className="mt-4 h-24 animate-pulse rounded-2xl bg-muted" />
                )}
                {!loading && matches.length === 0 && (
                  <p className="mt-3 rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
                    Aucune correspondance pour l'instant. Le moteur continue de
                    comparer chaque nouvelle déclaration.
                  </p>
                )}
                <ul className="mt-4 space-y-3">
                  {matches.map((m) => (
                    <li key={m.id} className={card}>
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="rounded-full bg-primary/10 px-3 py-1 font-mono text-sm font-bold text-primary">
                          {m.score}%
                        </span>
                        <span className="text-sm font-semibold">
                          {m.expand?.lost?.title} ↔ {m.expand?.found?.title}
                        </span>
                        <span className="ml-auto text-xs font-bold uppercase text-muted-foreground">
                          {m.status}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {Object.entries(m.breakdown || {})
                          .map(([k, v]) => `${k} ${v}`)
                          .join(" · ")}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Link
                          to={`/objet/${m.expand?.lost?.owner === user?.id ? m.found : m.lost}`}
                          className="rounded-xl border border-border px-4 py-2 text-sm font-bold"
                        >
                          Voir la déclaration
                        </Link>
                        {m.status === "suggested" && (
                          <>
                            <button
                              type="button"
                              onClick={() => updateMatch(m, "confirmed")}
                              className="rounded-xl bg-accent px-4 py-2 text-sm font-bold text-accent-foreground"
                            >
                              Confirmer (+50)
                            </button>
                            <button
                              type="button"
                              onClick={() => updateMatch(m, "rejected")}
                              className="rounded-xl border border-border px-4 py-2 text-sm font-bold"
                            >
                              Rejeter
                            </button>
                          </>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-extrabold">Demandes reçues</h2>
                {claimsIn.length === 0 ? (
                  <p className="mt-3 rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
                    Aucune demande de restitution reçue.
                  </p>
                ) : (
                  <ul className="mt-4 space-y-3">
                    {claimsIn.map((c) => (
                      <li key={c.id} className={card}>
                        <p className="font-bold">
                          {c.expand?.declaration?.title}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Réponse à la question de sécurité :{" "}
                          <span className="font-semibold text-foreground">
                            {c.answer}
                          </span>
                        </p>
                        {c.proof_note && (
                          <p className="mt-1 text-sm text-muted-foreground">
                            {c.proof_note}
                          </p>
                        )}
                        <p className="mt-2 text-xs font-bold uppercase text-muted-foreground">
                          Statut : {c.status}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {c.status === "pending" && (
                            <>
                              <button
                                type="button"
                                onClick={() => updateClaim(c, "verified")}
                                className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
                              >
                                Réponse correcte
                              </button>
                              <button
                                type="button"
                                onClick={() => updateClaim(c, "rejected")}
                                className="rounded-xl border border-border px-4 py-2 text-sm font-bold"
                              >
                                Refuser
                              </button>
                            </>
                          )}
                          {c.status === "verified" && (
                            <button
                              type="button"
                              onClick={() => updateClaim(c, "returned")}
                              className="rounded-xl bg-accent px-4 py-2 text-sm font-bold text-accent-foreground"
                            >
                              Restitution effectuée (+100)
                            </button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section>
                <h2 className="text-xl font-extrabold">Mes déclarations</h2>

                {declarations.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setCatFilter("all")}
                      className={`rounded-full px-3 py-1.5 text-xs font-bold transition active:scale-95 ${
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
                      const grouped = groupCategories(
                        Array.from(used.values()),
                      );
                      const chips = [];
                      grouped.forEach((g) => {
                        g.items.forEach((c) => {
                          const n = declarations.filter(
                            (d) => d.expand?.category?.id === c.id,
                          ).length;
                          if (n) chips.push({ c, n, group: g.key });
                        });
                      });
                      return chips.map(({ c, n, group }) => {
                        const meta = metaForSlug(c.slug);
                        const st = groupStyle(group);
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() =>
                              setCatFilter(catFilter === c.id ? "all" : c.id)
                            }
                            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition active:scale-95 ${
                              catFilter === c.id ? st.active : st.tile
                            }`}
                          >
                            <span>{meta.emoji}</span>
                            {c.name} ({n})
                          </button>
                        );
                      });
                    })()}
                  </div>
                )}

                {(() => {
                  const filtered =
                    catFilter === "all"
                      ? declarations
                      : declarations.filter(
                          (d) => d.expand?.category?.id === catFilter,
                        );
                  if (filtered.length === 0) {
                    return (
                      <p className="mt-4 rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
                        {declarations.length === 0 ? (
                          <>
                            Aucune déclaration.{" "}
                            <Link
                              to="/declarer/perdu"
                              className="font-bold text-primary"
                            >
                              Déclarer maintenant
                            </Link>
                          </>
                        ) : (
                          "Aucune déclaration dans cette catégorie."
                        )}
                      </p>
                    );
                  }
                  // regroupe par catégorie
                  const byCat = new Map();
                  filtered.forEach((d) => {
                    const key = d.expand?.category?.id || "none";
                    if (!byCat.has(key))
                      byCat.set(key, { cat: d.expand?.category, items: [] });
                    byCat.get(key).items.push(d);
                  });
                  const groups = groupCategories(
                    Array.from(byCat.values())
                      .map((v) => v.cat)
                      .filter(Boolean),
                  );
                  const ordered = [];
                  groups.forEach((g) =>
                    g.items.forEach((c) => {
                      if (byCat.has(c.id))
                        ordered.push({
                          c,
                          items: byCat.get(c.id).items,
                          group: g.key,
                        });
                    }),
                  );
                  byCat.forEach((v, key) => {
                    if (key === "none")
                      ordered.push({
                        c: null,
                        items: v.items,
                        group: "autres",
                      });
                  });

                  return (
                    <div className="mt-4 space-y-5">
                      {ordered.map(({ c, items, group }) => {
                        const meta = c
                          ? metaForSlug(c.slug)
                          : { emoji: "📦", label: "Autres" };
                        const st = groupStyle(group);
                        return (
                          <div key={c?.id || "none"}>
                            <div className="flex items-center gap-2 mb-2">
                              <span
                                className={`grid h-6 w-6 place-items-center rounded-lg ${st.soft} text-sm`}
                              >
                                {meta.emoji}
                              </span>
                              <span className="text-sm font-bold">
                                {c?.name || "Autres"}
                              </span>
                              <span className="text-xs font-semibold text-muted-foreground">
                                {items.length}
                              </span>
                            </div>
                            <ul className="space-y-2">
                              {items.map((d) => (
                                <li
                                  key={d.id}
                                  className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3"
                                >
                                  <span
                                    className={`h-2.5 w-2.5 rounded-full ${d.kind === "lost" ? "bg-destructive" : "bg-accent"}`}
                                  />
                                  <Link
                                    to={`/objet/${d.id}`}
                                    className="min-w-0 flex-1 truncate font-semibold"
                                  >
                                    {d.title}
                                  </Link>
                                  <span className="text-xs font-bold uppercase text-muted-foreground">
                                    {d.status}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </section>

              {referrals.length > 0 && (
                <section>
                  <h2 className="text-xl font-extrabold">Mes filleuls</h2>
                  <ul className="mt-4 space-y-2">
                    {referrals.map((r) => (
                      <li
                        key={r.id}
                        className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-sm"
                      >
                        <Users className="h-4 w-4 shrink-0 text-accent" />
                        <span className="min-w-0 flex-1 truncate font-semibold">
                          {r.name || r.email}
                        </span>
                        <span className="font-mono text-xs font-bold text-primary">
                          +20 pts
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {claimsOut.length > 0 && (
                <section>
                  <h2 className="text-xl font-extrabold">
                    Mes demandes envoyées
                  </h2>
                  <ul className="mt-4 space-y-2">
                    {claimsOut.map((c) => (
                      <li
                        key={c.id}
                        className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-sm"
                      >
                        <span className="min-w-0 flex-1 truncate font-semibold">
                          {c.expand?.declaration?.title}
                        </span>
                        <span className="text-xs font-bold uppercase text-muted-foreground">
                          {c.status}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <section>
                <h2 className="text-xl font-extrabold">
                  📑 Mes procès-verbaux
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Documents officiels liés à vos déclarations (dépôt ou
                  restitution).
                </p>
                {pvs.length === 0 ? (
                  <p className="mt-3 rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
                    Aucun procès-verbal pour le moment. Les PV sont établis par
                    le responsable RetrouveMoi lors d'un dépôt ou d'une
                    restitution.
                  </p>
                ) : (
                  <ul className="mt-4 space-y-2">
                    {pvs.map((p) => (
                      <li
                        key={p.id}
                        className="rounded-xl border border-border bg-card px-4 py-3 text-sm"
                      >
                        <div className="flex flex-wrap items-center gap-3">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${TYPE_BADGE[p.type] || "bg-muted text-muted-foreground"}`}
                          >
                            {TYPE_LABELS[p.type] || p.type}
                          </span>
                          <span className="min-w-0 flex-1 truncate font-semibold">
                            {p.pv_number}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatDateTimeFr(p.created)}
                          </span>
                        </div>
                        {p.object_category && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Objet :{" "}
                            <b className="text-foreground">
                              {p.object_category}
                            </b>
                          </p>
                        )}
                        <button
                          type="button"
                          onClick={() => printPV(p)}
                          className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-bold"
                        >
                          <Download className="h-3.5 w-3.5" /> Télécharger /
                          Imprimer
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>

            <div className="space-y-4">
              <AdSlot placement="dashboard" />
              <div className={card}>
                <p className="flex items-center gap-2 font-bold">
                  <Bell className="h-5 w-5 text-primary" /> Notifications
                </p>
                <ul className="mt-3 space-y-2">
                  {notifs.length === 0 && (
                    <li className="text-sm text-muted-foreground">
                      Aucune notification.
                    </li>
                  )}
                  {notifs.map((n) => (
                    <li
                      key={n.id}
                      className={`rounded-xl p-3 text-sm ${n.read ? "bg-muted/60" : "bg-secondary"}`}
                    >
                      <p className="font-bold">{n.title}</p>
                      {n.body && (
                        <p className="mt-1 text-muted-foreground">{n.body}</p>
                      )}
                      {!n.read && (
                        <button
                          type="button"
                          onClick={() => markRead(n)}
                          className="mt-2 text-xs font-bold text-primary underline"
                        >
                          Marquer comme lue
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>

              <div className={card}>
                <p className="flex items-center gap-2 font-bold">
                  <Gift className="h-5 w-5 text-primary" /> Mon code de
                  parrainage
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <span className="flex-1 rounded-lg bg-muted px-3 py-2 font-mono text-base font-extrabold tracking-wider">
                    {user?.referral_code || "—"}
                  </span>
                  <button
                    type="button"
                    onClick={copyCode}
                    className="rounded-lg border border-border p-2.5 text-sm font-bold"
                    aria-label="Copier le code"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                </div>
                {copied && (
                  <p className="mt-1 text-xs font-semibold text-accent">
                    Code copié !
                  </p>
                )}
                <p className="mt-3 text-xs text-muted-foreground font-semibold">
                  Lien de parrainage
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground font-mono">
                    {referralLink || "—"}
                  </span>
                  <button
                    type="button"
                    onClick={copyLink}
                    className="shrink-0 rounded-lg border border-border p-2.5"
                    aria-label="Copier le lien"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                </div>
                {copiedLink && (
                  <p className="mt-1 text-xs font-semibold text-accent">
                    Lien copié !
                  </p>
                )}
                <p className="mt-3 text-xs text-muted-foreground">
                  Partagez ce lien : chaque ami inscrit vous rapporte{" "}
                  <span className="font-bold text-primary">+20 points</span>.
                  Vous avez parrainé{" "}
                  <span className="font-bold">{referralCount}</span> personne
                  {referralCount !== 1 ? "s" : ""}.
                </p>
              </div>

              <div className={card}>
                <p className="flex items-center gap-2 font-bold">
                  <BadgeCheck className="h-5 w-5 text-accent" /> Statut &
                  récompenses
                </p>
                {(() => {
                  const earned = user?.points_earned || 0;
                  const badge = getBadge(earned);
                  const next = BADGES.find((b) => earned < b.threshold);
                  const pct = next
                    ? Math.min(100, Math.round((earned / next.threshold) * 100))
                    : 100;
                  return (
                    <div className="mt-3">
                      {badge && (
                        <div className="flex items-center gap-2 rounded-xl bg-secondary px-3 py-2 mb-3">
                          <span className="text-xl">{badge.emoji}</span>
                          <span className="font-bold text-sm">
                            {badge.label}
                          </span>
                        </div>
                      )}
                      {next && (
                        <div className="mb-3">
                          <p className="text-xs text-muted-foreground mb-1">
                            Vers {next.emoji} {next.label}
                          </p>
                          <div className="h-2 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full bg-primary"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {earned} / {next.threshold} pts
                          </p>
                        </div>
                      )}
                      <Link
                        to="/recompenses"
                        className="block w-full rounded-xl bg-primary text-center text-sm font-bold text-primary-foreground py-2.5 mt-2"
                      >
                        Boutique de points
                      </Link>
                      <Link
                        to="/classement"
                        className="mt-2 inline-block text-sm font-bold text-primary underline underline-offset-4"
                      >
                        Voir le classement
                      </Link>
                    </div>
                  );
                })()}
              </div>
              <div className={card}>
                <p className="flex items-center gap-2 font-bold">
                  <BadgeCheck className="h-5 w-5 text-accent" /> Barème des
                  points
                </p>
                <ul className="mt-3 space-y-2 text-sm">
                  {REWARDS.map((r) => (
                    <li key={r.label} className="flex justify-between gap-3">
                      <span className="text-muted-foreground">{r.label}</span>
                      <span className="font-mono font-bold text-primary">
                        {r.points}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </PullToRefresh>
    </Layout>
  );
};

export default DashboardPage;
