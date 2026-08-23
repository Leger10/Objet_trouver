// hooks/useInstallPrompt.js
import { useState, useEffect } from "react";

export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [canInstall, setCanInstall] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true) {
      setIsInstalled(true);
      return;
    }

    if (localStorage.getItem("pwa_install_dismissed") === "1") {
      setIsInstalled(true);
      return;
    }

    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setCanInstall(true);
    };

    window.addEventListener("beforeinstallprompt", handler);

    const installedHandler = async () => {
      setIsInstalled(true);
      setCanInstall(false);
      setDeferredPrompt(null);
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
    };
    window.addEventListener("appinstalled", installedHandler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installedHandler);
    };
  }, []);

  const install = async () => {
    if (!deferredPrompt) return false;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setCanInstall(false);
    return outcome === "accepted";
  };

  const dismiss = () => {
    localStorage.setItem("pwa_install_dismissed", "1");
    setIsInstalled(true);
    setCanInstall(false);
  };

  return { isInstalled, canInstall, install, dismiss };
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