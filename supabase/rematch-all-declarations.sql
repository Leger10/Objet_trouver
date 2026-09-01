-- ============================================================
-- REMATCH GLOBAL : correspondent TOUTES les déclarations
-- Collez et exécutez dans :
-- https://supabase.com/dashboard/project/uudgiamuqutgljakelkb/sql/new
-- ============================================================
--
-- PROBLÈME CORRIGÉ AU PASSAGE : un trigger "webhook" cassé sur la table
-- `matches` appelait net.http_post() (schéma `net` inexistant) et faisait
-- échouer CHAQUE création de correspondance ("schema net does not exist",
-- 3F000). Ce script supprime ce trigger bloquant.
--
-- ENSUITE : porte fidèlement le matching de src/lib/retrouve.js
-- (scoreMatch + bulkRematch) :
--   * score 0-100 (catégorie obligatoire, ville, zone, date, nom, ID doc, description)
--   * correspondance créée si score >= 25
--   * notifications aux deux propriétaires (perdu + retrouvé)
--   * statut des deux déclarations passé en 'matched'
--
-- ⚠️ JAMAIS DE DOUBLONS : déjà-traité (paires déjà présentes) ignoré.

-- ── 0. DIAGNOSTIC (facultatif) ──────────────────────────────
-- SELECT tgname, pg_get_triggerdef(oid) FROM pg_trigger
-- WHERE tgrelid = 'public.matches'::regclass AND NOT tgisinternal;

-- ── 1. SUPPRIMER les triggers applicatifs cassés sur matches ──
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN
    SELECT tgname FROM pg_trigger
    WHERE tgrelid = 'public.matches'::regclass AND NOT tgisinternal
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.matches', t);
    RAISE NOTICE 'Trigger supprimé sur matches: %', t;
  END LOOP;
END $$;

-- ── 2. Recréer le trigger légitime de points (si la fonction existe) ──
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'award_points_match_confirmed')
     AND NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_points_match' AND tgrelid = 'public.matches'::regclass)
  THEN
    CREATE TRIGGER trg_points_match
      AFTER UPDATE ON public.matches
      FOR EACH ROW EXECUTE FUNCTION award_points_match_confirmed();
    RAISE NOTICE 'trg_points_match recréé';
  END IF;
END $$;

-- ── 3. Fonctions de scoring (portage exact de retrouve.js) ──

-- Normalise : minuscules + trim + suppression des accents
CREATE OR REPLACE FUNCTION f_norm(v TEXT) RETURNS TEXT
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE s TEXT;
BEGIN
  s := lower(btrim(coalesce(v, '')));
  s := translate(s, 'àâä', 'aaa');
  s := translate(s, 'éèêë', 'eeee');
  s := translate(s, 'îï',  'ii');
  s := translate(s, 'ôö',  'oo');
  s := translate(s, 'ùûü', 'uuu');
  s := translate(s, 'ç',   'c');
  s := translate(s, 'ÿ',   'y');
  s := translate(s, 'ñ',   'n');
  RETURN s;
END $$;

-- nameOverlap : intersection des mots (longueur > 2) / max(lenA,lenB)
CREATE OR REPLACE FUNCTION f_nameoverlap(a TEXT, b TEXT) RETURNS numeric
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  arrA TEXT[]; arrB TEXT[]; uniqB TEXT[]; wa TEXT;
  hits INT := 0; nA INT; nB INT;
