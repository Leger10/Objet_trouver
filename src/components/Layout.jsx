import React, { useEffect, useState, useRef, useCallback } from "react";
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
  X,
  CheckCheck,
  Sun,
  Moon,
} from "lucide-react";
import { pb } from "@/lib/pbClient";
import { useAuth } from "@/contexts/AuthContext";
import { useBranding } from "@/contexts/BrandingContext";
import { useTheme } from "@/contexts/ThemeContext";
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

const Layout = ({ children, hideFooter = false, title: titleProp }) => {
  const { user, isAuthed } = useAuth();
  const { branding } = useBranding();
  const { theme, toggle: toggleTheme } = useTheme();
  const [unread, setUnread] = useState(0);
  const [showPanel, setShowPanel] = useState(false);
  const [panelNotifs, setPanelNotifs] = useState([]);
  const panelRef = useRef(null);
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

    // Real-time listener for new notifications
    let subscription;
    try {
      subscription = pb.collection("notifications").subscribe("*", (event) => {
        if (event.action === "insert" && event.record?.user === user?.id) {
          setUnread((u) => u + 1);
        }
      });
    } catch (_) {}

    return () => {
      if (subscription) {
        try { pb.collection("notifications").unsubscribe(subscription); } catch (_) {}
      }
    };
  }, [isAuthed, user, pathname]);

  // Fermer le panel quand on clique dehors
  useEffect(() => {
    if (!showPanel) return;
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setShowPanel(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showPanel]);

  const openPanel = async () => {
    if (showPanel) { setShowPanel(false); return; }
    setShowPanel(true);
    if (!user) return;
    try {
      const r = await pb.collection("notifications").getList(1, 8, { sort: "-created" });
      setPanelNotifs(r.items);
    } catch (_) {}
  };

  const markReadPanel = async (n) => {
    if (n.read) return;
    try {
      await pb.collection("notifications").update(n.id, { read: true });
      setPanelNotifs((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      setUnread((u) => Math.max(0, u - 1));
    } catch (_) {}
  };

  const markAllReadPanel = async () => {
    const unreadNotifs = panelNotifs.filter((n) => !n.read);
    if (!unreadNotifs.length) return;
    try {
      await Promise.all(unreadNotifs.map((n) => pb.collection("notifications").update(n.id, { read: true })));
      setPanelNotifs((prev) => prev.map((x) => ({ ...x, read: true })));
      setUnread(0);
    } catch (_) {}
  };

  const timeSince = (dateStr) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "À l'instant";
    if (mins < 60) return `${mins}min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    return `${Math.floor(hours / 24)}j`;
  };

  return (
    <div className="min-h-[100dvh] bg-background text-foreground flex flex-col">
      {/* Top bar — minimal, native */}
      <header className="safe-top sticky top-0 z-40 border-b border-border/60 bg-background/90 dark:bg-[hsl(205_40%_10%)]/95 backdrop-blur-xl">
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
          <button
            type="button"
            onClick={toggleTheme}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full active:scale-95 transition-transform"
            aria-label="Changer de thème"
          >
            {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
          {isAuthed && showNav && (
              <div className="relative" ref={panelRef}>
              <button
                type="button"
                onClick={openPanel}
                className="relative grid h-10 w-10 shrink-0 place-items-center rounded-full active:scale-95 transition-transform"
                aria-label="Notifications"
              >
                <Bell className="h-5 w-5" />
                {unread > 0 && (
                  <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                    {unread}
                  </span>
                )}
              </button>

              {/* Panel notifications */}
              <AnimatePresence>
                {showPanel && (
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.96 }}
                    transition={{ duration: 0.18 }}
                    className="absolute right-0 top-full z-50 mt-2 w-80 max-h-96 overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
                  >
                    <div className="flex items-center justify-between border-b border-border px-4 py-3">
                      <p className="text-sm font-bold">Notifications</p>
                      <div className="flex gap-1">
                        {panelNotifs.some((n) => !n.read) && (
                          <button
                            onClick={markAllReadPanel}
                            className="rounded-lg p-1.5 text-primary hover:bg-primary/10"
                            title="Tout marquer lu"
                          >
                            <CheckCheck className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          onClick={() => setShowPanel(false)}
                          className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    <div className="max-h-72 overflow-y-auto">
                      {panelNotifs.length === 0 ? (
                        <div className="py-8 text-center text-sm text-muted-foreground">
                          Aucune notification
                        </div>
                      ) : (
                        panelNotifs.map((n) => (
                          <button
                            key={n.id}
                            onClick={() => {
                              markReadPanel(n);
                              setShowPanel(false);
                              if (n.link) navigate(n.link);
                            }}
                            className={`w-full text-left px-4 py-3 border-b border-border/50 transition-colors hover:bg-muted/50 ${
                              n.read ? "opacity-60" : ""
                            }`}
                          >
                            <div className="flex items-start gap-2.5">
                              {!n.read && (
                                <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                              )}
                              <div className="min-w-0 flex-1">
                                <p className={`text-xs font-bold ${n.read ? "text-muted-foreground" : ""}`}>
                                  {n.title}
                                </p>
                                <p className="mt-0.5 text-[11px] text-muted-foreground line-clamp-2">
                                  {n.body}
                                </p>
                                <p className="mt-1 text-[10px] text-muted-foreground/70">
                                  {timeSince(n.created)}
                                </p>
                              </div>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                    <Link
                      to="/notifications"
                      onClick={() => setShowPanel(false)}
                      className="block border-t border-border px-4 py-2.5 text-center text-xs font-bold text-primary hover:bg-muted/50"
                    >
                      Voir toutes les notifications
                    </Link>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
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
        <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-border/50 bg-background/90 dark:bg-[hsl(205_40%_10%)]/95 backdrop-blur-2xl nav-shadow">
          <div className="mx-auto flex w-full max-w-[44rem] items-stretch justify-around px-0.5 pt-1 pb-[max(0.25rem,env(safe-area-inset-bottom))]">
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
                  className="nav-tab relative flex flex-1 flex-col items-center justify-center gap-[3px] pt-2 pb-2 px-1 rounded-2xl"
                >
                  <span
                    className={`nav-tab-icon relative grid h-10 w-12 place-items-center rounded-xl transition-all duration-300 ease-out ${
                      active
                        ? "bg-primary/12 text-primary scale-100"
                        : "text-muted-foreground hover:text-foreground/80 active:scale-90"
                    }`}
                  >
                    <Icon
                      className={`transition-all duration-300 ${
                        active ? "h-[22px] w-[22px]" : "h-[20px] w-[20px]"
                      }`}
                      strokeWidth={active ? 2.5 : 1.8}
                    />
                    {showBadge && (
                      <span className="absolute -right-0.5 -top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-destructive px-1 text-[9px] font-extrabold text-destructive-foreground shadow-lg shadow-destructive/30 animate-pulse-soft">
                        {unread > 99 ? "99+" : unread}
                      </span>
                    )}
                    {active && (
                      <motion.span
                        layoutId="nav-pill"
                        className="absolute inset-0 rounded-xl bg-primary/10"
                        transition={{ type: "spring", stiffness: 500, damping: 35 }}
                      />
                    )}
                  </span>
                  <span
                    className={`text-[10px] tracking-tight transition-all duration-300 ${
                      active
                        ? "font-extrabold text-primary scale-100"
                        : "font-semibold text-muted-foreground"
                    }`}
                  >
                    {t.label}
                  </span>
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
