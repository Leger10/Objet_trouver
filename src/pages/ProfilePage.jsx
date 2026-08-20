import React, { useState } from "react";
import { Helmet } from "react-helmet-async";
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
  KeyRound,
  Loader2,
  LogOut,
  Save,
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
  const { user, isAuthed, logout, updateProfile } = useAuth();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({ name: "", phone: "", city: "" });
  const [profileMsg, setProfileMsg] = useState({ type: "", text: "" });

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
        <div className="mx-auto w-full max-w-[44rem] px-4 py-10 sm:py-14 text-center">
          <div className="rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-lg text-center">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary/10">
              <ShieldCheck className="h-7 w-7 text-primary" />
            </span>
            <h1 className="mt-4 text-xl font-extrabold">
              Bienvenue sur RetrouveMoi
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Connectez-vous pour suivre vos déclarations, points et parrainages.
            </p>
            <div className="mt-5 grid gap-2.5">
              <Link
                to="/inscription"
                className="rounded-xl bg-primary px-5 py-3.5 text-sm font-extrabold text-primary-foreground min-h-[48px] flex items-center justify-center shadow-lg shadow-primary/25 transition-transform active:scale-[0.98]"
              >
                Créer un compte gratuit
              </Link>
              <Link
                to="/connexion"
                className="rounded-xl border border-border bg-background px-5 py-3.5 text-sm font-bold min-h-[48px] flex items-center justify-center transition-transform active:scale-[0.98]"
              >
                J&apos;ai déjà un compte
              </Link>
            </div>
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
          className="rounded-3xl bg-gradient-to-br from-[hsl(206_84%_32%)] to-[hsl(162_72%_28%)] p-5 text-white shadow-xl shadow-primary/20"
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
        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <Coins className="h-5 w-5 text-primary" />
            <p className="mt-2 text-2xl font-extrabold">{user?.points || 0}</p>
            <p className="text-xs text-muted-foreground">points disponibles</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <BadgeCheck className="h-5 w-5 text-accent" />
            <p className="mt-2 text-2xl font-extrabold">{earned}</p>
            <p className="text-xs text-muted-foreground">points cumulés</p>
          </div>
        </div>

        {/* Referral */}
        <div className="mt-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
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
        <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
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

        {/* Settings + profile edit */}
        <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <button
            type="button"
            onClick={() => {
              if (!editing) {
                setProfileForm({
                  name: user?.name || "",
                  phone: user?.phone || "",
                  city: user?.city || "",
                });
                setProfileMsg({ type: "", text: "" });
              }
              setEditing(!editing);
            }}
            className="flex w-full items-center gap-3 px-4 py-4 active:bg-muted transition-colors"
          >
            <Settings className="h-5 w-5 shrink-0 text-muted-foreground" />
            <span className="flex-1 text-left text-sm font-bold">Modifier mon profil</span>
            <ChevronRight className={`h-5 w-5 text-muted-foreground transition-transform ${editing ? "rotate-90" : ""}`} />
          </button>

          {editing && (
            <div className="border-t border-border px-4 py-4 space-y-3">
              <label className="flex flex-col gap-1.5 text-sm font-bold">
                Nom
                <input
                  className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
                  value={profileForm.name}
                  onChange={(e) => setProfileForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Votre nom"
                />
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-bold">
                Téléphone
                <input
                  className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
                  value={profileForm.phone}
                  onChange={(e) => setProfileForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="+225 ..."
                  inputMode="tel"
                />
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-bold">
                Ville
                <input
                  className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
                  value={profileForm.city}
                  onChange={(e) => setProfileForm((f) => ({ ...f, city: e.target.value }))}
                  placeholder="Abidjan, Dakar..."
                />
              </label>
              {profileMsg.text && (
                <p className={`rounded-xl px-3 py-2 text-xs font-semibold ${profileMsg.type === "error" ? "bg-destructive/10 text-destructive" : "bg-green-500/10 text-green-600 dark:bg-green-400/10 dark:text-green-400"}`}>
                  {profileMsg.text}
                </p>
              )}
              <button
                type="button"
                disabled={savingProfile}
                onClick={async () => {
                  setSavingProfile(true);
                  setProfileMsg({ type: "", text: "" });
                  try {
                    await updateProfile({
                      name: profileForm.name,
                      phone: profileForm.phone,
                      city: profileForm.city,
                    });
                    setProfileMsg({ type: "success", text: "Profil mis à jour !" });
                    setTimeout(() => setEditing(false), 1500);
                  } catch (err) {
                    setProfileMsg({ type: "error", text: err?.message || "Erreur lors de la mise à jour." });
                  } finally {
                    setSavingProfile(false);
                  }
                }}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground disabled:opacity-60 transition-transform active:scale-[0.98]"
              >
                {savingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Enregistrer
              </button>
            </div>
          )}

          <Link
            to="/mot-de-passe-oublie"
            className="flex items-center gap-3 border-t border-border px-4 py-4 active:bg-muted transition-colors"
          >
            <KeyRound className="h-5 w-5 shrink-0 text-muted-foreground" />
            <span className="flex-1 text-sm font-bold">Changer le mot de passe</span>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </Link>
          <button
            type="button"
            onClick={() => {
              logout();
              navigate("/");
            }}
            className="flex w-full items-center gap-3 border-t border-border px-4 py-4 text-destructive active:bg-muted transition-colors"
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
