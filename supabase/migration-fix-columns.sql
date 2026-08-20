-- ============================================================
-- FIX : Ajouter toutes les colonnes manquantes à branding_settings
-- + Table hero_images pour rotation multi-images
-- + Colonne logo_file pour upload logo sponsor
-- ============================================================

-- ── 1. Colonnes manquantes branding_settings ──
ALTER TABLE branding_settings
  ADD COLUMN IF NOT EXISTS color_blue TEXT DEFAULT '#001F3F',
  ADD COLUMN IF NOT EXISTS color_white TEXT DEFAULT '#FFFFFF',
  ADD COLUMN IF NOT EXISTS color_gray_light TEXT DEFAULT '#F5F5F5',
  ADD COLUMN IF NOT EXISTS color_gray_dark TEXT DEFAULT '#333333',
  ADD COLUMN IF NOT EXISTS address TEXT DEFAULT 'Locaux RetrouveMoi',
  ADD COLUMN IF NOT EXISTS phone TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS email TEXT DEFAULT 'contact@retrouvezmoi.app',
  ADD COLUMN IF NOT EXISTS hours TEXT DEFAULT 'Lun – Sam, 8h – 18h',
  ADD COLUMN IF NOT EXISTS social_facebook TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS social_twitter TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS social_instagram TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS social_whatsapp TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'FCFA',
  ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'fr';

-- ── 2. Table hero_images — images hero qui défilent ──
CREATE TABLE IF NOT EXISTS hero_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT DEFAULT '',
  subtitle TEXT DEFAULT '',
  image_url TEXT DEFAULT '',
  file_name TEXT DEFAULT '',
  link_url TEXT DEFAULT '',
  position INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE hero_images ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hi_read" ON hero_images FOR SELECT USING (true);
CREATE POLICY "hi_write" ON hero_images FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_hi_active ON hero_images(active);
CREATE INDEX IF NOT EXISTS idx_hi_position ON hero_images(position);

-- Insérer l'image hero par défaut
INSERT INTO hero_images (title, subtitle, image_url, position, active)
VALUES ('RetrouveMoi', 'Perdu aujourd''hui, retrouvé demain.', 'https://images.hostinger.com/1d7b56f8-ae12-42ac-9369-50d15f8f42a1.png', 0, true)
ON CONFLICT DO NOTHING;

-- ── 3. Colonne logo_file dans sponsor_banners (upload logo) ──
ALTER TABLE sponsor_banners
  ADD COLUMN IF NOT EXISTS logo_file TEXT DEFAULT '';

-- ── 4. Storage bucket pour sponsors ──
INSERT INTO storage.buckets (id, name, public) VALUES ('branding', 'branding', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies pour les logos sponsors
DO $$ BEGIN
  DROP POLICY IF EXISTS "Public read branding" ON storage.objects;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$ BEGIN
  DROP POLICY IF EXISTS "Auth insert branding" ON storage.objects;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "Public read branding" ON storage.objects FOR SELECT USING (bucket_id = 'branding');
CREATE POLICY "Anyone upload branding" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'branding');
CREATE POLICY "Auth update branding" ON storage.objects FOR UPDATE USING (bucket_id = 'branding');
CREATE POLICY "Auth delete branding" ON storage.objects FOR DELETE USING (bucket_id = 'branding');
