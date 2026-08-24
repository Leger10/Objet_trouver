import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Download, X, Smartphone, Monitor, ArrowRight } from "lucide-react";
import { useBranding } from "@/contexts/BrandingContext";
import { LOGO_URL } from "@/lib/brandingDefaults";

const DISMISS_KEY = "pwa_install_dismissed";
const DISMISS_SESSION = "pwa_install_dismissed_session";

export default function InstallPopup() {
  const { branding } = useBranding();
  const [show, setShow] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [installing, setInstalling] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true) {
      return;
    }
    if (sessionStorage.getItem(DISMISS_SESSION) === "1") return;

    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", handler);

    const installedHandler = () => {
      setInstalled(true);
      setShow(false);
    };
    window.addEventListener("appinstalled", installedHandler);

    // Fallback: on platforms without beforeinstallprompt (iOS, desktop), show after 2s
    const timer = setTimeout(() => {
      if (!sessionStorage.getItem(DISMISS_SESSION)) {
        setShow(true);
      }
    }, 2000);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installedHandler);
      clearTimeout(timer);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    setInstalling(true);
    const { outcome } = await deferredPrompt.prompt();
    setDeferredPrompt(null);
    setInstalling(false);
    if (outcome === "accepted") {
      setInstalled(true);
      setShow(false);
      try {
        const { supabase } = await import("@/lib/supabaseClient");
        const { data: { user } } = await supabase.auth.getUser();
        await supabase.from("app_installations").insert({
          user: user?.id || null,
          user_agent: navigator.userAgent,
          platform: detectPlatform(),
          installed_at: new Date().toISOString(),
        });
      } catch (_) {}
    }
  };

  const handleClose = () => {
    setShow(false);
    sessionStorage.setItem(DISMISS_SESSION, "1");
  };

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isMacOS = /Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1;
  const isAndroid = /Android/.test(navigator.userAgent);
  const canNativeInstall = deferredPrompt != null;

  if (installed || !show) return null;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm px-6"
          onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="relative w-full max-w-sm rounded-3xl border border-border bg-card p-6 shadow-2xl"
          >
            {/* Close button */}
            <button
              onClick={handleClose}
              className="absolute top-3 right-3 rounded-full p-1.5 text-muted-foreground hover:bg-muted transition-colors"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Logo */}
            <div className="flex justify-center">
              <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-3xl bg-primary/10 shadow-inner">
                <img
                  src={branding?.logo_url || LOGO_URL}
                  alt={branding?.app_name || "RetrouveMoi"}
                  className="h-16 w-16 object-contain"
                />
              </div>
            </div>

            {/* Title */}
            <h2 className="mt-4 text-center text-lg font-extrabold">
              Installer {branding?.app_name || "RetrouveMoi"}
            </h2>
            <p className="mt-1 text-center text-xs text-muted-foreground leading-relaxed">
              Accédez plus rapidement depuis votre écran d&apos;accueil. Recherchez, déclarez et suivez vos déclarations en un tap.
            </p>

            {/* Actions */}
            <div className="mt-5 space-y-2.5">
              {canNativeInstall ? (
                <button
                  onClick={handleInstall}
                  disabled={installing}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-extrabold text-primary-foreground active:scale-[0.97] disabled:opacity-60 transition-transform"
                >
                  <Download className="h-4 w-4" />
                  {installing ? "Installation en cours..." : "Installer l'application"}
                </button>
              ) : isAndroid ? (
                <div className="space-y-2">
                  <p className="text-center text-xs text-muted-foreground">
                    Ouvrez cette page dans <span className="font-bold">Chrome</span> pour installer
                  </p>
                  <div className="flex items-center gap-2 rounded-2xl bg-primary/10 p-3">
                    <ArrowRight className="h-4 w-4 shrink-0 text-primary" />
                    <span className="text-[11px] text-muted-foreground">
                      Menu <span className="font-bold">⋮</span> → <span className="font-bold">Ajouter à l&apos;écran d&apos;accueil</span>
                    </span>
                  </div>
                </div>
              ) : isIOS || isMacOS ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 rounded-2xl bg-primary/10 p-3">
                    <Smartphone className="h-4 w-4 shrink-0 text-primary" />
                    <span className="text-[11px] text-muted-foreground">
                      Appuyez sur <span className="font-extrabold">Partager</span> ↗ puis <span className="font-extrabold">&quot;Sur l&apos;écran d&apos;accueil&quot;</span>
                    </span>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 rounded-2xl bg-primary/10 p-3">
                    <Monitor className="h-4 w-4 shrink-0 text-primary" />
                    <span className="text-[11px] text-muted-foreground">
                      Ouvrez dans <span className="font-bold">Chrome</span> ou <span className="font-bold">Edge</span> sur votre téléphone, puis installez depuis le menu
                    </span>
                  </div>
                </div>
              )}

              <button
                onClick={handleClose}
                className="w-full rounded-2xl border border-border bg-muted/50 px-5 py-2.5 text-xs font-bold text-muted-foreground hover:bg-muted transition-colors"
              >
                Fermer
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function detectPlatform() {
  const ua = navigator.userAgent;
  if (/Android/i.test(ua)) return "Android";
  if (/iPad|iPhone|iPod/.test(ua)) return "iOS";
  if (/Macintosh/.test(ua)) return "macOS";
  if (/Windows/.test(ua)) return "Windows";
  if (/Linux/.test(ua)) return "Linux";
  return "unknown";
}
