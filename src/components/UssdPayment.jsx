import React, { useRef, useState } from "react";
import { toast } from "sonner";
import {
  PhoneCall,
  Copy,
  Check,
  CheckCircle2,
  ImagePlus,
  X,
  Loader2,
  Smartphone,
  Info,
} from "lucide-react";
import { ussdCode, ussdTelLink, USSD_STEPS } from "@/lib/payments";
import { formatNumber } from "@/lib/format";
import { submitUssdPayment } from "@/lib/moneyfusion";

/**
 * Paiement par code USSD à composer sur le téléphone,
 * suivi de l'envoi de la capture d'écran du dépôt à l'admin.
 *
 * Props :
 *  - amount: number (FCFA)
 *  - itemLabel: string (ex: "Abonnement Premium")
 *  - payload: object transmis à submitUssdPayment
 *      { userId, type, itemKey, itemLabel, amountFcfa, description }
 *  - proofRequired: boolean (défaut true) — capture obligatoire
 *  - onBeforeSubmit: async () => void — appelé avant l'enregistrement
 *  - disabled: boolean
 */
const UssdPayment = ({
  amount = 0,
  itemLabel = "",
  payload = {},
  proofRequired = true,
  onBeforeSubmit,
  disabled = false,
}) => {
  const code = ussdCode(amount);
  const inputRef = useRef(null);
  const [proof, setProof] = useState(null);
  const [proofUrl, setProofUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const handlePickProof = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      toast.error("Veuillez choisir une image (capture d'écran).");
      return;
    }
    if (f.size > 6 * 1024 * 1024) {
      toast.error("Image trop lourde (max 6 Mo).");
      return;
    }
    setProof(f);
    setProofUrl(URL.createObjectURL(f));
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Copie impossible — composez le code manuellement.");
    }
  };

  const handleDial = () => {
    window.location.href = ussdTelLink(amount);
  };

  const handleConfirm = async () => {
    if (disabled || busy) return;
    if (proofRequired && !proof) {
      toast.error("Joignez d'abord la capture d'écran du dépôt.");
      return;
    }
    setBusy(true);
    try {
      if (onBeforeSubmit) await onBeforeSubmit();
      await submitUssdPayment({ ...payload, proofFile: proof });
      setDone(true);
      toast.success("Paiement signalé et transmis à l'admin", {
        description:
          "Vous recevrez la confirmation après validation de votre dépôt.",
      });
    } catch (err) {
      toast.error(err?.message || "Une erreur est survenue.");
    }
    setBusy(false);
  };

  if (done) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5 text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-accent/15">
          <CheckCircle2 className="h-8 w-8 text-accent" />
        </div>
        <p className="mt-4 font-extrabold text-lg">Paiement signalé !</p>
        <p className="mt-2 text-sm text-muted-foreground">
          {itemLabel
            ? `Votre ${itemLabel} sera activé après validation de votre dépôt par l'équipe.`
            : "Votre paiement sera activé après validation de votre dépôt."}
        </p>
        <p className="mt-3 text-xs text-muted-foreground">
          Suivez le statut dans votre espace.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      {/* Montant */}
      <div className="mb-4 rounded-xl bg-secondary/60 px-4 py-3 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Montant à payer</span>
          <span className="font-extrabold text-primary">
            {formatNumber(amount)} FCFA
          </span>
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Aucun frais de service · Orange Money uniquement
        </p>
      </div>

      {/* Code USSD */}
      <p className="mb-2 text-xs font-bold text-muted-foreground">
        Composez ce code sur votre téléphone :
      </p>
      <div className="rounded-2xl bg-[#ff7900]/10 border-2 border-dashed border-[#ff7900]/40 px-4 py-4 text-center">
        <span className="text-2xl font-extrabold tracking-wide tabular-nums text-[hsl(22_90%_42%)] dark:text-[hsl(22_90%_60%)] break-all">
          {code}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={handleDial}
          className="flex items-center justify-center gap-2 rounded-xl bg-primary px-3 py-3 text-sm font-bold text-primary-foreground active:scale-[0.98] transition-transform"
        >
          <PhoneCall className="h-4 w-4" /> Composer
        </button>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center justify-center gap-2 rounded-xl border border-border px-3 py-3 text-sm font-bold active:scale-[0.98] transition-transform"
        >
          {copied ? (
            <><Check className="h-4 w-4 text-accent" /> Copié !</>
          ) : (
            <><Copy className="h-4 w-4" /> Copier</>
          )}
        </button>
      </div>

      {/* Étapes */}
      <div className="mt-4 space-y-2 rounded-xl bg-muted/40 p-4">
        {USSD_STEPS.map((step, i) => (
          <p key={i} className="flex gap-2 text-xs text-muted-foreground">
            <Smartphone className="h-3.5 w-3.5 shrink-0 mt-0.5 text-primary" />
            <span>{step}</span>
          </p>
        ))}
      </div>

      {/* Capture d'écran du dépôt */}
      <div className="mt-4">
        <p className="mb-2 text-xs font-bold text-muted-foreground">
          {proofRequired ? "Capture d'écran du dépôt (requise)" : "Capture d'écran du dépôt"}
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={handlePickProof}
          className="hidden"
        />
        {proof ? (
          <div className="relative overflow-hidden rounded-2xl border border-border">
            <img
              src={proofUrl}
              alt="Capture du dépôt"
              className="h-36 w-full object-cover"
            />
            <button
              type="button"
              onClick={() => { setProof(null); setProofUrl(""); }}
              className="absolute right-2 top-2 rounded-full bg-black/60 p-1.5 text-white"
              aria-label="Retirer la capture"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border px-4 py-6 text-sm font-bold text-muted-foreground active:scale-[0.99] transition-transform"
          >
            <ImagePlus className="h-5 w-5" /> Joindre la capture du dépôt
          </button>
        )}
      </div>

      <button
        type="button"
        disabled={disabled || busy}
        onClick={handleConfirm}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-4 text-base font-extrabold text-primary-foreground transition-transform active:scale-[0.98] disabled:opacity-60"
      >
        {busy ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <>
            <CheckCircle2 className="h-5 w-5" /> J&apos;ai payé
          </>
        )}
      </button>

      <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Info className="h-3.5 w-3.5" /> Votre dépôt est envoyé à l&apos;admin,
        qui le valide avant activation.
      </p>
    </div>
  );
};

export default UssdPayment;