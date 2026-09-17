import React, { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft,
  Camera,
  Loader2,
  MapPin,
  Phone,
  Save,
  Tag,
  AlertTriangle,
  FileText,
} from "lucide-react";
import { pb } from "@/lib/pbClient";
import Layout from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { useBranding } from "@/contexts/BrandingContext";
import CategoryGrid from "@/components/CategoryGrid";
import { CATEGORY_GROUPS, CATEGORY_META } from "@/lib/categories";

const field =
  "w-full rounded-xl border-2 border-input bg-background px-4 py-3 text-base outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring/20 placeholder:text-muted-foreground/50";
const labelCls = "flex flex-col gap-1.5 text-sm font-bold";
const card = "rounded-2xl border border-border/60 bg-card p-4 sm:p-5 shadow-sm";

const EditDeclarationPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const { branding } = useBranding();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [item, setItem] = useState(null);
  const [categories, setCategories] = useState([]);
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [removePhoto, setRemovePhoto] = useState(false);

  const [form, setForm] = useState({
    title: "",
    category: "",
    person_name: "",
    brand: "",
    color: "",
    city: "",
    zone: "",
    event_date: "",
    description: "",
    doc_number: "",
    phone: "",
    status: "",
  });

  useEffect(() => {
    pb.collection("categories")
      .getFullList({ sort: "position", requestKey: "cats-edit" })
      .then((cats) => {
        if (cats.length > 0) setCategories(cats);
        else throw new Error("empty");
      })
      .catch(() => {
        setCategories(
          CATEGORY_GROUPS.flatMap((g) =>
            g.slugs.map((slug, pos) => ({
              id: slug,
              slug,
              name: CATEGORY_META[slug]?.label || slug,
              position: pos,
            }))
          )
        );
      });
  }, []);

  useEffect(() => {
    pb.collection("declarations")
      .getOne(id, { expand: "category", requestKey: `edit-${id}` })
      .then((decl) => {
        setItem(decl);
        setForm({
          title: decl.title || "",
          category: decl.category || "",
          person_name: decl.person_name || "",
          brand: decl.brand || "",
          color: decl.color || "",
          city: decl.city || "",
          zone: decl.zone || "",
          event_date: decl.event_date || "",
          description: decl.description || "",
          doc_number: decl.doc_last4 ? `****${decl.doc_last4}` : "",
          phone: decl.phone || "",
          status: decl.status || "open",
        });
        if (decl.photo_url) setPhotoPreview(decl.photo_url);
      })
      .catch(() => setError("Déclaration introuvable."))
      .finally(() => setLoading(false));
  }, [id]);

  const set = (k) => (e) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const handlePhoto = (e) => {
    const file = e.target.files?.[0] || null;
    setPhoto(file);
    setRemovePhoto(false);
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setPhotoPreview(ev.target.result);
      reader.readAsDataURL(file);
    } else {
      setPhotoPreview(item?.photo_url || null);
    }
  };

  const isOwner = user?.id === item?.owner;
  const canEdit = isOwner || isAdmin;

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.title || !form.city) {
      setError("Titre et ville sont obligatoires.");
      return;
    }
    setSaving(true);
    try {
      const digits = form.doc_number.replace(/\D/g, "").replace(/^\*+/, "");
      const payload = {
        title: form.title,
        category: form.category,
        person_name: form.person_name,
        brand: form.brand,
        color: form.color,
        city: form.city,
        zone: form.zone,
        event_date: form.event_date || null,
        description: form.description,
        doc_last4: digits ? digits.slice(-4) : (item?.doc_last4 || ""),
        phone: form.phone,
        status: form.status,
      };

      if (photo) {
        const ext = photo.name?.split(".").pop() || "jpg";
        const fileName = `${Date.now()}.${ext}`;
        const { data: uploaded } = await pb.storage
          .from("uploads")
          .upload(fileName, photo, { cacheControl: "3600", upsert: false });
        if (uploaded) {
          const { data: urlData } = pb.storage
            .from("uploads")
            .getPublicUrl(uploaded.path);
          payload.photo_url = urlData?.publicUrl || "";
        }
      }

      if (removePhoto) {
        payload.photo_url = "";
      }

      await pb.collection("declarations").update(id, payload);
      toast.success("Déclaration mise à jour");
      navigate(`/objet/${id}`);
    } catch (err) {
      console.error("Erreur mise à jour:", err);
      setError(err?.message || "Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="mx-auto w-full max-w-lg px-4 py-10 space-y-4">
          <div className="h-10 w-40 animate-pulse rounded-xl bg-muted" />
          <div className="h-48 animate-pulse rounded-2xl bg-muted" />
          <div className="h-32 animate-pulse rounded-2xl bg-muted" />
        </div>
      </Layout>
    );
  }

  if (!item) {
    return (
      <Layout>
        <div className="mx-auto w-full max-w-lg px-4 py-20 text-center">
          <AlertTriangle className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-4 text-lg font-extrabold">Déclaration introuvable.</p>
          <Link to="/tableau-de-bord" className="mt-4 inline-block rounded-xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground">
            Retour
          </Link>
        </div>
      </Layout>
    );
  }

  if (!canEdit) {
    return (
      <Layout>
        <div className="mx-auto w-full max-w-lg px-4 py-20 text-center">
          <AlertTriangle className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-4 text-lg font-extrabold">Accès refusé.</p>
          <Link to={`/objet/${id}`} className="mt-4 inline-block rounded-xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground">
            Retour à la déclaration
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <Helmet>
        <title>Modifier — {item.title} — {branding?.app_name || "RetrouveMoi"}</title>
      </Helmet>

      <div className="mx-auto w-full max-w-lg px-4 py-5 pb-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex h-10 w-10 items-center justify-center rounded-2xl bg-muted active:scale-95 transition-transform"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-lg font-extrabold">Modifier la déclaration</h1>
            <p className="text-xs text-muted-foreground">
              {item.kind === "lost" ? "Perdu" : "Retrouvé"} — {item.expand?.category?.name || "Objet"}
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-xl bg-red-500/10 p-3 text-sm font-bold text-red-500">
            {error}
          </div>
        )}

        <form onSubmit={submit} className="grid gap-4">
          {/* ── Photo ── */}
          <div className={card}>
            <p className="flex items-center gap-2 text-sm font-extrabold tracking-tight mb-3">
              <Camera className="h-4 w-4 text-primary" /> Photo
            </p>
            {photoPreview && !removePhoto ? (
              <div className="relative">
                <img src={photoPreview} alt="Aperçu" className="h-40 w-full rounded-xl object-cover" />
                <button
                  type="button"
                  onClick={() => { setRemovePhoto(true); setPhotoPreview(null); setPhoto(null); }}
                  className="absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white text-xs"
                >
                  ✕
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border/60 bg-muted/30 p-6 cursor-pointer active:scale-[0.98]">
                <Camera className="h-8 w-8 text-muted-foreground/40" />
                <span className="text-xs text-muted-foreground font-bold">Ajouter une photo</span>
                <input type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
              </label>
            )}
          </div>

          {/* ── Titre & catégorie ── */}
          <div className={card}>
            <p className="flex items-center gap-2 text-sm font-extrabold tracking-tight mb-3">
              <FileText className="h-4 w-4 text-primary" /> Objet
            </p>
            <div className="grid gap-3">
              <label className={labelCls}>
                <span className="text-xs text-muted-foreground">Titre *</span>
                <input className={field} value={form.title} onChange={set("title")} placeholder="Ex : CNI OUEDRAOGO" required />
              </label>
              <label className={labelCls}>
                <span className="text-xs text-muted-foreground">Catégorie</span>
              </label>
              {categories.length > 0 && (
                <CategoryGrid
                  categories={categories}
                  selected={form.category || null}
                  onSelect={(c) => setForm((f) => ({ ...f, category: c.id }))}
                  size="sm"
                />
              )}
              <div className="grid grid-cols-2 gap-3">
                <label className={labelCls}>
                  <span className="text-xs text-muted-foreground">Nom</span>
                  <input className={field} value={form.person_name} onChange={set("person_name")} placeholder="Nom" />
                </label>
                <label className={labelCls}>
                  <span className="text-xs text-muted-foreground">Marque</span>
                  <input className={field} value={form.brand} onChange={set("brand")} placeholder="Marque" />
                </label>
              </div>
              <label className={labelCls}>
                <span className="text-xs text-muted-foreground">Couleur</span>
                <input className={field} value={form.color} onChange={set("color")} placeholder="Couleur" />
              </label>
              <label className={labelCls}>
                <span className="text-xs text-muted-foreground">Description</span>
                <textarea rows={3} className={field} value={form.description} onChange={set("description")} placeholder="Décrivez l'objet…" />
              </label>
            </div>
          </div>

          {/* ── Lieu ── */}
          <div className={card}>
            <p className="flex items-center gap-2 text-sm font-extrabold tracking-tight mb-3">
              <MapPin className="h-4 w-4 text-primary" /> Lieu
            </p>
            <div className="grid gap-3">
              <label className={labelCls}>
                <span className="text-xs text-muted-foreground">Ville *</span>
                <input className={field} value={form.city} onChange={set("city")} placeholder="Ouagadougou" required />
              </label>
              <label className={labelCls}>
                <span className="text-xs text-muted-foreground">Zone / quartier</span>
                <input className={field} value={form.zone} onChange={set("zone")} placeholder="Ex : Pissy" />
              </label>
              <label className={labelCls}>
                <span className="text-xs text-muted-foreground">Date</span>
                <input type="date" className={field} value={form.event_date} onChange={set("event_date")} />
              </label>
            </div>
          </div>

          {/* ── Contact ── */}
          <div className={card}>
            <p className="flex items-center gap-2 text-sm font-extrabold tracking-tight mb-3">
              <Phone className="h-4 w-4 text-primary" /> Contact
            </p>
            <label className={labelCls}>
              <span className="text-xs text-muted-foreground">Téléphone</span>
              <input className={field} value={form.phone} onChange={set("phone")} placeholder="+226 01 01 01 01" type="tel" />
            </label>
          </div>

          {/* ── Admin: statut ── */}
          {isAdmin && (
            <div className={card}>
              <p className="flex items-center gap-2 text-sm font-extrabold tracking-tight mb-3">
                <Tag className="h-4 w-4 text-primary" /> Statut (admin)
              </p>
              <label className={labelCls}>
                <select
                  className={field}
                  value={form.status}
                  onChange={set("status")}
                >
                  <option value="open">En cours</option>
                  <option value="matched">Match trouvé</option>
                  <option value="depose">Objet déposé</option>
                  <option value="returned">Restitué</option>
                  <option value="blocked">Bloqué</option>
                </select>
              </label>
            </div>
          )}

          {/* ── Submit ── */}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="rounded-2xl border-2 border-border px-5 py-3.5 text-sm font-bold active:scale-[0.98]"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-3.5 text-base font-extrabold text-primary-foreground transition-all active:scale-[0.98] disabled:opacity-40 shadow-lg shadow-primary/25"
            >
              {saving ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Save className="h-5 w-5" />
              )}
              {saving ? "Enregistrement…" : "Enregistrer"}
            </button>
          </div>
        </form>
      </div>
    </Layout>
  );
};

export default EditDeclarationPage;
