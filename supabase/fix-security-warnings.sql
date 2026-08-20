-- ============================================================
-- FIX: Supabase Database Linter Security Warnings
-- Utilise ALTER FUNCTION (pas DROP) pour ne pas casser les triggers
-- Totalement idempotent — peut être exécuté plusieurs fois
-- ============================================================

-- ═══════════════════════════════════════════════════════════
-- ETAPE 1: REVOKE EXECUTE
-- ═══════════════════════════════════════════════════════════

DO $$ BEGIN
  REVOKE EXECUTE ON FUNCTION public.admin_request_password_reset(uuid) FROM anon, authenticated;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$ BEGIN
  REVOKE EXECUTE ON FUNCTION public.admin_set_password(uuid, text) FROM anon, authenticated;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$ BEGIN
  REVOKE EXECUTE ON FUNCTION public.admin_set_role(uuid, text) FROM anon, authenticated;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$ BEGIN
  REVOKE EXECUTE ON FUNCTION public.credit_points(uuid, integer, text, uuid) FROM anon, authenticated;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$ BEGIN
  REVOKE EXECUTE ON FUNCTION public.debit_points(uuid, integer, text, uuid) FROM anon, authenticated;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$ BEGIN
  REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$ BEGIN
  REVOKE EXECUTE ON FUNCTION public.award_points_found_declaration() FROM anon, authenticated;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$ BEGIN
  REVOKE EXECUTE ON FUNCTION public.award_points_match_confirmed() FROM anon, authenticated;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$ BEGIN
  REVOKE EXECUTE ON FUNCTION public.award_points_restitution() FROM anon, authenticated;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$ BEGIN
  REVOKE EXECUTE ON FUNCTION public.send_match_notification_email() FROM anon, authenticated;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$ BEGIN
  REVOKE EXECUTE ON FUNCTION public.check_is_admin(uuid) FROM anon, authenticated;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

-- ═══════════════════════════════════════════════════════════
-- ETAPE 2: SET search_path via ALTER
-- ═══════════════════════════════════════════════════════════

DO $$ BEGIN ALTER FUNCTION public.debit_points(uuid, integer, text, uuid) SET search_path = public; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN ALTER FUNCTION public.credit_points(uuid, integer, text, uuid) SET search_path = public; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN ALTER FUNCTION public.generate_referral_code() SET search_path = public; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN ALTER FUNCTION public.award_points_found_declaration() SET search_path = public; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN ALTER FUNCTION public.send_match_notification_email() SET search_path = public; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN ALTER FUNCTION public.award_points_match_confirmed() SET search_path = public; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN ALTER FUNCTION public.award_points_restitution() SET search_path = public; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN ALTER FUNCTION public.check_is_admin(uuid) SET search_path = public; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN ALTER FUNCTION public.admin_set_password(uuid, text) SET search_path = public; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN ALTER FUNCTION public.admin_set_role(uuid, text) SET search_path = public; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN ALTER FUNCTION public.admin_request_password_reset(uuid) SET search_path = public; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN ALTER FUNCTION public.handle_new_user() SET search_path = public; EXCEPTION WHEN undefined_function THEN NULL; END $$;

-- ═══════════════════════════════════════════════════════════
-- ETAPE 3: RLS POLICIES — DROP + CREATE (idempotent)
-- ═══════════════════════════════════════════════════════════

-- Notifications
DROP POLICY IF EXISTS "notif_admin" ON public.notifications;
DROP POLICY IF EXISTS "notif_insert" ON public.notifications;
DROP POLICY IF EXISTS "notif_insert_auth" ON public.notifications;
DROP POLICY IF EXISTS "notif_owner_read" ON public.notifications;
DROP POLICY IF EXISTS "notif_owner_update" ON public.notifications;
DROP POLICY IF EXISTS "notif_delete_owner" ON public.notifications;
CREATE POLICY "notif_owner_read" ON public.notifications
  FOR SELECT USING ("user" = auth.uid());
CREATE POLICY "notif_owner_update" ON public.notifications
  FOR UPDATE USING ("user" = auth.uid());
CREATE POLICY "notif_insert_auth" ON public.notifications
  FOR INSERT WITH CHECK (true);
CREATE POLICY "notif_delete_owner" ON public.notifications
  FOR DELETE USING ("user" = auth.uid());

-- Signatures
DROP POLICY IF EXISTS "sig_insert" ON public.signatures;
DROP POLICY IF EXISTS "sig_read" ON public.signatures;
DROP POLICY IF EXISTS "sig_insert_auth" ON public.signatures;
DROP POLICY IF EXISTS "sig_read_all" ON public.signatures;
CREATE POLICY "sig_insert_auth" ON public.signatures
  FOR INSERT WITH CHECK (true);
CREATE POLICY "sig_read_all" ON public.signatures
  FOR SELECT USING (true);

-- Email queue
DROP POLICY IF EXISTS "eq_insert" ON public.email_queue;
DROP POLICY IF EXISTS "eq_read_admin" ON public.email_queue;
DROP POLICY IF EXISTS "eq_insert_auth" ON public.email_queue;
DROP POLICY IF EXISTS "eq_read_admin_only" ON public.email_queue;
CREATE POLICY "eq_insert_auth" ON public.email_queue
  FOR INSERT WITH CHECK (true);
CREATE POLICY "eq_read_admin_only" ON public.email_queue
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- Declarations
DROP POLICY IF EXISTS "decl_update_all" ON public.declarations;
DROP POLICY IF EXISTS "decl_update_owner" ON public.declarations;
CREATE POLICY "decl_update_owner" ON public.declarations
  FOR UPDATE USING (
    "owner" = auth.uid()
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );
