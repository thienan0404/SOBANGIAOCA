# Architecture

## System context

`apps/web` is a Next.js App Router PWA. It uses Supabase only for cookie-based authentication, signed private uploads and branch-scoped realtime events. Business mutations go through `apps/api`.

`apps/api` is a NestJS modular monolith. It verifies Supabase JWTs, resolves profile/organization/branch scope, enforces RBAC permissions and executes business use cases through Prisma transactions.

`apps/worker` runs BullMQ processors for reports, notifications, reminders, image work, analytics and integrations. Database outbox rows provide reliable event handoff.

Supabase hosts PostgreSQL, Auth, Storage and selected Realtime publications. SQL files under `supabase/migrations` are authoritative. `apps/api/prisma/schema.prisma` is a synchronized client model, never a schema synchronization mechanism.

## Boundaries

Shared packages expose public contracts, Zod validation, accessible UI, framework-free utilities and tooling config. Domain modules do not import another module's repository; collaboration uses exported application services, ports or events.

## Security

Supabase Auth sessions use HTTP cookies. The API verifies JWTs against Supabase JWKS, resolves membership from PostgreSQL and applies permission/branch guards. RLS is defense in depth. Service keys, database URLs and Redis URLs are server-only. Audit records are append-only.

## Deployment

Render builds from repository root because applications depend on workspace packages. Separate services run web, API, worker and scheduler. Supabase is the managed data plane.
