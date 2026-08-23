import React, { useCallback, useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Building2, CheckCircle2, Loader2, X } from "lucide-react";
import { pb } from "@/lib/supabaseClient";
import Layout from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import PaymentMethodPicker from "@/components/PaymentMethodPicker";
import {
  PRO_PLANS,
  ORG_TYPES,
  orgTypeLabel,
  orgTypeEmoji,
} from "@/lib/payments";
import { createPendingPayment } from "@/lib/moneyfusion";
import { formatNumber, formatDate } from "@/lib/format";

const field =
  "w-full rounded-xl border border-input bg-background px-4 py-3.5 text-base outline-none focus:border-primary focus:ring-2 focus:ring-ring/30";

const ProAccountsPage = () => {
  const { user, isAuthed } = useAuth();
  const [proAccount, setProAccount] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [checkout, setCheckout] = useState(null); // plan being purchased
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);

  // Request form
  const [form, setForm] = useState({
    org_type: "mairie",
    org_name: user?.organisation || "",
    org_description: "",
    contact_email: user?.email || "",
    contact_phone: user?.phone || "",
  });

  const load = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    try {
      const [proList, payList] = await Promise.all([
        pb.collection("pro_accounts").getList(1, 1, {
          filter: pb.filter('"user" = {:u}', { u: user.id }),
          sort: "-created",
          requestKey: "pro-acc",
        }),
        pb.collection("payments").getFullList({
          filter: pb.filter('"user" = {:u}', { u: user.id }),
          sort: "-created",
          requestKey: "pro-payments",
        }),
      ]);
      setProAccount(proList.items[0] || null);
      setPayments(payList);
    } catch (_) {
      setProAccount(null);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const startCheckout = (plan) => {
    if (!isAuthed) {
      toast.error("Connectez-vous pour demander un compte professionnel.");
      return;
    }
    if (!form.org_name.trim()) {
      toast.error("Indiquez d'abord le nom de votre organisation.");
      return;
    }
    setCheckout(plan);
  };

  const confirmPayment = async (method, ref) => {
    if (!checkout || !user) return;
    setBusy(true);
    try {
      // Create the pro_account record (pending) if it doesn't exist
      if (!proAccount) {
        const rec = await pb.collection("pro_accounts").create({
          owner: user.id,
          org_type: form.org_type,
          org_name: form.org_name.trim(),
          org_description: form.org_description.trim(),
          plan: checkout.key,
          max_users: checkout.maxUsers,
          contact_email: form.contact_email.trim(),
          contact_phone: form.contact_phone.trim(),
          status: "pending",
        });
        setProAccount(rec);
      } else {
        await pb.collection("pro_accounts").update(proAccount.id, {
          plan: checkout.key,
          max_users: checkout.maxUsers,
          org_type: form.org_type,
          org_name: form.org_name.trim(),
          org_description: form.org_description.trim(),
          contact_email: form.contact_email.trim(),
          contact_phone: form.contact_phone.trim(),
        });
      }
      // Create payment record
      await createPendingPayment({
        userId: user.id,
        type: "pro_account",
        itemKey: checkout.key,
        itemLabel: `Compte Pro ${checkout.name} — ${form.org_name.trim()}`,
        amountFcfa: checkout.price,
        description: ref ? `Réf: ${ref}` : "",
      });
      setDone({ plan: checkout });
      setCheckout(null);
      toast.success("Demande enregistrée", {
        description: "Validation sous 48h après vérification.",
      });
      load();
    } catch (e) {
      toast.error(e?.response?.message || "Erreur lors de la demande.");
    }
    setBusy(false);
  };

  return (
    <Layout>
      <Helmet>
        <title>Comptes professionnels — RetrouveMoi</title>
        <meta
          name="description"
          content="Comptes institutionnels RetrouveMoi pour mairies, entreprises, universités, police, hôpitaux et transports. Plans Starter, Business et Enterprise."
        />
      </Helmet>

      <div className="mx-auto w-full max-w-[90rem] px-4 py-8">
        {/* Hero */}
        <div className="rounded-3xl bg-gradient-to-br from-[hsl(206_84%_20%)] to-[hsl(199_80%_30%)] p-6 sm:p-8 text-white">
          <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-white/85">
            <Building2 className="h-4 w-4" /> Comptes professionnels
          </div>
          <h1 className="mt-3 text-2xl sm:text-3xl font-extrabold leading-tight">
            Espace institutionnel
          </h1>
          <p className="mt-2 text-sm text-white/85 max-w-xl">
            Mairies, entreprises, universités, commissariats, hôpitaux,
            transports : centralisez les objets déposés à votre guichet avec un
            espace dédié et des statistiques.
          </p>
        </div>

        {/* Org types */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {ORG_TYPES.map((t) => (
            <div
              key={t.key}
              className="rounded-2xl border border-border bg-card p-4 text-center"
            >
              <span className="text-2xl">{t.emoji}</span>
              <p className="mt-2 text-xs font-bold leading-tight">{t.label}</p>
            </div>
          ))}
        </div>

        {/* Current account status */}
        {proAccount && (
          <div className="mt-6 rounded-2xl border border-border bg-card p-5">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-2xl">
                {orgTypeEmoji(proAccount.org_type)}
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-extrabold">{proAccount.org_name}</p>
                <p className="text-xs text-muted-foreground">
                  {orgTypeLabel(proAccount.org_type)} · Plan {proAccount.plan}
                </p>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${
                  proAccount.status === "active"
                    ? "bg-accent/15 text-accent"
                    : proAccount.status === "suspended"
                      ? "bg-destructive/15 text-destructive"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {proAccount.status}
              </span>
            </div>
          </div>
        )}

        {/* Organization form */}
        {isAuthed && (
          <div className="mt-6 rounded-2xl border border-border bg-card p-5">
            <p className="font-bold">Informations de l'organisation</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5 text-sm font-bold">
                Type d'organisation *
                <select
                  value={form.org_type}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, org_type: e.target.value }))
                  }
                  className={field}
                >
                  {ORG_TYPES.map((t) => (
                    <option key={t.key} value={t.key}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-bold">
                Nom de l'organisation *
                <input
                  value={form.org_name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, org_name: e.target.value }))
                  }
                  placeholder="ex : Mairie de Ouaga 2000"
                  className={field}
                />
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-bold sm:col-span-2">
                Description (optionnel)
                <textarea
                  value={form.org_description}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, org_description: e.target.value }))
                  }
                  rows={2}
                  placeholder="Décrivez votre organisation"
                  className={`${field} resize-none`}
                />
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-bold">
                Email de contact
                <input
                  type="email"
                  value={form.contact_email}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, contact_email: e.target.value }))
                  }
                  className={field}
                />
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-bold">
                Téléphone de contact
                <input
                  value={form.contact_phone}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, contact_phone: e.target.value }))
                  }
                  className={field}
                />
              </label>
            </div>
          </div>
        )}

        {/* Plans */}
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {PRO_PLANS.map((plan) => (
            <motion.div
              key={plan.key}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className={`relative flex flex-col rounded-2xl border-2 ${plan.popular ? "border-primary rt-shadow" : "border-border"} bg-card p-6`}
            >
              {plan.popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-primary-foreground">
                  Recommandé
                </span>
              )}
              <span className="text-3xl">{plan.emoji}</span>
              <p className="mt-3 text-lg font-extrabold">{plan.name}</p>
              <p className="mt-1">
                <span className="text-2xl font-extrabold text-primary">
                  {formatNumber(plan.price)}
                </span>
                <span className="text-sm text-muted-foreground">
                  {" "}
                  FCFA/mois
                </span>
              </p>
              <ul className="mt-4 flex-1 space-y-2 text-sm">
                {plan.features.map((f) => (
                  <li key={f} className="flex gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                    <span className="text-muted-foreground">{f}</span>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => startCheckout(plan)}
                className="mt-5 rounded-xl bg-primary px-4 py-3 font-bold text-primary-foreground active:scale-[0.98] transition-transform"
              >
                Demander ce plan
              </button>
            </motion.div>
          ))}
        </div>

        {/* Payment history */}
        {isAuthed && payments.length > 0 && (
          <div className="mt-6 rounded-2xl border border-border bg-card p-5">
            <p className="font-bold">Historique des paiements pro</p>
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
              Connectez-vous pour demander un compte professionnel.
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
                  <p className="font-extrabold text-lg">Plan {checkout.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatNumber(checkout.price)} FCFA / mois ·{" "}
                    {checkout.maxUsers >= 9999
                      ? "utilisateurs illimités"
                      : `jusqu'à ${checkout.maxUsers} utilisateurs`}
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
            <p className="mb-3 text-xs text-muted-foreground">
              Premier mois facturé maintenant. Votre organisation sera vérifiée
              sous 48h.
            </p>
            <PaymentMethodPicker
              amount={checkout.price}
              onBeforePay={async () => {
                if (!user) return;
                if (!proAccount) {
                  const rec = await pb.collection("pro_accounts").create({
                    owner: user.id,
                    org_type: form.org_type,
                    org_name: form.org_name.trim(),
                    org_description: form.org_description.trim(),
                    plan: checkout.key,
                    max_users: checkout.maxUsers,
                    contact_email: form.contact_email.trim(),
                    contact_phone: form.contact_phone.trim(),
                    status: "pending",
                  });
                  setProAccount(rec);
                } else {
                  await pb.collection("pro_accounts").update(proAccount.id, {
                    plan: checkout.key,
                    max_users: checkout.maxUsers,
                    org_type: form.org_type,
                    org_name: form.org_name.trim(),
                    org_description: form.org_description.trim(),
                    contact_email: form.contact_email.trim(),
                    contact_phone: form.contact_phone.trim(),
                  });
                }
                await createPendingPayment({
                  userId: user.id,
                  type: "pro_account",
                  itemKey: checkout.key,
                  itemLabel: `Compte Pro ${checkout.name} — ${form.org_name.trim()}`,
                  amountFcfa: checkout.price,
                });
              }}
              type="pro_account"
              itemId={checkout.key}
              ctaLabel="Payer le 1er mois"
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
            <p className="mt-4 font-extrabold text-lg">Demande enregistrée !</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Votre compte professionnel {done.plan.name} sera activé sous 48h
              après vérification de votre organisation.
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

export default ProAccountsPage;
