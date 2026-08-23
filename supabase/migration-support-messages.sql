-- ════════════════════════════════════════════════════════════
-- TABLE support_messages : formulaire de contact public
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS support_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  subject TEXT NOT NULL DEFAULT 'compte_supprime',
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  admin_reply TEXT,
  replied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Public insert (anyone can send a message)
ALTER TABLE support_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_insert_support" ON support_messages
  FOR INSERT WITH CHECK (true);

CREATE POLICY "admin_read_support" ON support_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'main_admin')
    )
  );

CREATE POLICY "admin_update_support" ON support_messages
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'main_admin')
    )
  );

CREATE INDEX IF NOT EXISTS idx_support_messages_status ON support_messages(status);
CREATE INDEX IF NOT EXISTS idx_support_messages_created ON support_messages(created_at DESC);
