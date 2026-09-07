# Test, Build et Déploiement d'H Editor

Guide complet pour **débutants** : tester l'app en local sur Windows, produire un build de production, puis la déployer sur un VPS Hostinger géré par **Coolify**, derrière **Nginx**, à l'URL `https://hylst.fr/heditor/`.

---

## Sommaire

- [A. Tester en local (Windows)](#a-tester-en-local-windows)
- [B. Build production (statique)](#b-build-production-statique)
- [C. Déploiement sur VPS Hostinger avec Coolify + Nginx](#c-déploiement-sur-vps-hostinger-avec-coolify--nginx)
- [D. Alternatives plus simples](#d-alternatives-plus-simples)
- [E. Dépannage](#e-dépannage)

---

## A. Tester en local (Windows)

### A.1 Prérequis

| Outil | Version | Lien |
|-------|---------|------|
| **Node.js** | ≥ 18 (recommandé 20 LTS) | <https://nodejs.org/> |
| **Git** | dernière | <https://git-scm.com/download/win> |
| Un terminal | **PowerShell** (inclus dans Windows) ou Git Bash | — |

Vérifier l'installation :

```powershell
node --version    # doit afficher v18.x.x ou plus
npm --version     # doit afficher 9.x.x ou plus
git --version
```

### A.2 Récupérer le projet

**Option 1 — Cloner avec Git** (recommandé) :

```powershell
cd D:\0CODE\ClaudeCode
git clone https://github.com/hylst/editorx.git editorx
cd editorx
```

**Option 2 — Télécharger un ZIP** depuis GitHub, le dézipper, ouvrir un terminal PowerShell dans le dossier.

### A.3 Installer les dépendances

```powershell
npm install
```

> Durée : 1 à 3 minutes selon connexion. Cela télécharge environ 400 MB de paquets dans `node_modules/`. C'est normal et **ne doit pas être committé** (il y a un `.gitignore` qui l'exclut).

### A.4 Lancer le serveur de développement

```powershell
npm run dev
```

Le terminal affiche :
```
  VITE v5.4.19  ready in 432 ms

  ➜  Local:   http://localhost:8080/heditor/
  ➜  Network: http://192.168.x.x:8080/heditor/
```

Ouvrir **<http://localhost:8080/heditor/>** dans votre navigateur (Chrome ou Edge recommandés pour la File System Access API).

> ⚠️ Le `/heditor/` final est **important** : l'app est configurée pour être servie sous ce sous-chemin (`base: '/heditor/'` dans `vite.config.ts`). Sans le `/heditor/`, vous obtiendrez une page blanche ou un 404.

### A.5 Tester les fonctionnalités

Une fois l'app ouverte, vérifier rapidement :

- [ ] Créer un nouveau fichier (`Ctrl+N`), taper du code
- [ ] Coloration syntaxique active
- [ ] Sauvegarder (`Ctrl+S`)
- [ ] Recharger la page → le fichier doit toujours être là (persistance localStorage)
- [ ] Tester la palette de commandes (`Ctrl+Shift+P`)
- [ ] Tester le mode Zen (`F11` ou `Ctrl+K Z`)
- [ ] Importer un ZIP (bouton dans la sidebar)
- [ ] Exporter le projet en ZIP

### A.6 Arrêter le serveur

Dans le terminal qui exécute `npm run dev` : `Ctrl+C` puis confirmer.

---

## B. Build production (statique)

### B.1 Construire le bundle

```powershell
npm run build
```

Sortie attendue :
```
✓ 2451 modules transformed.
dist/index.html                   2.45 kB
dist/assets/index-DnK7s9pQ.css   42.18 kB
dist/assets/index-Cj9XpL4f.js   1842.31 kB
✓ built in 18.42s
```

Le dossier **`dist/`** contient tout ce qui doit être déployé.

### B.2 Inspecter le résultat

```powershell
dir dist
dir dist\assets
```

Structure typique :
```
dist/
├── index.html
├── og-image.png        (si vous l'avez placé dans public/)
├── favicon.ico
└── assets/
    ├── index-[hash].js
    ├── index-[hash].css
    └── ...
```

Ouvrir `dist/index.html` dans un éditeur et vérifier que les chemins commencent par `/heditor/assets/...` (preuve que `base: '/heditor/'` est bien appliqué).

### B.3 Tester le build en local

```powershell
npm run preview
```

Sortie :
```
  ➜  Local:   http://localhost:4173/heditor/
```

Ouvrir **<http://localhost:4173/heditor/>**. Vous testez **exactement** le bundle qui sera déployé. Si ça marche ici, ça marchera sur le serveur (à la config Nginx près).

---

## C. Déploiement sur VPS Hostinger avec Coolify + Nginx

### C.1 État préalable supposé

- ✅ VPS Hostinger actif avec **Coolify** installé
- ✅ Domaine `hylst.fr` pointé vers l'IP du VPS (enregistrement DNS A/AAAA)
- ✅ Coolify gère déjà au moins un site (le site principal `hylst.fr`)
- ✅ HTTPS fonctionne (Let's Encrypt géré par Coolify ou Traefik)

### C.2 Choix de la stratégie

H Editor est un **site 100 % statique** — pas de Node, pas de Docker à exécuter. Deux options :

**Option 1 (recommandée pour `hylst.fr/heditor`)** : déposer les fichiers statiques dans un dossier servi par le Nginx du site principal, sous le `location /heditor/`.

**Option 2 (plus simple, URL différente)** : créer un service "Static Site" séparé dans Coolify, exposé sur le sous-domaine `app.hylst.fr`. Aucune modif Nginx du site principal.

Le reste de cette section couvre l'**Option 1**.

### C.3 Préparer les fichiers à uploader

Sur votre machine Windows :

```powershell
npm run build
```

Le dossier `dist/` contient les fichiers à uploader. Compresser pour upload plus rapide (optionnel) :

```powershell
Compress-Archive -Path dist\* -DestinationPath editorx-dist.zip
```

### C.4 Uploader sur le VPS

Plusieurs méthodes possibles. Trois choix selon votre préférence :

#### Méthode 1 — Coolify File Manager (le plus simple)
1. Coolify UI → votre site `hylst.fr` → onglet "Files" / "Storage"
2. Naviguer ou créer le dossier `/var/www/hylst/heditor/` (le chemin exact dépend de votre setup Coolify)
3. Upload du contenu de `dist/`

#### Méthode 2 — SFTP (FileZilla, WinSCP)
1. Hostinger fournit les identifiants SSH dans son dashboard
2. Se connecter en SFTP au VPS
3. Uploader le contenu de `dist/` vers `/var/www/hylst/heditor/`

#### Méthode 3 — SCP en ligne de commande
```powershell
scp -r dist/* user@VOTRE_IP_VPS:/var/www/hylst/heditor/
```

> Le chemin `/var/www/hylst/heditor/` est un exemple. Adaptez selon où Coolify sert votre site `hylst.fr`. Vous pouvez le trouver via l'UI Coolify ou en SSH avec `nginx -T | grep root`.

### C.5 Configurer Nginx pour servir `/heditor`

Éditer la configuration Nginx du site `hylst.fr`. Selon votre setup Coolify, cela peut se faire :

- **Via Coolify UI** : "Custom Nginx Configuration" dans les paramètres du site
- **En SSH** : éditer `/etc/nginx/sites-available/hylst.fr.conf` (ou similaire)

Ajouter ce bloc **dans** le `server { ... }` qui gère `hylst.fr` en HTTPS :

```nginx
server {
    listen 443 ssl http2;
    server_name hylst.fr;

    # ... votre config existante du site principal ...
    root /var/www/hylst/public;   # exemple — à adapter
    index index.html;

    # ─── H Editor servi sous /heditor/ ───────────────────────────
    location /heditor/ {
        alias /var/www/hylst/heditor/;
        index index.html;
        # SPA fallback : toute route inconnue retourne index.html
        try_files $uri $uri/ /heditor/index.html;

        # Cache long pour les assets hashés (immuables)
        location ~* /heditor/assets/.*\.(js|css|woff2?|svg|png|jpg|jpeg|gif|ico)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }
    # ────────────────────────────────────────────────────────
}
```

> **Pourquoi `try_files ... /heditor/index.html` ?** Parce qu'H Editor est une SPA React. Si quelqu'un recharge la page sur `https://hylst.fr/heditor/settings` (par exemple), Nginx ne doit pas chercher un fichier `settings` qui n'existe pas — il doit renvoyer `index.html` et laisser React Router gérer.

### C.6 Tester et recharger Nginx

```bash
# En SSH sur le VPS
sudo nginx -t                    # teste la syntaxe — doit dire "syntax is ok" + "test is successful"
sudo systemctl reload nginx      # recharge sans couper le service
```

Si vous passez par Coolify UI, cliquer simplement sur "Redeploy" ou "Apply" du site.

### C.7 Tester en production

Ouvrir **<https://hylst.fr/heditor/>** dans un navigateur.

Tests à effectuer :
- [ ] La page se charge, l'éditeur s'affiche
- [ ] Naviguer dans l'éditeur (créer fichier, taper, sauver)
- [ ] **Recharger la page (F5)** — ne doit PAS retourner 404 (preuve que `try_files` marche)
- [ ] Vérifier dans les DevTools Network que les assets sont en `200 OK` (pas de 404)
- [ ] Vérifier que les en-têtes `Cache-Control: public, immutable` sont présents sur les assets

### C.8 Mises à jour ultérieures

À chaque évolution du code :

1. Sur votre machine Windows : `git pull` puis `npm install` (si dépendances changées) puis `npm run build`
2. Upload du contenu de `dist/` dans `/var/www/hylst/heditor/` (écrase les anciens)
3. Pas besoin de recharger Nginx (sauf changement de config)
4. Les utilisateurs récupèrent automatiquement la nouvelle version au prochain chargement (les noms d'assets sont hashés, donc pas de cache à invalider manuellement)

---

## D. Alternatives plus simples

Si la config Nginx vous intimide, voici des options qui marchent en 2 minutes :

### D.1 Sous-domaine `app.hylst.fr` via Coolify

1. Dans Coolify : "New Resource" → "Static Site"
2. Pointer vers le dépôt Git du projet (ou upload manuel de `dist/`)
3. Build command : `npm run build`
4. Publish directory : `dist`
5. Domaine : `app.hylst.fr`

⚠️ Si vous adoptez cette option, il faut **annuler** la config sous-chemin :
- Dans `vite.config.ts` : `base: '/'` (au lieu de `/heditor/`)
- Dans `src/App.tsx` : retirer `basename="/heditor"`

### D.2 Hébergement statique gratuit

Tous acceptent un drag & drop du dossier `dist/` :

- **Netlify** — <https://app.netlify.com/drop>
- **Vercel** — <https://vercel.com/>
- **Cloudflare Pages** — <https://pages.cloudflare.com/>
- **GitHub Pages** — pousser `dist/` sur la branche `gh-pages`

Idéal pour tester rapidement avant de déployer sur votre VPS.

---

## E. Dépannage

| Symptôme | Cause probable | Solution |
|---|---|---|
| Page blanche, console : `Failed to load resource /assets/...` | Oubli du `base: '/heditor/'` dans `vite.config.ts` | Rebuild après ajout de la ligne |
| F5 sur une route retourne 404 | Bloc `try_files` manquant dans Nginx | Ajouter `try_files $uri $uri/ /heditor/index.html;` |
| Routes React cassées (URL change mais l'app ne réagit pas) | Oubli du `basename="/heditor"` dans `<BrowserRouter>` | Rebuild après correction |
| HTTPS ne marche pas | Let's Encrypt pas (re)configuré | Coolify → "Generate SSL Certificate" |
| `npm install` échoue (Windows : "node-gyp" / "Python") | Outils de build natifs manquants — pas grave pour H Editor (pas de natif) | Réessayer, ou `npm install --no-optional` |
| Port 8080 déjà occupé | Autre app utilise le port | Modifier `port` dans `vite.config.ts` ou tuer le process : `Get-NetTCPConnection -LocalPort 8080` |
| `npm run dev` ouvre `http://localhost:8080/` (sans /heditor/) | Vous avez retiré le `base` | Soit ajouter `/heditor/` à l'URL, soit retirer `base` dans `vite.config.ts` |
| Cache navigateur tenace | Anciens fichiers cachés | `Ctrl+F5` (hard reload) ou DevTools → "Disable cache" |
| Coolify ne voit pas les changements | Volume monté en lecture seule | Vérifier les permissions du dossier `/var/www/hylst/heditor/` |

### E.1 Logs utiles

```bash
# Logs Nginx en temps réel
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log

# Test config Nginx sans recharger
sudo nginx -t

# Voir où Nginx sert hylst.fr
sudo nginx -T | grep -A 5 "server_name hylst"
```

### E.2 Désinstaller / rollback

Si quelque chose tourne mal :
1. Sauvegarder l'ancienne config Nginx : `sudo cp /etc/nginx/sites-available/hylst.fr.conf /etc/nginx/sites-available/hylst.fr.conf.bak`
2. En cas de problème : `sudo cp .bak ...conf` puis `sudo nginx -s reload`

---

## ✅ Checklist déploiement final

- [ ] `npm run build` réussi, dossier `dist/` généré
- [ ] `npm run preview` testé et fonctionnel sur `http://localhost:4173/heditor/`
- [ ] Contenu de `dist/` uploadé dans `/var/www/hylst/heditor/`
- [ ] Bloc `location /heditor/` ajouté à la config Nginx de `hylst.fr`
- [ ] `sudo nginx -t` retourne OK
- [ ] `sudo systemctl reload nginx` exécuté
- [ ] `https://hylst.fr/heditor/` charge correctement
- [ ] F5 sur une route ne retourne pas 404
- [ ] Image `og-image.png` présente dans `public/` (sinon `/og-image.png` retourne 404 — pas bloquant pour le fonctionnement, juste pour le partage social)

Bon déploiement ! 🚀
