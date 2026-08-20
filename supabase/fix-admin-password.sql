-- ============================================================
-- FIX: Reset MDP direct par l'admin (sans email SMTP)
-- Exécuter dans : https://supabase.com/dashboard/project/uudgiamuqutgljakelkb/sql/new
-- ============================================================

-- Extension pgcrypto (si pas déjà activée)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Fonction : admin reset password directement
CREATE OR REPLACE FUNCTION admin_set_password(
  target_id UUID,
  new_password TEXT DEFAULT '00000000'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  caller_email TEXT;
BEGIN
  -- Seul digihouse10@gmail.com peut appeler cette fonction
  SELECT email INTO caller_email FROM public.users WHERE id = auth.uid();
  
  IF caller_email IS NULL OR caller_email <> 'digihouse10@gmail.com' THEN
    RAISE EXCEPTION 'Seul l administrateur principal peut réinitialiser les mots de passe';
  END IF;

  -- Mettre à jour le mot de passe dans auth.users
  UPDATE auth.users
  SET encrypted_password = crypt(new_password, gen_salt('bf')),
      updated_at = now()
  WHERE id = target_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Utilisateur introuvable';
  END IF;
END;
$$;

-- Autoriser l'appel via RPC pour les utilisateurs authentifiés
GRANT EXECUTE ON FUNCTION admin_set_password(UUID, TEXT) TO authenticated;
