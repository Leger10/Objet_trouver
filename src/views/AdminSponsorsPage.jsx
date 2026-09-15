import React, { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Loader2, Plus, Save, Trash2, GripVertical, Megaphone } from "lucide-react";
import { pb } from "@/lib/supabaseClient";
import Layout from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";

const card = "rounded-2xl border border-border bg-card p-5";
const field =
  "w-full rounded-xl border border-input bg-background px-4 py-3 text-sm outline-none focus:border-primary";
const label = "block text-sm font-semibold mb-1.5";
import env from '@/lib/env';
const SUPABASE_URL = env.VITE_SUPABASE_URL;

const EMPTY_BANNER = {
  title: "",
  subtitle: "",
  image_url: "",
  logo_file: "",
  link_url: "",
  cta_text: "En savoir plus",
  bg_from: "#001F3F",
  bg_to: "#1B4332",
  accent_color: "#FFD60A",
  position: 0,
  active: true,
};

const AdminSponsorsPage = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [banners, setBanners] = useState([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await pb.collection("sponsor_banners").getFullList({ sort: "position" });
        setBanners(data || []);
      } catch {
        setBanners([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const setBanner = (idx, key, value) => {
    setBanners((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [key]: value };
      return copy;
    });
  };

  const addBanner = () => {
    setBanners((prev) => [
      ...prev,
      { ...EMPTY_BANNER, id: `new-${Date.now()}`, position: prev.length },
    ]);
  };

  const removeBanner = (idx) => {
    setBanners((prev) => prev.filter((_, i) => i !== idx));
  };

  const moveBanner = (idx, dir) => {
    setBanners((prev) => {
      const copy = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= copy.length) return prev;
      [copy[idx], copy[target]] = [copy[target], copy[idx]];
      copy.forEach((b, i) => (b.position = i));
      return copy;
    });
  };

  const onLogoPick = async (idx, e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      toast.error("Fichier image requis");
      return;
    }
    if (f.size > 2 * 1024 * 1024) {
      toast.error("Logo trop volumineux (max 2 Mo)");
      return;
    }

    const bannerId = banners[idx].id;
    const isExisting = bannerId && !String(bannerId).startsWith("new-");

    if (isExisting) {
      try {
        const ext = f.name.split(".").pop() || "png";
        const fileName = `logo-${Date.now()}.${ext}`;
        const path = `sponsors/${bannerId}/${fileName}`;
        await pb.files.upload("branding", path, f);
        setBanner(idx, "logo_file", fileName);
        toast.success("Logo uploadé");
      } catch (err) {
        toast.error("Upload échoué", { description: err?.message });
      }
    } else {
      const ext = f.name.split(".").pop() || "png";
      const fileName = `logo-${Date.now()}.${ext}`;
      setBanner(idx, "logo_file", fileName);
      setBanner(idx, "_logoFile", f);
      toast.message("Logo prêt — enregistrez pour confirmer");
    }
  };

  const resolveLogo = (b) => {
    if (b.logo_file && b.id && !String(b.id).startsWith("new-")) {
      return `${SUPABASE_URL}/storage/v1/object/public/branding/sponsors/${b.id}/${b.logo_file}`;
    }
    if (b.image_url) return b.image_url;
    return "";
  };

  const save = async () => {
    setBusy(true);
    try {
      for (let i = 0; i < banners.length; i++) {
        const b = banners[i];
        const payload = {
          title: b.title || "",
          subtitle: b.subtitle || "",
          image_url: b.image_url || "",
          logo_file: b.logo_file || "",
          link_url: b.link_url || "",
          cta_text: b.cta_text || "En savoir plus",
          bg_from: b.bg_from || "#001F3F",
          bg_to: b.bg_to || "#1B4332",
          accent_color: b.accent_color || "#FFD60A",
          position: i,
          active: !!b.active,
        };

        let saved;
        if (b.id && !String(b.id).startsWith("new-")) {
          saved = await pb.collection("sponsor_banners").update(b.id, payload);
        } else {
          saved = await pb.collection("sponsor_banners").create(payload);
        }

        if (b._logoFile && saved?.id) {
          try {
            const ext = b._logoFile.name.split(".").pop() || "png";
            const fileName = `logo-${Date.now()}.${ext}`;
            const path = `sponsors/${saved.id}/${fileName}`;
            await pb.files.upload("branding", path, b._logoFile);
            await pb.collection("sponsor_banners").update(saved.id, { logo_file: fileName });
          } catch (err) {
            console.warn("Logo upload failed:", err);
          }
        }
      }

      const data = await pb.collection("sponsor_banners").getFullList({ sort: "position" });
      setBanners(data || []);
      toast.success("Bannières sponsor enregistrées");
    } catch (e) {
      toast.error("Erreur", { description: e?.message || "Échec" });
    } finally {
      setBusy(false);
    }
  };

  const deleteAll = async () => {
    if (!confirm("Supprimer toutes les bannières ?")) return;
    setBusy(true);
    try {
      for (const b of banners) {
        if (b.id && !String(b.id).startsWith("new-")) {
          await pb.collection("sponsor_banners").delete(b.id);
        }
      }
      setBanners([]);
      toast.success("Toutes les bannières supprimées");
    } catch (e) {
      toast.error("Erreur", { description: e?.message });
    } finally {
      setBusy(false);
    }
  };

  if (!isAdmin) {
    return (
      <Layout>
        <div className="mx-auto max-w-md px-4 py-20 text-center">
          <Megaphone className="mx-auto h-10 w-10 text-destructive" />
          <p className="mt-4 text-lg font-bold">Accès réservé aux administrateurs</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <Helmet>
        <title>Bannières sponsor — Admin</title>
      </Helmet>

      <div className="mx-auto w-full max-w-3xl px-4 py-8">
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-primary text-primary-foreground">
              <Megaphone className="h-6 w-6" />
            </span>
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold">Bannières sponsor</h1>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Annonces animées sur la page d&apos;accueil
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
              {banners.map((b, idx) => (
                <div key={b.id} className={card + " !p-4"}>
                  <div className="flex items-center gap-2 mb-3">
                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-extrabold text-muted-foreground">#{idx + 1}</span>
                    <div className="ml-auto flex items-center gap-1">
                      <button onClick={() => moveBanner(idx, -1)} disabled={idx === 0} className="rounded-lg px-2 py-1 text-xs font-bold hover:bg-muted disabled:opacity-30">↑</button>
                      <button onClick={() => moveBanner(idx, 1)} disabled={idx === banners.length - 1} className="rounded-lg px-2 py-1 text-xs font-bold hover:bg-muted disabled:opacity-30">↓</button>
                      <label className="flex items-center gap-1.5 ml-2 cursor-pointer">
                        <input type="checkbox" checked={!!b.active} onChange={(e) => setBanner(idx, "active", e.target.checked)} className="h-4 w-4 rounded" />
                        <span className="text-[11px] font-bold text-muted-foreground">Actif</span>
                      </label>
                      <button onClick={() => removeBanner(idx)} className="ml-2 rounded-lg p-1.5 text-destructive hover:bg-destructive/10">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <label className={label}>Titre</label>
                      <input className={field} value={b.title} onChange={(e) => setBanner(idx, "title", e.target.value)} placeholder="Nom du sponsor" />
                    </div>
                    <div className="sm:col-span-2">
                      <label className={label}>Sous-titre</label>
                      <input className={field} value={b.subtitle} onChange={(e) => setBanner(idx, "subtitle", e.target.value)} placeholder="Description courte" />
                    </div>
                    <div className="sm:col-span-2">
                      <label className={label}>Logo du sponsor (upload)</label>
                      <input type="file" accept="image/*" onChange={(e) => onLogoPick(idx, e)} className="block w-full text-sm" />
                      <p className="mt-1 text-[10px] text-muted-foreground">PNG, JPG, SVG — max 2 Mo. Remplace l&apos;URL image si renseigné.</p>
                    </div>
                    <div className="sm:col-span-2">
                      <label className={label}>Ou URL image/logo</label>
                      <input className={field} value={b.image_url} onChange={(e) => setBanner(idx, "image_url", e.target.value)} placeholder="https://..." />
                    </div>
                    <div className="sm:col-span-2">
                      <label className={label}>Lien du sponsor</label>
                      <input className={field} value={b.link_url} onChange={(e) => setBanner(idx, "link_url", e.target.value)} placeholder="https://..." />
                    </div>
                    <div>
                      <label className={label}>Texte bouton</label>
                      <input className={field} value={b.cta_text} onChange={(e) => setBanner(idx, "cta_text", e.target.value)} />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className={label}>Fond #1</label>
                        <input type="color" value={b.bg_from} onChange={(e) => setBanner(idx, "bg_from", e.target.value)} className="h-11 w-full cursor-pointer rounded-lg border border-input bg-background p-1" />
                      </div>
                      <div>
                        <label className={label}>Fond #2</label>
                        <input type="color" value={b.bg_to} onChange={(e) => setBanner(idx, "bg_to", e.target.value)} className="h-11 w-full cursor-pointer rounded-lg border border-input bg-background p-1" />
                      </div>
                      <div>
                        <label className={label}>Accent</label>
                        <input type="color" value={b.accent_color} onChange={(e) => setBanner(idx, "accent_color", e.target.value)} className="h-11 w-full cursor-pointer rounded-lg border border-input bg-background p-1" />
                      </div>
                    </div>
                  </div>

                  {/* Preview */}
                  <div className="mt-3 rounded-xl overflow-hidden">
                    <div className="flex items-center gap-3 p-3" style={{ background: `linear-gradient(135deg, ${b.bg_from}, ${b.bg_to})` }}>
                      {resolveLogo(b) && (
                        <img src={resolveLogo(b)} alt="" className="h-14 w-14 shrink-0 rounded-lg object-contain bg-white/10 p-0.5" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-[9px] font-bold uppercase tracking-wider text-white/50">Partenaire</p>
                        <p className="text-sm font-extrabold text-white leading-tight">{b.title || "Titre"}</p>
                        {b.subtitle && <p className="text-[10px] text-white/60 truncate">{b.subtitle}</p>}
                        {b.link_url && (
                          <span className="mt-1 inline-block rounded-lg px-3 py-1 text-[10px] font-extrabold" style={{ background: b.accent_color, color: b.bg_from }}>
                            {b.cta_text || "En savoir plus"}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <button onClick={addBanner} className="flex items-center gap-2 rounded-xl border border-dashed border-border px-4 py-3 text-sm font-bold hover:bg-muted">
                <Plus className="h-4 w-4" /> Ajouter une bannière
              </button>
              <button onClick={save} disabled={busy} className="flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-extrabold text-primary-foreground disabled:opacity-60">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Enregistrer
              </button>
              {banners.length > 0 && (
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

export default AdminSponsorsPage;
