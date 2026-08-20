-- ============================================================
-- RETROUVEMOI — Script SQL complet
-- Toutes tables, politiques RLS, index, triggers, fonctions
-- Exécuter dans : https://supabase.com/dashboard/sql/new
-- ============================================================

-- ════════════════════════════════════════════════════════════
-- 1. CATEGORIES
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  "position" INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cat_read" ON categories FOR SELECT USING (true);
CREATE POLICY "cat_write" ON categories FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_categories_position ON categories("position");

INSERT INTO categories (id, slug, name, "position") VALUES
  ('cni','cni','CNI',1),('passeport','passeport','Passeport',2),
  ('permis','permis','Permis de conduire',3),('carte-grise','carte-grise','Carte grise',4),
  ('plaque','plaque','Plaque d''immatriculation',5),('moto','moto','Moto',6),
  ('voiture','voiture','Voiture',7),('velo','velo','Vélo',8),
  ('telephone','telephone','Téléphone',9),('portefeuille','portefeuille','Portefeuille',10),
  ('sac','sac','Sac / Bagagerie',11),('cles','cles','Clés',12),
  ('documents','documents','Documents divers',13),('autres','autres','Autres objets',14)
ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, "position"=EXCLUDED."position";

-- ════════════════════════════════════════════════════════════
-- 2. USERS (profil étendu lié à auth.users)
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  name TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  city TEXT DEFAULT '',
  referred_by TEXT DEFAULT '',
  referral_code TEXT UNIQUE DEFAULT '',
  points INTEGER DEFAULT 0,
  points_earned INTEGER DEFAULT 0,
  plan TEXT DEFAULT 'free',
  role TEXT DEFAULT 'user',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_read_own" ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "users_read_public" ON users FOR SELECT USING (true);
CREATE POLICY "users_update_own" ON users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "users_insert_own" ON users FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "users_admin_all" ON users FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code);
CREATE INDEX IF NOT EXISTS idx_users_referred_by ON users(referred_by);
CREATE INDEX IF NOT EXISTS idx_users_points ON users(points DESC);
CREATE INDEX IF NOT EXISTS idx_users_points_earned ON users(points_earned DESC);

-- ════════════════════════════════════════════════════════════
-- 3. FONCTION : auto-création profil + parrainage au signup
-- ════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  ref_code TEXT;
  referrer_id UUID;
  new_code TEXT;
  exists_count INTEGER;
BEGIN
  LOOP
    new_code := 'OBJ-' || upper(substr(md5(random()::text), 1, 6));
    SELECT count(*) INTO exists_count FROM users WHERE referral_code = new_code;
    EXIT WHEN exists_count = 0;
  END LOOP;

  INSERT INTO public.users (id, email, name, referral_code, points, points_earned, plan, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    new_code,
    0, 0, 'free', 'user'
  );

  ref_code := COALESCE(NEW.raw_user_meta_data->>'referred_by', '');
  IF ref_code <> '' THEN
    SELECT id INTO referrer_id FROM users WHERE referral_code = ref_code LIMIT 1;
    IF referrer_id IS NOT NULL AND referrer_id <> NEW.id THEN
      UPDATE users SET referred_by = ref_code WHERE id = NEW.id;
      UPDATE users SET points = points + 20, points_earned = points_earned + 20 WHERE id = referrer_id;
      INSERT INTO points_ledger ("user", amount, reason, reference_id)
      VALUES (referrer_id, 20, 'referral', NEW.id);
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ════════════════════════════════════════════════════════════
-- 4. DECLARATIONS
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS declarations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL CHECK (kind IN ('lost','found')),
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  person_name TEXT DEFAULT '',
  brand TEXT DEFAULT '',
  color TEXT DEFAULT '',
  city TEXT DEFAULT '',
  zone TEXT DEFAULT '',
  event_date DATE,
  description TEXT DEFAULT '',
  doc_last4 TEXT DEFAULT '',
  doc_number TEXT DEFAULT '',
  photo_url TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  security_question TEXT DEFAULT '',
  security_answer TEXT DEFAULT '',
  status TEXT DEFAULT 'open',
  priority BOOLEAN DEFAULT false,
  owner UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE declarations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "decl_read" ON declarations FOR SELECT USING (true);
CREATE POLICY "decl_insert_auth" ON declarations FOR INSERT WITH CHECK (auth.uid() = owner);
CREATE POLICY "decl_update_own" ON declarations FOR UPDATE USING (auth.uid() = owner);
CREATE POLICY "decl_update_all" ON declarations FOR UPDATE USING (true);
CREATE POLICY "decl_delete_own" ON declarations FOR DELETE USING (auth.uid() = owner);

