# Checklist mise en production (Hostinger + Netlify)

App : **objettrouver.netlify.app** — repo `Leger10/Objet_trouver` (branch `main`).
Rappel : Netlify héberge l'app ; la base MySQL doit être **joignable sur Internet** (ici : Hostinger).

---

## 1. Créer la base MySQL chez Hostinger
1. hPanel → **Bases de données MySQL** → Créer une base + un utilisateur (mot de passe fort).
2. Noter : `host` (ex. `srv-XXXX.hostingersite.com`), `nom_base`, `user`, `mot_de_passe`, port `3306`.
3. **Activer l'accès à distance** pour les connexions depuis Netlify (hébergement partagé : « Remote MySQL » / whitelist d'IP — pour Netlify les IP AWS varient, autoriser largement ; sinon utiliser un VPS).
4. Test de connexion possible depuis ma machine avec le client MySQL.

## 2. Pousser le schéma vers la base distante (depuis ma machine)
```powershell
$env:DATABASE_URL="mysql://user:motdepasse@srv-XXXX.hostingersite.com:3306/nom_base"
npx prisma db push --skip-generate
npx prisma generate
```
> Crée toutes les tables (~29) une seule fois. Le `generate` doit se faire serveur Next arrêté (sinon EPERM sur Windows).

## 3. Variables d'environnement Netlify
`Site configuration → Environment variables` (puis redéploiement auto) :

| Variable | Valeur |
|---|---|
| `DATABASE_URL` | `mysql://user:motdepasse@srv-XXXX.hostingersite.com:3306/nom_base` |
| `BETTER_AUTH_SECRET` | une longue chaîne secrète (ex. celle du `.env` local, **décommentée**) |
| `BETTER_AUTH_URL` | `https://objettrouver.netlify.app` |
| `NEXT_PUBLIC_SITE_URL` | `https://objettrouver.netlify.app` |
| `NEXT_PUBLIC_APP_NAME` | `RetrouveMoi` |
| (optionnel) | `CLOUDINARY_*`, `ONESIGNAL_APP_ID`, `ONESIGNAL_REST_API_KEY`, `NEXT_PUBLIC_ONESIGNAL_APP_ID`, `VITE_MONEFUSION_API_KEY` |

⚠️ Sans `BETTER_AUTH_SECRET`, chaque function Lambda génère un secret aléatoire → déconnexions fréquentes.

## 4. Migrer les anciens utilisateurs (migration terminée / optionnelle)

La migration depuis l'ancien backend a été effectuée vers Better Auth + Prisma (MySQL) : les utilisateurs et mots de passe provisoires ont été réattribués lors de la bascule. Les anciens mots de passe ne sont **pas** réutilisables (Better Auth = scrypt) : chaque compte migré a reçu un mot de passe provisoire annoncé aux utilisateurs, avec réinitialisation possible.

Si une nouvelle re-migration est nécessaire :
- Exporter les lignes `users` depuis la base MySQL source (id, email, name, phone, city, quarter, referred_by…).
- Créer les comptes via Better Auth (inscription avec mot de passe provisoire).

## 5. Vérifications finales
- Ouvrir `https://objettrouver.netlify.app` → créer un compte + se connecter (nouveau compte OK).
- Se connecter avec un compte migré (`users-export`) + mot de passe provisoire.
- Tester : déclaration d'objet, recherche/match, admin (`digihouse10@gmail.com`), notifications, donations.
- Vérifier dans Netlify que le dernier commit (`main`) est bien le build publié.

## Notes annexes
- **Environnement de test provisoire (base locale)** : app sur ta machine + tunnel Cloudflare (`cloudflared.exe tunnel --url http://localhost:3000`). L'URL change à chaque redémarrage de cloudflared ; la machine doit rester allumée.
- La base passer de `127.0.0.1` à Hostinger ne demande **aucune** modification de code (tout passe par `DATABASE_URL`).