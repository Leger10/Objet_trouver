import React, { useEffect, useMemo, useState } from "react";
import {
  Building2,
  MapPin,
  Handshake,
  FileCheck2,
  FileText,
  PackageSearch,
  Coins,
  Trophy,
  Crown,
  RefreshCw,
  Filter,
} from "lucide-react";

const COLORS = {
  lost: "#ef4444",
  found: "#22c55e",
  returned: "#10b981",
  primary: "hsl(var(--primary))",
  accent: "hsl(var(--accent))",
  muted: "hsl(var(--muted-foreground))",
};

// ── Petites briques de chart (SVG + CSS, sans dépendance) ────────────

function Donut({ segments, size = 150, thickness = 22, centerLabel, centerValue }) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  const radius = (size - thickness) / 2;
  const circ = 2 * Math.PI * radius;
  let offset = 0;
  return (
    <div className="flex items-center gap-4">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="hsl(var(--border))" strokeWidth={thickness} />
          {segments.map((s, i) => {
            const frac = total ? s.value / total : 0;
            const dash = `${frac * circ} ${circ}`;
            const el = (
              <circle
                key={i}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={s.color}
                strokeWidth={thickness}
                strokeDasharray={dash}
                strokeDashoffset={-offset}
                strokeLinecap="butt"
              />
            );
            offset += frac * circ;
            return el;
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-extrabold">{centerValue}</span>
          <span className="text-[10px] text-muted-foreground">{centerLabel}</span>
        </div>
      </div>
      <div className="space-y-1.5">
        {segments.map((s, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
            <span className="text-muted-foreground flex-1">{s.label}</span>
            <span className="font-bold tabular-nums">{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StackedBar({ item, max }) {
  const lostW = max ? (item.lost / max) * 100 : 0;
  const foundW = max ? (item.found / max) * 100 : 0;
  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between text-[11px]">
        <span className="truncate font-semibold">
          <MapPin className="mr-1 inline h-3 w-3 text-muted-foreground" />
          {item[item.__labelKey]}
        </span>
        <span className="ml-2 font-bold tabular-nums">{item.total}</span>
      </div>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-muted/60">
        <div className="h-full bg-destructive" style={{ width: `${lostW}%` }} />
        <div className="h-full bg-emerald-500" style={{ width: `${foundW}%` }} />
      </div>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, tint = "text-primary", bg = "bg-primary/10" }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <div className={`flex items-center justify-center h-8 w-8 rounded-xl ${bg} ${tint} mb-2`}>
        <Icon className="h-4 w-4" />
      </div>
      <p className="text-xl font-extrabold tabular-nums leading-none">{value}</p>
      <p className="mt-1 text-[10px] font-semibold text-muted-foreground leading-tight">{label}</p>
    </div>
  );
}

// ── Onglet Statistiques ───────────────────────────────────────────────

export default function TabStats({ isMainAdmin }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selCity, setSelCity] = useState("");
  const [selQuarter, setSelQuarter] = useState("");
  const [myCity, setMyCity] = useState("");

  const load = async (city, quarter) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin-stats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ city, quarter }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Erreur");
      setData(json);
      if (json.scope && !json.scope.isMainAdmin) {
        setMyCity(json.scope.city || "");
        setSelCity("");
      }
    } catch (e) {
      setError(e?.message || "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(selCity, selQuarter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyFilters = () => load(selCity, selQuarter);

  const filteredQuarters = useMemo(() => {
    if (!data) return [];
    return data.availableQuarters.filter((q) => (selCity ? q.city === selCity : true));
  }, [data, selCity]);

  const isFiltered = !!selCity || !!selQuarter;

  if (loading && !data) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted" />
        ))}
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-center text-sm font-semibold text-destructive">
        {error}
      </div>
    );
  }

  const t = data?.totals || {};
  const cityData = (data?.byCity || []).map((c) => ({ ...c, __labelKey: "city" }));
  const quarterData = (data?.byQuarter || []).map((q) => ({ ...q, __labelKey: "quarter" }));

  return (
    <div className="space-y-4">
      {/* ── Filtres zone ── */}
      <div className="rounded-2xl border border-border bg-card p-3">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="h-4 w-4 text-primary" />
          <p className="text-xs font-extrabold uppercase tracking-wide text-muted-foreground">
            Zone analysée
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {isMainAdmin ? (
            <select
              value={selCity}
              onChange={(e) => { setSelCity(e.target.value); setSelQuarter(""); }}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="">Toutes les villes</option>
              {(data?.availableCities || []).map((c) => (
                <option key={c.city} value={c.city}>
                  {c.city} ({c.count})
                </option>
              ))}
            </select>
          ) : (
            <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm">
              <MapPin className="h-4 w-4 text-primary" />
              <span className="truncate font-bold">{myCity || "Ma ville"}</span>
            </div>
          )}
          <select
            value={selQuarter}
            onChange={(e) => setSelQuarter(e.target.value)}
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="">{isFiltered && !selQuarter ? "Tous les quartiers" : "Quartier (tous)"}</option>
            {filteredQuarters.map((q) => (
              <option key={q.city + q.quarter} value={q.quarter}>
                {q.quarter} ({q.count})
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={applyFilters}
          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground active:scale-[0.98]"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Mettre à jour
        </button>
        {isFiltered && (
          <p className="mt-2 text-[10px] text-muted-foreground">
            {selCity && <>Ville : <strong>{selCity}</strong> · </>}
            {selQuarter && <>Quartier : <strong>{selQuarter}</strong></>}
            {(!selCity && !selQuarter) && "Vue globale de la zone"}
          </p>
        )}
      </div>

      {/* ── KPIs ── */}
      <div className="grid grid-cols-2 gap-2">
        <KpiCard icon={PackageSearch} label="Déclarations totales" value={t.declarations ?? 0} tint="text-primary" bg="bg-primary/10" />
        <KpiCard icon={Handshake} label="Correspondances" value={t.matches ?? 0} tint="text-accent" bg="bg-accent/10" />
        <KpiCard icon={FileCheck2} label="Objets trouvés" value={t.found ?? 0} tint="text-emerald-600 dark:text-emerald-400" bg="bg-emerald-500/10" />
        <KpiCard icon={FileText} label="Objets perdus" value={t.lost ?? 0} tint="text-destructive" bg="bg-destructive/10" />
        <KpiCard icon={Building2} label="PV dépôt" value={t.depositPvs ?? 0} tint="text-primary" bg="bg-primary/10" />
        <KpiCard icon={Handshake} label="PV restitution" value={t.restitutionPvs ?? 0} tint="text-accent" bg="bg-accent/10" />
      </div>

      {/* ── Perdus vs Trouvés (donut) ── */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="mb-3 text-xs font-extrabold uppercase tracking-wide text-muted-foreground">
          Perdus vs trouvés
        </p>
        <Donut
          size={140}
          segments={[
            { label: "Perdus", value: t.lost ?? 0, color: COLORS.lost },
            { label: "Trouvés", value: t.found ?? 0, color: COLORS.found },
          ]}
          centerLabel="total"
          centerValue={t.declarations ?? 0}
        />
      </div>

      {/* ── Déclarations par ville ── */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="mb-3 text-xs font-extrabold uppercase tracking-wide text-muted-foreground">
          Répartition par ville
        </p>
        {cityData.length === 0 ? (
          <p className="text-center text-xs text-muted-foreground py-4">Aucune donnée</p>
        ) : (
          <div className="space-y-3">
            {cityData.map((c) => (
              <StackedBar key={c.city} item={c} max={cityData[0].total} />
            ))}
            <div className="flex items-center gap-4 text-[10px] text-muted-foreground pt-1">
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-destructive" /> Perdus</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Trouvés</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Quartiers ── */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="mb-3 text-xs font-extrabold uppercase tracking-wide text-muted-foreground">
          {isFiltered ? `Quartiers de ${selCity || "la zone"}` : "Top quartiers / localités"}
        </p>
        {quarterData.length === 0 ? (
          <p className="text-center text-xs text-muted-foreground py-4">Aucune donnée</p>
        ) : (
          <div className="space-y-3">
            {quarterData.slice(0, 8).map((q) => (
              <StackedBar key={q.city + q.quarter} item={q} max={quarterData[0].total} />
            ))}
          </div>
        )}
      </div>

      {/* ── PV dépôt / restitution ── */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="mb-3 text-xs font-extrabold uppercase tracking-wide text-muted-foreground">
          PV : dépôt vs restitution
        </p>
        <Donut
          size={140}
          segments={[
            { label: "Dépôts", value: t.depositPvs ?? 0, color: COLORS.primary },
            { label: "Restitutions", value: t.restitutionPvs ?? 0, color: COLORS.accent },
          ]}
          centerLabel="PV"
          centerValue={(t.depositPvs ?? 0) + (t.restitutionPvs ?? 0)}
        />
      </div>

      {/* ── Correspondances par statut ── */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="mb-3 text-xs font-extrabold uppercase tracking-wide text-muted-foreground">
          Correspondances par statut
        </p>
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Suggestées", value: data?.matchesByStatus?.suggested ?? 0, color: "bg-muted-foreground/70" },
            { label: "Confirmées", value: data?.matchesByStatus?.confirmed ?? 0, color: "bg-accent" },
            { label: "Rejetées", value: data?.matchesByStatus?.rejected ?? 0, color: "bg-destructive" },
          ].map((s) => (
            <div key={s.label} className="rounded-xl bg-muted/50 p-2 text-center">
              <span className={`mx-auto block h-2 w-2 rounded-full ${s.color}`} />
              <p className="mt-1 text-lg font-extrabold tabular-nums">{s.value}</p>
              <p className="text-[9px] font-semibold text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Top utilisateurs (cérémonie cadeaux) ── */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-1">
          <Trophy className="h-4 w-4 text-amber-500" />
          <p className="text-xs font-extrabold uppercase tracking-wide text-muted-foreground">
            Meilleurs contributeurs
          </p>
        </div>
        <p className="mb-3 text-[10px] text-muted-foreground">
          Classement pour les cérémonies de remise de cadeaux — basé sur les objets trouvés déclarés + PV de dépôt chez l&apos;admin.
        </p>
        {data?.topUsers?.length === 0 ? (
          <p className="text-center text-xs text-muted-foreground py-4">Aucun contributeur</p>
        ) : (
          <div className="space-y-1.5">
            {data?.topUsers?.map((u, i) => (
              <div
                key={u.userId}
                className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${
                  i === 0
                    ? "border-amber-400/40 bg-amber-50 dark:bg-amber-500/10"
                    : i === 1
                      ? "border-slate-400/30 bg-slate-50 dark:bg-slate-500/10"
                      : i === 2
                        ? "border-orange-300/40 bg-orange-50 dark:bg-orange-500/10"
                        : "border-border bg-background"
                }`}
              >
                <span
                  className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold ${
                    i === 0
                      ? "bg-amber-400 text-white"
                      : i === 1
                        ? "bg-slate-400 text-white"
                        : i === 2
                          ? "bg-orange-400 text-white"
                          : "bg-muted text-muted-foreground"
                  }`}
                >
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate text-xs font-bold">
                    {u.name || u.email}
                    {i === 0 && <Crown className="h-3 w-3 text-amber-500" />}
                  </p>
                  <p className="truncate text-[10px] text-muted-foreground">
                    {u.email} · {u.city || "-"}{u.quarter ? ` · ${u.quarter}` : ""}
                  </p>
                </div>
                <div className="flex flex-col items-end text-[10px]">
                  <span className="font-extrabold text-primary tabular-nums">{u.score} pts</span>
                  <span className="text-muted-foreground">
                    {u.foundCount} trouvé{u.foundCount > 1 ? "s" : ""} · {u.depositCount} PV
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Vue admin principal : toutes les zones ── */}
      {isMainAdmin && data?.admins?.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="mb-1 text-xs font-extrabold uppercase tracking-wide text-muted-foreground">
            Zones des administrateurs
          </p>
          <p className="mb-3 text-[10px] text-muted-foreground">
            Vue globale des données de chaque zone gérée par un admin.
          </p>
          <div className="space-y-2">
            {data.admins.map((a) => (
              <div key={a.adminId} className="rounded-xl border border-border bg-background p-3">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 truncate text-xs font-bold">
                      <Coins className="h-3.5 w-3.5 text-accent" />
                      {a.name}
                    </p>
                    <p className="truncate text-[10px] text-muted-foreground">
                      {a.city || "Toutes"}{a.quarter ? ` · ${a.quarter}` : ""} — {a.email}
                    </p>
                  </div>
                  <span className="rounded-lg bg-primary/10 px-2 py-1 text-[10px] font-extrabold text-primary">
                    {a.declarations} décl.
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-4 gap-1.5 text-center">
                  {[
                    { l: "Perdus", v: a.lost, c: "text-destructive" },
                    { l: "Trouvés", v: a.found, c: "text-emerald-600 dark:text-emerald-400" },
                    { l: "Corresp.", v: a.matches, c: "text-accent" },
                    { l: "PV", v: a.pvs, c: "text-primary" },
                  ].map((s) => (
                    <div key={s.l} className="rounded-lg bg-muted/50 py-1.5">
                      <p className={`text-sm font-extrabold tabular-nums ${s.c}`}>{s.v}</p>
                      <p className="text-[9px] font-semibold text-muted-foreground">{s.l}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}