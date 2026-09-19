import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { pb } from "@/lib/pbClient";
import Layout from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { usePaginate, ListFooter, EmptyState } from "@/components/PaginatedList";
import {
  downloadPV,
  TYPE_LABELS,
  TYPE_BADGE,
  formatDateTimeFr,
} from "@/lib/pv";
import { bulkRematch, isServiceActive, notify } from "@/lib/retrouve";
import BrandLogo from "@/components/BrandLogo";
import { useBranding } from "@/contexts/BrandingContext";
import TabStats from "@/views/TabStats";
import {
  ShieldAlert,
  Users as UsersIcon,
  Shield,
  ShieldOff,
  KeyRound,
  Loader2,
  FileText,
  FileCheck2,
  Download,
  Palette,
  Megaphone,
  Image,
  ScanLine,
  Coins,
  TrendingUp,
  CreditCard,
  BarChart3,
  Users,
  FileCheck,
  Flame,
  Globe,
  Handshake,
  AlertTriangle,
  DollarSign,
  Receipt,
  Building2,
  Activity,
  Smartphone,
  Zap,
  Search,
  Mail,
  Ban,
  ShieldCheck,
  Trash2,
  Pencil,
  UserX,
  UserCheck,
  X,
  Send,
} from "lucide-react";

const ALL_TABS = [
  { key: "stats", label: "Statistiques", icon: BarChart3 },
  { key: "utilisateurs", label: "Utilisateurs", icon: UsersIcon },
  { key: "signalements", label: "Signalements", icon: AlertTriangle },
  { key: "declarations", label: "Déclarations", icon: FileCheck },
  { key: "restitutions", label: "Restitutions", icon: Handshake },
  { key: "donations", label: "Donations", icon: Coins, mainAdminOnly: true },
  { key: "finances", label: "Finances", icon: DollarSign, mainAdminOnly: true },
  { key: "retraits", label: "Retraits", icon: BarChart3, mainAdminOnly: true },
  { key: "points", label: "Points", icon: CreditCard },
  { key: "paiements", label: "Paiements", icon: Receipt, mainAdminOnly: true },
  { key: "abonnements", label: "Abonnements", icon: TrendingUp },
  { key: "services", label: "Services", icon: Activity },
  { key: "pro", label: "Pro", icon: Building2 },
  { key: "commissions", label: "Commissions", icon: BarChart3, mainAdminOnly: true },
  { key: "pub", label: "Pub", icon: Megaphone },
  { key: "pv", label: "PV", icon: FileText },
  { key: "installations", label: "Installs", icon: Smartphone, mainAdminOnly: true },
  { key: "diffusion", label: "Diffusion", icon: Send, mainAdminOnly: true },
  { key: "support", label: "Support", icon: Mail },
];

