import React, { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useParams, Link } from "react-router-dom";
import {
  FileText,
  Download,
  ArrowLeft,
  Calendar,
  MapPin,
  User,
  Box,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { pb } from "@/lib/supabaseClient";
import Layout from "@/components/Layout";
import { useBranding } from "@/contexts/BrandingContext";
import {
  downloadPV,
  TYPE_LABELS,
  TYPE_BADGE,
  formatDateTimeFr,
  qrUrl,
} from "@/lib/pv";

const card = "rounded-2xl border border-border bg-card p-5";

const PVLookupPage = () => {
  const { pvNumber } = useParams();
  const { branding } = useBranding();
  const [pv, setPv] = useState(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!pvNumber) return;
    setBusy(true);
    setError(null);
    pb.collection("pvs")
      .getFullList({
        filter: `pv_number = "${pvNumber.toUpperCase()}"`,
        requestKey: `pv-lookup-${pvNumber}`,
      })
      .then((res) => {
        if (res.length > 0) {
          setPv(res[0]);
        } else {
          setError("Ce numéro de procès-verbal n'existe pas.");
        }
      })
      .catch((e) => {
        setError("Erreur lors de la vérification.");
      })
      .finally(() => setBusy(false));
  }, [pvNumber]);

  return (
    <Layout>
      <Helmet>
        <title>{pv ? `PV ${pv.pv_number}` : "Vérification PV"} — ${branding?.app_name || "RetrouveMoi"}</title>
        <meta name="description" content={`Vérification du procès-verbal ${pvNumber}`} />
      </Helmet>

      <div className="mx-auto max-w-2xl px-4 py-6 pb-24">
        {/* Back */}
        <Link
          to="/"
          className="mb-6 inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-bold active:scale-[0.96]"
        >
          <ArrowLeft className="h-4 w-4" /> Retour
        </Link>

        {/* Loading */}
        {busy && (
          <div className="flex flex-col items-center gap-3 py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Vérification en cours…</p>
          </div>
        )}

        {/* Error */}
        {!busy && error && (
          <div className={`${card} text-center py-12`}>
            <FileText className="mx-auto h-12 w-12 text-muted-foreground/40" />
            <p className="mt-4 text-sm font-bold text-destructive">{error}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Numéro vérifié : <span className="font-mono">{pvNumber?.toUpperCase()}</span>
            </p>
          </div>
        )}

        {/* Found */}
        {!busy && pv && <PVDetail pv={pv} branding={branding} />}
      </div>
    </Layout>
  );
};

const PVDetail = ({ pv, branding }) => {
  const d = pv.data || {};
  const isDeposit = pv.type === "deposit";
  const brandName = branding?.app_name || "RetrouveMoi";

  return (
    <>
      {/* Verified badge */}
      <div className="mb-4 flex items-center gap-2 rounded-2xl bg-green-50 border border-green-200 px-4 py-3 dark:bg-green-900/20 dark:border-green-800/30">
        <ShieldCheck className="h-5 w-5 text-green-600 dark:text-green-400" />
        <div>
          <p className="text-sm font-extrabold text-green-700 dark:text-green-300">Procès-verbal authentique</p>
          <p className="text-xs text-green-600 dark:text-green-400">
            Vérifié via {brandName} · N° {pv.pv_number}
          </p>
        </div>
      </div>

      <div className={`${card} space-y-4`}>
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className={`inline-block rounded-full px-3 py-1 text-xs font-bold ${TYPE_BADGE[pv.type] || "bg-muted text-muted-foreground"}`}>
              {TYPE_LABELS[pv.type] || pv.type}
            </span>
            <h1 className="mt-2 text-xl font-extrabold">{pv.pv_number}</h1>
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" /> {formatDateTimeFr(pv.created)}
            </p>
          </div>
          <img
            src={qrUrl(pv.pv_number)}
            alt="QR Code de vérification"
            className="h-20 w-20 rounded-xl border border-border"
          />
        </div>

        {/* Info grid */}
        <div className="grid gap-3 sm:grid-cols-2">
          {d.signatoryName && (
            <div className="rounded-xl bg-muted/50 p-3">
              <p className="flex items-center gap-1 text-[10px] font-bold uppercase text-muted-foreground">
                <User className="h-3 w-3" /> {isDeposit ? "Déposant" : "Propriétaire"}
              </p>
              <p className="mt-1 text-sm font-semibold">
                {d.signatoryName} {d.signatoryFirstName || ""}
              </p>
              {d.signatoryPhone && (
                <p className="text-xs text-muted-foreground">{d.signatoryPhone}</p>
              )}
            </div>
          )}

          {d.objectCategory && (
            <div className="rounded-xl bg-muted/50 p-3">
              <p className="flex items-center gap-1 text-[10px] font-bold uppercase text-muted-foreground">
                <Box className="h-3 w-3" /> Catégorie
              </p>
              <p className="mt-1 text-sm font-semibold">{d.objectCategory}</p>
            </div>
          )}

          {pv.location && (
            <div className="rounded-xl bg-muted/50 p-3">
              <p className="flex items-center gap-1 text-[10px] font-bold uppercase text-muted-foreground">
                <MapPin className="h-3 w-3" /> Lieu
              </p>
              <p className="mt-1 text-sm font-semibold">{pv.location}</p>
            </div>
          )}

          {d.objectFoundDate && (
            <div className="rounded-xl bg-muted/50 p-3">
              <p className="flex items-center gap-1 text-[10px] font-bold uppercase text-muted-foreground">
                <Calendar className="h-3 w-3" /> Date de découverte
              </p>
              <p className="mt-1 text-sm font-semibold">{formatDateTimeFr(d.objectFoundDate)}</p>
            </div>
          )}
        </div>

        {/* Description */}
        {d.objectDescription && (
          <div>
            <p className="text-[10px] font-bold uppercase text-muted-foreground">Description</p>
            <p className="mt-1 text-sm leading-relaxed">{d.objectDescription}</p>
          </div>
        )}

        {/* Restitution: conformity */}
        {!isDeposit && (
          <div>
            <p className="text-[10px] font-bold uppercase text-muted-foreground mb-2">
              Conformité
            </p>
            <div className="flex flex-wrap gap-2">
              {d.conformObject !== undefined && (
                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${d.conformObject ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"}`}>
                  {d.conformObject ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                  Objet conforme
                </span>
              )}
              {d.conformLossDeclaration !== undefined && (
                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${d.conformLossDeclaration ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"}`}>
                  {d.conformLossDeclaration ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                  Déclaration vérifiée
                </span>
              )}
              {d.conformId !== undefined && (
                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${d.conformId ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"}`}>
                  {d.conformId ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                  Pièce d'identité
                </span>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => downloadPV(pv)}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-extrabold text-primary-foreground active:scale-[0.98]"
          >
            <Download className="h-4 w-4" /> Télécharger le PDF
          </button>
        </div>
      </div>
    </>
  );
};

export default PVLookupPage;