BEGIN
  SELECT array_agg(t.x) INTO arrA FROM (
    SELECT x FROM unnest(string_to_array(regexp_replace(f_norm(a), '[^a-z0-9]+', ' ', 'g'), ' ')) AS t(x) WHERE x <> ''
  ) t;
  SELECT array_agg(t.x) INTO arrB FROM (
    SELECT x FROM unnest(string_to_array(regexp_replace(f_norm(b), '[^a-z0-9]+', ' ', 'g'), ' ')) AS t(x) WHERE x <> ''
  ) t;
  nA := coalesce(array_length(arrA, 1), 0);
  nB := coalesce(array_length(arrB, 1), 0);
  IF nA = 0 OR nB = 0 THEN RETURN 0; END IF;
  SELECT array_agg(DISTINCT x) INTO uniqB FROM unnest(arrB) AS x;
  FOREACH wa IN ARRAY arrA LOOP
    IF character_length(wa) > 2 AND wa = ANY(uniqB) THEN hits := hits + 1; END IF;
  END LOOP;
  RETURN hits::numeric / greatest(nA, nB);
END $$;

-- wordOverlap : Set de mots (longueur > 3) unique / max(taille A, taille B)
CREATE OR REPLACE FUNCTION f_wordoverlap(a TEXT, b TEXT) RETURNS numeric
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  setA TEXT[]; setB TEXT[]; wa TEXT;
  hits INT := 0; nA INT; nB INT;
BEGIN
  SELECT array_agg(DISTINCT t.x) INTO setA FROM (
    SELECT x FROM regexp_split_to_table(regexp_replace(f_norm(a), '[^a-z0-9]+', ' ', 'g'), ' ') AS t(x)
    WHERE character_length(x) > 3
  ) t;
  SELECT array_agg(DISTINCT t.x) INTO setB FROM (
    SELECT x FROM regexp_split_to_table(regexp_replace(f_norm(b), '[^a-z0-9]+', ' ', 'g'), ' ') AS t(x)
    WHERE character_length(x) > 3
  ) t;
  nA := coalesce(array_length(setA, 1), 0);
  nB := coalesce(array_length(setB, 1), 0);
  IF nA = 0 OR nB = 0 THEN RETURN 0; END IF;
  FOREACH wa IN ARRAY setA LOOP
    IF wa = ANY(setB) THEN hits := hits + 1; END IF;
  END LOOP;
  RETURN hits::numeric / greatest(nA, nB);
END $$;

-- scoreMatch(lost_id, found_id) -> {"total": <0-100>, "breakdown": {...}}
CREATE OR REPLACE FUNCTION f_score(lid UUID, fid UUID) RETURNS jsonb
LANGUAGE plpgsql STABLE AS $$
DECLARE
  lr public.declarations%ROWTYPE; fr public.declarations%ROWTYPE;
  cat INT; ville INT; zone INT; dat INT; nom INT; idf INT; descp INT; total INT;
  days numeric;
BEGIN
  SELECT * INTO lr FROM public.declarations WHERE id = lid;
  SELECT * INTO fr FROM public.declarations WHERE id = fid;
  IF lr.category IS NULL OR lr.category <> fr.category THEN
    RETURN jsonb_build_object('total', 0, 'breakdown', jsonb_build_object('categorie', 0));
  END IF;
  cat := 20;
  ville := CASE WHEN f_norm(lr.city) <> '' AND f_norm(lr.city) = f_norm(fr.city) THEN 15 ELSE 0 END;
  zone  := CASE WHEN f_norm(lr.zone)  <> '' AND f_norm(lr.zone)  = f_norm(fr.zone)  THEN 15 ELSE 0 END;
  dat := 0;
  IF lr.event_date IS NOT NULL AND fr.event_date IS NOT NULL THEN
    days := abs(extract(epoch FROM (lr.event_date::timestamp - fr.event_date::timestamp)) / 86400.0);
    dat := CASE WHEN days <= 2 THEN 10 WHEN days <= 7 THEN 7 WHEN days <= 30 THEN 4 ELSE 0 END;
  END IF;
  nom := round(f_nameoverlap(lr.person_name, fr.person_name) * 20);
  idf := CASE WHEN coalesce(lr.doc_last4, '') <> '' AND lr.doc_last4 = fr.doc_last4 THEN 15 ELSE 0 END;
  descp := round(f_wordoverlap(
    coalesce(lr.title,'') || ' ' || coalesce(lr.description,'') || ' ' || coalesce(lr.brand,'') || ' ' || coalesce(lr.color,''),
    coalesce(fr.title,'') || ' ' || coalesce(fr.description,'') || ' ' || coalesce(fr.brand,'') || ' ' || coalesce(fr.color,'')
  ) * 5);
  total := least(100, greatest(0, cat + ville + zone + dat + nom + idf + descp));
  RETURN jsonb_build_object('total', total, 'breakdown', jsonb_build_object(
    'categorie', cat, 'ville', ville, 'zone', zone,
    'date', dat, 'nom', nom, 'identifiant', idf, 'description', descp
  ));
