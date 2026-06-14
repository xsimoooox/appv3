# VoxManus

## Déploiement Vercel

Le stockage fichier local et `server.cjs` ne sont pas persistants sur Vercel.
Configurez une base distante dans **Vercel > Project > Settings > Environment Variables**.

Option recommandée :

```text
MONGODB_URI=mongodb+srv://...
JWT_SECRET=une-cle-secrete-longue
```

Ajoutez les variables aux environnements Production, Preview et Development, puis redéployez.

Alternative Firebase :

```text
USE_FIREBASE_DB=1
FIREBASE_DATABASE_URL=https://votre-projet-default-rtdb.firebaseio.com
FIREBASE_DATABASE_AUTH_TOKEN=jeton-serveur
JWT_SECRET=une-cle-secrete-longue
```

Pour les appels WebRTC réels en production, configurez également `VITE_SOCKET_URL`
vers un serveur Socket.io persistant. Vercel Functions ne peut pas héberger une
connexion Socket.io longue durée.

# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
