-- ============================================================
-- MIGRATION : sponsor_banners — Annonces animées homepage
-- Exécuter dans : https://supabase.com/dashboard/project/uudgiamuqutgljakelkb/sql/new
-- ============================================================

CREATE TABLE IF NOT EXISTS sponsor_banners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL DEFAULT '',
  subtitle TEXT DEFAULT '',
  image_url TEXT DEFAULT '',
  link_url TEXT DEFAULT '',
  cta_text TEXT DEFAULT 'En savoir plus',
  bg_from TEXT DEFAULT '#001F3F',
  bg_to TEXT DEFAULT '#1B4332',
  accent_color TEXT DEFAULT '#FFD60A',
  position INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE sponsor_banners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sb_read" ON sponsor_banners FOR SELECT USING (true);
CREATE POLICY "sb_write" ON sponsor_banners FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_sb_active ON sponsor_banners(active);
CREATE INDEX IF NOT EXISTS idx_sb_position ON sponsor_banners(position);

-- Insérer quelques exemples de sponsors
INSERT INTO sponsor_banners (title, subtitle, cta_text, bg_from, bg_to, accent_color, position, active) VALUES
  ('Orange Money', 'Envoyez et recevez de l''argent en un instant', 'Télécharger', '#FF6600', '#FF9900', '#FFFFFF', 1, true),
  ('Wave', 'Transférez sans frais partout au Sénégal', 'Découvrir', '#00C2FF', '#0066FF', '#FFFFFF', 2, true),
  ('Assurance Auto', 'Protégez votre véhicule dès maintenant', 'Demander un devis', '#001F3F', '#1B4332', '#FFD60A', 3, true),
  ('Free Money', 'La liberté financière à portée de main', 'En savoir plus', '#E63946', '#C1121F', '#FFFFFF', 4, true)
ON CONFLICT DO NOTHING;
