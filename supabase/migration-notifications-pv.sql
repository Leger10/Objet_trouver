-- ============================================================
-- MIGRATION : Notifications push + Email queue + Workflow PV restitution
-- ============================================================

-- 1. Table email_queue — files d'attente d'envoi d'emails
CREATE TABLE IF NOT EXISTS email_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','sent','failed')),
  tries INTEGER DEFAULT 0,
  last_error TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  sent_at TIMESTAMPTZ
);

ALTER TABLE email_queue ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "eq_insert" ON email_queue;
DROP POLICY IF EXISTS "eq_read_admin" ON email_queue;
CREATE POLICY "eq_insert_auth" ON email_queue FOR INSERT WITH CHECK (true);
CREATE POLICY "eq_read_admin" ON email_queue FOR SELECT USING (true);

-- 2. Ajouter colonne pv_id aux declarations (si pas déjà fait)
ALTER TABLE declarations ADD COLUMN IF NOT EXISTS pv_id UUID;
ALTER TABLE declarations ADD COLUMN IF NOT EXISTS matched_declaration UUID REFERENCES declarations(id);

-- 3. Ajouter colonne status aux pvs pour workflow restitution
ALTER TABLE pvs ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' CHECK (status IN ('active','restitution_done','archived'));
ALTER TABLE pvs ADD COLUMN IF NOT EXISTS qr_code TEXT DEFAULT '';
ALTER TABLE pvs ADD COLUMN IF NOT EXISTS signature_url TEXT DEFAULT '';
ALTER TABLE pvs ADD COLUMN IF NOT EXISTS declaration_id UUID REFERENCES declarations(id);
ALTER TABLE pvs ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'deposit' CHECK (type IN ('deposit','restitution'));

-- 4. Table signatures — signatures numériques de restitution
CREATE TABLE IF NOT EXISTS signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pv_id UUID REFERENCES pvs(id) ON DELETE CASCADE,
  signer_name TEXT NOT NULL,
  signature_data TEXT NOT NULL,
  signed_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE signatures ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sig_insert" ON signatures;
DROP POLICY IF EXISTS "sig_read" ON signatures;
CREATE POLICY "sig_insert_auth" ON signatures FOR INSERT WITH CHECK (true);
CREATE POLICY "sig_read_all" ON signatures FOR SELECT USING (true);

-- 5. Index pour les notifications
CREATE INDEX IF NOT EXISTS idx_notif_created ON notifications(created_at DESC);
