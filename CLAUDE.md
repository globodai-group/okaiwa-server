# Okaiwa Server — Guide de developpement

## Description du projet

Okaiwa Server est le monorepo backend de la plateforme Okaiwa, un messager securise avec portefeuille crypto integre. Il contient 4 micro-services AdonisJS : relay, identity, push, blockchain.

**Ce depot est PUBLIC sous licence AGPLv3.**

**Organisation GitHub :** `globodai-group`

---

## Architecture du monorepo

```
okaiwa-server/
├── relay/          # Service de relais de messages (WebSocket, ephemere)
├── identity/       # Service d'identite et gestion des cles
├── push/           # Service de notifications push (APNs, FCM)
├── blockchain/     # Service blockchain et portefeuille
├── turbo.json      # Configuration Turborepo
└── pnpm-workspace.yaml
```

## Stack technique

| Couche | Technologie | Version |
|--------|-------------|---------|
| **Backend** | AdonisJS | 6.x |
| **Langage** | TypeScript (strict) | 5.x |
| **ORM** | Lucid (AdonisJS) | latest |
| **Base de donnees** | PostgreSQL | 15+ |
| **Cache** | Redis | 7+ |
| **Monorepo** | pnpm + Turborepo | 9.x / 2.x |
| **Runtime** | Node.js | 20.x |
| **CI/CD** | GitHub Actions | — |

---

## Regles de code

### TypeScript

- **Mode strict obligatoire** : `"strict": true` dans tous les `tsconfig.json`.
- **Zero `any`** : utiliser `unknown` si le type est inconnu, puis affiner avec des type guards.
- **Pas de `console.log` en production** : utiliser le logger AdonisJS.
- **Pas de `// @ts-ignore` ou `// @ts-expect-error`** sans justification documentee.
- **Imports explicites** : pas de `import *`, toujours des imports nommes.
- **Gestion d'erreurs** : toujours typer les erreurs, jamais de `catch` vide.

### AdonisJS

- Respecter la structure de repertoires standard AdonisJS.
- Utiliser les validators AdonisJS pour toute validation d'entree.
- Utiliser le conteneur IoC pour l'injection de dependances.
- Requetes base de donnees via Lucid ORM ou query builder — pas de SQL brut sauf necessite absolue.

---

## Securite — Regles fondamentales

> **La securite est la priorite absolue. Okaiwa est un messager zero-knowledge.**

- **JAMAIS logger le contenu des messages** : uniquement les metadonnees (timestamps, compteurs, codes d'erreur).
- **JAMAIS stocker les messages** : le service relay est ephemere par conception.
- **JAMAIS inclure de numeros de telephone en clair** : toujours utiliser des valeurs hashees.
- **JAMAIS de secrets dans le code** : tout passe par les variables d'environnement.
- **Valider toutes les entrees** : utiliser les validators AdonisJS sur chaque endpoint.
- **Zero tolerance** pour les failles connues : `pnpm audit` doit passer sans vulnerabilites critiques.

---

## Conventions de commits

Format **Conventional Commits** obligatoire, verifie par commitlint :

```
<type>(<scope>): <description>
```

### Types autorises

| Type | Usage |
|------|-------|
| `feat` | Nouvelle fonctionnalite |
| `fix` | Correction de bug |
| `docs` | Documentation uniquement |
| `style` | Formatage (pas de changement de logique) |
| `refactor` | Refactoring sans changement fonctionnel |
| `perf` | Amelioration de performance |
| `test` | Ajout ou modification de tests |
| `build` | Systeme de build, dependances |
| `ci` | Configuration CI/CD |
| `chore` | Taches de maintenance |
| `revert` | Annulation d'un commit precedent |
| `security` | Correctif ou amelioration de securite |

### Scopes autorises

`relay`, `identity`, `push`, `blockchain`, `ci`, `deps`

---

## Workflow Git

### Branches protegees

| Branche | Environnement | Regles |
|---------|---------------|--------|
| `main` | Production | PR obligatoire, review requise, CI verte |
| `rec` | Staging | PR obligatoire, review requise, CI verte |
| `dev` | Developpement | PR obligatoire, CI verte |

### Processus

1. Creer une branche depuis `dev`
2. Developper avec des commits atomiques
3. PR vers `dev` avec CI verte
4. `dev` -> `rec` -> `main`

---

## Langue

- **Communication** (PR, issues, reviews) : **francais**
- **Code** (variables, fonctions, commentaires techniques) : **anglais**
- **Commits** : **anglais**
- **CLAUDE.md et docs internes** : **francais**

---

## Commandes utiles

```bash
pnpm install              # Installation des dependances
pnpm run dev              # Demarrer tous les services
pnpm run build            # Build complet
pnpm run lint             # Verification ESLint
pnpm run lint:fix         # Correction automatique ESLint
pnpm run prettier         # Verification du formatage
pnpm run prettier:fix     # Correction automatique du formatage
pnpm run typecheck        # Verification des types TypeScript
pnpm run test             # Execution des tests
```
