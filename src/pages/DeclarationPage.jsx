import React, { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  CalendarDays,
  Flag,
  Lock,
  MapPin,
  ShieldCheck,
  Sparkles,
  ArrowLeft,
  Tag,
  ChevronRight,
  Eye,
  EyeOff,
  AlertTriangle,
  CheckCircle2,
  CircleDot,
  Info,
  Layers,
  X,
  ZoomIn,
  Pencil,
  Trash2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { pb } from "@/lib/supabaseClient";
import Layout from "@/components/Layout";
import AdSlot from "@/components/AdSlot";
import { useAuth } from "@/contexts/AuthContext";
import { maskId, notify, notifyAdminsOfClaim } from "@/lib/retrouve";
import EtiquetteDecl from "@/components/EtiquetteDecl";
import MatchComparison from "@/components/MatchComparison";
import { useBranding } from "@/contexts/BrandingContext";

const DOCUMENT_SLUGS = new Set(["cni", "passeport", "permis", "carte-grise"]);

const field =
  "w-full rounded-2xl border border-white/20 bg-white/10 backdrop-blur-md px-4 py-3.5 text-sm text-white placeholder-white/40 outline-none focus:border-white/40 focus:ring-2 focus:ring-white/20";

const fadeIn = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
};

const stagger = {
  animate: { transition: { staggerChildren: 0.08 } },
};

const DeclarationPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAuthed, isAdmin } = useAuth();
  const { branding } = useBranding();
  const [item, setItem] = useState(null);
  const [linkedPV, setLinkedPV] = useState(null);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [claim, setClaim] = useState({ proof_note: "" });
  const [sent, setSent] = useState(false);
  const [reported, setReported] = useState(false);
  const [revealedFields, setRevealedFields] = useState(new Set());
  const [photoRevealed, setPhotoRevealed] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    pb.collection("declarations")
      .getOne(id, { expand: "category", requestKey: `decl-${id}` })
      .then(async (decl) => {
        setItem(decl);
        if (decl.kind === "found") {
          try {
            const pvs = await pb.collection("pvs").getFullList({
              filter: pb.filter('declaration_id = {:d} && type = "deposit"', { d: decl.id }),
              sort: "-created",
              requestKey: `decl-pv-${decl.id}`,
            });
            if (pvs.length > 0) setLinkedPV(pvs[0]);
          } catch (_) {}
        }
        try {
          const [lostMatches, foundMatches] = await Promise.all([
            pb.collection("matches").getFullList({
              sort: "-score",
              expand: "lost,found",
              filter: pb.filter('lost = {:id}', { id: decl.id }),
              requestKey: `decl-m-lost-${decl.id}`,
            }).catch(() => []),
            pb.collection("matches").getFullList({
              sort: "-score",
              expand: "lost,found",
              filter: pb.filter('found = {:id}', { id: decl.id }),
              requestKey: `decl-m-found-${decl.id}`,
            }).catch(() => []),
          ]);
          const seen = new Set();
          const all = [...lostMatches, ...foundMatches].filter((m) => {
            if (seen.has(m.id)) return false;
            seen.add(m.id);
            return true;
          });
          all.sort((a, b) => (b.score || 0) - (a.score || 0));
          setMatches(all);
        } catch (_) {}
      })
      .catch(() => setError("Déclaration introuvable ou retirée."))
      .finally(() => setLoading(false));
  }, [id]);

  const submitClaim = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await pb.collection("claims").create({
        declaration: item.id,
        claimant: user.id,
        security_answer: claim.proof_note,
        status: "pending",
      });
      await notifyAdminsOfClaim(item, user?.city || "");
      setSent(true);
    } catch (err) {
      setError(err?.message || "La demande n'a pas pu être envoyée.");
    }
  };

  const report = async () => {
    try {
      await pb.collection("reports").create({
        reporter: user.id,
        declaration: item.id,
        reason: "Signalement utilisateur : contenu suspect ou frauduleux.",
        status: "open",
      });
      setReported(true);
    } catch (_) {
      setReported(true);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await pb.collection("declarations").delete(item.id);
      toast.success("Déclaration supprimée");
      navigate("/tableau-de-bord");
    } catch (err) {
      setError(err?.message || "Suppression impossible.");
      setDeleting(false);
      setShowDeleteModal(false);
    }
  };

  /* ─── Loading skeleton ─── */
  if (loading) {
    return (
      <Layout>
        <Helmet>
          <title>Chargement — {branding?.app_name || "RetrouveMoi"}</title>
        </Helmet>
        <div className="relative h-[52vh] min-h-[360px] w-full bg-muted animate-pulse" />
        <div className="mx-auto w-full max-w-lg px-4 -mt-20 relative z-10 space-y-4 pb-24">
          <div className="h-40 animate-pulse rounded-3xl bg-muted/80" />
          <div className="h-24 animate-pulse rounded-3xl bg-muted/60" />
          <div className="h-24 animate-pulse rounded-3xl bg-muted/60" />
        </div>
      </Layout>
    );
  }

  /* ─── Not found ─── */
  if (!item) {
    return (
      <Layout>
        <Helmet>
          <title>Introuvable — {branding?.app_name || "RetrouveMoi"}</title>
        </Helmet>
        <div className="mx-auto w-full max-w-lg px-4 py-20 text-center">
          <div className="rounded-3xl border border-border bg-card p-8 shadow-sm">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-muted/60">
              <AlertTriangle className="h-7 w-7 text-muted-foreground" />
            </div>
            <p className="mt-4 text-lg font-extrabold">{error || "Déclaration introuvable."}</p>
            <Link
              to="/rechercher"
              className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 active:scale-[0.98]"
            >
              <ArrowLeft className="h-4 w-4" /> Retour à la recherche
            </Link>
          </div>
        </div>
      </Layout>
    );
  }

  const photo = item.photo
    ? pb.files.getURL(item, item.photo)
    : item.photo_url || null;
  const isOwner = user?.id === item.owner;
  const isLost = item.kind === "lost";
  const hasPriority =
    item.priority && item.priority_until && new Date(item.priority_until).getTime() > Date.now();

  const catSlug = item.expand?.category?.slug || "";
  const isDocumentCategory = DOCUMENT_SLUGS.has(catSlug);
  const isDocumentPhoto = item.is_document_photo === true;
  const canViewDoc = isOwner || isAdmin;
  const photoBlurred = (isDocumentCategory && !canViewDoc) || (isDocumentPhoto && !canViewDoc && !photoRevealed);

  const toggleReveal = (key) => {
    setRevealedFields((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const allRevealed = isDocumentPhoto && !isDocumentCategory && revealedFields.size >= 4;

  const isPersonCategory = ["enfant-disparu", "personne-disparue"].includes(catSlug);

  const detailItems = [
    { key: "name", icon: "👤", label: "Nom", value: item.person_name || "Non communiqué", show: true },
    { key: "sex", icon: "⚧", label: "Sexe", value: item.person_sex === "M" ? "Masculin" : item.person_sex === "F" ? "Féminin" : "—", show: isPersonCategory },
    { key: "age", icon: "🎂", label: "Âge", value: item.person_age || "—", show: isPersonCategory },
    { key: "brand", icon: "🏷️", label: "Marque", value: item.brand || "—", show: !isPersonCategory },
    { key: "color", icon: "🎨", label: "Couleur", value: item.color || "—", show: !isPersonCategory },
    { key: "descPhys", icon: "📋", label: "Description physique", value: item.brand || "—", show: isPersonCategory },
    { key: "doc", icon: "🔢", label: "ID document", value: item.doc_last4 || "—", show: !isPersonCategory },
  ].filter((d) => d.show);

  const statusConfig = {
    open: { label: "En cours", color: "from-blue-500 to-blue-600", text: "text-white", dot: "bg-white" },
    matched: { label: "Match trouvé", color: "from-purple-500 to-purple-600", text: "text-white", dot: "bg-white" },
    depose: { label: "Objet déposé", color: "from-amber-500 to-orange-500", text: "text-white", dot: "bg-white" },
    returned: { label: "Restitué", color: "from-emerald-500 to-green-600", text: "text-white", dot: "bg-white" },
    blocked: { label: "Bloqué", color: "from-red-600 to-red-700", text: "text-white", dot: "bg-white" },
  };

  const st = statusConfig[item.status] || statusConfig.open;

  return (
    <Layout>
      <Helmet>
        <title>{`${item.title} — ${branding?.app_name || "RetrouveMoi"}`}</title>
        <meta
          name="description"
          content={`Déclaration ${isLost ? "de perte" : "de découverte"} à ${item.city} sur ${branding?.app_name || "RetrouveMoi"}.`}
        />
      </Helmet>

      {/* ════════════ DELETE MODAL ════════════ */}
      <AnimatePresence>
        {showDeleteModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6"
            onClick={() => { if (!deleting) setShowDeleteModal(false); }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-sm rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 to-slate-800 p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-red-500/15 mb-4">
                <Trash2 className="h-7 w-7 text-red-400" />
              </div>
              <h3 className="text-lg font-extrabold text-white text-center">Supprimer cette déclaration ?</h3>
              <p className="mt-2 text-sm text-white/50 text-center">
                Cette action est irréversible. Toutes les correspondances liées seront also supprimées.
              </p>
              <div className="mt-6 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(false)}
                  disabled={deleting}
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5 text-sm font-bold text-white/70 hover:bg-white/10 active:scale-[0.98] transition-all disabled:opacity-40"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-red-500 to-red-600 px-4 py-3.5 text-sm font-extrabold text-white shadow-lg shadow-red-500/25 active:scale-[0.98] transition-all disabled:opacity-40"
                >
                  {deleting ? (
                    <><span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Suppression…</>
                  ) : (
                    <><Trash2 className="h-4 w-4" /> Supprimer</>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ════════════ LIGHTBOX ════════════ */}
      <AnimatePresence>
        {lightboxOpen && photo && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] bg-black/95 flex items-center justify-center"
            onClick={() => setLightboxOpen(false)}
          >
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              type="button"
              onClick={() => setLightboxOpen(false)}
              className="absolute top-4 right-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 backdrop-blur-md text-white"
            >
              <X className="h-5 w-5" />
            </motion.button>
            <motion.img
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              src={photo}
              alt={item.title}
              className="max-h-[90vh] max-w-[95vw] rounded-xl object-contain shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ════════════ HERO PHOTO ════════════ */}
      <div
        className="relative h-[48vh] min-h-[320px] max-h-[520px] w-full overflow-hidden"
        onClick={() => {
          if (photoBlurred) return;
          if (photo) setLightboxOpen(true);
        }}
        style={photo ? { cursor: photoBlurred ? "default" : "zoom-in" } : undefined}
      >
        {photo ? (
          <img
            src={photo}
            alt={item.title}
            className={`absolute inset-0 h-full w-full object-cover transition-all duration-500 ${
              photoBlurred ? "blur-xl scale-105" : ""
            }`}
          />
        ) : (
          <div
            className={`absolute inset-0 bg-gradient-to-br ${
              isLost ? "from-red-700 via-red-600 to-amber-600" : "from-emerald-700 via-emerald-600 to-teal-500"
            }`}
          />
        )}

        {/* Gradient overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-transparent" />

        {/* Document blur overlay */}
        {photoBlurred && photo && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute inset-0 z-10 flex flex-col items-center justify-center"
          >
            <div className="rounded-3xl bg-black/50 backdrop-blur-xl px-6 py-5 text-center shadow-2xl border border-white/10">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-white/10 mb-3">
                <Lock className="h-7 w-7 text-white/80" />
              </div>
              <p className="text-sm font-extrabold text-white">
                Document officiel protégé
              </p>
              <p className="mt-1 text-xs text-white/50 max-w-[220px]">
                Seul le propriétaire peut consulter cette image
              </p>
            </div>
          </motion.div>
        )}

        {/* Zoom hint — only when revealed */}
        {!photoBlurred && photo && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-black/40 backdrop-blur-md">
              <ZoomIn className="h-5 w-5 text-white" />
            </div>
          </div>
        )}

        {/* Top nav bar */}
        <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 pt-4 pb-2 safe-area-top">
          <Link
            to="/rechercher"
            className="flex h-11 w-11 items-center justify-center rounded-2xl bg-black/30 backdrop-blur-md text-white active:scale-95 transition-transform"
            onClick={(e) => e.stopPropagation()}
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex items-center gap-2">
            {isOwner || isAdmin ? (
              <>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); navigate(`/declarer/modifier/${item.id}`); }}
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/20 backdrop-blur-md text-blue-300 hover:bg-blue-500/30 active:scale-95 transition-all"
                  title="Modifier"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setShowDeleteModal(true); }}
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-500/20 backdrop-blur-md text-red-300 hover:bg-red-500/30 active:scale-95 transition-all"
                  title="Supprimer"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </>
            ) : null}
            {hasPriority && (
              <span className="flex items-center gap-1 rounded-full bg-amber-500/90 backdrop-blur-md px-3 py-1.5 text-[11px] font-extrabold text-white shadow-lg">
                <Sparkles className="h-3 w-3" /> BOOST
              </span>
            )}
            <span className={`flex items-center gap-1.5 rounded-full bg-gradient-to-r ${st.color} px-3 py-1.5 text-[11px] font-extrabold ${st.text} shadow-lg`}>
              <span className={`h-1.5 w-1.5 rounded-full ${st.dot} animate-pulse`} />
              {st.label}
            </span>
          </div>
        </div>

        {/* Bottom title overlay */}
        <div className="absolute bottom-0 left-0 right-0 z-20 px-5 pb-6">
          <motion.div {...fadeIn} transition={{ delay: 0.2 }}>
            <div className="mb-2 flex items-center gap-2">
              <span
                className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-widest ${
                  isLost
                    ? "bg-red-500/20 text-red-300 ring-1 ring-red-500/30"
                    : "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/30"
                }`}
              >
                {isLost ? "🔍 PERDU" : "✅ RETROUVÉ"}
              </span>
              <span className="text-[11px] text-white/60 font-bold">
                {item.expand?.category?.name || "Objet"}
              </span>
            </div>
            <h1 className="text-2xl font-extrabold text-white leading-tight tracking-tight">
              {item.title}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-white/70">
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {item.city}{item.zone ? `, ${item.zone}` : ""}
              </span>
              {item.event_date && (
                <span className="flex items-center gap-1">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {new Date(item.event_date).toLocaleDateString("fr-FR", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              )}
            </div>
          </motion.div>
        </div>
      </div>

      {/* ════════════ CONTENT ════════════ */}
      <div className="relative -mt-4 z-10 mx-auto w-full max-w-lg px-4 pb-28">
        <motion.div variants={stagger} initial="initial" animate="animate" className="space-y-4">

          {/* ── Document privacy banner ── */}
          {(isDocumentCategory || isDocumentPhoto) && (
            <motion.div
              {...fadeIn}
              className="rounded-3xl border border-blue-500/20 bg-blue-500/5 p-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-start gap-3">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-blue-500/15">
                    <Lock className="h-4.5 w-4.5 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-blue-300">
                      {isDocumentCategory ? "Document officiel" : "Document scanné"}
                    </p>
                    <p className="mt-1 text-xs text-blue-400/70 leading-relaxed">
                      {isDocumentCategory
                        ? "Image et données permanentement protégées — réservé au propriétaire et aux administrateurs."
                        : `Image analysée — type détecté : ${item.doc_photo_type || "document"}`}
                    </p>
                  </div>
                </div>
                {canViewDoc && !isDocumentCategory && isDocumentPhoto && (
                  <button
                    type="button"
                    onClick={() => {
                      if (allRevealed) {
                        setRevealedFields(new Set());
                      } else {
                        setRevealedFields(new Set(["name", "brand", "color", "doc"]));
                      }
                    }}
                    className="shrink-0 flex items-center gap-1.5 rounded-full bg-blue-500/20 px-3 py-1.5 text-[11px] font-bold text-blue-300 active:scale-95 transition-transform"
                  >
                    {allRevealed ? (
                      <><EyeOff className="h-3.5 w-3.5" /> Tout masquer</>
                    ) : (
                      <><Eye className="h-3.5 w-3.5" /> Tout révéler</>
                    )}
                  </button>
                )}
              </div>
            </motion.div>
          )}

          {/* ── Detail Cards ── */}
          <motion.div
            {...fadeIn}
            className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 to-slate-800 p-5 shadow-xl"
          >
            <div className="flex items-center gap-2 mb-4">
              <div className="grid h-8 w-8 place-items-center rounded-xl bg-white/10">
                <Layers className="h-4 w-4 text-white/70" />
              </div>
              <h2 className="text-sm font-extrabold text-white uppercase tracking-wider">Détails</h2>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {detailItems.map((d) => {
                const blurred = (isDocumentCategory || isDocumentPhoto) && !canViewDoc;
                return (
                  <div
                    key={d.key}
                    className={`relative rounded-2xl bg-white/5 p-3.5 ${
                      !blurred ? "cursor-pointer active:scale-[0.97]" : ""
                    }`}
                    onClick={() => { if (!blurred) setLightboxOpen(true); }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-white/40 uppercase tracking-wider">
                        {d.icon} {d.label}
                      </span>
                      {(isDocumentCategory || isDocumentPhoto) && (
                        <Lock className="h-3 w-3 text-blue-400/40" />
                      )}
                    </div>
                    <p
                      className={`mt-1.5 text-sm font-bold text-white truncate transition-all duration-300 ${
                        blurred ? "blur-md select-none" : ""
                      }`}
                    >
                      {d.value}
                    </p>
                    {blurred && (
                      <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-white/[0.02]">
                        <Lock className="h-4 w-4 text-white/20" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </motion.div>

          {/* ── Description ── */}
          {item.description && (
            <motion.div
              {...fadeIn}
              className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 to-slate-800 p-5 shadow-xl"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="grid h-8 w-8 place-items-center rounded-xl bg-white/10">
                    <Info className="h-4 w-4 text-white/70" />
                  </div>
                  <h2 className="text-sm font-extrabold text-white uppercase tracking-wider">Description</h2>
                </div>
                {(isDocumentCategory || isDocumentPhoto) && !canViewDoc && (
                  <Lock className="h-4 w-4 text-blue-400/40" />
                )}
              </div>
              <div className="relative">
                <p
                  className={`text-sm leading-relaxed text-white/70 whitespace-pre-line transition-all duration-300 ${
                    (isDocumentCategory || isDocumentPhoto) && !canViewDoc
                      ? "blur-md select-none" : ""
                  }`}
                >
                  {item.description}
                </p>
                {(isDocumentCategory || isDocumentPhoto) && !canViewDoc && (
                  <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-white/[0.02]">
                    <div className="flex flex-col items-center gap-1">
                      <Lock className="h-5 w-5 text-white/20" />
                      <span className="text-[10px] text-white/25 font-bold">
                        Document officiel protégé
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* ── PV Badge ── */}
          {linkedPV && item.kind === "found" && item.status !== "returned" && (
            <motion.div {...fadeIn}>
              <EtiquetteDecl pv={linkedPV} />
            </motion.div>
          )}

          {/* ── Security Notice ── */}
          <motion.div
            {...fadeIn}
            className="rounded-3xl border border-emerald-500/20 bg-emerald-500/5 p-4"
          >
            <div className="flex items-start gap-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-500/15">
                <ShieldCheck className="h-4.5 w-4.5 text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-emerald-300">Sécurité garantie</p>
                <p className="mt-1 text-xs text-emerald-400/70 leading-relaxed">
                  {(isDocumentCategory || isDocumentPhoto)
                    ? "Photo et données analysées automatiquement. Les informations sensibles sont protégées par floutage intelligent."
                    : "Les coordonnées du déclarant ne sont jamais publiques. La mise en relation se fait uniquement après vérification."}
                </p>
              </div>
            </div>
          </motion.div>

          {/* ── Matches ── */}
          {matches.length > 0 && (
            <motion.div {...fadeIn} className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="grid h-8 w-8 place-items-center rounded-xl bg-amber-500/15">
                  <Sparkles className="h-4 w-4 text-amber-400" />
                </div>
                <h2 className="text-sm font-extrabold text-white uppercase tracking-wider">
                  Correspondances ({matches.length})
                </h2>
              </div>
              {matches.map((m) => {
                const lostDecl = m.expand?.lost;
                const foundDecl = m.expand?.found;
                return (
                  <MatchComparison
                    key={m.id}
                    match={m}
                    lostDecl={lostDecl}
                    foundDecl={foundDecl}
                  />
                );
              })}
            </motion.div>
          )}

          {matches.length === 0 && !loading && (
            <motion.div
              {...fadeIn}
              className="rounded-3xl border border-dashed border-white/10 bg-white/5 p-6 text-center"
            >
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-white/5">
                <CircleDot className="h-6 w-6 text-white/20" />
              </div>
              <p className="mt-3 text-sm text-white/40">
                Aucune correspondance pour le moment.
              </p>
              <p className="mt-1 text-xs text-white/25">
                L&apos;algorithme continue de comparer en arrière-plan.
              </p>
            </motion.div>
          )}

          {/* ── Report ── */}
          {isAuthed && !isOwner && (
            <motion.button
              {...fadeIn}
              type="button"
              onClick={report}
              disabled={reported}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5 text-sm font-bold text-white/60 disabled:opacity-40 hover:bg-white/10 active:scale-[0.98] transition-all"
            >
              <Flag className="h-4 w-4" />
              {reported ? "Signalement transmis ✓" : "Signaler cette déclaration"}
            </motion.button>
          )}

          {/* ── Ad ── */}
          <AdSlot
            label="Partenaire"
            title="Assurez vos documents"
            cta="Découvrir"
          />

          {/* ── Contacter le propriétaire (carte intégrée) ── */}
          {item?.kind === "lost" && !isOwner && (
            <section {...fadeIn} className="rounded-3xl border border-dashed border-white/10 bg-white/5 p-4 text-center">
              <CircleDot className="mx-auto h-6 w-6 text-white/20" />
              <p className="mt-2 text-sm font-bold text-white/60">Objet égaré</p>
              <p className="mt-1 text-xs text-white/35 leading-relaxed">
                La restitution ne s&apos;applique qu&apos;aux objets retrouvés. Si vous avez trouvé cet objet, contactez l&apos;équipe {branding.app_name}.
              </p>
            </section>
          )}
          {item?.kind === "found" && !isOwner && (
            <section {...fadeIn} className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-4">
              {!isAuthed ? (
                <div className="text-center">
                  <p className="text-sm text-white/60">
                    Connectez-vous pour récupérer cet objet
                  </p>
                  <Link
                    to="/connexion"
                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary to-primary/80 px-6 py-4 text-sm font-extrabold text-primary-foreground shadow-lg shadow-primary/30 active:scale-[0.98] transition-transform"
                  >
                    <ShieldCheck className="h-4 w-4" />
                    Se connecter
                  </Link>
                </div>
              ) : sent ? (
                <div className="flex items-center gap-3 rounded-2xl bg-emerald-500/10 p-4">
                  <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-emerald-300">Demande envoyée !</p>
                    <p className="text-xs text-emerald-400/60">Le déclarant va vérifier votre réponse.</p>
                  </div>
                </div>
              ) : (
                <form onSubmit={submitClaim} className="space-y-3">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="grid h-8 w-8 place-items-center rounded-xl bg-amber-500/15">
                      <Lock className="h-4 w-4 text-amber-400" />
                    </div>
                    <div>
                      <p className="text-sm font-extrabold text-white">Contacter le propriétaire</p>
                      <p className="text-[11px] text-white/40">Expliquez pourquoi cet objet vous appartient</p>
                    </div>
                  </div>

                  <textarea
                    rows={3}
                    className={field}
                    placeholder="Précisez un détail que seul le propriétaire pourrait confirmer (lieu, circonstances, preuve…)"
                    value={claim.proof_note}
                    onChange={(e) => setClaim((c) => ({ ...c, proof_note: e.target.value }))}
                    required
                  />
                  <button
                    type="submit"
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-green-600 px-6 py-4 text-sm font-extrabold text-white shadow-lg shadow-emerald-500/25 active:scale-[0.98] transition-transform"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Demander la restitution
                  </button>
                  {error && (
                    <p className="rounded-xl bg-red-500/10 p-3 text-xs font-bold text-red-400">
                      {error}
                    </p>
                  )}
                </form>
              )}
            </section>
          )}
        </motion.div>
      </div>
    </Layout>
  );
};

export default DeclarationPage;
