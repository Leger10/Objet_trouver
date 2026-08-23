-- ════════════════════════════════════════════════════════════
-- MIGRATION : Admin proximity matching
-- Ajoute le champ quarter aux admins + fonction de recherche
-- d'admin proche par ville/quartier
--
-- IMPORTANT : Exécuter fix-rls-broken.sql EN PREMIER si les
-- RLS sont cassées, puis ce script.
-- ════════════════════════════════════════════════════════════

-- 1. Ajouter le champ quarter à la table users
ALTER TABLE users ADD COLUMN IF NOT EXISTS quarter TEXT DEFAULT '';

-- 2. Index pour la recherche d'admin par ville/quartier
CREATE INDEX IF NOT EXISTS idx_users_role_city ON users(role, city);
CREATE INDEX IF NOT EXISTS idx_users_quarter ON users(quarter);

-- 3. Fonction : trouver l'admin le plus proche
-- Stratégie : même ville+même quartier → même ville → n'importe quel admin
-- SECURITY DEFINER = bypass RLS
CREATE OR REPLACE FUNCTION find_nearest_admin(
  p_city TEXT DEFAULT '',
  p_quarter TEXT DEFAULT ''
)
RETURNS TABLE (
  admin_id UUID,
  admin_name TEXT,
  admin_city TEXT,
  admin_quarter TEXT,
  admin_email TEXT,
  admin_phone TEXT,
  match_level TEXT
) AS $$
BEGIN
  -- 1. Chercher admin dans même ville + même quartier
  IF p_city != '' AND p_quarter != '' THEN
    RETURN QUERY
    SELECT u.id, u.name, u.city, u.quarter, u.email, u.phone, 'exact'::TEXT
    FROM users u
    WHERE u.role = 'admin'
      AND lower(u.city) = lower(p_city)
      AND lower(u.quarter) = lower(p_quarter)
    LIMIT 1;

    IF FOUND THEN RETURN; END IF;
  END IF;

  -- 2. Chercher admin dans même ville (n'importe quel quartier)
  IF p_city != '' THEN
    RETURN QUERY
    SELECT u.id, u.name, u.city, u.quarter, u.email, u.phone, 'city'::TEXT
    FROM users u
    WHERE u.role = 'admin'
      AND lower(u.city) = lower(p_city)
    LIMIT 1;

    IF FOUND THEN RETURN; END IF;
  END IF;

  -- 3. N'importe quel admin
  RETURN QUERY
  SELECT u.id, u.name, u.city, u.quarter, u.email, u.phone, 'any'::TEXT
  FROM users u
  WHERE u.role = 'admin'
  LIMIT 1;
END;
$$ LANGUAGE plpgsql STABLE;
