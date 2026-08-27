import React, { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { CheckCircle2, Loader2, XCircle, ArrowLeft } from "lucide-react";
import Layout from "@/components/Layout";
import { verifyPayment, getPaymentContext, clearPaymentContext } from "@/lib/moneyfusion";
import { formatNumber } from "@/lib/format";

const RETRY_ROUTES = {
  subscription: "/abonnement",
  priority: "/premium",
  pro_account: "/comptes-pro",
  service: "/premium",
  donation: "/don",
};
const TYPE_LABELS = {
  subscription: "Abonnement",
  priority: "Mise en avant",
  pro_account: "Compte Pro",
  service: "Service",
  donation: "Don",
};

const SuccessPage = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState("loading");
  const [data, setData] = useState(null);
  const [activated, setActivated] = useState(null);
  const [paymentType, setPaymentType] = useState("subscription");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      return;
    }

    const ctx = getPaymentContext();
    setPaymentType(ctx?.type || "subscription");

    let attempts = 0;
    const maxAttempts = 5;
    let timer = null;
    let cancelled = false;

    const activate = async (paymentToken) => {
      try {
        const res = await fetch("/api/activate-payment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token: paymentToken,
            type: ctx?.type,
            itemKey: ctx?.itemKey,
            userId: ctx?.userId,
          }),
        });
        const result = await res.json();
        if (!cancelled && result.statut) {
          setActivated(result.activated);
          return result.status;
        }
      } catch {}
      return null;
    };

    const check = async () => {
      if (cancelled) return;
      try {
        const res = await verifyPayment(token);
        if (cancelled) return;

        if (res.statut && res.data) {
          setData(res.data);

          if (res.data.statut === "paid") {
            const actResult = await activate(token);
            if (!cancelled) {
              setActivated(actResult !== false);
              setStatus("success");
              clearPaymentContext();
            }
          } else if (res.data.statut === "failure" || res.data.statut === "no paid") {
            setStatus("failed");
            clearPaymentContext();
          } else if (attempts < maxAttempts) {
            attempts++;
            timer = setTimeout(check, 3000);
          } else {
            const actResult = await activate(token);
            if (!cancelled) {
              setActivated(actResult !== false);
              setStatus("success");
              clearPaymentContext();
            }
          }
        } else {
          setStatus("error");
        }
      } catch {
        if (!cancelled && attempts < maxAttempts) {
          attempts++;
          timer = setTimeout(check, 3000);
        } else if (!cancelled) {
          const actResult = await activate(token);
          setActivated(actResult !== false);
          setStatus("success");
          clearPaymentContext();
        }
      }
    };

    check();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [token]);

  const retryRoute = RETRY_ROUTES[paymentType] || "/abonnement";

  return (
    <Layout>
      <Helmet>
        <title>
          {status === "success"
            ? "Paiement réussi"
            : status === "failed"
              ? "Paiement échoué"
              : "Vérification…"}{" "}
          — RetrouveMoi
        </title>
      </Helmet>

      <div className="mx-auto max-w-md px-4 py-16 text-center">
        {/* Loading */}
        {status === "loading" && (
          <div>
            <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
            <h1 className="mt-6 text-xl font-extrabold">
              Vérification du paiement…
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Veuillez patienter, nous confirmons votre transaction.
            </p>
          </div>
        )}

        {/* Success */}
        {status === "success" && (
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 16 }}
          >
            <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-accent/15">
              <CheckCircle2 className="h-10 w-10 text-accent" />
            </div>
            <h1 className="mt-6 text-2xl font-extrabold">Paiement réussi !</h1>

            <p className="mt-3 text-sm text-muted-foreground">
              {TYPE_LABELS[paymentType] || "Votre paiement"} confirmé.
              {data?.Montant && (
                <span className="mt-1 block font-bold text-foreground">
                  {formatNumber(data.Montant)} FCFA
                  {data.frais ? ` (+ ${data.frais} FCFA frais)` : ""}
                </span>
              )}
              {data?.moyen && (
                <span className="mt-1 block text-xs text-muted-foreground">
                  via {data.moyen}
                </span>
              )}
            </p>

            {/* Activation status */}
            {activated === true && (
              <div className="mt-4 rounded-xl bg-accent/10 px-4 py-3 text-sm font-semibold text-accent">
                ✅ Votre {TYPE_LABELS[paymentType]?.toLowerCase() || "service"} est
                maintenant actif !
              </div>
            )}
            {activated === null && (
              <div className="mt-4 rounded-xl bg-primary/10 px-4 py-3 text-sm text-primary">
                <Loader2 className="inline h-4 w-4 animate-spin" /> Activation en cours…
              </div>
            )}

            {/* Contextual links */}
            <div className="mt-6 flex flex-col gap-2">
              {paymentType === "subscription" && (
                <Link
                  to="/abonnement"
                  className="rounded-xl bg-primary px-4 py-3.5 font-bold text-primary-foreground"
                >
                  Mon abonnement
                </Link>
              )}
              {paymentType === "priority" && (
                <Link
                  to="/tableau-de-bord"
                  className="rounded-xl bg-primary px-4 py-3.5 font-bold text-primary-foreground"
                >
                  Voir ma déclaration
                </Link>
              )}
              {paymentType === "pro_account" && (
                <Link
                  to="/comptes-pro"
                  className="rounded-xl bg-primary px-4 py-3.5 font-bold text-primary-foreground"
                >
                  Mon compte Pro
                </Link>
              )}
              {paymentType === "service" && (
                <Link
                  to="/premium"
                  className="rounded-xl bg-primary px-4 py-3.5 font-bold text-primary-foreground"
                >
                  Mes services
                </Link>
              )}
              {paymentType === "donation" && (
                <Link
                  to="/don"
                  className="rounded-xl bg-primary px-4 py-3.5 font-bold text-primary-foreground"
                >
                  Merci pour votre don !
                </Link>
              )}
              <Link
                to="/tableau-de-bord"
                className="rounded-xl border border-border px-4 py-3.5 font-bold"
              >
                Mon espace
              </Link>
              <Link
                to="/"
                className="rounded-xl border border-border px-4 py-3.5 font-bold"
              >
                Retour à l&apos;accueil
              </Link>
            </div>
          </motion.div>
        )}

        {/* Failed */}
        {status === "failed" && (
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
          >
            <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-destructive/10">
              <XCircle className="h-10 w-10 text-destructive" />
            </div>
            <h1 className="mt-6 text-2xl font-extrabold">Paiement échoué</h1>
            <p className="mt-3 text-sm text-muted-foreground">
              La transaction n&apos;a pas abouti. Vous pouvez réessayer.
            </p>
            <div className="mt-6 flex flex-col gap-2">
              <Link
                to={retryRoute}
                className="rounded-xl bg-primary px-4 py-3.5 font-bold text-primary-foreground"
              >
                Réessayer
              </Link>
              <Link
                to="/"
                className="rounded-xl border border-border px-4 py-3.5 font-bold"
              >
                Retour à l&apos;accueil
              </Link>
            </div>
          </motion.div>
        )}

        {/* Error / no token */}
        {status === "error" && (
          <div>
            <XCircle className="mx-auto h-10 w-10 text-destructive" />
            <h1 className="mt-6 text-xl font-extrabold">
              Erreur de vérification
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {token
                ? "Impossible de vérifier ce paiement. Contactez le support."
                : "Aucun token de paiement trouvé."}
            </p>
            <Link
              to="/"
              className="mt-6 inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-3 font-bold text-primary-foreground"
            >
              <ArrowLeft className="h-4 w-4" /> Retour
            </Link>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default SuccessPage;
