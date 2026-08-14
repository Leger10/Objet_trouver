import React, { useEffect, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  Bell,
  Home,
  LayoutDashboard,
  Plus,
  Search,
  User,
} from "lucide-react";
import { pb } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
import { useBranding } from "@/contexts/BrandingContext";
import BrandLogo from "@/components/BrandLogo";
import SiteFooter from "@/components/SiteFooter";

const TABS = [
  { to: "/", label: "Accueil", icon: Home, exact: true },
  { to: "/declarer", label: "Déclarer", icon: Plus },
  { to: "/rechercher", label: "Rechercher", icon: Search },
  { to: "/tableau-de-bord", label: "Espace", icon: LayoutDashboard },
  { to: "/profil", label: "Profil", icon: User },
];

const TITLE_RULES = [
  { match: "/", title: null },
  { match: "/declarer", title: "Déclarer" },
  { match: "/declarer/perdu", title: "J'ai égaré" },
  { match: "/declarer/retrouve", title: "J'ai retrouvé" },
  { match: "/rechercher", title: "Rechercher" },
  { match: "/tableau-de-bord", title: "Mon espace" },
  { match: "/profil", title: "Profil" },
  { match: "/objet", title: "Détail" },
  { match: "/premium", title: "Premium" },
  { match: "/recompenses", title: "Récompenses" },
  { match: "/partenaires", title: "Partenaires" },
  { match: "/don", title: "Faire un don" },
  { match: "/abonnement", title: "Abonnements" },
  { match: "/comptes-pro", title: "Comptes pro" },
  { match: "/classement", title: "Classement" },
  { match: "/admin/branding", title: "Branding" },
  { match: "/admin", title: "Administration" },
  { match: "/pv-depot", title: "PV de dépôt" },
  { match: "/pv-restitution", title: "PV de restitution" },
  { match: "/connexion", title: "Connexion" },
  { match: "/inscription", title: "Inscription" },
];

const AUTH_ROUTES = ["/connexion", "/inscription"];

const titleFor = (pathname, appName) => {
  const exact = TITLE_RULES.find((t) => t.match === pathname);
  if (exact) return exact.title || appName;
  const prefix = TITLE_RULES.find(
    (t) => t.match !== "/" && pathname.startsWith(t.match + "/"),
  );
  if (prefix) return prefix.title || appName;
  return appName;
};

const isTabRoute = (pathname) =>
  TABS.some((t) => (t.exact ? t.to === pathname : t.to === pathname));

const Layout = ({ children, hideFooter = false }) => {
  const { user, isAuthed } = useAuth();
  const { branding } = useBranding();
  const [unread, setUnread] = useState(0);
  const location = useLocation();
  const navigate = useNavigate();
  const pathname = location.pathname;

  const tab = isTabRoute(pathname);
  const showNav = !AUTH_ROUTES.includes(pathname);
  const showBack = !tab && pathname !== "/";
  const title = titleFor(pathname, branding.app_name || "RetrouveMoi");
  const showFooter =
    showNav &&
    !hideFooter &&
    (pathname === "/" ||
      pathname.startsWith("/admin") ||
      AUTH_ROUTES.includes(pathname) === false);

  useEffect(() => {
    if (!isAuthed || !user) {
      setUnread(0);
      return;
    }
    pb.collection("notifications")
      .getList(1, 1, { filter: "read = false" })
      .then((r) => setUnread(r.totalItems))
      .catch(() => setUnread(0));
  }, [isAuthed, user, pathname]);

  return (
    <div className="min-h-[100dvh] bg-background text-foreground flex flex-col">
      {/* Top bar — minimal, native */}
      <header className="safe-top sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur-xl">
        <div className="flex h-14 w-full items-center gap-2 px-3">
          {showBack ? (
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full active:scale-95 transition-transform"
              aria-label="Retour"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          ) : (
            <BrandLogo size="sm" imgClassName="rounded-lg" />
          )}
          <p className="min-w-0 flex-1 truncate text-base font-extrabold tracking-tight">
            {title}
          </p>
          {isAuthed && showNav && (
            <Link
              to="/tableau-de-bord"
              className="relative grid h-10 w-10 shrink-0 place-items-center rounded-full active:scale-95 transition-transform"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" />
              {unread > 0 && (
                <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                  {unread}
                </span>
              )}
            </Link>
          )}
        </div>
      </header>

      {/* Page content with native transition */}
      <main className={`flex-1 ${showNav ? "pb-nav" : "pb-6"}`}>
        <AnimatePresence mode="wait">
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
        {showFooter && pathname === "/" && <SiteFooter />}
      </main>

      {/* Bottom navigation — native tab bar */}
      {showNav && (
        <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-background/95 backdrop-blur-xl nav-shadow">
          <div className="mx-auto flex w-full max-w-[44rem] items-stretch justify-around px-1">
            {TABS.map((t) => {
              const active = t.exact
                ? pathname === t.to
                : pathname === t.to || pathname.startsWith(t.to + "/");
              const Icon = t.icon;
              const showBadge = t.to === "/tableau-de-bord" && unread > 0;
              return (
                <NavLink
                  key={t.to}
                  to={t.to}
                  end={t.exact}
                  className="relative flex flex-1 flex-col items-center gap-0.5 py-2.5 active:scale-95 transition-transform"
                >
                  <span className="relative">
                    <Icon
                      className={`h-6 w-6 transition-colors ${active ? "text-primary" : "text-muted-foreground"}`}
                      strokeWidth={active ? 2.6 : 2}
                    />
                    {showBadge && (
                      <span className="absolute -right-1.5 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                        {unread}
                      </span>
                    )}
                  </span>
                  <span
                    className={`text-[10px] font-bold tracking-tight transition-colors ${
                      active ? "text-primary" : "text-muted-foreground"
                    }`}
                  >
                    {t.label}
                  </span>
                  {active && (
                    <motion.span
                      layoutId="nav-dot"
                      className="absolute -top-px h-0.5 w-8 rounded-full bg-primary"
                    />
                  )}
                </NavLink>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
};

export default Layout;
