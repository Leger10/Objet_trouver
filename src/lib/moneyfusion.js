import { pb } from "@/lib/supabaseClient";

// ── MoneyFusion API Configuration ──────────────────────────────────────────
// Les appels passent par les fonctions Netlify (proxy) : l'API MoneyFusion
// n'autorise pas les requêtes navigateur (CORS).
const PAYIN_API_URL = "/api/create-payment";
const VERIFY_URL = "/api/verify-payment";
const RETURN_URL = "https://retrouvemoi.netlify.app/success";
const WEBHOOK_URL = "https://retrouvemoi.netlify.app/api/webhook";

// 3% deposit fee on all incoming payments
export const DEPOSIT_FEE_RATE = 0.03;
export const computeTotalWithFee = (amount) =>
  Math.round(amount * (1 + DEPOSIT_FEE_RATE));
export const computeFee = (amount) =>
  Math.round(amount * DEPOSIT_FEE_RATE);

// ── Initiate a payment ─────────────────────────────────────────────────────
// Returns { statut, token, url } on success
export const initPayment = async ({
  amount,
  items,
  phone,
  name,
  userId,
  type,
  itemId,
  extraInfo = {},
}) => {
  const body = {
    totalPrice: computeTotalWithFee(amount),
    article: items || [{ [type || "paiement"]: amount }],
    numeroSend: phone || "",
    nomclient: name || "Utilisateur",
    personal_Info: [
      {
        userId: userId || "",
        type: type || "",
        itemId: itemId || "",
        baseAmount: amount,
        ...extraInfo,
      },
    ],
    return_url: RETURN_URL,
    webhook_url: WEBHOOK_URL,
  };

  const res = await fetch(PAYIN_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Passerelle de paiement indisponible (${res.status})`);
  }
  if (!data.statut || !data.url) {
    throw new Error(data.message || data.error || "Erreur lors de l'initialisation du paiement");
  }
  return data; // { statut: true, token, url, message }
};

// ── Redirect to MoneyFusion checkout ───────────────────────────────────────
export const redirectToPayment = (paymentUrl) => {
  if (paymentUrl) {
    window.location.href = paymentUrl;
  }
};

// ── Save payment context before redirect (used by SuccessPage) ─────────────
export const savePaymentContext = ({ token, type, itemKey, userId }) => {
  try {
    sessionStorage.setItem(
      "mf_pending_payment",
      JSON.stringify({ token, type, itemKey, userId, ts: Date.now() })
    );
  } catch {}
};

export const getPaymentContext = () => {
  try {
    const raw = sessionStorage.getItem("mf_pending_payment");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const clearPaymentContext = () => {
  try { sessionStorage.removeItem("mf_pending_payment"); } catch {}
};

// ── Verify payment status ──────────────────────────────────────────────────
export const verifyPayment = async (token) => {
  const res = await fetch(`${VERIFY_URL}?token=${encodeURIComponent(token)}`);
  if (!res.ok) {
    throw new Error("Impossible de vérifier le paiement pour le moment");
  }
  const data = await res.json();
  return data; // { statut: true, data: { Montant, frais, statut: "paid"|"pending"|"failure" } }
};

// ── Save a pending payment record before redirect ──────────────────────────
export const createPendingPayment = async ({
  userId,
  type,
  itemKey,
  itemLabel,
  amountFcfa,
  description = "",
  moneyfusionToken = "",
}) => {
  return pb.collection("payments").create({
    user: userId,
    type,
    item_key: itemKey,
    item_label: itemLabel,
    amount: amountFcfa,
    amount_fcfa: amountFcfa,
    fee_fcfa: computeFee(amountFcfa),
    total_charged: computeTotalWithFee(amountFcfa),
    status: "pending",
    payment_method: "moneyfusion",
    description,
    moneyfusion_token: moneyfusionToken,
  });
};

// ── Confirm payment after verification ─────────────────────────────────────
export const confirmPayment = async (paymentId, mfData) => {
  return pb.collection("payments").update(paymentId, {
    status: "confirmed",
    moneyfusion_moyen: mfData?.moyen || "",
    moneyfusion_transaction: mfData?.numeroTransaction || "",
    moneyfusion_frais: mfData?.frais || 0,
    confirmed_at: new Date().toISOString(),
  });
};

// ── Initiate a withdrawal (payout) ────────────────────────────────────────
// Uses Netlify Function as proxy (API key stays server-side)
export const initiateWithdrawal = async ({
  phone,
  amount,
  withdrawMode,
  countryCode = "bf",
  webhookUrl,
}) => {
  const res = await fetch("/api/withdraw", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      countryCode,
      phone,
      amount,
      withdraw_mode: withdrawMode,
      webhook_url:
        webhookUrl || "https://retrouvemoi.netlify.app/api/withdraw-hook",
    }),
  });

  const data = await res.json();
  if (!data.statut) {
    throw new Error(data.message || "Erreur lors de l'initiation du retrait");
  }
  return data; // { tokenPay, statut: true, message }
};

// ── Create a withdrawal record ─────────────────────────────────────────────
export const createWithdrawalRecord = async ({
  userId,
  amountPoints,
  amountFcfa,
  commissionFcfa,
  netAmount,
  phone,
  withdrawMode,
  mfToken = "",
}) => {
  return pb.collection("withdrawals").create({
    user: userId,
    amount_points: amountPoints,
    amount_fcfa: amountFcfa,
    commission_fcfa: commissionFcfa,
    net_amount: netAmount,
    payment_method: withdrawMode,
    payment_details: phone,
    status: "pending",
    moneyfusion_token: mfToken,
  });
};

// ── Withdrawal mode mapping ────────────────────────────────────────────────
export const WITHDRAW_MODES = [
  { key: "Orange Money", mfKey: "orange-money-bf", label: "Orange Money" },
  { key: "Wave", mfKey: "wave-bf", label: "Wave" },
  { key: "MTN Mobile Money", mfKey: "mtn-bf", label: "MTN MoMo" },
  { key: "Moov", mfKey: "moov-bf", label: "Moov Money" },
];

export const getWithdrawMode = (methodKey) =>
  WITHDRAW_MODES.find((m) => m.key === methodKey)?.mfKey || "wave-ci";
