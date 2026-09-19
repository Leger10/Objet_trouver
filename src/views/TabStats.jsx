import "leaflet/dist/leaflet.css";
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
  Layers,
  Map as MapIcon,
  Maximize2,
  Minimize2,
  X,
} from "lucide-react";
import { quarterCoords, cityCoords } from "@/lib/burkina-geo";

const COLORS = {
  lost: "#ef4444",
  found: "#22c55e",
  returned: "#10b981",
  primary: "hsl(var(--primary))",
  accent: "hsl(var(--accent))",
  muted: "hsl(var(--muted-foreground))",
};

// Palette pour les admins (bar chart + camembert)
const ADMIN_COLORS = [
  "#2563eb", // bleu
  "#dc2626", // rouge
  "#16a34a", // vert
  "#f59e0b", // ambre
  "#9333ea", // violet
  "#0891b2", // cyan
  "#ea580c", // orange
  "#db2777", // rose
  "#65a30d", // lime
  "#475569", // ardoise
];

// Couleur déterministe par admin (basée sur son id pour rester stable)
const colorForAdmin = (admin, index) => {
  if (index < ADMIN_COLORS.length) return ADMIN_COLORS[index];
  // fallback : hash sur l'id
  const seed = String(admin?.adminId || admin?.id || admin?.email || index);
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return ADMIN_COLORS[Math.abs(h) % ADMIN_COLORS.length];
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
            <span className="text-muted-foreground flex-1 truncate max-w-[140px]">{s.label}</span>
            <span className="font-bold tabular-nums">{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Camembert classique (pie) avec légende à droite
function PieChart({ segments, size = 160, centerLabel, centerValue }) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  const radius = size / 2;
  let angle = -Math.PI / 2;
  const slices = segments.map((s, i) => {
    const frac = total ? s.value / total : 0;
    const start = angle;
    const end = angle + frac * 2 * Math.PI;
    angle = end;
    const x1 = radius + radius * Math.cos(start);
    const y1 = radius + radius * Math.sin(start);
    const x2 = radius + radius * Math.cos(end);
    const y2 = radius + radius * Math.sin(end);
    const large = frac > 0.5 ? 1 : 0;
    const d =
      frac >= 1
        ? `M ${radius} ${radius} m -${radius} 0 a ${radius} ${radius} 0 1 0 ${radius * 2} 0 a ${radius} ${radius} 0 1 0 -${radius * 2} 0`
        : `M ${radius} ${radius} L ${x1} ${y1} A ${radius} ${radius} 0 ${large} 1 ${x2} ${y2} Z`;
    return { d, color: s.color, label: s.label, value: s.value, frac };
  });

  return (
    <div className="flex flex-col sm:flex-row items-center gap-5">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size}>
          {slices.map((s, i) => (
            <path key={i} d={s.d} fill={s.color} stroke="hsl(var(--card))" strokeWidth={2} />
          ))}
          {/* Trou central (donut) */}
          <circle cx={radius} cy={radius} r={radius * 0.55} fill="hsl(var(--card))" />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-extrabold">{centerValue}</span>
          <span className="text-[10px] text-muted-foreground">{centerLabel}</span>
        </div>
      </div>
      <div className="space-y-1.5 w-full">
        {slices.map((s, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className="h-3 w-3 shrink-0 rounded-sm" style={{ background: s.color }} />
            <span className="text-muted-foreground flex-1 truncate">{s.label}</span>
            <span className="font-bold tabular-nums">{s.value}</span>
            <span className="text-[10px] text-muted-foreground w-10 text-right">
              {total ? Math.round(s.frac * 100) : 0}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DualBar({ item }) {
  const label = item[item.__labelKey];
  const max = Math.max(item.lost, item.found, 1);
  const lostW = (item.lost / max) * 100;
  const foundW = (item.found / max) * 100;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[11px]">
        <span className="truncate font-semibold">
          <MapPin className="mr-1 inline h-3 w-3 text-muted-foreground" />
          {label}
        </span>
        <span className="ml-2 font-bold tabular-nums">{item.total}</span>
      </div>
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="w-9 text-right text-[10px] font-bold tabular-nums text-destructive">{item.lost}</span>
          <div className="flex h-2 flex-1 overflow-hidden rounded-full bg-muted/60">
            <div className="h-full bg-destructive" style={{ width: `${lostW}%` }} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-9 text-right text-[10px] font-bold tabular-nums text-emerald-500">{item.found}</span>
          <div className="flex h-2 flex-1 overflow-hidden rounded-full bg-muted/60">
            <div className="h-full bg-emerald-500" style={{ width: `${foundW}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
}

function ChartLegend() {
  return (
    <div className="flex items-center gap-4 text-[10px] text-muted-foreground pt-1">
      <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-destructive" /> Perdus</span>
      <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Trouvés</span>
    </div>
  );
}

// ── Bar chart vertical : zones des admins ─────────────────────────────
// Une barre = un admin. Hauteur proportionnelle au nombre de déclarations,
// empilée Perdus (rouge) + Trouvés (vert). Couleur de fond = admin.

function AdminBarChart({ admins }) {
  const sorted = useMemo(
    () => [...admins].sort((a, b) => (b.declarations || 0) - (a.declarations || 0)),
    [admins],
  );
  const maxDecl = Math.max(...sorted.map((a) => a.declarations || 0), 1);
  const chartHeight = 220;

  return (
    <div className="space-y-3">
      {/* Bar chart */}
      <div className="overflow-x-auto pb-2">
        <div className="flex items-end gap-3 min-w-max" style={{ height: chartHeight + 60 }}>
          {sorted.map((a, i) => {
            const total = a.declarations || 0;
            const barH = (total / maxDecl) * chartHeight;
            const lostH = total ? ((a.lost || 0) / total) * barH : 0;
            const foundH = total ? ((a.found || 0) / total) * barH : 0;
            const color = colorForAdmin(a, i);

            return (
              <div key={a.adminId} className="flex flex-col items-center gap-1 shrink-0 w-16">
                {/* Valeur en haut */}
                <span className="text-[10px] font-extrabold tabular-nums text-foreground">
                  {total}
                </span>

                {/* Barre empilée */}
                <div
                  className="relative w-10 rounded-t-lg overflow-hidden border border-border/40 bg-muted/40"
                  style={{ height: barH, minHeight: 4 }}
                  title={`${a.name} — ${total} déclarations`}
                >
                  {/* Trouvés en bas (vert) */}
                  <div
                    className="absolute bottom-0 left-0 right-0 bg-emerald-500"
                    style={{ height: foundH }}
                  />
                  {/* Perdus au-dessus (rouge) */}
                  <div
                    className="absolute left-0 right-0 bg-destructive"
                    style={{ bottom: foundH, height: lostH }}
                  />
                </div>

                {/* Couleur admin : pastille */}
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: color }}
                />

                {/* Nom + zone */}
                <div className="text-center w-16">
                  <p className="truncate text-[10px] font-bold leading-tight" title={a.name}>
                    {a.name?.split(" ")[0] || "—"}
                  </p>
                  <p className="truncate text-[9px] text-muted-foreground leading-tight">
                    {a.city || "Toutes"}
                    {a.quarter ? ` · ${a.quarter}` : ""}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Légende globale */}
      <div className="flex items-center gap-4 border-t border-border pt-2 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-destructive" /> Perdus
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-emerald-500" /> Trouvés
        </span>
        <span className="ml-auto">Hauteur = volume total de déclarations</span>
      </div>
    </div>
  );
}

// ── Carte interactive (Leaflet, chargée uniquement côté client) ────────

function ZoneMap({ points, fullscreen = false }) {
  const containerRef = React.useRef(null);
  const mapRef = React.useRef(null);
  const [leaflet, setLeaflet] = useState(null);

  useEffect(() => {
    let cancelled = false;
    import("leaflet").then((mod) => {
      if (!cancelled) setLeaflet(mod.default || mod);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!leaflet || !containerRef.current) return;
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }
    const map = leaflet.map(containerRef.current, {
      zoomControl: true,
      scrollWheelZoom: true,
      attributionControl: true,
    });
    mapRef.current = map;
    leaflet.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap",
    }).addTo(map);

    const markers = [];
    points.forEach((p) => {
      if (p.lat === undefined || p.lng === undefined) return;
      const total = p.total || 0;
      const radius = Math.max(8, Math.min(26, 8 + total * 2));
      const major = p.lost > p.found ? "lost" : "found";
      const color = major === "lost" ? "#ef4444" : "#22c55e";
      const m = leaflet
        .circleMarker([p.lat, p.lng], {
          radius,
          color: "#ffffff",
          weight: 2,
          fillColor: color,
          fillOpacity: 0.75,
        })
        .bindTooltip(`${p.label} — ${total} décl. (${p.lost} perdu·e·s / ${p.found} trouvé·e·s)`, {
          direction: "top",
          offset: [0, -radius],
          sticky: true,
        })
        .bindPopup(`
          <div style="font-family:sans-serif;min-width:150px">
            <strong>${p.label}</strong>
            <div style="margin-top:4px;font-size:12px">
              <span style="color:#ef4444;font-weight:700">${p.lost} perdu·e·s</span>
              <span style="color:#9ca3af"> · </span>
              <span style="color:#22c55e;font-weight:700">${p.found} trouvé·e·s</span>
            </div>
            <div style="margin-top:2px;font-size:12px;color:#6b7280">Total : ${total} · Restitués : ${p.returned || 0}</div>
          </div>`);
      m.addTo(map);
      markers.push([p.lat, p.lng]);
    });

    if (markers.length === 0) {
      map.setView([12.3714, -1.5197], 6);
    } else if (markers.length === 1) {
      map.setView(markers[0], 13);
    } else {
      map.fitBounds(leaflet.latLngBounds(markers).pad(0.15));
    }

    const invalidate = () => {
      if (mapRef.current) {
        setTimeout(() => mapRef.current?.invalidateSize(), 120);
      }
    };
    invalidate();

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [leaflet, points, fullscreen]);

  return (
    <div
      ref={containerRef}
      className={
        fullscreen
          ? "z-0 h-full w-full"
          : "z-0 h-72 w-full rounded-2xl overflow-hidden"
      }
    />
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
  const [myQuarter, setMyQuarter] = useState("");
  const [mapFullscreen, setMapFullscreen] = useState(false);

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
        setMyQuarter(json.scope.quarter || "");
        setSelCity("");
        setSelQuarter("");
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

  useEffect(() => {
    if (!mapFullscreen) return;
    const onKey = (e) => {
      if (e.key === "Escape") setMapFullscreen(false);
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [mapFullscreen]);

  const applyFilters = () => load(selCity, selQuarter);

  const filteredQuarters = useMemo(() => {
    if (!data) return [];
    return data.availableQuarters.filter((q) => (selCity ? q.city === selCity : true));
  }, [data, selCity]);

  const isFiltered = !!selCity || !!selQuarter;

  const mapPoints = useMemo(() => {
    if (!data) return [];
    const pts = [];
    const quarters = data?.byQuarter || [];
    if (quarters.length) {
      for (const q of quarters) {
        const coords = quarterCoords(q.city, q.quarter);
        if (!coords) continue;
        pts.push({
          lat: coords[0],
          lng: coords[1],
          label: `${q.quarter}${selCity ? "" : ` — ${q.city}`}`,
          total: q.total,
          lost: q.lost,
          found: q.found,
          returned: q.returned || 0,
        });
      }
    } else {
      for (const c of data?.byCity || []) {
        const coords = cityCoords(c.city);
        if (!coords) continue;
        pts.push({
          lat: coords[0],
          lng: coords[1],
          label: c.city,
          total: c.total,
          lost: c.lost,
          found: c.found,
          returned: c.returned || 0,
        });
      }
    }
    return pts;
  }, [data, selCity]);

  // Camembert : segments par admin (basés sur le total de déclarations)
  const adminPieSegments = useMemo(() => {
    if (!isMainAdmin || !data?.admins?.length) return [];
    const sorted = [...data.admins].sort(
      (a, b) => (b.declarations || 0) - (a.declarations || 0),
    );
    return sorted.map((a, i) => ({
      label: a.name || a.email || "Admin",
      value: a.declarations || 0,
      color: colorForAdmin(a, i),
    }));
  }, [data, isMainAdmin]);

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
  const catData = (data?.byCategory || []).map((c) => ({ ...c, __labelKey: "name" }));

  const totalAdminDecl = adminPieSegments.reduce((s, x) => s + x.value, 0);

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
          {isMainAdmin ? (
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
          ) : (
            <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm">
              <MapPin className="h-4 w-4 text-primary" />
              <span className="truncate font-bold">{myQuarter || myCity || "Ma zone"}</span>
            </div>
          )}
        </div>
        <button
          onClick={applyFilters}
          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground active:scale-[0.98]"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Mettre à jour
        </button>
        {!isMainAdmin && (
          <p className="mt-2 text-[10px] text-muted-foreground">
            Votre zone : <strong>{myQuarter ? `${myCity} · ${myQuarter}` : myCity || "—"}</strong> (données limitées à votre localité)
          </p>
        )}
        {isMainAdmin && isFiltered && (
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

      {/* ── Répartition par ville ── */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="mb-3 text-xs font-extrabold uppercase tracking-wide text-muted-foreground">
          Répartition par ville
        </p>
        {cityData.length === 0 ? (
          <p className="text-center text-xs text-muted-foreground py-4">Aucune donnée</p>
        ) : (
          <div className="space-y-3">
            {cityData.slice(0, 8).map((c) => (
              <DualBar key={c.city} item={c} />
            ))}
            <ChartLegend />
          </div>
        )}
      </div>

      {/* ── Quartiers / localités ── */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="mb-3 text-xs font-extrabold uppercase tracking-wide text-muted-foreground">
          {isFiltered ? `Quartiers de ${selCity || "la zone"}` : "Top quartiers / localités"}
        </p>
        {quarterData.length === 0 ? (
          <p className="text-center text-xs text-muted-foreground py-4">Aucune donnée</p>
        ) : (
          <div className="space-y-3">
            {quarterData.slice(0, 8).map((q) => (
              <DualBar key={q.city + q.quarter} item={q} />
            ))}
            <ChartLegend />
          </div>
        )}
      </div>

      {/* ── Carte de la zone ── */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <MapIcon className="h-4 w-4 text-primary" />
          <p className="text-xs font-extrabold uppercase tracking-wide text-muted-foreground">
            Carte : état réel par localité
          </p>
          <button
            type="button"
            onClick={() => setMapFullscreen(true)}
            className="ml-auto flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-1.5 text-[11px] font-bold text-primary active:scale-[0.97]"
            aria-label="Agrandir la carte"
          >
            <Maximize2 className="h-3.5 w-3.5" /> Agrandir
          </button>
        </div>
        <ZoneMap points={mapPoints} />
        <div className="mt-3 flex flex-wrap items-center gap-4 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Plus de trouvés</span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-destructive" /> Plus de perdus</span>
          <span className="ml-auto">Pointez les cercles pour voir les chiffres</span>
        </div>
      </div>

      {/* ── Par catégorie ── */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <Layers className="h-4 w-4 text-primary" />
          <p className="text-xs font-extrabold uppercase tracking-wide text-muted-foreground">
            Statistiques par catégorie
          </p>
        </div>
        {catData.length === 0 ? (
          <p className="text-center text-xs text-muted-foreground py-4">Aucune donnée</p>
        ) : (
          <div className="space-y-3">
            {catData.map((c) => (
              <DualBar key={c.slug} item={c} />
            ))}
            <ChartLegend />
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

      {/* ── Vue admin principal : zones des administrateurs (bar chart + camembert) ── */}
      {isMainAdmin && data?.admins?.length > 0 && (
        <>
          {/* Bar chart vertical */}
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 mb-1">
              <Coins className="h-4 w-4 text-accent" />
              <p className="text-xs font-extrabold uppercase tracking-wide text-muted-foreground">
                Zones des administrateurs
              </p>
            </div>
            <p className="mb-4 text-[10px] text-muted-foreground">
              Vue globale des données de chaque zone gérée par un admin.
            </p>

            {/* Totaux consolidés */}
            <div className="mb-4 grid grid-cols-4 gap-2">
              {[
                {
                  l: "Perdus",
                  v: data.admins.reduce((s, a) => s + (a.lost || 0), 0),
                  c: "text-destructive",
                  bg: "bg-destructive/10",
                },
                {
                  l: "Trouvés",
                  v: data.admins.reduce((s, a) => s + (a.found || 0), 0),
                  c: "text-emerald-600 dark:text-emerald-400",
                  bg: "bg-emerald-500/10",
                },
                {
                  l: "Corresp.",
                  v: data.admins.reduce((s, a) => s + (a.matches || 0), 0),
                  c: "text-accent",
                  bg: "bg-accent/10",
                },
                {
                  l: "PV",
                  v: data.admins.reduce((s, a) => s + (a.pvs || 0), 0),
                  c: "text-primary",
                  bg: "bg-primary/10",
                },
              ].map((s) => (
                <div key={s.l} className={`rounded-xl ${s.bg} p-2 text-center`}>
                  <p className={`text-lg font-extrabold tabular-nums ${s.c}`}>{s.v}</p>
                  <p className="text-[9px] font-semibold text-muted-foreground">{s.l}</p>
                </div>
              ))}
            </div>

            <AdminBarChart admins={data.admins} />
          </div>

          {/* Camembert de répartition globale */}
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 mb-3">
              <Layers className="h-4 w-4 text-primary" />
              <p className="text-xs font-extrabold uppercase tracking-wide text-muted-foreground">
                Répartition globale des déclarations
              </p>
            </div>
            <p className="mb-3 text-[10px] text-muted-foreground">
              Part de chaque administrateur dans le volume total de déclarations.
            </p>
            {adminPieSegments.length === 0 ? (
              <p className="text-center text-xs text-muted-foreground py-4">Aucune donnée</p>
            ) : (
              <PieChart
                segments={adminPieSegments}
                size={170}
                centerLabel="déclarations"
                centerValue={totalAdminDecl}
              />
            )}
          </div>
        </>
      )}

      {/* ── Overlay plein écran de la carte ── */}
      {mapFullscreen && (
        <div className="fixed inset-0 z-[1000] flex flex-col bg-background">
          <div className="flex items-center gap-3 border-b border-border bg-card px-4 py-3">
            <MapIcon className="h-4 w-4 text-primary" />
            <p className="text-xs font-extrabold uppercase tracking-wide text-muted-foreground">
              Carte : état réel par localité
            </p>
            <button
              type="button"
              onClick={() => setMapFullscreen(false)}
              className="ml-auto flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-1.5 text-[11px] font-bold text-foreground active:scale-[0.97]"
              aria-label="Réduire la carte"
            >
              <Minimize2 className="h-3.5 w-3.5" /> Réduire
            </button>
            <button
              type="button"
              onClick={() => setMapFullscreen(false)}
              className="flex items-center justify-center rounded-xl border border-border bg-background p-2 text-foreground active:scale-[0.97]"
              aria-label="Fermer la carte"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="relative flex-1">
            <ZoneMap points={mapPoints} fullscreen />
          </div>

          <div className="flex flex-wrap items-center gap-4 border-t border-border bg-card px-4 py-2 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Plus de trouvés</span>
            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-destructive" /> Plus de perdus</span>
            <span className="ml-auto">Pointez les cercles pour voir les chiffres · Échap pour fermer</span>
          </div>
        </div>
      )}
    </div>
  );
}