import React, { useCallback, useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
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
  TrendingUp,
} from "lucide-react";
import { pb } from "@/lib/supabaseClient";
import Layout from "@/components/Layout";
import SponsorBanner from "@/components/SponsorBanner";
import PullToRefresh from "@/components/PullToRefresh";
import Reveal from "@/components/Reveal";
import CountUp from "@/components/CountUp";
import CategoryGrid from "@/components/CategoryGrid";
import { fetchCategoryCounts, CATEGORY_GROUPS, CATEGORY_META } from "@/lib/categories";
import InfoPopup from "@/components/InfoPopup";
import BrandLogo from "@/components/BrandLogo";
import HeroRotator from "@/components/HeroRotator";
import { useBranding } from "@/contexts/BrandingContext";
import { DEFAULT_HERO } from "@/lib/brandingDefaults";
import AutoScrollRow from "@/components/AutoScrollRow";
import InstallPopup from "@/components/InstallPopup";

const steps = [
  {
    t: "Je déclare",
    d: "En 1 minute, avec photo et zone. Les numéros restent masqués.",
  },
  {
    t: "Le moteur compare",
    d: "Score automatique de 0 à 100 % sur toute la base.",
  },
  {
    t: "Je vérifie",
    d: "Questions de sécurité. Aucune coordonnée publique.",
  },
  {
    t: "Je récupère",
    d: "Restitution confirmée, points crédités au trouveur.",
  },
];

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.35, ease: [0.22, 1, 0.36, 1] },
  }),
};

const card = "rounded-2xl border border-border/60 bg-card p-4 sm:p-5 shadow-sm";

