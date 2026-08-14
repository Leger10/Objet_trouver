import React, { useCallback, useEffect, useState } from "react";
import { Helmet } from "react-helmet";
import { Link } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import { FileText, FileCheck2, Printer, Download } from "lucide-react";
import { pb } from "@/lib/supabaseClient";
import Layout from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { printPV, TYPE_LABELS, TYPE_BADGE, formatDateTimeFr } from "@/lib/pv";
import BrandLogo from "@/components/BrandLogo";
import { useBranding } from "@/contexts/BrandingContext";
import { Palette } from "lucide-react";

const card = "rounded-2xl border border-border bg-card p-5";

const AdminPage = () => {
  const { user } = useAuth();
  const { branding } = useBranding();
  const isAdmin = user?.role === "admin";
  const [stats, setStats] = useState({
    lost: 0,
    found: 0,
    returned: 0,
    users: 0,
    categories: 0,
    donations: 0,
    donationTotal: 0,
  });
  const [declarations, setDeclarations] = useState([]);
  const [reports, setReports] = useState([]);
  const [donations, setDonations] = useState([]);
  const [methodStats, setMethodStats] = useState({
    orange_money: { count: 0, total: 0 },
    move_money: { count: 0, total: 0 },
    wave: { count: 0, total: 0 },
    card: { count: 0, total: 0 },
    bank_transfer: { count: 0, total: 0 },
    other: { count: 0, total: 0 },
  });
  const [phoneStats, setPhoneStats] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [payments, setPayments] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [proAccounts, setProAccounts] = useState([]);
  const [adEvents, setAdEvents] = useState([]);
  const [pvs, setPvs] = useState([]);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!isAdmin) {
      setLoading(false);

      return;
    }
    try {
      const [
        lost,
        found,
        returned,
        users,
        cats,
        decl,
        rep,
        dons,
        totals,
        wds,
        prc,
        pays,
        subs,
        pros,
        ads,
        pvList,
      ] = await Promise.all([
        pb
          .collection("declarations")
          .getList(1, 1, { filter: 'kind = "lost"', requestKey: "a1" }),
        pb
          .collection("declarations")
          .getList(1, 1, { filter: 'kind = "found"', requestKey: "a2" }),
        pb
          .collection("declarations")
          .getList(1, 1, { filter: 'status = "returned"', requestKey: "a3" }),
        pb.collection("users").getList(1, 1, { requestKey: "a4" }),
        pb.collection("categories").getList(1, 1, { requestKey: "a5" }),
        pb
          .collection("declarations")
          .getList(1, 30, {
            sort: "-created",
            expand: "category",
            requestKey: "a6",
          }),
        pb
          .collection("reports")
          .getFullList({
            sort: "-created",
            expand: "declaration",
            requestKey: "a7",
          }),
        pb
          .collection("donations")
          .getList(1, 30, { sort: "-created", requestKey: "a8" }),
        pb
          .collection("donation_totals")
          .getFirstListItem("label = 'global'")
          .catch(() => null),
        pb
          .collection("withdrawals")
          .getFullList({ sort: "-created", expand: "user", requestKey: "a9" }),
        pb
          .collection("point_purchases")
          .getFullList({ sort: "-created", requestKey: "a10" }),
        pb
          .collection("payments")
          .getFullList({ sort: "-created", expand: "user", requestKey: "a11" }),
        pb
          .collection("subscriptions")
          .getFullList({ sort: "-created", expand: "user", requestKey: "a12" }),
        pb
          .collection("pro_accounts")
          .getFullList({
            sort: "-created",
            expand: "owner",
            requestKey: "a13",
          }),
        pb
          .collection("ad_events")
          .getFullList({ sort: "-created", requestKey: "a14" }),
        pb
          .collection("pvs")
          .getFullList({
            sort: "-created",
            expand: "generated_by,related_declaration",
            requestKey: "a15",
          }),
      ]);
      setStats({
        lost: lost.totalItems,
        found: found.totalItems,
        returned: returned.totalItems,
        users: users.totalItems,
        categories: cats.totalItems,
        donations: dons.totalItems,
        donationTotal: totals?.total_fcfa || 0,
      });
      setDeclarations(decl.items);
      setReports(rep);
      setDonations(dons.items);
      const byMethod = {
        orange_money: { count: 0, total: 0 },
        move_money: { count: 0, total: 0 },
        wave: { count: 0, total: 0 },
        card: { count: 0, total: 0 },
        bank_transfer: { count: 0, total: 0 },
        other: { count: 0, total: 0 },
      };
      dons.items.forEach((d) => {
        const key =
          d.payment_method && byMethod[d.payment_method]
            ? d.payment_method
            : "other";
        byMethod[key].count += 1;
        byMethod[key].total += d.amount_fcfa || 0;
      });
      setMethodStats(byMethod);
      const byPhone = {};
      dons.items.forEach((d) => {
        const key = (d.donor_phone || "").trim();
        if (!key) return;
        if (!byPhone[key])
          byPhone[key] = { phone: key, count: 0, total: 0, name: d.donor_name };
        byPhone[key].count += 1;
        byPhone[key].total += d.amount_fcfa || 0;
      });
      setPhoneStats(Object.values(byPhone).sort((a, b) => b.total - a.total));
      setWithdrawals(wds || []);
      setPurchases(prc || []);
      setPayments(pays || []);
      setSubscriptions(subs || []);
      setProAccounts(pros || []);
      setAdEvents(ads || []);
      setPvs(pvList || []);
    } catch (_) {
      setDeclarations([]);
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    load();
  }, [load]);

  const setStatus = async (d, status) => {
    try {
      await pb.collection("declarations").update(d.id, { status });
      load();
    } catch (_) {
      /* ignore */
    }
  };

  const setReportStatus = async (r, status) => {
    try {
      await pb.collection("reports").update(r.id, { status });
      load();
    } catch (_) {
      /* ignore */
    }
  };

  const setWithdrawalStatus = async (w, status, reason = "") => {
    try {
      const payload = { status };
      if (status === "rejected" && reason) payload.rejection_reason = reason;
      await pb.collection("withdrawals").update(w.id, payload);
      load();
    } catch (_) {
      /* ignore */
    }
  };

  const confirmReject = async () => {
    if (rejectTarget) {
      await setWithdrawalStatus(
        rejectTarget,
        "rejected",
        rejectReason.trim() || "Non conforme",
      );
    }
    setRejectTarget(null);
    setRejectReason("");
  };

  const setPaymentStatus = async (p, status) => {
    try {
      await pb.collection("payments").update(p.id, { status });
      load();
    } catch (_) {
      /* ignore */
    }
  };

  const setProAccountStatus = async (pa, status) => {
    try {
      await pb.collection("pro_accounts").update(pa.id, { status });
      load();
    } catch (_) {
      /* ignore */
    }
  };

  // ── Finance computations ────────────────────────────────────────────────
  const confirmedPayments = payments.filter((p) => p.status === "confirmed");
  const revenueBySource = {
    subscription: confirmedPayments
      .filter((p) => p.type === "subscription")
      .reduce((s, p) => s + (p.amount_fcfa || 0), 0),
    service: confirmedPayments
      .filter((p) => p.type === "service")
      .reduce((s, p) => s + (p.amount_fcfa || 0), 0),
    pro_account: confirmedPayments
      .filter((p) => p.type === "pro_account")
      .reduce((s, p) => s + (p.amount_fcfa || 0), 0),
    donation: stats.donationTotal,
    commission: withdrawals
      .filter((w) => w.status === "paid")
      .reduce((s, w) => s + (w.commission_fcfa || 0), 0),
  };
  const totalRevenue = Object.values(revenueBySource).reduce(
    (s, n) => s + n,
    0,
  );

  const activeSubs = subscriptions.filter((s) => s.status === "active");
  const premiumCount = activeSubs.filter((s) => s.plan === "premium").length;
  const proCount = activeSubs.filter((s) => s.plan === "pro").length;
  const subRevenue = revenueBySource.subscription;
  const cancelledSubs = subscriptions.filter(
    (s) => s.status === "cancelled",
  ).length;
  const churnRate =
    subscriptions.length > 0
      ? Math.round((cancelledSubs / subscriptions.length) * 100)
      : 0;

  // Service revenue breakdown
  const serviceRevenueMap = {};
  confirmedPayments
    .filter((p) => p.type === "service")
    .forEach((p) => {
      if (!serviceRevenueMap[p.item_key])
        serviceRevenueMap[p.item_key] = {
          count: 0,
          total: 0,
          label: p.item_label || p.item_key,
        };
      serviceRevenueMap[p.item_key].count += 1;
      serviceRevenueMap[p.item_key].total += p.amount_fcfa || 0;
    });

  // Pro accounts
  const activeProAccounts = proAccounts.filter((p) => p.status === "active");
  const proRevenue = revenueBySource.pro_account;
  const orgTypeCounts = {};
  proAccounts.forEach((p) => {
    orgTypeCounts[p.org_type] = (orgTypeCounts[p.org_type] || 0) + 1;
  });

  // Commissions
  const paidWithdrawals = withdrawals.filter((w) => w.status === "paid");
  const totalCommission = paidWithdrawals.reduce(
    (s, w) => s + (w.commission_fcfa || 0),
    0,
  );
  const avgWithdrawal =
    paidWithdrawals.length > 0
      ? Math.round(
          paidWithdrawals.reduce((s, w) => s + (w.amount_fcfa || 0), 0) /
            paidWithdrawals.length,
        )
      : 0;

  // Ads
  const impressions = adEvents.filter((a) => a.type === "impression").length;
  const clicks = adEvents.filter((a) => a.type === "click").length;
  const ctr =
    impressions > 0 ? ((clicks / impressions) * 100).toFixed(2) : "0.00";
  const pendingPayments = payments.filter((p) => p.status === "pending");

  // Withdrawal stats
  const pendingWithdrawals = withdrawals.filter((w) => w.status === "pending");
  const pendingTotal = pendingWithdrawals.reduce(
    (s, w) => s + (w.amount_fcfa || 0),
    0,
  );
  const paidTotal = withdrawals
    .filter((w) => w.status === "paid")
    .reduce((s, w) => s + (w.amount_fcfa || 0), 0);

  // Points usage stats
  const serviceCounts = {};
  let totalPointsSpent = 0;
  purchases.forEach((p) => {
    serviceCounts[p.service] = (serviceCounts[p.service] || 0) + 1;
    totalPointsSpent += p.points_cost || 0;
  });
  const topServices = Object.entries(serviceCounts)
    .map(([k, n]) => ({ key: k, count: n }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  const SERVICE_LABELS = {
    alerts_priority: "Alertes prioritaires",
    listing_boost: "Mise en avant",
    advanced_search: "Recherche avancée",
    verified_profile: "Profil vérifié",
    priority_post: "Publication prioritaire",
    daily_limit_boost: "Déclarations illimitées",
    advanced_filters: "Filtres avancés",
    detailed_stats: "Statistiques détaillées",
    visibility_boost: "Visibilité accrue",
  };

  if (!isAdmin) {
    return (
      <Layout>
        <Helmet>
          <title>Administration — {branding.app_name}</title>
          <meta
            name="description"
            content={`Espace de modération réservé aux administrateurs ${branding.app_name}.`}
          />
        </Helmet>
        <div className="mx-auto max-w-md px-4 py-20 text-center">
          <ShieldAlert className="mx-auto h-10 w-10 text-destructive" />
          <p className="mt-4 text-lg font-bold">
            Accès réservé aux administrateurs
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Votre compte n&apos;a pas le rôle « admin ». Contactez l&apos;équipe{" "}
            {branding.app_name}.
          </p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <Helmet>
        <title>Administration — {branding.app_name}</title>
        <meta
          name="description"
          content={`Tableau de bord de modération ${branding.app_name} : statistiques, déclarations, signalements et branding.`}
        />
      </Helmet>

      <div className="mx-auto w-full max-w-[90rem] px-4 py-10">
        <div className="flex flex-wrap items-center gap-4 justify-between">
          <div className="flex items-center gap-3">
            <BrandLogo size="md" linkToHome={false} imgClassName="rounded-xl" />
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold">
                Administration
              </h1>
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                {branding.app_name}
              </p>
            </div>
          </div>
          <Link
            to="/admin/branding"
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-bold active:scale-[0.98]"
          >
            <Palette className="h-4 w-4 text-primary" /> Branding
          </Link>
        </div>

        <div className="mt-6 sm:mt-8 grid gap-3 sm:gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
          {[
            ["Objets égarés", stats.lost],
            ["Objets retrouvés", stats.found],
            ["Restitutions", stats.returned],
            ["Membres", stats.users],
            ["Catégories", stats.categories],
            ["Donateurs", stats.donations],
          ].map(([k, v]) => (
            <div key={k} className={card}>
              <p className="text-3xl font-extrabold">{v}</p>
              <p className="text-sm text-muted-foreground">{k}</p>
            </div>
          ))}
        </div>

        <section className="mt-10">
          <h2 className="text-xl font-extrabold">Signalements</h2>
          {reports.length === 0 ? (
            <p className="mt-3 rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
              Aucun signalement en attente.
            </p>
          ) : (
            <ul className="mt-4 space-y-2">
              {reports.map((r) => (
                <li
                  key={r.id}
                  className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-sm"
                >
                  <span className="min-w-0 flex-1 truncate font-semibold">
                    {r.expand?.declaration?.title || "Déclaration supprimée"}
                  </span>
                  <span className="text-xs font-bold uppercase text-muted-foreground">
                    {r.status}
                  </span>
                  <button
                    type="button"
                    onClick={() => setReportStatus(r, "reviewed")}
                    className="rounded-lg border border-border px-3 py-1.5 font-bold"
                  >
                    Traité
                  </button>
                  <button
                    type="button"
                    onClick={() => setReportStatus(r, "blocked")}
                    className="rounded-lg bg-destructive px-3 py-1.5 font-bold text-destructive-foreground"
                  >
                    Bloquer
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-10">
          <h2 className="text-xl font-extrabold">Donations</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className={card}>
              <p className="text-3xl font-extrabold text-primary">
                {stats.donationTotal.toLocaleString("fr-FR")} FCFA
              </p>
              <p className="text-sm text-muted-foreground">
                Montant total collecté
              </p>
            </div>
            <div className={card}>
              <p className="text-3xl font-extrabold">{stats.donations}</p>
              <p className="text-sm text-muted-foreground">
                Nombre de donateurs
              </p>
            </div>
          </div>

          {/* Répartition par méthode de paiement */}
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {[
              ["orange_money", "Orange Money", "bg-[hsl(22_90%_50%)]"],
              ["move_money", "Move Money", "bg-[hsl(262_70%_52%)]"],
              ["wave", "Wave", "bg-[hsl(199_90%_45%)]"],
            ].map(([key, label, dot]) => (
              <div key={key} className={card}>
                <div className="flex items-center gap-2">
                  <span className={`h-3 w-3 rounded-full ${dot}`} />
                  <p className="text-sm font-extrabold">{label}</p>
                </div>
                <p className="mt-2 text-2xl font-extrabold">
                  {methodStats[key].total.toLocaleString("fr-FR")} FCFA
                </p>
                <p className="text-xs text-muted-foreground">
                  {methodStats[key].count} don
                  {methodStats[key].count > 1 ? "s" : ""}
                </p>
              </div>
            ))}
          </div>

          {donations.length === 0 ? (
            <p className="mt-3 rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
              Aucune donation pour le moment.
            </p>
          ) : (
            <ul className="mt-4 space-y-2">
              {donations.map((d) => {
                const mLabel =
                  d.payment_method === "orange_money"
                    ? "Orange Money"
                    : d.payment_method === "move_money"
                      ? "Move Money"
                      : d.payment_method === "wave"
                        ? "Wave"
                        : d.payment_method;
                const mColor =
                  d.payment_method === "orange_money"
                    ? "bg-[hsl(22_90%_50%)]"
                    : d.payment_method === "move_money"
                      ? "bg-[hsl(262_70%_52%)]"
                      : d.payment_method === "wave"
                        ? "bg-[hsl(199_90%_45%)]"
                        : "bg-muted";
                return (
                  <li
                    key={d.id}
                    className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-sm"
                  >
                    <span className={`h-2.5 w-2.5 rounded-full ${mColor}`} />
                    <span className="min-w-0 flex-1 truncate font-semibold">
                      {d.donor_name}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {d.donor_phone || "—"}
                    </span>
                    <span className="font-extrabold text-primary">
                      {(d.amount_fcfa || 0).toLocaleString("fr-FR")} FCFA
                    </span>
                    <span className="text-xs font-bold uppercase text-muted-foreground">
                      {mLabel}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${d.status === "completed" ? "bg-accent/15 text-accent" : "bg-muted text-muted-foreground"}`}
                    >
                      {d.status}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}

          {/* Donations par numéro de téléphone */}
          {phoneStats.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-extrabold">
                Donations par numéro de dépôt
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Vérifiez les numéros ayant effectué un dépôt pour confirmer les
                transactions.
              </p>
              <ul className="mt-3 space-y-2">
                {phoneStats.map((p) => (
                  <li
                    key={p.phone}
                    className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-background px-4 py-3 text-sm"
                  >
                    <span className="min-w-0 flex-1 truncate font-bold">
                      {p.phone}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {p.name}
                    </span>
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">
                      {p.count} don{p.count > 1 ? "s" : ""}
                    </span>
                    <span className="font-extrabold text-primary">
                      {p.total.toLocaleString("fr-FR")} FCFA
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {/* Retraits de points */}
        <section className="mt-10">
          <h2 className="text-xl font-extrabold">Retraits de points</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div className={card}>
              <p className="text-3xl font-extrabold text-primary">
                {pendingTotal.toLocaleString("fr-FR")} FCFA
              </p>
              <p className="text-sm text-muted-foreground">
                Montant en attente
              </p>
            </div>
            <div className={card}>
              <p className="text-3xl font-extrabold">
                {pendingWithdrawals.length}
              </p>
              <p className="text-sm text-muted-foreground">
                Retraits à traiter
              </p>
            </div>
            <div className={card}>
              <p className="text-3xl font-extrabold text-accent">
                {paidTotal.toLocaleString("fr-FR")} FCFA
              </p>
              <p className="text-sm text-muted-foreground">Total payé</p>
            </div>
          </div>

          {withdrawals.length === 0 ? (
            <p className="mt-3 rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
              Aucun retrait pour le moment.
            </p>
          ) : (
            <ul className="mt-4 space-y-2">
              {withdrawals.map((w) => (
                <li
                  key={w.id}
                  className="rounded-xl border border-border bg-card px-4 py-3 text-sm"
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="min-w-0 flex-1 truncate font-semibold">
                      {w.expand?.user?.name ||
                        w.expand?.user?.email ||
                        "Utilisateur"}
                    </span>
                    <span className="font-extrabold text-primary">
                      {(w.amount_fcfa || 0).toLocaleString("fr-FR")} FCFA
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {w.payment_method}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                        w.status === "paid"
                          ? "bg-accent/15 text-accent"
                          : w.status === "rejected"
                            ? "bg-destructive/15 text-destructive"
                            : w.status === "approved"
                              ? "bg-primary/15 text-primary"
                              : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {w.status}
                    </span>
                  </div>
                  {w.status === "pending" && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setWithdrawalStatus(w, "approved")}
                        className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground"
                      >
                        Approuver
                      </button>
                      <button
                        type="button"
                        onClick={() => setWithdrawalStatus(w, "paid")}
                        className="rounded-lg bg-accent px-3 py-1.5 text-xs font-bold text-accent-foreground"
                      >
                        Marquer payé
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setRejectTarget(w);
                          setRejectReason("");
                        }}
                        className="rounded-lg bg-destructive px-3 py-1.5 text-xs font-bold text-destructive-foreground"
                      >
                        Refuser
                      </button>
                    </div>
                  )}
                  {w.status === "approved" && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setWithdrawalStatus(w, "paid")}
                        className="rounded-lg bg-accent px-3 py-1.5 text-xs font-bold text-accent-foreground"
                      >
                        Marquer payé
                      </button>
                    </div>
                  )}
                  {w.rejection_reason && (
                    <p className="mt-2 text-xs text-destructive">
                      Raison : {w.rejection_reason}
                    </p>
                  )}
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {new Date(w.created).toLocaleDateString("fr-FR")}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Utilisation des points */}
        <section className="mt-10">
          <h2 className="text-xl font-extrabold">Utilisation des points</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className={card}>
              <p className="text-3xl font-extrabold text-primary">
                {totalPointsSpent.toLocaleString("fr-FR")} pts
              </p>
              <p className="text-sm text-muted-foreground">
                Total dépensé en services
              </p>
            </div>
            <div className={card}>
              <p className="text-3xl font-extrabold">{purchases.length}</p>
              <p className="text-sm text-muted-foreground">
                Achats de services
              </p>
            </div>
          </div>
          {topServices.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-bold mb-2">
                Services les plus achetés
              </p>
              <ul className="space-y-2">
                {topServices.map((s) => (
                  <li
                    key={s.key}
                    className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-sm"
                  >
                    <span className="flex-1 font-semibold">
                      {SERVICE_LABELS[s.key] || s.key}
                    </span>
                    <span className="font-mono font-extrabold text-primary">
                      {s.count} achat{s.count > 1 ? "s" : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {/* ═══════════════ FINANCES ═══════════════ */}

        {/* Revenus totaux */}
        <section className="mt-10">
          <h2 className="text-xl font-extrabold">💰 Revenus</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className={`${card} bg-primary text-primary-foreground`}>
              <p className="text-3xl font-extrabold">
                {totalRevenue.toLocaleString("fr-FR")} FCFA
              </p>
              <p className="text-sm opacity-85">Revenus totaux</p>
            </div>
            <div className={card}>
              <p className="text-2xl font-extrabold text-accent">
                {revenueBySource.subscription.toLocaleString("fr-FR")} FCFA
              </p>
              <p className="text-sm text-muted-foreground">Abonnements</p>
            </div>
            <div className={card}>
              <p className="text-2xl font-extrabold text-accent">
                {revenueBySource.service.toLocaleString("fr-FR")} FCFA
              </p>
              <p className="text-sm text-muted-foreground">
                Services à la carte
              </p>
            </div>
            <div className={card}>
              <p className="text-2xl font-extrabold text-accent">
                {revenueBySource.pro_account.toLocaleString("fr-FR")} FCFA
              </p>
              <p className="text-sm text-muted-foreground">
                Comptes professionnels
              </p>
            </div>
            <div className={card}>
              <p className="text-2xl font-extrabold text-accent">
                {revenueBySource.donation.toLocaleString("fr-FR")} FCFA
              </p>
              <p className="text-sm text-muted-foreground">Dons</p>
            </div>
            <div className={card}>
              <p className="text-2xl font-extrabold text-accent">
                {revenueBySource.commission.toLocaleString("fr-FR")} FCFA
              </p>
              <p className="text-sm text-muted-foreground">Commissions (5%)</p>
            </div>
          </div>
        </section>

        {/* Paiements à confirmer */}
        <section className="mt-10">
          <h2 className="text-xl font-extrabold">✅ Paiements à confirmer</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Confirmez le paiement pour activer automatiquement le service,
            l'abonnement ou le compte pro.
          </p>
          {pendingPayments.length === 0 ? (
            <p className="mt-3 rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
              Aucun paiement en attente.
            </p>
          ) : (
            <ul className="mt-4 space-y-2">
              {pendingPayments.map((p) => (
                <li
                  key={p.id}
                  className="rounded-xl border border-border bg-card px-4 py-3 text-sm"
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="min-w-0 flex-1 truncate font-semibold">
                      {p.expand?.user?.name ||
                        p.expand?.user?.email ||
                        "Utilisateur"}{" "}
                      — {p.item_label}
                    </span>
                    <span className="font-extrabold text-primary">
                      {(p.amount_fcfa || 0).toLocaleString("fr-FR")} FCFA
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {p.payment_method}
                    </span>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase text-muted-foreground">
                      {p.type}
                    </span>
                  </div>
                  {p.description && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {p.description}
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setPaymentStatus(p, "confirmed")}
                      className="rounded-lg bg-accent px-3 py-1.5 text-xs font-bold text-accent-foreground"
                    >
                      Confirmer & activer
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentStatus(p, "failed")}
                      className="rounded-lg bg-destructive px-3 py-1.5 text-xs font-bold text-destructive-foreground"
                    >
                      Échec
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Abonnements */}
        <section className="mt-10">
          <h2 className="text-xl font-extrabold">🎟️ Abonnements</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className={card}>
              <p className="text-3xl font-extrabold text-primary">
                {premiumCount}
              </p>
              <p className="text-sm text-muted-foreground">Abonnés Premium</p>
            </div>
            <div className={card}>
              <p className="text-3xl font-extrabold text-primary">{proCount}</p>
              <p className="text-sm text-muted-foreground">Abonnés Pro</p>
            </div>
            <div className={card}>
              <p className="text-3xl font-extrabold text-accent">
                {subRevenue.toLocaleString("fr-FR")} FCFA
              </p>
              <p className="text-sm text-muted-foreground">
                Revenus abonnements
              </p>
            </div>
            <div className={card}>
              <p className="text-3xl font-extrabold">{churnRate}%</p>
              <p className="text-sm text-muted-foreground">Taux de churn</p>
            </div>
          </div>
        </section>

        {/* Services payants (FCFA) */}
        <section className="mt-10">
          <h2 className="text-xl font-extrabold">🛒 Services payants (FCFA)</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className={card}>
              <p className="text-3xl font-extrabold text-primary">
                {revenueBySource.service.toLocaleString("fr-FR")} FCFA
              </p>
              <p className="text-sm text-muted-foreground">Revenus services</p>
            </div>
            <div className={card}>
              <p className="text-3xl font-extrabold">
                {confirmedPayments.filter((p) => p.type === "service").length}
              </p>
              <p className="text-sm text-muted-foreground">
                Transactions confirmées
              </p>
            </div>
          </div>
          {Object.keys(serviceRevenueMap).length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-bold mb-2">Revenus par service</p>
              <ul className="space-y-2">
                {Object.entries(serviceRevenueMap).map(([key, v]) => (
                  <li
                    key={key}
                    className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-sm"
                  >
                    <span className="flex-1 font-semibold">{v.label}</span>
                    <span className="text-xs text-muted-foreground">
                      {v.count}x
                    </span>
                    <span className="font-mono font-extrabold text-primary">
                      {v.total.toLocaleString("fr-FR")} FCFA
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {/* Comptes professionnels */}
        <section className="mt-10">
          <h2 className="text-xl font-extrabold">🏛️ Comptes professionnels</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div className={card}>
              <p className="text-3xl font-extrabold text-primary">
                {activeProAccounts.length}
              </p>
              <p className="text-sm text-muted-foreground">Comptes actifs</p>
            </div>
            <div className={card}>
              <p className="text-3xl font-extrabold text-accent">
                {proRevenue.toLocaleString("fr-FR")} FCFA
              </p>
              <p className="text-sm text-muted-foreground">
                Revenus comptes pro
              </p>
            </div>
            <div className={card}>
              <p className="text-3xl font-extrabold">{proAccounts.length}</p>
              <p className="text-sm text-muted-foreground">Total demandes</p>
            </div>
          </div>
          {proAccounts.length > 0 && (
            <ul className="mt-4 space-y-2">
              {proAccounts.map((pa) => (
                <li
                  key={pa.id}
                  className="rounded-xl border border-border bg-card px-4 py-3 text-sm"
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="min-w-0 flex-1 truncate font-semibold">
                      {pa.org_name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {pa.org_type} · {pa.plan}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                        pa.status === "active"
                          ? "bg-accent/15 text-accent"
                          : pa.status === "suspended"
                            ? "bg-destructive/15 text-destructive"
                            : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {pa.status}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {pa.status !== "active" && (
                      <button
                        type="button"
                        onClick={() => setProAccountStatus(pa, "active")}
                        className="rounded-lg bg-accent px-3 py-1.5 text-xs font-bold text-accent-foreground"
                      >
                        Activer
                      </button>
                    )}
                    {pa.status === "active" && (
                      <button
                        type="button"
                        onClick={() => setProAccountStatus(pa, "suspended")}
                        className="rounded-lg bg-destructive px-3 py-1.5 text-xs font-bold text-destructive-foreground"
                      >
                        Suspendre
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Commissions */}
        <section className="mt-10">
          <h2 className="text-xl font-extrabold">
            📊 Commissions sur retraits
          </h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div className={card}>
              <p className="text-3xl font-extrabold text-primary">
                {totalCommission.toLocaleString("fr-FR")} FCFA
              </p>
              <p className="text-sm text-muted-foreground">
                Commissions collectées
              </p>
            </div>
            <div className={card}>
              <p className="text-3xl font-extrabold">
                {paidWithdrawals.length}
              </p>
              <p className="text-sm text-muted-foreground">Retraits payés</p>
            </div>
            <div className={card}>
              <p className="text-3xl font-extrabold">
                {avgWithdrawal.toLocaleString("fr-FR")} FCFA
              </p>
              <p className="text-sm text-muted-foreground">
                Montant moyen / retrait
              </p>
            </div>
          </div>
        </section>

        {/* Publicité */}
        <section className="mt-10">
          <h2 className="text-xl font-extrabold">📣 Publicité</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div className={card}>
              <p className="text-3xl font-extrabold text-primary">
                {impressions.toLocaleString("fr-FR")}
              </p>
              <p className="text-sm text-muted-foreground">Impressions</p>
            </div>
            <div className={card}>
              <p className="text-3xl font-extrabold text-primary">
                {clicks.toLocaleString("fr-FR")}
              </p>
              <p className="text-sm text-muted-foreground">Clics</p>
            </div>
            <div className={card}>
              <p className="text-3xl font-extrabold text-accent">{ctr}%</p>
              <p className="text-sm text-muted-foreground">
                CTR (click-through rate)
              </p>
            </div>
          </div>
        </section>

        {/* Procès-verbaux */}
        <section className="mt-10">
          <h2 className="text-xl font-extrabold">📑 Procès-verbaux</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div className={card}>
              <p className="text-3xl font-extrabold text-primary">
                {pvs.length}
              </p>
              <p className="text-sm text-muted-foreground">Total PV générés</p>
            </div>
            <div className={card}>
              <p className="text-3xl font-extrabold text-accent">
                {pvs.filter((p) => p.type === "deposit").length}
              </p>
              <p className="text-sm text-muted-foreground">
                Dépôts d'objets trouvés
              </p>
            </div>
            <div className={card}>
              <p className="text-3xl font-extrabold text-accent">
                {pvs.filter((p) => p.type === "restitution").length}
              </p>
              <p className="text-sm text-muted-foreground">Restitutions</p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              to="/pv-depot"
              className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground active:scale-[0.98]"
            >
              <FileText className="h-4 w-4" /> Nouveau PV de dépôt
            </Link>
            <Link
              to="/pv-restitution"
              className="flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-bold text-accent-foreground active:scale-[0.98]"
            >
              <FileCheck2 className="h-4 w-4" /> Nouveau PV de restitution
            </Link>
          </div>

          {pvs.length === 0 ? (
            <p className="mt-3 rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
              Aucun procès-verbal généré pour le moment.
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
                    <span className="truncate text-xs text-muted-foreground">
                      {p.signatory_name || "—"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDateTimeFr(p.created)}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span>
                      Objet :{" "}
                      <b className="text-foreground">
                        {p.object_category || "—"}
                      </b>
                    </span>
                    <span>
                      Généré par :{" "}
                      <b className="text-foreground">
                        {p.expand?.generated_by?.name ||
                          p.expand?.generated_by?.email ||
                          "—"}
                      </b>
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => printPV(p)}
                      className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-bold"
                    >
                      <Printer className="h-3.5 w-3.5" /> Imprimer
                    </button>
                    <button
                      type="button"
                      onClick={() => printPV(p)}
                      className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-bold"
                    >
                      <Download className="h-3.5 w-3.5" /> Télécharger le PDF
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-10">
          <h2 className="text-xl font-extrabold">
            Modération des déclarations
          </h2>
          {loading && (
            <div className="mt-4 h-24 animate-pulse rounded-2xl bg-muted" />
          )}
          <ul className="mt-4 space-y-2">
            {declarations.map((d) => (
              <li
                key={d.id}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-sm"
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
                <span className="text-xs text-muted-foreground">
                  {d.expand?.category?.name}
                </span>
                <span className="text-xs font-bold uppercase text-muted-foreground">
                  {d.status}
                </span>
                {d.status !== "blocked" ? (
                  <button
                    type="button"
                    onClick={() => setStatus(d, "blocked")}
                    className="rounded-lg bg-destructive px-3 py-1.5 font-bold text-destructive-foreground"
                  >
                    Bloquer
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setStatus(d, "open")}
                    className="rounded-lg border border-border px-3 py-1.5 font-bold"
                  >
                    Republier
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* Rejection reason dialog */}
      {rejectTarget && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4"
          onClick={() => setRejectTarget(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-card p-6 sheet-up"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="font-extrabold text-lg mb-1">Refuser le retrait</p>
            <p className="text-sm text-muted-foreground mb-4">
              {rejectTarget.amount_fcfa?.toLocaleString("fr-FR")} FCFA — les
              points seront restitués à l'utilisateur.
            </p>
            <label className="text-sm font-semibold mb-1 block">
              Raison du refus
            </label>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="ex : Numéro de téléphone invalide"
              rows={3}
              className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm outline-none focus:border-primary"
            />
            <div className="mt-4 flex gap-3">
              <button
                type="button"
                onClick={() => setRejectTarget(null)}
                className="flex-1 rounded-xl border border-border px-4 py-3 text-sm font-bold"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={confirmReject}
                className="flex-1 rounded-xl bg-destructive px-4 py-3 text-sm font-bold text-destructive-foreground"
              >
                Confirmer le refus
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default AdminPage;
