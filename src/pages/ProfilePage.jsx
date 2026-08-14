import React, { useState } from "react";
import { Helmet } from "react-helmet";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  BadgeCheck,
  Bell,
  ChevronRight,
  Coins,
  Copy,
  Crown,
  Gift,
  LogOut,
  Settings,
  ShieldCheck,
  Sparkles,
  Trophy,
  Users,
} from "lucide-react";
import Layout from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { BADGES, getBadge } from "@/lib/retrouve";

const ProfilePage = () => {
  const { user, isAuthed, logout } = useAuth();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  if (!isAuthed || !user) {
    return (
      <Layout>
        <Helmet>
          <title>Profil — RetrouveMoi</title>
          <meta
            name="description"
            content="Connectez-vous pour accéder à votre profil RetrouveMoi."
          />
        </Helmet>
        <div className="mx-auto w-full max-w-[44rem] px-4 py-16 text-center">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-primary/10">
            <ShieldCheck className="h-8 w-8 text-primary" />
          </span>
          <h1 className="mt-5 text-2xl font-extrabold">
            Bienvenue sur RetrouveMoi
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Connectez-vous pour suivre vos déclarations, points et parrainages.
          </p>
          <div className="mt-6 grid gap-3">
            <Link
              to="/inscription"
              className="rounded-2xl bg-primary px-5 py-4 text-base font-extrabold text-primary-foreground min-h-[52px] flex items-center justify-center"
            >
              Créer un compte gratuit
            </Link>
            <Link
              to="/connexion"
              className="rounded-2xl border border-border px-5 py-4 text-base font-bold min-h-[52px] flex items-center justify-center"
            >
              J'ai déjà un compte
            </Link>
          </div>
        </div>
      </Layout>
    );
  }

  const earned = user?.points_earned || 0;
  const badge = getBadge(earned);
  const next = BADGES.find((b) => earned < b.threshold);
  const pct = next
    ? Math.min(100, Math.round((earned / next.threshold) * 100))
    : 100;
  const referralLink = user?.referral_code
    ? `${window.location.origin}/inscription?ref=${user.referral_code}`
    : "";

  const copyCode = () => {
    if (navigator.clipboard && user?.referral_code) {
      navigator.clipboard.writeText(user.referral_code).catch(() => {});
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const menu = [
    { to: "/tableau-de-bord", icon: Bell, label: "Mon espace & notifications" },
    { to: "/recompenses", icon: Gift, label: "Boutique de points" },
    { to: "/abonnement", icon: Crown, label: "Abonnements Premium & Pro" },
    { to: "/classement", icon: Trophy, label: "Classement des héros" },
    { to: "/premium", icon: Sparkles, label: "Offres premium" },
    { to: "/partenaires", icon: Users, label: "Partenaires" },
  ];

  return (
    <Layout>
      <Helmet>
        <title>Profil — RetrouveMoi</title>
        <meta
          name="description"
          content="Votre profil RetrouveMoi : badge, points, code de parrainage et paramètres."
        />
      </Helmet>

      <div className="mx-auto w-full max-w-[44rem] px-4 py-6 sm:py-8">
        {/* Identity card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl bg-gradient-to-br from-[hsl(206_84%_32%)] to-[hsl(162_72%_28%)] p-5 text-white"
        >
          <div className="flex items-center gap-4">
            <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-white/15 text-2xl font-extrabold">
              {(user?.name || user?.email || "?").charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-lg font-extrabold">
                {user?.name || user?.email}
              </p>
              <p className="truncate text-sm text-white/75">{user?.email}</p>
              {user?.city && (
                <p className="mt-0.5 text-xs text-white/60">{user.city}</p>
              )}
            </div>
          </div>

          {badge && (
            <div className="mt-4 flex items-center gap-2 rounded-2xl bg-white/15 px-3 py-2">
              <span className="text-lg">{badge.emoji}</span>
              <span className="text-sm font-bold">{badge.label}</span>
              {next && (
                <span className="ml-auto text-xs text-white/70">
                  {earned}/{next.threshold} pts
                </span>
              )}
            </div>
          )}
          {next && (
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/20">
              <div
                className="h-full rounded-full bg-white"
                style={{ width: `${pct}%` }}
              />
            </div>
          )}
        </motion.div>

        {/* Stats row */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-border bg-card p-4">
            <Coins className="h-5 w-5 text-primary" />
            <p className="mt-2 text-2xl font-extrabold">{user?.points || 0}</p>
            <p className="text-xs text-muted-foreground">points disponibles</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4">
            <BadgeCheck className="h-5 w-5 text-accent" />
            <p className="mt-2 text-2xl font-extrabold">{earned}</p>
            <p className="text-xs text-muted-foreground">points cumulés</p>
          </div>
        </div>

        {/* Referral */}
        <div className="mt-4 rounded-2xl border border-border bg-card p-5">
          <p className="flex items-center gap-2 font-bold">
            <Gift className="h-5 w-5 text-primary" /> Mon code de parrainage
          </p>
          <div className="mt-3 flex items-center gap-2">
            <span className="flex-1 rounded-xl bg-muted px-3 py-2.5 font-mono text-base font-extrabold tracking-wider">
              {user?.referral_code || "—"}
            </span>
            <button
              type="button"
              onClick={copyCode}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-border active:scale-95 transition-transform"
              aria-label="Copier le code"
            >
              <Copy className="h-4 w-4" />
            </button>
          </div>
          {copied && (
            <p className="mt-1 text-xs font-semibold text-accent">
              Code copié !
            </p>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            Partagez votre lien : chaque ami inscrit vous rapporte{" "}
            <span className="font-bold text-primary">+20 points</span>.
          </p>
          {referralLink && (
            <p className="mt-2 truncate rounded-lg bg-muted px-3 py-2 text-xs font-mono text-muted-foreground">
              {referralLink}
            </p>
          )}
        </div>

        {/* Menu */}
        <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-card">
          {menu.map(({ to, icon: Icon, label }, i) => (
            <Link
              key={to}
              to={to}
              className={`flex items-center gap-3 px-4 py-4 active:bg-muted transition-colors ${
                i > 0 ? "border-t border-border" : ""
              }`}
            >
              <Icon className="h-5 w-5 shrink-0 text-primary" />
              <span className="flex-1 text-sm font-bold">{label}</span>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </Link>
          ))}
          {user?.role === "admin" && (
            <Link
              to="/admin"
              className="flex items-center gap-3 border-t border-border px-4 py-4 active:bg-muted transition-colors"
            >
              <ShieldCheck className="h-5 w-5 shrink-0 text-primary" />
              <span className="flex-1 text-sm font-bold">Administration</span>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </Link>
          )}
        </div>

        {/* Settings + logout */}
        <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-card">
          <div className="flex items-center gap-3 border-b border-border px-4 py-4">
            <Settings className="h-5 w-5 shrink-0 text-muted-foreground" />
            <span className="flex-1 text-sm font-bold">Paramètres</span>
            <span className="text-xs text-muted-foreground">
              Bientôt disponible
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              logout();
              navigate("/");
            }}
            className="flex w-full items-center gap-3 px-4 py-4 text-destructive active:bg-muted transition-colors"
          >
            <LogOut className="h-5 w-5 shrink-0" />
            <span className="flex-1 text-left text-sm font-bold">
              Se déconnecter
            </span>
          </button>
        </div>

        <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-primary" /> RetrouveMoi — la
          restitution citoyenne
        </p>
      </div>
    </Layout>
  );
};

export default ProfilePage;
