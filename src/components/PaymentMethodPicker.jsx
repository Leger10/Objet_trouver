import React, { useState } from "react";
import { toast } from "sonner";
import { Lock, Loader2, Smartphone, User, Phone } from "lucide-react";
import { initPayment, computeTotalWithFee, computeFee } from "@/lib/moneyfusion";
import { formatNumber } from "@/lib/format";

const field =
  "w-full rounded-xl border border-input bg-background px-4 py-3.5 text-base outline-none focus:border-primary focus:ring-2 focus:ring-ring/30";

/**
 * MoneyFusion payment button — collects phone + name, then redirects to checkout.
 * Props:
 *  - amount: number (FCFA, before fees)
 *  - onBeforePay: async () => void  (optional — e.g. create DB record before redirect)
 *  - type: string (payment type for MoneyFusion personal_Info)
 *  - itemId: string (related record ID)
 *  - items: array (custom article list, default: [{ paiement: amount }])
 *  - extraInfo: object (additional personal_Info fields)
 *  - ctaLabel: string
 *  - disabled: boolean
 */
const PaymentMethodPicker = ({
  amount = 0,
  onBeforePay,
  type = "paiement",
  itemId = "",
  items,
  extraInfo = {},
  ctaLabel = "Payer",
  disabled = false,
}) => {
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const totalWithFee = computeTotalWithFee(amount);
  const fee = computeFee(amount);

  const handlePay = async () => {
    if (!phone.trim() || phone.trim().length < 8) {
      toast.error("Numéro de téléphone invalide (8 chiffres minimum).");
      return;
    }
    if (!name.trim()) {
      toast.error("Indiquez votre nom.");
      return;
    }
    if (amount < 100) {
      toast.error("Montant minimum : 100 FCFA.");
      return;
    }

    setBusy(true);
    try {
      // Optional pre-hook (e.g. create pending DB record)
      if (onBeforePay) {
        await onBeforePay();
      }

      const result = await initPayment({
        amount,
        items: items || [{ [type]: amount }],
        phone: phone.trim(),
        name: name.trim(),
        type,
        itemId,
        extraInfo,
      });

      if (result.url) {
        window.location.href = result.url;
      }
    } catch (err) {
      toast.error(err?.message || "Erreur lors de l'initialisation du paiement.");
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      {/* Fee disclosure */}
      <div className="mb-4 rounded-xl bg-secondary/60 px-4 py-3 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Montant</span>
          <span className="font-bold">{formatNumber(amount)} FCFA</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Frais de service (3%)</span>
          <span className="font-bold text-muted-foreground">
            +{formatNumber(fee)} FCFA
          </span>
        </div>
        <div className="flex justify-between border-t border-border pt-1 mt-1">
          <span className="font-semibold">Total à payer</span>
          <span className="font-extrabold text-primary">
            {formatNumber(totalWithFee)} FCFA
          </span>
        </div>
      </div>

      {/* Phone number */}
      <div className="mb-3">
        <label className="text-xs font-bold text-muted-foreground">
          Numéro de téléphone (pour le paiement)
        </label>
        <div className="relative mt-1.5">
          <Smartphone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Ex: 0701234567"
            className={`${field} pl-10`}
          />
        </div>
      </div>

      {/* Name */}
      <div className="mb-4">
        <label className="text-xs font-bold text-muted-foreground">
          Nom complet
        </label>
        <div className="relative mt-1.5">
          <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Votre nom"
            className={`${field} pl-10`}
          />
        </div>
      </div>

      <p className="mb-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Lock className="h-3.5 w-3.5" /> Paiement sécurisé via MoneyFusion
        (Orange Money, Wave, MTN, Moov, Carte).
      </p>

      <button
        type="button"
        disabled={disabled || busy || amount < 100}
        onClick={handlePay}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-4 text-base font-extrabold text-primary-foreground transition-transform active:scale-[0.98] disabled:opacity-60"
      >
        {busy ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <>
            {ctaLabel} · {formatNumber(totalWithFee)} FCFA
          </>
        )}
      </button>
    </div>
  );
};

export default PaymentMethodPicker;
