# NOCTA

A full-stack Discord bot platform with a web dashboard, built as a pnpm monorepo.

## Architecture

```
nocta/
├── bot/          Node.js + TypeScript Discord bot (discord.js v14)
├── web/          Next.js 14 web dashboard (Tailwind CSS + shadcn/ui)
├── shared/       Shared TypeScript types consumed by bot and web
├── database/     Prisma ORM schema + client for PostgreSQL
└── docker-compose.yml   PostgreSQL 16 + Redis 7 services
```

### Package dependency graph

```
bot  ──┐
       ├──▶  shared
web  ──┘
  │
  └──▶  database ──▶  shared
```

## Prerequisites

| Tool   | Version  |
|--------|----------|
| Node   | ≥ 20     |
| pnpm   | ≥ 9      |
| Docker | any      |

## Getting started

```bash
# 1. Clone and install dependencies
git clone <repo>
cd nocta
pnpm install

# 2. Copy and fill in environment variables
cp .env.example .env
# Edit each package's .env too (bot/.env, web/.env, database/.env)

# 3. Start infrastructure
docker compose up -d

# 4. Run database migrations and generate Prisma client
pnpm db:migrate
pnpm db:generate

# 5. Start all services in development mode
pnpm dev
```

## Workspace scripts

| Command            | Description                              |
|--------------------|------------------------------------------|
| `pnpm dev`         | Start bot + web in parallel (watch mode) |
| `pnpm dev:bot`     | Start only the Discord bot               |
| `pnpm dev:web`     | Start only the Next.js dev server        |
| `pnpm build`       | Build all packages                       |
| `pnpm lint`        | Lint all packages                        |
| `pnpm typecheck`   | Type-check all packages                  |
| `pnpm db:migrate`  | Run Prisma migrations                    |
| `pnpm db:generate` | Regenerate Prisma client                 |
| `pnpm db:studio`   | Open Prisma Studio                       |
| `pnpm db:seed`     | Seed the database                        |

## Infrastructure

- **PostgreSQL 16** — primary datastore, exposed on `localhost:5432`
- **Redis 7** — caching and session store, exposed on `localhost:6379`

Both services are managed via Docker Compose with named volumes for persistence.

## Packages

### `shared`
Pure TypeScript types shared between `bot` and `web`. No runtime dependencies. Published as a local workspace package (`@nocta/shared`).

### `database`
Prisma client and schema. Exports a singleton `db` client plus all Prisma types. Other packages import from `@nocta/database`.

### `bot`
Discord bot built with discord.js v14. Handles slash commands, events, and background jobs. Uses `@nocta/shared` and `@nocta/database`.

### `web`
Next.js 14 App Router dashboard. Server Components by default, styled with Tailwind CSS and shadcn/ui component library. Uses `@nocta/shared` and `@nocta/database`.
