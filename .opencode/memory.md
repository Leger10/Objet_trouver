# MEMOIRE PROJET — Retrouveobjet (objettrouver.netlify.app)

## ARCHITECTURE (validée par l'utilisateur)
Next.js 15 + React 18 + better-auth (auth) + Prisma ORM (MySQL Hostinger) + Cloudinary (médias).
Aucun service Supabase réel. @supabase/supabase-js = dep morte (package.json:26), importe 0 fois.

## CONTEXTE SUPABASE (DÉCISION USER : RETRAIT COMPLET + renforcer option URL vidéo longue)
- src/lib/supabaseClient.js (439 lignes) = SHIM LOCAL qui expose pb (PocketBase-compatible) +
  facade supabase (auth→better-auth, from()/rpc()→routes /api/pb Prisma, storage→Cloudinary)
  et pb.supabase (stockage). Tout route via Next API (pbApi+QueryBuilder), PAS de vrai Supabase.
- Tous les imports: @/lib/supabaseClient (~25 fichiers) + @/lib/supabaseClient dans install
  components/hooks (InstallBanner/Popup/FloatingButton, useInstallPrompt) via import dynamique.
- env SUPABASE_* (VITE_SUPABASE_URL etc.) dans env.js, .env, HeroRotator.jsx (a ramener).
- Files a editer pour le retrait complet: creer src/lib/pbClient.js single, purger exports
  supabase/supabaseAuth/supabaseStorage/pb.supabase, maj imports+usages, retirer SDK + env SUPABASE.

## ETAT ACTUEL DETAILLE
- Build NEXT_OK local (retry dev sur :3000). Deploy Netlify dernier = 3673b9f (build 6aaadc6a, pret).
  - Site ID: 92be6173-fa94-486a-802f-f54617189a87 ; PAT dans C:\WINDOWS\TEMP\opencode\netlify_token.txt
  - URL prod: https://objettrouver.netlify.app
- En prod: hero 1 image (66a75efd...), sponsors: bonplaninfos (logo_file=logo-1789578117768.jpg,
  format nom de fichier casse -> a re-uploader), SaveWard Africa (logo_file=logo-1789578205130.png, idem).
  Appels /api/pb getFullList OK en prod. Videos: mp4 788Ko+png OK via prod /api/upload (Cloudinary),
  8-26MB pizzes -> 400 (invalide/cloudinary pas la limite), Netlify transmet: taille non-bloquante.
  -> defaut = upload differe ADC (AdminHeroPage upload-sur-pick new/expo, erreur visible, 25 Mo max),
     HeroRotator filtre slides sans media reel + NOW Ken Burns continu, resolveLogo passthrough http.
- Local: DB MySQL UP (3306), prisma OK, serveur dev :3000 relance (debug :3001 arrete).

## ACL: 
- Il n'y a AUCUN suppabase "moteur réel" : tout l'objet supabase* est un shim. Donc pas de migration.
- Action du moment: TUPLED list "Retrait complet" (todowrite) -> etapes: pbClient unique; purge
  supabaseClient.js; purger SDK/env; URL longue via option URL; build+lint+commit+push+deploy+verif prod.
