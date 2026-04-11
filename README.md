# Okaiwa Server

**Self-hostable backend for Okaiwa** — a secure messenger with an embedded crypto wallet.

Okaiwa Server is a collection of microservices that power the Okaiwa platform. Designed for privacy, it follows a zero-knowledge architecture: the server never stores, reads, or logs message content. All messages are end-to-end encrypted using the Signal Protocol and relayed ephemerally.

## Architecture

This monorepo contains four independent AdonisJS services, orchestrated with [Turborepo](https://turbo.build/) and [pnpm workspaces](https://pnpm.io/workspaces):

```
okaiwa-server/
├── relay/          # Message relay service
├── identity/       # Identity & key management service
├── push/           # Push notification service
├── blockchain/     # Blockchain & wallet service
└── turbo.json      # Turborepo pipeline configuration
```

### Services

| Service | Port | Description |
|---------|------|-------------|
| **Relay** | `3333` | Ephemeral message relay using WebSockets. Routes sealed-sender envelopes between clients. Never stores or inspects message content. |
| **Identity** | `3334` | Manages user registration, pre-key bundles, device linking, and public key distribution. Stores only hashed phone numbers. |
| **Push** | `3335` | Delivers push notifications via APNs and FCM. Receives opaque notification payloads — content is encrypted client-side. |
| **Blockchain** | `3336` | Handles wallet operations, on-chain transactions, token swaps, and balance queries. Interfaces with EVM-compatible chains. |

## Self-Hosting

### Prerequisites

- **Node.js** >= 20.0.0
- **pnpm** >= 9.0.0
- **PostgreSQL** >= 15
- **Redis** >= 7

### Quick Start

```bash
# Clone the repository
git clone https://github.com/globodai-group/okaiwa-server.git
cd okaiwa-server

# Install dependencies
pnpm install

# Copy environment files
cp relay/.env.example relay/.env
cp identity/.env.example identity/.env
cp push/.env.example push/.env
cp blockchain/.env.example blockchain/.env

# Configure each .env file with your database credentials,
# API keys, and service-specific settings.

# Run database migrations
pnpm run -r migrate

# Start all services in development mode
pnpm run dev

# Or start a specific service
pnpm run --filter relay dev
```

### Production Deployment

Each service is a standalone AdonisJS application that can be deployed independently:

```bash
# Build all services
pnpm run build

# Start a service in production
cd relay && node build/bin/server.js
```

We recommend deploying each service behind a reverse proxy (e.g., Nginx, Caddy) with TLS termination. See the [deployment documentation](https://github.com/globodai-group/okaiwa-docs) for detailed guides.

### Docker

```bash
# Build all service images
docker compose build

# Start the full stack
docker compose up -d
```

## Environment Variables

Each service requires its own `.env` file. Refer to the `.env.example` in each service directory for the complete list of required variables.

**Common variables across all services:**

| Variable | Description |
|----------|-------------|
| `HOST` | Bind address (default: `0.0.0.0`) |
| `PORT` | Service port |
| `NODE_ENV` | `development` / `production` |
| `APP_KEY` | Application secret key |
| `DB_HOST` | PostgreSQL host |
| `DB_PORT` | PostgreSQL port |
| `DB_USER` | PostgreSQL user |
| `DB_PASSWORD` | PostgreSQL password |
| `DB_DATABASE` | PostgreSQL database name |
| `REDIS_HOST` | Redis host |
| `REDIS_PORT` | Redis port |
| `LOG_LEVEL` | Logging level (`info`, `warn`, `error`) |

## Security

Okaiwa Server is built with security as the top priority:

- **Zero-knowledge architecture** — the server never has access to plaintext message content.
- **Sealed sender** — message metadata is minimized; the server does not know who is messaging whom.
- **Phone number hashing** — only salted hashes of phone numbers are stored.
- **No message storage** — messages are relayed in real-time and never persisted on the server.
- **End-to-end encryption** — all messages use the Signal Protocol (Double Ratchet + X3DH).

For security disclosures, see [SECURITY.md](SECURITY.md).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines, coding standards, and the PR process.

## License

This project is licensed under the **GNU Affero General Public License v3.0** — see the [LICENSE](LICENSE) file for details.

Copyright 2026 Globodai FZCO.
