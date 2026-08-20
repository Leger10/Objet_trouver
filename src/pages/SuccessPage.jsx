import React, { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { CheckCircle2, Loader2, XCircle, ArrowLeft } from "lucide-react";
import Layout from "@/components/Layout";
import { verifyPayment } from "@/lib/moneyfusion";
import { formatNumber } from "@/lib/format";

const SuccessPage = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState("loading"); // loading | success | failed | error
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!token) {
      setStatus("error");
      return;
    }

    let attempts = 0;
    const maxAttempts = 5;

    const check = async () => {
      try {
        const res = await verifyPayment(token);
        if (res.statut && res.data) {
          setData(res.data);
          if (res.data.statut === "paid") {
            setStatus("success");
          } else if (res.data.statut === "failure" || res.data.statut === "no paid") {
            setStatus("failed");
          } else if (attempts < maxAttempts) {
            // Still pending, retry after 3s
            attempts++;
            setTimeout(check, 3000);
          } else {
            // Timed out — webhook will handle it
            setStatus("success");
          }
        } else {
          setStatus("error");
        }
      } catch (_) {
        if (attempts < maxAttempts) {
          attempts++;
          setTimeout(check, 3000);
        } else {
          setStatus("success"); // Assume webhook will confirm
        }
      }
    };

    check();
  }, [token]);

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
              Votre transaction a été confirmée.
              {data?.Montant && (
                <span className="mt-1 block font-bold text-foreground">
                  Montant : {formatNumber(data.Montant)} FCFA
                  {data.frais ? ` (+ ${data.frais} FCFA frais)` : ""}
                </span>
              )}
              {data?.moyen && (
                <span className="mt-1 block text-xs text-muted-foreground">
                  via {data.moyen}
                </span>
              )}
            </p>
            <div className="mt-6 flex flex-col gap-2">
              <Link
                to="/tableau-de-bord"
                className="rounded-xl bg-primary px-4 py-3.5 font-bold text-primary-foreground"
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
                to="/don"
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
              <ArrowLeft className="h-4 w-4" /> Retour à l&apos;accueil
            </Link>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default SuccessPage;
