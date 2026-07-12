# Database

SQL migrations under `supabase/migrations` are the source of truth. Critical records use UUIDs, UTC `timestamptz`, foreign keys, indexes, checks and optimistic `version`. VND amounts are `bigint`. Completed records are immutable; amendments/reconciliation rows are append-only. Prisma models mirror the SQL schema for API access only.
