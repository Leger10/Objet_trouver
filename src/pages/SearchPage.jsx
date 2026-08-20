import React, { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useSearchParams } from "react-router-dom";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { pb } from "@/lib/supabaseClient";
import Layout from "@/components/Layout";
import AdSlot from "@/components/AdSlot";
import DeclarationCard from "@/components/DeclarationCard";
import PullToRefresh from "@/components/PullToRefresh";
import CategoryGrid from "@/components/CategoryGrid";
import { fetchCategoryCounts } from "@/lib/categories";

const field =
  "w-full rounded-xl border border-input bg-background px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30";

const empty = {
  q: "",
  kind: "all",
  category: "all",
  city: "",
  zone: "",
  person_name: "",
  brand: "",
  color: "",
  doc_last4: "",
  from: "",
  to: "",
};

const SearchPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [categories, setCategories] = useState([]);
  const [catCounts, setCatCounts] = useState({});
  const initialCat = searchParams.get("cat") || "all";
  const [filters, setFilters] = useState({ ...empty, category: initialCat });
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    pb.collection("categories")
      .getFullList({ sort: "position", requestKey: "cats-search" })
      .then(setCategories)
      .catch(() => setCategories([]));
  }, []);

  // Synchronise l'URL quand la catégorie change (partage / deep-link)
  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (filters.category && filters.category !== "all")
      next.set("cat", filters.category);
    else next.delete("cat");
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.category]);

  // Comptes par catégorie (une seule fois)
  useEffect(() => {
    let alive = true;
    (async () => {
      const c = await fetchCategoryCounts();
      if (alive) setCatCounts(c);
    })();
    return () => {
      alive = false;
    };
  }, [refreshKey]);

  useEffect(() => {
    const t = setTimeout(async () => {
      setLoading(true);
      const parts = ['status != "blocked"'];
      if (filters.kind !== "all")
        parts.push(pb.filter("kind = {:kind}", { kind: filters.kind }));
      if (filters.category !== "all")
        parts.push(pb.filter("category = {:c}", { c: filters.category }));
      if (filters.city.trim())
        parts.push(pb.filter("city ~ {:v}", { v: filters.city.trim() }));
      if (filters.zone.trim())
        parts.push(pb.filter("zone ~ {:v}", { v: filters.zone.trim() }));
      if (filters.person_name.trim())
        parts.push(
          pb.filter("person_name ~ {:v}", { v: filters.person_name.trim() }),
        );
      if (filters.brand.trim())
        parts.push(pb.filter("brand ~ {:v}", { v: filters.brand.trim() }));
      if (filters.color.trim())
        parts.push(pb.filter("color ~ {:v}", { v: filters.color.trim() }));
      if (filters.doc_last4.trim()) {
        const digits = filters.doc_last4.replace(/\D/g, "").slice(-4);
        if (digits) parts.push(pb.filter("doc_last4 = {:v}", { v: digits }));
      }
      if (filters.from)
        parts.push(
          pb.filter("event_date >= {:v}", { v: `${filters.from} 00:00:00` }),
        );
      if (filters.to)
        parts.push(
          pb.filter("event_date <= {:v}", { v: `${filters.to} 23:59:59` }),
        );
      if (filters.q.trim()) {
        const q = filters.q.trim();
        parts.push(
          `(${pb.filter("title ~ {:q} || description ~ {:q} || person_name ~ {:q} || brand ~ {:q} || city ~ {:q} || zone ~ {:q}", { q })})`,
        );
      }
      try {
        const res = await pb.collection("declarations").getList(page, 20, {
          filter: parts.join(" && "),
          sort: "-priority,-created",
          expand: "category",
          requestKey: "search",
        });
        if (page === 1) {
          setItems(res.items);
        } else {
          setItems((prev) => [...prev, ...res.items]);
        }
        setTotal(res.totalItems);
      } catch (_) {
        setItems([]);
        setTotal(0);
      } finally {
        setLoading(false);
      }
    }, 280);

    return () => clearTimeout(t);
  }, [filters, refreshKey, page]);

  useEffect(() => {
    setPage(1);
  }, [filters.q, filters.kind, filters.category, filters.city, filters.zone, filters.person_name, filters.brand, filters.color, filters.doc_last4, filters.from, filters.to]);

  const set = (k) => (e) => setFilters((f) => ({ ...f, [k]: e.target.value }));

  const toggleCategory = (c) =>
    setFilters((f) => ({ ...f, category: f.category === c.id ? "all" : c.id }));

  return (
    <Layout>
      <Helmet>
        <title>Rechercher un objet perdu ou retrouvé — RetrouveMoi</title>
        <meta
          name="description"
          content="Recherche multicritère dans la base centralisée RetrouveMoi : catégorie, ville, zone, date, nom, marque, couleur et identifiant partiellement masqué."
        />
      </Helmet>

      <PullToRefresh onRefresh={() => setRefreshKey((k) => k + 1)}>
        <div className="border-b border-border bg-secondary/40">
          <div className="mx-auto w-full max-w-[90rem] px-4 sm:px-6 py-6 sm:py-8">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold">
              Rechercher dans toute la base
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Une seule recherche couvre l'ensemble des déclarations, égarées
              comme retrouvées.
            </p>
            <div className="mt-4 sm:mt-5 flex gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <input
                  className={`${field} pl-12 py-3.5 sm:py-4 text-base`}
                  placeholder="Nom, objet, marque, ville, mot-clé…"
                  value={filters.q}
                  onChange={set("q")}
                />
              </div>
              <button
                type="button"
                onClick={() => setShowFilters((s) => !s)}
                className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 sm:px-4 font-bold min-w-[48px] justify-center"
              >
                <SlidersHorizontal className="h-5 w-5" />
                <span className="hidden sm:inline">Filtres</span>
              </button>
            </div>

            {showFilters && (
              <div className="mt-4 grid gap-3 rounded-2xl border border-border bg-background p-4 sm:grid-cols-3 lg:grid-cols-4">
                <select
                  className={field}
                  value={filters.kind}
                  onChange={set("kind")}
                >
                  <option value="all">Tous les types</option>
                  <option value="lost">Égarés</option>
                  <option value="found">Retrouvés</option>
                </select>
                <select
                  className={field}
                  value={filters.category}
                  onChange={set("category")}
                >
                  <option value="all">Toutes les catégories</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <input
                  className={field}
                  placeholder="Ville"
                  value={filters.city}
                  onChange={set("city")}
                />
                <input
                  className={field}
                  placeholder="Zone / quartier"
                  value={filters.zone}
                  onChange={set("zone")}
                />
                <input
                  className={field}
                  placeholder="Nom sur le document"
                  value={filters.person_name}
                  onChange={set("person_name")}
                />
                <input
                  className={field}
                  placeholder="Marque"
                  value={filters.brand}
                  onChange={set("brand")}
                />
                <input
                  className={field}
                  placeholder="Couleur"
                  value={filters.color}
                  onChange={set("color")}
                />
                <input
                  className={field}
                  placeholder="4 derniers chiffres du n°"
                  value={filters.doc_last4}
                  onChange={set("doc_last4")}
                />
                <label className="text-xs font-bold text-muted-foreground">
                  Du
                  <input
                    type="date"
                    className={field}
                    value={filters.from}
                    onChange={set("from")}
                  />
                </label>
                <label className="text-xs font-bold text-muted-foreground">
                  Au
                  <input
                    type="date"
                    className={field}
                    value={filters.to}
                    onChange={set("to")}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => setFilters(empty)}
                  className="rounded-xl border border-border px-4 py-3 text-sm font-bold"
                >
                  Réinitialiser
                </button>
              </div>
            )}
          </div>
        </div>

        {/* FILTRE PAR CATÉGORIES */}
        <section className="mx-auto w-full max-w-[90rem] px-4 sm:px-6 py-6 sm:py-8">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h2 className="text-base sm:text-lg font-extrabold">
              Filtrer par catégorie
            </h2>
            {filters.category !== "all" && (
              <button
                type="button"
                onClick={() => setFilters((f) => ({ ...f, category: "all" }))}
                className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-xs font-bold text-muted-foreground active:scale-95"
              >
                <X className="h-3.5 w-3.5" /> Effacer le filtre
              </button>
            )}
          </div>
          {categories.length > 0 && (
            <CategoryGrid
              categories={categories}
              counts={catCounts}
              selected={filters.category !== "all" ? filters.category : null}
              onSelect={toggleCategory}
            />
          )}
        </section>

        <div className="mx-auto w-full max-w-[90rem] px-4 py-8">
          <p className="text-sm font-semibold text-muted-foreground">
            {loading
              ? "Recherche…"
              : `${total} résultat${total > 1 ? "s" : ""}`}
          </p>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {loading &&
              [0, 1, 2, 3].map((k) => (
                <div
                  key={k}
                  className="h-28 animate-pulse rounded-2xl bg-muted"
                />
              ))}
            {!loading && items.length === 0 && (
              <div className="rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground lg:col-span-2">
                Aucun résultat. Essayez moins de critères, ou déclarez votre
                objet pour être alerté automatiquement.
              </div>
            )}
            {items.map((item, i) => (
              <React.Fragment key={item.id}>
                <DeclarationCard item={item} />
                {i === 5 && (
                  <div className="lg:col-span-2">
                    <AdSlot
                      label="Publicité"
                      title="Mobile money, assurances, serruriers : touchez une audience locale motivée"
                    />
                  </div>
                )}
              </React.Fragment>
            ))}
            {!loading && items.length < total && (
              <div className="mt-4 lg:col-span-2">
                <button
                  onClick={() => setPage((p) => p + 1)}
                  className="w-full rounded-2xl border border-border bg-card py-3 text-sm font-bold text-muted-foreground active:scale-[0.98]"
                >
                  Voir plus ({items.length}/{total})
                </button>
              </div>
            )}
          </div>
        </div>
      </PullToRefresh>
    </Layout>
  );
};

export default SearchPage;
