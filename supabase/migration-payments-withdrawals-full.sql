-- =============================================================
-- MIGRATION: Tables paiements + retraits MoneyFusion (v3)
-- Gère les tables EXISTANTES — ajoute les colonnes manquantes
-- Exécuter dans Supabase SQL Editor
-- =============================================================

-- 1. PAYMENTS — ajouter colonnes manquantes si table existe déjà
-- =============================================================
DO $$
BEGIN
  -- Créer la table si elle n'existe pas
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payments') THEN
    CREATE TABLE payments (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      "user" UUID REFERENCES users(id) ON DELETE SET NULL,
      type TEXT DEFAULT 'donation',
      item_key TEXT,
      item_label TEXT,
      amount INT NOT NULL DEFAULT 0,
      amount_fcfa INT,
      fee_fcfa INT DEFAULT 0,
      total_charged INT,
      currency TEXT DEFAULT 'FCFA',
      method TEXT,
      payment_method TEXT,
      status TEXT DEFAULT 'pending'
        CHECK (status IN ('pending','confirmed','failed','cancelled')),
      description TEXT,
      moneyfusion_token TEXT,
      moneyfusion_moyen TEXT,
      moneyfusion_transaction TEXT,
      moneyfusion_frais INT,
      moneyfusion_personal_info JSONB,
      confirmed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT now()
    );
  END IF;

  -- Ajouter chaque colonne manquante
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payments' AND column_name='type') THEN
    ALTER TABLE payments ADD COLUMN type TEXT DEFAULT 'donation';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payments' AND column_name='item_key') THEN
    ALTER TABLE payments ADD COLUMN item_key TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payments' AND column_name='item_label') THEN
    ALTER TABLE payments ADD COLUMN item_label TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payments' AND column_name='amount') THEN
    ALTER TABLE payments ADD COLUMN amount INT NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payments' AND column_name='amount_fcfa') THEN
    ALTER TABLE payments ADD COLUMN amount_fcfa INT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payments' AND column_name='fee_fcfa') THEN
    ALTER TABLE payments ADD COLUMN fee_fcfa INT DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payments' AND column_name='total_charged') THEN
    ALTER TABLE payments ADD COLUMN total_charged INT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payments' AND column_name='currency') THEN
    ALTER TABLE payments ADD COLUMN currency TEXT DEFAULT 'FCFA';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payments' AND column_name='method') THEN
    ALTER TABLE payments ADD COLUMN method TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payments' AND column_name='payment_method') THEN
    ALTER TABLE payments ADD COLUMN payment_method TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payments' AND column_name='description') THEN
    ALTER TABLE payments ADD COLUMN description TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payments' AND column_name='moneyfusion_token') THEN
    ALTER TABLE payments ADD COLUMN moneyfusion_token TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payments' AND column_name='moneyfusion_moyen') THEN
    ALTER TABLE payments ADD COLUMN moneyfusion_moyen TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payments' AND column_name='moneyfusion_transaction') THEN
    ALTER TABLE payments ADD COLUMN moneyfusion_transaction TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payments' AND column_name='moneyfusion_frais') THEN
    ALTER TABLE payments ADD COLUMN moneyfusion_frais INT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payments' AND column_name='moneyfusion_personal_info') THEN
    ALTER TABLE payments ADD COLUMN moneyfusion_personal_info JSONB;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payments' AND column_name='confirmed_at') THEN
    ALTER TABLE payments ADD COLUMN confirmed_at TIMESTAMPTZ;
  END IF;
END $$;

-- Index payments (créer seulement si la table existe)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payments') THEN
    CREATE INDEX IF NOT EXISTS idx_payments_user ON payments("user");
    CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
    CREATE INDEX IF NOT EXISTS idx_payments_token ON payments(moneyfusion_token);
  END IF;
END $$;

-- RLS payments
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payments') THEN
    ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "payments_select_own" ON payments;
    CREATE POLICY "payments_select_own" ON payments
      FOR SELECT USING (auth.uid() = "user");
    DROP POLICY IF EXISTS "payments_insert_own" ON payments;
    CREATE POLICY "payments_insert_own" ON payments
      FOR INSERT WITH CHECK (auth.uid() = "user");
    DROP POLICY IF EXISTS "payments_update_own" ON payments;
    CREATE POLICY "payments_update_own" ON payments
      FOR UPDATE USING (auth.uid() = "user");
    DROP POLICY IF EXISTS "payments_admin_all" ON payments;
    CREATE POLICY "payments_admin_all" ON payments
      FOR ALL USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
      );
    GRANT ALL ON payments TO service_role;
  END IF;
END $$;


