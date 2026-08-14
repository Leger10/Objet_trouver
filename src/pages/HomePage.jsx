import React, { useCallback, useEffect, useState } from "react";
import { Helmet } from "react-helmet";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Bell,
  HandHeart,
  Heart,
  Lock,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { pb } from "@/lib/supabaseClient";
import Layout from "@/components/Layout";
import AdSlot from "@/components/AdSlot";
import DeclarationCard from "@/components/DeclarationCard";
import PullToRefresh from "@/components/PullToRefresh";
import Reveal from "@/components/Reveal";
import CountUp from "@/components/CountUp";
import CategoryGrid from "@/components/CategoryGrid";
import { fetchCategoryCounts } from "@/lib/categories";
import InfoPopup from "@/components/InfoPopup";
import BrandLogo from "@/components/BrandLogo";
import { useBranding } from "@/contexts/BrandingContext";

const HERO =
  "https://images.hostinger.com/1d7b56f8-ae12-42ac-9369-50d15f8f42a1.png";
const DESK =
  "https://images.hostinger.com/d4a0e0a1-442d-4769-b589-bbd84e033fc5.png";

const steps = [
  {
    t: "Je déclare",
    d: "En 1 minute, avec photo et zone. Les numéros de documents restent masqués.",
  },
  {
    t: "Le moteur compare",
    d: "Chaque déclaration est confrontée à toute la base : score de 0 à 100 %.",
  },
  {
    t: "Je vérifie",
    d: "Questions de sécurité avant tout contact. Aucune coordonnée publique.",
  },
  {
    t: "Je récupère",
    d: "Restitution confirmée par les deux parties, points crédités au trouveur.",
  },
];

