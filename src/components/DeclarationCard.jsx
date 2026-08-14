import React from "react";
import { Link } from "react-router-dom";
import { CalendarDays, MapPin, Star } from "lucide-react";
import { pb } from "@/lib/supabaseClient";
import { maskId } from "@/lib/retrouve";
import { metaForSlug } from "@/lib/categories";

const DeclarationCard = ({ item }) => {
  const cat = item.expand?.category;
  const photo = item.photo
    ? pb.files.getURL(item, item.photo, { thumb: "400x300" })
    : null;

  return (
    <Link
      to={`/objet/${item.id}`}
      className="group flex gap-4 rounded-2xl border border-border bg-card p-4 transition-transform hover:-translate-y-0.5 rt-shadow"
    >
      <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-xl bg-muted text-2xl">
        {photo ? (
          <img
            src={photo}
            alt={item.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <span>{cat ? metaForSlug(cat.slug).emoji : "📦"}</span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${
              item.kind === "lost"
                ? "bg-destructive/10 text-destructive"
                : "bg-accent/15 text-accent"
            }`}
          >
            {item.kind === "lost" ? "Égaré" : "Retrouvé"}
          </span>
          {cat && (
            <span className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold">
              <span>{metaForSlug(cat.slug).emoji}</span>
              {cat.name}
            </span>
          )}
          {item.priority && (
            <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary">
              <Star className="h-3 w-3" /> Prioritaire
            </span>
          )}
        </div>
        <p className="mt-2 truncate font-bold">{item.title}</p>
        <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" /> {item.city}
            {item.zone ? ` · ${item.zone}` : ""}
          </span>
          {item.event_date && (
            <span className="flex items-center gap-1">
              <CalendarDays className="h-3.5 w-3.5" />
              {new Date(item.event_date).toLocaleDateString("fr-FR")}
            </span>
          )}
          {item.doc_last4 && (
            <span className="font-mono">{maskId(item.doc_last4)}</span>
          )}
        </p>
      </div>
    </Link>
  );
};

export default DeclarationCard;
