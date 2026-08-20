import React, { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell,
  BellOff,
  Check,
  CheckCheck,
  Trash2,
  Inbox,
} from "lucide-react";
import { pb } from "@/lib/supabaseClient";
import Layout from "@/components/Layout";
import { usePaginate, ListFooter } from "@/components/PaginatedList";
import { useAuth } from "@/contexts/AuthContext";
import { useBranding } from "@/contexts/BrandingContext";

const NotificationsPage = () => {
  const { user } = useAuth();
  const { branding } = useBranding();
  const [notifs, setNotifs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("all");

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    pb.collection("notifications")
      .getList(1, 100, { sort: "-created", requestKey: "notif-list" })
      .then((r) => setNotifs(r.items))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  const markRead = async (n) => {
    if (n.read) return;
    try {
      await pb.collection("notifications").update(n.id, { read: true });
      setNotifs((prev) =>
        prev.map((x) => (x.id === n.id ? { ...x, read: true } : x))
      );
    } catch (_) {}
  };

  const markAllRead = async () => {
    const unread = notifs.filter((n) => !n.read);
    if (!unread.length) return;
    try {
      await Promise.all(
        unread.map((n) =>
          pb.collection("notifications").update(n.id, { read: true })
        )
      );
      setNotifs((prev) => prev.map((x) => ({ ...x, read: true })));
    } catch (_) {}
  };

  const clearAll = async () => {
    if (!notifs.length) return;
    try {
      await Promise.all(
        notifs.map((n) => pb.collection("notifications").delete(n.id))
      );
      setNotifs([]);
    } catch (_) {}
  };

  const unread = notifs.filter((n) => !n.read);
  const displayedNotifs = tab === "unread" ? notifs.filter((n) => !n.read) : notifs;
  const notifPaginate = usePaginate(displayedNotifs);

  const timeSince = (dateStr) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "À l'instant";
    if (mins < 60) return `Il y a ${mins}min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `Il y a ${hours}h`;
    const days = Math.floor(hours / 24);
    return `Il y a ${days}j`;
  };

  if (!user) {
    return (
      <Layout>
        <Helmet>
          <title>Notifications — {branding.app_name}</title>
        </Helmet>
        <div className="mx-auto max-w-md px-4 py-20 text-center">
          <Bell className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-4 text-lg font-bold">Connectez-vous</p>
          <Link
            to="/connexion"
            className="mt-3 inline-block text-sm font-bold text-primary underline"
          >
            Se connecter
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Notifications">
      <Helmet>
        <title>Notifications — {branding.app_name}</title>
      </Helmet>

      <div className="mx-auto w-full max-w-lg px-4 py-5">
        {/* Header actions */}
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {unread.length > 0
              ? `${unread.length} non lue${unread.length > 1 ? "s" : ""}`
              : "Tout est lu"}
          </p>
          <div className="flex gap-2">
            {unread.length > 0 && (
              <button
                onClick={markAllRead}
                className="flex items-center gap-1.5 rounded-xl bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Tout lire
              </button>
            )}
            {notifs.length > 0 && (
              <button
                onClick={clearAll}
                className="flex items-center gap-1.5 rounded-xl bg-destructive/10 px-3 py-1.5 text-xs font-bold text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Effacer
              </button>
            )}
          </div>
        </div>

        <div className="mb-3 flex gap-1.5">
          {[
            ["all", "Toutes", notifs.length],
            ["unread", "Non lues", unread.length],
          ].map(([k, label, count]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`rounded-xl px-3 py-2 text-xs font-bold transition ${
                tab === k ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}
            >
              {label} ({count})
            </button>
          ))}
        </div>

        {loading ? (
          <div className="py-20 text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : notifs.length === 0 ? (
          <div className="py-20 text-center">
            <BellOff className="mx-auto h-12 w-12 text-muted-foreground/40" />
            <p className="mt-4 text-sm text-muted-foreground">
              Aucune notification pour le moment.
            </p>
          </div>
        ) : (
          <>
          <div className="space-y-2">
            <AnimatePresence>
              {notifPaginate.shown.map((n) => (
                <motion.div
                  key={n.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -100 }}
                  transition={{ duration: 0.2 }}
                >
                  <button
                    onClick={() => {
                      markRead(n);
                      if (n.link) window.location.href = n.link;
                    }}
                    className={`w-full text-left rounded-2xl border p-4 transition-all active:scale-[0.98] ${
                      n.read
                        ? "border-border bg-background"
                        : "border-primary/20 bg-primary/5"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${
                          n.read
                            ? "bg-muted"
                            : "bg-primary/15"
                        }`}
                      >
                        <Bell
                          className={`h-4 w-4 ${
                            n.read ? "text-muted-foreground" : "text-primary"
                          }`}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p
                          className={`text-sm font-bold ${
                            n.read
                              ? "text-muted-foreground"
                              : "text-foreground"
                          }`}
                        >
                          {n.title}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                          {n.body}
                        </p>
                        <p className="mt-1 text-[10px] text-muted-foreground/60">
                          {timeSince(n.created)}
                        </p>
                      </div>
                      {!n.read && (
                        <div className="h-2.5 w-2.5 shrink-0 rounded-full bg-primary mt-1" />
                      )}
                    </div>
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
          <ListFooter {...notifPaginate} total={displayedNotifs.length} />
          </>
        )}
      </div>
    </Layout>
  );
};

export default NotificationsPage;
