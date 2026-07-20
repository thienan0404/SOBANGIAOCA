# A25 Electronic Handover

Production-oriented monorepo for **Sổ bàn giao ca lễ tân điện tử**.

## Architecture

- `apps/web`: Next.js App Router PWA, Supabase SSR Auth, TanStack Query.
- `apps/api`: NestJS REST API `/api/v1`, Prisma, Supabase JWT, branch RBAC.
- `apps/worker`: BullMQ worker and scheduler.
- `packages/*`: contracts, validation, UI, shared utilities and config.
- `supabase/migrations`: authoritative PostgreSQL schema and RLS.

## Requirements

Node 22.14+, pnpm 11.11+, Docker, Supabase CLI.

## Local setup

```bash
corepack enable
pnpm install
copy apps\web\.env.example apps\web\.env.local
copy apps\api\.env.example apps\api\.env
copy apps\worker\.env.example apps\worker\.env
pnpm supabase:start
pnpm supabase:reset
pnpm db:generate
pnpm dev
```

Create development Auth users through Supabase Auth Admin/UI. Do not seed passwords. Link their UUIDs to `profiles` and `branch_memberships`.

## Commands

`pnpm dev`, `pnpm dev:web`, `pnpm dev:api`, `pnpm dev:worker`, `pnpm build`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e`, `pnpm db:generate`, `pnpm db:migrate`, `pnpm db:seed`.

## Database

SQL migrations are authoritative. Never use Prisma schema push in production. Use `pnpm db:migrate` for hosted Supabase and `pnpm supabase:reset` locally.

## Render

Deploy manually as two Render services: one global Static Site for `@a25/web` and one Node Web Service in Singapore for `@a25/api`. The project intentionally does not use a Render Blueprint.

See `docs/render-deployment.md` for the exact commands, environment variables and migration order. Keep Root Directory empty because both applications use shared workspace packages from the repository root.
