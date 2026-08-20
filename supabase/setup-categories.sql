-- Table des catégories pour RetrouveMoi
-- Exécuter dans Supabase SQL Editor : https://supabase.com/dashboard/project/uudgiamuqutgljakelkb/sql

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  "position" INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS : lecture publique, écriture admin
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lecture publique des catégories"
  ON categories FOR SELECT
  USING (true);

CREATE POLICY "Admin peut gérer les catégories"
  ON categories FOR ALL
  USING (true)
  WITH CHECK (true);

-- Insertion des catégories
INSERT INTO categories (id, slug, name, "position") VALUES
  ('cni',        'cni',        'CNI',            1),
  ('passeport',  'passeport',  'Passeport',      2),
  ('permis',     'permis',     'Permis',         3),
  ('carte-grise','carte-grise','Carte grise',     4),
  ('plaque',     'plaque',     'Plaque d''immat.', 5),
  ('moto',       'moto',       'Moto',           6),
  ('voiture',    'voiture',    'Voiture',        7),
  ('velo',       'velo',       'Vélo',           8),
  ('telephone',  'telephone',  'Téléphone',      9),
  ('portefeuille','portefeuille','Portefeuille', 10),
  ('sac',        'sac',        'Sac',            11),
  ('cles',       'cles',       'Clés',           12),
  ('documents',  'documents',  'Documents',      13),
  ('autres',     'autres',     'Autres',         14)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  "position" = EXCLUDED."position";
