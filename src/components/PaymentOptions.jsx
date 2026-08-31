import React, { useState } from "react";
import { Globe, PhoneCall } from "lucide-react";
import PaymentMethodPicker from "@/components/PaymentMethodPicker";
import UssdPayment from "@/components/UssdPayment";

/**
 * Offre deux moyens de paiement sur un même checkout :
 *  - "Paiement en ligne avec code OTP"  → PaymentMethodPicker (MoneyFusion, redirection)
 *  - "Payer ici"                        → UssdPayment (code à composer + capture du dépôt)
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

  // Style des boutons avec meilleur contraste et visibilité mobile
  const tabBtn = (active, type) => {
    const isOnline = type === "online";
    const activeColor = isOnline ? "blue" : "green";
    
    return `flex items-center justify-center gap-2 rounded-xl px-3 py-3.5 text-sm font-bold transition-all duration-200 w-full min-h-[56px] touch-manipulation ${
      active
        ? `bg-${activeColor}-600 text-white shadow-lg shadow-${activeColor}-200/50 ring-2 ring-${activeColor}-400 ring-offset-2 scale-[1.02]`
        : "bg-gray-100 text-gray-600 border-2 border-gray-200 hover:bg-gray-200 active:bg-gray-300"
    }`;
  };

  // Style des icônes
  const iconClass = (active, type) => {
    const isOnline = type === "online";
    const activeColor = isOnline ? "blue" : "green";
    return `h-5 w-5 flex-shrink-0 ${
      active ? "text-white" : `text-${activeColor}-600`
    }`;
  };

  return (
    <div className="w-full max-w-md mx-auto px-2 sm:px-0">
      {/* Tabs avec meilleure visibilité */}
      <div className="mb-6 grid grid-cols-2 gap-3 rounded-2xl bg-white p-2 shadow-lg border border-gray-100">
        {/* Bouton Payer en ligne */}
        <button
          type="button"
          onClick={() => setTab("online")}
          className={tabBtn(tab === "online", "online")}
          disabled={disabled}
          aria-pressed={tab === "online"}
        >
          <Globe className={iconClass(tab === "online", "online")} />
          <span className="text-center leading-tight">
            Payer en ligne
            <span className="block text-[11px] font-normal opacity-90">
              avec code OTP
            </span>
          </span>
          {tab === "online" && (
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
            </span>
          )}
        </button>

        {/* Bouton Payer ici */}
        <button
          type="button"
          onClick={() => setTab("ussd")}
          className={tabBtn(tab === "ussd", "ussd")}
          disabled={disabled}
          aria-pressed={tab === "ussd"}
        >
          <PhoneCall className={iconClass(tab === "ussd", "ussd")} />
          <span className="text-center leading-tight">
            Payer ici
            <span className="block text-[11px] font-normal opacity-90">
              sans code OTP
            </span>
          </span>
          {tab === "ussd" && (
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
            </span>
          )}
        </button>
      </div>

      {/* Contenu dynamique */}
      <div className="mt-4 transition-all duration-300">
        {tab === "online" ? (
          <PaymentMethodPicker 
            amount={amount} 
            {...online} 
            disabled={disabled} 
            key="online-payment"
          />
        ) : (
          <UssdPayment 
            amount={amount} 
            {...ussd} 
            disabled={disabled}
            key="ussd-payment"
          />
        )}
      </div>

      {/* Indicateur de sélection pour mobile */}
      <div className="mt-4 flex justify-center sm:hidden">
        <div className="flex gap-1">
          <div 
            className={`h-1.5 w-6 rounded-full transition-all duration-300 ${
              tab === "online" ? "bg-blue-600 w-8" : "bg-gray-300"
            }`}
          />
          <div 
            className={`h-1.5 w-6 rounded-full transition-all duration-300 ${
              tab === "ussd" ? "bg-green-600 w-8" : "bg-gray-300"
            }`}
          />
        </div>
      </div>
    </div>
  );
};

export default PaymentOptions;