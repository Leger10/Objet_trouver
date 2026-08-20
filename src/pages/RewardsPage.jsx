import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowDownToLine,
  CheckCircle2,
  Clock,
  XCircle,
  Loader2,
  ShieldCheck,
  AlertTriangle,
  Eye,
  EyeOff,
} from "lucide-react";
import { pb } from "@/lib/supabaseClient";
import Layout from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import {
  BADGES,
  SERVICES,
  GIFTS,
  getBadge,
  isServiceActive,
  daysLeft,
  serviceByKey,
  maskPhone,
} from "@/lib/retrouve";
import { usePaginate, ListFooter } from "@/components/PaginatedList";
import PaymentMethodPicker from "@/components/PaymentMethodPicker";
import {
  FCFA_SERVICES,
  computeCommission,
  computeNet,
} from "@/lib/payments";
import {
  createPendingPayment,
  initiateWithdrawal,
  createWithdrawalRecord,
  getWithdrawMode,
} from "@/lib/moneyfusion";

const card = "rounded-2xl border border-border bg-card p-5";
const TABS = ["Statut", "Boutique", "Cadeaux", "Retrait", "Historique"];

const statusIcon = (s) => {
  if (s === "active" || s === "paid" || s === "delivered")
    return <CheckCircle2 className="h-4 w-4 text-accent" />;
  if (s === "rejected" || s === "cancelled")
    return <XCircle className="h-4 w-4 text-destructive" />;
  return <Clock className="h-4 w-4 text-muted-foreground" />;
};

const STATUS_LABELS = {
  pending: "En attente",
  approved: "Approuvé",
  paid: "Payé",
  rejected: "Refusé",
  active: "Actif",
  expired: "Expiré",
  processing: "En cours",
  delivered: "Livré",
  cancelled: "Annulé",
};

