# 🚀 Guide de déploiement

## Architecture

L'app est composée de **2 parties** :

1. **Frontend (React/Vite)** → Vercel ✅ (déjà déployé)
2. **Backend (Node.js/Express/Socket.io)** → À déployer sur un service externe

---

## 🎯 Étape 1 : Déployer le serveur Node.js

### Option A : Render (recommandé, gratuit)

1. Créer un compte sur https://render.com
2. Connecter votre repo GitHub
3. Créer un **New Web Service** :
   - Repository: `xsimoooox/appv3`
   - Runtime: `Node`
   - Build command: `npm install`
   - Start command: `node server.cjs`
4. Ajouter les variables d'environnement :
   ```
   MONGODB_URI=mongodb+srv://...
   JWT_SECRET=votre_clé_secrète
   VAPID_PUBLIC_KEY=...
   VAPID_PRIVATE_KEY=...
   PORT=3001
   ```
5. Copier l'URL publique (ex: `https://appv3.onrender.com`)

### Option B : Railway

1. Créer un compte sur https://railway.app
2. Connecter GitHub
3. Créer nouveau projet → GitHub repo
4. Railway détectera automatiquement Node.js
5. Ajouter les env vars
6. Copier l'URL générée

### Option C : Heroku / Fly.io

Similaire aux options ci-dessus.

---

## 🎯 Étape 2 : Configurer l'URL du serveur dans Vercel

### Via le dashboard Vercel:

1. Aller sur https://vercel.com/dashboard
2. Sélectionner votre projet
3. Settings → Environment Variables
4. Ajouter :
   ```
   VITE_API_URL=https://appv3.onrender.com
   VITE_SOCKET_URL=https://appv3.onrender.com
   ```
5. Redéployer (ou le déploiement se fera automatiquement)

### Ou via `vercel.json` :

Mettre à jour `vercel.json` avec les env vars par défaut.

---

## ✅ Test

Une fois déployé :
1. Aller sur https://votre-app.vercel.app
2. Essayer de créer un compte
3. L'erreur "Serveur indisponible" devrait disparaître

---

## 📝 Variables d'environnement requises

### Backend (`.env`)
```
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/dbname
JWT_SECRET=clé_secrète_très_longue_et_aléatoire
VAPID_PUBLIC_KEY=clé_publique_web_push
VAPID_PRIVATE_KEY=clé_privée_web_push
PORT=3001
```

### Frontend (Vercel Environment Variables)
```
VITE_API_URL=https://votre-backend.com
VITE_SOCKET_URL=https://votre-backend.com
```

---

## 🔗 Liens utiles

- [Render Web Services](https://render.com/docs/deploy-node-express-app)
- [Railway Node Deployment](https://docs.railway.app/guides/nodejs)
- [Vercel Environment Variables](https://vercel.com/docs/projects/environment-variables)
