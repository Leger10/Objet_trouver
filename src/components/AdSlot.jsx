import React, { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Megaphone } from "lucide-react";
import { pb } from "@/lib/pbClient";
import { useAuth } from "@/contexts/AuthContext";

const logAdEvent = (type, placement) => {
  try {
    const user = pb.authStore.record;
    pb.collection("ad_events")
      .create(
        {
          action: type,
          placement,
          "user": user?.id || null,
        },
        { requestKey: `ad-${type}-${placement}-${Date.now()}` },
      )
      .catch(() => {});
  } catch (_) {
    /* best-effort */
  }
};

const LOCAL_ADS = [
  {
    placement: "home_top",
    label: "Assurance Auto",
    title: "Assurez votre véhicule dès aujourd'hui",
    cta: "Demander un devis",
    accent: "border-[hsl(206_84%_32%)]/40 bg-[hsl(206_84%_32%)]/5",
    icon: "🚗",
  },
  {
    placement: "search_between",
    label: "Orange Money",
    title: "Envoyez de l'argent en un instant avec Orange Money",
    cta: "En savoir plus",
    accent: "border-[hsl(22_90%_50%)]/40 bg-[hsl(22_90%_50%)]/5",
    icon: "📱",
  },
  {
    placement: "dashboard",
    label: "Banque partenaire",
    title: "Ouvrez un compte en 5 minutes",
    cta: "Découvrir",
    accent: "border-[hsl(160_60%_40%)]/40 bg-[hsl(160_60%_40%)]/5",
    icon: "🏦",
  },
  {
    placement: "category",
    label: "Wave",
    title: "Transférez sans frais avec Wave",
    cta: "Télécharger",
    accent: "border-[hsl(199_90%_45%)]/40 bg-[hsl(199_90%_45%)]/5",
    icon: "🌊",
  },
];

const AdSlot = ({
  placement = "default",
  label,
  title,
  cta = "Annoncer sur RetrouveMoi",
}) => {
  const { user } = useAuth();
  const loggedRef = useRef(false);

  // Premium / Pro users see no ads
  const isAdFree =
    user?.plan === "premium" || user?.plan === "pro" || user?.role === "admin";
  const localAd = LOCAL_ADS.find((a) => a.placement === placement);

  useEffect(() => {
    if (isAdFree || loggedRef.current) return;
    loggedRef.current = true;
    logAdEvent("impression", placement);
  }, [isAdFree, placement]);

  if (isAdFree) return null;

  const handleAdClick = () => logAdEvent("click", placement);

  if (localAd) {
    return (
      <aside
        onClick={handleAdClick}
        className={`cursor-pointer rounded-2xl border ${localAd.accent} p-5 transition-transform active:scale-[0.99]`}
      >
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-background text-xl">
            {localAd.icon}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
              Pub · {localAd.label}
            </p>
            <p className="mt-1 font-bold leading-snug">{localAd.title}</p>
            <span className="mt-2 inline-block text-sm font-bold text-primary underline underline-offset-4">
              {localAd.cta} →
            </span>
          </div>
        </div>
      </aside>
    );
  }

  return (
    <aside
      onClick={handleAdClick}
      className="cursor-pointer rounded-2xl border border-dashed border-primary/40 bg-secondary/50 p-5"
    >
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          <Megaphone className="h-5 w-5" />
        </span>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
            {label || "Espace publicitaire"}
          </p>
          <p className="mt-1 font-bold leading-snug">
            {title || "Votre marque ici, vue par des milliers de citoyens"}
          </p>
          <Link
            to="/premium"
            className="mt-2 inline-block text-sm font-bold text-primary underline underline-offset-4"
            onClick={(e) => e.stopPropagation()}
          >
            {cta}
          </Link>
        </div>
      </div>
    </aside>
  );
};

export default AdSlot;
