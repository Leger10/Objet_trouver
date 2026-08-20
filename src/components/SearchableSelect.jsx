import React, { useState, useRef, useEffect, useMemo } from "react";
import { Search, ChevronDown, X } from "lucide-react";

const inputCls =
  "w-full rounded-xl border border-input bg-background px-4 py-3 text-sm outline-none focus:border-primary";

/**
 * Select avec champ de recherche.
 * items: [{ value, label, sub? }]
 * value, onChange, placeholder, renderOption?
 */
const SearchableSelect = ({
  items = [],
  value,
  onChange,
  placeholder = "Rechercher…",
  emptyText = "Aucun résultat",
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef(null);
  const inputRef = useRef(null);

  const selected = useMemo(
    () => items.find((i) => i.value === value),
    [items, value],
  );

  const filtered = useMemo(() => {
    if (!query.trim()) return items;
    const q = query.toLowerCase();
    return items.filter(
      (i) =>
        i.label.toLowerCase().includes(q) ||
        (i.sub && i.sub.toLowerCase().includes(q)),
    );
  }, [items, query]);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-between gap-2 rounded-xl border border-input bg-background px-4 py-3 text-sm text-left"
      >
        <span className={selected ? "font-semibold" : "text-muted-foreground"}>
          {selected ? (
            <>
              {selected.label}
              {selected.sub && (
                <span className="ml-2 text-xs text-muted-foreground">
                  {selected.sub}
                </span>
              )}
            </>
          ) : (
            placeholder
          )}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
      </button>
    );
  }

  return (
    <div ref={wrapRef} className="relative">
      <div className="flex items-center gap-2 rounded-xl border border-primary bg-background px-3 py-2">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Tapez pour filtrer…"
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="rounded-full p-0.5 hover:bg-muted"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <ul className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-border bg-card shadow-lg">
        {value && (
          <li
            key="__clear__"
            className="cursor-pointer px-4 py-2.5 text-sm text-destructive hover:bg-destructive/10 font-semibold"
            onClick={() => {
              onChange("");
              setOpen(false);
              setQuery("");
            }}
          >
            ✕ Aucune déclaration
          </li>
        )}
        {filtered.length === 0 && (
          <li className="px-4 py-3 text-sm text-muted-foreground">
            {emptyText}
          </li>
        )}
        {filtered.map((item) => (
          <li
            key={item.value}
            className={`cursor-pointer px-4 py-2.5 text-sm transition hover:bg-primary/10 ${
              item.value === value ? "bg-primary/10 font-bold" : ""
            }`}
            onClick={() => {
              onChange(item.value);
              setOpen(false);
              setQuery("");
            }}
          >
            <span className="font-semibold">{item.label}</span>
            {item.sub && (
              <span className="ml-2 text-xs text-muted-foreground">
                {item.sub}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default SearchableSelect;
