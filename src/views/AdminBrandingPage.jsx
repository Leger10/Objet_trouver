import React, { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Loader2, RotateCcw, Save, ShieldAlert, Palette, Image, Megaphone } from "lucide-react";
import { pb } from "@/lib/supabaseClient";
import Layout from "@/components/Layout";
import BrandLogo from "@/components/BrandLogo";
import { useAuth } from "@/contexts/AuthContext";
import { useBranding } from "@/contexts/BrandingContext";
import {
  BRANDING_DEFAULTS,
  DEFAULT_HERO,
  isHexColor,
  isValidEmail,
} from "@/lib/brandingDefaults";

const card = "rounded-2xl border border-border bg-card p-5";
const field =
  "w-full rounded-xl border border-input bg-background px-4 py-3 text-sm outline-none focus:border-primary";
const label = "block text-sm font-semibold mb-1.5";

const AdminBrandingPage = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const { branding, refresh, defaults } = useBranding();
  const [form, setForm] = useState({ ...BRANDING_DEFAULTS });
  const [logoFile, setLogoFile] = useState(null);
  const [heroFile, setHeroFile] = useState(null);
  const [heroPreview, setHeroPreview] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setForm({
      app_name: branding.app_name,
      logo_url: branding.logo_url,
      tagline: branding.tagline,
      color_red: branding.color_red,
      color_green: branding.color_green,
      color_blue: branding.color_blue,
      color_yellow: branding.color_yellow,
      color_white: branding.color_white,
      color_gray_light: branding.color_gray_light,
      color_gray_dark: branding.color_gray_dark,
      address: branding.address,
      phone: branding.phone,
      email: branding.email,
      hours: branding.hours,
      social_facebook: branding.social_facebook || "",
      social_twitter: branding.social_twitter || "",
      social_instagram: branding.social_instagram || "",
      social_whatsapp: branding.social_whatsapp || "",
      currency: branding.currency,
      language: branding.language,
      hero_image_url: branding.hero_image_url || "",
      hero_link: branding.hero_link || "",
      sponsor_name: branding.sponsor_name || "",
      sponsor_url: branding.sponsor_url || "",
      sponsor_tagline: branding.sponsor_tagline || "",
    });
    setPreviewUrl(branding.logo_url);
    setHeroPreview(branding.hero_image_url || "");
  }, [branding]);

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const onLogoPick = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      toast.error("Fichier image requis (PNG, JPG, WebP, SVG)");
      return;
    }
    if (f.size > 2 * 1024 * 1024) {
      toast.error("Logo trop volumineux (max 2 Mo)");
      return;
    }
    setLogoFile(f);
    setPreviewUrl(URL.createObjectURL(f));
  };

  const onHeroPick = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      toast.error("Fichier image requis (PNG, JPG, WebP)");
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      toast.error("Image trop volumineuse (max 5 Mo)");
      return;
    }
    setHeroFile(f);
    setHeroPreview(URL.createObjectURL(f));
  };

  const validate = () => {
    if (!form.app_name?.trim()) {
      toast.error("Nom de l'application requis");
      return false;
    }
    for (const k of [
      "color_red",
      "color_green",
      "color_blue",
      "color_yellow",
    ]) {
      if (!isHexColor(form[k])) {
        toast.error(`Couleur invalide (${k}) — format #RRGGBB`);
        return false;
      }
    }
    if (!isValidEmail(form.email)) {
      toast.error("Email de contact invalide");
      return false;
    }
    if (form.logo_url && !/^https?:\/\//i.test(form.logo_url) && !logoFile) {
      toast.error("URL du logo invalide (http/https)");
      return false;
    }
    return true;
  };

  const save = async () => {
    if (!validate()) return;
    setBusy(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => {
        if (k === "logo_url" && logoFile) return;
        if (k === "hero_image_url" && heroFile) return;
        fd.append(k, v ?? "");
      });
      if (logoFile) fd.append("logo_file", logoFile);
      if (heroFile) fd.append("hero_file", heroFile);

      if (branding.id) {
        await pb.collection("branding_settings").update(branding.id, fd);
      } else {
        // First create: create the row without files, then upload files via update
        const fdNoFiles = new FormData();
        for (const [k, v] of fd.entries()) {
          if (v instanceof File) continue;
          fdNoFiles.append(k, v);
        }
        const created = await pb.collection("branding_settings").create(fdNoFiles);
        // Now upload files if any
        if (created && (logoFile || heroFile)) {
          const fdFiles = new FormData();
          if (logoFile) fdFiles.append("logo_file", logoFile);
          if (heroFile) fdFiles.append("hero_file", heroFile);
          await pb.collection("branding_settings").update(created.id, fdFiles);
        }
      }

      // Notify admins
      try {
        const admins = await pb.collection("users").getFullList({
          filter: "role = 'admin'",
          requestKey: "branding-admins",
        });
        await Promise.all(
          admins.map((a, i) =>
            pb.collection("notifications").create(
              {
                user: a.id,
                title: "Branding mis à jour",
                body: `${user?.name || user?.email || "Admin"} a enregistré les paramètres de marque.`,
                link: "/admin/branding",
                read: false,
              },
              { requestKey: `brand-notif-${i}` },
            ),
          ),
        );
      } catch (_) {
        /* ignore notif errors */
      }

      setLogoFile(null);
      setHeroFile(null);
      await refresh();
      toast.success("Branding enregistré");
    } catch (e) {
      toast.error("Enregistrement impossible", {
        description: e?.message || "Erreur",
      });
    } finally {
      setBusy(false);
    }
  };

  const resetDefaults = () => {
    setForm({ ...defaults });
    setLogoFile(null);
    setHeroFile(null);
    setPreviewUrl(defaults.logo_url);
    setHeroPreview(defaults.hero_image_url || "");
    toast.message("Valeurs par défaut chargées", {
      description: "Cliquez sur Enregistrer pour appliquer.",
    });
  };

  if (!isAdmin) {
    return (
      <Layout>
        <Helmet>
          <title>Branding — Admin</title>
          <meta
            name="description"
            content="Configuration du branding réservée aux administrateurs."
          />
        </Helmet>
        <div className="mx-auto max-w-md px-4 py-20 text-center">
          <ShieldAlert className="mx-auto h-10 w-10 text-destructive" />
          <p className="mt-4 text-lg font-bold">
            Accès réservé aux administrateurs
          </p>
          <Link
            to="/admin"
            className="mt-4 inline-block text-sm font-bold text-primary underline"
          >
            Retour admin
          </Link>
        </div>
      </Layout>
    );
  }

  const ColorField = ({ k, name }) => (
    <div>
      <label className={label}>{name}</label>
      <div className="flex gap-2 items-center">
        <input
          type="color"
          value={isHexColor(form[k]) ? form[k] : "#000000"}
          onChange={(e) => set(k, e.target.value.toUpperCase())}
          className="h-11 w-14 cursor-pointer rounded-lg border border-input bg-background p-1"
        />
        <input
          className={field}
          value={form[k]}
          onChange={(e) => set(k, e.target.value)}
          placeholder="#RRGGBB"
        />
      </div>
    </div>
  );

  return (
    <Layout>
      <Helmet>
        <title>Paramètres de branding — {form.app_name || "Admin"}</title>
        <meta
          name="description"
          content="Configurer le logo, les couleurs et les coordonnées de la marque RetrouveMoi."
        />
      </Helmet>

      <div className="mx-auto w-full max-w-[90rem] px-4 py-8">
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-primary text-primary-foreground">
              <Palette className="h-6 w-6" />
            </span>
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold">Branding</h1>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Logo, couleurs, contact et réseaux
              </p>
            </div>
          </div>
          <Link
            to="/admin"
            className="text-sm font-bold text-primary underline underline-offset-4"
          >
            ← Admin
          </Link>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-5">
            <div className={card}>
              <p className="text-sm font-extrabold mb-3">Identité</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className={label}>Nom de l'application</label>
                  <input
                    className={field}
                    value={form.app_name}
                    onChange={(e) => set("app_name", e.target.value)}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className={label}>Tagline</label>
                  <input
                    className={field}
                    value={form.tagline}
                    onChange={(e) => set("tagline", e.target.value)}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className={label}>URL du logo</label>
                  <input
                    className={field}
                    value={form.logo_url}
                    onChange={(e) => {
                      set("logo_url", e.target.value);
                      if (!logoFile) setPreviewUrl(e.target.value);
                    }}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className={label}>Ou téléverser un logo</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={onLogoPick}
                    className="block w-full text-sm"
                  />
                </div>
              </div>
            </div>

            <div className={card}>
              <div className="flex items-center gap-2 mb-3">
                <Image className="h-4 w-4 text-primary" />
                <p className="text-sm font-extrabold">Image Hero & Sponsor</p>
              </div>
              <p className="text-[11px] text-muted-foreground mb-4">
                Configurez l&apos;image de bannière de la page d&apos;accueil et les informations du sponsor/partenaire affiché.
              </p>

              <Link
                to="/admin/hero"
                className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 transition-colors hover:bg-primary/10"
              >
                <span className="text-xs font-bold text-foreground">
                  Bannière animée : vidéos & images en alternance
                </span>
                <span className="text-[10px] font-extrabold text-primary underline underline-offset-2">
                  Gérer les médias →
                </span>
              </Link>

              <div className="grid gap-3">
                <div>
                  <label className={label}>URL de l&apos;image hero</label>
                  <input
                    className={field}
                    value={form.hero_image_url}
                    onChange={(e) => {
                      set("hero_image_url", e.target.value);
                      if (!heroFile) setHeroPreview(e.target.value);
                    }}
                    placeholder="https://..."
                  />
                </div>
                <div>
                  <label className={label}>Ou téléverser une image hero</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={onHeroPick}
                    className="block w-full text-sm"
                  />
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    Recommandé : 1200×400px, max 5 Mo. Affichée en pleine largeur.
                  </p>
                </div>
                <div>
                  <label className={label}>Lien du hero (optionnel)</label>
                  <input
                    className={field}
                    value={form.hero_link}
                    onChange={(e) => set("hero_link", e.target.value)}
                    placeholder="https://... (lien vers le sponsor)"
                  />
                </div>

                <div className="border-t border-border pt-3 mt-1">
                  <div className="flex items-center gap-2 mb-3">
                    <Megaphone className="h-4 w-4 text-accent" />
                    <p className="text-xs font-extrabold">Informations sponsor / partenaire</p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <label className={label}>Nom du sponsor</label>
                      <input
                        className={field}
                        value={form.sponsor_name}
                        onChange={(e) => set("sponsor_name", e.target.value)}
                        placeholder="Ex : Orange Burkina Faso"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className={label}>Tagline du sponsor</label>
                      <input
                        className={field}
                        value={form.sponsor_tagline}
                        onChange={(e) => set("sponsor_tagline", e.target.value)}
                        placeholder="Ex : Partenaire officiel de RetrouveMoi"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className={label}>URL du sponsor</label>
                      <input
                        className={field}
                        value={form.sponsor_url}
                        onChange={(e) => set("sponsor_url", e.target.value)}
                        placeholder="https://..."
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className={card}>
              <p className="text-sm font-extrabold mb-3">
                Couleurs principales
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <ColorField k="color_red" name="Rouge" />
                <ColorField k="color_green" name="Vert" />
                <ColorField k="color_blue" name="Bleu" />
                <ColorField k="color_yellow" name="Jaune" />
              </div>
            </div>

            <div className={card}>
              <p className="text-sm font-extrabold mb-3">Contact & locaux</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className={label}>Adresse</label>
                  <input
                    className={field}
                    value={form.address}
                    onChange={(e) => set("address", e.target.value)}
                  />
                </div>
                <div>
                  <label className={label}>Téléphone</label>
                  <input
                    className={field}
                    value={form.phone}
                    onChange={(e) => set("phone", e.target.value)}
                  />
                </div>
                <div>
                  <label className={label}>Email</label>
                  <input
                    type="email"
                    className={field}
                    value={form.email}
                    onChange={(e) => set("email", e.target.value)}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className={label}>Heures d'ouverture</label>
                  <input
                    className={field}
                    value={form.hours}
                    onChange={(e) => set("hours", e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className={card}>
              <p className="text-sm font-extrabold mb-3">Réseaux sociaux</p>
              <div className="grid gap-3">
                <div>
                  <label className={label}>Facebook (URL)</label>
                  <input
                    className={field}
                    value={form.social_facebook}
                    onChange={(e) => set("social_facebook", e.target.value)}
                  />
                </div>
                <div>
                  <label className={label}>Twitter / X (URL)</label>
                  <input
                    className={field}
                    value={form.social_twitter}
                    onChange={(e) => set("social_twitter", e.target.value)}
                  />
                </div>
                <div>
                  <label className={label}>Instagram (URL)</label>
                  <input
                    className={field}
                    value={form.social_instagram}
                    onChange={(e) => set("social_instagram", e.target.value)}
                  />
                </div>
                <div>
                  <label className={label}>WhatsApp (numéro ou lien)</label>
                  <input
                    className={field}
                    value={form.social_whatsapp}
                    onChange={(e) => set("social_whatsapp", e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className={card}>
              <p className="text-sm font-extrabold mb-3">Localisation</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className={label}>Devise</label>
                  <input
                    className={field}
                    value={form.currency}
                    onChange={(e) => set("currency", e.target.value)}
                  />
                </div>
                <div>
                  <label className={label}>Langue</label>
                  <select
                    className={field}
                    value={form.language}
                    onChange={(e) => set("language", e.target.value)}
                  >
                    <option value="fr">Français</option>
                    <option value="en">English</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={save}
                disabled={busy}
                className="flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-extrabold text-primary-foreground disabled:opacity-60"
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Enregistrer les modifications
              </button>
              <button
                type="button"
                onClick={resetDefaults}
                className="flex items-center gap-2 rounded-xl border border-border px-4 py-3 text-sm font-bold"
              >
                <RotateCcw className="h-4 w-4" /> Réinitialiser par défaut
              </button>
            </div>
          </div>

          {/* Live preview */}
          <div className="lg:sticky lg:top-20 self-start space-y-4">
            <div className={card}>
              <p className="text-sm font-extrabold mb-3">Aperçu — Hero</p>
              <div className="relative h-36 overflow-hidden rounded-xl bg-muted">
                {heroPreview ? (
                  <img
                    src={heroPreview}
                    alt="Hero preview"
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                ) : (
                  <div className="grid h-full place-items-center text-xs text-muted-foreground">
                    Aucune image hero
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                {form.sponsor_name && (
                  <div className="absolute bottom-2 left-2 right-2 flex items-center gap-2 rounded-lg bg-black/50 px-3 py-1.5 text-[10px] text-white backdrop-blur-sm">
                    <Megaphone className="h-3 w-3 shrink-0" />
                    <span className="font-bold">{form.sponsor_name}</span>
                    {form.sponsor_tagline && (
                      <span className="text-white/70">— {form.sponsor_tagline}</span>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className={card}>
              <p className="text-sm font-extrabold mb-3">Aperçu en direct</p>
              <div
                className="rounded-2xl p-6 text-white"
                style={{
                  background: `linear-gradient(135deg, ${form.color_blue}, ${form.color_green})`,
                }}
              >
                <img
                  src={previewUrl || form.logo_url}
                  alt=""
                  className="h-16 w-16 object-contain rounded-xl bg-black/30 p-1"
                />
                <p className="mt-3 text-xl font-extrabold">{form.app_name}</p>
                <p
                  className="mt-1 text-xs font-bold uppercase tracking-widest"
                  style={{ color: form.color_yellow }}
                >
                  {form.tagline}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span
                    className="rounded-xl px-4 py-2 text-xs font-extrabold text-white"
                    style={{ background: form.color_red }}
                  >
                    J&apos;AI ÉGARÉ
                  </span>
                  <span
                    className="rounded-xl px-4 py-2 text-xs font-extrabold text-white"
                    style={{ background: form.color_green }}
                  >
                    J&apos;AI RETROUVÉ
                  </span>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-4 gap-2">
                {[
                  form.color_red,
                  form.color_green,
                  form.color_blue,
                  form.color_yellow,
                ].map((c) => (
                  <div
                    key={c}
                    className="h-10 rounded-lg border border-border"
                    style={{ background: c }}
                    title={c}
                  />
                ))}
              </div>
              <div className="mt-4 text-xs text-muted-foreground space-y-1">
                <p>{form.address}</p>
                <p>{form.phone || "—"}</p>
                <p>{form.email}</p>
                <p>{form.hours}</p>
              </div>
              <div className="mt-4 flex items-center gap-2 border-t border-border pt-4">
                <BrandLogo size="sm" linkToHome={false} />
                <span className="text-sm font-bold">Logo actuel (app)</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default AdminBrandingPage;
