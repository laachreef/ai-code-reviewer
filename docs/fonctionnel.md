# Documentation Fonctionnelle — AI Code Reviewer

> Version 0.1.0-beta — Application de bureau (Electron)  
> Développeur : Achref TLILI — ONEPOINT

---

## 1. Objectif du Projet

**AI Code Reviewer** est une application de bureau conçue pour automatiser et assister la revue de code sur des plateformes Git (GitHub, GitLab).

L'application récupère automatiquement les différences (diffs) d'une Pull Request / Merge Request, puis les fait analyser par de multiples agents d'intelligence artificielle spécialisés (Clean Architecture, SOLID, Sécurité, Tests...) et publie les commentaires directement sur la plateforme Git.

---

## 2. Parcours Utilisateur (Workflow)

### Étape 1 — Configuration initiale (Setup Wizard)
L'utilisateur configure l'application en 3 sections :
- **Accès Git** : Sélection de la plateforme (GitHub / GitLab) + token d'accès personnel
- **Intelligence Artificielle** : Fournisseur (Gemini / Groq) + modèle + clé API (validée à la saisie)
- **Webhooks (optionnel)** : Token Ngrok pour recevoir les PRs automatiquement en temps réel

### Étape 2 — Tableau de Bord (Dashboard)
- Visualisation des **PRs / MRs en attente** sur tous les dépôts (avec détail par repo, titre, date et heure)
- Sélection du **dépôt** via une liste déroulante avec recherche
- Sélection de la **PR en attente** pour ce dépôt
- Sélection des **agents d'analyse** (cocher/décocher tout)
- Lancement de l'analyse → scroll automatique vers la section de progression

### Étape 3 — Rapport de Review (Review Report)
- Liste complète des observations par agent avec sévérité, ligne concernée, message et suggestion
- Visualisation du **diff contextuel** (rouge/vert) pour chaque observation
- **Sélection individuelle** des commentaires à poster
- Barre d'action fixe en bas :
  - ← Retour
  - ✓ Approuver et Merger (avec option de suppression de la branche source)
  - Envoyer X commentaires

### Étape 4 — Historique
- Page dédiée listant toutes les actions passées
- Recherche textuelle + tri par date ou projet

---

## 3. Les Agents d'Analyse

| Agent | Rôle |
|---|---|
| **Clean Architecture** | Séparation des couches, inversion de dépendance |
| **SOLID Principles** | Vérification des 5 principes SOLID |
| **Testing & QA** | Couverture de tests, edge cases, assertions |
| **Security (OWASP)** | XSS, injections SQL, secrets exposés |
| **Agents personnalisés** | Ajout illimité via le gestionnaire d'agents |

---

## 4. Fonctionnalités Clés

| Fonctionnalité | Description |
|---|---|
| Multi-agents | Analyse simultanée par plusieurs spécialistes IA |
| Publication automatique | Commentaires postés directement sur GitHub/GitLab |
| Webhooks (ngrok) | Réception automatique des nouvelles PRs en temps réel |
| Historique | Traçabilité de toutes les actions passées |
| Merge intégré | Option de merge + suppression de branche depuis l'app |
| Validation des tokens | Vérification en temps réel des clés Git et LLM |

---

## 5. Configuration Webhook avec Ngrok

Pour que GitHub/GitLab envoie automatiquement les nouvelles PRs à l'application :

1. Créer un compte sur [ngrok.com](https://ngrok.com) et récupérer le **authtoken**
2. Le saisir dans le Setup Wizard (section Webhooks)
3. L'URL ngrok générée s'affiche dans le Dashboard (ex: `https://abc123.ngrok.io/webhook`)
4. Sur GitHub → **Settings → Webhooks → Add webhook** :
   - Payload URL : `https://abc123.ngrok.io/webhook`
   - Content type : `application/json`
   - Events : `Pull requests`
5. Les nouvelles PRs s'ajouteront automatiquement dans la liste de sélection
