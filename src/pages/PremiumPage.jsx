import React, { useState } from "react";
import { Helmet } from "react-helmet";
import { Link } from "react-router-dom";
import { Bell, Building2, Check, Star } from "lucide-react";
import { pb } from "@/lib/supabaseClient";
import Layout from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";

const PHONE =
  "https://images.hostinger.com/9beb81a9-30fa-4a2b-8f4c-e0cc5df05962.png";

const offers = [
  {
    id: "premium",
    icon: Bell,
    name: "Alertes premium",
    price: "500 FCFA / mois",
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
    price: "500 FCFA / déclaration",
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
    price: "Sur devis",
    points: [
      "Mairies, universités, entreprises, transporteurs",
      "Enregistrement en masse des objets déposés au guichet",
      "Comptes agents multiples et statistiques dédiées",
    ],
  },
];

const PremiumPage = () => {
  const { user, isAuthed } = useAuth();
  const [saved, setSaved] = useState("");

  const activate = async (id) => {
    if (!isAuthed) return;
    try {
      await pb
        .collection("users")
        .update(user.id, { plan: id === "pro" ? "pro" : "premium" });
      setSaved(id);
    } catch (_) {
      setSaved(id);
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
        {offers.map(({ id, icon: Icon, name, price, points }) => (
          <div
            key={id}
            className="flex flex-col rounded-2xl border border-border bg-card p-6 rt-shadow"
          >
            <Icon className="h-6 w-6 text-primary" />
            <p className="mt-3 text-lg font-extrabold">{name}</p>
            <p className="mt-1 font-mono font-bold text-accent">{price}</p>
            <ul className="mt-4 flex-1 space-y-2 text-sm">
              {points.map((p) => (
                <li key={p} className="flex gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" />{" "}
                  <span className="text-muted-foreground">{p}</span>
                </li>
              ))}
            </ul>
            {isAuthed ? (
              <button
                type="button"
                onClick={() => activate(id)}
                className="mt-5 rounded-xl bg-primary px-4 py-3 font-bold text-primary-foreground"
              >
                {saved === id ? "Demande enregistrée" : "Activer"}
              </button>
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
        Paiement par mobile money confirmé manuellement par notre équipe pendant
        la phase pilote. Votre statut est activé dès réception.
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
    </Layout>
  );
};

export default PremiumPage;
