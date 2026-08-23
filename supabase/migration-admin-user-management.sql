-- ============================================================
-- GESTION ADMIN : bloquer / débloquer / supprimer / modifier email
-- Exécuter dans : https://supabase.com/dashboard/project/uudgiamuqutgljakelkb/sql/new
-- ============================================================

-- ════════════════════════════════════════════════════════════
-- 1. Ajouter la colonne blocked à la table users
-- ════════════════════════════════════════════════════════════
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS blocked BOOLEAN DEFAULT FALSE;

-- ════════════════════════════════════════════════════════════
-- 2. Bloquer un utilisateur (flag only — ne touche pas à auth.users)
-- ════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION admin_block_user(target_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  caller_email TEXT;
BEGIN
  SELECT email INTO caller_email FROM public.users WHERE id = auth.uid();

  IF caller_email IS NULL OR caller_email <> 'digihouse10@gmail.com' THEN
    RAISE EXCEPTION 'Seul l administrateur principal peut bloquer un utilisateur';
  END IF;

  IF target_id = auth.uid() THEN
    RAISE EXCEPTION 'Vous ne pouvez pas vous bloquer vous-même';
  END IF;

  UPDATE public.users SET blocked = TRUE WHERE id = target_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Utilisateur introuvable';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_block_user(UUID) TO authenticated;

-- ════════════════════════════════════════════════════════════
-- 3. Débloquer (réactiver) un utilisateur
-- ════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION admin_unblock_user(target_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  caller_email TEXT;
BEGIN
  SELECT email INTO caller_email FROM public.users WHERE id = auth.uid();

  IF caller_email IS NULL OR caller_email <> 'digihouse10@gmail.com' THEN
    RAISE EXCEPTION 'Seul l administrateur principal peut débloquer un utilisateur';
  END IF;

  UPDATE public.users SET blocked = FALSE WHERE id = target_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Utilisateur introuvable';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_unblock_user(UUID) TO authenticated;

-- ════════════════════════════════════════════════════════════
-- 4. Modifier l'email d'un utilisateur (public.users + auth.users)
-- ════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION admin_update_user_email(
  target_id UUID,
  new_email TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  caller_email TEXT;
  email_exists BOOLEAN;
BEGIN
  SELECT email INTO caller_email FROM public.users WHERE id = auth.uid();

  IF caller_email IS NULL OR caller_email <> 'digihouse10@gmail.com' THEN
    RAISE EXCEPTION 'Seul l administrateur principal peut modifier les emails';
  END IF;

  IF new_email IS NULL OR new_email = '' THEN
    RAISE EXCEPTION 'Email invalide';
  END IF;

  -- Vérifier que l'email n'est pas déjà pris
  SELECT EXISTS(SELECT 1 FROM auth.users WHERE email = new_email AND id <> target_id) INTO email_exists;
  IF email_exists THEN
    RAISE EXCEPTION 'Cet email est déjà utilisé par un autre compte';
  END IF;

  -- Mettre à jour auth.users
  UPDATE auth.users SET email = new_email, updated_at = now() WHERE id = target_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Utilisateur introuvable dans auth.users';
  END IF;

  -- Mettre à jour public.users
  UPDATE public.users SET email = new_email WHERE id = target_id;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_update_user_email(UUID, TEXT) TO authenticated;

-- ════════════════════════════════════════════════════════════
-- 5. Supprimer un utilisateur (auth.users + public.users cascade)
-- ════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION admin_delete_user(target_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  caller_email TEXT;
BEGIN
  SELECT email INTO caller_email FROM public.users WHERE id = auth.uid();

  IF caller_email IS NULL OR caller_email <> 'digihouse10@gmail.com' THEN
    RAISE EXCEPTION 'Seul l administrateur principal peut supprimer un utilisateur';
  END IF;

  IF target_id = auth.uid() THEN
    RAISE EXCEPTION 'Vous ne pouvez pas supprimer votre propre compte';
  END IF;

  -- Supprimer les données liées dans public
  DELETE FROM public.notifications WHERE "user" = target_id;
  DELETE FROM public.users WHERE id = target_id;

  -- Supprimer le compte auth (cela cascade vers public.users via FK)
  DELETE FROM auth.users WHERE id = target_id;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_delete_user(UUID) TO authenticated;
