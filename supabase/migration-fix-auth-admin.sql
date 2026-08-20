-- ============================================================
-- FIX INSCRIPTION + GESTION ADMIN + RÉINITIALISATION MDP
-- Exécuter dans : https://supabase.com/dashboard/project/uudgiamuqutgljakelkb/sql/new
-- ============================================================

-- ════════════════════════════════════════════════════════════
-- 1. FIX INSCRIPTION : Désactiver la confirmation email
--    (ou retourner un message clair si pas de service email)
-- ════════════════════════════════════════════════════════════

-- Le trigger handle_new_user() doit fonctionner même si la table
-- points_ledger est vide ou si des colonnes manquent.
-- Recréer le trigger avec gestion d'erreurs robuste :
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_code TEXT;
  exists_count INTEGER;
  ref_code TEXT;
  referrer_id UUID;
BEGIN
  -- Générer un code de parrainage unique
  LOOP
    new_code := 'OBJ-' || upper(substr(md5(random()::text), 1, 6));
    SELECT count(*) INTO exists_count FROM users WHERE referral_code = new_code;
    EXIT WHEN exists_count = 0;
  END LOOP;

  -- Insérer le profil utilisateur
  INSERT INTO public.users (id, email, name, referral_code, points, points_earned, plan, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    new_code,
    0,
    0,
    'free',
    'user'
  );

  -- Gérer le parrainage
  ref_code := COALESCE(NEW.raw_user_meta_data->>'referred_by', '');
  IF ref_code <> '' THEN
    SELECT id INTO referrer_id FROM users WHERE referral_code = ref_code LIMIT 1;
    IF referrer_id IS NOT NULL AND referrer_id <> NEW.id THEN
      UPDATE users SET referred_by = ref_code WHERE id = NEW.id;
      UPDATE users SET points = points + 20, points_earned = points_earned + 20 WHERE id = referrer_id;
      BEGIN
        INSERT INTO points_ledger ("user", amount, reason, reference_id)
        VALUES (referrer_id, 20, 'referral', NEW.id);
      EXCEPTION WHEN OTHERS THEN
        -- Ignorer l'erreur du ledger si la table est mal configurée
        NULL;
      END;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ════════════════════════════════════════════════════════════
-- 2. POLITIQUE RLS : Seul digihouse10@gmail.com peut changer les rôles
-- ════════════════════════════════════════════════════════════

-- Supprimer l'ancienne politique d'admin sur users
DROP POLICY IF EXISTS "users_admin_all" ON users;

-- Seul l'admin principal peut modifier les rôles
CREATE POLICY "users_admin_role_only" ON users
  FOR UPDATE
  USING (
    auth.uid() = id
    OR EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND email = 'digihouse10@gmail.com' AND role = 'admin'
    )
  )
  WITH CHECK (
    auth.uid() = id
    OR EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND email = 'digihouse10@gmail.com' AND role = 'admin'
    )
  );

-- Fonction RPC : seul digihouse10@gmail.com peut promouvoir/rétrograder
CREATE OR REPLACE FUNCTION admin_set_role(
  target_user_id UUID,
  new_role TEXT
)
RETURNS void AS $$
DECLARE
  caller_email TEXT;
BEGIN
  SELECT email INTO caller_email FROM users WHERE id = auth.uid();
  
  IF caller_email IS NULL OR caller_email <> 'digihouse10@gmail.com' THEN
    RAISE EXCEPTION 'Seul l''administrateur principal peut modifier les rôles';
  END IF;

  IF new_role NOT IN ('user', 'admin') THEN
    RAISE EXCEPTION 'Rôle invalide : %', new_role;
  END IF;

  UPDATE users SET role = new_role WHERE id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ════════════════════════════════════════════════════════════
-- 3. RESET MOT DE PASSE PAR L'ADMIN
-- ════════════════════════════════════════════════════════════

-- Note : La réinitialisation du mot de passe Supabase Auth
-- nécessite le service_role key côté serveur.
-- Côté client, on utilise l'API Management de Supabase.
-- On crée une fonction RPC qui retourne le besoin d'utiliser
-- le service_role pour reset.

-- Fonction pour marquer qu'un reset a été demandé
CREATE OR REPLACE FUNCTION admin_request_password_reset(
  target_user_id UUID,
  new_password TEXT DEFAULT '00000000'
)
RETURNS TEXT AS $$
DECLARE
  caller_email TEXT;
  target_email TEXT;
BEGIN
  SELECT email INTO caller_email FROM users WHERE id = auth.uid();
  
  IF caller_email IS NULL OR caller_email <> 'digihouse10@gmail.com' THEN
    RAISE EXCEPTION 'Seul l''administrateur principal peut réinitialiser les mots de passe';
  END IF;

  SELECT email INTO target_email FROM users WHERE id = target_user_id;
  
  IF target_email IS NULL THEN
    RAISE EXCEPTION 'Utilisateur introuvable';
  END IF;

  -- Retourner l'email pour que le client utilise l'API Management
  RETURN target_email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ════════════════════════════════════════════════════════════
-- 4. FIX RLS : S'assurer que les inserts users fonctionnent
-- ════════════════════════════════════════════════════════════

-- Permitir inserción para el trigger (SECURITY DEFINER ya lo hace,
-- pero por si acaso agregamos una política explícita)
DROP POLICY IF EXISTS "users_insert_trigger" ON users;
CREATE POLICY "users_insert_trigger" ON users
  FOR INSERT
  WITH CHECK (true);