-- 2. WITHDRAWALS — ajouter colonnes manquantes
-- =============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'withdrawals') THEN
    CREATE TABLE withdrawals (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      "user" UUID REFERENCES users(id) ON DELETE SET NULL,
      amount_points INT NOT NULL DEFAULT 0,
      amount_fcfa INT NOT NULL DEFAULT 0,
      commission_fcfa INT DEFAULT 0,
      net_amount INT,
      method TEXT,
      payment_method TEXT,
      phone TEXT,
      payment_details JSONB,
      status TEXT DEFAULT 'pending'
        CHECK (status IN ('pending','processing','paid','rejected','failed')),
      moneyfusion_token TEXT,
      moneyfusion_moyen TEXT,
      paid_at TIMESTAMPTZ,
      rejection_reason TEXT,
      created_at TIMESTAMPTZ DEFAULT now()
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='withdrawals' AND column_name='amount_points') THEN
    ALTER TABLE withdrawals ADD COLUMN amount_points INT NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='withdrawals' AND column_name='amount_fcfa') THEN
    ALTER TABLE withdrawals ADD COLUMN amount_fcfa INT NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='withdrawals' AND column_name='commission_fcfa') THEN
    ALTER TABLE withdrawals ADD COLUMN commission_fcfa INT DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='withdrawals' AND column_name='net_amount') THEN
    ALTER TABLE withdrawals ADD COLUMN net_amount INT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='withdrawals' AND column_name='method') THEN
    ALTER TABLE withdrawals ADD COLUMN method TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='withdrawals' AND column_name='payment_method') THEN
    ALTER TABLE withdrawals ADD COLUMN payment_method TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='withdrawals' AND column_name='phone') THEN
    ALTER TABLE withdrawals ADD COLUMN phone TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='withdrawals' AND column_name='payment_details') THEN
    ALTER TABLE withdrawals ADD COLUMN payment_details JSONB;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='withdrawals' AND column_name='moneyfusion_token') THEN
    ALTER TABLE withdrawals ADD COLUMN moneyfusion_token TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='withdrawals' AND column_name='moneyfusion_moyen') THEN
    ALTER TABLE withdrawals ADD COLUMN moneyfusion_moyen TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='withdrawals' AND column_name='paid_at') THEN
    ALTER TABLE withdrawals ADD COLUMN paid_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='withdrawals' AND column_name='rejection_reason') THEN
    ALTER TABLE withdrawals ADD COLUMN rejection_reason TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'withdrawals') THEN
    CREATE INDEX IF NOT EXISTS idx_withdrawals_user ON withdrawals("user");
    CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON withdrawals(status);
    ALTER TABLE withdrawals ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "withdrawals_select_own" ON withdrawals;
    CREATE POLICY "withdrawals_select_own" ON withdrawals
      FOR SELECT USING (auth.uid() = "user");
    DROP POLICY IF EXISTS "withdrawals_insert_own" ON withdrawals;
    CREATE POLICY "withdrawals_insert_own" ON withdrawals
      FOR INSERT WITH CHECK (auth.uid() = "user");
    DROP POLICY IF EXISTS "withdrawals_update_own" ON withdrawals;
    CREATE POLICY "withdrawals_update_own" ON withdrawals
      FOR UPDATE USING (auth.uid() = "user");
    DROP POLICY IF EXISTS "withdrawals_admin_all" ON withdrawals;
    CREATE POLICY "withdrawals_admin_all" ON withdrawals
      FOR ALL USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
      );
    GRANT ALL ON withdrawals TO service_role;
  END IF;
END $$;


-- 3. POINTS_LEDGER — ajouter description
-- =============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'points_ledger') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='points_ledger' AND column_name='description') THEN
      ALTER TABLE points_ledger ADD COLUMN description TEXT;
    END IF;
  END IF;
END $$;


-- 4. DECLARATIONS — CHECK status + priority_until
-- =============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'declarations') THEN
    -- Supprimer ancien CHECK
    IF EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname LIKE '%declarations%status%'
        AND conrelid = 'declarations'::regclass
    ) THEN
      ALTER TABLE declarations DROP CONSTRAINT IF EXISTS declarations_status_check;
    END IF;
    -- Recréer CHECK
    ALTER TABLE declarations
      ADD CONSTRAINT declarations_status_check
      CHECK (status IN ('open','matched','closed','restitue','depose','returned','blocked'));
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'declarations') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='declarations' AND column_name='priority_until') THEN
      ALTER TABLE declarations ADD COLUMN priority_until TIMESTAMPTZ;
    END IF;
  END IF;
END $$;


