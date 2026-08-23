/**
 * Client-side document image detection via Canvas analysis.
 * Detects CNI, Passeport, Permis, Carte grise from uploaded photos.
 * Returns { isDocument, confidence, docType, reasons }
 */

const DOC_RATIOS = {
  cni:        { min: 1.48, max: 1.68, label: "CNI" },
  passport:   { min: 1.32, max: 1.48, label: "Passeport" },
  permis:     { min: 1.48, max: 1.68, label: "Permis" },
  carte_grise: { min: 1.42, max: 1.72, label: "Carte grise" },
};

const loadToCanvas = (src, maxW = 600) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const scale = img.width > maxW ? maxW / img.width : 1;
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, w, h);
      resolve({ canvas, ctx, w, h, img });
    };
    img.onerror = reject;
    img.src = typeof src === "string" ? src : URL.createObjectURL(src);
  });

const getPixels = (ctx, w, h) => {
  const data = ctx.getImageData(0, 0, w, h).data;
  const pixels = [];
  for (let i = 0; i < data.length; i += 4) {
    pixels.push([data[i], data[i + 1], data[i + 2]]);
  }
  return pixels;
};

const analyzeImage = (pixels, w, h) => {
  const total = pixels.length;

  /* 1. Aspect ratio check */
  const ratio = w / h;
  let matchedRatio = null;
  for (const [key, cfg] of Object.entries(DOC_RATIOS)) {
    if (ratio >= cfg.min && ratio <= cfg.max) {
      matchedRatio = { key, ...cfg };
      break;
    }
  }

  /* 2. Edge density (Sobel-like) */
  let edgeCount = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = (y * w + x) * 4;
      const idxR = (y * w + x + 1) * 4;
      const idxD = ((y + 1) * w + x) * 4;
      const gx = Math.abs(pixels[idxR / 4]?.[0] - pixels[idx / 4]?.[0]) || 0;
      const gy = Math.abs(pixels[idxD / 4]?.[0] - pixels[idx / 4]?.[0]) || 0;
      if (gx + gy > 60) edgeCount++;
    }
  }
  const edgeDensity = edgeCount / total;

  /* 3. Color variance — documents have low variance (uniform bg) */
  let rSum = 0, gSum = 0, bSum = 0;
  for (const p of pixels) {
    rSum += p[0]; gSum += p[1]; bSum += p[2];
  }
  const rAvg = rSum / total, gAvg = gSum / total, bAvg = bSum / total;
  let variance = 0;
  for (const p of pixels) {
    variance += Math.abs(p[0] - rAvg) + Math.abs(p[1] - gAvg) + Math.abs(p[2] - bAvg);
  }
  variance = variance / total;

  /* 4. Dominant color detection */
  const dominant = rAvg > gAvg && rAvg > bAvg ? "red" :
                   bAvg > rAvg && bAvg > gAvg ? "blue" :
                   gAvg > rAvg && gAvg > bAvg ? "green" : "neutral";

  /* 5. Horizontal line density (text rows) */
  let horizontalLines = 0;
  const scanY = Math.floor(h * 0.3);
  const scanH = Math.floor(h * 0.4);
  for (let y = scanY; y < scanY + scanH; y++) {
    let transitions = 0;
    for (let x = 1; x < w; x++) {
      const idx1 = (y * w + x - 1) * 4;
      const idx2 = (y * w + x) * 4;
      const diff = Math.abs(pixels[idx2 / 4]?.[0] - pixels[idx1 / 4]?.[0]) +
                   Math.abs(pixels[idx2 / 4]?.[1] - pixels[idx1 / 4]?.[1]) +
                   Math.abs(pixels[idx2 / 4]?.[2] - pixels[idx1 / 4]?.[2]);
      if (diff > 80) transitions++;
    }
    if (transitions > w * 0.15) horizontalLines++;
  }
  const textDensity = horizontalLines / scanH;

  /* 6. White/bright pixel percentage (documents often have white backgrounds) */
  let brightPixels = 0;
  for (const p of pixels) {
    if (p[0] > 200 && p[1] > 200 && p[2] > 200) brightPixels++;
  }
  const brightRatio = brightPixels / total;

  return {
    ratio,
    matchedRatio,
    edgeDensity,
    variance,
    dominant,
    textDensity,
    brightRatio,
  };
};

export const detectDocument = async (imageSource) => {
  try {
    const { canvas, ctx, w, h } = await loadToCanvas(imageSource);
    const pixels = getPixels(ctx, w, h);
    const analysis = analyzeImage(pixels, w, h);

    const reasons = [];
    let score = 0;

    /* Aspect ratio — strong signal */
    if (analysis.matchedRatio) {
      score += 35;
      reasons.push(`Format ${analysis.matchedRatio.label} (${analysis.ratio.toFixed(2)}:1)`);
    }

    /* Edge density — documents have structured edges */
    if (analysis.edgeDensity > 0.03 && analysis.edgeDensity < 0.15) {
      score += 20;
      reasons.push("Bords structurés");
    }

    /* Low variance = uniform background like a document */
    if (analysis.variance < 50) {
      score += 15;
      reasons.push("Fond uniforme");
    }

    /* Text density — documents have text rows */
    if (analysis.textDensity > 0.1) {
      score += 15;
      reasons.push("Lignes de texte détectées");
    }

    /* Bright background */
    if (analysis.brightRatio > 0.25) {
      score += 10;
      reasons.push("Fond clair");
    }

    /* Specific color hints */
    if (analysis.dominant === "blue" && analysis.brightRatio > 0.15) {
      score += 5;
      reasons.push("Dominante bleue (CNI possible)");
    }

    const isDocument = score >= 50;
    let docType = "unknown";

    if (isDocument && analysis.matchedRatio) {
      docType = analysis.matchedRatio.key;
    }

    return {
      isDocument,
      confidence: Math.min(score, 100),
      docType,
      reasons,
      analysis,
    };
  } catch {
    return { isDocument: false, confidence: 0, docType: "unknown", reasons: [], analysis: null };
  }
};