END $$;

-- ── 4. REMATCH GLOBAL (toutes les paires perdu × retrouvé) ──
DO $$
DECLARE
  r RECORD; s RECORD;
  sc jsonb; total INT; breakdown jsonb;
  created INT := 0; skipped INT := 0;
BEGIN
  FOR r IN
    SELECT id, owner, category, title FROM public.declarations
    WHERE kind = 'lost' AND status NOT IN ('returned', 'blocked')
  LOOP
    FOR s IN
      SELECT id, owner, category, title FROM public.declarations
      WHERE kind = 'found' AND status NOT IN ('returned', 'blocked')
    LOOP
      sc := f_score(r.id, s.id);
      total := (sc->>'total')::int;
      IF total < 25 THEN CONTINUE; END IF;
      IF EXISTS (SELECT 1 FROM public.matches m WHERE m.lost = r.id AND m.found = s.id) THEN
        skipped := skipped + 1;
        CONTINUE;
      END IF;
      breakdown := sc->'breakdown';

      INSERT INTO public.matches (lost, found, score, breakdown, status)
      VALUES (r.id, s.id, total, breakdown, 'suggested');
      created := created + 1;

      UPDATE public.declarations
      SET status = 'matched'
      WHERE id IN (r.id, s.id) AND status NOT IN ('returned', 'blocked');

      INSERT INTO public.notifications ("user", title, body, link)
      SELECT r.owner,
             'Objet retrouvé ! (' || total || '%)',
             'Un objet "' || coalesce(s.title, '') || '" correspond à votre déclaration "' || coalesce(r.title, '') || '".' ||
             E'\n\nPrésentez-vous avec une pièce d''identité pour récupérer votre objet.',
             '/objet/' || r.id
      WHERE NOT EXISTS (
        SELECT 1 FROM public.notifications nt
        WHERE nt."user" = r.owner AND nt.link = '/objet/' || r.id AND nt.title LIKE 'Objet retrouvé !%'
      );

      INSERT INTO public.notifications ("user", title, body, link)
      SELECT s.owner,
             'Votre objet "' || coalesce(s.title, '') || '" correspond à une déclaration de perte (' || total || '%)',
             'Une personne a déclaré la perte de "' || coalesce(r.title, '') || '".' ||
             E'\n\nVeuillez déposer l''objet chez l''administrateur le plus proche. Une pièce d''identité sera demandée.',
             '/objet/' || s.id
      WHERE NOT EXISTS (
        SELECT 1 FROM public.notifications nt
        WHERE nt."user" = s.owner AND nt.link = '/objet/' || s.id AND nt.title LIKE 'Votre objet %'
      );
    END LOOP;
  END LOOP;
  RAISE NOTICE '=== REMATCH TERMINÉ: % correspondance(s) créée(s), % déjà existante(s) ===', created, skipped;
END $$;

-- ── 5. VÉRIFICATION ──
SELECT m.lost, m.found, m.score, m.status,
       l.title AS titre_perdu, f.title AS titre_retrouve
FROM public.matches m
LEFT JOIN public.declarations l ON l.id = m.lost
LEFT JOIN public.declarations f ON f.id = m.found
ORDER BY m.score DESC;