CREATE INDEX IF NOT EXISTS idx_decl_kind ON declarations(kind);
CREATE INDEX IF NOT EXISTS idx_decl_status ON declarations(status);
CREATE INDEX IF NOT EXISTS idx_decl_category ON declarations(category);
CREATE INDEX IF NOT EXISTS idx_decl_owner ON declarations(owner);
CREATE INDEX IF NOT EXISTS idx_decl_created ON declarations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_decl_city ON declarations(city);
CREATE INDEX IF NOT EXISTS idx_decl_priority ON declarations(priority DESC, created_at DESC);

-- ════════════════════════════════════════════════════════════
-- 5. FONCTION : +10 pts quand un objet trouvé est déclaré
-- ════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION award_points_found_declaration()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.kind = 'found' AND NEW.owner IS NOT NULL THEN
    UPDATE users SET points = points + 10, points_earned = points_earned + 10 WHERE id = NEW.owner;
    INSERT INTO points_ledger ("user", amount, reason, reference_id)
    VALUES (NEW.owner, 10, 'found_declaration', NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_points_found ON declarations;
CREATE TRIGGER trg_points_found
  AFTER INSERT ON declarations
  FOR EACH ROW EXECUTE FUNCTION award_points_found_declaration();

-- ════════════════════════════════════════════════════════════
-- 6. MATCHES
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lost UUID REFERENCES declarations(id) ON DELETE CASCADE,
  found UUID REFERENCES declarations(id) ON DELETE CASCADE,
  score INTEGER DEFAULT 0,
  breakdown JSONB DEFAULT '{}',
  status TEXT DEFAULT 'suggested',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "matches_read" ON matches FOR SELECT USING (true);
CREATE POLICY "matches_write" ON matches FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_matches_lost ON matches(lost);
CREATE INDEX IF NOT EXISTS idx_matches_found ON matches(found);
CREATE INDEX IF NOT EXISTS idx_matches_status ON matches(status);
CREATE INDEX IF NOT EXISTS idx_matches_score ON matches(score DESC);

-- ════════════════════════════════════════════════════════════
-- 7. FONCTION : +50 pts quand une correspondance est confirmée
-- ════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION award_points_match_confirmed()
RETURNS TRIGGER AS $$
DECLARE
  owner_id UUID;
BEGIN
  IF NEW.status = 'confirmed' AND (OLD.status IS NULL OR OLD.status <> 'confirmed') THEN
    SELECT d.owner INTO owner_id FROM declarations d WHERE d.id = NEW.found;
    IF owner_id IS NOT NULL THEN
      UPDATE users SET points = points + 50, points_earned = points_earned + 50 WHERE id = owner_id;
      INSERT INTO points_ledger ("user", amount, reason, reference_id)
      VALUES (owner_id, 50, 'match_confirmed', NEW.id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_points_match ON matches;
CREATE TRIGGER trg_points_match
  AFTER UPDATE ON matches
  FOR EACH ROW EXECUTE FUNCTION award_points_match_confirmed();

-- ════════════════════════════════════════════════════════════
-- 8. CLAIMS
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  declaration UUID REFERENCES declarations(id) ON DELETE CASCADE,
  claimant UUID REFERENCES users(id) ON DELETE SET NULL,
  match_id UUID REFERENCES matches(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'pending',
  security_answer TEXT DEFAULT '',
  message TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY "claims_read" ON claims FOR SELECT USING (true);
CREATE POLICY "claims_write" ON claims FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_claims_declaration ON claims(declaration);
CREATE INDEX IF NOT EXISTS idx_claims_claimant ON claims(claimant);
CREATE INDEX IF NOT EXISTS idx_claims_status ON claims(status);

-- ════════════════════════════════════════════════════════════
-- 9. FONCTION : +100 pts quand une restitution est effectuée
-- ════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION award_points_restitution()
RETURNS TRIGGER AS $$
DECLARE
  decl_owner UUID;
BEGIN
  IF NEW.status = 'returned' AND (OLD.status IS NULL OR OLD.status <> 'returned') THEN
    SELECT d.owner INTO decl_owner FROM declarations d WHERE d.id = NEW.id;
    IF decl_owner IS NOT NULL THEN
      UPDATE users SET points = points + 100, points_earned = points_earned + 100 WHERE id = decl_owner;
      INSERT INTO points_ledger ("user", amount, reason, reference_id)
      VALUES (decl_owner, 100, 'restitution', NEW.id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_points_restitution ON declarations;
CREATE TRIGGER trg_points_restitution
  AFTER UPDATE ON declarations
  FOR EACH ROW EXECUTE FUNCTION award_points_restitution();

-- ════════════════════════════════════════════════════════════
-- 10. NOTIFICATIONS
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user" UUID REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT DEFAULT '',
  link TEXT DEFAULT '/tableau-de-bord',
  "read" BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notif_read_own" ON notifications FOR SELECT USING (auth.uid() = "user");
CREATE POLICY "notif_update_own" ON notifications FOR UPDATE USING (auth.uid() = "user");
CREATE POLICY "notif_insert" ON notifications FOR INSERT WITH CHECK (true);
CREATE POLICY "notif_admin" ON notifications FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications("user");
CREATE INDEX IF NOT EXISTS idx_notif_read ON notifications("read");
CREATE INDEX IF NOT EXISTS idx_notif_created ON notifications(created_at DESC);

-- ════════════════════════════════════════════════════════════
-- 11. REPORTS
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  declaration UUID REFERENCES declarations(id) ON DELETE CASCADE,
  reporter UUID REFERENCES users(id) ON DELETE SET NULL,
  reason TEXT DEFAULT '',
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reports_read" ON reports FOR SELECT USING (true);
CREATE POLICY "reports_write" ON reports FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_reports_declaration ON reports(declaration);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);

-- ════════════════════════════════════════════════════════════
-- 12. POINTS LEDGER
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS points_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user" UUID REFERENCES users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  reason TEXT DEFAULT '',
  reference_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE points_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pl_read" ON points_ledger FOR SELECT USING (true);
CREATE POLICY "pl_write" ON points_ledger FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_pl_user ON points_ledger("user");
CREATE INDEX IF NOT EXISTS idx_pl_reason ON points_ledger(reason);
CREATE INDEX IF NOT EXISTS idx_pl_created ON points_ledger(created_at DESC);

-- ════════════════════════════════════════════════════════════
-- 13. PAYMENTS
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user" UUID REFERENCES users(id) ON DELETE SET NULL,
  amount INTEGER NOT NULL,
  currency TEXT DEFAULT 'FCFA',
  method TEXT DEFAULT '',
  status TEXT DEFAULT 'pending',
  description TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pay_read" ON payments FOR SELECT USING (true);
CREATE POLICY "pay_write" ON payments FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_payments_user ON payments("user");
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);

-- ════════════════════════════════════════════════════════════
-- 14. DONATIONS
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS donations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user" UUID REFERENCES users(id) ON DELETE SET NULL,
  donor_name TEXT DEFAULT '',
  donor_phone TEXT DEFAULT '',
  amount_fcfa INTEGER NOT NULL DEFAULT 0,
  amount INTEGER NOT NULL DEFAULT 0,
  message TEXT DEFAULT '',
  payment_method TEXT DEFAULT '',
  status TEXT DEFAULT 'pending',
  anonymous BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE donations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "don_read" ON donations FOR SELECT USING (true);
CREATE POLICY "don_write" ON donations FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS donation_totals (
  id TEXT PRIMARY KEY DEFAULT 'global',
  label TEXT DEFAULT 'global',
  total INTEGER DEFAULT 0,
  total_fcfa INTEGER DEFAULT 0,
  count INTEGER DEFAULT 0,
  donors INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE donation_totals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dt_read" ON donation_totals FOR SELECT USING (true);
CREATE POLICY "dt_write" ON donation_totals FOR ALL USING (true) WITH CHECK (true);

INSERT INTO donation_totals (id, label) VALUES ('global', 'global')
ON CONFLICT (id) DO NOTHING;

-- ════════════════════════════════════════════════════════════
-- 15. PRO ACCOUNTS
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS pro_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user" UUID REFERENCES users(id) ON DELETE SET NULL,
  business_name TEXT NOT NULL,
  business_type TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  email TEXT DEFAULT '',
  status TEXT DEFAULT 'pending',
  plan TEXT DEFAULT 'basic',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE pro_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pro_read" ON pro_accounts FOR SELECT USING (true);
CREATE POLICY "pro_write" ON pro_accounts FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_pro_user ON pro_accounts("user");
CREATE INDEX IF NOT EXISTS idx_pro_status ON pro_accounts(status);

-- ════════════════════════════════════════════════════════════
-- 16. SUBSCRIPTIONS
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user" UUID REFERENCES users(id) ON DELETE SET NULL,
  plan TEXT NOT NULL DEFAULT 'free',
  status TEXT DEFAULT 'active',
  expires_at TIMESTAMPTZ,
  auto_renew BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sub_read" ON subscriptions FOR SELECT USING (true);
CREATE POLICY "sub_write" ON subscriptions FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_sub_user ON subscriptions("user");
CREATE INDEX IF NOT EXISTS idx_sub_status ON subscriptions(status);

-- ════════════════════════════════════════════════════════════
-- 17. POINT PURCHASES
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS point_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user" UUID REFERENCES users(id) ON DELETE SET NULL,
  service_key TEXT NOT NULL,
  cost INTEGER NOT NULL,
  duration INTEGER DEFAULT 30,
  expires_at TIMESTAMPTZ,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE point_purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pp_read" ON point_purchases FOR SELECT USING (true);
CREATE POLICY "pp_write" ON point_purchases FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_pp_user ON point_purchases("user");
CREATE INDEX IF NOT EXISTS idx_pp_status ON point_purchases(status);

-- ════════════════════════════════════════════════════════════
-- 18. GIFT ORDERS
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS gift_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user" UUID REFERENCES users(id) ON DELETE SET NULL,
  gift_key TEXT NOT NULL,
  cost INTEGER NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE gift_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "go_read" ON gift_orders FOR SELECT USING (true);
CREATE POLICY "go_write" ON gift_orders FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_go_user ON gift_orders("user");
CREATE INDEX IF NOT EXISTS idx_go_status ON gift_orders(status);

-- ════════════════════════════════════════════════════════════
-- 19. WITHDRAWALS
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user" UUID REFERENCES users(id) ON DELETE SET NULL,
  amount INTEGER NOT NULL,
  method TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE withdrawals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wd_read" ON withdrawals FOR SELECT USING (true);
CREATE POLICY "wd_write" ON withdrawals FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_wd_user ON withdrawals("user");
CREATE INDEX IF NOT EXISTS idx_wd_status ON withdrawals(status);

-- ════════════════════════════════════════════════════════════
-- 20. AD EVENTS
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS ad_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  placement TEXT NOT NULL,
  "user" UUID REFERENCES users(id) ON DELETE SET NULL,
  action TEXT DEFAULT 'view',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE ad_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ae_write" ON ad_events FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_ae_placement ON ad_events(placement);
CREATE INDEX IF NOT EXISTS idx_ae_user ON ad_events("user");

-- ════════════════════════════════════════════════════════════
-- 21. BRANDING SETTINGS
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS branding_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  app_name TEXT DEFAULT 'RetrouveMoi',
  tagline TEXT DEFAULT 'Perdu aujourd''hui, retrouvé demain.',
  color_red TEXT DEFAULT '#DC2626',
  color_green TEXT DEFAULT '#16A34A',
  color_yellow TEXT DEFAULT '#EAB308',
  logo_url TEXT DEFAULT '',
  logo_file TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE branding_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bs_read" ON branding_settings FOR SELECT USING (true);
CREATE POLICY "bs_write" ON branding_settings FOR ALL USING (true) WITH CHECK (true);

INSERT INTO branding_settings (id) VALUES ('default')
ON CONFLICT (id) DO NOTHING;

-- ════════════════════════════════════════════════════════════
-- 22. PV (Procès-Verbaux)
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS pvs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user" UUID REFERENCES users(id) ON DELETE SET NULL,
  type TEXT DEFAULT 'deposit',
  declaration_id UUID REFERENCES declarations(id) ON DELETE SET NULL,
  title TEXT DEFAULT '',
  description TEXT DEFAULT '',
  city TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE pvs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pv_read" ON pvs FOR SELECT USING (true);
CREATE POLICY "pv_write" ON pvs FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_pv_user ON pvs("user");
CREATE INDEX IF NOT EXISTS idx_pv_type ON pvs(type);

-- ════════════════════════════════════════════════════════════
-- 23. STORAGE BUCKETS
-- ════════════════════════════════════════════════════════════
INSERT INTO storage.buckets (id, name, public) VALUES ('uploads', 'uploads', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public) VALUES ('branding', 'branding', true)
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Public read uploads" ON storage.objects;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$ BEGIN
  DROP POLICY IF EXISTS "Anyone upload" ON storage.objects;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$ BEGIN
  DROP POLICY IF EXISTS "Public read branding" ON storage.objects;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$ BEGIN
  DROP POLICY IF EXISTS "Auth insert branding" ON storage.objects;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "Public read uploads" ON storage.objects FOR SELECT USING (bucket_id = 'uploads');
CREATE POLICY "Anyone upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'uploads');
CREATE POLICY "Public read branding" ON storage.objects FOR SELECT USING (bucket_id = 'branding');
CREATE POLICY "Auth insert branding" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'branding' AND auth.role() = 'authenticated');

-- ════════════════════════════════════════════════════════════
-- 24. RPC : credit / debit points (appelable depuis JS)
-- ════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION credit_points(
  p_user UUID,
  p_amount INTEGER,
  p_reason TEXT,
  p_reference UUID DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  UPDATE users SET points = points + p_amount, points_earned = points_earned + p_amount WHERE id = p_user;
  INSERT INTO points_ledger ("user", amount, reason, reference_id)
  VALUES (p_user, p_amount, p_reason, p_reference);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION debit_points(
  p_user UUID,
  p_amount INTEGER,
  p_reason TEXT,
  p_reference UUID DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  UPDATE users SET points = points - p_amount WHERE id = p_user AND points >= p_amount;
  INSERT INTO points_ledger ("user", amount, reason, reference_id)
  VALUES (p_user, -p_amount, p_reason, p_reference);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
