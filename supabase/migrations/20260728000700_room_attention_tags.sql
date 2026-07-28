begin;

create type room_attention_tag_type as enum (
  'SPECIAL_REQUEST','EXTRA_CARE','ROOM_ISSUE','GUEST_DEBT',
  'WAKE_UP','TRANSPORT','GUEST_ASSET','OTHER'
);
create type room_attention_priority as enum ('NORMAL','IMPORTANT','URGENT');
create type room_attention_status as enum ('OPEN','IN_PROGRESS','RESOLVED','CLOSED','CANCELLED');

create table room_attention_tags (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  branch_id uuid not null references branches(id),
  stay_reference text not null check (char_length(trim(stay_reference)) between 2 and 100),
  room_number text not null check (char_length(trim(room_number)) between 1 and 20),
  guest_name text not null check (char_length(trim(guest_name)) between 2 and 160),
  check_in_date date not null,
  expected_check_out_date date not null,
  tag_type room_attention_tag_type not null,
  priority room_attention_priority not null default 'NORMAL',
  title text not null check (char_length(trim(title)) between 3 and 180),
  details text not null check (char_length(trim(details)) between 3 and 5000),
  status room_attention_status not null default 'OPEN',
  created_by uuid not null references profiles(id),
  created_work_session_id uuid not null references work_sessions(id),
  created_shift_instance_id uuid not null references shift_instances(id),
  closed_by uuid references profiles(id),
  closed_at timestamptz,
  close_reason text,
  final_result text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint room_attention_tag_dates check (expected_check_out_date >= check_in_date),
  constraint room_attention_tag_close_fields check (
    (status not in ('CLOSED','CANCELLED')) or
    (closed_by is not null and closed_at is not null and close_reason is not null and final_result is not null)
  )
);

create unique index room_attention_tags_active_issue_unique
  on room_attention_tags(branch_id,lower(stay_reference),lower(room_number),tag_type)
  where status in ('OPEN','IN_PROGRESS','RESOLVED');
create index room_attention_tags_active_list
  on room_attention_tags(branch_id,status,priority,expected_check_out_date,updated_at desc);
create index room_attention_tags_stay_history
  on room_attention_tags(branch_id,lower(stay_reference),created_at desc);
create trigger room_attention_tags_updated before update on room_attention_tags
  for each row execute function public.set_updated_at();

create table room_attention_tag_updates (
  id uuid primary key default gen_random_uuid(),
  tag_id uuid not null references room_attention_tags(id) on delete restrict,
  content text not null check (char_length(trim(content)) between 3 and 5000),
  action text not null check (char_length(action) between 3 and 50),
  actor_id uuid not null references profiles(id),
  work_session_id uuid not null references work_sessions(id),
  shift_instance_id uuid not null references shift_instances(id),
  old_values jsonb,
  new_values jsonb,
  created_at timestamptz not null default now()
);
create index room_attention_tag_updates_timeline
  on room_attention_tag_updates(tag_id,created_at asc);

create table handover_room_attention_tags (
  id uuid primary key default gen_random_uuid(),
  handover_id uuid not null references handovers(id) on delete restrict,
  tag_id uuid not null references room_attention_tags(id) on delete restrict,
  snapshot jsonb not null,
  acknowledged_by uuid references profiles(id),
  acknowledged_at timestamptz,
  created_at timestamptz not null default now(),
  unique(handover_id,tag_id)
);
create index handover_room_attention_tags_handover on handover_room_attention_tags(handover_id);

alter table room_attention_tags enable row level security;
alter table room_attention_tag_updates enable row level security;
alter table handover_room_attention_tags enable row level security;

create policy room_attention_tags_branch_read on room_attention_tags
for select to authenticated using (exists(
  select 1 from branch_memberships membership
  where membership.profile_id=auth.uid() and membership.branch_id=room_attention_tags.branch_id and membership.is_active
));
create policy room_attention_tag_updates_branch_read on room_attention_tag_updates
for select to authenticated using (exists(
  select 1 from room_attention_tags tag
  join branch_memberships membership on membership.branch_id=tag.branch_id
  where tag.id=room_attention_tag_updates.tag_id and membership.profile_id=auth.uid() and membership.is_active
));
create policy handover_room_attention_tags_branch_read on handover_room_attention_tags
for select to authenticated using (exists(
  select 1 from handovers handover
  join branch_memberships membership on membership.branch_id=handover.branch_id
  where handover.id=handover_room_attention_tags.handover_id and membership.profile_id=auth.uid() and membership.is_active
));

create or replace function prevent_room_attention_record_delete()
returns trigger language plpgsql as $$
begin
  raise exception 'Lich su tag phong khong duoc xoa vinh vien';
end;
$$;
create trigger prevent_room_attention_tag_delete before delete on room_attention_tags
for each row execute function prevent_room_attention_record_delete();
create trigger prevent_room_attention_update_delete before delete on room_attention_tag_updates
for each row execute function prevent_room_attention_record_delete();

commit;