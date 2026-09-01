-- ============================================================
-- AJOUT QUARTIER/SECTEUR À L'INSCRIPTION
-- Collez et exécutez dans :
-- https://supabase.com/dashboard/project/uudgiamuqutgljakelkb/sql/new
-- ============================================================
--
-- Le formulaire d'inscription collecte désormais le quartier/secteur.
-- Ce script met à jour le trigger handle_new_user() pour qu'il copie
-- aussi phone, city et quarter dans la table users (nécessaire pour
-- relier les déclarations à l'admin le plus proche par quartier —
-- la fonction find_nearest_admin() matche déjà sur users.quarter).

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

  INSERT INTO public.users (id, email, name, phone, city, quarter, referral_code, points, points_earned, plan, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    COALESCE(NEW.raw_user_meta_data->>'city', ''),
    COALESCE(NEW.raw_user_meta_data->>'quarter', ''),
    new_code, 0, 0, 'free', 'user'
  );

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

-- S'assurer que la colonne quarter existe (idempotent)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS quarter TEXT DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_users_quarter ON public.users(quarter);

-- Vérification : le trigger est bien attaché
SELECT tgname FROM pg_trigger WHERE tgrelid = 'auth.users'::regclass AND NOT tgisinternal;
