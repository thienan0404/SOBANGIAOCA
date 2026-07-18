begin;

create table public.branch_devices (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id),
  device_code text not null unique,
  device_name text not null,
  device_token_hash varchar(64) not null unique,
  is_active boolean not null default true,
  registered_by uuid not null references public.profiles(id),
  registered_at timestamptz not null default now(),
  last_seen_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint branch_devices_code_not_blank check (btrim(device_code) <> ''),
  constraint branch_devices_name_not_blank check (btrim(device_name) <> ''),
  constraint branch_devices_token_hash_format check (device_token_hash ~ '^[0-9a-f]{64}$'),
  constraint branch_devices_revocation_consistent check (revoked_at is null or is_active = false)
);

create index branch_devices_active_branch_idx
  on public.branch_devices(branch_id, is_active);

create trigger branch_devices_updated
  before update on public.branch_devices
  for each row execute function public.set_updated_at();

alter table public.branch_devices enable row level security;

-- Device records contain authentication material and are accessed only by the API.
-- No direct authenticated or anonymous policies are intentionally created.

commit;
