import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { pb } from "@/lib/supabaseClient";
import { DEFAULT_HERO } from "@/lib/brandingDefaults";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

const resolveHeroImage = (h) => {
  if (h.file_name) {
    return `${SUPABASE_URL}/storage/v1/object/public/branding/heroes/${h.id}/${h.file_name}`;
  }
  if (h.image_url) return h.image_url;
  return DEFAULT_HERO;
};

// Précharge une image ; résout vite même si elle met du temps
const preloadImage = (src) =>
  new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = src;
  });

const HERO_ANIMATIONS = [
  {
    initial: { opacity: 0, scale: 1.04 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.97 },
  },
  {
    initial: { opacity: 0, x: 40 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -40 },
  },
  {
    initial: { opacity: 0, x: -40 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: 40 },
  },
  {
    initial: { opacity: 0, scale: 1.06, filter: "blur(4px)" },
    animate: { opacity: 1, scale: 1, filter: "blur(0px)" },
    exit: { opacity: 0, scale: 0.96, filter: "blur(2px)" },
  },
];

const SLIDE_MS = 6000;

const HeroRotator = ({ fallbackImage, children, className = "" }) => {
  const [images, setImages] = useState([]);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const readyRef = useRef(new Set());
  const timerRef = useRef(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await pb
          .collection("hero_images")
          .getFullList({ sort: "position", filter: "active = true" });
        if (!alive || !data || data.length === 0) return;

        // Ne garder que les images qui se chargent réellement
        const ok = [];
        for (const h of data.slice(0, 6)) {
          const src = resolveHeroImage(h);
          const loaded = await preloadImage(src);
          if (loaded) {
            readyRef.current.add(h.id);
            ok.push(h);
          } else if (alive) {
            console.warn("Image hero illisible, ignorée :", src);
          }
          if (!alive) return;
        }
        if (alive) setImages(ok);
      } catch {
        // réseau indisponible : le fallback reste affiché
      }
    })();
    return () => { alive = false; };
  }, []);

  const next = useCallback(() => {
    setIndex((prev) => (images.length ? (prev + 1) % images.length : 0));
  }, [images.length]);

  // Autoplay : ne tourne que si l'image courante est déjà chargée
  useEffect(() => {
    if (paused || images.length <= 1) return;
    const cur = images[index];
    if (cur && !readyRef.current.has(cur.id)) return;
    timerRef.current = setTimeout(next, SLIDE_MS);
    return () => clearTimeout(timerRef.current);
  }, [index, paused, images, next]);

  const fallbackSrc = fallbackImage || DEFAULT_HERO;
  const currentImage = images.length > 0 ? images[index] : null;
  const anim = HERO_ANIMATIONS[index % HERO_ANIMATIONS.length];

  return (
    <div className={`${className}`}>
      {/* ── IMAGE SLIDER ── */}
      <section
        className="relative mx-auto h-64 sm:h-80 max-w-3xl overflow-hidden bg-black rounded-b-2xl sm:rounded-2xl"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onTouchStart={() => setPaused(true)}
        onTouchEnd={() => setTimeout(() => setPaused(false), 3000)}
      >
        {/* Fallback visible pendant le chargement / si aucune image */}
        {!currentImage && (
          <img
            src={fallbackSrc}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            decoding="async"
          />
        )}

        {/* Slides empilées : pas de re-téléchargement au changement */}
        <AnimatePresence>
          {currentImage && (
            <motion.img
              key={currentImage.id}
              src={resolveHeroImage(currentImage)}
              alt={currentImage.title || ""}
              className="absolute inset-0 h-full w-full object-cover"
              initial={anim.initial}
              animate={anim.animate}
              exit={anim.exit}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              decoding="async"
            />
          )}
        </AnimatePresence>

        {/* Dots navigation */}
        {images.length > 1 && (
          <div className="absolute bottom-3 left-0 right-0 flex items-center justify-center gap-1.5 z-20">
            {images.map((img, i) => (
              <button
                key={img.id}
                onClick={() => setIndex(i)}
                className="h-1.5 rounded-full transition-all duration-300"
                style={{
                  width: i === index ? 18 : 6,
                  background: i === index ? "#FFD60A" : "rgba(255,255,255,0.4)",
                }}
                aria-label={`Image ${i + 1}`}
              />
            ))}
          </div>
        )}
      </section>

      {/* ── OVERLAY CONTENT (logo, tagline, sponsor) ── */}
      {children && (
        <div className="relative z-10 px-4 pt-4 pb-2">
          {children}
        </div>
      )}
    </div>
  );
};

export default HeroRotator;
