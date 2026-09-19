// Référentiel approximatif des villes et quartiers du Burkina Faso.
// Les coordonnées sont des valeurs indicatives pour le rendu cartographique.

export const CITY_COORDS = {
  "Ouagadougou":        [12.3714, -1.5197],
  "Bobo-Dioulasso":     [11.1771, -4.2979],
  "Koudougou":          [12.2550, -2.3627],
  "Ouahigouya":         [13.5828, -2.4216],
  "Kaya":               [13.0917, -1.0844],
  "Banfora":            [10.6305, -4.7598],
  "Fada N'Gourma":      [12.0616, 0.3586],
  "Fada N’Gourma":      [12.0616, 0.3586],
  "Tenkodogo":          [11.7800, -0.3697],
  "Dédougou":           [12.4634, -3.4608],
  "Gaoua":              [10.2992, -3.2508],
  "Koupéla":            [12.1789, -0.3517],
  "Manga":              [11.6638, -1.0731],
  "Ziniaré":            [12.5819, -1.2972],
  "Orodara":            [10.9571, -4.9200],
  "Zorgho":             [12.2467, -0.6153],
  "Réo":                [12.3194, -2.4708],
  "Nouna":              [12.7333, -3.8667],
  "Dori":               [14.0354, -0.0339],
  "Gorom-Gorom":        [14.4490, -0.2090],
  "Kongoussi":          [13.3258, -1.5347],
  "Yako":               [12.9572, -2.2606],
  "Boussé":             [12.6608, -1.8931],
  "Léo":                [11.1003, -2.0961],
  "Pô":                 [11.1667, -1.1500],
  "Boulsa":             [12.6667, -0.5667],
  "Djibo":              [14.0994, -1.6317],
  "Tougan":             [13.0667, -3.0667],
  "Solenzo":            [12.1833, -4.0833],
  "Houndé":             [11.5000, -3.5167],
  "Bogandé":            [12.9667, -0.1500],
  "Bittou":             [11.2500, -0.3167],
  "Garango":            [11.8000, -0.5333],
  "Kombissiri":         [12.0667, -1.3333],
  "Pouytenga":          [12.2500, -0.4167],
  "Niangoloko":         [10.2833, -4.9167],
  "Sindou":             [10.6500, -5.1833],
  "Boromo":             [11.7500, -2.9333],
  "Dano":               [11.1667, -3.0667],
  "Diébougou":          [10.8500, -3.2500],
  "Zabrè":              [11.1833, -0.6333],
};

export const QUARTER_COORDS = {
  "Ouagadougou": {
    "Centre-ville": [12.3650, -1.5250],
    "Karpala":      [12.3300, -1.5000],
    "Rood Woko":    [12.3850, -1.5150],
    "Stade":        [12.3670, -1.5200],
    "Gounghin":     [12.3500, -1.5350],
    "Pissy":        [12.3950, -1.5500],
    "Tanghin":      [12.4200, -1.5200],
    "Dassasgho":    [12.3550, -1.5050],
    "Cissin":       [12.3800, -1.4750],
    "Bilbalogho":   [12.3400, -1.5450],
    "Wemtenga":     [12.3750, -1.4900],
    "Koulouba":     [12.3600, -1.5280],
    "Zogona":       [12.3700, -1.5120],
    "Boulmiougou":  [12.3400, -1.5200],
    "Nonsin":       [12.3450, -1.5100],
    "Dapoya":       [12.3620, -1.5350],
    "Zone du Bois": [12.3780, -1.5450],
  },
  "Bobo-Dioulasso": {
    "Centre-ville": [11.1800, -4.2950],
    "Accart-Ville": [11.1801, -4.3100],
    "Sansan":       [11.1700, -4.2900],
    "Toumousseni":  [11.1650, -4.2750],
    "Ouest":        [11.1750, -4.3050],
    "Secteur":      [11.1771, -4.2979],
  },
};

function hashCode(s) {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function norm(s) {
  return (s || "").trim();
}

// Coordonnées d'un quartier dans une ville : connues → répertoire,
// sinon centre ville avec un léger décalage déterministe (pour le pointé).
export function quarterCoords(city, quarter) {
  const c = norm(city);
  const q = norm(quarter);
  const cityCoord = CITY_COORDS[c] || CITY_COORDS[Object.keys(CITY_COORDS).find((k) => k.toLowerCase() === c.toLowerCase())];
  if (!cityCoord || !q) return cityCoord || null;
  const known = QUARTER_COORDS[c] && QUARTER_COORDS[c][q];
  if (known) return known;
  const h = hashCode(q);
  const lat = cityCoord[0] + ((h % 100) - 50) / 3000;
  const lng = cityCoord[1] + (((h >> 4) % 100) - 50) / 3000;
  return [lat, lng];
}

export function cityCoords(city) {
  const c = norm(city);
  return CITY_COORDS[c] || CITY_COORDS[Object.keys(CITY_COORDS).find((k) => k.toLowerCase() === c.toLowerCase())] || null;
}