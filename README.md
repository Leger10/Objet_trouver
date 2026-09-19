# RetrouveMoi

Plateforme de restitution d'objets perdus ou retrouvés.

## 📋 Description

RetrouveMoi est une application web qui permet de déclarer des objets perdus ou retrouvés, de les rechercher et de faciliter leur restitution grâce à un système de vérification sécurisé.

## 🚀 Technologies

- **Frontend** : React 18, Tailwind CSS, Framer Motion
- **Backend** : Next.js API Routes, Better Auth, Prisma (MySQL), Cloudinary
- **Build** : Next.js
- **Hébergement** : Netlify

## ✨ Fonctionnalités

- 📱 Interface mobile-first
- 🔐 Authentification sécurisée (inscription, connexion, mot de passe oublié, changement de mot de passe)
- 🏷️ Catégorisation des objets
- 🔍 Recherche multicritère
- 📊 Système de points et récompenses
- 📑 Procès-verbaux de dépôt et restitution
- 🎨 Branding personnalisable
- 💳 Paiements MoneyFusion (dons, abonnements, mises en avant)
- 📧 Notifications en temps réel

---

# 📦 INSTALLATION COMPLÈTE

## 1. Prérequis

| Outil | Version minimale | Rôle |
|---|---|---|
| Node.js | 18+ | Runtime Next.js |
| npm | 9+ | Gestion des dépendances |
| MySQL | 8.0 | Base de données de l'application |
| Git | — | Récupération / versionnement du code |

