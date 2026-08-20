-- =============================================================
-- MIGRATION: app_installations — tracking des installations PWA
-- =============================================================

CREATE TABLE IF NOT EXISTS app_installations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  "user" UUID REFERENCES users(id) ON DELETE SET NULL,
  user_agent TEXT,
  platform TEXT,
  installed_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_app_installations_user ON app_installations("user");
CREATE INDEX IF NOT EXISTS idx_app_installations_platform ON app_installations(platform);

ALTER TABLE app_installations ENABLE ROW LEVEL SECURITY;

-- L'utilisateur peut voir ses propres installations
DROP POLICY IF EXISTS "app_install_select_own" ON app_installations;
CREATE POLICY "app_install_select_own" ON app_installations
  FOR SELECT USING (auth.uid() = "user");

-- L'utilisateur peut insérer sa propre installation
DROP POLICY IF EXISTS "app_install_insert_own" ON app_installations;
CREATE POLICY "app_install_insert_own" ON app_installations
  FOR INSERT WITH CHECK (auth.uid() = "user");

-- L'admin peut tout voir
DROP POLICY IF EXISTS "app_install_admin_all" ON app_installations;
CREATE POLICY "app_install_admin_all" ON app_installations
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

-- Service role pour tracking anonyme
GRANT ALL ON app_installations TO service_role;

-- Vue admin : nombre d'installations par jour
CREATE OR REPLACE VIEW admin_install_stats AS
SELECT
  date_trunc('day', installed_at)::date AS day,
  platform,
  COUNT(*) AS installations,
  COUNT(DISTINCT "user") AS unique_users
FROM app_installations
GROUP BY 1, 2
ORDER BY 1 DESC;
