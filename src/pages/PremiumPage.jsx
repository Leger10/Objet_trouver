import React, { useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { Bell, Building2, Check, Star, Loader2, Lock } from "lucide-react";
import { pb } from "@/lib/supabaseClient";
import Layout from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { formatNumber } from "@/lib/format";
import { initPayment, computeTotalWithFee, computeFee } from "@/lib/moneyfusion";

const PHONE =
  "https://images.hostinger.com/9beb81a9-30fa-4a2b-8f4c-e0cc5df05962.png";

const offers = [
  {
    id: "premium",
    icon: Bell,
    name: "Alertes premium",
    price: 500,
    priceLabel: "500 FCFA / mois",
    points: [
      "Notification immédiate de chaque correspondance",
      "Alerte élargie aux villes voisines",
      "Historique complet des scores de correspondance",
    ],
  },
  {
    id: "priority",
    icon: Star,
    name: "Déclaration prioritaire",
    price: 500,
    priceLabel: "500 FCFA / déclaration",
    points: [
      "Mise en avant en tête des recherches 30 jours",
      "Badge « Prioritaire » sur votre annonce",
      "Diffusion dans les alertes de la ville",
    ],
  },
  {
    id: "pro",
    icon: Building2,
    name: "Compte institutionnel",
    price: 0,
    priceLabel: "Sur devis",
    points: [
      "Mairies, universités, entreprises, transporteurs",
      "Enregistrement en masse des objets déposés au guichet",
      "Comptes agents multiples et statistiques dédiées",
    ],
  },
];

const field =
  "w-full rounded-xl border border-input bg-background px-4 py-3.5 text-base outline-none focus:border-primary focus:ring-2 focus:ring-ring/30";

const PremiumPage = () => {
  const { user, isAuthed } = useAuth();
  const [checkout, setCheckout] = useState(null);
  const [phone, setPhone] = useState("");
  const [name, setName] = useState(user?.name || "");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState("");

  const handlePay = async () => {
    if (!checkout || !isAuthed) return;
    if (!phone.trim() || phone.trim().length < 8) {
      const { toast } = await import("sonner");
      toast.error("Numéro de téléphone invalide.");
      return;
    }
    if (!name.trim()) {
      const { toast } = await import("sonner");
      toast.error("Indiquez votre nom.");
      return;
    }

    setBusy(true);
    try {
      const result = await initPayment({
        amount: checkout.price,
        items: [{ [checkout.name]: checkout.price }],
        phone: phone.trim(),
        name: name.trim(),
        userId: user.id,
        type: checkout.id === "priority" ? "priority" : "subscription",
        itemId: checkout.id,
        extraInfo: { offerId: checkout.id },
      });

      if (result.url) {
        // Save pending payment
        await pb.collection("payments").create({
          user: user.id,
          type: checkout.id === "priority" ? "priority" : "subscription",
          item_key: checkout.id,
          item_label: checkout.name,
          amount_fcfa: checkout.price,
          fee_fcfa: computeFee(checkout.price),
          total_charged: computeTotalWithFee(checkout.price),
          status: "pending",
          payment_method: "moneyfusion",
          moneyfusion_token: result.token || "",
          description: `Offre ${checkout.name}`,
        });
        window.location.href = result.url;
      }
    } catch (err) {
      const { toast } = await import("sonner");
      toast.error(err?.message || "Erreur lors du paiement.");
      setBusy(false);
    }
  };

  return (
    <Layout>
      <Helmet>
        <title>Offres premium et institutionnelles — RetrouveMoi</title>
        <meta
          name="description"
          content="Alertes premium à 500 FCFA/mois, déclarations prioritaires et comptes institutionnels pour mairies, universités et entreprises sur RetrouveMoi."
        />
      </Helmet>

      <section className="border-b border-border bg-secondary/40">
        <div className="mx-auto grid w-full max-w-[72rem] items-center gap-6 sm:gap-8 px-4 sm:px-6 py-8 sm:py-12 md:grid-cols-2">
          <div>
            <h1 className="text-3xl font-extrabold sm:text-4xl">
              Allez plus vite, retrouvez plus souvent
            </h1>
            <p className="mt-3 text-muted-foreground">
              La recherche et les déclarations resteront toujours gratuites. Les
              options payantes financent la plateforme et accélèrent les
              restitutions.
            </p>
          </div>
          <img
            src={PHONE}
            alt="Application RETROUVÉ consultée sur un téléphone à Dakar"
            className="rounded-2xl object-cover"
          />
        </div>
      </section>

      <div className="mx-auto grid w-full max-w-[72rem] gap-4 sm:gap-5 px-4 sm:px-6 py-8 sm:py-12 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
        {offers.map(({ id, icon: Icon, name: offerName, price, priceLabel, points }) => (
          <div
            key={id}
            className="flex flex-col rounded-2xl border border-border bg-card p-6 rt-shadow"
          >
            <Icon className="h-6 w-6 text-primary" />
            <p className="mt-3 text-lg font-extrabold">{offerName}</p>
            <p className="mt-1 font-mono font-bold text-accent">{priceLabel}</p>
            {price > 0 && (
              <p className="mt-1 text-[11px] text-muted-foreground">
                Total avec frais : {formatNumber(computeTotalWithFee(price))} FCFA
              </p>
            )}
            <ul className="mt-4 flex-1 space-y-2 text-sm">
              {points.map((p) => (
                <li key={p} className="flex gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" />{" "}
                  <span className="text-muted-foreground">{p}</span>
                </li>
              ))}
            </ul>
            {isAuthed ? (
              price > 0 ? (
                <button
                  type="button"
                  onClick={() => setCheckout({ id, name: offerName, price })}
                  className="mt-5 rounded-xl bg-primary px-4 py-3 font-bold text-primary-foreground active:scale-[0.98] transition-transform"
                >
                  Payer {formatNumber(computeTotalWithFee(price))} FCFA
                </button>
              ) : (
                <Link
                  to="/comptes-pro"
                  className="mt-5 rounded-xl bg-primary px-4 py-3 text-center font-bold text-primary-foreground"
                >
                  Demander un devis
                </Link>
              )
            ) : (
              <Link
                to="/inscription"
                className="mt-5 rounded-xl bg-primary px-4 py-3 text-center font-bold text-primary-foreground"
              >
                Créer un compte
              </Link>
            )}
          </div>
        ))}
      </div>

      <p className="mx-auto max-w-[72rem] px-4 pb-12 text-sm text-muted-foreground">
        Paiement sécurisé via MoneyFusion (Orange Money, Wave, MTN, Moov, Carte bancaire).
      </p>

      {/* Links to dedicated pages */}
      <div className="mx-auto max-w-[72rem] px-4 pb-12 grid gap-4 sm:grid-cols-2">
        <Link
          to="/abonnement"
          className="flex items-center gap-4 rounded-2xl border border-border bg-card p-5 transition-transform active:scale-[0.98] hover:border-primary"
        >
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary/10 text-2xl">
            🥈
          </span>
          <span className="flex-1">
            <span className="block font-extrabold">
              Abonnements Premium & Pro
            </span>
            <span className="block text-sm text-muted-foreground">
              Sans pub, alertes illimitées, à partir de 2 500 FCFA/mois
            </span>
          </span>
        </Link>
        <Link
          to="/comptes-pro"
          className="flex items-center gap-4 rounded-2xl border border-border bg-card p-5 transition-transform active:scale-[0.98] hover:border-primary"
        >
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary/10 text-2xl">
            🏛️
          </span>
          <span className="flex-1">
            <span className="block font-extrabold">Comptes professionnels</span>
            <span className="block text-sm text-muted-foreground">
              Mairies, entreprises, universités — dès 10 000 FCFA/mois
            </span>
          </span>
        </Link>
      </div>

      {/* Checkout modal */}
      {checkout && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4"
          onClick={() => !busy && setCheckout(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-card p-6 sheet-up sm:page-enter max-h-[92dvh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="font-extrabold text-lg mb-4">
              Payer {checkout.name}
            </p>

            {/* Fee breakdown */}
            <div className="mb-4 rounded-xl bg-secondary/60 px-4 py-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Montant</span>
                <span className="font-bold">{formatNumber(checkout.price)} FCFA</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Frais (3%)</span>
                <span className="font-bold text-muted-foreground">
                  +{formatNumber(computeFee(checkout.price))} FCFA
                </span>
              </div>
              <div className="flex justify-between border-t border-border pt-1 mt-1">
                <span className="font-semibold">Total</span>
                <span className="font-extrabold text-primary">
                  {formatNumber(computeTotalWithFee(checkout.price))} FCFA
                </span>
              </div>
            </div>

            {/* Phone */}
            <label className="flex flex-col gap-1.5 text-sm font-bold mb-3">
              Numéro de téléphone
              <input
                type="tel"
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Ex: 0701234567"
                className={field}
              />
            </label>

            {/* Name */}
            <label className="flex flex-col gap-1.5 text-sm font-bold mb-4">
              Nom complet
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Votre nom"
                className={field}
              />
            </label>

            <p className="mb-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Lock className="h-3.5 w-3.5" /> Paiement sécurisé via MoneyFusion
            </p>

            <div className="flex gap-3">
              <button
                type="button"
                disabled={busy}
                onClick={() => setCheckout(null)}
                className="flex-1 rounded-xl border border-border px-4 py-3 text-sm font-bold"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={handlePay}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground disabled:opacity-50"
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  `Payer ${formatNumber(computeTotalWithFee(checkout.price))} FCFA`
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default PremiumPage;