**Options** :
- **XAMPP** ou **WAMP** (Windows) : fournit MySQL + phpMyAdmin en un clic.
- Un compte **Cloudinary** (gratuit) : stockage des images uploadées (logos, photos d'objets).
- Un compte **MoneyFusion** : activation des paiements (dons, abonnements, mise en avant). L'application fonctionne sans, mais les paiements seront désactivés.

## 2. Récupérer le projet

Depuis une archive/instantanné fournie (recommandé pour une vente) :
```bash
# Dézipper l'archive puis :
cd RetrouveMoi          # dossier racine du projet
```

Depuis Git :
```bash
git clone <URL_DU_DEPOT> RetrouveMoi
cd RetrouveMoi
```

## 3. Installer les dépendances

```bash
npm install
```
(`postinstall` génère automatiquement le client Prisma.)

## 4. Créer la base de données

Dans **phpMyAdmin** (ou MySQL CLI) :
1. Créez une base nommée par exemple `objet_trouver` (collation : `utf8mb4_general_ci`).
2. Créez un utilisateur dédié si besoin (ex. `app_user`).

L'URL de connexion doit ressembler à :
- Local (root sans mot de passe, XAMPP/WAMP par défaut) : `mysql://root:@127.0.0.1:3306/objet_trouver`
- Avec utilisateur/mot de passe : `mysql://app_user:MON_MOT_DE_PASSE@127.0.0.1:3306/objet_trouver`

## 5. Configurer l'environnement (`.env`)

```bash
cp .env.example .env
```
Puis éditez `.env` et remplissez **chaque valeur** :
- `DATABASE_URL` : votre URL MySQL (voir étape 4).
- `BETTER_AUTH_SECRET` / `BETTER_AUTH_ADMIN_KEY` : générez deux valeurs longues et uniques, par exemple :
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
  ```
- `CLOUDINARY_*` : les 3 clés de votre compte Cloudinary (Dashboard → API Keys).
- `VITE_MONEFUSION_*` : l'URL et la clé API transmises par MoneyFusion.
- `NEXT_PUBLIC_SITE_URL` : l'URL publique de l'application (`http://localhost:3000` en local, votre domaine en prod).
- `ONESIGNAL_*` : vos identifiants OneSignal (facultatif, notifications push).

> ⚠️ **Sécurité** : ne versionnez jamais le fichier `.env` (il est déjà dans `.gitignore`). Fournissez le `.env.example` à la place.

## 6. Initialiser les tables

```bash
# Applique le schéma Prisma à la base (crée toutes les tables)
npm run db:push

# Seed de base : 16 catégories (id = slug) + branding par défaut
npm run db:seed
```

> Si vous appliquez le schéma à une base déjà remplie, utilisez `npm run db:migrate`.
> Sans catégories ni branding seedés, la recherche et l'affichage resteront fonctionnels mais vides.

## 7. Lancer en développement

```bash
npm run dev
```
Ouvrez **http://localhost:3000**. L'application se recharge à chaque modification.

## 8. Lancer en production (test serveur local)

```bash
npm run build
npm run start
```

## 9. Déploiement en ligne

Le projet est prévu pour **Netlify** (`netlify.toml` déjà présent, build : `npm run build`).

```bash
# Connecter Netlify CLI (une fois)
netlify login

# Dans le dossier du projet, créer/relier le site
netlify init            # crée un nouveau site ou relie un existant

# Déployer en production
netlify deploy --prod --build
```

**Variables d'environnement à recréer sur Netlify** (Site settings → Environment variables) :
`DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_ADMIN_KEY`, `BETTER_AUTH_URL` (= domaine prod), `CLOUDINARY_*`, `VITE_MONEFUSION_*`, `NEXT_PUBLIC_*`, `ONESIGNAL_*`.

> ⚠️ En prod, mettez à jour `BETTER_AUTH_URL` et (dans `src/lib/server/auth.js`) la liste `trustedOrigins` avec votre domaine.

---

# 💼 PRÉPARATION POUR UNE VENTE / DÉMONSTRATION CLIENT

## Contenu du livrable (tout est fourni)

| Élément | Emplacement |
|---|---|
| Code source complet | racine du projet |
| Template d'environnement (**anonymisé**, sans secrets) | `.env.example` |
| Guide d'installation | ce fichier (`README.md`) |
| Script de sauvegarde de la base | `npm run db:export` |
| Script de données de démonstration | `npm run db:demo` |

## Scénario démo classique

1. **Base vierge** : créez une base MySQL, appliquez le schéma (`npm run db:push`).
2. **Seed** : `npm run db:seed` (catégories + branding) puis `npm run db:demo` (5 déclarations réalistes : CNI perdue, téléphone trouvé, portefeuille, vélo, clés).
3. **Lancer** : `npm run dev`, puis présentez :
   - l'accueil avec les déclarations récentes,
   - la recherche (ex. terme « CNI » ou filtre catégorie « CNI »),
   - une inscription + connexion réelles,
   - le formulaire de déclaration (perdu / retrouvé),
   - l'espace admin (compte `digihouse10@gmail.com` ou un compte promu admin, voir ci-dessous).

## Compte administrateur

Après une inscription, promouvez le compte en admin en base (une seule fois) :
```sql
UPDATE users SET role = 'admin' WHERE email = 'votre@email.com';
```
ou, si l'email configuré comme admin principal (`digihouse10@gmail.com`) est utilisé, il est promu automatiquement par l'application.

## Sauvegardes / transfert de la base

```bash
# Dump complet de la base locale vers backups/
npm run db:export

# Dump de la PROD (définit DATABASE_URL_PROD dans .env ou l'environnement)
npm run db:export prod
```

Le dump SQL créé dans `backups/` peut être réimporté sur n'importe quel MySQL :
```bash
mysql -u USER -p NOM_DE_BDD < backups/retrouvemoi_DATE.sql
```

> ⚠️ **Confidentialité en cas de vente** : un dump d'exploitation contient les vrais utilisateurs (emails, noms, téléphones). **Ne livrez pas les données réelles.** Pour une démo, partez d'une base vierge + `db:seed` + `db:demo`. Pour transmettre des données existantes, anonymisez-les d'abord (remplacer emails/noms/téléphones par des valeurs fictives).

## Données de démo (script `npm run db:demo`)

- Crée les catégories utilisées et le branding par défaut (si absents, sans écraser).
- Ajoute 5 déclarations de test marquées **[DÉMO]** (perdues : CNI, portefeuille ; retrouvées : téléphone, vélo, clés) sur Ouagadougou / Bobo-Dioulasso.
- N'efface aucune donnée existante ; les anciennes déclarations de démo sont nettoyées automatiquement (titre contenant `[DÉMO]`).
- En cas d'échec d'une déclaration (catégorie absente), elle est simplement ignorée.

---

# 🛠️ COMMANDES UTILES

| Commande | Rôle |
|---|---|
| `npm run dev` | Serveur de développement (hot reload) |
| `npm run build` | Build de production (compile + Prisma generate) |
| `npm run start` | Lance le build de production localement |
| `npm run db:push` | Applique le schéma Prisma (crée les tables) |
| `npm run db:migrate` | Migration Prisma (base existante) |
| `npm run db:studio` | Interface web Prisma Studio (naviguer/modifier les données) |
| `npm run db:seed` | Seed de base : catégories + branding |
| `npm run db:demo` | Ajoute des données de démonstration |
| `npm run db:export` | Backup SQL de la base locale |
| `npm run db:export prod` | Backup SQL de la prod (`DATABASE_URL_PROD`) |
| `npm run lint` | Vérification ESLint |

# 🚑 DÉPANNAGE

| Problème | Solution |
|---|---|
| `PrismaClientInitializationError` | Vérifiez `DATABASE_URL` (hôte/port/identifiants) et que MySQL tourne. |
| Conflit binaire Prisma sur Netlify | `binaryTargets` inclut déjà `rhel-openssl-3.0.x` dans `prisma/schema.prisma`. |
| Build EPERM sur Windows | Stoppez `npm run dev` avant `npm run build` (fichier DLL Prisma verrouillé). |
| Redirection après login | Vérifiez `NEXT_PUBLIC_SITE_URL` et `BETTER_AUTH_URL` (doivent rester synchronisés). |
| Paiements sans effet | Vérifiez `VITE_MONEFUSION_URL` / `VITE_MONEFUSION_API_KEY` et le compte marchand. |
| Recherche vide | Lancez `npm run db:seed` (les catégories sont liées par `id = slug`). |