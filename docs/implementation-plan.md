# Implementation plan

## Goal

Turn the existing mobile handover prototype into a production-oriented pnpm/Turborepo monorepo while preserving the working burgundy A25 operational interface.

## Delivery sequence

1. Establish workspace boundaries (`apps`, `packages`, `supabase`, `infrastructure`, `tests`).
2. Move the current Next.js interface into `apps/web` and replace direct database mutations with typed API calls.
3. Add shared contracts, Zod validation, UI primitives, utilities and configuration packages.
4. Make SQL migrations the database source of truth and synchronize Prisma models to them.
5. Build the NestJS modular monolith with request IDs, structured errors, Supabase JWT verification and organization/branch authorization.
6. Complete the first vertical slice: login, branch context, draft creation, participants, items, checklist, submit, supplement, confirm, audit and realtime invalidation.
7. Add BullMQ worker/scheduler foundations, outbox processing and idempotent reminder jobs.
8. Add Render Blueprint, Docker local development and GitHub Actions.
9. Run install, lint, typecheck, unit tests and production builds. Fix failures before handoff.

## Increment policy

- Core handover behavior must be functional, tested and free of TODO placeholders.
- Non-core modules may begin as bounded modules and typed route shells, but must not pretend to be complete.
- No secrets are committed. Environments fail clearly when required values are absent.
- Database changes are made only through `supabase/migrations`; Prisma migration commands are not used in production.

## Acceptance checks

- `pnpm install --frozen-lockfile`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`
