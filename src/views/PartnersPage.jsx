import React from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { Handshake, Star, Trophy } from "lucide-react";
import Layout from "@/components/Layout";

const PARTNERS = [
  {
    name: "Orange CI",
    type: "Télécommunications",
    reward: "100 000 pts offerts ce mois-ci",
    desc: "Recharges téléphoniques et forfaits Internet disponibles dans la boutique de points.",
    color: "bg-orange-50 border-orange-200 dark:bg-orange-900/20 dark:border-orange-800/30",
    tag: "Sponsor principal",
  },
  {
    name: "MTN Mobile Money",
    type: "Services financiers",
    reward: "50 000 pts disponibles",
    desc: "Transfert de vos gains directement sur votre portefeuille MTN MoMo.",
    color: "bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800/30",
    tag: "Partenaire financier",
  },
  {
    name: "Wave",
    type: "Fintech",
    reward: "30 000 pts ce mois",
    desc: "Retirez vos gains RetrouveMoi instantanément via Wave.",
    color: "bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800/30",
    tag: "Partenaire paiement",
  },
  {
    name: "Jumia CI",
    type: "E-commerce",
    reward: "Bons d'achat exclusifs",
    desc: "Échangez vos points contre des bons d'achat Jumia pour faire vos emplettes.",
    color: "bg-orange-50 border-orange-100 dark:bg-orange-900/20 dark:border-orange-800/30",
    tag: "Partenaire commerce",
  },
];

const card = "rounded-2xl border bg-card p-5";

const PartnersPage = () => (
  <Layout>
    <Helmet>
      <title>Partenaires — RetrouveMoi</title>
      <meta
        name="description"
        content="Découvrez les partenaires RetrouveMoi qui sponsorisent les récompenses et soutiennent la plateforme citoyenne."
      />
    </Helmet>

    <div className="mx-auto w-full max-w-[90rem] px-4 py-10">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-extrabold">Nos partenaires</h1>
        <p className="mt-2 text-muted-foreground text-sm sm:text-base max-w-2xl">
          Des entreprises engagées aux côtés de la plateforme citoyenne
          RetrouveMoi pour financer les récompenses et simplifier la restitution
          des objets perdus.
        </p>
      </div>

      {/* Rewards pool banner */}
      <div className="mb-10 rounded-2xl bg-primary text-primary-foreground p-6 sm:p-8">
        <div className="flex flex-wrap gap-4 items-center">
          <Trophy className="h-10 w-10 shrink-0 opacity-80" />
          <div>
            <p className="text-lg sm:text-2xl font-extrabold">
              180 000 points offerts ce mois-ci
            </p>
            <p className="text-sm opacity-85 mt-1">
              grâce au soutien de nos partenaires — gagnez des points et
              échangez-les !
            </p>
          </div>
          <Link
            to="/recompenses"
            className="ml-auto rounded-xl bg-primary-foreground/20 hover:bg-primary-foreground/30 px-5 py-2.5 text-sm font-bold transition-colors"
          >
            Voir la boutique
          </Link>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-2">
        {PARTNERS.map((p) => (
          <div key={p.name} className={`${card} ${p.color}`}>
            <div className="flex items-start gap-3 mb-3">
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-background shrink-0">
                <Handshake className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="font-extrabold text-lg">{p.name}</p>
                <p className="text-xs text-muted-foreground">{p.type}</p>
              </div>
              <span className="ml-auto text-xs font-bold text-primary bg-primary/10 rounded-full px-3 py-1 shrink-0">
                {p.tag}
              </span>
            </div>
            <p className="text-sm text-muted-foreground mb-3">{p.desc}</p>
            <div className="flex items-center gap-2 rounded-xl bg-background/60 px-4 py-2.5">
              <Star className="h-4 w-4 text-primary shrink-0" />
              <span className="text-sm font-bold">{p.reward}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Institutional CTA */}
      <div className="mt-12 rounded-2xl border border-border bg-muted/40 p-6 sm:p-8 text-center">
        <h2 className="text-xl font-extrabold">Vous êtes une entreprise ?</h2>
        <p className="mt-2 text-sm text-muted-foreground max-w-xl mx-auto">
          Devenez partenaire RetrouveMoi et associez votre marque à une
          plateforme citoyenne à fort impact social. Tableaux de bord dédiés,
          visibilité accrue, campagnes de récompenses sponsorisées.
        </p>
        <Link
          to="/premium"
          className="mt-5 inline-block rounded-xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground"
        >
          Découvrir les offres Pro
        </Link>
      </div>
    </div>
  </Layout>
);

export default PartnersPage;
