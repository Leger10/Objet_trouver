// src/contexts/BrandingContext.jsx
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { pb } from "@/lib/supabaseClient";
import { BRANDING_DEFAULTS, DEFAULT_HERO, applyBrandingCss } from "@/lib/brandingDefaults";

const BrandingContext = createContext(null);

const mergeRecord = (rec) => {
  if (!rec) return { ...BRANDING_DEFAULTS, id: null };
  
  // Utiliser la nouvelle méthode getBrandingUrl
  const logoUrl = pb.files.getBrandingUrl(rec, 'logo_file') || rec.logo_url || BRANDING_DEFAULTS.logo_url;
  
  return {
    ...BRANDING_DEFAULTS,
    id: rec.id,
    app_name: rec.app_name || BRANDING_DEFAULTS.app_name,
    logo_url: logoUrl,
    tagline: rec.tagline || BRANDING_DEFAULTS.tagline,
    color_red: rec.color_red || BRANDING_DEFAULTS.color_red,
    color_green: rec.color_green || BRANDING_DEFAULTS.color_green,
    color_blue: rec.color_blue || BRANDING_DEFAULTS.color_blue,
    color_yellow: rec.color_yellow || BRANDING_DEFAULTS.color_yellow,
    color_white: rec.color_white || BRANDING_DEFAULTS.color_white,
    color_gray_light: rec.color_gray_light || BRANDING_DEFAULTS.color_gray_light,
    color_gray_dark: rec.color_gray_dark || BRANDING_DEFAULTS.color_gray_dark,
    address: rec.address || BRANDING_DEFAULTS.address,
    phone: rec.phone || BRANDING_DEFAULTS.phone,
    email: rec.email || BRANDING_DEFAULTS.email,
    hours: rec.hours || BRANDING_DEFAULTS.hours,
    social_facebook: rec.social_facebook || "",
    social_twitter: rec.social_twitter || "",
    social_instagram: rec.social_instagram || "",
    social_whatsapp: rec.social_whatsapp || "",
    currency: rec.currency || BRANDING_DEFAULTS.currency,
    language: rec.language || BRANDING_DEFAULTS.language,
    hero_image_url: pb.files.getBrandingUrl(rec, 'hero_file') || rec.hero_image_url || DEFAULT_HERO,
    hero_link: rec.hero_link || "",
    sponsor_name: rec.sponsor_name || "",
    sponsor_url: rec.sponsor_url || "",
    sponsor_tagline: rec.sponsor_tagline || "",
    _raw: rec,
  };
};

export const BrandingProvider = ({ children }) => {
  const [branding, setBranding] = useState({ ...BRANDING_DEFAULTS, id: null });
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const rec = await pb
        .collection("branding_settings")
        .getFirstListItem("id = 'default'", { requestKey: "branding-main" });
      
      const merged = mergeRecord(rec);
      setBranding(merged);
      applyBrandingCss(merged);
    } catch (_) {
      setBranding({ ...BRANDING_DEFAULTS, id: null });
      applyBrandingCss(BRANDING_DEFAULTS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({
      branding,
      loading,
      refresh,
      defaults: BRANDING_DEFAULTS,
    }),
    [branding, loading, refresh],
  );

  return (
    <BrandingContext.Provider value={value}>
      {children}
    </BrandingContext.Provider>
  );
};

export const useBranding = () => {
  const ctx = useContext(BrandingContext);
  if (!ctx) {
    return {
      branding: { ...BRANDING_DEFAULTS, id: null },
      loading: false,
      refresh: async () => {},
      defaults: BRANDING_DEFAULTS,
    };
  }
  return ctx;
};

export default BrandingContext;