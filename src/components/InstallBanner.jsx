// components/InstallBanner.jsx
import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Download, X, Smartphone } from "lucide-react";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";
import { useBranding } from "@/contexts/BrandingContext";
import { LOGO_URL } from "@/lib/brandingDefaults";

export default function InstallBanner() {
  const { isInstalled, canInstall, install, dismiss } = useInstallPrompt();
  const { branding } = useBranding();
  const [installing, setInstalling] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (isInstalled || dismissed) return null;

  const handleInstall = async () => {
    setInstalling(true);
    const ok = await install();
    setInstalling(false);
    if (ok) {
      try {
        const { pb } = await import("@/lib/pbClient");
        const { data: { user } } = await pb.auth.getUser();
        await pb.from("app_installations").insert({
          user: user?.id || null,
          user_agent: navigator.userAgent,
          platform: detectPlatform(),
          installed_at: new Date().toISOString(),
        });
      } catch (_) {}
    }
  };

  const handleDismiss = () => {
    dismiss();
    setDismissed(true);
  };

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isMacOS = /Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className="mx-4 mb-3"
      >
        <div className="relative rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-card to-accent/10 p-4 shadow-sm">
          <button
            onClick={handleDismiss}
            className="absolute top-2 right-2 rounded-full p-1 text-muted-foreground hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="flex items-start gap-3">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-primary/10 shadow-inner">
              <img
                src={branding?.logo_url || LOGO_URL}
                alt={branding?.app_name || "RetrouveMoi"}
                className="h-12 w-12 object-contain"
              />
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-extrabold">
                Installer {branding?.app_name || "RetrouveMoi"}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground leading-snug">
                Accédez plus rapidement depuis votre écran d&apos;accueil
              </p>

              {canInstall ? (
                <button
                  onClick={handleInstall}
                  disabled={installing}
                  className="mt-2.5 flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground active:scale-[0.97] disabled:opacity-60"
                >
                  <Download className="h-3.5 w-3.5" />
                  {installing ? "Installation..." : "Installer l'app"}
                </button>
              ) : isIOS || isMacOS ? (
                <div className="mt-2.5 space-y-1">
                  <p className="text-[10px] font-semibold text-primary">
                    <Smartphone className="mr-1 inline h-3 w-3" />
                    Appuyez sur <span className="font-extrabold">Partager</span> puis <span className="font-extrabold">&quot;Sur l&apos;écran d&apos;accueil&quot;</span>
                  </p>
                </div>
              ) : (
                <p className="mt-2 text-[10px] text-muted-foreground">
                  Ouvrez dans <span className="font-bold">Chrome</span> ou <span className="font-bold">Edge</span> pour installer
                </p>
              )}
            </div>
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