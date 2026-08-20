-- ============================================================
-- MIGRATION : Hero image + Sponsor pour branding_settings
-- Exécuter dans : https://supabase.com/dashboard/project/uudgiamuqutgljakelkb/sql/new
-- ============================================================

-- Ajouter les colonnes hero / sponsor
ALTER TABLE branding_settings
  ADD COLUMN IF NOT EXISTS hero_image_url TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS hero_file TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS hero_link TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS sponsor_name TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS sponsor_url TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS sponsor_tagline TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS sponsor_logo_file TEXT DEFAULT '';

-- Mettre à jour l'enregistrement par défaut avec l'image hero actuelle
UPDATE branding_settings
SET hero_image_url = 'https://images.hostinger.com/1d7b56f8-ae12-42ac-9369-50d15f8f42a1.png'
WHERE id = 'default' AND (hero_image_url IS NULL OR hero_image_url = '');
