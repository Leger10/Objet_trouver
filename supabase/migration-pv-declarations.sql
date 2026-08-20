-- ============================================================
-- MIGRATION : liaison PV ↔ Déclarations
-- Collez et exécutez dans :
-- https://supabase.com/dashboard/project/uudgiamuqutgljakelkb/sql/new
-- ============================================================

-- 1. Créer la table pvs si elle n'existe pas
CREATE TABLE IF NOT EXISTS pvs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pv_number TEXT UNIQUE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('deposit', 'restitution')),
  generated_by UUID REFERENCES auth.users(id),
  related_declaration UUID REFERENCES declarations(id) ON DELETE SET NULL,
  signatory_name TEXT DEFAULT '',
  signatory_phone TEXT DEFAULT '',
  signatory_id_type TEXT DEFAULT '',
  signatory_id_number TEXT DEFAULT '',
  object_category TEXT DEFAULT '',
  object_description TEXT DEFAULT '',
  location TEXT DEFAULT 'Locaux RetrouveMoi',
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE pvs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pvs_read_auth" ON pvs;
CREATE POLICY "pvs_read_auth" ON pvs FOR SELECT USING (auth.uid() = generated_by OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));
DROP POLICY IF EXISTS "pvs_insert_auth" ON pvs;
CREATE POLICY "pvs_insert_auth" ON pvs FOR INSERT WITH CHECK (auth.uid() = generated_by);
DROP POLICY IF EXISTS "pvs_admin_all" ON pvs;
CREATE POLICY "pvs_admin_all" ON pvs FOR ALL USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

-- 2. Ajouter pv_id et status enrichi sur declarations
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'declarations' AND column_name = 'pv_id') THEN
    ALTER TABLE declarations ADD COLUMN pv_id UUID REFERENCES pvs(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 3. Mettre à jour le CHECK sur status de declarations pour accepter les nouveaux statuts
-- (si un CHECK existait, on le recrée)
DO $$
BEGIN
  ALTER TABLE declarations DROP CONSTRAINT IF EXISTS declarations_status_check;
  ALTER TABLE declarations ADD CONSTRAINT declarations_status_check
    CHECK (status IN ('open', 'matched', 'closed', 'restitue', 'depose'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 4. Index
CREATE INDEX IF NOT EXISTS idx_pvs_type ON pvs(type);
CREATE INDEX IF NOT EXISTS idx_pvs_number ON pvs(pv_number);
CREATE INDEX IF NOT EXISTS idx_decl_pv_id ON declarations(pv_id);
CREATE INDEX IF NOT EXISTS idx_decl_status ON declarations(status);
