-- ════════════════════════════════════════════════════════════
-- FIX : Réparer les RLS cassées par migration-admin-proximity
-- ════════════════════════════════════════════════════════════

-- 1. Nettoyer TOUTES les policies existantes sur users
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies WHERE tablename = 'users' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON users', pol.policyname);
  END LOOP;
END $$;

-- 2. Recréer les policies users (identiques au setup original)
CREATE POLICY "users_select_own" ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "users_select_public" ON users FOR SELECT USING (true);
CREATE POLICY "users_update_own" ON users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "users_insert_own" ON users FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "users_admin_all" ON users FOR ALL USING (true) WITH CHECK (true);

-- 3. Nettoyer et recréer les policies notifications
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies WHERE tablename = 'notifications' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON notifications', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "notif_read_own" ON notifications FOR SELECT USING (auth.uid() = "user");
CREATE POLICY "notif_update_own" ON notifications FOR UPDATE USING (auth.uid() = "user");
CREATE POLICY "notif_insert" ON notifications FOR INSERT WITH CHECK (true);
CREATE POLICY "notif_admin" ON notifications FOR ALL USING (true) WITH CHECK (true);

-- 4. S'assurer que la colonne quarter existe
ALTER TABLE users ADD COLUMN IF NOT EXISTS quarter TEXT DEFAULT '';

-- 5. Index
CREATE INDEX IF NOT EXISTS idx_users_role_city ON users(role, city);
CREATE INDEX IF NOT EXISTS idx_users_quarter ON users(quarter);
