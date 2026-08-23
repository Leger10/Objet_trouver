// components/InstallFloatingButton.jsx
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Download, X, Smartphone } from "lucide-react";
import { useBranding } from "@/contexts/BrandingContext";

const DISMISS_SESSION = "pwa_install_dismissed_session";

export default function InstallFloatingButton() {
  const { branding } = useBranding();
  const [show, setShow] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [installing, setInstalling] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    // Vérifier si déjà installé
    if (window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true) {
      setInstalled(true);
      return;
    }

    // Vérifier si le popup a été fermé dans cette session
    if (sessionStorage.getItem(DISMISS_SESSION) === "1") {
      return;
    }

    // Écouter l'événement beforeinstallprompt
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", handler);

    // Écouter l'installation réussie
    const installedHandler = () => {
      setInstalled(true);
      setShow(false);
    };
    window.addEventListener("appinstalled", installedHandler);

    // Afficher le bouton flottant après 3 secondes sur mobile
    const timer = setTimeout(() => {
      const isMobile = /Android|iPad|iPhone|iPod/.test(navigator.userAgent);
      if (isMobile && !sessionStorage.getItem(DISMISS_SESSION)) {
        setShow(true);
      }
    }, 3000);

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

  const handleDismiss = () => {
    setShow(false);
    sessionStorage.setItem(DISMISS_SESSION, "1");
  };

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const canNativeInstall = deferredPrompt != null;

  if (installed || !show) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 100 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 100 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="fixed bottom-0 left-0 right-0 z-[9998] p-4 pb-6"
        style={{
          background: "linear-gradient(to top, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0) 100%)"
        }}
      >
        <div className="relative rounded-2xl border border-white/10 bg-white/95 backdrop-blur-md p-4 shadow-2xl">
          {/* Bouton fermer */}
          <button
            onClick={handleDismiss}
            className="absolute -top-2 -right-2 rounded-full bg-gray-200 p-1.5 text-gray-600 hover:bg-gray-300 transition-colors shadow-lg"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="flex items-center gap-3">
            {/* Logo */}
            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gray-100">
              <img
                src={branding?.logo_url}
                alt={branding?.app_name || "RetrouveMoi"}
                className="h-10 w-10 object-contain"
              />
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-extrabold text-gray-900 leading-tight">
                {branding?.app_name || "RetrouveMoi"}
              </p>
              <p className="text-[10px] text-gray-500">
                Installation en 1 tap ⚡
              </p>
            </div>

            {canNativeInstall ? (
              <button
                onClick={handleInstall}
                disabled={installing}
                className="shrink-0 flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-2.5 text-xs font-bold text-white active:scale-[0.95] disabled:opacity-60 transition-all shadow-lg shadow-blue-600/30"
              >
                <Download className="h-4 w-4" />
                {installing ? "..." : "Installer"}
              </button>
            ) : isIOS ? (
              <button
                onClick={() => {
                  alert("📱 Appuyez sur Partager ↗\npuis sur 'Sur l'écran d'accueil'");
                }}
                className="shrink-0 flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-2.5 text-xs font-bold text-white active:scale-[0.95] transition-all shadow-lg shadow-blue-600/30"
              >
                <Smartphone className="h-4 w-4" />
                Guide
              </button>
            ) : (
              <button
                onClick={() => {
                  alert("🌐 Ouvrez cette page dans Chrome ou Edge sur votre téléphone");
                }}
                className="shrink-0 flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-2.5 text-xs font-bold text-white active:scale-[0.95] transition-all shadow-lg shadow-blue-600/30"
              >
                <Download className="h-4 w-4" />
                Installer
              </button>
            )}
          </div>

          {/* Indicateur de swipe */}
          <div className="absolute -top-1 left-1/2 -translate-x-1/2">
            <div className="h-1 w-12 rounded-full bg-gray-300" />
          </div>
        </div>
      </motion.div>
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