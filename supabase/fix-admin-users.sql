-- ============================================================
-- FIX ADMIN : rôle perdu + SELECT policies (SECURITY DEFINER)
-- Exécuter dans : https://supabase.com/dashboard/project/uudgiamuqutgljakelkb/sql/new
-- ============================================================

-- ════════════════════════════════════════════════════════════
-- 1. Fonction SECURITY DEFINER pour vérifier le rôle admin
--    (évite la récursion RLS sur la table users)
-- ════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.check_is_admin(check_uid UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = check_uid AND role = 'admin'
  );
$$;

-- ════════════════════════════════════════════════════════════
-- 2. S'assurer que digihouse10@gmail.com a role=admin
-- ════════════════════════════════════════════════════════════
DO $$
DECLARE
  admin_uuid UUID;
BEGIN
  SELECT id INTO admin_uuid FROM auth.users
  WHERE email = 'digihouse10@gmail.com' LIMIT 1;

  IF admin_uuid IS NULL THEN
    RAISE NOTICE '⚠️ Aucun compte auth.users pour digihouse10@gmail.com';
    RETURN;
  END IF;

  -- Upsert : insère ou met à jour le rôle
  INSERT INTO public.users (id, email, name, referral_code, points, points_earned, plan, role)
  VALUES (
    admin_uuid,
    'digihouse10@gmail.com',
    'Admin Principal',
    'OBJ-' || upper(substr(md5(admin_uuid::text), 1, 6)),
    0, 0, 'free', 'admin'
  )
  ON CONFLICT (id) DO UPDATE SET role = 'admin';

  RAISE NOTICE '✅ digihouse10@gmail.com → role=admin confirmé';
END $$;

-- ════════════════════════════════════════════════════════════
-- 3. Supprimer TOUTES les anciennes policies SELECT sur users
-- ════════════════════════════════════════════════════════════
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE tablename = 'users' AND schemaname = 'public' AND cmd = 'SELECT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON users', pol.policyname);
    RAISE NOTICE 'Supprimé policy SELECT: %', pol.policyname;
  END LOOP;
END $$;

-- ════════════════════════════════════════════════════════════
-- 4. Nouvelles policies SELECT (sans récursion)
-- ════════════════════════════════════════════════════════════

-- Chaque utilisateur lit sa propre ligne
CREATE POLICY "users_select_own" ON users
  FOR SELECT USING (auth.uid() = id);

-- L'admin (via SECURITY DEFINER) peut lire TOUTES les lignes
CREATE POLICY "users_select_admin" ON users
  FOR SELECT USING (public.check_is_admin());

-- ════════════════════════════════════════════════════════════
-- 5. Policies INSERT / UPDATE (inchangées, juste nettoyées)
-- ════════════════════════════════════════════════════════════

-- INSERT pour le trigger
DROP POLICY IF EXISTS "users_insert_trigger" ON users;
CREATE POLICY "users_insert_trigger" ON users
  FOR INSERT WITH CHECK (true);

-- UPDATE : admin peut tout, user peut son profil
DROP POLICY IF EXISTS "users_admin_role_only" ON users;
CREATE POLICY "users_admin_role_only" ON users
  FOR UPDATE USING (
    auth.uid() = id OR public.check_is_admin()
  ) WITH CHECK (
    auth.uid() = id OR public.check_is_admin()
  );

-- ════════════════════════════════════════════════════════════
-- 6. Vérification finale
-- ════════════════════════════════════════════════════════════
DO $$
DECLARE
  r RECORD;
BEGIN
  SELECT id, email, role INTO r FROM public.users
  WHERE email = 'digihouse10@gmail.com' LIMIT 1;

  IF r.id IS NULL THEN
    RAISE WARNING '❌ digihouse10@gmail.com ABSENT de public.users';
  ELSIF r.role = 'admin' THEN
    RAISE NOTICE '✅ digihouse10@gmail.com → id=%, role=admin ✓', r.id;
  ELSE
    RAISE WARNING '❌ digihouse10@gmail.com → role=% (devrait être admin)', r.role;
  END IF;
END $$;
