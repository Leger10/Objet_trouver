import React, { useEffect, useState, useRef } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Loader2, Plus, Save, Trash2, GripVertical, Image } from "lucide-react";
import { pb } from "@/lib/supabaseClient";
import Layout from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";

const card = "rounded-2xl border border-border bg-card p-5";
const field =
  "w-full rounded-xl border border-input bg-background px-4 py-3 text-sm outline-none focus:border-primary";
const label = "block text-sm font-semibold mb-1.5";
import env from '@/lib/env';
const SUPABASE_URL = env.VITE_SUPABASE_URL;

const EMPTY = {
  title: "",
  subtitle: "",
  image_url: "",
  file_name: "",
  link_url: "",
  position: 0,
  active: true,
};

const AdminHeroPage = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const fileRefs = useRef({});

  useEffect(() => {
    (async () => {
      try {
        const data = await pb.collection("hero_images").getFullList({ sort: "position" });
        setItems(data || []);
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const setItem = (idx, key, value) => {
    setItems((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [key]: value };
      return copy;
    });
  };

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      { ...EMPTY, id: `new-${Date.now()}`, position: prev.length },
    ]);
  };

  const removeItem = (idx) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const moveItem = (idx, dir) => {
    setItems((prev) => {
      const copy = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= copy.length) return prev;
      [copy[idx], copy[target]] = [copy[target], copy[idx]];
      copy.forEach((b, i) => (b.position = i));
      return copy;
    });
  };

  const onFilePick = async (idx, e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      toast.error("Fichier image requis");
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      toast.error("Image trop volumineuse (max 5 Mo)");
      return;
    }

    const itemId = items[idx].id;
    const isExisting = itemId && !String(itemId).startsWith("new-");
    const ext = f.name.split(".").pop() || "jpg";
    const fileName = `hero-${Date.now()}.${ext}`;

    if (isExisting) {
      try {
        const path = `heroes/${itemId}/${fileName}`;
        await pb.files.upload("branding", path, f);
        setItem(idx, "file_name", fileName);
        toast.success("Image uploadée");
      } catch (err) {
        toast.error("Upload échoué", { description: err?.message });
      }
    } else {
      setItem(idx, "file_name", fileName);
      setItem(idx, "_file", f);
      toast.message("Image prête — enregistrez pour confirmer");
    }
  };

  const save = async () => {
    setBusy(true);
    try {
      for (let i = 0; i < items.length; i++) {
        const h = items[i];
        const payload = {
          title: h.title || "",
          subtitle: h.subtitle || "",
          image_url: h.image_url || "",
          file_name: h.file_name || "",
          link_url: h.link_url || "",
          position: i,
          active: !!h.active,
        };

        let itemToSave;
        if (h.id && !String(h.id).startsWith("new-")) {
          itemToSave = await pb.collection("hero_images").update(h.id, payload);
        } else {
          itemToSave = await pb.collection("hero_images").create(payload);
        }

        if (h._file && itemToSave?.id) {
          try {
            const ext = h._file.name.split(".").pop() || "jpg";
            const fn = h.file_name || `hero-${Date.now()}.${ext}`;
            const path = `heroes/${itemToSave.id}/${fn}`;
            await pb.files.upload("branding", path, h._file);
            await pb.collection("hero_images").update(itemToSave.id, {
              file_name: fn,
            });
          } catch (err) {
            console.warn("Upload failed:", err);
          }
        }
      }

      const data = await pb.collection("hero_images").getFullList({ sort: "position" });
      setItems(data || []);
      toast.success("Images hero enregistrées");
    } catch (e) {
      toast.error("Erreur", { description: e?.message || "Échec" });
    } finally {
      setBusy(false);
    }
  };

  const deleteAll = async () => {
    if (!confirm("Supprimer toutes les images hero ?")) return;
    setBusy(true);
    try {
      for (const h of items) {
        if (h.id && !String(h.id).startsWith("new-")) {
          await pb.collection("hero_images").delete(h.id);
        }
      }
      setItems([]);
      toast.success("Toutes les images supprimées");
    } catch (e) {
      toast.error("Erreur", { description: e?.message });
    } finally {
      setBusy(false);
    }
  };

  const resolvePreview = (h) => {
    if (h.file_name && h.id && !String(h.id).startsWith("new-")) {
      return `${SUPABASE_URL}/storage/v1/object/public/branding/heroes/${h.id}/${h.file_name}`;
    }
    if (h.image_url) return h.image_url;
    return "";
  };

  if (!isAdmin) {
    return (
      <Layout>
        <div className="mx-auto max-w-md px-4 py-20 text-center">
          <Image className="mx-auto h-10 w-10 text-destructive" />
          <p className="mt-4 text-lg font-bold">Accès réservé aux administrateurs</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <Helmet>
        <title>Images Hero — Admin</title>
      </Helmet>

      <div className="mx-auto w-full max-w-3xl px-4 py-8">
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-primary text-primary-foreground">
              <Image className="h-6 w-6" />
            </span>
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold">Images Hero</h1>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Images qui défilent en bannière sur la page d&apos;accueil
              </p>
            </div>
          </div>
          <Link to="/admin" className="text-sm font-bold text-primary underline underline-offset-4">
            ← Admin
          </Link>
        </div>

        {loading ? (
          <div className="mt-10 grid place-items-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <div className="mt-6 space-y-4">
              {items.map((h, idx) => (
                <div key={h.id} className={card + " !p-4"}>
                  <div className="flex items-center gap-2 mb-3">
                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-extrabold text-muted-foreground">#{idx + 1}</span>
                    <div className="ml-auto flex items-center gap-1">
                      <button
                        onClick={() => moveItem(idx, -1)}
                        disabled={idx === 0}
                        className="rounded-lg px-2 py-1 text-xs font-bold hover:bg-muted disabled:opacity-30"
                      >↑</button>
                      <button
                        onClick={() => moveItem(idx, 1)}
                        disabled={idx === items.length - 1}
                        className="rounded-lg px-2 py-1 text-xs font-bold hover:bg-muted disabled:opacity-30"
                      >↓</button>
                      <label className="flex items-center gap-1.5 ml-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!h.active}
                          onChange={(e) => setItem(idx, "active", e.target.checked)}
                          className="h-4 w-4 rounded"
                        />
                        <span className="text-[11px] font-bold text-muted-foreground">Actif</span>
                      </label>
                      <button
                        onClick={() => removeItem(idx)}
                        className="ml-2 rounded-lg p-1.5 text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <label className={label}>Titre (optionnel)</label>
                      <input className={field} value={h.title} onChange={(e) => setItem(idx, "title", e.target.value)} placeholder="Titre de l'image" />
                    </div>
                    <div className="sm:col-span-2">
                      <label className={label}>Sous-titre (optionnel)</label>
                      <input className={field} value={h.subtitle} onChange={(e) => setItem(idx, "subtitle", e.target.value)} placeholder="Description" />
                    </div>
                    <div className="sm:col-span-2">
                      <label className={label}>Ou URL de l&apos;image</label>
                      <input className={field} value={h.image_url} onChange={(e) => setItem(idx, "image_url", e.target.value)} placeholder="https://..." />
                    </div>
                    <div className="sm:col-span-2">
                      <label className={label}>Ou téléverser une image</label>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => onFilePick(idx, e)}
                        className="block w-full text-sm"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className={label}>Lien au clic (optionnel)</label>
                      <input className={field} value={h.link_url} onChange={(e) => setItem(idx, "link_url", e.target.value)} placeholder="https://..." />
                    </div>
                  </div>

                  {resolvePreview(h) && (
                    <div className="mt-3 relative h-32 overflow-hidden rounded-xl bg-muted">
                      <img src={resolvePreview(h)} alt="" className="h-full w-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                      {h.title && (
                        <div className="absolute bottom-2 left-2 right-2 text-xs font-bold text-white">
                          {h.title}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <button onClick={addItem} className="flex items-center gap-2 rounded-xl border border-dashed border-border px-4 py-3 text-sm font-bold hover:bg-muted">
                <Plus className="h-4 w-4" /> Ajouter une image
              </button>
              <button onClick={save} disabled={busy} className="flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-extrabold text-primary-foreground disabled:opacity-60">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Enregistrer
              </button>
              {items.length > 0 && (
                <button onClick={deleteAll} disabled={busy} className="flex items-center gap-2 rounded-xl border border-destructive/40 px-4 py-3 text-sm font-bold text-destructive hover:bg-destructive/5">
                  <Trash2 className="h-4 w-4" /> Tout supprimer
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </Layout>
  );
};

export default AdminHeroPage;
