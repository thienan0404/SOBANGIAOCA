# Supabase configuration

SQL migrations are authoritative. Apply with `pnpm db:migrate` or `supabase db reset` locally. Prisma is generated from the synchronized client schema and must never push schema changes.

Private buckets: `handover-attachments`, `room-issues`, `cash-documents`, `lost-found`, `signatures`, `report-exports`.

Object paths use `organization-id/branch-id/entity-id/generated-file-name`. Downloads use short-lived signed URLs issued by the API.
