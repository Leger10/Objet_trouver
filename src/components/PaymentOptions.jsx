import React, { useState } from "react";
import { Globe, PhoneCall } from "lucide-react";
import PaymentMethodPicker from "@/components/PaymentMethodPicker";
import UssdPayment from "@/components/UssdPayment";

/**
 * Offre deux moyens de paiement sur un même checkout :
 *  - "Paiement en ligne"  → PaymentMethodPicker (MoneyFusion, redirection)
 *  - "Code USSD"          → UssdPayment (code à composer + capture du dépôt)
 *
 * Props :
 *  - amount: number
 *  - online: object (props transmises au PaymentMethodPicker : type, itemId,
 *            items, extraInfo, ctaLabel, onBeforePay, ...)
 *  - ussd: object (props transmises à UssdPayment : itemLabel, payload,
 *            proofRequired)
 *  - defaultTab: "online" | "ussd"
 *  - disabled: boolean
 */
const PaymentOptions = ({
  amount = 0,
  online = {},
  ussd = {},
  disabled = false,
  defaultTab = "online",
}) => {
  const [tab, setTab] = useState(defaultTab);

  const tabBtn = (active) =>
    `flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-bold transition-colors ${
      active
        ? "bg-background text-foreground shadow-sm"
        : "text-muted-foreground"
    }`;

  return (
    <div>
      {/* Tabs */}
      <div className="mb-4 grid grid-cols-2 gap-1 rounded-xl bg-muted/70 p-1">
        <button type="button" onClick={() => setTab("online")} className={tabBtn(tab === "online")}>
          <Globe className="h-4 w-4" /> En ligne
        </button>
        <button type="button" onClick={() => setTab("ussd")} className={tabBtn(tab === "ussd")}>
          <PhoneCall className="h-4 w-4" /> Code USSD
        </button>
      </div>

      {tab === "online" ? (
        <PaymentMethodPicker amount={amount} {...online} disabled={disabled} />
      ) : (
        <UssdPayment amount={amount} {...ussd} disabled={disabled} />
      )}
    </div>
  );
};

export default PaymentOptions;