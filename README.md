# AI Code Reviewer

> Application de revue de code automatisée par IA multi-agents  
> Développeur : **Achref TLILI** — ONEPOINT  
> Version : **0.1.0-beta** (version de test)  
> Contact : [ac.tlili@groupeonepoint.com](mailto:ac.tlili@groupeonepoint.com)

---

## ✨ Fonctionnalités

- 🔍 Analyse automatique des Pull Requests / Merge Requests
- 🤖 Multi-agents IA spécialisés (Clean Architecture, SOLID, Security, Tests)
- 💬 Publication des commentaires directement sur GitHub / GitLab
- 🔔 Détection en temps réel des nouvelles PRs via webhooks ngrok
- 📊 Dashboard avec toutes les PRs en attente sur tous vos dépôts
- 🕓 Historique complet des analyses

---

## 🚀 Lancer l'application en mode développement

### Prérequis

- **Node.js** ≥ 18 ([nodejs.org](https://nodejs.org))
- **npm** ≥ 9
- Un compte **GitHub** ou **GitLab** avec un token d'accès personnel
- Une clé API **Google Gemini** ([aistudio.google.com](https://aistudio.google.com)) ou **Groq** ([console.groq.com](https://console.groq.com))

### Installation

```bash
# 1. Cloner ou extraire le projet
cd "ai-code-reviewer"

# 2. Installer les dépendances
npm install

# 3. Lancer en mode développement
npm run dev
```

L'application Electron s'ouvre automatiquement. Le serveur Vite tourne sur `http://localhost:5181`.

> **⚠️ Note :** Toute modification dans le dossier `electron/` (main.ts, gitClients.ts, agents.ts...) nécessite un **redémarrage complet** (`Ctrl+C` puis `npm run dev`). Les modifications dans `src/` (React) sont rechargées à la volée.

---

## 📦 Construire l'application pour la distribuer

```bash
npm run build
```

Cette commande effectue 3 étapes automatiquement :
1. **Build Vite** → compile le frontend React dans `dist/`
2. **Compile TypeScript Electron** → transpile `electron/*.ts` dans `dist-electron/`
3. **electron-builder** → génère l'installeur dans le dossier `release/`

### Résultats selon l'OS

| Système | Fichier généré | Description |
|---|---|---|
| **Windows** | `release/AI Code Reviewer Setup X.X.X.exe` | Installeur NSIS |
| **macOS** | `release/AI Code Reviewer-X.X.X.dmg` | Image disque |
| **Linux** | `release/AI Code Reviewer-X.X.X.AppImage` | AppImage portable |

> **💡 Pour distribuer :** Il suffit de partager le fichier `.exe` (Windows) ou `.dmg` (macOS) généré dans `release/`. Le destinataire n'a pas besoin d'installer Node.js.

---

## 🔧 Configuration nécessaire au premier lancement

Au premier démarrage, l'assistant de configuration s'ouvre automatiquement :

1. **Plateforme Git** : GitHub ou GitLab
2. **Token Git** : Personal Access Token avec droits `repo` (GitHub) ou `api` (GitLab)
3. **Fournisseur IA** : Gemini ou Groq + clé API
4. **Token Ngrok** (optionnel) : Pour les webhooks automatiques

---

## 📁 Structure du projet

```
ai-code-reviewer/
├── electron/        # Backend Electron (Node.js)
├── src/             # Frontend React
├── docs/            # Documentation
│   ├── fonctionnel.md
│   └── technique.md
├── README.md        # Ce fichier
└── package.json
```

---

## 🐛 Signaler un bug / 💡 Proposer une idée

Contactez le développeur à : [ac.tlili@groupeonepoint.com](mailto:ac.tlili@groupeonepoint.com?subject=AI%20Code%20Reviewer%20-%20Feedback)
