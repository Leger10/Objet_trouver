import React, { useCallback, useEffect, useState } from "react";
import { Helmet } from "react-helmet";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { CheckCircle2, Crown, Loader2, Sparkles, X } from "lucide-react";
import { pb } from "@/lib/supabaseClient";
import Layout from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import PaymentMethodPicker from "@/components/PaymentMethodPicker";
import { SUBSCRIPTION_PLANS, createPayment } from "@/lib/payments";
import { formatNumber, formatDate } from "@/lib/format";

const SubscriptionPage = () => {
  const { user, isAuthed } = useAuth();
  const [sub, setSub] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [checkout, setCheckout] = useState(null); // plan being purchased
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);

  const load = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    try {
      const [subList, payList] = await Promise.all([
        pb.collection("subscriptions").getList(1, 1, {
          filter: pb.filter('user = {:u} && status = "active"', { u: user.id }),
          sort: "-created",
          requestKey: "sub-active",
        }),
        pb.collection("payments").getFullList({
          filter: pb.filter('user = {:u} && type = "subscription"', {
            u: user.id,
          }),
          sort: "-created",
          requestKey: "sub-payments",
        }),
      ]);
      setSub(subList.items[0] || null);
      setPayments(payList);
    } catch (_) {
      setSub(null);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const currentPlan = user?.plan || "free";

  const startCheckout = (plan) => {
    if (!isAuthed) {
      toast.error("Connectez-vous pour vous abonner.");
      return;
    }
    if (plan.key === "free") return;
    if (currentPlan === plan.key && sub) {
      toast("Vous êtes déjà abonné à ce plan.");
      return;
    }
    setCheckout(plan);
  };

  const confirmPayment = async (method, ref) => {
    if (!checkout || !user) return;
    setBusy(true);
    try {
      await createPayment({
        user: user.id,
        type: "subscription",
        itemKey: checkout.key,
        itemLabel: `Abonnement ${checkout.name}`,
        amountFcfa: checkout.price,
        method,
        description: ref ? `Réf: ${ref}` : "",
      });
      setDone({ plan: checkout, method });
      setCheckout(null);
      toast.success("Paiement enregistré", {
        description: "Activation sous 24h après validation.",
      });
      load();
    } catch (e) {
      toast.error(e?.response?.message || "Erreur lors du paiement.");
    }
    setBusy(false);
  };

  const cancelSub = async () => {
    if (!sub) return;
    try {
      await pb
        .collection("subscriptions")
        .update(sub.id, { status: "cancelled", auto_renew: false });
      toast.success("Abonnement annulé", {
        description:
          "Vous garderez les avantages jusqu'à la fin de la période.",
      });
      load();
    } catch (_) {
      toast.error("Annulation impossible.");
    }
  };

  return (
    <Layout>
      <Helmet>
        <title>Abonnements — RetrouveMoi</title>
        <meta
          name="description"
          content="Choisissez votre plan RetrouveMoi : Gratuit, Premium 2 500 FCFA/mois ou Pro 5 000 FCFA/mois. Sans publicité, alertes illimitées et avantages exclusifs."
        />
      </Helmet>

      <div className="mx-auto w-full max-w-[90rem] px-4 py-8">
        {/* Hero */}
        <div className="rounded-3xl bg-gradient-to-br from-[hsl(206_84%_32%)] to-[hsl(162_72%_28%)] p-6 sm:p-8 text-white">
          <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-white/85">
            <Crown className="h-4 w-4" /> Abonnements
          </div>
          <h1 className="mt-3 text-2xl sm:text-3xl font-extrabold leading-tight">
            Choisissez votre plan
          </h1>
          <p className="mt-2 text-sm text-white/85 max-w-xl">
            La recherche et les déclarations restent toujours gratuites. Les
            abonnements financent la plateforme et suppriment les publicités.
          </p>
          {sub && (
            <div className="mt-5 rounded-2xl bg-white/15 px-4 py-3 text-sm">
              <p className="font-bold">Abonnement actuel : {sub.plan}</p>
              <p className="text-white/80">
                Renouvellement le {formatDate(sub.renews_at)}
              </p>
            </div>
          )}
        </div>

        {/* Plans */}
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {SUBSCRIPTION_PLANS.map((plan) => {
            const isCurrent = currentPlan === plan.key;
            return (
              <motion.div
                key={plan.key}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                className={`relative flex flex-col rounded-2xl border-2 ${plan.accent} bg-card p-6 ${plan.popular ? "rt-shadow sm:scale-[1.02]" : ""}`}
              >
                {plan.popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-primary-foreground">
                    Populaire
                  </span>
                )}
                <span className="text-3xl">{plan.emoji}</span>
                <p className="mt-3 text-lg font-extrabold">{plan.name}</p>
                <p className="mt-1">
                  <span className="text-2xl font-extrabold text-primary">
                    {plan.price === 0
                      ? "Gratuit"
                      : `${formatNumber(plan.price)}`}
                  </span>
                  {plan.price > 0 && (
                    <span className="text-sm text-muted-foreground">
                      {" "}
                      FCFA/mois
                    </span>
                  )}
                </p>
                <ul className="mt-4 flex-1 space-y-2 text-sm">
                  {plan.features.map((f) => (
                    <li key={f} className="flex gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                      <span className="text-muted-foreground">{f}</span>
                    </li>
                  ))}
                </ul>
                {plan.key === "free" ? (
                  <span
                    className={`mt-5 rounded-xl px-4 py-3 text-center font-bold ${isCurrent ? "bg-muted text-muted-foreground" : "border border-border"}`}
                  >
                    {isCurrent ? "Plan actuel" : "Par défaut"}
                  </span>
                ) : isCurrent && sub ? (
                  <button
                    type="button"
                    onClick={cancelSub}
                    className="mt-5 rounded-xl border border-border px-4 py-3 font-bold text-destructive"
                  >
                    Annuler l'abonnement
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => startCheckout(plan)}
                    className="mt-5 rounded-xl bg-primary px-4 py-3 font-bold text-primary-foreground active:scale-[0.98] transition-transform"
                  >
                    {plan.cta}
                  </button>
                )}
              </motion.div>
            );
          })}
        </div>

        {/* Savings comparison */}
        <div className="mt-6 rounded-2xl border border-border bg-secondary/40 p-5">
          <p className="flex items-center gap-2 font-bold">
            <Sparkles className="h-4 w-4 text-primary" /> Économisez avec
            l'abonnement
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            À la carte, alertes + recherche avancée + mise en avant coûtent ~1
            000 FCFA/mois. Le plan Premium à 2 500 FCFA ajoute le sans-pub et
            les alertes illimitées. Le plan Pro inclut le profil vérifié (1 000
            FCFA) et 5 mises en avant gratuites.
          </p>
        </div>

        {/* Payment history */}
        {isAuthed && payments.length > 0 && (
          <div className="mt-6 rounded-2xl border border-border bg-card p-5">
            <p className="font-bold">Historique des paiements d'abonnement</p>
            <ul className="mt-3 space-y-2">
              {payments.map((p) => (
                <li
                  key={p.id}
                  className="flex flex-wrap items-center gap-3 rounded-xl bg-muted/40 px-4 py-3 text-sm"
                >
                  <span className="flex-1 font-semibold">{p.item_label}</span>
                  <span className="font-extrabold text-primary">
                    {formatNumber(p.amount_fcfa)} FCFA
                  </span>
                  <span className="text-xs font-bold uppercase text-muted-foreground">
                    {p.status}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(p.created)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {!isAuthed && (
          <div className="mt-6 rounded-2xl border border-dashed border-border p-6 text-center">
            <p className="text-sm text-muted-foreground">
              Connectez-vous pour vous abonner.
            </p>
            <div className="mt-4 flex justify-center gap-3">
              <Link
                to="/inscription"
                className="rounded-xl bg-primary px-5 py-3 font-bold text-primary-foreground"
              >
                Créer un compte
              </Link>
              <Link
                to="/connexion"
                className="rounded-xl border border-border px-5 py-3 font-bold"
              >
                Se connecter
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Checkout modal */}
      {checkout && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4"
          onClick={() => !busy && setCheckout(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-card p-6 sheet-up sm:page-enter max-h-[92dvh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{checkout.emoji}</span>
                <div>
                  <p className="font-extrabold text-lg">
                    Abonnement {checkout.name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {formatNumber(checkout.price)} FCFA / mois
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !busy && setCheckout(null)}
                className="rounded-lg p-1.5 text-muted-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <PaymentMethodPicker
              amount={checkout.price}
              onConfirm={confirmPayment}
              busy={busy}
              ctaLabel="Payer l'abonnement"
            />
          </div>
        </div>
      )}

      {/* Success modal */}
      {done && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setDone(null)}
        >
          <div className="w-full max-w-sm rounded-2xl bg-card p-6 text-center sheet-up">
            <motion.div
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-accent/15"
            >
              <CheckCircle2 className="h-8 w-8 text-accent" />
            </motion.div>
            <p className="mt-4 font-extrabold text-lg">Paiement enregistré !</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Votre abonnement {done.plan.name} sera activé sous 24h après
              validation de notre équipe.
            </p>
            <button
              type="button"
              onClick={() => setDone(null)}
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

export default SubscriptionPage;