const HomePage = () => {
  const { branding } = useBranding();
  const [stats, setStats] = useState({ lost: 0, found: 0, returned: 0 });
  const [categories, setCategories] = useState([]);
  const [catCounts, setCatCounts] = useState({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const results = await Promise.allSettled([
        pb.collection("declarations").getList(1, 1, { filter: 'kind = "lost"', requestKey: "home-lost" }),
        pb.collection("declarations").getList(1, 1, { filter: 'kind = "found"', requestKey: "home-found" }),
        pb.collection("declarations").getList(1, 1, { filter: 'status = "returned"', requestKey: "home-ret" }),
        pb.collection("categories").getFullList({ sort: "position", requestKey: "home-cats" }).catch(() => []),
        fetchCategoryCounts(),
      ]);

      const get = (i, fallback) => results[i].status === "fulfilled" ? results[i].value : fallback;

      setStats({
        lost: get(0, { totalItems: 0 }).totalItems || 0,
        found: get(1, { totalItems: 0 }).totalItems || 0,
        returned: get(2, { totalItems: 0 }).totalItems || 0,
      });
      setCategories(get(3, []));
      setCatCounts(get(4, {}));

      // Fallback: generate categories from static meta if DB table is empty/missing
      if (get(3, []).length === 0) {
        const fallback = CATEGORY_GROUPS.flatMap((g) =>
          g.slugs.map((slug, pos) => ({
            id: slug,
            slug,
            name: CATEGORY_META[slug]?.label || slug,
            position: pos,
          }))
        );
        setCategories(fallback);
      }
    } catch (_) {
      setStats({ lost: 0, found: 0, returned: 0 });
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
        {/* ── HERO IMAGE (rotation multi-images) ── */}
        <HeroRotator fallbackImage={branding.hero_image_url || DEFAULT_HERO}>
          {/* <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={0}>
            <BrandLogo
              size="lg"
              linkToHome={false}
              imgClassName="rounded-xl bg-black/30 p-1 shadow-lg"
            />
          </motion.div> */}
          <motion.p
            variants={fadeUp} initial="hidden" animate="visible" custom={1}
            className="mt-2 text-xs font-bold uppercase tracking-[0.18em]"
            style={{ color: branding.color_yellow }}
          >
            {branding.tagline}
          </motion.p>
          {branding.sponsor_name && (
            <motion.div
              variants={fadeUp} initial="hidden" animate="visible" custom={2}
              className="mt-2 flex items-center gap-1.5 rounded-lg bg-accent/10 px-3 py-1 text-[10px] text-muted-foreground"
            >
              {branding.sponsor_url ? (
                <a href={branding.sponsor_url} target="_blank" rel="noopener noreferrer" className="font-bold underline underline-offset-2">
                  {branding.sponsor_name}
                </a>
              ) : (
                <span className="font-bold">{branding.sponsor_name}</span>
              )}
              {branding.sponsor_tagline && <span>— {branding.sponsor_tagline}</span>}
            </motion.div>
          )}
        </HeroRotator>

        {/* ── PWA INSTALL POPUP ── */}
        <InstallPopup />

        {/* ── HEADLINE + TAG ── */}
        <section className="px-4 pt-5 pb-1">
          <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={2}>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-accent">
              <Sparkles className="h-3 w-3" /> Une seule base, toute la ville
            </span>
          </motion.div>

          <motion.h1
            variants={fadeUp} initial="hidden" animate="visible" custom={3}
            className="mt-3 text-[1.65rem] sm:text-4xl font-extrabold leading-[1.1] tracking-tight"
          >
            Perdu aujourd&apos;hui,{" "}
            <span className="relative inline-block">
              retrouvé
              <svg viewBox="0 0 200 12" className="absolute -bottom-0.5 left-0 h-2.5 w-full" preserveAspectRatio="none">
                <path d="M2 8 C60 2, 140 12, 198 4" stroke="hsl(162 72% 55%)" strokeWidth="5" fill="none" strokeLinecap="round" />
              </svg>
            </span>{" "}
            demain.
          </motion.h1>

          <motion.p
            variants={fadeUp} initial="hidden" animate="visible" custom={4}
            className="mt-2 text-sm text-muted-foreground leading-relaxed"
          >
            Déclarez un objet égaré ou retrouvé. Notre moteur vous alerte dès
            qu&apos;une correspondance dépasse 40 %.
          </motion.p>
        </section>

        {/* ── STATS CARDS ── */}
        <motion.section
          variants={fadeUp} initial="hidden" animate="visible" custom={5}
          className="px-4 pt-3 pb-1"
        >
          <div className="grid grid-cols-3 gap-2.5">
            {[
              { value: stats.lost, label: "Égarés", color: "text-red-500 dark:text-red-400" },
              { value: stats.found, label: "Retrouvés", color: "text-green-600 dark:text-green-400" },
              { value: stats.returned, label: "Rendus", color: "text-primary" },
            ].map((s) => (
              <div key={s.label} className={card + " flex flex-col items-center text-center !p-3 sm:!p-4"}>
                <TrendingUp className={`h-4 w-4 mb-1 ${s.color}`} />
                <CountUp value={s.value} className={`text-xl sm:text-2xl font-extrabold ${s.color}`} />
                <span className="mt-0.5 text-[10px] sm:text-xs font-semibold text-muted-foreground">{s.label}</span>
              </div>
            ))}
          </div>
        </motion.section>

        {/* ── ACTION BUTTONS ── */}
        <section className="px-4 pt-4 pb-1">
          <div className="grid gap-2.5">
            <Link
              to="/declarer/perdu"
              className="group flex items-center gap-3.5 rounded-2xl p-4 text-white transition-transform active:scale-[0.98]"
              style={{ background: `linear-gradient(135deg, ${branding.color_red}, #c1121f)` }}
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/20">
                <Search className="h-5 w-5" strokeWidth={2.6} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-base sm:text-lg font-extrabold tracking-tight">J&apos;AI ÉGARÉ</span>
                <span className="block text-[11px] text-white/80">Déclarer un objet ou document perdu</span>
              </span>
              <ArrowRight className="h-5 w-5 shrink-0 transition-transform group-hover:translate-x-1" />
            </Link>

            <Link
              to="/declarer/retrouve"
              className="group flex items-center gap-3.5 rounded-2xl p-4 text-white transition-transform active:scale-[0.98]"
              style={{ background: `linear-gradient(135deg, ${branding.color_green}, #1b4332)` }}
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/20">
                <HandHeart className="h-5 w-5" strokeWidth={2.6} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-base sm:text-lg font-extrabold tracking-tight">J&apos;AI RETROUVÉ</span>
                <span className="block text-[11px] text-white/80">Déclarer un objet trouvé ·</span>
              </span>
              <ArrowRight className="h-5 w-5 shrink-0 transition-transform group-hover:translate-x-1" />
            </Link>

            <Link to="/rechercher" className={"group flex items-center gap-3.5 rounded-2xl p-4 transition-transform active:scale-[0.98] " + card}>
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10">
                <Search className="h-5 w-5 text-primary" strokeWidth={2.6} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-base sm:text-lg font-extrabold tracking-tight">RECHERCHER</span>
                <span className="block text-[11px] text-muted-foreground">Parcourir toute la base</span>
              </span>
              <ArrowRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1" />
            </Link>

            <Link
              to="/don"
              className="group flex items-center gap-3.5 rounded-2xl p-4 text-white transition-transform active:scale-[0.98]"
              style={{ background: `linear-gradient(135deg, hsl(258 84% 58%), hsl(280 75% 52%))` }}
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/20">
                <Heart className="h-5 w-5" strokeWidth={2.6} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm sm:text-base font-extrabold tracking-tight">JE FAIS UN DON</span>
                <span className="block text-[11px] text-white/80">Soutenir {branding.app_name}</span>
              </span>
              <ArrowRight className="h-5 w-5 shrink-0 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </section>

        {/* ── MARQUEE ── */}
        <div className="mx-4 mt-4 overflow-hidden rounded-2xl border border-border/60 bg-secondary/40 py-2.5">
          <div className="flex w-max marquee gap-6 whitespace-nowrap text-[11px] font-bold uppercase tracking-widest text-secondary-foreground">
            {[0, 1].map((k) => (
              <span key={k} className="flex gap-6">
                {["CNI", "Passeport", "Permis", "Carte grise", "Plaque", "Moto", "Voiture", "Vélo", "Téléphone", "Portefeuille", "Sac", "Clés", "Documents"].map((cat, i) => (
                  <React.Fragment key={cat}>
                    {i > 0 && <span>·</span>}
                    <span>{cat}</span>
                  </React.Fragment>
                ))}
              </span>
            ))}
          </div>
        </div>

        {/* ── SPONSOR ANIMÉ #1 ── */}
        <div className="px-4 pt-4">
          <SponsorBanner />
        </div>

        {/* ── CATEGORIES ── */}
        <section className="px-4 pt-5 pb-1">
          <Reveal>
            <div className={card + " !p-0 overflow-hidden"}>
              <div className="px-4 pt-4 pb-2">
                <h2 className="text-base font-extrabold">Explorer par catégorie</h2>
                <p className="mt-0.5 text-[11px] text-muted-foreground">Documents, véhicules, effets personnels</p>
              </div>
              <div className="px-4 pb-4">
                {categories.length === 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
                    {[0, 1, 2, 3, 4, 5, 6, 7].map((k) => (
                      <div key={k} className="h-20 animate-pulse rounded-xl bg-muted" />
                    ))}
                  </div>
                )}
                {categories.length > 0 && (
                  <CategoryGrid categories={categories} counts={catCounts} linkBase="/rechercher?cat=" size="lg" />
                )}
              </div>
            </div>
          </Reveal>
        </section>

        {/* ── PREMIUM & PRO ── */}
        <section className="px-4 pt-4 pb-1">
          <div className="grid gap-2.5 sm:grid-cols-2">
            <Link
              to="/abonnement"
              className="group flex items-center gap-3 rounded-2xl bg-gradient-to-br from-[hsl(206_84%_32%)] to-[hsl(199_80%_42%)] p-4 text-white shadow-sm transition-transform active:scale-[0.98]"
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/20 text-lg">🥈</span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-extrabold tracking-tight">Premium & Pro</span>
                <span className="block text-[10px] text-white/70">Sans pub, alertes illimitées</span>
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link
              to="/comptes-pro"
              className="group flex items-center gap-3 rounded-2xl bg-gradient-to-br from-[hsl(160_60%_30%)] to-[hsl(168_64%_24%)] p-4 text-white shadow-sm transition-transform active:scale-[0.98]"
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/20 text-lg">🏛️</span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-extrabold tracking-tight">Comptes pro</span>
                <span className="block text-[10px] text-white/70">Mairies, entreprises</span>
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </section>

        {/* ── PARCOURS — auto-scroll lent ── */}
        <section className="px-4 pt-5 pb-1">
          <Reveal>
            <h2 className="text-base font-extrabold">Comment ça marche</h2>
            <p className="mt-0.5 text-[11px] text-muted-foreground">Du signalement à la restitution</p>
          </Reveal>
          <AutoScrollRow autoPlay speed={0.35} className="mt-3">
            {steps.map((s, i) => (
              <div key={s.t} className={"min-w-[180px] flex-shrink-0 snap-start " + card}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="grid h-7 w-7 place-items-center rounded-lg bg-primary/10 font-mono text-xs font-bold text-primary">0{i + 1}</span>
                </div>
                <p className="text-sm font-bold">{s.t}</p>
                <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed">{s.d}</p>
              </div>
            ))}
          </AutoScrollRow>
        </section>

        {/* ── SÉCURITÉ — swipe manuel ── */}
        <section className="px-4 pt-4 pb-1">
          <Reveal>
            <h2 className="text-base font-extrabold">Sécurité & confidentialité</h2>
          </Reveal>
          <AutoScrollRow className="mt-3">
            {[
              { i: Lock, t: "Numéros masqués", d: "Les numéros de documents ne s'affichent jamais en entier." },
              { i: ShieldCheck, t: "Vérification", d: "Questions de sécurité avant tout contact." },
              { i: Bell, t: "Alertes", d: "Notification dès qu'une déclaration correspond." },
            ].map(({ i: Icon, t, d }) => (
              <div key={t} className={"min-w-[175px] flex-shrink-0 snap-start " + card}>
                <div className="grid h-8 w-8 place-items-center rounded-lg bg-accent/10">
                  <Icon className="h-4 w-4 text-accent" />
                </div>
                <p className="mt-2.5 text-sm font-bold">{t}</p>
                <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed">{d}</p>
              </div>
            ))}
          </AutoScrollRow>
        </section>

        {/* ── FOOTER SPACER ── */}
        <div className="h-4" />
      </PullToRefresh>
      <InfoPopup />
    </Layout>
  );
};

export default HomePage;
