begin;

create extension if not exists pgcrypto with schema extensions;

insert into roles(code,name)
values('BRANCH_ACCOUNT','Tai khoan chi nhanh')
on conflict(code) do nothing;

alter table profiles add column if not exists employee_code text;
alter table profiles add column if not exists pin_hash text;
create unique index if not exists profiles_employee_code_unique
  on profiles (upper(employee_code))
  where employee_code is not null;

create table if not exists work_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  profile_id uuid not null references profiles(id),
  authenticated_by uuid not null references profiles(id),
  branch_id uuid not null references branches(id),
  shift_instance_id uuid not null references shift_instances(id),
  status text not null default 'ACTIVE' check (status in ('ACTIVE','COMPLETED','CANCELLED')),
  schedule_match text not null check (schedule_match in ('EARLY','ON_TIME','LATE')),
  scheduled_start timestamptz not null,
  actual_start timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists work_sessions_one_active_per_profile
  on work_sessions(profile_id)
  where status = 'ACTIVE';
create index if not exists work_sessions_profile_history
  on work_sessions(profile_id, actual_start desc);
create index if not exists work_sessions_branch_active
  on work_sessions(branch_id, status, actual_start desc);

alter table work_sessions enable row level security;

drop policy if exists work_sessions_own_read on work_sessions;
create policy work_sessions_own_read
  on work_sessions for select to authenticated
  using (profile_id = auth.uid() or authenticated_by = auth.uid());

alter publication supabase_realtime add table work_sessions;

comment on column profiles.employee_code is 'Unique staff code printed on the employee card.';
comment on column profiles.pin_hash is 'Bcrypt hash of the employee six-digit PIN.';
comment on table work_sessions is 'A confirmed employee work context for one scheduled shift and branch.';

commit;