-- 5. RPC debit_points_safe
-- =============================================================
CREATE OR REPLACE FUNCTION debit_points_safe(
  p_user UUID,
  p_amount INT,
  p_reason TEXT DEFAULT 'withdrawal',
  p_reference UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_points INT;
BEGIN
  SELECT points INTO current_points FROM users WHERE id = p_user;

  IF current_points IS NULL THEN
    RAISE EXCEPTION 'Utilisateur introuvable';
  END IF;

  IF current_points < p_amount THEN
    RAISE EXCEPTION 'Points insuffisants: % disponibles, % demandés', current_points, p_amount;
  END IF;

  UPDATE users SET points = points - p_amount WHERE id = p_user;

  INSERT INTO points_ledger ("user", amount, reason, reference_id)
  VALUES (p_user, -p_amount, p_reason, p_reference);

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION debit_points_safe(UUID, INT, TEXT, UUID) TO authenticated;


-- 6. RPC credit_points_safe
-- =============================================================
CREATE OR REPLACE FUNCTION credit_points_safe(
  p_user UUID,
  p_amount INT,
  p_reason TEXT DEFAULT 'bonus',
  p_reference UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE users SET points = points + p_amount, points_earned = points_earned + p_amount WHERE id = p_user;

  INSERT INTO points_ledger ("user", amount, reason, reference_id)
  VALUES (p_user, p_amount, p_reason, p_reference);

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION credit_points_safe(UUID, INT, TEXT, UUID) TO authenticated;


-- 7. DONATIONS — ajouter usr
-- =============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'donations') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='donations' AND column_name='usr') THEN
      ALTER TABLE donations ADD COLUMN usr UUID REFERENCES users(id) ON DELETE SET NULL;
    END IF;
  END IF;
END $$;


-- 8. PRO_ACCOUNTS — ajouter colonnes manquantes
-- =============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'pro_accounts') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pro_accounts' AND column_name='owner') THEN
      ALTER TABLE pro_accounts ADD COLUMN owner UUID REFERENCES users(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pro_accounts' AND column_name='org_type') THEN
      ALTER TABLE pro_accounts ADD COLUMN org_type TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pro_accounts' AND column_name='org_name') THEN
      ALTER TABLE pro_accounts ADD COLUMN org_name TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pro_accounts' AND column_name='org_description') THEN
      ALTER TABLE pro_accounts ADD COLUMN org_description TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pro_accounts' AND column_name='max_users') THEN
      ALTER TABLE pro_accounts ADD COLUMN max_users INT DEFAULT 5;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pro_accounts' AND column_name='contact_email') THEN
      ALTER TABLE pro_accounts ADD COLUMN contact_email TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pro_accounts' AND column_name='contact_phone') THEN
      ALTER TABLE pro_accounts ADD COLUMN contact_phone TEXT;
    END IF;
  END IF;
END $$;


-- 9. SUBSCRIPTIONS — ajouter renews_at
-- =============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'subscriptions') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='subscriptions' AND column_name='renews_at') THEN
      ALTER TABLE subscriptions ADD COLUMN renews_at TIMESTAMPTZ;
    END IF;
  END IF;
END $$;


-- 10. POINT_PURCHASES — ajouter colonnes manquantes
-- =============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'point_purchases') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='point_purchases' AND column_name='service') THEN
      ALTER TABLE point_purchases ADD COLUMN service TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='point_purchases' AND column_name='points_cost') THEN
      ALTER TABLE point_purchases ADD COLUMN points_cost INT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='point_purchases' AND column_name='fcfa_cost') THEN
      ALTER TABLE point_purchases ADD COLUMN fcfa_cost INT;
    END IF;
  END IF;
END $$;


-- 11. GIFT_ORDERS — ajouter colonnes manquantes
-- =============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'gift_orders') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='gift_orders' AND column_name='gift_type') THEN
      ALTER TABLE gift_orders ADD COLUMN gift_type TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='gift_orders' AND column_name='points_cost') THEN
      ALTER TABLE gift_orders ADD COLUMN points_cost INT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='gift_orders' AND column_name='delivery_info') THEN
      ALTER TABLE gift_orders ADD COLUMN delivery_info JSONB;
    END IF;
  END IF;
END $$;


-- 12. FCFA_SERVICES — créer si absent
-- =============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'fcfa_services') THEN
    CREATE TABLE fcfa_services (
      key TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT,
      points_cost INT NOT NULL DEFAULT 0,
      fcfa_cost INT NOT NULL DEFAULT 0,
      duration_days INT DEFAULT 30,
      description TEXT,
      active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT now()
    );
  END IF;

  ALTER TABLE fcfa_services ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "fcfa_services_public_read" ON fcfa_services;
  CREATE POLICY "fcfa_services_public_read" ON fcfa_services
    FOR SELECT USING (true);
  GRANT ALL ON fcfa_services TO service_role;
END $$;


-- 13. REALTIME notifications
-- =============================================================
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;


-- 14. SUBTITLES RLS
-- =============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'subtitles') THEN
    ALTER TABLE subtitles ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "subtitles_public_read" ON subtitles;
    CREATE POLICY "subtitles_public_read" ON subtitles FOR SELECT USING (true);
  END IF;
END $$;