const AdminPage = () => {
  const { user, isMainAdmin, adminSetRole, adminResetPassword, adminBlockUser, adminUnblockUser, adminUpdateUserEmail, adminDeleteUser } = useAuth();
  const { branding } = useBranding();
  const isAdmin = user?.role === "admin";
  const [tab, setTab] = useState(
    () => new URLSearchParams(window.location.search).get("tab") || "utilisateurs"
  );

  // Filter tabs based on admin role
  const TABS = ALL_TABS.filter((t) => !t.mainAdminOnly || isMainAdmin);

  // Ensure current tab is valid
  if (!TABS.find((t) => t.key === tab)) setTab(TABS[0]?.key || "utilisateurs");
  const [usersList, setUsersList] = useState([]);
  const [roleBusy, setRoleBusy] = useState(null);
  const [resetBusy, setResetBusy] = useState(null);
  const [rematchBusy, setRematchBusy] = useState(false);
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
  const [claims, setClaims] = useState([]);
  const [reports, setReports] = useState([]);
  const [donations, setDonations] = useState([]);
  const [methodStats, setMethodStats] = useState({
    orange_money: { count: 0, total: 0 },
    move_money: { count: 0, total: 0 },
    wave: { count: 0, total: 0 },
  });
  const [phoneStats, setPhoneStats] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [payments, setPayments] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [proAccounts, setProAccounts] = useState([]);
  const [adEvents, setAdEvents] = useState([]);
  const [pvs, setPvs] = useState([]);
  const [installations, setInstallations] = useState([]);
  const [supportMessages, setSupportMessages] = useState([]);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }
    try {
      const safeGetList = async (col, page, perPage, opts) => {
        try {
          return await pb.collection(col).getList(page, perPage, opts);
        } catch (_) {
          return { items: [], totalItems: 0 };
        }
      };
      const safeGetFull = async (col, opts) => {
        try {
          return await pb.collection(col).getFullList(opts);
        } catch (_) {
          return [];
        }
      };
      const safeGetFirst = async (col, filter) => {
        try {
          return await pb.collection(col).getFirstListItem(filter);
        } catch (_) {
          return null;
        }
      };

      const [lost, found, returned, cats, decl, rep, dons, totals, wds, prc, pays, subs, pros, ads, pvList, installs, supMsgs, clms] =
        await Promise.all([
          safeGetList("declarations", 1, 1, { filter: 'kind = "lost"', requestKey: "a1" }),
          safeGetList("declarations", 1, 1, { filter: 'kind = "found"', requestKey: "a2" }),
          safeGetList("declarations", 1, 1, { filter: 'status = "returned"', requestKey: "a3" }),
          safeGetList("categories", 1, 1, { requestKey: "a5" }),
          safeGetList("declarations", 1, 30, { sort: "-created", expand: "category", requestKey: "a6" }),
          safeGetFull("reports", { sort: "-created", expand: "declaration", requestKey: "a7" }),
          safeGetList("donations", 1, 30, { sort: "-created", requestKey: "a8" }),
          safeGetFirst("donation_totals", "label = 'global'"),
          safeGetFull("withdrawals", { sort: "-created", expand: "user", requestKey: "a9" }),
          safeGetFull("point_purchases", { sort: "-created", expand: "user", requestKey: "a10" }),
          safeGetFull("payments", { sort: "-created", expand: "user", requestKey: "a11" }),
          safeGetFull("subscriptions", { sort: "-created", expand: "user", requestKey: "a12" }),
          safeGetFull("pro_accounts", { sort: "-created", expand: "owner", requestKey: "a13" }),
          safeGetFull("ad_events", { sort: "-created", requestKey: "a14" }),
          safeGetFull("pvs", { sort: "-created", expand: "generated_by,related_declaration", requestKey: "a15" }),
          safeGetFull("app_installations", { sort: "-installed_at", expand: "user", requestKey: "a16" }),
          safeGetFull("support_messages", { sort: "-created_at", requestKey: "a17" }),
          safeGetFull("claims", { sort: "-created", expand: "declaration,claimant", requestKey: "a18" }),
        ]);

      let allUsers = [];
      try {
        allUsers = await pb.collection("users").getFullList({ sort: "-created_at" });
      } catch (_) {
        try {
          allUsers = await pb.collection("users").getFullList({});
        } catch (e2) {
          console.warn("Users list load failed:", e2?.message);
        }
      }
      setUsersList(allUsers || []);

      setStats({
        lost: lost.totalItems,
        found: found.totalItems,
        returned: returned.totalItems,
        users: allUsers.length || 0,
        categories: cats.totalItems,
        donations: dons.totalItems,
        donationTotal: totals?.total_fcfa || 0,
        donationsConnected: dons.items.filter((d) => !d.anonymous).length,
        donationsAnonymous: dons.items.filter((d) => d.anonymous).length,
      });
      setDeclarations(decl.items);
      setClaims(clms || []);
      setReports(rep);
      setDonations(dons.items);
      const byMethod = {
        orange_money: { count: 0, total: 0 },
        move_money: { count: 0, total: 0 },
        wave: { count: 0, total: 0 },
      };
      dons.items.forEach((d) => {
        const key = d.payment_method && byMethod[d.payment_method] ? d.payment_method : "other";
        if (byMethod[key]) {
          byMethod[key].count += 1;
          byMethod[key].total += d.amount_fcfa || 0;
        }
      });
      setMethodStats(byMethod);
      const byPhone = {};
      dons.items.forEach((d) => {
        const key = (d.donor_phone || "").trim();
        if (!key) return;
        if (!byPhone[key]) byPhone[key] = { phone: key, count: 0, total: 0, name: d.donor_name };
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
      setInstallations(installs || []);
      setSupportMessages(supMsgs || []);
    } catch (e) {
      console.error("AdminPage load error:", e);
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
    } catch (_) {}
  };

  const setReportStatus = async (r, status) => {
    try {
      await pb.collection("reports").update(r.id, { status });
      load();
    } catch (_) {}
  };

  const setWithdrawalStatus = async (w, status, reason = "") => {
    try {
      const payload = { status };
      if (status === "rejected" && reason) payload.rejection_reason = reason;
      await pb.collection("withdrawals").update(w.id, payload);
      load();
    } catch (_) {}
  };

  const confirmReject = async () => {
    if (rejectTarget) {
      await setWithdrawalStatus(rejectTarget, "rejected", rejectReason.trim() || "Non conforme");
    }
    setRejectTarget(null);
    setRejectReason("");
  };

  const setPaymentStatus = async (p, status) => {
    try {
      // Via la fonction serveur pour activer le service et notifier l'utilisateur
      if (status === "confirmed" || status === "failed") {
        const res = await fetch("/api/confirm-payment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paymentId: p.id, status }),
        });
        const data = await res.json();
        if (!data.statut) {
          await pb.collection("payments").update(p.id, { status });
        } else if (status === "failed" && data.rejection?.push) {
          toast.success("Paiement rejeté", {
            description: "L'utilisateur a été prévenu sur son appareil.",
          });
        }
      } else {
        await pb.collection("payments").update(p.id, { status });
      }
      load();
    } catch (_) {
      try {
        await pb.collection("payments").update(p.id, { status });
        load();
      } catch (_) {}
    }
  };

  const setProAccountStatus = async (pa, status) => {
    try {
      await pb.collection("pro_accounts").update(pa.id, { status });
      load();
    } catch (_) {}
  };

  const togglePriority = async (d) => {
    try {
      const active = !!d.priority && (!d.priority_until || new Date(d.priority_until) > new Date());
      await pb.collection("declarations").update(
        d.id,
        active
          ? { priority: false, priority_until: null }
          : { priority: true, priority_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() }
      );
      load();
    } catch (_) {}
  };

  const setSubStatus = async (s, status) => {
    try {
      const payload =
        status === "active"
          ? {
              status: "active",
              auto_renew: true,
              renews_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            }
          : { status: "cancelled", auto_renew: false };
      await pb.collection("subscriptions").update(s.id, payload);
      load();
    } catch (_) {}
  };

  const setPurchaseStatus = async (prc, status) => {
    try {
      await pb.collection("point_purchases").update(prc.id, { status });
      load();
    } catch (_) {}
  };

  const setClaimStatus = async (c, status) => {
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

  // ── Finance computations ────────────────────────────────────────────────
  const confirmedPayments = payments.filter((p) => p.status === "confirmed");
  const pendingPayments = payments.filter((p) => p.status === "pending");
  const failedPayments = payments.filter((p) => p.status === "failed");

  const totalDepositsFcfa = confirmedPayments.reduce((s, p) => s + (p.amount_fcfa || 0), 0);
  const totalFeesCollected = confirmedPayments.reduce((s, p) => s + (p.fee_fcfa || 0), 0);

  const revenueBySource = useMemo(() => ({
    subscription: confirmedPayments.filter((p) => p.type === "subscription").reduce((s, p) => s + (p.amount_fcfa || 0), 0),
    service: confirmedPayments.filter((p) => p.type === "service").reduce((s, p) => s + (p.amount_fcfa || 0), 0),
    pro_account: confirmedPayments.filter((p) => p.type === "pro_account").reduce((s, p) => s + (p.amount_fcfa || 0), 0),
    donation: stats.donationTotal,
    priority: confirmedPayments.filter((p) => p.type === "priority").reduce((s, p) => s + (p.amount_fcfa || 0), 0),
    commission: withdrawals.filter((w) => w.status === "paid").reduce((s, w) => s + (w.commission_fcfa || 0), 0),
  }), [confirmedPayments, stats.donationTotal, withdrawals]);
  const totalRevenue = Object.values(revenueBySource).reduce((s, n) => s + n, 0);

  const activeSubs = subscriptions.filter((s) => s.status === "active");
  const premiumCount = activeSubs.filter((s) => s.plan === "premium").length;
  const proCount = activeSubs.filter((s) => s.plan === "pro").length;
  const subRevenue = revenueBySource.subscription;
  const cancelledSubs = subscriptions.filter((s) => s.status === "cancelled").length;
  const churnRate = subscriptions.length > 0 ? Math.round((cancelledSubs / subscriptions.length) * 100) : 0;

  const serviceRevenueMap = {};
  confirmedPayments.filter((p) => p.type === "service").forEach((p) => {
    if (!serviceRevenueMap[p.item_key]) serviceRevenueMap[p.item_key] = { count: 0, total: 0, label: p.item_label || p.item_key };
    serviceRevenueMap[p.item_key].count += 1;
    serviceRevenueMap[p.item_key].total += p.amount_fcfa || 0;
  });

  const activeProAccounts = proAccounts.filter((p) => p.status === "active");
  const proRevenue = revenueBySource.pro_account;

  const paidWithdrawals = withdrawals.filter((w) => w.status === "paid");
  const rejectedWithdrawals = withdrawals.filter((w) => w.status === "rejected");
  const totalCommission = paidWithdrawals.reduce((s, w) => s + (w.commission_fcfa || 0), 0);
  const totalWithdrawn = paidWithdrawals.reduce((s, w) => s + (w.amount_fcfa || 0), 0);
  const avgWithdrawal = paidWithdrawals.length > 0 ? Math.round(totalWithdrawn / paidWithdrawals.length) : 0;
  const totalPointsWithdrawn = paidWithdrawals.reduce((s, w) => s + (w.amount_points || 0), 0);

  // Payment type breakdown
  const paymentsByType = {};
  confirmedPayments.forEach((p) => {
    const t = p.type || "other";
    if (!paymentsByType[t]) paymentsByType[t] = { count: 0, total: 0 };
    paymentsByType[t].count += 1;
    paymentsByType[t].total += p.amount_fcfa || 0;
  });

  // Withdrawal method breakdown
  const withdrawalsByMethod = {};
  withdrawals.forEach((w) => {
    const m = w.payment_method || w.method || "inconnu";
    if (!withdrawalsByMethod[m]) withdrawalsByMethod[m] = { count: 0, total: 0, paid: 0 };
    withdrawalsByMethod[m].count += 1;
    withdrawalsByMethod[m].total += w.amount_fcfa || 0;
    if (w.status === "paid") withdrawalsByMethod[m].paid += w.amount_fcfa || 0;
  });

  const impressions = adEvents.filter((a) => a.type === "impression").length;
  const clicks = adEvents.filter((a) => a.type === "click").length;
  const ctr = impressions > 0 ? ((clicks / impressions) * 100).toFixed(2) : "0.00";

  const pendingWithdrawals = withdrawals.filter((w) => w.status === "pending");
  const pendingTotal = pendingWithdrawals.reduce((s, w) => s + (w.amount_fcfa || 0), 0);
  const paidTotal = withdrawals.filter((w) => w.status === "paid").reduce((s, w) => s + (w.amount_fcfa || 0), 0);

  const serviceCounts = {};
  let totalPointsSpent = 0;
  purchases.forEach((p) => {
    serviceCounts[p.service] = (serviceCounts[p.service] || 0) + 1;
    totalPointsSpent += p.points_cost || 0;
  });
  const topServices = Object.entries(serviceCounts).map(([k, n]) => ({ key: k, count: n })).sort((a, b) => b.count - a.count).slice(0, 10);
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
        </Helmet>
        <div className="mx-auto max-w-md px-4 py-20 text-center">
          <ShieldAlert className="mx-auto h-10 w-10 text-destructive" />
          <p className="mt-4 text-lg font-bold">Accès réservé aux administrateurs</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Votre compte n&apos;a pas le rôle « admin ». Contactez l&apos;équipe {branding.app_name}.
          </p>
        </div>
      </Layout>
    );
  }

  // Build tab badge counts
  const tabBadges = {
    utilisateurs: usersList.length,
    signalements: reports.length,
    declarations: declarations.length,
    donations: stats.donations,
    retraits: pendingWithdrawals.length,
    paiements: pendingPayments.length,
    abonnements: premiumCount + proCount,
    pv: pvs.length,
  };

  return (
    <Layout>
      <Helmet>
        <title>Administration — {branding.app_name}</title>
      </Helmet>

      <div className="mx-auto max-w-lg px-4 pt-4 pb-24 space-y-4">

        {/* ── Onglets admin (menu affiché en premier : tous visibles) ── */}
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          {TABS.map((t) => {
            const active = tab === t.key;
            const badge = tabBadges[t.key];
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex items-center justify-center gap-1.5 rounded-xl px-2 py-2.5 text-[11px] font-bold leading-tight text-center transition-all ${
                  active
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "bg-card border border-border text-muted-foreground"
                }`}
              >
                <t.icon className="h-3.5 w-3.5 shrink-0" />
                <span>{t.label}</span>
                {badge > 0 && (
                  <span className={`ml-0.5 rounded-full px-1.5 py-0 text-[9px] font-extrabold ${active ? "bg-white/25" : "bg-primary/10 text-primary"}`}>
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ── Hero gradient card ── */}
        <div className="rounded-3xl bg-gradient-to-br from-primary via-primary/90 to-accent p-5 text-primary-foreground">
          <div className="flex items-center gap-3 mb-3">
            <BrandLogo size="sm" linkToHome={false} imgClassName="rounded-xl" />
            <div>
              <h1 className="text-lg font-extrabold">Administration</h1>
              <p className="text-[11px] opacity-80">{branding.app_name}</p>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: "Égarés", value: stats.lost },
              { label: "Trouvés", value: stats.found },
              { label: "Rendus", value: stats.returned },
              { label: "Membres", value: stats.users },
            ].map((s) => (
              <div key={s.label} className="rounded-xl bg-white/15 p-2 text-center">
                <p className="text-xl font-extrabold">{s.value}</p>
                <p className="text-[10px] opacity-80">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Quick action buttons ── */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { to: "/admin/branding", icon: Palette, label: "Branding", color: "text-primary" },
            { to: "/admin/sponsors", icon: Megaphone, label: "Sponsors", color: "text-accent" },
            { to: "/admin/hero", icon: Image, label: "Hero", color: "text-primary" },
            { to: "/admin/scan", icon: ScanLine, label: "Scanner", color: "text-accent" },
          ].map((a) => (
            <Link
              key={a.to}
              to={a.to}
              className="flex flex-col items-center gap-1 rounded-2xl border border-border bg-card px-2 py-2.5 active:scale-[0.97]"
            >
              <a.icon className={`h-5 w-5 ${a.color}`} />
              <span className="text-[10px] font-bold leading-tight text-center">{a.label}</span>
            </Link>
          ))}
        </div>

        {/* ── Rematch button ── */}
        <button
          type="button"
          disabled={rematchBusy}
          onClick={async () => {
            if (!confirm("Lancer le re-match de toutes les déclarations ? Cela peut prendre quelques minutes.")) return;
            setRematchBusy(true);
            try {
              const result = await bulkRematch();
              toast.success(`${result.total} nouveaux matchs créés sur ${result.scanned} déclarations`);
            } catch (err) {
              toast.error("Erreur: " + (err?.message || "inconnue"));
            } finally {
              setRematchBusy(false);
            }
          }}
          className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-3.5 text-sm font-extrabold text-white shadow-lg shadow-amber-500/25 active:scale-[0.98] transition-all disabled:opacity-50"
        >
          {rematchBusy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Zap className="h-4 w-4" />
          )}
          {rematchBusy ? "Analyse en cours…" : "Relancer le matching (toutes déclarations)"}
        </button>

        {/* ── Loading skeleton ── */}
        {loading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-2xl bg-muted" />
            ))}
          </div>
        )}

        {/* ═══════════ TAB CONTENT ═══════════ */}
        {!loading && (
          <div>
            {tab === "stats" && <TabStats isMainAdmin={isMainAdmin} />}
            {tab === "utilisateurs" && (
              <TabUtilisateurs
                usersList={usersList}
                isMainAdmin={isMainAdmin}
                roleBusy={roleBusy}
                resetBusy={resetBusy}
                setRoleBusy={setRoleBusy}
                setResetBusy={setResetBusy}
                adminSetRole={adminSetRole}
                adminResetPassword={adminResetPassword}
                adminBlockUser={adminBlockUser}
                adminUnblockUser={adminUnblockUser}
                adminUpdateUserEmail={adminUpdateUserEmail}
                adminDeleteUser={adminDeleteUser}
                refreshUsers={load}
              />
            )}
            {tab === "signalements" && <TabSignalements reports={reports} setReportStatus={setReportStatus} />}
            {tab === "declarations" && <TabDeclarations declarations={declarations} setStatus={setStatus} togglePriority={togglePriority} />}
            {tab === "restitutions" && <TabRestitutions claims={claims} setClaimStatus={setClaimStatus} />}
            {tab === "donations" && <TabDonations donations={donations} stats={stats} methodStats={methodStats} phoneStats={phoneStats} />}
            {tab === "finances" && <TabFinances revenueBySource={revenueBySource} totalRevenue={totalRevenue} totalDepositsFcfa={totalDepositsFcfa} totalFeesCollected={totalFeesCollected} payments={payments} confirmedPayments={confirmedPayments} pendingPayments={pendingPayments} failedPayments={failedPayments} paymentsByType={paymentsByType} />}
            {tab === "retraits" && <TabRetraits withdrawals={withdrawals} pendingWithdrawals={pendingWithdrawals} pendingTotal={pendingTotal} paidTotal={paidTotal} totalCommission={totalCommission} totalPointsWithdrawn={totalPointsWithdrawn} withdrawalsByMethod={withdrawalsByMethod} paidWithdrawals={paidWithdrawals} rejectedWithdrawals={rejectedWithdrawals} setWithdrawalStatus={setWithdrawalStatus} setRejectTarget={setRejectTarget} setRejectReason={setRejectReason} />}
            {tab === "points" && <TabPoints purchases={purchases} totalPointsSpent={totalPointsSpent} topServices={topServices} SERVICE_LABELS={SERVICE_LABELS} />}
            {tab === "paiements" && <TabPaiements payments={payments} pendingPayments={pendingPayments} confirmedPayments={confirmedPayments} failedPayments={failedPayments} totalDepositsFcfa={totalDepositsFcfa} setPaymentStatus={setPaymentStatus} />}
            {tab === "abonnements" && <TabAbonnements subscriptions={subscriptions} setSubStatus={setSubStatus} premiumCount={premiumCount} proCount={proCount} subRevenue={subRevenue} churnRate={churnRate} />}
            {tab === "services" && <TabServices serviceRevenueMap={serviceRevenueMap} purchases={purchases} setPurchaseStatus={setPurchaseStatus} />}
            {tab === "pro" && <TabPro proAccounts={proAccounts} activeProAccounts={activeProAccounts} proRevenue={proRevenue} setProAccountStatus={setProAccountStatus} />}
            {tab === "commissions" && <TabCommissions totalCommission={totalCommission} paidWithdrawals={paidWithdrawals} avgWithdrawal={avgWithdrawal} totalWithdrawn={totalWithdrawn} totalPointsWithdrawn={totalPointsWithdrawn} />}
            {tab === "pub" && <TabPub impressions={impressions} clicks={clicks} ctr={ctr} />}
            {tab === "pv" && <TabPV pvs={pvs} />}
            {tab === "installations" && <TabInstallations installations={installations} />}
            {tab === "diffusion" && <TabDiffusion usersCount={usersList.length} />}
            {tab === "support" && <TabSupport supportMessages={supportMessages} setSupportMessages={setSupportMessages} load={load} />}
          </div>
        )}
      </div>

      {/* Rejection reason dialog */}
      {rejectTarget && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4" onClick={() => setRejectTarget(null)}>
          <div className="w-full max-w-md rounded-3xl bg-card p-6 sheet-up" onClick={(e) => e.stopPropagation()}>
            <p className="font-extrabold text-lg mb-1">Refuser le retrait</p>
            <p className="text-sm text-muted-foreground mb-4">
              {rejectTarget.amount_fcfa?.toLocaleString("fr-FR")} FCFA — les points seront restitués à l&apos;utilisateur.
            </p>
            <label className="text-sm font-semibold mb-1 block">Raison du refus</label>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="ex : Numéro de téléphone invalide"
              rows={3}
              className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm outline-none focus:border-primary"
            />
            <div className="mt-4 flex gap-3">
              <button type="button" onClick={() => setRejectTarget(null)} className="flex-1 rounded-xl border border-border px-4 py-3 text-sm font-bold">
                Annuler
              </button>
              <button type="button" onClick={confirmReject} className="flex-1 rounded-xl bg-destructive px-4 py-3 text-sm font-bold text-destructive-foreground">
                Confirmer le refus
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// TAB COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

function TabUtilisateurs({ usersList, isMainAdmin, roleBusy, resetBusy, setRoleBusy, setResetBusy, adminSetRole, adminResetPassword, adminBlockUser, adminUnblockUser, adminUpdateUserEmail, adminDeleteUser, refreshUsers }) {
  const [search, setSearch] = useState("");
  const [editEmailTarget, setEditEmailTarget] = useState(null);
  const [editEmailValue, setEditEmailValue] = useState("");
  const [editEmailBusy, setEditEmailBusy] = useState(false);
  const [blockBusy, setBlockBusy] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(null);

  const filtered = useMemo(() => {
    if (!search.trim()) return usersList;
    const q = search.toLowerCase();
    return usersList.filter(
      (u) =>
        (u.name || "").toLowerCase().includes(q) ||
        (u.email || "").toLowerCase().includes(q) ||
        (u.role || "").toLowerCase().includes(q)
    );
  }, [usersList, search]);

  const p = usePaginate(filtered);

  const openEditEmail = (u) => {
    setEditEmailTarget(u);
    setEditEmailValue(u.email || "");
  };

  const saveEmail = async () => {
    if (!editEmailTarget || !editEmailValue.trim()) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editEmailValue)) {
      toast.error("Email invalide");
      return;
    }
    setEditEmailBusy(true);
    try {
      await adminUpdateUserEmail(editEmailTarget.id, editEmailValue.trim());
      toast.success("Email mis à jour", { description: `${editEmailTarget.name || editEmailTarget.email} → ${editEmailValue.trim()}` });
      setEditEmailTarget(null);
      refreshUsers();
    } catch (e) {
      toast.error("Erreur", { description: e?.message });
    } finally {
      setEditEmailBusy(false);
    }
  };

  return (
    <div>
      {!isMainAdmin && (
        <p className="text-xs text-muted-foreground mb-3 rounded-2xl bg-muted/50 px-3 py-2">
          Seul l&apos;administrateur principal peut modifier les rôles.
        </p>
      )}

      {/* Search */}
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Rechercher un nom, email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-xl border border-border bg-card py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
        />
        {search && (
          <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState text="Aucun utilisateur trouvé." />
      ) : (
        <div className="space-y-2">
          {p.shown.map((u) => (
            <div key={u.id} className={`rounded-2xl border bg-card p-3 ${u.blocked ? "border-red-300 opacity-70 dark:border-red-800" : "border-border"}`}>
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="font-bold text-sm truncate">{u.name || "Sans nom"}</p>
                    {u.blocked && (
                      <span className="rounded bg-red-100 px-1.5 py-0.5 text-[9px] font-extrabold text-red-600 dark:bg-red-900/40 dark:text-red-400">
                        BLOQUÉ
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate">{u.email}</p>
                </div>
                <span className={`rounded-lg px-2 py-0.5 text-[10px] font-extrabold ${u.role === "admin" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                  {u.role === "admin" ? "Admin" : "User"}
                </span>
              </div>

              {isMainAdmin && u.email !== "digihouse10@gmail.com" && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {/* Role toggle */}
                  <button
                    disabled={roleBusy === u.id}
                    onClick={async () => {
                      if (!confirm(`Mettre ${u.name || u.email} en ${u.role === "admin" ? "user" : "admin"} ?`)) return;
                      setRoleBusy(u.id);
                      try {
                        const newRole = u.role === "admin" ? "user" : "admin";
                        await adminSetRole(u.id, newRole);
                        toast.success(`${u.name || u.email} → ${newRole}`);
                        refreshUsers();
                      } catch (e) {
                        toast.error("Erreur", { description: e?.message });
                      } finally {
                        setRoleBusy(null);
                      }
                    }}
                    className="flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-[10px] font-bold disabled:opacity-40"
                  >
                    {roleBusy === u.id ? <Loader2 className="h-3 w-3 animate-spin" /> : u.role === "admin" ? <ShieldOff className="h-3 w-3" /> : <Shield className="h-3 w-3" />}
                    {u.role === "admin" ? "Rétrograder" : "Promouvoir"}
                  </button>

                  {/* Reset MDP */}
                  <button
                    disabled={resetBusy === u.id}
                    onClick={async () => {
                      if (!confirm(`Réinitialiser le MDP de ${u.name || u.email} à 00000000 ?`)) return;
                      setResetBusy(u.id);
                      try {
                        const msg = await adminResetPassword(u.id);
                        toast.success("MDP réinitialisé", { description: msg });
                        refreshUsers();
                      } catch (e) {
                        toast.error("Erreur", { description: e?.message });
                      } finally {
                        setResetBusy(null);
                      }
                    }}
                    className="flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-[10px] font-bold disabled:opacity-40"
                  >
                    {resetBusy === u.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <KeyRound className="h-3 w-3" />}
                    Reset MDP
                  </button>

                  {/* Edit email */}
                  <button
                    onClick={() => openEditEmail(u)}
                    className="flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-[10px] font-bold"
                  >
                    <Pencil className="h-3 w-3" />
                    Email
                  </button>

                  {/* Block / Unblock */}
                  {u.blocked ? (
                    <button
                      disabled={blockBusy === u.id}
                      onClick={async () => {
                        if (!confirm(`Débloquer ${u.name || u.email} ?`)) return;
                        setBlockBusy(u.id);
                        try {
                          await adminUnblockUser(u.id);
                          toast.success(`${u.name || u.email} débloqué`);
                          refreshUsers();
                        } catch (e) {
                          toast.error("Erreur", { description: e?.message });
                        } finally {
                          setBlockBusy(null);
                        }
                      }}
                      className="flex items-center gap-1 rounded-lg border border-green-300 bg-green-50 px-2 py-1 text-[10px] font-bold text-green-700 dark:border-green-800 dark:bg-green-900/30 dark:text-green-400 disabled:opacity-40"
                    >
                      {blockBusy === u.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserCheck className="h-3 w-3" />}
                      Réactiver
                    </button>
                  ) : (
                    <button
                      disabled={blockBusy === u.id}
                      onClick={async () => {
                        if (!confirm(`Bloquer ${u.name || u.email} ? Il ne pourra plus se connecter.`)) return;
                        setBlockBusy(u.id);
                        try {
                          await adminBlockUser(u.id);
                          toast.success(`${u.name || u.email} bloqué`);
                          refreshUsers();
                        } catch (e) {
                          toast.error("Erreur", { description: e?.message });
                        } finally {
                          setBlockBusy(null);
                        }
                      }}
                      className="flex items-center gap-1 rounded-lg border border-orange-300 bg-orange-50 px-2 py-1 text-[10px] font-bold text-orange-700 dark:border-orange-800 dark:bg-orange-900/30 dark:text-orange-400 disabled:opacity-40"
                    >
                      {blockBusy === u.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Ban className="h-3 w-3" />}
                      Bloquer
                    </button>
                  )}

                  {/* Delete */}
                  <button
                    disabled={deleteBusy === u.id}
                    onClick={async () => {
                      if (!confirm(`⚠️ SUPPRIMER ${u.name || u.email} ? Cette action est irréversible.`)) return;
                      if (!confirm("Vraiment supprimer ce compte définitivement ?")) return;
                      setDeleteBusy(u.id);
                      try {
                        await adminDeleteUser(u.id);
                        toast.success(`${u.name || u.email} supprimé`);
                        refreshUsers();
                      } catch (e) {
                        toast.error("Erreur", { description: e?.message });
                      } finally {
                        setDeleteBusy(null);
                      }
                    }}
                    className="flex items-center gap-1 rounded-lg border border-red-300 bg-red-50 px-2 py-1 text-[10px] font-bold text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-400 disabled:opacity-40"
                  >
                    {deleteBusy === u.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                    Supprimer
                  </button>
                </div>
              )}
            </div>
          ))}
          <ListFooter {...p} total={filtered.length} />
        </div>
      )}

      {/* Edit Email Modal */}
      {editEmailTarget && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setEditEmailTarget(null)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl dark:bg-zinc-900" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-foreground">Modifier l&apos;email</h3>
              <button onClick={() => setEditEmailTarget(null)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Utilisateur : <strong>{editEmailTarget.name || editEmailTarget.email}</strong>
            </p>
            <input
              type="email"
              value={editEmailValue}
              onChange={(e) => setEditEmailValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveEmail()}
              className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              placeholder="nouveau@email.com"
              autoFocus
            />
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setEditEmailTarget(null)}
                className="flex-1 rounded-xl border border-border px-3 py-2 text-sm font-bold"
              >
                Annuler
              </button>
              <button
                onClick={saveEmail}
                disabled={editEmailBusy || !editEmailValue.trim()}
                className="flex-1 flex items-center justify-center gap-1 rounded-xl bg-primary px-3 py-2 text-sm font-bold text-primary-foreground disabled:opacity-40"
              >
                {editEmailBusy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TabSignalements({ reports, setReportStatus }) {
  const p = usePaginate(reports);
  return reports.length === 0 ? (
    <EmptyState text="Aucun signalement en attente." />
  ) : (
    <div className="space-y-2">
      {p.shown.map((r) => (
        <div key={r.id} className="rounded-2xl border border-border bg-card p-3">
          <div className="flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate text-sm font-semibold">
              {r.expand?.declaration?.title || "Déclaration supprimée"}
            </span>
            <span className="text-[10px] font-bold uppercase text-muted-foreground">{r.status}</span>
          </div>
          <div className="mt-2 flex gap-1.5">
            <button onClick={() => setReportStatus(r, "reviewed")} className="rounded-lg border border-border px-3 py-1.5 text-[11px] font-bold">Traité</button>
            <button onClick={() => setReportStatus(r, "blocked")} className="rounded-lg bg-destructive px-3 py-1.5 text-[11px] font-bold text-destructive-foreground">Bloquer</button>
          </div>
        </div>
      ))}
      <ListFooter {...p} total={reports.length} />
    </div>
  );
}

function TabDeclarations({ declarations, setStatus, togglePriority }) {
  const p = usePaginate(declarations);
  const isPriorityActive = (d) => !!d.priority && (!d.priority_until || new Date(d.priority_until) > new Date());
  return declarations.length === 0 ? (
    <EmptyState text="Aucune déclaration." />
  ) : (
    <div className="space-y-2">
      {p.shown.map((d) => (
        <div key={d.id} className="rounded-2xl border border-border bg-card px-3 py-2.5 text-sm">
          <div className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${d.kind === "lost" ? "bg-destructive" : "bg-accent"}`} />
            <Link to={`/objet/${d.id}`} className="min-w-0 flex-1 truncate font-semibold">{d.title}</Link>
            <span className="text-[10px] text-muted-foreground flex-shrink-0">{d.expand?.category?.name}</span>
            {isPriorityActive(d) && (
              <span className="flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-accent flex-shrink-0">
                <Flame className="h-3 w-3" /> En avant
              </span>
            )}
          </div>
          <div className="mt-2 flex gap-1.5">
            <button
              onClick={() => togglePriority(d)}
              className={`rounded-lg px-2 py-1 text-[10px] font-bold flex-shrink-0 ${isPriorityActive(d) ? "border border-border" : "bg-accent px-3 text-accent-foreground"}`}
            >
              {isPriorityActive(d) ? "Retirer l'avance" : "Mettre en avant"}
            </button>
            {d.status !== "blocked" ? (
              <button onClick={() => setStatus(d, "blocked")} className="rounded-lg bg-destructive px-2 py-1 text-[10px] font-bold text-destructive-foreground flex-shrink-0">Bloquer</button>
            ) : (
              <button onClick={() => setStatus(d, "open")} className="rounded-lg border border-border px-2 py-1 text-[10px] font-bold flex-shrink-0">Republier</button>
            )}
          </div>
        </div>
      ))}
      <ListFooter {...p} total={declarations.length} />
    </div>
  );
}

function TabRestitutions({ claims, setClaimStatus }) {
  const p = usePaginate(claims);
  return claims.length === 0 ? (
    <EmptyState text="Aucune demande de restitution." />
  ) : (
    <div className="space-y-2">
      {p.shown.map((c) => (
        <div key={c.id} className="rounded-2xl border border-border bg-card p-3 text-xs">
          <div className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${c.expand?.declaration?.kind === "lost" ? "bg-destructive" : "bg-accent"}`} />
            <span className="min-w-0 flex-1 truncate font-semibold">{c.expand?.declaration?.title || c.declaration}</span>
            <span className="text-[10px] text-muted-foreground flex-shrink-0">{c.expand?.claimant?.name || c.expand?.claimant?.email || c.claimant}</span>
          </div>
          {c.security_answer && (
            <p className="mt-1.5 rounded-xl bg-muted px-2.5 py-1.5 text-[11px] text-muted-foreground">
              Réponse : <span className="font-semibold text-foreground">{c.security_answer}</span>
            </p>
          )}
          <div className="mt-2 flex items-center gap-1.5">
            <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase flex-shrink-0 ${c.status === "pending" ? "bg-primary/15 text-primary" : c.status === "verified" ? "bg-accent/15 text-accent" : c.status === "returned" ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-destructive/15 text-destructive"}`}>{c.status}</span>
            <span className="ml-auto flex gap-1.5">
              {c.status === "pending" && (
                <>
                  <button onClick={() => setClaimStatus(c, "verified")} className="rounded-lg bg-primary px-2.5 py-1 text-[10px] font-bold text-primary-foreground">Accepter</button>
                  <button onClick={() => setClaimStatus(c, "rejected")} className="rounded-lg border border-border px-2.5 py-1 text-[10px] font-bold">Refuser</button>
                </>
              )}
              {c.status === "verified" && (
                <button onClick={() => setClaimStatus(c, "returned")} className="rounded-lg bg-accent px-2.5 py-1 text-[10px] font-bold text-accent-foreground">Restituer +100</button>
              )}
            </span>
          </div>
        </div>
      ))}
      <ListFooter {...p} total={claims.length} />
    </div>
  );
}

function TabDonations({ donations, stats, methodStats, phoneStats }) {
  const p = usePaginate(donations);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-2xl bg-gradient-to-br from-primary to-primary/80 p-3 text-primary-foreground">
          <p className="text-xl font-extrabold">{stats.donationTotal.toLocaleString("fr-FR")} FCFA</p>
          <p className="text-[10px] opacity-80">Total collecté</p>
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-accent to-accent/80 p-3 text-accent-foreground">
          <p className="text-xl font-extrabold">{stats.donations}</p>
          <p className="text-[10px] opacity-80">Donateurs</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-2xl border border-border bg-card p-3">
          <p className="text-lg font-extrabold text-primary">{stats.donationsConnected || 0}</p>
          <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <span className="inline-block h-2 w-2 rounded-full bg-accent" /> Connectés
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-3">
          <p className="text-lg font-extrabold text-muted-foreground">{stats.donationsAnonymous || 0}</p>
          <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <span className="inline-block h-2 w-2 rounded-full bg-muted-foreground/40" /> Anonymes
          </p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[
          ["orange_money", "Orange", "bg-[hsl(22_90%_50%)]"],
          ["move_money", "Move", "bg-[hsl(262_70%_52%)]"],
          ["wave", "Wave", "bg-[hsl(199_90%_45%)]"],
        ].map(([key, label, dot]) => (
          <div key={key} className="rounded-2xl border border-border bg-card p-2 text-center">
            <span className={`mx-auto h-2.5 w-2.5 rounded-full block ${dot}`} />
            <p className="mt-1 text-[10px] font-bold">{label}</p>
            <p className="text-sm font-extrabold text-primary">{methodStats[key]?.total?.toLocaleString("fr-FR") || 0}</p>
            <p className="text-[9px] text-muted-foreground">{methodStats[key]?.count || 0} don(s)</p>
          </div>
        ))}
      </div>
      {phoneStats.length > 0 && (
        <div>
          <p className="text-xs font-extrabold mb-2">Par numéro</p>
          <div className="space-y-1.5">
            {phoneStats.slice(0, 5).map((ps) => (
              <div key={ps.phone} className="flex items-center gap-2 rounded-2xl border border-border bg-background px-3 py-2 text-xs">
                <span className="font-bold flex-1 truncate">{ps.phone}</span>
                <span className="font-extrabold text-primary">{ps.total.toLocaleString("fr-FR")} FCFA</span>
                <span className="text-[10px] text-muted-foreground">{ps.count}x</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {donations.length > 0 && (
        <div>
          <p className="text-xs font-extrabold mb-2">Détail</p>
          <div className="space-y-1.5">
            {p.shown.map((d) => (
              <div key={d.id} className="flex items-center gap-2 rounded-2xl border border-border bg-card px-3 py-2 text-xs">
                <span className="min-w-0 flex-1 truncate font-semibold">{d.donor_name || "Anonyme"}</span>
                <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase ${d.anonymous ? "bg-muted text-muted-foreground" : "bg-accent/15 text-accent"}`}>{d.anonymous ? "Anonyme" : "Connecté"}</span>
                <span className="font-extrabold text-primary">{(d.amount_fcfa || 0).toLocaleString("fr-FR")}</span>
                <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase ${d.status === "completed" ? "bg-accent/15 text-accent" : "bg-muted text-muted-foreground"}`}>{d.status}</span>
              </div>
            ))}
          </div>
          <ListFooter {...p} total={donations.length} />
        </div>
      )}
    </div>
  );
}

function TabFinances({ revenueBySource, totalRevenue, totalDepositsFcfa, totalFeesCollected, payments, confirmedPayments, pendingPayments, failedPayments, paymentsByType }) {
  const TYPE_LABELS = { subscription: "Abonnements", service: "Services", pro_account: "Comptes Pro", donation: "Dons", priority: "Priorités", other: "Autres" };
  return (
    <div className="space-y-3">
      <div className="rounded-2xl bg-gradient-to-br from-primary via-primary/90 to-accent p-4 text-primary-foreground">
        <p className="text-3xl font-extrabold">{totalRevenue.toLocaleString("fr-FR")} FCFA</p>
        <p className="text-xs opacity-80">Revenus totaux confirmés</p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-2xl border border-border bg-card p-2 text-center">
          <p className="text-sm font-extrabold text-primary">{totalDepositsFcfa.toLocaleString("fr-FR")}</p>
          <p className="text-[9px] text-muted-foreground">Dépôts (FCFA)</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-2 text-center">
          <p className="text-sm font-extrabold text-accent">{totalFeesCollected.toLocaleString("fr-FR")}</p>
          <p className="text-[9px] text-muted-foreground">Frais 3% (FCFA)</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-2 text-center">
          <p className="text-sm font-extrabold">{payments.length}</p>
          <p className="text-[9px] text-muted-foreground">Transactions</p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-2xl border border-border bg-card p-2 text-center">
          <p className="text-lg font-extrabold text-accent">{confirmedPayments.length}</p>
          <p className="text-[9px] text-muted-foreground">Confirmés</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-2 text-center">
          <p className="text-lg font-extrabold text-primary">{pendingPayments.length}</p>
          <p className="text-[9px] text-muted-foreground">En attente</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-2 text-center">
          <p className="text-lg font-extrabold text-destructive">{failedPayments.length}</p>
          <p className="text-[9px] text-muted-foreground">Échoués</p>
        </div>
      </div>
      <div>
        <p className="text-xs font-extrabold mb-2">Revenus par source</p>
        <div className="space-y-2">
          {[
            ["Abonnements", revenueBySource.subscription, TrendingUp],
            ["Services", revenueBySource.service, CreditCard],
            ["Comptes Pro", revenueBySource.pro_account, Building2],
            ["Dons", revenueBySource.donation, Coins],
            ["Priorités", revenueBySource.priority || 0, AlertTriangle],
            ["Commissions retraits", revenueBySource.commission, BarChart3],
          ].map(([label, val, Icon]) => (
            <div key={label} className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3">
              <Icon className="h-4 w-4 text-primary flex-shrink-0" />
              <span className="flex-1 text-sm font-semibold">{label}</span>
              <span className="text-sm font-extrabold text-accent">{val.toLocaleString("fr-FR")} FCFA</span>
            </div>
          ))}
        </div>
      </div>
      {Object.keys(paymentsByType).length > 0 && (
        <div>
          <p className="text-xs font-extrabold mb-2">Transactions par type</p>
          <div className="space-y-1.5">
            {Object.entries(paymentsByType).map(([type, data]) => (
              <div key={type} className="flex items-center gap-2 rounded-2xl border border-border bg-card px-3 py-2 text-xs">
                <span className="flex-1 font-semibold">{TYPE_LABELS[type] || type}</span>
                <span className="text-muted-foreground">{data.count}x</span>
                <span className="font-extrabold text-primary">{data.total.toLocaleString("fr-FR")} FCFA</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TabRetraits({ withdrawals, pendingWithdrawals, pendingTotal, paidTotal, totalCommission, totalPointsWithdrawn, withdrawalsByMethod, paidWithdrawals, rejectedWithdrawals, setWithdrawalStatus, setRejectTarget, setRejectReason }) {
  const p = usePaginate(withdrawals);
  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-gradient-to-br from-primary via-primary/90 to-accent p-4 text-primary-foreground">
        <p className="text-2xl font-extrabold">{paidTotal.toLocaleString("fr-FR")} FCFA</p>
        <p className="text-xs opacity-80">Total retiré par les utilisateurs</p>
      </div>
      <div className="grid grid-cols-4 gap-2">
        <div className="rounded-2xl border border-border bg-card p-2 text-center">
          <p className="text-lg font-extrabold text-primary">{pendingTotal.toLocaleString("fr-FR")}</p>
          <p className="text-[9px] text-muted-foreground">En attente</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-2 text-center">
          <p className="text-lg font-extrabold">{pendingWithdrawals.length}</p>
          <p className="text-[9px] text-muted-foreground">À traiter</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-2 text-center">
          <p className="text-lg font-extrabold text-accent">{paidWithdrawals.length}</p>
          <p className="text-[9px] text-muted-foreground">Payés</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-2 text-center">
          <p className="text-lg font-extrabold text-destructive">{rejectedWithdrawals.length}</p>
          <p className="text-[9px] text-muted-foreground">Refusés</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-2xl border border-border bg-card p-2 text-center">
          <p className="text-sm font-extrabold text-accent">{totalCommission.toLocaleString("fr-FR")} FCFA</p>
          <p className="text-[9px] text-muted-foreground">Commissions 5%</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-2 text-center">
          <p className="text-sm font-extrabold text-primary">{totalPointsWithdrawn.toLocaleString("fr-FR")} pts</p>
          <p className="text-[9px] text-muted-foreground">Points retirés</p>
        </div>
      </div>
      {Object.keys(withdrawalsByMethod).length > 0 && (
        <div>
          <p className="text-xs font-extrabold mb-2">Par méthode</p>
          <div className="space-y-1.5">
            {Object.entries(withdrawalsByMethod).map(([method, data]) => (
              <div key={method} className="flex items-center gap-2 rounded-2xl border border-border bg-card px-3 py-2 text-xs">
                <span className="flex-1 font-semibold">{method}</span>
                <span className="text-muted-foreground">{data.count}x</span>
                <span className="text-muted-foreground">{data.paid.toLocaleString("fr-FR")} payés</span>
                <span className="font-extrabold text-primary">{data.total.toLocaleString("fr-FR")} FCFA</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {withdrawals.length === 0 ? (
        <EmptyState text="Aucun retrait." />
      ) : (
        <div className="space-y-2">
          <p className="text-xs font-extrabold">Historique</p>
          {p.shown.map((w) => (
            <div key={w.id} className="rounded-2xl border border-border bg-card p-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate font-semibold">{w.expand?.user?.name || w.expand?.user?.email || "User"}</span>
                <span className="font-extrabold text-primary">{(w.amount_fcfa || 0).toLocaleString("fr-FR")} FCFA</span>
                <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                  w.status === "paid" ? "bg-accent/15 text-accent" : w.status === "rejected" ? "bg-destructive/15 text-destructive" : w.status === "approved" ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                }`}>{w.status}</span>
              </div>
              <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
                <span>{w.payment_method || w.method || "—"}</span>
                <span>·</span>
                <span>{w.phone || w.payment_details || "—"}</span>
                <span>·</span>
                <span>{w.amount_points || 0} pts</span>
                <span>·</span>
                <span>{w.commission_fcfa || 0} FCFA frais</span>
              </div>
              <div className="mt-1 text-[10px] text-muted-foreground">
                {new Date(w.created_at || w.created).toLocaleDateString("fr-FR")} {new Date(w.created_at || w.created).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
              </div>
              {w.status === "pending" && (
                <div className="mt-2 flex gap-1.5">
                  <button onClick={() => setWithdrawalStatus(w, "approved")} className="rounded-lg bg-primary px-2 py-1 text-[10px] font-bold text-primary-foreground">Approuver</button>
                  <button onClick={() => setWithdrawalStatus(w, "paid")} className="rounded-lg bg-accent px-2 py-1 text-[10px] font-bold text-accent-foreground">Payé</button>
                  <button onClick={() => { setRejectTarget(w); setRejectReason(""); }} className="rounded-lg bg-destructive px-2 py-1 text-[10px] font-bold text-destructive-foreground">Refuser</button>
                </div>
              )}
              {w.status === "approved" && (
                <div className="mt-2">
                  <button onClick={() => setWithdrawalStatus(w, "paid")} className="rounded-lg bg-accent px-2 py-1 text-[10px] font-bold text-accent-foreground">Marquer payé</button>
                </div>
              )}
              {w.rejection_reason && <p className="mt-1 text-[10px] text-destructive">Raison : {w.rejection_reason}</p>}
            </div>
          ))}
          <ListFooter {...p} total={withdrawals.length} />
        </div>
      )}
    </div>
  );
}

function TabPoints({ purchases, totalPointsSpent, topServices, SERVICE_LABELS }) {
  const p = usePaginate(purchases);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-2xl bg-gradient-to-br from-primary to-primary/80 p-3 text-primary-foreground">
          <p className="text-xl font-extrabold">{totalPointsSpent.toLocaleString("fr-FR")} pts</p>
          <p className="text-[10px] opacity-80">Total dépensé</p>
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-accent to-accent/80 p-3 text-accent-foreground">
          <p className="text-xl font-extrabold">{purchases.length}</p>
          <p className="text-[10px] opacity-80">Achats</p>
        </div>
      </div>
      {topServices.length > 0 && (
        <div>
          <p className="text-xs font-extrabold mb-2">Top services</p>
          <div className="space-y-1.5">
            {topServices.map((s) => (
              <div key={s.key} className="flex items-center gap-2 rounded-2xl border border-border bg-card px-3 py-2 text-xs">
                <span className="flex-1 font-semibold">{SERVICE_LABELS[s.key] || s.key}</span>
                <span className="font-extrabold text-primary">{s.count}x</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {purchases.length > 0 && (
        <div>
          <p className="text-xs font-extrabold mb-2">Détail</p>
          <div className="space-y-1.5">
            {p.shown.map((purch) => (
              <div key={purch.id} className="flex items-center gap-2 rounded-2xl border border-border bg-card px-3 py-2 text-xs">
                <span className="min-w-0 flex-1 truncate font-semibold">{SERVICE_LABELS[purch.service] || purch.service}</span>
                <span className="font-extrabold text-primary">{purch.points_cost || 0} pts</span>
                <span className="text-[10px] text-muted-foreground">{new Date(purch.created).toLocaleDateString("fr-FR")}</span>
              </div>
            ))}
          </div>
          <ListFooter {...p} total={purchases.length} />
        </div>
      )}
    </div>
  );
}

function TabPaiements({ payments, pendingPayments, confirmedPayments, failedPayments, totalDepositsFcfa, setPaymentStatus }) {
  const [filter, setFilter] = useState("all");
  const filtered = filter === "all" ? payments : payments.filter((p) => p.status === filter);
  const p = usePaginate(filtered);
  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-gradient-to-br from-primary via-primary/90 to-accent p-4 text-primary-foreground">
        <p className="text-2xl font-extrabold">{totalDepositsFcfa.toLocaleString("fr-FR")} FCFA</p>
        <p className="text-xs opacity-80">Total dépôts confirmés ({confirmedPayments.length} transactions)</p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-2xl border border-border bg-card p-2 text-center">
          <p className="text-lg font-extrabold text-accent">{confirmedPayments.length}</p>
          <p className="text-[9px] text-muted-foreground">Confirmés</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-2 text-center">
          <p className="text-lg font-extrabold text-primary">{pendingPayments.length}</p>
          <p className="text-[9px] text-muted-foreground">En attente</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-2 text-center">
          <p className="text-lg font-extrabold text-destructive">{failedPayments.length}</p>
          <p className="text-[9px] text-muted-foreground">Échoués</p>
        </div>
      </div>
      <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
        {[
          { key: "all", label: "Tous" },
          { key: "confirmed", label: "Confirmés" },
          { key: "pending", label: "En attente" },
          { key: "failed", label: "Échoués" },
        ].map((f) => (
          <button key={f.key} onClick={() => setFilter(f.key)} className={`whitespace-nowrap rounded-xl px-3 py-1.5 text-[11px] font-bold ${filter === f.key ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground"}`}>
            {f.label}
          </button>
        ))}
      </div>
      {filtered.length === 0 ? (
        <EmptyState text="Aucun paiement." />
      ) : (
        <div className="space-y-2">
          {p.shown.map((pay) => (
            <div key={pay.id} className="rounded-2xl border border-border bg-card p-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate font-semibold">
                  {pay.expand?.user?.name || pay.expand?.user?.email || "User"}
                </span>
                <span className="font-extrabold text-primary">{(pay.amount_fcfa || 0).toLocaleString("fr-FR")} FCFA</span>
                <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                  pay.status === "confirmed" ? "bg-accent/15 text-accent" : pay.status === "failed" ? "bg-destructive/15 text-destructive" : "bg-muted text-muted-foreground"
                }`}>{pay.status}</span>
              </div>
              <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
                <span className="rounded-full bg-primary/10 px-1.5 py-0.5 font-bold text-primary">{pay.type || "—"}</span>
                <span>{pay.item_label || pay.item_key || "—"}</span>
                {pay.fee_fcfa > 0 && <span>· Frais: {pay.fee_fcfa} FCFA</span>}
                {pay.moneyfusion_moyen && <span>· {pay.moneyfusion_moyen}</span>}
                {pay.payment_method === "ussd" && (
                  <span className="rounded-full bg-[#ff7900]/20 px-1.5 py-0.5 font-bold text-orange-700 dark:bg-[#ff7900]/20 dark:text-[hsl(22_90%_60%)]">USSD</span>
                )}
              </div>
              {pay.proof_url && (
                <div className="mt-2 flex items-center gap-2">
                  <img
                    src={pay.proof_url}
                    alt="Preuve du dépôt"
                    className="h-16 w-16 rounded-lg border border-border object-cover"
                  />
                  <a
                    href={pay.proof_url}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg bg-secondary/60 px-3 py-1.5 text-[10px] font-bold text-secondary-foreground"
                  >
                    Voir la capture ({pay.payment_method === "ussd" ? "preuve USSD" : "preuve"})
                  </a>
                </div>
              )}
              <div className="mt-1 text-[10px] text-muted-foreground">
                {new Date(pay.created_at || pay.created).toLocaleDateString("fr-FR")} {new Date(pay.created_at || pay.created).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                {pay.confirmed_at && <> · Confirmé le {new Date(pay.confirmed_at).toLocaleDateString("fr-FR")}</>}
              </div>
              {pay.moneyfusion_token && <p className="mt-1 text-[9px] text-muted-foreground truncate">Token: {pay.moneyfusion_token}</p>}
              {pay.status === "pending" && (
                <div className="mt-2 flex gap-1.5">
                  <button
                    onClick={() => setPaymentStatus(pay, "confirmed")}
                    className="rounded-lg border border-green-800/60 bg-green-600 px-3 py-2 text-[11px] font-extrabold text-white shadow transition-colors hover:bg-green-700"
                  >
                    Valider
                  </button>
                  <button
                    onClick={() => setPaymentStatus(pay, "failed")}
                    className="rounded-lg border border-red-800/60 bg-red-600 px-3 py-2 text-[11px] font-extrabold text-white shadow transition-colors hover:bg-red-700"
                  >
                    Rejeter
                  </button>
                </div>
              )}
            </div>
          ))}
          <ListFooter {...p} total={filtered.length} />
        </div>
      )}
    </div>
  );
}

function TabAbonnements({ subscriptions, setSubStatus, premiumCount, proCount, subRevenue, churnRate }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-2xl border border-border bg-card p-3 text-center">
          <p className="text-2xl font-extrabold text-primary">{premiumCount}</p>
          <p className="text-[10px] text-muted-foreground">Premium</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-3 text-center">
          <p className="text-2xl font-extrabold text-primary">{proCount}</p>
          <p className="text-[10px] text-muted-foreground">Pro</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-2xl bg-gradient-to-br from-accent to-accent/80 p-3 text-accent-foreground">
          <p className="text-xl font-extrabold">{subRevenue.toLocaleString("fr-FR")} FCFA</p>
          <p className="text-[10px] opacity-80">Revenus abos</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-3 text-center">
          <p className="text-2xl font-extrabold">{churnRate}%</p>
          <p className="text-[10px] text-muted-foreground">Churn</p>
        </div>
      </div>
      {subscriptions.length === 0 ? (
        <EmptyState text="Aucun abonnement." />
      ) : (
        <div>
          <p className="text-xs font-extrabold mb-2">Abonnements ({subscriptions.length})</p>
          <div className="space-y-2">
            {subscriptions.map((s) => (
              <div key={s.id} className="rounded-2xl border border-border bg-card p-3 text-xs">
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate font-semibold">{s.expand?.user?.name || s.expand?.user?.email || s.user}</span>
                  <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-bold uppercase text-primary flex-shrink-0">{s.plan}</span>
                  <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase flex-shrink-0 ${s.status === "active" ? "bg-accent/15 text-accent" : "bg-muted text-muted-foreground"}`}>{s.status}</span>
                </div>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {s.status === "active" && s.renews_at
                    ? `Renouvellement le ${formatDateTimeFr(s.renews_at)}`
                    : "Abonnement inactif"}
                </p>
                <div className="mt-2 flex gap-1.5">
                  {s.status !== "active" && (
                    <button onClick={() => setSubStatus(s, "active")} className="rounded-lg bg-accent px-2 py-1 text-[10px] font-bold text-accent-foreground">Activer</button>
                  )}
                  {s.status === "active" && (
                    <button onClick={() => setSubStatus(s, "cancelled")} className="rounded-lg bg-destructive px-2 py-1 text-[10px] font-bold text-destructive-foreground">Annuler</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TabServices({ serviceRevenueMap, purchases, setPurchaseStatus }) {
  const entries = Object.entries(serviceRevenueMap);
  return (
    <div className="space-y-4">
      {entries.length === 0 ? (
        <EmptyState text="Aucun service vendu." />
      ) : (
        <div className="space-y-2">
          {entries.map(([key, v]) => (
            <div key={key} className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3">
              <span className="flex-1 text-sm font-semibold">{v.label}</span>
              <span className="text-xs text-muted-foreground">{v.count}x</span>
              <span className="font-mono font-extrabold text-primary">{v.total.toLocaleString("fr-FR")} FCFA</span>
            </div>
          ))}
        </div>
      )}
      {purchases.length > 0 && (
        <div>
          <p className="text-xs font-extrabold mb-2">Achats de services ({purchases.length})</p>
          <div className="space-y-2">
            {purchases.map((prc) => {
              const active = isServiceActive(prc);
              return (
                <div key={prc.id} className="rounded-2xl border border-border bg-card p-3 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate font-semibold">{prc.expand?.user?.name || prc.expand?.user?.email || prc.user}</span>
                    <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase flex-shrink-0 ${active ? "bg-accent/15 text-accent" : "bg-muted text-muted-foreground"}`}>{active ? "actif" : prc.status}</span>
                  </div>
                  <div className="mt-2 flex gap-1.5">
                    {!active && (
                      <button onClick={() => setPurchaseStatus(prc, "active")} className="rounded-lg bg-accent px-2 py-1 text-[10px] font-bold text-accent-foreground">Activer</button>
                    )}
                    {active && (
                      <button onClick={() => setPurchaseStatus(prc, "expired")} className="rounded-lg border border-border px-2 py-1 text-[10px] font-bold">Désactiver</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function TabPro({ proAccounts, activeProAccounts, proRevenue, setProAccountStatus }) {
  const p = usePaginate(proAccounts);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-2xl border border-border bg-card p-3 text-center">
          <p className="text-2xl font-extrabold text-primary">{activeProAccounts.length}</p>
          <p className="text-[10px] text-muted-foreground">Actifs</p>
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-accent to-accent/80 p-3 text-accent-foreground">
          <p className="text-xl font-extrabold">{proRevenue.toLocaleString("fr-FR")} FCFA</p>
          <p className="text-[10px] opacity-80">Revenus</p>
        </div>
      </div>
      {proAccounts.length === 0 ? (
        <EmptyState text="Aucun compte pro." />
      ) : (
        <div className="space-y-2">
          {p.shown.map((pa) => (
            <div key={pa.id} className="rounded-2xl border border-border bg-card p-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate font-semibold">{pa.org_name}</span>
                <span className="text-[10px] text-muted-foreground">{pa.org_type} · {pa.plan}</span>
                <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                  pa.status === "active" ? "bg-accent/15 text-accent" : pa.status === "suspended" ? "bg-destructive/15 text-destructive" : "bg-muted text-muted-foreground"
                }`}>{pa.status}</span>
              </div>
              <div className="mt-2 flex gap-1.5">
                {pa.status !== "active" && (
                  <button onClick={() => setProAccountStatus(pa, "active")} className="rounded-lg bg-accent px-2 py-1 text-[10px] font-bold text-accent-foreground">Activer</button>
                )}
                {pa.status === "active" && (
                  <button onClick={() => setProAccountStatus(pa, "suspended")} className="rounded-lg bg-destructive px-2 py-1 text-[10px] font-bold text-destructive-foreground">Suspendre</button>
                )}
              </div>
            </div>
          ))}
          <ListFooter {...p} total={proAccounts.length} />
        </div>
      )}
    </div>
  );
}

function TabCommissions({ totalCommission, paidWithdrawals, avgWithdrawal, totalWithdrawn, totalPointsWithdrawn }) {
  return (
    <div className="space-y-3">
      <div className="rounded-2xl bg-gradient-to-br from-accent to-accent/80 p-4 text-accent-foreground">
        <p className="text-2xl font-extrabold">{totalCommission.toLocaleString("fr-FR")} FCFA</p>
        <p className="text-xs opacity-80">Commissions totales collectées (5% sur retraits)</p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-2xl border border-border bg-card p-3 text-center">
          <p className="text-lg font-extrabold text-primary">{paidWithdrawals.length}</p>
          <p className="text-[9px] text-muted-foreground">Retraits payés</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-3 text-center">
          <p className="text-lg font-extrabold text-accent">{totalWithdrawn.toLocaleString("fr-FR")}</p>
          <p className="text-[9px] text-muted-foreground">Total versé (FCFA)</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-3 text-center">
          <p className="text-lg font-extrabold">{avgWithdrawal.toLocaleString("fr-FR")}</p>
          <p className="text-[9px] text-muted-foreground">Moyen (FCFA)</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-2xl border border-border bg-card p-2 text-center">
          <p className="text-sm font-extrabold text-primary">{totalPointsWithdrawn.toLocaleString("fr-FR")}</p>
          <p className="text-[9px] text-muted-foreground">Points retirés</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-2 text-center">
          <p className="text-sm font-extrabold text-accent">{paidWithdrawals.length > 0 ? Math.round(totalCommission / paidWithdrawals.length) : 0} FCFA</p>
          <p className="text-[9px] text-muted-foreground">Commission moy./retrait</p>
        </div>
      </div>
    </div>
  );
}

function TabPub({ impressions, clicks, ctr }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <div className="rounded-2xl border border-border bg-card p-3 text-center">
        <p className="text-lg font-extrabold text-primary">{impressions.toLocaleString("fr-FR")}</p>
        <p className="text-[9px] text-muted-foreground">Impressions</p>
      </div>
      <div className="rounded-2xl border border-border bg-card p-3 text-center">
        <p className="text-lg font-extrabold text-primary">{clicks.toLocaleString("fr-FR")}</p>
        <p className="text-[9px] text-muted-foreground">Clics</p>
      </div>
      <div className="rounded-2xl border border-border bg-card p-3 text-center">
        <p className="text-lg font-extrabold text-accent">{ctr}%</p>
        <p className="text-[9px] text-muted-foreground">CTR</p>
      </div>
    </div>
  );
}

function TabPV({ pvs }) {
  const p = usePaginate(pvs);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-2xl border border-border bg-card p-2 text-center">
          <p className="text-lg font-extrabold text-primary">{pvs.length}</p>
          <p className="text-[9px] text-muted-foreground">Total</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-2 text-center">
          <p className="text-lg font-extrabold text-accent">{pvs.filter((pv) => pv.type === "deposit").length}</p>
          <p className="text-[9px] text-muted-foreground">Dépôts</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-2 text-center">
          <p className="text-lg font-extrabold text-accent">{pvs.filter((pv) => pv.type === "restitution").length}</p>
          <p className="text-[9px] text-muted-foreground">Restit.</p>
        </div>
      </div>
      <div className="flex gap-2">
        <Link to="/pv-depot" className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-primary px-3 py-2.5 text-xs font-bold text-primary-foreground active:scale-[0.97]">
          <FileText className="h-3.5 w-3.5" /> Dépôt
        </Link>
        <Link to="/pv-restitution" className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-accent px-3 py-2.5 text-xs font-bold text-accent-foreground active:scale-[0.97]">
          <FileCheck2 className="h-3.5 w-3.5" /> Restitution
        </Link>
      </div>
      {pvs.length === 0 ? (
        <EmptyState text="Aucun PV." />
      ) : (
        <div className="space-y-2">
          {p.shown.map((pv) => (
            <div key={pv.id} className="rounded-2xl border border-border bg-card p-3 text-xs">
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase ${TYPE_BADGE[pv.type] || "bg-muted text-muted-foreground"}`}>
                  {TYPE_LABELS[pv.type] || pv.type}
                </span>
                <span className="min-w-0 flex-1 truncate font-semibold">{pv.pv_number}</span>
                <span className="text-[10px] text-muted-foreground">{formatDateTimeFr(pv.created)}</span>
              </div>
              <div className="mt-1 text-[10px] text-muted-foreground">
                {pv.object_category || "—"} · {pv.expand?.generated_by?.name || "—"}
              </div>
              <div className="mt-2 flex gap-1.5">
                <button onClick={() => downloadPV(pv)} className="flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-[10px] font-bold">
                  <Download className="h-3 w-3" /> Télécharger le PDF
                </button>
              </div>
            </div>
          ))}
          <ListFooter {...p} total={pvs.length} />
        </div>
      )}
    </div>
  );
}

function TabInstallations({ installations }) {
  const p = usePaginate(installations);
  const platformCounts = {};
  installations.forEach((i) => {
    const plat = i.platform || "inconnu";
    platformCounts[plat] = (platformCounts[plat] || 0) + 1;
  });
  const uniqueUsers = new Set(installations.filter((i) => i.user).map((i) => i.user)).size;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-gradient-to-br from-primary via-primary/90 to-accent p-4 text-primary-foreground">
        <p className="text-3xl font-extrabold">{installations.length}</p>
        <p className="text-xs opacity-80">Installations totales de l&apos;app</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-2xl border border-border bg-card p-2 text-center">
          <p className="text-lg font-extrabold text-primary">{uniqueUsers}</p>
          <p className="text-[9px] text-muted-foreground">Utilisateurs uniques</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-2 text-center">
          <p className="text-lg font-extrabold text-accent">{installations.length}</p>
          <p className="text-[9px] text-muted-foreground">Total installs</p>
        </div>
      </div>
      {Object.keys(platformCounts).length > 0 && (
        <div>
          <p className="text-xs font-extrabold mb-2">Par plateforme</p>
          <div className="space-y-1.5">
            {Object.entries(platformCounts).sort((a, b) => b[1] - a[1]).map(([plat, count]) => (
              <div key={plat} className="flex items-center gap-2 rounded-2xl border border-border bg-card px-3 py-2 text-xs">
                <Smartphone className="h-3.5 w-3.5 text-primary" />
                <span className="flex-1 font-semibold">{plat}</span>
                <span className="font-extrabold text-primary">{count}x</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <div>
        <p className="text-xs font-extrabold mb-2">Détail</p>
        {installations.length === 0 ? (
          <EmptyState text="Aucune installation." />
        ) : (
          <div className="space-y-2">
            {p.shown.map((inst) => (
              <div key={inst.id} className="rounded-2xl border border-border bg-card p-3 text-xs">
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate font-semibold">
                    {inst.expand?.user?.name || inst.expand?.user?.email || "Anonyme"}
                  </span>
                  <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold text-primary">
                    {inst.platform || "?"}
                  </span>
                </div>
                <p className="mt-1 text-[10px] text-muted-foreground truncate">
                  {inst.user_agent || "—"}
                </p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  {new Date(inst.installed_at || inst.created_at).toLocaleDateString("fr-FR")}{" "}
                  {new Date(inst.installed_at || inst.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            ))}
            <ListFooter {...p} total={installations.length} />
          </div>
        )}
      </div>
    </div>
  );
}

const SUBJECT_LABELS = {
  compte_supprime: "Compte supprimé",
  compte_bloque: "Compte bloqué",
  mot_de_passe: "Mot de passe",
  objet: "Objet perdu/retrouvé",
  point: "Points / Récompenses",
  signalement: "Signalement",
  autre: "Autre",
};

function TabDiffusion({ usersCount }) {
  const [title, setTitle] = useState("");
  const [msg, setMsg] = useState("");
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);

  const send = async () => {
    if (!title.trim() || !msg.trim()) {
      toast.error("Titre et message sont requis");
      return;
    }
    if (!confirm(`Envoyer ce message push à ${usersCount} utilisateur(s) inscrit(s) ?\n\n« ${title.trim()} »`)) return;
    setBusy(true);
    try {
      const res = await fetch("/api/broadcast-notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), body: msg.trim(), link: link.trim() || "/" }),
      });
      const data = await res.json();
      if (data.statut) {
        toast.success(`Push envoyé à ${data.sent} utilisateur(s)`);
        setTitle("");
        setMsg("");
        setLink("");
      } else {
        toast.error(data.message || "Erreur d'envoi");
      }
    } catch (_) {
      toast.error("Erreur réseau");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="rounded-2xl bg-gradient-to-br from-primary to-accent p-4 text-primary-foreground">
        <p className="flex items-center gap-2 text-sm font-extrabold">
          <Send className="h-4 w-4" /> Diffusion push
        </p>
        <p className="mt-1 text-xs opacity-85">
          Envoyez un message qui s&apos;affiche sur l&apos;écran des
          utilisateurs, même hors de l&apos;app. Au clic, l&apos;app s&apos;ouvre
          sur le lien choisi — {usersCount} utilisateur(s) inscrit(s).
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
        <div>
          <label className="text-xs font-bold text-muted-foreground">Titre *</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder='Ex : RetrouveMoi vous souhaite un bon week-end'
            className="mt-1.5 w-full rounded-xl border border-input bg-background px-3.5 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
          />
        </div>
        <div>
          <label className="text-xs font-bold text-muted-foreground">Message *</label>
          <textarea
            rows={4}
            value={msg}
            onChange={(e) => setMsg(e.target.value)}
            placeholder='Ex : Si vous rencontrez des difficultés sur RetrouveMoi, notre équipe reste à votre écoute. Bon week-end !'
            className="mt-1.5 w-full resize-none rounded-xl border border-input bg-background px-3.5 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
          />
        </div>
        <div>
          <label className="text-xs font-bold text-muted-foreground">
            Page à ouvrir au clic (optionnel)
          </label>
          <input
            type="text"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="Ex : /recherche (ou vide = accueil)"
            className="mt-1.5 w-full rounded-xl border border-input bg-background px-3.5 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
          />
        </div>
        <button
          type="button"
          disabled={busy || usersCount === 0}
          onClick={send}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3.5 text-sm font-extrabold text-primary-foreground shadow-lg active:scale-[0.98] transition-all disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {busy ? "Envoi en cours…" : "Envoyer à tous"}
        </button>
      </div>

      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
        <p className="flex items-center gap-2 text-xs font-extrabold text-primary">
          <Globe className="h-4 w-4" /> Exemples d&apos;utilisation
        </p>
        <ul className="mt-2 space-y-1.5 text-xs text-muted-foreground">
          <li>• « RetrouveMoi vous souhaite un bon week-end »</li>
          <li>• « Des difficultés sur RetrouveMoi ? Répondez à ce message, on vous aide »</li>
          <li>• Annonce d&apos;une nouvelle fonctionnalité</li>
        </ul>
      </div>
    </div>
  );
}

function TabSupport({ supportMessages, setSupportMessages, load }) {
  const [filter, setFilter] = useState("all");
  const [replyTarget, setReplyTarget] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [busyId, setBusyId] = useState(null);

  const filtered = useMemo(() => {
    if (filter === "all") return supportMessages;
    return supportMessages.filter((m) => m.status === filter);
  }, [supportMessages, filter]);

  const counts = useMemo(() => {
    const c = { all: supportMessages.length, new: 0, read: 0, replied: 0, closed: 0 };
    supportMessages.forEach((m) => { c[m.status] = (c[m.status] || 0) + 1; });
    return c;
  }, [supportMessages]);

  const markRead = async (msg) => {
    if (msg.status !== "new") return;
    setBusyId(msg.id);
    try {
      await pb.collection("support_messages").update(msg.id, { status: "read" });
      setSupportMessages((prev) => prev.map((m) => m.id === msg.id ? { ...m, status: "read" } : m));
    } catch (e) {
      toast.error("Erreur", { description: e?.message });
    } finally {
      setBusyId(null);
    }
  };

  const markClosed = async (msg) => {
    setBusyId(msg.id);
    try {
      await pb.collection("support_messages").update(msg.id, { status: "closed" });
      setSupportMessages((prev) => prev.map((m) => m.id === msg.id ? { ...m, status: "closed" } : m));
      toast.success("Message clôturé");
    } catch (e) {
      toast.error("Erreur", { description: e?.message });
    } finally {
      setBusyId(null);
    }
  };

  const sendReply = async () => {
    if (!replyTarget || !replyText.trim()) return;
    setBusyId(replyTarget.id);
    try {
      await pb.collection("support_messages").update(replyTarget.id, {
        status: "replied",
        admin_reply: replyText.trim(),
        replied_at: new Date().toISOString(),
      });
      setSupportMessages((prev) => prev.map((m) => m.id === replyTarget.id
        ? { ...m, status: "replied", admin_reply: replyText.trim(), replied_at: new Date().toISOString() }
        : m));
      toast.success("Réponse envoyée");
      setReplyTarget(null);
      setReplyText("");
    } catch (e) {
      toast.error("Erreur", { description: e?.message });
    } finally {
      setBusyId(null);
    }
  };

  const deleteMessage = async (msg) => {
    if (!confirm(`Supprimer le message de ${msg.name} ?`)) return;
    setBusyId(msg.id);
    try {
      await pb.collection("support_messages").delete(msg.id);
      setSupportMessages((prev) => prev.filter((m) => m.id !== msg.id));
      toast.success("Message supprimé");
    } catch (e) {
      toast.error("Erreur", { description: e?.message });
    } finally {
      setBusyId(null);
    }
  };

  const statusColor = (s) => {
    if (s === "new") return "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300";
    if (s === "read") return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300";
    if (s === "replied") return "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300";
    return "bg-muted text-muted-foreground";
  };

  const statusLabel = { new: "Nouveau", read: "Lu", replied: "Répondu", closed: "Clôturé" };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-lg font-extrabold flex items-center gap-2">
          <Mail className="h-5 w-5" /> Messages de support
          <span className="ml-2 text-sm font-bold text-muted-foreground">({counts.all})</span>
        </h2>
      </div>

      <div className="flex gap-2 flex-wrap">
        {["all", "new", "read", "replied", "closed"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${filter === f ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
          >
            {f === "all" ? "Tous" : statusLabel[f]} ({counts[f] || 0})
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground text-sm">
          Aucun message{filter !== "all" ? ` avec statut « ${statusLabel[filter]} »` : ""}.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((msg) => (
            <div
              key={msg.id}
              className={`rounded-xl border bg-card p-4 shadow-sm transition ${msg.status === "new" ? "border-blue-300 dark:border-blue-700" : "border-border"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${statusColor(msg.status)}`}>
                      {statusLabel[msg.status] || msg.status}
                    </span>
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold text-secondary-foreground">
                      {SUBJECT_LABELS[msg.subject] || msg.subject}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(msg.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <p className="font-bold text-sm">{msg.name}</p>
                  <p className="text-xs text-muted-foreground">{msg.email}{msg.phone ? ` · ${msg.phone}` : ""}</p>
                  <p className="mt-2 text-sm whitespace-pre-wrap">{msg.message}</p>

                  {msg.admin_reply && (
                    <div className="mt-3 rounded-lg bg-primary/5 border border-primary/20 p-3">
                      <p className="text-[10px] font-bold uppercase text-primary mb-1">
                        Réponse admin · {msg.replied_at ? new Date(msg.replied_at).toLocaleDateString("fr-FR") : ""}
                      </p>
                      <p className="text-sm whitespace-pre-wrap">{msg.admin_reply}</p>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-1.5 shrink-0">
                  {msg.status === "new" && (
                    <button
                      onClick={() => markRead(msg)}
                      disabled={busyId === msg.id}
                      className="rounded-lg bg-yellow-500/10 px-2.5 py-1.5 text-[10px] font-bold text-yellow-600 hover:bg-yellow-500/20 transition dark:bg-yellow-500/15 dark:text-yellow-400"
                    >
                      Marquer lu
                    </button>
                  )}
                  <button
                    onClick={() => { setReplyTarget(msg); setReplyText(msg.admin_reply || ""); }}
                    className="rounded-lg bg-primary/10 px-2.5 py-1.5 text-[10px] font-bold text-primary hover:bg-primary/20 transition dark:bg-primary/20 dark:text-primary"
                  >
                    {msg.admin_reply ? "Modifier" : "Répondre"}
                  </button>
                  {msg.status !== "closed" && (
                    <button
                      onClick={() => markClosed(msg)}
                      disabled={busyId === msg.id}
                      className="rounded-lg bg-muted px-2.5 py-1.5 text-[10px] font-bold text-muted-foreground hover:bg-muted/80 transition"
                    >
                      Clôturer
                    </button>
                  )}
                  <button
                    onClick={() => deleteMessage(msg)}
                    disabled={busyId === msg.id}
                    className="rounded-lg bg-destructive/10 px-2.5 py-1.5 text-[10px] font-bold text-red-600 hover:bg-destructive/20 transition dark:bg-red-500/15 dark:text-red-400"
                  >
                    <Trash2 className="h-3 w-3 inline mr-0.5" />
                    Supprimer
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reply modal */}
      {replyTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setReplyTarget(null)}>
          <div className="w-full max-w-lg rounded-2xl bg-card border border-border p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-extrabold text-lg">Répondre à {replyTarget.name}</h3>
              <button onClick={() => setReplyTarget(null)} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground mb-3">{replyTarget.email} · {SUBJECT_LABELS[replyTarget.subject]}</p>
            <div className="rounded-lg bg-muted/50 p-3 mb-3">
              <p className="text-sm whitespace-pre-wrap">{replyTarget.message}</p>
            </div>
            <textarea
              className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30 min-h-[100px] resize-y"
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Votre réponse..."
              rows={4}
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setReplyTarget(null)}
                className="rounded-xl px-4 py-2 text-sm font-bold bg-muted text-muted-foreground hover:bg-muted/80 transition"
              >
                Annuler
              </button>
              <button
                onClick={sendReply}
                disabled={busyId === replyTarget.id || !replyText.trim()}
                className="rounded-xl px-4 py-2 text-sm font-bold bg-primary text-primary-foreground shadow hover:opacity-90 transition disabled:opacity-50"
              >
                {busyId === replyTarget.id ? <Loader2 className="h-4 w-4 animate-spin inline mr-1" /> : <Send className="h-4 w-4 inline mr-1" />}
                Envoyer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminPage;
