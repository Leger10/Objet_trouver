-- ============================================================
-- FIX URGENT : trigger inscription + reset password
-- Collez et exécutez dans :
-- https://supabase.com/dashboard/project/uudgiamuqutgljakelkb/sql/new
-- ============================================================

-- 1. Supprimer l'ancien trigger cassé
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 2. Recréer le trigger avec gestion d'erreurs
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_code TEXT;
  exists_count INTEGER;
  ref_code TEXT;
  referrer_id UUID;
BEGIN
  LOOP
    new_code := 'OBJ-' || upper(substr(md5(random()::text), 1, 6));
    SELECT count(*) INTO exists_count FROM public.users WHERE referral_code = new_code;
    EXIT WHEN exists_count = 0;
  END LOOP;

  INSERT INTO public.users (id, email, name, referral_code, points, points_earned, plan, role)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'name', ''), new_code, 0, 0, 'free', 'user');

  ref_code := COALESCE(NEW.raw_user_meta_data->>'referred_by', '');
  IF ref_code <> '' THEN
    SELECT id INTO referrer_id FROM public.users WHERE referral_code = ref_code LIMIT 1;
    IF referrer_id IS NOT NULL AND referrer_id <> NEW.id THEN
      UPDATE public.users SET referred_by = ref_code WHERE id = NEW.id;
      UPDATE public.users SET points = points + 20, points_earned = points_earned + 20 WHERE id = referrer_id;
      BEGIN
        INSERT INTO public.points_ledger ("user", amount, reason, reference_id)
        VALUES (referrer_id, 20, 'referral', NEW.id);
      EXCEPTION WHEN OTHERS THEN NULL;
      END;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- 3. Politique RLS : seuls les inserts autorisés
DROP POLICY IF EXISTS "users_insert_trigger" ON users;
CREATE POLICY "users_insert_trigger" ON users
  FOR INSERT WITH CHECK (true);

-- 4. RPC : seul digihouse10@gmail.com peut changer les roles
DROP FUNCTION IF EXISTS admin_set_role(UUID, TEXT);
CREATE OR REPLACE FUNCTION admin_set_role(target_user_id UUID, new_role TEXT)
RETURNS void AS $$
DECLARE caller_email TEXT;
BEGIN
  SELECT email INTO caller_email FROM public.users WHERE id = auth.uid();
  IF caller_email IS NULL OR caller_email <> 'digihouse10@gmail.com' THEN
    RAISE EXCEPTION 'Seul digihouse10@gmail.com peut modifier les roles';
  END IF;
  IF new_role NOT IN ('user', 'admin') THEN
    RAISE EXCEPTION 'Role invalide';
  END IF;
  IF auth.uid() = target_user_id THEN
    RAISE EXCEPTION 'Vous ne pouvez pas modifier votre propre role';
  END IF;
  UPDATE public.users SET role = new_role WHERE id = target_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Utilisateur introuvable'; END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. RPC : reset password par admin
DROP FUNCTION IF EXISTS admin_request_password_reset(UUID);
DROP FUNCTION IF EXISTS admin_request_password_reset(UUID, TEXT);
CREATE OR REPLACE FUNCTION admin_request_password_reset(target_user_id UUID)
RETURNS TEXT AS $$
DECLARE caller_email TEXT; target_email TEXT;
BEGIN
  SELECT email INTO caller_email FROM public.users WHERE id = auth.uid();
  IF caller_email IS NULL OR caller_email <> 'digihouse10@gmail.com' THEN
    RAISE EXCEPTION 'Seul digihouse10@gmail.com peut reinitialiser les mots de passe';
  END IF;
  SELECT email INTO target_email FROM public.users WHERE id = target_user_id;
  IF target_email IS NULL THEN RAISE EXCEPTION 'Utilisateur introuvable'; END IF;
  RETURN target_email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
