-- ============================================================
-- FIX URGENT : correspondances (matches) totalement bloquées
-- Collez et exécutez dans :
-- https://supabase.com/dashboard/project/uudgiamuqutgljakelkb/sql/new
-- ============================================================
--
-- SYMPTÔME : la table `matches` est vide. Tout INSERT avec une vraie
-- `found` échoue avec :  schema "net" does not exist (3F000)
-- CAUSE : un trigger de type "Database Webhook" (probablement créé dans
--         le dashboard) appelle net.http_post() de pg_net, mais le
--         schéma `net` / l'extension pg_net ne sont PAS installés.
--         Le trigger casse donc CHAQUE création de correspondance.
--
-- EFFET : runMatching() échoue silencieusement → aucune correspondance
--         n'apparaît, aucune alerte "Objet retrouvé !" au propriétaire.

-- 0. DIAGNOSTIC (facultatif) : voir le trigger à l'origine du blocage
SELECT tgname, pg_get_triggerdef(oid) AS definition
FROM pg_trigger
WHERE tgrelid = 'public.matches'::regclass
  AND NOT tgisinternal;

-- 1. SUPPRIMER TOUS les triggers applicatifs sur matches
--    (le seul légitime est trg_points_match sur AFTER UPDATE ; on le recrée en fin de fichier)
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN
    SELECT tgname FROM pg_trigger
    WHERE tgrelid = 'public.matches'::regclass
      AND NOT tgisinternal
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.matches', t);
    RAISE NOTICE 'Trigger supprimé sur matches: %', t;
  END LOOP;
END $$;

-- 2. (si le webhook dashboard a créé une fonction) la supprimer aussi
--    Remplacez <nom_de_la_fonction> par celle listée à l'étape 0 si besoin.
-- DROP FUNCTION IF EXISTS public.<nom_de_la_fonction> CASCADE;

-- 3. Recréer le trigger légitime de points (après UPDATE sur matches)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_points_match' AND tgrelid = 'public.matches'::regclass) THEN
    CREATE TRIGGER trg_points_match
      AFTER UPDATE ON public.matches
      FOR EACH ROW EXECUTE FUNCTION award_points_match_confirmed();
    RAISE NOTICE 'trg_points_match recréé';
  END IF;
END $$;

-- 4. VÉRIFICATION : l'insertion doit fonctionner (doit renvoyer une ligne)
-- INSERT INTO public.matches (lost, found, score, breakdown, status)
-- VALUES ('<uuid_lost>', '<uuid_found>', 83, '{}'::jsonb, 'suggested')
-- RETURNING id;

-- ============================================================
-- NE PAS EXÉCUTER AVANT D'AVOIR CONFIGURÉ LE TRIGGER — SINON CORRIGE
-- DIRECTEMENT LE CAS « Awa Camara » (declaration perdue b45f199c,
-- retrouvée 54743333, score 83) : correspondance + alerte.
-- ============================================================
INSERT INTO public.matches (lost, found, score, breakdown, status)
SELECT
  'b45f199c-0e7c-4dfc-81e5-ac91f9568bfa',
  '54743333-6eae-41ad-b41b-8a7b1b1de846',
  83,
  '{"categorie":20,"ville":15,"zone":15,"date":10,"nom":20,"identifiant":0,"description":3}'::jsonb,
  'suggested'
WHERE NOT EXISTS (
  SELECT 1 FROM public.matches
  WHERE lost = 'b45f199c-0e7c-4dfc-81e5-ac91f9568bfa'
    AND found = '54743333-6eae-41ad-b41b-8a7b1b1de846'
);

-- Alerte au propriétaire de la déclaration PERDUE (comme le ferait onMatchFound)
INSERT INTO public.notifications ("user", title, body, link)
SELECT
  d.owner,
  'Objet retrouvé ! (83%)',
  E'Un objet "Enfant égaré retrouvé(e) : Awa Camara — Karpala , Ouagadougou" correspond à votre déclaration "Enfant égaré : Awa   Camara — Karpala, Ouagadougou".\n\nPrésentez-vous avec une pièce d''identité pour récupérer votre objet.',
  '/objet/b45f199c-0e7c-4dfc-81e5-ac91f9568bfa'
FROM public.declarations d
WHERE d.id = 'b45f199c-0e7c-4dfc-81e5-ac91f9568bfa';

-- Mettre à jour le statut de la déclaration perdue
UPDATE public.declarations
SET status = 'matched'
WHERE id = 'b45f199c-0e7c-4dfc-81e5-ac91f9568bfa'
  AND status = 'open';