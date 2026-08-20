import React, { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Heart, CheckCircle2 } from "lucide-react";
import { pb } from "@/lib/supabaseClient";
import Layout from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { formatNumber } from "@/lib/format";
import PaymentMethodPicker from "@/components/PaymentMethodPicker";
import { createPendingPayment } from "@/lib/moneyfusion";

const PRESETS = [1000, 5000, 10000, 20000, 50000];

const DonatePage = () => {
  const { user } = useAuth();
  const [totals, setTotals] = useState({ total_fcfa: 0, donors: 0 });
  const [amount, setAmount] = useState(5000);
  const [custom, setCustom] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    pb.collection("donation_totals")
      .getFirstListItem("label = 'global'")
      .then((r) =>
        setTotals({ total_fcfa: r.total_fcfa || 0, donors: r.donors || 0 }),
      )
      .catch(() => setTotals({ total_fcfa: 0, donors: 0 }));
  }, []);

  const finalAmount = custom ? parseInt(custom, 10) || 0 : amount;

  return (
    <Layout>
      <Helmet>
        <title>Soutenir RetrouveMoi — Faire un don</title>
        <meta
          name="description"
          content="Soutenez RetrouveMoi par mobile money ou carte bancaire. Chaque don améliore la plateforme et augmente les restitutions."
        />
      </Helmet>

      <div className="mx-auto w-full max-w-[44rem] px-4 py-8">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm font-bold text-muted-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Accueil
        </Link>

        {/* Header */}
        <div className="mt-4 rounded-3xl bg-gradient-to-br from-[hsl(258_84%_58%)] to-[hsl(280_75%_52%)] p-6 text-white shadow-lg">
          <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-white/85">
            <Heart className="h-4 w-4" /> Soutenez l&apos;initiative
          </div>
          <h1 className="mt-3 text-2xl font-extrabold leading-tight sm:text-3xl">
            Soutenez RetrouveMoi
          </h1>
          <p className="mt-2 text-sm text-white/85">
            Une plateforme pour retrouver les objets perdus. Chaque don nous
            aide à améliorer la plateforme et à retrouver plus d&apos;objets.
          </p>
          <div className="mt-5 flex gap-6">
            <div>
              <p className="text-xl font-extrabold">
                {formatNumber(totals.total_fcfa)} FCFA
              </p>
              <p className="text-xs text-white/80">total collecté</p>
            </div>
            <div>
              <p className="text-xl font-extrabold">
                {formatNumber(totals.donors)}
              </p>
              <p className="text-xs text-white/80">donateurs</p>
            </div>
          </div>
        </div>

        {/* Impact */}
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {[
            ["1 000 FCFA", "Couvre l'hébergement d'une journée"],
            ["5 000 FCFA", "Finance une campagne d'alertes"],
            ["20 000 FCFA", "Soutient un partenariat local"],
          ].map(([k, v]) => (
            <div
              key={k}
              className="rounded-2xl border border-border bg-card p-4"
            >
              <p className="font-extrabold text-primary">{k}</p>
              <p className="mt-1 text-xs text-muted-foreground">{v}</p>
            </div>
          ))}
        </div>

        {/* Amount selection */}
        <div className="mt-6 rounded-2xl border border-border bg-card p-5">
          <p className="text-sm font-bold">Choisissez un montant</p>
          <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {PRESETS.map((p) => {
              const active = !custom && amount === p;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => {
                    setAmount(p);
                    setCustom("");
                  }}
                  className={`rounded-xl border-2 px-3 py-4 text-center font-extrabold transition-all active:scale-[0.97] ${
                    active
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-background text-foreground"
                  }`}
                >
                  {formatNumber(p)}
                  <span className="block text-[10px] font-bold text-muted-foreground">
                    FCFA
                  </span>
                </button>
              );
            })}
          </div>
          <div className="mt-3">
            <label className="text-xs font-bold text-muted-foreground">
              Montant personnalisé (FCFA)
            </label>
            <input
              type="number"
              min="100"
              step="100"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              placeholder="Autre montant"
              className="mt-1.5 w-full rounded-xl border border-input bg-background px-4 py-3.5 text-base outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
            />
          </div>
          <p className="mt-3 rounded-xl bg-secondary/60 px-3 py-2 text-sm font-bold text-secondary-foreground">
            Votre don : {formatNumber(finalAmount || 0)} FCFA
          </p>
        </div>

        {/* Payment via MoneyFusion — handles phone, name, fee breakdown & redirect */}
        {finalAmount >= 100 && (
          <div className="mt-6">
            <PaymentMethodPicker
              amount={finalAmount}
              type="donation"
              itemId=""
              items={[{ "Don RetrouvéMoi": finalAmount }]}
              ctaLabel="Faire ce don"
              onBeforePay={async () => {
                await createPendingPayment({
                  userId: user?.id || "",
                  type: "donation",
                  itemKey: "donation",
                  itemLabel: `Don ${formatNumber(finalAmount)} FCFA`,
                  amountFcfa: finalAmount,
                  description: "Don自愿 à RetrouveMoi",
                });
              }}
            />
          </div>
        )}

        {finalAmount < 100 && (
          <div className="mt-6 rounded-2xl border border-border bg-card p-5 text-center">
            <p className="text-sm text-muted-foreground">
              Le montant minimum est de 100 FCFA.
            </p>
          </div>
        )}
      </div>

      {/* Success modal */}
      {done && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setDone(false)}
        >
          <div className="w-full max-w-sm rounded-2xl bg-card p-6 text-center sheet-up">
            <motion.div
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-accent/15"
            >
              <CheckCircle2 className="h-8 w-8 text-accent" />
            </motion.div>
            <p className="mt-4 font-extrabold text-lg">Merci pour votre don !</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Votre soutien nous aide à retrouver plus d&apos;objets perdus.
            </p>
            <button
              type="button"
              onClick={() => setDone(false)}
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

export default DonatePage;
