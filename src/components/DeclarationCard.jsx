import React from "react";
import { Link } from "react-router-dom";
import { CalendarDays, MapPin, Star, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import { pb } from "@/lib/supabaseClient";
import { maskId } from "@/lib/retrouve";
import { metaForSlug } from "@/lib/categories";

const DeclarationCard = ({ item, index = 0 }) => {
  const cat = item.expand?.category;
  const photo = item.photo
    ? pb.files.getURL(item, item.photo, { thumb: "400x300" })
    : item.photo_url || null;
  const isLost = item.kind === "lost";
  const isPerson = ["enfant-disparu", "personne-disparue"].includes(item.expand?.category?.slug || item.category || "");
  const hasPriority =
    item.priority && item.priority_until && new Date(item.priority_until).getTime() > Date.now();

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.04 }}
    >
      <Link
        to={`/objet/${item.id}`}
        className="group relative flex gap-4 overflow-hidden rounded-2xl border border-border/50 bg-card p-4 shadow-sm transition-all duration-200 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 active:scale-[0.985]"
      >
        {/* Priority accent stripe */}
        {hasPriority && (
          <div className="absolute left-0 top-0 h-full w-1 rounded-l-2xl bg-gradient-to-b from-primary to-primary/60" />
        )}

        {/* Photo / Emoji */}
        <div className="relative grid h-[4.5rem] w-[4.5rem] shrink-0 place-items-center overflow-hidden rounded-xl bg-gradient-to-br from-muted/80 to-muted/40">
          {photo ? (
            <img
              src={photo}
              alt={item.title}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <span className="text-3xl">
              {cat ? metaForSlug(cat.slug).emoji : "📦"}
            </span>
          )}
          {/* Kind badge overlay */}
          <span
            className={`absolute bottom-1 left-1 rounded-md px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider shadow-sm ${
              isLost
                ? "bg-destructive text-white"
                : "bg-emerald-500 text-white"
            }`}
          >
            {isLost ? (isPerson ? "Disparu" : "Perdu") : "Trouvé"}
          </span>
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          {/* Tags row */}
          <div className="flex flex-wrap items-center gap-1.5">
            {cat && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/8 px-2 py-0.5 text-[10px] font-bold text-primary">
                <span className="text-xs">{metaForSlug(cat.slug).emoji}</span>
                {cat.name}
              </span>
            )}
            {hasPriority && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                <Star className="h-2.5 w-2.5 fill-current" /> Boost
              </span>
            )}
            {item.status === "matched" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/10 px-2 py-0.5 text-[10px] font-bold text-purple-600 dark:text-purple-400">
                🔗 Match
              </span>
            )}
          </div>

          {/* Title */}
          <p className="mt-1.5 truncate font-extrabold text-[15px] leading-tight group-hover:text-primary transition-colors">
            {item.title}
          </p>

          {/* Description excerpt */}
          {item.description && (
            <p className="mt-1 line-clamp-1 text-xs text-muted-foreground/80">
              {item.description}
            </p>
          )}

          {/* Meta row */}
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground">
              <MapPin className="h-3 w-3 text-primary/60" />
              {item.city || "—"}
              {item.zone ? (
                <span className="text-muted-foreground/60">· {item.zone}</span>
              ) : null}
            </span>
            {item.event_date && (
              <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                <CalendarDays className="h-3 w-3 text-primary/60" />
                {new Date(item.event_date).toLocaleDateString("fr-FR", {
                  day: "numeric",
                  month: "short",
                })}
              </span>
            )}
            {item.doc_last4 && (
              <span className="font-mono text-[10px] text-muted-foreground/60">
                {maskId(item.doc_last4)}
              </span>
            )}
          </div>
        </div>

        {/* Chevron */}
        <div className="flex shrink-0 items-center">
          <ChevronRight className="h-5 w-5 text-muted-foreground/30 transition-all group-hover:translate-x-0.5 group-hover:text-primary" />
        </div>
      </Link>
    </motion.div>
  );
};

export default DeclarationCard;