const HomePage = () => {
  const { branding } = useBranding();
  const [latest, setLatest] = useState([]);
  const [stats, setStats] = useState({ lost: 0, found: 0, returned: 0 });
  const [categories, setCategories] = useState([]);
  const [catCounts, setCatCounts] = useState({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [list, lost, found, returned, cats, counts] = await Promise.all([
        pb.collection("declarations").getList(1, 6, {
          sort: "-priority,-created",
          filter: 'status != "blocked"',
          expand: "category",
          requestKey: "home-list",
        }),
        pb
          .collection("declarations")
          .getList(1, 1, { filter: 'kind = "lost"', requestKey: "home-lost" }),
        pb
          .collection("declarations")
          .getList(1, 1, {
            filter: 'kind = "found"',
            requestKey: "home-found",
          }),
        pb
          .collection("declarations")
          .getList(1, 1, {
            filter: 'status = "returned"',
            requestKey: "home-ret",
          }),
        pb
          .collection("categories")
          .getFullList({ sort: "position", requestKey: "home-cats" }),
        fetchCategoryCounts(),
      ]);
      setLatest(list.items);
      setStats({
        lost: lost.totalItems,
        found: found.totalItems,
        returned: returned.totalItems,
      });
      setCategories(cats);
      setCatCounts(counts);
    } catch (_) {
      setLatest([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Layout>
      <Helmet>
        <title>
          {branding.app_name} — Objets et documents perdus ou retrouvés
        </title>
        <meta
          name="description"
          content={`${branding.app_name} centralise les déclarations d'objets égarés et retrouvés : CNI, passeport, téléphone, moto, clés. ${branding.tagline}.`}
        />
      </Helmet>

      <PullToRefresh onRefresh={load}>
        {/* HERO */}
        <section className="relative overflow-hidden min-h-[calc(100dvh-128px)] flex items-center">
          <div className="absolute inset-0 -z-10">
            <img
              src={HERO}
              alt="Restitution d'un portefeuille et d'une carte d'identité dans une rue d'Abidjan"
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[hsl(206_84%_14%/0.95)] via-[hsl(206_70%_18%/0.88)] to-[hsl(162_72%_20%/0.65)]" />
          </div>
          <div className="mx-auto w-full max-w-[90rem] px-4 sm:px-6 pb-12 pt-8 sm:pb-20 sm:pt-16 text-white">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-start gap-3"
            >
              <BrandLogo
                size="xl"
                linkToHome={false}
                imgClassName="rounded-2xl bg-black/35 p-1.5 shadow-lg"
              />
              <p
                className="text-xs sm:text-sm font-bold uppercase tracking-[0.2em]"
                style={{ color: branding.color_yellow }}
              >
                {branding.tagline}
              </p>
            </motion.div>
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.04 }}
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold uppercase tracking-widest"
            >
              <Sparkles className="h-4 w-4" /> Une seule base, toute la ville
            </motion.p>
            <motion.h1
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 }}
              className="mt-4 sm:mt-5 max-w-3xl text-3xl sm:text-5xl lg:text-6xl font-extrabold leading-[1.05]"
            >
              Perdu aujourd'hui,{" "}
              <span className="relative inline-block">
                retrouvé
                <svg
                  viewBox="0 0 200 12"
                  className="absolute -bottom-1 left-0 h-3 w-full"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  <path
                    d="M2 8 C60 2, 140 12, 198 4"
                    stroke="hsl(162 72% 55%)"
                    strokeWidth="5"
                    fill="none"
                    strokeLinecap="round"
                  />
                </svg>
              </span>{" "}
              demain.
            </motion.h1>
            <p className="mt-4 sm:mt-5 max-w-xl text-sm sm:text-base lg:text-lg text-white/85 leading-relaxed">
              Déclarez un objet égaré ou retrouvé. Notre moteur compare
              automatiquement toutes les déclarations et vous alerte dès qu'une
              correspondance dépasse 40 %.
            </p>

            <div className="mt-6 sm:mt-8 grid gap-3 sm:gap-4">
              <Link
                to="/declarer/perdu"
                className="group flex items-center gap-4 rounded-2xl p-5 sm:p-6 text-white shadow-[0_18px_40px_-18px_rgba(0,0,0,0.45)] transition-transform active:scale-[0.98] min-h-[88px]"
                style={{
                  background: `linear-gradient(135deg, ${branding.color_red}, #c1121f)`,
                }}
              >
                <span className="grid h-12 w-12 sm:h-14 sm:w-14 shrink-0 place-items-center rounded-2xl bg-white/20">
                  <Search className="h-6 w-6 sm:h-7 sm:w-7" strokeWidth={2.6} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-lg sm:text-xl font-extrabold tracking-tight">
                    J'AI ÉGARÉ
                  </span>
                  <span className="block text-xs sm:text-sm text-white/85">
                    Déclarer un objet ou document perdu
                  </span>
                </span>
                <ArrowRight className="h-6 w-6 shrink-0 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link
                to="/declarer/retrouve"
                className="group flex items-center gap-4 rounded-2xl p-5 sm:p-6 text-white shadow-[0_18px_40px_-18px_rgba(0,0,0,0.45)] transition-transform active:scale-[0.98] min-h-[88px]"
                style={{
                  background: `linear-gradient(135deg, ${branding.color_green}, #1b4332)`,
                }}
              >
                <span className="grid h-12 w-12 sm:h-14 sm:w-14 shrink-0 place-items-center rounded-2xl bg-white/20">
                  <HandHeart
                    className="h-6 w-6 sm:h-7 sm:w-7"
                    strokeWidth={2.6}
                  />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-lg sm:text-xl font-extrabold tracking-tight">
                    J'AI RETROUVÉ
                  </span>
                  <span className="block text-xs sm:text-sm text-white/85">
                    Déclarer un objet trouvé · +10 points
                  </span>
                </span>
                <ArrowRight className="h-6 w-6 shrink-0 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link
                to="/rechercher"
                className="group flex items-center gap-4 rounded-2xl border-2 border-white/50 bg-white/10 p-5 sm:p-6 text-white backdrop-blur-sm transition-transform active:scale-[0.98] min-h-[80px]"
              >
                <span className="grid h-12 w-12 sm:h-14 sm:w-14 shrink-0 place-items-center rounded-2xl bg-white/15">
                  <Search className="h-6 w-6 sm:h-7 sm:w-7" strokeWidth={2.6} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-lg sm:text-xl font-extrabold tracking-tight">
                    RECHERCHER
                  </span>
                  <span className="block text-xs sm:text-sm text-white/80">
                    Parcourir toute la base d'un coup
                  </span>
                </span>
                <ArrowRight className="h-6 w-6 shrink-0 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link
                to="/don"
                className="group flex items-center gap-4 rounded-2xl bg-gradient-to-r from-[hsl(258_84%_58%)] to-[hsl(280_75%_52%)] p-4 sm:p-5 text-white shadow-[0_14px_34px_-18px_hsl(270_80%_50%/0.7)] transition-transform active:scale-[0.98] min-h-[72px]"
              >
                <span className="grid h-10 w-10 sm:h-11 sm:w-11 shrink-0 place-items-center rounded-xl bg-white/20">
                  <Heart className="h-5 w-5 sm:h-6 sm:w-6" strokeWidth={2.6} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-base sm:text-lg font-extrabold tracking-tight">
                    JE FAIS UN DON
                  </span>
                  <span className="block text-xs text-white/85">
                    Soutenir l&apos;initiative {branding.app_name}
                  </span>
                </span>
                <ArrowRight className="h-5 w-5 shrink-0 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>

            <div className="mt-8 sm:mt-10 flex flex-wrap gap-6 sm:gap-8 text-sm">
              <p>
                <CountUp
                  value={stats.lost}
                  className="text-xl sm:text-2xl font-extrabold"
                />{" "}
                <span className="text-white/75 text-xs sm:text-sm">
                  objets égarés déclarés
                </span>
              </p>
              <p>
                <CountUp
                  value={stats.found}
                  className="text-xl sm:text-2xl font-extrabold"
                />{" "}
                <span className="text-white/75 text-xs sm:text-sm">
                  objets retrouvés
                </span>
              </p>
              <p>
                <CountUp
                  value={stats.returned}
                  className="text-xl sm:text-2xl font-extrabold"
                />{" "}
                <span className="text-white/75 text-xs sm:text-sm">
                  restitutions confirmées
                </span>
              </p>
            </div>
          </div>
        </section>

        {/* MARQUEE */}
        <div className="border-y border-border bg-secondary/60 py-2.5 sm:py-3 overflow-hidden">
          <div className="flex w-max marquee gap-6 sm:gap-8 whitespace-nowrap text-xs sm:text-sm font-bold uppercase tracking-widest text-secondary-foreground">
            {[0, 1].map((k) => (
              <span key={k} className="flex gap-6 sm:gap-8">
                <span>CNI</span>
                <span>·</span>
                <span>Passeport</span>
                <span>·</span>
                <span>Permis</span>
                <span>·</span>
                <span>Carte grise</span>
                <span>·</span>
                <span>Plaque</span>
                <span>·</span>
                <span>Moto</span>
                <span>·</span>
                <span>Voiture</span>
                <span>·</span>
                <span>Vélo</span>
                <span>·</span>
                <span>Téléphone</span>
                <span>·</span>
                <span>Portefeuille</span>
                <span>·</span>
                <span>Sac</span>
                <span>·</span>
                <span>Clés</span>
                <span>·</span>
                <span>Documents</span>
                <span>·</span>
              </span>
            ))}
          </div>
        </div>

        {/* BANNIÈRE PUB */}
        <div className="mx-auto w-full max-w-[90rem] px-4 sm:px-6 pt-4">
          <AdSlot placement="home_top" />
        </div>

        {/* ABONNEMENTS & COMPTES PRO */}
        <section className="mx-auto w-full max-w-[90rem] px-4 sm:px-6 py-8 sm:py-10">
          <div className="grid gap-4 sm:grid-cols-2">
            <Link
              to="/abonnement"
              className="group flex items-center gap-4 rounded-2xl bg-gradient-to-br from-[hsl(206_84%_32%)] to-[hsl(199_80%_42%)] p-5 text-white transition-transform active:scale-[0.98] min-h-[88px]"
            >
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/20 text-2xl">
                🥈
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-lg font-extrabold tracking-tight">
                  Abonnements Premium & Pro
                </span>
                <span className="block text-xs sm:text-sm text-white/85">
                  Sans pub, alertes illimitées — dès 2 500 FCFA/mois
                </span>
              </span>
              <ArrowRight className="h-6 w-6 shrink-0 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link
              to="/comptes-pro"
              className="group flex items-center gap-4 rounded-2xl bg-gradient-to-br from-[hsl(160_60%_30%)] to-[hsl(168_64%_24%)] p-5 text-white transition-transform active:scale-[0.98] min-h-[88px]"
            >
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/20 text-2xl">
                🏛️
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-lg font-extrabold tracking-tight">
                  Comptes professionnels
                </span>
                <span className="block text-xs sm:text-sm text-white/85">
                  Mairies, entreprises, universités — dès 10 000 FCFA/mois
                </span>
              </span>
              <ArrowRight className="h-6 w-6 shrink-0 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </section>

        {/* PARCOURS */}
        <section className="mx-auto w-full max-w-[72rem] px-4 sm:px-6 py-12 sm:py-16">
          <Reveal>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold">
              Du signalement à la restitution
            </h2>
            <p className="mt-3 max-w-2xl text-sm sm:text-base text-muted-foreground">
              Chaque étape protège les deux parties : identité masquée,
              questions de vérification, confirmation mutuelle.
            </p>
          </Reveal>
          <ol className="mt-8 sm:mt-10 grid gap-px overflow-hidden rounded-2xl border border-border bg-border grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((s, i) => (
              <li key={s.t} className="bg-card p-5 sm:p-6">
                <span className="font-mono text-sm font-bold text-primary">
                  0{i + 1}
                </span>
                <p className="mt-2 text-base sm:text-lg font-bold">{s.t}</p>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  {s.d}
                </p>
              </li>
            ))}
          </ol>
        </section>

        {/* CATEGORIES */}
        <section className="mx-auto w-full max-w-[90rem] px-4 sm:px-6 py-12 sm:py-16">
          <Reveal>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold">
              Explorer par catégorie
            </h2>
            <p className="mt-3 max-w-2xl text-sm sm:text-base text-muted-foreground">
              Documents, véhicules, effets personnels : chaque catégorie
              regroupe les objets égarés et retrouvés correspondants.
            </p>
          </Reveal>
          <div className="mt-8 sm:mt-10">
            {categories.length === 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-3">
                {[0, 1, 2, 3, 4, 5, 6, 7].map((k) => (
                  <div
                    key={k}
                    className="h-24 animate-pulse rounded-2xl bg-muted"
                  />
                ))}
              </div>
            )}
            {categories.length > 0 && (
              <CategoryGrid
                categories={categories}
                counts={catCounts}
                linkBase="/rechercher?cat="
                size="lg"
              />
            )}
          </div>
        </section>

        {/* DERNIERES DECLARATIONS + PUB */}
        <section className="mx-auto w-full max-w-[90rem] px-4 sm:px-6 pb-12 sm:pb-16">
          <div className="grid gap-6 sm:gap-8 lg:grid-cols-[2fr_1fr]">
            <div>
              <div className="flex items-end justify-between gap-4">
                <h2 className="text-xl sm:text-2xl font-extrabold">
                  Dernières déclarations
                </h2>
                <Link
                  to="/rechercher"
                  className="text-sm font-bold text-primary underline underline-offset-4 shrink-0"
                >
                  Voir tout
                </Link>
              </div>
              <div className="mt-4 sm:mt-5 grid gap-3 sm:grid-cols-2">
                {loading &&
                  [0, 1, 2, 3].map((k) => (
                    <div
                      key={k}
                      className="h-28 animate-pulse rounded-2xl bg-muted"
                    />
                  ))}
                {!loading && latest.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-border p-6 sm:p-8 text-center text-muted-foreground sm:col-span-2 text-sm">
                    Aucune déclaration pour le moment. Soyez le premier :{" "}
                    <Link
                      to="/declarer/perdu"
                      className="font-bold text-primary"
                    >
                      déclarer un objet
                    </Link>
                    .
                  </div>
                )}
                {latest.map((item) => (
                  <DeclarationCard key={item.id} item={item} />
                ))}
              </div>
            </div>
            <div className="space-y-4">
              <AdSlot />
              <div className="overflow-hidden rounded-2xl border border-border">
                <img
                  src={DESK}
                  alt="Agent municipal enregistrant des objets retrouvés à Yaoundé"
                  className="h-40 sm:h-44 w-full object-cover"
                />
                <div className="p-4 sm:p-5">
                  <p className="font-bold text-sm sm:text-base">
                    Mairies, universités, entreprises
                  </p>
                  <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
                    Un compte institutionnel pour enregistrer en masse les
                    objets déposés à votre guichet.
                  </p>
                  <Link
                    to="/premium"
                    className="mt-3 inline-block text-sm font-bold text-primary underline underline-offset-4"
                  >
                    Voir les offres
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SECURITE */}
        <section className="bg-[hsl(206_84%_14%)] py-12 sm:py-16 text-white">
          <div className="mx-auto grid w-full max-w-[72rem] gap-4 sm:gap-8 px-4 sm:px-6 grid-cols-1 sm:grid-cols-3">
            {[
              {
                i: Lock,
                t: "Numéros masqués",
                d: "Un numéro de CNI ou de passeport ne s'affiche jamais en entier : ********4821.",
              },
              {
                i: ShieldCheck,
                t: "Vérification avant contact",
                d: "Le propriétaire pose une question de sécurité. Sans bonne réponse, pas de mise en relation.",
              },
              {
                i: Bell,
                t: "Alertes automatiques",
                d: "Notification immédiate dès qu'une nouvelle déclaration correspond à la vôtre.",
              },
            ].map(({ i: Icon, t, d }) => (
              <div key={t} className="rounded-2xl bg-white/5 p-5 sm:p-6">
                <Icon className="h-6 w-6 text-[hsl(162_72%_60%)]" />
                <p className="mt-3 text-base sm:text-lg font-bold">{t}</p>
                <p className="mt-2 text-sm text-white/75 leading-relaxed">
                  {d}
                </p>
              </div>
            ))}
          </div>
        </section>
      </PullToRefresh>
      <InfoPopup />
    </Layout>
  );
};

export default HomePage;
