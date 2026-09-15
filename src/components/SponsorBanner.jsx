import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { pb } from "@/lib/supabaseClient";
import env from "@/lib/env";

const SUPABASE_URL = env.VITE_SUPABASE_URL;

const resolveLogo = (b) => {
  if (b.logo_file) {
    return `${SUPABASE_URL}/storage/v1/object/public/branding/sponsors/${b.id}/${b.logo_file}`;
  }
  if (b.image_url) return b.image_url;
  return "";
};

const ANIMATIONS = [
  {
    name: "fadeScale",
    initial: { opacity: 0, scale: 0.92 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 1.06 },
  },
  {
    name: "slideRight",
    initial: { opacity: 0, x: 80 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -80 },
  },
  {
    name: "slideLeft",
    initial: { opacity: 0, x: -80 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: 80 },
  },
  {
    name: "slideUp",
    initial: { opacity: 0, y: 40 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -40 },
  },
  {
    name: "zoomIn",
    initial: { opacity: 0, scale: 1.15, filter: "blur(8px)" },
    animate: { opacity: 1, scale: 1, filter: "blur(0px)" },
    exit: { opacity: 0, scale: 0.9, filter: "blur(6px)" },
  },
];

const INTERVAL = 4200;

const SponsorBanner = ({ className = "" }) => {
  const [banners, setBanners] = useState([]);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await pb
          .collection("sponsor_banners")
          .getFullList({ sort: "position", filter: "active = true" });
        if (alive) setBanners(data || []);
      } catch {
        if (alive) setBanners([]);
      }
    })();
    return () => { alive = false; };
  }, []);

  const next = useCallback(() => {
    setIndex((prev) => (prev + 1) % banners.length);
  }, [banners.length]);

  useEffect(() => {
    if (banners.length <= 1 || paused) return;
    timerRef.current = setInterval(next, INTERVAL);
    return () => clearInterval(timerRef.current);
  }, [banners.length, paused, next]);

  if (banners.length === 0) return null;

  const b = banners[index];
  const anim = ANIMATIONS[index % ANIMATIONS.length];
  const logoSrc = resolveLogo(b);

  const Content = (
    <motion.div
      key={b.id + "-" + index}
      variants={anim}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden rounded-2xl"
      style={{
        background: `linear-gradient(135deg, ${b.bg_from || "#001F3F"}, ${b.bg_to || "#1B4332"})`,
      }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
      onTouchEnd={() => setTimeout(() => setPaused(false), 2000)}
    >
      <div className="relative flex items-center gap-4 p-4 sm:p-5">
        {logoSrc && (
          <div className="relative h-20 w-20 shrink-0 sm:h-24 sm:w-24 overflow-hidden rounded-xl bg-white/10">
            <img src={logoSrc} alt="" className="h-full w-full object-contain p-1" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <motion.p
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.35 }}
            className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/60"
          >
            Partenaire
          </motion.p>
          <motion.h3
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.22, duration: 0.4 }}
            className="mt-1 text-base sm:text-lg font-extrabold text-white leading-tight"
          >
            {b.title}
          </motion.h3>
          {b.subtitle && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.35, duration: 0.4 }}
              className="mt-1 text-[11px] sm:text-xs text-white/70 leading-relaxed line-clamp-2"
            >
              {b.subtitle}
            </motion.p>
          )}
          {b.link_url && (
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.45, duration: 0.35 }}
              className="mt-2.5"
            >
              <a
                href={b.link_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-extrabold text-white transition-transform hover:scale-105 active:scale-95"
                style={{ background: b.accent_color || "#FFD60A", color: b.bg_from || "#001F3F" }}
              >
                {b.cta_text || "En savoir plus"}
                <ChevronRight className="h-3.5 w-3.5" />
              </a>
            </motion.div>
          )}
        </div>
      </div>

      {banners.length > 1 && (
        <div className="h-0.5 w-full bg-white/10">
          <motion.div
            key={`prog-${index}`}
            initial={{ width: "0%" }}
            animate={{ width: paused ? undefined : "100%" }}
            transition={{ duration: paused ? 0 : INTERVAL / 1000, ease: "linear" }}
            className="h-full rounded-full"
            style={{ background: b.accent_color || "#FFD60A" }}
          />
        </div>
      )}
    </motion.div>
  );

  return (
    <div className={className}>
      <AnimatePresence mode="wait">{Content}</AnimatePresence>
      {banners.length > 1 && (
        <div className="mt-3 flex items-center justify-center gap-1.5">
          {banners.map((_, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              className="h-2 rounded-full transition-all duration-300"
              style={{
                width: i === index ? 20 : 8,
                background: i === index ? banners[i].accent_color || "#FFD60A" : "hsl(var(--muted))",
              }}
              aria-label={`Bannière ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default SponsorBanner;
