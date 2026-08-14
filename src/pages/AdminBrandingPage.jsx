import React, { useEffect, useState } from "react";
import { Helmet } from "react-helmet";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Loader2, RotateCcw, Save, ShieldAlert, Palette } from "lucide-react";
import { pb } from "@/lib/supabaseClient";
import Layout from "@/components/Layout";
import BrandLogo from "@/components/BrandLogo";
import { useAuth } from "@/contexts/AuthContext";
import { useBranding } from "@/contexts/BrandingContext";
import {
  BRANDING_DEFAULTS,
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
    });
    setPreviewUrl(branding.logo_url);
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
      fd.append("key", "main");
      Object.entries(form).forEach(([k, v]) => {
        if (k === "logo_url" && logoFile) return;
        fd.append(k, v ?? "");
      });
      if (logoFile) fd.append("logo_file", logoFile);

      if (branding.id) {
        await pb.collection("branding_settings").update(branding.id, fd);
      } else {
        await pb.collection("branding_settings").create(fd);
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
    setPreviewUrl(defaults.logo_url);
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