const RewardsPage = () => {
  const { user } = useAuth();
  const [tab, setTab] = useState(0);
  const [purchases, setPurchases] = useState([]);
  const [gifts, setGifts] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [ledger, setLedger] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // Withdrawal form state
  const [wPoints, setWPoints] = useState("");
  const [wMethod, setWMethod] = useState("");
  const [wDetails, setWDetails] = useState("");
  const [wName, setWName] = useState("");
  const [showPhone, setShowPhone] = useState(false);

  // Confirmation dialog state
  const [confirm, setConfirm] = useState(null); // { type, payload }

  // FCFA service checkout
  const [fcfaCheckout, setFcfaCheckout] = useState(null); // service being bought with FCFA
  const [fcfaDone, setFcfaDone] = useState(null);

  const freshUser = () =>
    pb
      .collection("users")
      .getOne(user?.id || "")
      .catch(() => null);

  const [liveUser, setLiveUser] = useState(null);
  const currentUser = liveUser || user;
  const points = currentUser?.points || 0;
  const pointsEarned = currentUser?.points_earned || 0;
  const badge = getBadge(pointsEarned);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [pu, go, wd, lg, u] = await Promise.all([
        pb
          .collection("point_purchases")
          .getFullList({ sort: "-created", requestKey: "rw-pu" }),
        pb
          .collection("gift_orders")
          .getFullList({ sort: "-created", requestKey: "rw-go" }),
        pb
          .collection("withdrawals")
          .getFullList({ sort: "-created", requestKey: "rw-wd" }),
        pb.collection("points_ledger").getFullList({
          filter: pb.filter('"user" = {:u}', { u: user.id }),
          sort: "-created",
          requestKey: "rw-lg",
        }),
        freshUser(),
      ]);
      setPurchases(pu);
      setGifts(go);
      setWithdrawals(wd);
      setLedger(lg);
      if (u) setLiveUser(u);
    } catch (_) {}
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  // Active services (not expired)
  const activeServices = useMemo(
    () => purchases.filter(isServiceActive),
    [purchases],
  );
  const activeServiceKeys = useMemo(
    () => new Set(activeServices.map((p) => p.service)),
    [activeServices],
  );

  const buyService = async (svc) => {
    setBusy(true);
    try {
      await pb.collection("point_purchases").create({
        user: user.id,
        service: svc.key,
        points_cost: svc.cost,
        status: "active",
      });
      toast.success(`« ${svc.label} » activé`, {
        description: `-${svc.cost} pts · valable ${svc.duration} jours`,
      });
      load();
    } catch (e) {
      toast.error(
        e?.response?.message || "Achat impossible : solde insuffisant.",
      );
    }
    setBusy(false);
  };

  const buyServiceWithFcfa = async (method, ref) => {
    if (!fcfaCheckout || !user) return;
    setBusy(true);
    try {
      await createPendingPayment({
        userId: user.id,
        type: "service",
        itemKey: fcfaCheckout.key,
        itemLabel: fcfaCheckout.label,
        amountFcfa: fcfaCheckout.price,
        description: ref ? `Réf: ${ref}` : "",
      });
      setFcfaDone(fcfaCheckout);
      setFcfaCheckout(null);
      toast.success("Paiement enregistré", {
        description: "Service activé sous 24h après validation.",
      });
    } catch (e) {
      toast.error(e?.response?.message || "Erreur lors du paiement.");
    }
    setBusy(false);
  };

  const orderGift = async (gift, deliveryInfo) => {
    setBusy(true);
    try {
      await pb.collection("gift_orders").create({
        user: user.id,
        gift_type: gift.key,
        points_cost: gift.cost,
        status: "pending",
        delivery_info: deliveryInfo,
      });
      toast.success(`« ${gift.label} » commandé`, {
        description: "Vous serez contacté sous 48h.",
      });
      load();
    } catch (e) {
      toast.error(e?.response?.message || "Erreur lors de la commande.");
    }
    setBusy(false);
  };

  const requestWithdrawal = async () => {
    const pts = parseInt(wPoints, 10);
    if (!pts || pts < 5000) {
      toast.error("Montant minimum : 5 000 points.");
      return;
    }
    if (pts > points) {
      toast.error("Solde insuffisant.");
      return;
    }
    if (!wName.trim()) {
      toast.error("Veuillez indiquer le nom sur le compte mobile money.");
      return;
    }
    if (!wMethod.trim()) {
      toast.error("Veuillez indiquer un moyen de paiement.");
      return;
    }
    const digits = (wDetails || "").replace(/\D/g, "");
    if (digits.length < 8) {
      toast.error("Numéro de téléphone invalide : au moins 8 chiffres.");
      return;
    }
    setConfirm({
      type: "withdraw",
      payload: { pts, method: wMethod, details: wDetails, name: wName.trim() },
    });
  };

  const confirmWithdrawal = async () => {
    const { pts, method, details, name } = confirm.payload;
    setBusy(true);
    try {
      const netAmount = computeNet(pts);
      const commission = computeCommission(pts);
      const withdrawMode = getWithdrawMode(method);

      // Debit points immediately
      const debitAmount = -pts;
      await pb.collection("points_ledger").create({
        user: user.id,
        amount: debitAmount,
        reason: "withdrawal",
        description: `Retrait de ${pts} pts via ${method}`,
      });
      await pb.collection("users").update(user.id, {
        "points-": pts,
      });

      // Create pending withdrawal record
      const rec = await createWithdrawalRecord({
        userId: user.id,
        amountPoints: pts,
        amountFcfa: pts,
        commissionFcfa: commission,
        netAmount,
        phone: details.trim(),
        withdrawMode,
      });

      // Initiate MoneyFusion payout
      try {
        const mfResult = await initiateWithdrawal({
          phone: details.trim(),
          amount: netAmount,
          withdrawMode,
          countryCode: "ci",
        });
        if (mfResult.tokenPay) {
          await pb.collection("withdrawals").update(rec.id, {
            moneyfusion_token: mfResult.tokenPay,
          });
        }
      } catch (mfErr) {
        console.error("MoneyFusion payout error:", mfErr);
      }

      toast.success(`Retrait de ${pts} pts demandé`, {
        description: `${computeNet(pts).toLocaleString()} FCFA envoyés à ${name}. Commission : ${commission} FCFA.`,
      });
      setWPoints("");
      setWMethod("");
      setWDetails("");
      setWName("");
      load();
    } catch (e) {
      toast.error(e?.response?.message || "Erreur lors de la demande.");
    }
    setBusy(false);
    setConfirm(null);
  };

  const nextBadge = BADGES.find((b) => pointsEarned < b.threshold);
  const progressPct = nextBadge
    ? Math.min(100, Math.round((pointsEarned / nextBadge.threshold) * 100))
    : 100;

  // This-month stats from ledger
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

  // Transaction filter
  const [txFilter, setTxFilter] = useState("all");
  const filteredLedger = useMemo(() => {
    if (txFilter === "gains") return ledger.filter((l) => (l.amount || 0) > 0);
    if (txFilter === "depenses")
      return ledger.filter((l) => (l.amount || 0) < 0);
    return ledger;
  }, [ledger, txFilter]);

  // Running balance after each transaction (reverse chronological → compute forward)
  const ledgerWithBalance = useMemo(() => {
    const sorted = [...filteredLedger].sort(
      (a, b) => new Date(a.created) - new Date(b.created),
    );
    let bal = 0;
    const mapped = sorted.map((l) => {
      bal += l.amount || 0;
      return { ...l, balanceAfter: bal };
    });
    return mapped.reverse();
  }, [filteredLedger]);

  const withdrawalPaginate = usePaginate(withdrawals);
  const ledgerPaginate = usePaginate(ledgerWithBalance);
  const giftsPaginate = usePaginate(gifts);
  const purchasesPaginate = usePaginate(purchases);

  return (
    <Layout>
      <Helmet>
        <title>Mes récompenses — RetrouveMoi</title>
        <meta
          name="description"
          content="Gérez vos points, achetez des services premium, commandez des cadeaux et retirez vos gains sur RetrouveMoi."
        />
      </Helmet>
      <div className="mx-auto w-full max-w-[90rem] px-4 py-10">
        <h1 className="text-2xl sm:text-3xl font-extrabold">Mes récompenses</h1>
        <p className="mt-1 text-muted-foreground text-sm">
          Convertissez vos points en argent, services ou cadeaux.
        </p>

        {/* Balance bar */}
        <div className="mt-6 flex flex-wrap gap-4 items-center rounded-2xl bg-primary text-primary-foreground p-5">
          <div>
            <p className="text-xs font-semibold opacity-80">Solde disponible</p>
            <p className="text-3xl font-extrabold">
              {points.toLocaleString()} pts
            </p>
          </div>
          <div className="hidden sm:block h-10 w-px bg-primary-foreground/20" />
          <div>
            <p className="text-xs font-semibold opacity-80">Total cumulé</p>
            <p className="text-xl font-bold">
              {pointsEarned.toLocaleString()} pts
            </p>
          </div>
          {badge && (
            <>
              <div className="hidden sm:block h-10 w-px bg-primary-foreground/20" />
              <div>
                <p className="text-xs font-semibold opacity-80">
                  Statut actuel
                </p>
                <p className="text-xl font-bold">
                  {badge.emoji} {badge.label}
                </p>
              </div>
            </>
          )}
          <Link
            to="/tableau-de-bord"
            className="ml-auto text-sm font-bold opacity-85 underline underline-offset-4"
          >
            Tableau de bord
          </Link>
        </div>

        {/* This-month mini stats */}
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-secondary/60 px-4 py-3">
            <p className="text-xs font-semibold text-muted-foreground">
              Gagnés ce mois-ci
            </p>
            <p className="text-lg font-extrabold text-accent">
              +{monthEarned.toLocaleString()} pts
            </p>
          </div>
          <div className="rounded-2xl bg-muted px-4 py-3">
            <p className="text-xs font-semibold text-muted-foreground">
              Dépensés ce mois-ci
            </p>
            <p className="text-lg font-extrabold text-destructive">
              -{monthSpent.toLocaleString()} pts
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-6 flex gap-1 overflow-x-auto pb-1">
          {TABS.map((t, i) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(i)}
              className={`shrink-0 rounded-xl px-4 py-2.5 text-sm font-bold transition-colors ${
                tab === i
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted hover:bg-muted/80"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {loading && (
          <div className="mt-8 flex justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* TAB 0 — Statuts & badges */}
        {!loading && tab === 0 && (
          <div className="mt-6 space-y-6">
            <div className={card}>
              <h2 className="text-lg font-extrabold mb-4">Votre progression</h2>
              <div className="space-y-4">
                {BADGES.map((b) => {
                  const reached = pointsEarned >= b.threshold;
                  return (
                    <div
                      key={b.key}
                      className={`flex items-center gap-4 rounded-2xl p-4 border ${reached ? "border-accent bg-secondary" : "border-border bg-muted/40"}`}
                    >
                      <span className="text-2xl">{b.emoji}</span>
                      <div className="flex-1">
                        <p className="font-bold">{b.label}</p>
                        <p className="text-sm text-muted-foreground">
                          {b.threshold.toLocaleString()} pts cumulés
                        </p>
                      </div>
                      {reached ? (
                        <span className="text-xs font-bold text-accent bg-accent/10 rounded-full px-3 py-1">
                          Obtenu
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {(b.threshold - pointsEarned).toLocaleString()} pts
                          restants
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            {nextBadge && (
              <div className={card}>
                <p className="text-sm font-semibold mb-2">
                  Progression vers {nextBadge.emoji} {nextBadge.label}
                </p>
                <div className="h-3 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-500"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {pointsEarned} / {nextBadge.threshold} pts ({progressPct}%)
                </p>
              </div>
            )}
            {activeServices.length > 0 && (
              <div className={card}>
                <h2 className="text-lg font-extrabold mb-4">Services actifs</h2>
                <ul className="space-y-2">
                  {activeServices.map((p) => {
                    const svc = serviceByKey(p.service);
                    const dl = daysLeft(p.expires_at);
                    return (
                      <li
                        key={p.id}
                        className="flex items-center gap-3 rounded-2xl border border-accent/30 bg-secondary/40 px-4 py-3 text-sm"
                      >
                        <span className="text-xl">{svc?.emoji || "✨"}</span>
                        <span className="flex-1 font-bold">
                          {svc?.label || p.service}
                        </span>
                        <span className="text-xs font-bold text-accent">
                          {dl != null ? `${dl}j restants` : "Actif"}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* TAB 1 — Boutique de services */}
        {!loading && tab === 1 && (
          <div className="mt-6">
            <div className="mb-4 rounded-2xl bg-muted px-4 py-3 text-sm text-muted-foreground">
              Solde actuel :{" "}
              <span className="font-extrabold text-primary">
                {points.toLocaleString()} pts
              </span>
              . Chaque service est valable 30 jours (365 jours pour le profil
              vérifié).
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {SERVICES.map((svc) => {
                const owned = activeServiceKeys.has(svc.key);
                const canAfford = points >= svc.cost;
                const fcfaSvc = FCFA_SERVICES.find((f) => f.key === svc.key);
                return (
                  <div key={svc.key} className={`${card} flex flex-col gap-3`}>
                    <div className="flex items-start justify-between">
                      <span className="text-3xl">{svc.emoji}</span>
                      {owned && (
                        <span className="rounded-full bg-accent/10 px-2.5 py-1 text-[10px] font-bold text-accent">
                          ACTIF
                        </span>
                      )}
                    </div>
                    <div>
                      <p className="font-bold">{svc.label}</p>
                      <p className="text-sm text-muted-foreground">
                        {svc.desc}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Valable {svc.duration} jours
                    </p>
                    <div className="mt-auto space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-extrabold text-primary">
                          {svc.cost.toLocaleString()} pts
                        </span>
                        {fcfaSvc && (
                          <span className="font-mono text-xs font-bold text-muted-foreground">
                            ou {fcfaSvc.price.toLocaleString()} FCFA
                          </span>
                        )}
                      </div>
                      <div className="flex gap-2">
                        {owned ? (
                          <span className="flex-1 rounded-xl bg-accent/10 px-4 py-2 text-center text-sm font-bold text-accent">
                            Possédé
                          </span>
                        ) : (
                          <button
                            type="button"
                            disabled={busy || !canAfford}
                            onClick={() =>
                              setConfirm({ type: "service", payload: svc })
                            }
                            className={`flex-1 rounded-xl px-3 py-2 text-sm font-bold transition-colors ${
                              canAfford
                                ? "bg-primary text-primary-foreground hover:opacity-90"
                                : "bg-muted text-muted-foreground cursor-not-allowed"
                            }`}
                          >
                            Points
                          </button>
                        )}
                        {fcfaSvc && !owned && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => setFcfaCheckout(fcfaSvc)}
                            className="flex-1 rounded-xl border-2 border-primary px-3 py-2 text-sm font-bold text-primary transition-colors hover:bg-primary/5"
                          >
                            {fcfaSvc.price.toLocaleString()} FCFA
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 2 — Catalogue de cadeaux */}
        {!loading && tab === 2 && (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
            {GIFTS.map((gift) => {
              const canAfford = points >= gift.cost;
              return (
                <div key={gift.key} className={`${card} flex flex-col gap-3`}>
                  <span className="text-3xl">{gift.emoji}</span>
                  <div>
                    <p className="font-bold">{gift.label}</p>
                    <p className="text-lg font-extrabold text-accent">
                      {gift.value}
                    </p>
                  </div>
                  <div className="mt-auto flex items-center justify-between">
                    <span className="font-mono font-extrabold text-primary">
                      {gift.cost.toLocaleString()} pts
                    </span>
                    <button
                      type="button"
                      disabled={busy || !canAfford}
                      onClick={() => {
                        const deliveryInfo = prompt(
                          `Entrez votre numéro de téléphone ou adresse de livraison pour « ${gift.label} » :`,
                        );
                        if (deliveryInfo) {
                          if (points < gift.cost) {
                            toast.error("Solde insuffisant.");
                            return;
                          }
                          orderGift(gift, deliveryInfo);
                        }
                      }}
                      className={`rounded-xl px-4 py-2 text-sm font-bold transition-colors ${
                        canAfford
                          ? "bg-primary text-primary-foreground hover:opacity-90"
                          : "bg-muted text-muted-foreground cursor-not-allowed"
                      }`}
                    >
                      Commander
                    </button>
                  </div>
                </div>
              );
            })}
            <div className="col-span-full rounded-2xl border border-dashed border-border p-5 text-sm text-muted-foreground">
              Commandes traitées sous 48h ouvrées. Vous serez contacté via
              l'email de votre compte.
            </div>
          </div>
        )}

        {/* TAB 3 — Retrait en argent */}
        {!loading && tab === 3 && (
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <div className={card}>
              <h2 className="text-lg font-extrabold mb-1">Retirer mes gains</h2>
              <p className="text-sm text-muted-foreground mb-2">
                Conversion : 1 point = 1 FCFA. Minimum 5 000 points.
              </p>
              <div className="mb-4 flex items-center gap-2 rounded-2xl bg-secondary/60 px-3 py-2 text-sm">
                <ShieldCheck className="h-4 w-4 text-accent" />
                <span>
                  Solde :{" "}
                  <span className="font-extrabold text-primary">
                    {points.toLocaleString()} pts
                  </span>{" "}
                  = {points.toLocaleString()} FCFA
                </span>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-semibold mb-1 block">
                    Points à retirer (min 5 000)
                  </label>
                  <input
                    type="number"
                    min={5000}
                    max={points}
                    value={wPoints}
                    onChange={(e) => setWPoints(e.target.value)}
                    placeholder="ex : 5000"
                    className="w-full rounded-xl border border-input bg-background px-4 py-3 text-base outline-none focus:border-primary"
                  />
                  {wPoints && parseInt(wPoints) > 0 && (
                    <div className="mt-2 space-y-1 rounded-xl bg-muted/60 px-3 py-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          Montant brut
                        </span>
                        <span className="font-bold">
                          {parseInt(wPoints).toLocaleString()} FCFA
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          Commission (5%)
                        </span>
                        <span className="font-bold text-destructive">
                          -
                          {computeCommission(
                            parseInt(wPoints),
                          ).toLocaleString()}{" "}
                          FCFA
                        </span>
                      </div>
                      <div className="flex justify-between border-t border-border pt-1">
                        <span className="font-semibold">Vous recevrez</span>
                        <span className="font-extrabold text-accent">
                          {computeNet(parseInt(wPoints)).toLocaleString()} FCFA
                        </span>
                      </div>
                    </div>
                  )}
                </div>
                <div>
                  <label className="text-sm font-semibold mb-1 block">
                    Nom sur le compte mobile money
                  </label>
                  <input
                    type="text"
                    value={wName}
                    onChange={(e) => setWName(e.target.value)}
                    placeholder="Ex : KOFFI Jean"
                    className="w-full rounded-xl border border-input bg-background px-4 py-3 text-base outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold mb-1 block">
                    Moyen de paiement
                  </label>
                  <select
                    value={wMethod}
                    onChange={(e) => setWMethod(e.target.value)}
                    className="w-full rounded-xl border border-input bg-background px-4 py-3 text-base outline-none focus:border-primary"
                  >
                    <option value="">-- Choisir --</option>
                    <option value="Orange Money">Orange Money</option>
                    <option value="Wave">Wave</option>
                    <option value="MTN Mobile Money">MTN MoMo</option>
                    <option value="Moov">Moov Money</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-semibold mb-1 block">
                    Numéro de téléphone / IBAN
                  </label>
                  <div className="relative">
                    <input
                      type={showPhone ? "text" : "password"}
                      value={wDetails}
                      onChange={(e) => setWDetails(e.target.value)}
                      placeholder="Numéro de téléphone ou IBAN"
                      className="w-full rounded-xl border border-input bg-background px-4 py-3 pr-11 text-base outline-none focus:border-primary"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPhone((v) => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-muted-foreground"
                      aria-label={showPhone ? "Masquer" : "Afficher"}
                    >
                      {showPhone ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Vos coordonnées sont stockées de manière sécurisée et
                    masquées dans l'historique.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={requestWithdrawal}
                  className="w-full rounded-xl bg-primary px-4 py-3.5 text-sm font-bold text-primary-foreground disabled:opacity-50"
                >
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                  ) : (
                    "Demander le retrait"
                  )}
                </button>
              </div>
            </div>
            <div className={card}>
              <h2 className="text-lg font-extrabold mb-4">
                Historique des retraits
              </h2>
              {withdrawals.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Aucun retrait effectué.
                </p>
              ) : (
                <>
                <ul className="space-y-3">
                  {withdrawalPaginate.shown.map((w) => (
                    <li
                      key={w.id}
                      className="rounded-2xl border border-border p-3 text-sm"
                    >
                      <div className="flex items-center gap-3">
                        {statusIcon(w.status)}
                        <div className="flex-1">
                          <p className="font-bold">
                            {(w.amount_points || 0).toLocaleString()} pts →{" "}
                            {(w.amount_fcfa || 0).toLocaleString()} FCFA
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {w.payment_method} · {maskPhone(w.payment_details)}
                          </p>
                        </div>
                        <span className="text-xs font-bold uppercase text-muted-foreground">
                          {STATUS_LABELS[w.status] || w.status}
                        </span>
                      </div>
                      {w.status === "rejected" &&
                        (w.rejection_reason || w.admin_note) && (
                          <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-destructive/10 px-2.5 py-2 text-xs text-destructive">
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                            {w.rejection_reason || w.admin_note}
                          </p>
                        )}
                      <p className="mt-1.5 text-[11px] text-muted-foreground">
                        {new Date(w.created).toLocaleDateString("fr-FR")}
                      </p>
                    </li>
                  ))}
                </ul>
                <ListFooter {...withdrawalPaginate} total={withdrawals.length} />
                </>
              )}
            </div>
          </div>
        )}

        {/* TAB 4 — Historique complet */}
        {!loading && tab === 4 && (
          <div className="mt-6 space-y-6">
            <div className={card}>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <h2 className="text-lg font-extrabold">
                  Historique des points
                </h2>
                <div className="flex gap-1">
                  {[
                    ["all", "Tout"],
                    ["gains", "Gains"],
                    ["depenses", "Dépenses"],
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
                  Aucune transaction.
                </p>
              ) : (
                <>
                <ul className="space-y-2">
                  {ledgerPaginate.shown.map((l) => (
                    <li
                      key={l.id}
                       className="flex items-center gap-3 rounded-2xl bg-muted/40 px-4 py-3 text-sm"
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
                <ListFooter {...ledgerPaginate} total={ledgerWithBalance.length} />
                </>
              )}
            </div>
            <div className={card}>
              <h2 className="text-lg font-extrabold mb-4">
                Commandes de cadeaux
              </h2>
              {gifts.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Aucune commande.
                </p>
              ) : (
                <>
                <ul className="space-y-2">
                  {giftsPaginate.shown.map((g) => (
                    <li
                      key={g.id}
                       className="flex items-center gap-3 rounded-2xl border border-border px-4 py-3 text-sm"
                    >
                       {statusIcon(g.status)}
                       <span className="flex-1 font-semibold capitalize">
                         {g.gift_type?.replace(/_/g, " ")}
                      </span>
                      <span className="font-mono font-bold text-destructive">
                        -{(g.points_cost || 0).toLocaleString()} pts
                      </span>
                      <span className="text-xs font-bold uppercase text-muted-foreground">
                        {STATUS_LABELS[g.status] || g.status}
                      </span>
                    </li>
                  ))}
                </ul>
                <ListFooter {...giftsPaginate} total={gifts.length} />
                </>
              )}
            </div>
            <div className={card}>
              <h2 className="text-lg font-extrabold mb-4">Services achetés</h2>
              {purchases.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Aucun service acheté.
                </p>
              ) : (
                <>
                <ul className="space-y-2">
                  {purchasesPaginate.shown.map((p) => {
                    const svc = serviceByKey(p.service);
                    const active = isServiceActive(p);
                    const dl = daysLeft(p.expires_at);
                    return (
                      <li
                        key={p.id}
                        className="flex items-center gap-3 rounded-2xl border border-border px-4 py-3 text-sm"
                      >
                        {statusIcon(active ? "active" : "expired")}
                        <span className="flex-1 font-semibold">
                          {svc?.label || p.service}
                        </span>
                        <span className="font-mono font-bold text-destructive">
                          -{(p.points_cost || 0).toLocaleString()} pts
                        </span>
                        <span className="text-xs font-bold uppercase text-muted-foreground">
                          {active
                            ? dl != null
                              ? `${dl}j`
                              : "Actif"
                            : "Expiré"}
                        </span>
                      </li>
                    );
                  })}
                </ul>
                <ListFooter {...purchasesPaginate} total={purchases.length} />
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Confirmation dialog */}
      {confirm && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4"
          onClick={() => !busy && setConfirm(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-card p-6 sheet-up sm:page-enter"
            onClick={(e) => e.stopPropagation()}
          >
            {confirm.type === "service" && (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-3xl">{confirm.payload.emoji}</span>
                  <div>
                    <p className="font-extrabold text-lg">
                      {confirm.payload.label}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {confirm.payload.desc}
                    </p>
                  </div>
                </div>
                <div className="rounded-xl bg-muted px-4 py-3 text-sm space-y-1 mb-4">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Coût</span>
                    <span className="font-extrabold text-primary">
                      {confirm.payload.cost.toLocaleString()} pts
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Solde actuel</span>
                    <span className="font-bold">
                      {points.toLocaleString()} pts
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Solde après achat
                    </span>
                    <span className="font-bold text-accent">
                      {(points - confirm.payload.cost).toLocaleString()} pts
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Validité</span>
                    <span className="font-bold">
                      {confirm.payload.duration} jours
                    </span>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setConfirm(null)}
                    className="flex-1 rounded-xl border border-border px-4 py-3 text-sm font-bold"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => buyService(confirm.payload)}
                    className="flex-1 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground disabled:opacity-50"
                  >
                    {busy ? (
                      <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                    ) : (
                      "Confirmer l'achat"
                    )}
                  </button>
                </div>
              </>
            )}
            {confirm.type === "withdraw" && (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <ArrowDownToLine className="h-7 w-7 text-primary" />
                  <p className="font-extrabold text-lg">Confirmer le retrait</p>
                </div>
                <div className="rounded-xl bg-muted px-4 py-3 text-sm space-y-1 mb-4">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Points</span>
                    <span className="font-extrabold text-primary">
                      {confirm.payload.pts.toLocaleString()} pts
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Montant brut</span>
                    <span className="font-bold">
                      {confirm.payload.pts.toLocaleString()} FCFA
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Commission (5%)
                    </span>
                    <span className="font-bold text-destructive">
                      -{computeCommission(confirm.payload.pts).toLocaleString()}{" "}
                      FCFA
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-border pt-1">
                    <span className="font-semibold">Net à recevoir</span>
                    <span className="font-extrabold text-accent">
                      {computeNet(confirm.payload.pts).toLocaleString()} FCFA
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Méthode</span>
                    <span className="font-bold">{confirm.payload.method}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Numéro</span>
                    <span className="font-bold">
                      {maskPhone(confirm.payload.details)}
                    </span>
                  </div>
                  {confirm.payload.name && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Nom du compte</span>
                      <span className="font-bold">{confirm.payload.name}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Solde après</span>
                    <span className="font-bold text-destructive">
                      {(points - confirm.payload.pts).toLocaleString()} pts
                    </span>
                  </div>
                </div>
                <p className="mb-4 text-xs text-muted-foreground">
                  Le traitement prend 3 jours ouvrés. Vous recevrez une
                  notification à chaque étape.
                </p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setConfirm(null)}
                    className="flex-1 rounded-xl border border-border px-4 py-3 text-sm font-bold"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={confirmWithdrawal}
                    className="flex-1 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground disabled:opacity-50"
                  >
                    {busy ? (
                      <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                    ) : (
                      "Confirmer"
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* FCFA service checkout modal */}
      {fcfaCheckout && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4"
          onClick={() => !busy && setFcfaCheckout(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-card p-6 sheet-up sm:page-enter max-h-[92dvh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <span className="text-3xl">{fcfaCheckout.emoji}</span>
              <div>
                <p className="font-extrabold text-lg">{fcfaCheckout.label}</p>
                <p className="text-sm text-muted-foreground">
                  {fcfaCheckout.price.toLocaleString()} FCFA · valable{" "}
                  {fcfaCheckout.duration} jours
                </p>
              </div>
            </div>
            <PaymentMethodPicker
              amount={fcfaCheckout.price}
              onBeforePay={async () => {
                if (!user) return;
                await createPendingPayment({
                  userId: user.id,
                  type: "service",
                  itemKey: fcfaCheckout.key,
                  itemLabel: fcfaCheckout.label,
                  amountFcfa: fcfaCheckout.price,
                });
              }}
              type="service"
              itemId={fcfaCheckout.key}
              ctaLabel="Payer le service"
            />
          </div>
        </div>
      )}

      {/* FCFA success modal */}
      {fcfaDone && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setFcfaDone(null)}
        >
          <div className="w-full max-w-sm rounded-2xl bg-card p-6 text-center sheet-up">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-accent/15">
              <CheckCircle2 className="h-8 w-8 text-accent" />
            </div>
            <p className="mt-4 font-extrabold text-lg">Paiement enregistré !</p>
            <p className="mt-2 text-sm text-muted-foreground">
              « {fcfaDone.label} » sera activé sous 24h après validation de
              votre paiement.
            </p>
            <button
              type="button"
              onClick={() => setFcfaDone(null)}
              className="mt-5 w-full rounded-xl bg-primary px-4 py-3 font-bold text-primary-foreground"
            >
              Fermer
            </button>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default RewardsPage;
