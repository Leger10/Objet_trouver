import React from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Camera,
  HandHeart,
  MapPin,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import Layout from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";

const DeclareHubPage = () => {
  const { isAuthed } = useAuth();

  return (
    <Layout>
      <Helmet>
        <title>Déclarer un objet — RetrouveMoi</title>
        <meta
          name="description"
          content="Déclarez en une minute un objet égaré ou retrouvé. Photo, géolocalisation et numéro masqué inclus."
        />
      </Helmet>

      <div className="mx-auto w-full max-w-[44rem] px-4 py-6 sm:py-10">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-2xl sm:text-3xl font-extrabold">
            Que s'est-il passé ?
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Choisissez une option. La déclaration prend moins d'une minute.
          </p>
        </motion.div>

        <div className="mt-6 grid gap-4">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
          >
            <Link
              to="/declarer/perdu"
              className="group flex items-center gap-4 rounded-3xl bg-primary p-5 text-primary-foreground min-h-[88px] active:scale-[0.98] transition-transform shadow-lg shadow-primary/25"
            >
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white/15">
                <Search className="h-7 w-7" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-lg font-extrabold">J'AI ÉGARÉ</span>
                <span className="block text-sm text-white/80">
                  Déclarer un objet ou document perdu
                </span>
              </span>
              <ArrowRight className="h-6 w-6 shrink-0 transition-transform group-active:translate-x-1" />
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Link
              to="/declarer/retrouve"
              className="group flex items-center gap-4 rounded-3xl bg-accent p-5 text-accent-foreground min-h-[88px] active:scale-[0.98] transition-transform shadow-lg shadow-accent/25"
            >
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white/15">
                <HandHeart className="h-7 w-7" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-lg font-extrabold">
                  J'AI RETROUVÉ
                </span>
                <span className="block text-sm text-white/85">
                  Aidez à retrouver le propriétaire
                </span>
              </span>
              <ArrowRight className="h-6 w-6 shrink-0 transition-transform group-active:translate-x-1" />
            </Link>
          </motion.div>
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          {[
            {
              i: Camera,
              t: "Photo intégrée",
              d: "Capture directe depuis l'app",
            },
            {
              i: MapPin,
              t: "Géolocalisation",
              d: "Zone détectée automatiquement",
            },
            {
              i: ShieldCheck,
              t: "Numéros masqués",
              d: "Vos données sensibles protégées",
            },
          ].map(({ i: Icon, t, d }) => (
            <div
              key={t}
              className="rounded-2xl border border-border bg-card p-4 shadow-sm"
            >
              <Icon className="h-5 w-5 text-primary" />
              <p className="mt-2 text-sm font-bold">{t}</p>
              <p className="mt-1 text-xs text-muted-foreground">{d}</p>
            </div>
          ))}
        </div>

        {!isAuthed && (
          <div className="mt-6 flex items-start gap-3 rounded-2xl border border-primary/20 bg-secondary/50 p-4 shadow-sm">
            <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <p className="text-sm text-muted-foreground">
              La déclaration nécessite un compte gratuit.{" "}
              <Link
                to="/inscription"
                className="font-bold text-primary underline underline-offset-4"
              >
                Créer mon compte
              </Link>
            </p>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default DeclareHubPage;
