# Documentation Technique — AI Code Reviewer

> Version 0.1.0-beta  
> Développeur : Achref TLILI — ONEPOINT

---

## 1. Architecture Globale

L'application repose sur un ensemble de technologies modernes combinant développement web et desktop multiplateforme.

```
┌─────────────────────────────────────────────────────┐
│                    ELECTRON (Main Process)           │
│  main.ts  ←→  gitClients.ts  ←→  agents.ts         │
│     ↕              ↕                                 │
│  store.ts       webhook.ts (ngrok)                   │
└──────────────────────┬──────────────────────────────┘
                       │ IPC (preload.ts)
┌──────────────────────▼──────────────────────────────┐
│                REACT FRONTEND (Renderer)             │
│  App.tsx → Dashboard / SetupWizard / ReviewReport   │
│           / HistoryPage / AboutPage                  │
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
| GitHub | **@octokit/rest** |
| GitLab | **@gitbeaker/rest** |
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
│   ├── store.ts            # Persistance JSON (~/.code-review-tool/)
│   └── webhook.ts          # Serveur Express + tunnel ngrok
├── src/                    # Frontend React
│   ├── App.tsx             # Routeur principal (dashboard | history | about)
│   └── components/
│       ├── SetupWizard.tsx # Configuration en 3 étapes (Git, IA, Webhooks)
│       ├── Dashboard.tsx   # Vue principale + stats PRs + lancement analyse
│       ├── ReviewReport.tsx# Rapport de revue + diff contextuel + actions
│       ├── HistoryPage.tsx # Historique avec recherche et tri
│       ├── AboutPage.tsx   # Page À propos (version, contact, stack)
│       └── AgentManager.tsx# CRUD des agents personnalisés
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
| `runReview(repoId, prId, agents)` | Renderer → Main | Lance l'analyse multi-agents |
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
2. GitManager.getDiff(repoId, prId)  → rawDiff string
3. Pour chaque agentId sélectionné :
   a. Chargement du prompt système (agents.ts)
   b. Appel LLM (Gemini ou Groq) avec le diff
   c. Parsing de la réponse JSON → violations[]
   d. Émission 'review-progress' vers le renderer
   e. Délai de 500ms (anti rate-limit)
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
