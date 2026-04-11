# Contributing to Okaiwa Server

Thank you for your interest in contributing to Okaiwa Server. This document outlines the development standards and processes for contributing to this project.

## Prerequisites

- **Node.js** >= 20.0.0
- **pnpm** >= 9.0.0
- **PostgreSQL** >= 15
- **Redis** >= 7

## Getting Started

```bash
# Fork and clone the repository
git clone https://github.com/<your-username>/okaiwa-server.git
cd okaiwa-server

# Install dependencies
pnpm install

# Set up environment files
cp relay/.env.example relay/.env
cp identity/.env.example identity/.env
cp push/.env.example push/.env
cp blockchain/.env.example blockchain/.env

# Run in development mode
pnpm run dev
```

## Code Standards

### TypeScript

- **Strict mode is mandatory** — `"strict": true` in all `tsconfig.json` files.
- **Zero `any`** — use `unknown` when the type is uncertain, then narrow with type guards.
- **No `// @ts-ignore` or `// @ts-expect-error`** without documented justification.
- **Explicit imports** — no `import *`, always use named imports.
- **Error handling** — always type errors, never leave a `catch` block empty.

### AdonisJS Patterns

- Follow the standard AdonisJS directory structure for each service.
- Use AdonisJS validators for all input validation.
- Use the IoC container for dependency injection.
- Database queries should use the Lucid ORM or the query builder — no raw SQL unless absolutely necessary.

### Formatting

- **Prettier** handles all formatting. Run `pnpm run prettier:fix` before committing.
- **ESLint** enforces code quality. Run `pnpm run lint:fix` to auto-fix issues.
- Settings: no semicolons, single quotes, trailing commas, 100-char line width, LF line endings.

## Commit Conventions

We use [Conventional Commits](https://www.conventionalcommits.org/). All commits are validated by commitlint via a Git hook.

```
<type>(<scope>): <description>
```

### Types

`feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`, `security`

### Scopes

`relay`, `identity`, `push`, `blockchain`, `ci`, `deps`

### Examples

```
feat(relay): add WebSocket heartbeat mechanism
fix(identity): correct pre-key bundle rotation logic
docs(push): update APNs configuration guide
security(relay): enforce rate limiting on envelope submission
```

## Pull Request Process

1. **Create a branch** from `dev` with a descriptive name: `feat/relay-heartbeat`, `fix/identity-prekey-rotation`.
2. **Write tests** for any new functionality.
3. **Ensure CI passes** — run `pnpm run lint && pnpm run typecheck && pnpm run test` locally.
4. **Open a PR** against `dev` with a clear description of the changes.
5. **Request a review** — at least one approval is required before merging.
6. **Squash and merge** — keep the Git history clean.

### Branch Flow

```
feature-branch → dev → rec → main
```

- `dev` — active development
- `rec` — staging / pre-production
- `main` — production releases

## Security Guidelines

When contributing, keep these security rules in mind:

- **NEVER log message content** — only log metadata (timestamps, message counts, error codes).
- **NEVER store messages** — the relay service is ephemeral by design.
- **NEVER include phone numbers in cleartext** — always use hashed values.
- **NEVER commit secrets** — use `.env` files and never commit them.
- **Validate all inputs** — use AdonisJS validators on every endpoint.

## License

By contributing to Okaiwa Server, you agree that your contributions will be licensed under the [GNU Affero General Public License v3.0](LICENSE).
