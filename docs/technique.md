# Documentation Technique — AI Code Reviewer

> Version 0.2.0-beta  
> Développeur : Achref TLILI — ONEPOINT

---

## 1. Architecture Globale

L'application repose sur un ensemble de technologies modernes combinant développement web et desktop multiplateforme.

```
┌─────────────────────────────────────────────────────┐
│                    ELECTRON (Main Process)           │
│  main.ts  ←→  gitClients.ts (incl. localGit.ts) ←→  agents.ts      │
│     ↕              ↕                                 │
│  store.ts       webhook.ts (ngrok)                   │
└──────────────────────┬──────────────────────────────┘
                       │ IPC (preload.ts)
┌──────────────────────▼──────────────────────────────┐
│                REACT FRONTEND (Renderer)             │
│  App.tsx → Dashboard (gère les fenêtres Modales:    │
│  ConfigModal, HistoryModal, AboutModal,             │
│  AgentManager) / ReviewReport                       │
└─────────────────────────────────────────────────────┘
```

---

## 2. Stack Technologique

| Couche | Technologie |
|---|---|
| Desktop Runtime | **Electron 41** |
| Frontend UI | **React 19** + **TypeScript** |
| Bundler | **Vite 5** |
| Styles | **Tailwind CSS 3** |
| LLM (option 1) | **Google Gemini** (`@google/generative-ai`) |
| LLM (option 2) | **Groq** (`groq-sdk`) |
| LLM (option 3) | **Fournisseur OpenAI-Compatible** (`openai`) |
| GitHub | **@octokit/rest** |
| GitLab | **@gitbeaker/rest** |
| Git Local | **Commandes fs/child_process natives** |
| Tunnel local | **ngrok** (`ngrok` v5 beta) |
| Webhook server | **Express 5** |
| Packaging | **electron-builder** |

---

## 3. Structure du Code

```
ai-code-reviewer/
├── electron/               # Process principal Electron (Node.js)
│   ├── main.ts             # Point d'entrée, création fenêtre, routing IPC
│   ├── preload.ts          # Bridge IPC → exposes window.api au renderer
│   ├── agents.ts           # Intégration LLM multi-agents, parsing JSON
│   ├── gitClients.ts       # GitHub/GitLab : diff, PRs, commentaires, merge
│   ├── localGit.ts         # Intégration Git Locale via execSync / fs
│   ├── store.ts            # Persistance JSON (~/.code-review-tool/)
│   └── webhook.ts          # Serveur Express + tunnel ngrok
├── src/                    # Frontend React
│   ├── App.tsx             # Composant racine
│   └── components/
│       ├── Modal.tsx       # Composant générique de fenêtre modale
│       ├── ConfigModal.tsx # Fenêtre de configuration (Git, IA, Webhooks)
│       ├── CustomProviderModal.tsx # Fenêtre de configuration pour IA perso
│       ├── Dashboard.tsx   # Vue principale (gère l'état de toutes les modales)
│       ├── ReviewReport.tsx# Rapport de revue + diff + actions
│       ├── HistoryModal.tsx# Fenêtre d'historique des actions
│       ├── AboutModal.tsx  # Fenêtre À propos
│       └── AgentManager.tsx# Gestion des agents AI
├── docs/                   # Documentation (ce dossier)
│   ├── fonctionnel.md
│   └── technique.md
├── README.md               # Guide de démarrage rapide
└── package.json
```

---

## 4. Communication Inter-Process (IPC)

Toutes les méthodes sont exposées via `preload.ts` dans `window.api` :

| Méthode | Direction | Description |
|---|---|---|
| `getConfig` / `saveConfig` | Renderer → Main | Lecture/écriture configuration |
| `verifyToken(platform, token)` | Renderer → Main | Valide le token Git |
| `verifyLlmToken(provider, key)` | Renderer → Main | Valide la clé LLM |
| `getRepos()` | Renderer → Main | Liste les dépôts de l'utilisateur |
| `getPendingPRs(repoId)` | Renderer → Main | PRs ouvertes d'un dépôt |
| `getAllPendingPRsCount()` | Renderer → Main | PRs + détails par dépôt (tous dépôts) |
| `getPRFiles(repo, pr)` | Renderer → Main | Récupère tous les fichiers modifiés d'une PR/Dépôt |
| `getRepoTree(repo, pr)` | Renderer → Main | Récupère l'arbre des fichiers d'un dépôt |
| `getDiffLength(repo, pr)` | Renderer → Main | Calcule la taille de la somme des diffs exacts pour les jetons |
| `runReview(...)` | Renderer → Main | Lance l'analyse multi-agents avec stratégie (groupée/séquentielle) |
| `postReview({projectId, prId, comments})` | Renderer → Main | Publie les commentaires |
| `mergeReview({projectId, prId, deleteBranch})` | Renderer → Main | Merge la PR |
| `getHistory` / `saveHistory` | Renderer → Main | Historique des actions |
| `onReviewProgress(cb)` | Main → Renderer | Progression en temps réel |
| `onWebhookPrReceived(cb)` | Main → Renderer | Nouvelle PR via webhook |
| `onWebhookStatus(cb)` | Main → Renderer | Statut du tunnel ngrok |

---

## 5. Flow d'Analyse Multi-Agents

```
1. runReview() appelé avec [repoId, prId, agentIds]
2. GitManager.getDiff(repoId, prId) ou LocalGitManager.getDiff()  → rawDiff string
3. Pour chaque agentId sélectionné (ou regroupés si stratégie "grouped") :
   a. Chargement du prompt système (agents.ts)
   b. Appel LLM (Gemini, Groq ou Custom) avec le diff et les fichiers demandés (si "Deep")
   c. Parsing de la réponse JSON → violations[]
   d. Filtrage des violations par sévérité demandée
   e. Émission 'review-progress' vers le renderer
   f. Délai de 500ms (anti rate-limit pour API cloud)
4. Agrégation de toutes les violations
5. Résultat renvoyé → ReviewReport affiché
```

---

## 6. Persistance des Données

Fichier : `~/.code-review-tool/config.json`

```json
{
  "platform": "github",
  "token": "ghp_...",
  "ngrokToken": "...",
  "llmProvider": "gemini",
  "llmModel": "gemini-2.5-flash",
  "llmApiKey": "...",
  "agents": [...agents personnalisés...]
}
```

Historique : `~/.code-review-tool/history.json`

---

## 7. Scripts NPM

| Commande | Description |
|---|---|
| `npm run dev` | Démarre Vite (front) + TSC watch (electron) + Electron en dev |
| `npm run build` | Build complet + packaging electron-builder |

---

## 8. Bonnes Pratiques

- Les clés secrètes ne transitent **jamais** dans le renderer (stockées uniquement dans `store.ts` via le Main process)
- Le tunnel ngrok démarre de façon non-bloquante (l'app fonctionne sans)
- Un délai de 500ms entre chaque agent évite les rate limits des APIs LLM
- `NODE_TLS_REJECT_UNAUTHORIZED=0` est activé pour contourner les proxies corporate (à désactiver en production publique)
