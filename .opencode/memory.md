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

## BUG RECHERCHE (COMMIT d672df2, déployé 6aadc3f4, live)
- Symptôme : la recherche de déclarations (~/rechercher) ne renvoyait rien en prod.
- Cause : expansion `expand: "category"` (utilisée aussi par Home/Admin/Dashboard/Declaration/
  EditDeclaration/Correspondances). Règle EXPAND_RULES.declarations.category a `keyCol:'slug'`
  mais PAS de `key` ; expandItems faisait `where: { [rule.key]: {in: values} }` = `{ undefined: ...}`
  → PrismaValidationError 500 → catch → liste vide. Masqué en local car table declarations vide.
- Fix : `const queryKey = rule.key || rule.keyCol` avant findMany (déclaration stocke le SLUG dans
  category). Vérif : local 200, puis prod 200 (1 décla "CNI perdu(e) à Karpala", status open).
- Note données : table `categories` VIDE (locale + prod) ; slugs fonctionnent via CATEGORY_GROUPS en
  fallback UI. Si vrais filtres catégorie requis → seed categories.

## PAIEMENTS MONEYFUSION (COMMIT 02d9b86 + 977afb3, déployés)
- Bug #1 (500 /api/pb onBeforePay) : colonne payments.moneyfusion_token @unique ; les flux
  PaymentMethodPicker (Donate/ProAccounts/Subscriptions/Rewards) créaient le record pending AVANT
  initPayment avec token "" -> collision UNIQUE. Fix : createPendingPayment n'écrit plus le token s'il
  est vide, stocke rec.id dans sessionStorage "mf_pending_payment_id", et linkPendingPaymentToken(token)
  rattache le vrai token après initPayment (appelé dans PaymentMethodPicker). webhook/activate-payment
  matchent par moneyfusionToken => les paiements sont enfin retrouvés.
- Bug #2 : DeclarePage:290 / PremiumPage:110 écrivaient `|| ""` -> passés à `|| null`.
- Bug #3 : pro_accounts.create manquait business_name (NOT NULL sans défaut) -> ajouté aux 4 payloads
  (create/update online + ussd + confirmPayment) dans ProAccountsPage.
- Don anonyme : PaymentMethodPicker a une prop nameRequired (défaut true) ; DonatePage passe
  nameRequired={identity !== "identified"} -> champ nom masqué, nom "Anonyme" envoyé à MoneyFusion.
- Vérif prod : /api/pb create payments (token null) = 200 ; /api/auth/get-session = 200 ; sign-in invalide
  = 401 (normal) ; chunks déployés contiennent "Anonyme" + "mf_pending_payment_id".
- Reliquat : 1 ligne payments pendante avec token "" (id 9dba8aa4..., "Mise en avant") en prod, inoffensive.
- Erreurs console login-manager/domain.ts ("can only be used on retrouvemoi.netlify.app") = extension
  navigateur, PAS notre code (layout.jsx n'a que Google Fonts).

## ETAT ACTUEL DETAILLE (mis à jour)
- Build NEXT_OK local (Attention: stopper `next dev` avant `npm run build` -> DLL Prisma verrouillée/EPERM).
- Deploy Netlify dernier = d672df2 (build 6aadc3f4, live). Site: 92be6173-fa94-486a-802f-f54617189a87.
  URL prod: https://objettrouver.netlify.app. Deploys ont parfois échoué (plugin nextjs onEnd) -> retenter.
- Retrait Supabase TERMINE (commit bf63f6f) : README, public/sw.js, .gitignore, deno.lock, dev.mjs, deploy
  doc, logger cleanup, ENV purgé. pas de fichiers supabase/ ; import-supabase-users.mjs supprimé.
- Fix prisma prod (c7b9714) : prisma/schema.prisma binaryTargets = ["native","rhel-openssl-3.0.x"] (DB
  plantait en prod sur Linux, OK en local Windows).
- ENV .env local still present: DATABASE_URL prod Hostinger (u674176903_digihouse10 / pw @Digihouse10@2026
  / srv1231.hstgr.io / u674176903_objettrouve). VITE_SUPABASE_* restent dans l'env Netlify (obsolète,
  inoffensif, à purger optionnellement).
- Local: DB MySQL (root:@127.0.0.1/objet_trouver).
- ACL: AUCUN supabase réel, tout est shim -> pas de migration.
