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

const HeroRotator = ({ fallbackImage, children, className = "" }) => {
  const [images, setImages] = useState([]);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await pb
          .collection("hero_images")
          .getFullList({ sort: "position", filter: "active = true" });
        if (alive && data && data.length > 0) {
          setImages(data);
        } else if (alive) {
          setImages([]);
        }
      } catch {
        if (alive) setImages([]);
      }
    })();
    return () => { alive = false; };
  }, []);

  const next = useCallback(() => {
    setIndex((prev) => (prev + 1) % images.length);
  }, [images.length]);

  useEffect(() => {
    if (images.length <= 1 || paused) return;
    timerRef.current = setInterval(next, 5000);
    return () => clearInterval(timerRef.current);
  }, [images.length, paused, next]);

  const currentImage = images.length > 0 ? images[index] : null;
  const src = currentImage ? resolveHeroImage(currentImage) : (fallbackImage || DEFAULT_HERO);
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
        <AnimatePresence mode="wait">
          <motion.img
            key={(currentImage?.id || "fallback") + "-" + index}
            src={src}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            initial={anim.initial}
            animate={anim.animate}
            exit={anim.exit}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          />
        </AnimatePresence>

        {/* Dots navigation — inside image area, at bottom */}
        {images.length > 1 && (
          <div className="absolute bottom-3 left-0 right-0 flex items-center justify-center gap-1.5 z-20">
            {images.map((_, i) => (
              <button
                key={i}
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
