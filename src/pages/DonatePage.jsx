import React, { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Heart, CheckCircle2, EyeOff, UserCheck } from "lucide-react";
import Layout from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { formatNumber } from "@/lib/format";
import PaymentOptions from "@/components/PaymentOptions";
import { createPendingPayment } from "@/lib/moneyfusion";

const GOAL_FCFA = 500000;

const DonatePage = () => {
  const { user } = useAuth();
  const [totals, setTotals] = useState({ total_fcfa: 0, donors: 0 });
  const [custom, setCustom] = useState("");
  const [identity, setIdentity] = useState(user ? "identified" : "anonymous");
  const [done, setDone] = useState(false);

  useEffect(() => {
    const load = () => {
      fetch("/api/donations-totals")
        .then((r) => r.json())
        .then((json) => {
          if (json?.success) {
            setTotals({
              total_fcfa: json.data?.total_fcfa || 0,
              donors: json.data?.donors || 0,
            });
          }
        })
        .catch(() => {});
    };
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, []);

  const finalAmount = parseInt(custom, 10) || 0;

  // L'id utilisateur n'est transmis que si le donateur choisit de s'identifier
  const donorId = identity === "identified" ? user?.id || "" : "";
  const effectiveIdentity = identity === "identified" && user ? "identified" : "anonymous";

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
          <div className="mt-5">
            <div className="flex items-end justify-between text-xs font-bold text-white/85">
              <span>Objectif {formatNumber(GOAL_FCFA)} FCFA</span>
              <span>
                {Math.min(
                  100,
                  Math.round((totals.total_fcfa / GOAL_FCFA) * 100),
                )}
                %
              </span>
            </div>
            <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-white/25">
              <div
                className="h-full rounded-full bg-white transition-all duration-700"
                style={{
                  width: `${Math.min(
                    100,
                    (totals.total_fcfa / GOAL_FCFA) * 100,
                  )}%`,
                }}
              />
            </div>
          </div>
        </div>

        {/* Impact
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
        </div> */}

        {/* Simple amount form */}
        <div className="mt-6 rounded-2xl border border-border bg-card p-5">
          <p className="text-sm font-bold">Votre montant (FCFA)</p>
          <input
            type="number"
            min="200"
            step="100"
            autoFocus
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            placeholder="Ex : 5 000"
            className="mt-3 w-full rounded-xl border border-input bg-background px-4 py-4 text-xl font-extrabold outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
          />
          <p className="mt-3 text-xs text-muted-foreground">
            Montant minimum : 200 FCFA. Chaque don est vérifié puis validé par
            notre équipe avant d&#39;être comptabilisé.
          </p>
          {finalAmount >= 200 && (
            <p className="mt-3 rounded-xl bg-secondary/60 px-3 py-2 text-sm font-bold text-secondary-foreground">
              Votre don : {formatNumber(finalAmount)} FCFA
            </p>
          )}
        </div>

        {/* Identity choice : anonyme ou identifié */}
        {finalAmount >= 200 && (
          <div className="mt-6 rounded-2xl border border-border bg-card p-5">
            <p className="text-sm font-extrabold">Anonymat du don</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Choisissez comment votre don sera enregistré.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setIdentity("anonymous")}
                className={"flex flex-col items-start gap-1 rounded-xl border-2 p-3 text-left transition active:scale-[0.98] " + (effectiveIdentity === "anonymous" ? "border-muted-foreground bg-secondary/70" : "border-border bg-background")}
              >
                <span className="flex items-center gap-1.5 text-sm font-bold">
                  <EyeOff className="h-4 w-4 text-muted-foreground" /> Anonyme
                </span>
                <span className="text-[10px] leading-tight text-muted-foreground">
                  Sans compte, aucun nom visible.
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (user) {
                    setIdentity("identified");
                  } else {
                    window.location.href = "/connexion?redirect=" + encodeURIComponent("/don") + "&notice=" + encodeURIComponent("Connectez-vous pour faire un don identifié — vous serez redirigé vers la page don.");
                  }
                }}
                className={"flex flex-col items-start gap-1 rounded-xl border-2 p-3 text-left transition active:scale-[0.98] " + (effectiveIdentity === "identified" ? "border-accent bg-accent/10" : "border-border bg-background")}
              >
                <span className="flex items-center gap-1.5 text-sm font-bold">
                  <UserCheck className="h-4 w-4 text-accent" /> Identifié
                </span>
                <span className="text-[10px] leading-tight text-muted-foreground">
                  {user ? `Associé à ${user.name || user.email || "votre compte"}` : "Connectez-vous pour être identifié."}
                </span>
              </button>
            </div>
          </div>
        )}

        {/* Payment via MoneyFusion — handles phone, name, fee breakdown & redirect */}
        {finalAmount >= 200 && (
          <div className="mt-6">
            <PaymentOptions
              amount={finalAmount}
              defaultTab="ussd"
              online={{
                type: "donation",
                itemId: "",
                items: [{ "Don RetrouvéMoi": finalAmount }],
                ctaLabel: "Faire ce don",
                onBeforePay: async () => {
                  await createPendingPayment({
                    userId: donorId,
                    type: "donation",
                    itemKey: "donation",
                    itemLabel: `Don ${formatNumber(finalAmount)} FCFA`,
                    amountFcfa: finalAmount,
                    description: "Don à RetrouveMoi",
                  });
                },
              }}
              ussd={{
                itemLabel: `Don ${formatNumber(finalAmount)} FCFA`,
                payload: {
                  userId: donorId,
                  type: "donation",
                  itemKey: "donation",
                  itemLabel: `Don ${formatNumber(finalAmount)} FCFA`,
                  amountFcfa: finalAmount,
                  description: "Don à RetrouveMoi",
                },
              }}
            />
          </div>
        )}

        {finalAmount < 200 && (
          <div className="mt-6 rounded-2xl border border-border bg-card p-5 text-center">
            <p className="text-sm text-muted-foreground">
              Le montant minimum est de 200 FCFA.
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
