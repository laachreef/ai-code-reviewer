# Documentation Fonctionnelle — AI Code Reviewer

> Version 0.2.0-beta — Application de bureau (Electron)  
> Développeur : Achref TLILI — ONEPOINT

---

## 1. Objectif du Projet

**AI Code Reviewer** est une application de bureau conçue pour automatiser et assister la revue de code sur des répertoires locaux ou plateformes distantes (GitHub, GitLab).

L'application récupère automatiquement les différences (diffs) des modifications locales ou d'une Pull Request / Merge Request, puis les fait analyser par de multiples agents d'intelligence artificielle spécialisés (Clean Architecture, SOLID, Sécurité, Tests...) et permet d'appliquer les suggestions ou de publier les commentaires directement sur la plateforme Git.

---

## 2. Parcours Utilisateur (Workflow)

### Étape 1 — Configuration initiale (ConfigModal)
L'utilisateur configure l'application dans une fenêtre superposée :
- **Accès Git** : Sélection de la plateforme (Git local / GitHub / GitLab) + token d'accès personnel pour les plateformes cloud
- **Intelligence Artificielle** : Fournisseur (Gemini / Groq / Personnalisé Ollama, LM Studio) + modèle + clés (validées)
- **Webhooks (optionnel)** : Token Ngrok pour recevoir les PRs automatiquement en temps réel

### Étape 2 — Tableau de Bord (Dashboard)
- Visualisation des **PRs / MRs en attente** sur vos dépôts distants, ou lancement sur un dossier **local**
- Sélection des **agents d'analyse** (cocher/décocher) et des configurations de sévérité minimales
- Choix de la **Stratégie d'analyse** : Rapide (analyse des modifications uniquement) ou Deep (analyse étendue sur les fichiers sélectionnés)
- Exécution **Groupée** (un seul appel LLM consolidé optimisé) ou **Séquentielle** (appels séparés par agent)
- Lancement de l'analyse → suivi en temps réel de la progression par agent (attente, requête, complété)

### Étape 3 — Rapport de Review (Review Report)
- Liste complète des observations par agent avec sévérité, ligne concernée, message et suggestion
- Visualisation du **diff contextuel** (rouge/vert) pour chaque observation
- **Sélection individuelle** des commentaires à poster
- Barre d'action fixe en bas :
  - ← Retour
  - ✓ Approuver et Merger (avec option de suppression de la branche source)
  - Envoyer X commentaires

- Fenêtre dédiée listant toutes les analyses et actions passées
- Supporte tous les types d'analyse (Locale, Distante) avec affichage du **nombre de tokens (taille du diff)** et de la **durée de l'analyse**
- **Vue extensible** pour visualiser la liste des violations détectées et des agents utilisés sans avoir à refaire la revue
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

| Type de plateforme | Local (Dossier Git) et Cloud (GitHub / GitLab) |
|---|---|
| Multi-agents | Analyse simultanée par plusieurs spécialistes IA et création d'agents sur mesure (instructions JSON) |
| Multi-fournisseurs | Support multiplateforme d'IA (Gemini, Groq) ainsi que de endpoints OpenAI-compatibles (Ollama, LMStudio) |
| Analyse Deep/Fast | Évaluation contextuelle ou limitées aux différences strictes avec stratégies groupées/séquentielles |
| Historique Avancé | Traçabilité complète du temps d'exécution, des tokens et des violations enregistrées |
| Mode sombre/clair | L'interface bascule dynamiquement et les cartes du rapport (ReviewReport) préservent le contraste |

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
