# Track TDR

Plateforme web Next.js 16 de supervision GPS temps réel, conçue pour Neon PostgreSQL/PostGIS, Prisma, Socket.IO, Redis et Tailwind CSS.

## Setup

```bash
npm install
cp .env.example .env
npm run prisma:generate
npm run prisma:deploy
npm run db:seed
npm run dev
```

## Neon

Configure :

- `DATABASE_URL` : URL pooled Neon avec `pgbouncer=true`.
- `DIRECT_DATABASE_URL` : URL directe Neon pour Prisma migrations.
- `SHADOW_DATABASE_URL` : base shadow pour migrations en développement.

Active PostGIS sur Neon avant les migrations :

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
```

## Architecture

- `app/` : App Router pages and Route Handlers.
- `features/` : UI and feature-level web modules.
- `services/` : domain orchestration.
- `repositories/` : Prisma data access.
- `validations/` : Zod schemas.
- `sockets/` : Socket.IO server and events.
- `prisma/` : Prisma schema, migrations and seed.

Documentation :

- [API](docs/API.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Testing](docs/TESTING.md)

## Docker

```bash
docker compose up --build
```

For local PostGIS instead of Neon:

```bash
docker compose --profile local-db up --build
```

