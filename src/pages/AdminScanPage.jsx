import React, { useEffect, useRef, useState, useCallback } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useNavigate } from "react-router-dom";
import {
  ScanLine,
  Search,
  ArrowLeft,
  FileText,
  Printer,
  Download,
  Calendar,
  MapPin,
  User,
  Box,
  CheckCircle2,
  XCircle,
  Loader2,
  Camera,
  CameraOff,
  Pen,
  Send,
  CheckCircle,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import { pb } from "@/lib/supabaseClient";
import Layout from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { useBranding } from "@/contexts/BrandingContext";
import {
  savePV,
  printPV,
  TYPE_LABELS,
  TYPE_BADGE,
  formatDateTimeFr,
  qrUrl,
} from "@/lib/pv";
import SearchableSelect from "@/components/SearchableSelect";
import { onCompleteRestitution } from "@/lib/notificationService";
import EtiquetteDecl from "@/components/EtiquetteDecl";

const card = "rounded-2xl border border-border bg-card p-5";
const inputCls =
  "w-full rounded-xl border border-input bg-background px-4 py-3 text-sm outline-none focus:border-primary transition placeholder:text-muted-foreground";

const AdminScanPage = () => {
  const { user } = useAuth();
  const { branding } = useBranding();
  const isAdmin = user?.role === "admin";
  const navigate = useNavigate();

  const [pvNumberInput, setPvNumberInput] = useState("");
  const [pvList, setPvList] = useState([]);
  const [foundPV, setFoundPV] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);
  const [scannerActive, setScannerActive] = useState(false);
  const [scannerError, setScannerError] = useState(null);
  const scannerRef = useRef(null);
  const scannerContainerRef = useRef(null);

  // Restitution workflow state
  const [restitutionMode, setRestitutionMode] = useState(false);
  const [restitutionDecl, setRestitutionDecl] = useState(null);
  const [restitutionForm, setRestitutionForm] = useState({
    signatoryName: "",
    signatoryFirstName: "",
    signatoryPhone: "",
    signatoryIdType: "CNI",
    signatoryIdNumber: "",
    conformObject: true,
    conformLossDeclaration: true,
    conformId: true,
    objectState: "",
    objectDistinctive: "",
    location: "Locaux RetrouveMoi",
  });
  const [signatureData, setSignatureData] = useState("");
  const [signing, setSigning] = useState(false);
  const [canvasRef, setCanvasRef] = useState(null);
  const [restitutionBusy, setRestitutionBusy] = useState(false);

  const lookupPV = useCallback(
    async (number) => {
      if (!number.trim()) return;
      setBusy(true);
      setFoundPV(null);
      setNotFound(false);
      try {
        const search = number.trim().toUpperCase();
        const res = await pb.collection("pvs").getFullList({
          filter: `pv_number = "${search}"`,
          requestKey: `scan-lookup-${search}`,
        });
        if (res.length > 0) {
          setFoundPV(res[0]);
          toast.success("PV trouvé", { description: res[0].pv_number });
        } else {
          setNotFound(true);
          toast.error("Aucun PV trouvé", { description: search });
        }
      } catch (e) {
        toast.error("Erreur de recherche", { description: e?.message });
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  const handleManualSearch = (e) => {
    e.preventDefault();
    lookupPV(pvNumberInput);
  };

  useEffect(() => {
    if (!isAdmin) return;
    pb.collection("pvs")
      .getFullList({ sort: "-created", fields: "id,pv_number,type,created", requestKey: "scan-pv-list" })
      .then((list) => setPvList(list))
      .catch(() => {});
  }, [isAdmin]);

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try { await scannerRef.current.stop(); } catch (_) {}
      try { scannerRef.current.clear(); } catch (_) {}
      scannerRef.current = null;
    }
    setScannerActive(false);
  }, []);

  const handleQRScan = useCallback(
    (decodedText) => {
      let pvNum = decodedText;
      try {
        const url = new URL(decodedText);
        const parts = url.pathname.split("/").filter(Boolean);
        pvNum = parts[parts.length - 1] || decodedText;
      } catch (_) {}
      const match = pvNum.match(/PV-[DR]-\d{8}-[A-Z0-9]+/i);
      if (match) {
        pvNum = match[0].toUpperCase();
      }
      setPvNumberInput(pvNum);
      stopScanner();
      toast.success("QR Code scanné", { description: pvNum });
      lookupPV(pvNum);
    },
    [lookupPV, stopScanner],
  );

  const handleQRScanRef = useRef(null);
  handleQRScanRef.current = handleQRScan;

  const startScanner = useCallback(async () => {
    setScannerError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        const isSecure = location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1";
        if (!isSecure) {
          setScannerError("La caméra nécessite HTTPS. Accédez à l'app via HTTPS (ex: ngrok) ou sur localhost.");
        } else {
          setScannerError("Aucun accès caméra disponible sur ce navigateur.");
        }
        setScannerActive(false);
        return;
      }

      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      } catch (_) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: true });
        } catch (e2) {
          if (e2?.name === "NotAllowedError" || e2?.name === "PermissionDeniedError") {
            setScannerError("Accès caméra refusé. Autorisez la caméra dans les paramètres de votre navigateur.");
          } else {
            setScannerError("Aucune caméra détectée. Vérifiez qu'une caméra est connectée.");
          }
          setScannerActive(false);
          return;
        }
      }

      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }

      const { Html5Qrcode } = await import("html5-qrcode");

      if (scannerRef.current) {
        try { await scannerRef.current.stop(); } catch (_) {}
        try { scannerRef.current.clear(); } catch (_) {}
        scannerRef.current = null;
      }

      if (!scannerContainerRef.current) {
        setScannerError("Zone de scan introuvable. Rafraîchissez la page.");
        return;
      }

      const onScan = (decodedText) => handleQRScanRef.current(decodedText);
      const scanConfig = { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 };

      let cameraId = null;
      try {
        const devices = await Html5Qrcode.getCameras();
        if (devices?.length) {
          const back = devices.find((d) =>
            /back|arrière|rear|environment/i.test(d.label),
          );
          cameraId = back ? back.id : devices[devices.length - 1].id;
        }
      } catch (_) {}

      const s = new Html5Qrcode("qr-scanner-area");
      const source = cameraId || { facingMode: "environment" };
      await s.start(source, scanConfig, onScan, () => {});
      scannerRef.current = s;
      setScannerActive(true);
    } catch (err) {
      const msg = err?.message || String(err) || "";
      if (msg.includes("NotAllowed") || msg.includes("Permission"))
        setScannerError("Caméra refusée. Autorisez l'accès dans les paramètres de votre navigateur.");
      else if (msg.includes("NotFound") || msg.includes("not found") || msg.includes("Requested device not found"))
        setScannerError("Aucune caméra détectée. Vérifiez qu'une caméra est connectée.");
      else
        setScannerError(`Caméra indisponible : ${msg.slice(0, 120)}`);
      setScannerActive(false);
    }
  }, []);

  useEffect(() => {
    return () => { stopScanner(); };
  }, [stopScanner]);

  // ── START RESTITUTION WORKFLOW ──
  const startRestitution = async (pv) => {
    if (pv.type !== "deposit") {
      toast.error("Seul un PV de dépôt peut déclencher une restitution");
      return;
    }
    // Load the associated declaration
    let decl = null;
    if (pv.declaration_id) {
      try {
        decl = await pb.collection("declarations").getOne(pv.declaration_id);
      } catch (_) {}
    }
    setRestitutionDecl(decl);
    setRestitutionForm((prev) => ({
      ...prev,
      signatoryName: decl?.person_name || "",
      objectCategory: decl?.category || "",
      objectDescription: decl?.description || decl?.title || "",
    }));
    setRestitutionMode(true);
    setSignatureData("");
  };

  // ── SIGNATURE CANVAS ──
  const SigCanvas = ({ onSign }) => {
    const canvasRef = useRef(null);
    const drawing = useRef(false);
    const lastPos = useRef(null);

    useEffect(() => {
      const c = canvasRef.current;
      if (!c) return;
      const ctx = c.getContext("2d");
      const rect = c.getBoundingClientRect();
      c.width = rect.width * 2;
      c.height = rect.height * 2;
      ctx.scale(2, 2);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, rect.width, rect.height);
      ctx.strokeStyle = "#1a1a1a";
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
    }, []);

    const getPos = (e) => {
      const c = canvasRef.current;
      const rect = c.getBoundingClientRect();
      const touch = e.touches?.[0] || e;
      return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top,
      };
    };

    const startDraw = (e) => {
      e.preventDefault();
      drawing.current = true;
      lastPos.current = getPos(e);
    };

    const draw = (e) => {
      if (!drawing.current) return;
      e.preventDefault();
      const c = canvasRef.current;
      const ctx = c.getContext("2d");
      const pos = getPos(e);
      ctx.beginPath();
      ctx.moveTo(lastPos.current.x, lastPos.current.y);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      lastPos.current = pos;
    };

    const endDraw = () => {
      drawing.current = false;
    };

    const clear = () => {
      const c = canvasRef.current;
      if (!c) return;
      const ctx = c.getContext("2d");
      const rect = c.getBoundingClientRect();
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, rect.width, rect.height);
      onSign("");
    };

    const save = () => {
      const c = canvasRef.current;
      if (!c) return;
      const data = c.toDataURL("image/png");
      onSign(data);
      toast.success("Signature enregistrée");
    };

    return (
      <div>
        <canvas
          ref={canvasRef}
          className="w-full h-32 rounded-xl border-2 border-dashed border-border bg-card dark:bg-muted cursor-crosshair touch-none"
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={endDraw}
        />
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={clear}
            className="rounded-xl border border-border px-3 py-1.5 text-xs font-bold"
          >
            Effacer
          </button>
          <button
            type="button"
            onClick={save}
            className="rounded-xl bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary"
          >
            Valider la signature
          </button>
        </div>
      </div>
    );
  };

  // ── COMPLETE RESTITUTION ──
  const completeRestitution = async () => {
    if (!restitutionForm.signatoryName.trim()) {
      toast.error("Nom du signataire requis");
      return;
    }
    if (!signatureData) {
      toast.error("La signature est requise");
      return;
    }
    setRestitutionBusy(true);
    try {
      // 1. Create restitution PV
      const pvRec = await savePV({
        type: "restitution",
        data: {
          ...restitutionForm,
          conformObject: restitutionForm.conformObject,
          conformLossDeclaration: restitutionForm.conformLossDeclaration,
          conformId: restitutionForm.conformId,
        },
        relatedDeclaration: restitutionDecl?.id || foundPV?.declaration_id || null,
        generatedBy: user.id,
        generatedByName: user.name || user.email || "",
      });

      // 2. Save signature
      try {
        await pb.collection("signatures").create({
          pv_id: pvRec.id,
          signer_name: `${restitutionForm.signatoryFirstName} ${restitutionForm.signatoryName}`,
          signature_data: signatureData,
        });
      } catch (_) {}

      // 3. Update deposit PV status
      try {
        await pb.collection("pvs").update(foundPV.id, {
          status: "restitution_done",
        });
      } catch (_) {}

      // 4. Complete restitution workflow (notifications + archiving)
      const decl = restitutionDecl || (foundPV?.declaration_id
        ? await pb.collection("declarations").getOne(foundPV.declaration_id).catch(() => null)
        : null);

      if (decl) {
        await onCompleteRestitution(pvRec, decl, null);
      }

      toast.success("Restitution enregistrée !", {
        description: `PV n°${pvRec.pv_number}`,
      });

      // Reset
      setRestitutionMode(false);
      setRestitutionDecl(null);
      setSignatureData("");
      setFoundPV(null);
      setPvNumberInput("");
    } catch (e) {
      toast.error("Erreur", { description: e?.message });
    } finally {
      setRestitutionBusy(false);
    }
  };

  if (!isAdmin) {
    return (
      <Layout>
        <Helmet>
          <title>Scanner un PV — {branding.app_name}</title>
        </Helmet>
        <div className="mx-auto max-w-md px-4 py-20 text-center">
          <ShieldAlert className="mx-auto h-10 w-10 text-destructive" />
          <p className="mt-4 text-lg font-bold">Accès réservé aux administrateurs</p>
          <Link to="/" className="mt-4 inline-block text-sm font-semibold text-primary">
            ← Retour
          </Link>
        </div>
      </Layout>
    );
  }

  // ── RESTITUTION FORM VIEW ──
  if (restitutionMode) {
    const rset = (k, v) => setRestitutionForm((p) => ({ ...p, [k]: v }));
    return (
      <Layout>
        <Helmet>
          <title>Restitution — {branding.app_name}</title>
        </Helmet>
        <div className="mx-auto max-w-lg px-4 py-6 pb-24">
          <div className="mb-6 flex items-center gap-3">
            <button
              onClick={() => { setRestitutionMode(false); setRestitutionDecl(null); }}
              className="rounded-xl border border-border bg-card p-2 active:scale-[0.96]"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-xl font-extrabold">PV de restitution</h1>
              <p className="text-xs text-muted-foreground">
                PV de dépôt : {foundPV?.pv_number}
              </p>
            </div>
          </div>

          {/* Declaration info */}
          {restitutionDecl && (
            <div className={`${card} mb-4 bg-primary/5 border-primary/20`}>
              <p className="text-xs font-bold text-primary">Déclaration correspondante</p>
              <p className="mt-1 text-sm font-semibold">{restitutionDecl.title}</p>
              <p className="text-xs text-muted-foreground">
                {restitutionDecl.city} · {restitutionDecl.kind === "lost" ? "Perdu" : "Retrouvé"}
              </p>
            </div>
          )}

          {/* Owner identity */}
          <div className={card}>
            <p className="mb-3 text-sm font-extrabold">Identité du propriétaire</p>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <input
                  className={inputCls}
                  placeholder="Nom *"
                  value={restitutionForm.signatoryName}
                  onChange={(e) => rset("signatoryName", e.target.value)}
                />
                <input
                  className={inputCls}
                  placeholder="Prénom"
                  value={restitutionForm.signatoryFirstName}
                  onChange={(e) => rset("signatoryFirstName", e.target.value)}
                />
              </div>
              <input
                className={inputCls}
                placeholder="Téléphone *"
                value={restitutionForm.signatoryPhone}
                onChange={(e) => rset("signatoryPhone", e.target.value)}
              />
              <div className="grid grid-cols-2 gap-3">
                <select
                  className={inputCls}
                  value={restitutionForm.signatoryIdType}
                  onChange={(e) => rset("signatoryIdType", e.target.value)}
                >
                  <option value="CNI">CNI</option>
                  <option value="Passeport">Passeport</option>
                  <option value="Permis">Permis</option>
                </select>
                <input
                  className={inputCls}
                  placeholder="N° pièce d'identité"
                  value={restitutionForm.signatoryIdNumber}
                  onChange={(e) => rset("signatoryIdNumber", e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Object verification */}
          <div className={`${card} mt-4`}>
            <p className="mb-3 text-sm font-extrabold">Vérification de l'objet</p>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-muted-foreground">État de l'objet</label>
                <input
                  className={`${inputCls} mt-1`}
                  placeholder="Ex: Bon état, rayures, etc."
                  value={restitutionForm.objectState}
                  onChange={(e) => rset("objectState", e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-bold text-muted-foreground">Marques distinctives</label>
                <input
                  className={`${inputCls} mt-1`}
                  placeholder="Ex: Gravure, stickers, etc."
                  value={restitutionForm.objectDistinctive}
                  onChange={(e) => rset("objectDistinctive", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                {[
                  { key: "conformObject", label: "Objet conforme au PV de dépôt" },
                  { key: "conformLossDeclaration", label: "Correspond à la déclaration de perte" },
                  { key: "conformId", label: "Identité vérifiée" },
                ].map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={restitutionForm[key]}
                      onChange={(e) => rset(key, e.target.checked)}
                      className="h-4 w-4 rounded accent-primary"
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Signature */}
          <div className={`${card} mt-4`}>
            <p className="mb-3 flex items-center gap-2 text-sm font-extrabold">
              <Pen className="h-4 w-4 text-primary" />
              Signature du propriétaire
            </p>
            {signatureData ? (
              <div className="space-y-2">
                <img src={signatureData} alt="Signature" className="h-20 rounded-xl border border-border" />
                <p className="text-xs text-green-600 dark:text-green-400 font-bold flex items-center gap-1">
                  <CheckCircle className="h-3.5 w-3.5" /> Signature enregistrée
                </p>
                <button
                  onClick={() => setSignatureData("")}
                  className="text-xs text-destructive font-bold"
                >
                  Refaire
                </button>
              </div>
            ) : (
              <SigCanvas onSign={setSignatureData} />
            )}
          </div>

          {/* Submit */}
          <button
            onClick={completeRestitution}
            disabled={restitutionBusy || !signatureData}
            className="mt-6 w-full rounded-2xl bg-primary py-4 text-base font-extrabold text-primary-foreground active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {restitutionBusy ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                <Send className="h-5 w-5" />
                Confirmer la restitution
              </>
            )}
          </button>
        </div>
      </Layout>
    );
  }

  // ── MAIN SCAN VIEW ──
  return (
    <Layout>
      <Helmet>
        <title>Scanner un PV — {branding.app_name}</title>
        <meta name="description" content="Rechercher ou scanner un procès-verbal par QR code ou numéro." />
      </Helmet>

      <div className="mx-auto max-w-2xl px-4 py-6 pb-24">
        <div className="mb-6 flex items-center gap-3">
          <button
            onClick={() => navigate("/admin")}
            className="rounded-xl border border-border bg-card p-2 active:scale-[0.96]"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-xl font-extrabold">Scanner un PV</h1>
            <p className="text-xs text-muted-foreground">
              Recherche par QR code ou numéro de procès-verbal
            </p>
          </div>
        </div>

        {/* QR Scanner */}
        <div className={card}>
          <div className="mb-4 flex items-center justify-between">
            <p className="flex items-center gap-2 text-sm font-extrabold">
              <Camera className="h-4 w-4 text-primary" />
              Scanner un code QR
            </p>
            <button
              type="button"
              onClick={scannerActive ? stopScanner : startScanner}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
                scannerActive
                  ? "bg-destructive/10 text-destructive"
                  : "bg-primary/10 text-primary"
              }`}
            >
              {scannerActive ? (
                <>
                  <CameraOff className="h-3.5 w-3.5" /> Arrêter
                </>
              ) : (
                <>
                  <Camera className="h-3.5 w-3.5" /> Activer la caméra
                </>
              )}
            </button>
          </div>

          <div
            ref={scannerContainerRef}
            className="relative overflow-hidden rounded-xl border border-border bg-muted/30"
          >
            <div id="qr-scanner-area" className="w-full min-h-[260px]" />
            {scannerActive && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="h-48 w-48 rounded-2xl border-2 border-primary/60 shadow-lg shadow-primary/20" />
              </div>
            )}
          </div>

          {scannerError && (
            <p className="mt-3 flex items-center gap-2 text-xs text-destructive">
              <XCircle className="h-3.5 w-3.5" /> {scannerError}
            </p>
          )}
        </div>

        {/* Manual search */}
        <div className={card}>
          <p className="mb-3 flex items-center gap-2 text-sm font-extrabold">
            <Search className="h-4 w-4 text-primary" />
            Recherche par numéro
          </p>
          <form onSubmit={handleManualSearch} className="flex gap-2">
            <input
              className={inputCls}
              value={pvNumberInput}
              onChange={(e) => setPvNumberInput(e.target.value.toUpperCase())}
              placeholder="PV-D-20260819-RERE"
              spellCheck={false}
              autoCapitalize="characters"
            />
            <button
              type="submit"
              disabled={!pvNumberInput.trim() || busy}
              className="shrink-0 rounded-xl bg-primary px-5 py-3 text-sm font-extrabold text-primary-foreground active:scale-[0.98] disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Rechercher"}
            </button>
          </form>
        </div>

        {/* Quick pick from list */}
        <div className={card}>
          <p className="mb-3 flex items-center gap-2 text-sm font-extrabold">
            <FileText className="h-4 w-4 text-primary" />
            Tous les PVs
          </p>
          <SearchableSelect
            placeholder="Sélectionner un PV existant…"
            value=""
            onChange={(val) => {
              if (val) {
                setPvNumberInput(val);
                lookupPV(val);
              }
            }}
            items={pvList.map((p) => ({
              value: p.pv_number,
              label: p.pv_number,
              sub: `${TYPE_LABELS[p.type] || p.type} · ${formatDateTimeFr(p.created)}`,
            }))}
          />
        </div>

        {/* Result */}
        {foundPV && (
          <PVResult pv={foundPV} onStartRestitution={startRestitution} />
        )}

        {notFound && (
          <div className={`${card} text-center`}>
            <XCircle className="mx-auto h-10 w-10 text-destructive/60" />
            <p className="mt-3 text-sm font-bold text-destructive">Aucun procès-verbal trouvé</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Vérifiez le numéro et réessayez
            </p>
          </div>
        )}
      </div>
    </Layout>
  );
};

/* ── PV Result Card ────────────────────────────────────────────────────────── */
const PVResult = ({ pv, onStartRestitution }) => {
  const d = pv.data || {};
  const isDeposit = pv.type === "deposit";

  return (
    <div className={`${card} mt-4 space-y-4`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className={`inline-block rounded-full px-3 py-1 text-xs font-bold ${TYPE_BADGE[pv.type] || "bg-muted text-muted-foreground"}`}>
            {TYPE_LABELS[pv.type] || pv.type}
          </span>
          <h2 className="mt-2 text-lg font-extrabold">{pv.pv_number}</h2>
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" /> {formatDateTimeFr(pv.created)}
          </p>
        </div>
        <img
          src={qrUrl(pv.pv_number)}
          alt="QR Code"
          className="h-16 w-16 rounded-lg border border-border"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {d.signatoryName && (
          <div className="rounded-xl bg-muted/50 p-3">
            <p className="flex items-center gap-1 text-[10px] font-bold uppercase text-muted-foreground">
              <User className="h-3 w-3" /> Signataire
            </p>
            <p className="mt-1 text-sm font-semibold">
              {d.signatoryName} {d.signatoryFirstName || ""}
            </p>
            {d.signatoryPhone && (
              <p className="text-xs text-muted-foreground">{d.signatoryPhone}</p>
            )}
          </div>
        )}

        {d.objectCategory && (
          <div className="rounded-xl bg-muted/50 p-3">
            <p className="flex items-center gap-1 text-[10px] font-bold uppercase text-muted-foreground">
              <Box className="h-3 w-3" /> Catégorie
            </p>
            <p className="mt-1 text-sm font-semibold">{d.objectCategory}</p>
          </div>
        )}

        {pv.location && (
          <div className="rounded-xl bg-muted/50 p-3">
            <p className="flex items-center gap-1 text-[10px] font-bold uppercase text-muted-foreground">
              <MapPin className="h-3 w-3" /> Lieu
            </p>
            <p className="mt-1 text-sm font-semibold">{pv.location}</p>
          </div>
        )}

        {d.objectFoundDate && (
          <div className="rounded-xl bg-muted/50 p-3">
            <p className="flex items-center gap-1 text-[10px] font-bold uppercase text-muted-foreground">
              <Calendar className="h-3 w-3" /> Date de découverte
            </p>
            <p className="mt-1 text-sm font-semibold">{formatDateTimeFr(d.objectFoundDate)}</p>
          </div>
        )}
      </div>

      {d.objectDescription && (
        <div>
          <p className="text-[10px] font-bold uppercase text-muted-foreground">Description</p>
          <p className="mt-1 text-sm leading-relaxed">{d.objectDescription}</p>
        </div>
      )}

      {!isDeposit && (
        <div>
          <p className="text-[10px] font-bold uppercase text-muted-foreground mb-2">Conformité</p>
          <div className="flex flex-wrap gap-2">
            {d.conformObject !== undefined && (
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${d.conformObject ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"}`}>
                {d.conformObject ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                Objet conforme
              </span>
            )}
            {d.conformLossDeclaration !== undefined && (
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${d.conformLossDeclaration ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"}`}>
                {d.conformLossDeclaration ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                Déclaration vérifiée
              </span>
            )}
            {d.conformId !== undefined && (
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${d.conformId ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"}`}>
                {d.conformId ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                Pièce d'identité
              </span>
            )}
          </div>
        </div>
      )}

      {/* Pickup etiquette for deposit PVs */}
      {isDeposit && (pv.data?.adminName || pv.location) && (
        <EtiquetteDecl pv={{ pv_number: pv.pv_number, location: pv.location, data: pv.data }} />
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        {isDeposit && pv.status !== "restitution_done" && (
          <button
            type="button"
            onClick={() => onStartRestitution(pv)}
            className="inline-flex items-center gap-2 rounded-xl bg-green-600 px-4 py-2.5 text-sm font-extrabold text-white dark:bg-green-500 active:scale-[0.98]"
          >
            <Pen className="h-4 w-4" /> Créer PV de restitution
          </button>
        )}
        {pv.status === "restitution_done" && (
          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-3 py-1.5 text-xs font-bold text-green-700 dark:bg-green-900/30 dark:text-green-400">
            <CheckCircle className="h-3.5 w-3.5" /> Restitué
          </span>
        )}
        <button
          type="button"
          onClick={() => printPV(pv)}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-extrabold text-primary-foreground active:scale-[0.98]"
        >
          <Printer className="h-4 w-4" /> Imprimer
        </button>
        <Link
          to={`/pv/${pv.pv_number}`}
          target="_blank"
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-bold active:scale-[0.98]"
        >
          <Download className="h-4 w-4" /> Ouvrir
        </Link>
      </div>
    </div>
  );
};

export default AdminScanPage;
