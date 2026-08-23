-- ════════════════════════════════════════════════════════════
-- SUPPRIMER les +10 points sur déclaration d'objet trouvé
-- Objectif : éviter les déclarations fausses pour gagner des points
-- Les points ne sont attribués qu'au moment de la restitution
-- ════════════════════════════════════════════════════════════

-- 1. Supprimer le trigger
DROP TRIGGER IF EXISTS trg_points_found ON declarations;

-- 2. Supprimer la fonction trigger
DROP FUNCTION IF EXISTS award_points_found_declaration();
