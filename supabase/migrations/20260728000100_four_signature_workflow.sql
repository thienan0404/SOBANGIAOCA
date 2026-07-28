alter type handover_status add value if not exists 'PENDING_MANAGEMENT_APPROVAL' after 'PENDING_RECEIVER_CONFIRMATION';
alter type handover_status add value if not exists 'PENDING_ACCOUNTING_APPROVAL' before 'SUPPLEMENT_REQUESTED';

alter table handovers
  add column if not exists locked_at timestamptz;

alter table handover_participants
  add column if not exists signature_text text,
  add column if not exists signature_hash varchar(64),
  add column if not exists signature_method text;

alter table checklist_results
  add column if not exists receiver_checked_by uuid references profiles(id),
  add column if not exists receiver_checked_at timestamptz;

alter table work_sessions
  add column if not exists transferred_from_session_id uuid;

create unique index if not exists handover_one_participant_per_role
  on handover_participants(handover_id,participant_type);

insert into roles(code,name) values
  ('BRANCH_DIRECTOR','BGĐ cơ sở'),
  ('DEPUTY_BRANCH_DIRECTOR','Phó BGĐ cơ sở'),
  ('ACCOUNTANT','Kế toán'),
  ('CHIEF_ACCOUNTANT','Kế toán trưởng')
on conflict(code) do update set name=excluded.name;

-- Keep the existing demo usable end-to-end without creating unsafe shared
-- production accounts. These rows are only inserted when the demo profiles
-- already exist.
insert into branch_memberships(profile_id,branch_id,role_id,is_active)
select profile.id,branch.id,role.id,true
from (values
  ('A25003','PCT45','BRANCH_DIRECTOR'),
  ('A25004','PCT45','ACCOUNTANT'),
  ('A25006','HHN14','BRANCH_DIRECTOR'),
  ('A25007','HHN14','ACCOUNTANT'),
  ('A25009','NHQ18','BRANCH_DIRECTOR'),
  ('A25001','NHQ18','ACCOUNTANT')
) as assignment(employee_code,branch_code,role_code)
join profiles profile on profile.employee_code=assignment.employee_code
join branches branch on branch.code=assignment.branch_code
join roles role on role.code=assignment.role_code
on conflict(profile_id,branch_id) do update
set role_id=excluded.role_id,is_active=true;

comment on column handovers.locked_at is
  'Set only after giver, receiver, branch management and accounting signatures are complete.';
comment on column handover_participants.signature_hash is
  'SHA-256 evidence hash; raw passwords are never persisted.';

create or replace function enforce_handover_lock_requirements()
returns trigger
language plpgsql
set search_path=public
as $$
begin
  if old.locked_at is not null then
    raise exception 'Phieu ban giao da khoa va khong the thay doi';
  end if;
  if tg_op='DELETE' then
    return old;
  end if;
  if new.locked_at is not null and (
    select count(distinct participant_type)
    from handover_participants
    where handover_id=new.id
      and confirmed_at is not null
      and signature_hash is not null
  ) <> 4 then
    raise exception 'Phieu ban giao chua du 4 chu ky';
  end if;
  if new.locked_at is not null and exists (
    select 1 from checklist_results
    where handover_id=new.id
      and (not is_completed or receiver_checked_at is null)
  ) then
    raise exception 'Phieu ban giao chua du kiem ke hai ben';
  end if;
  return new;
end
$$;

drop trigger if exists handover_lock_guard on handovers;
create trigger handover_lock_guard
before update or delete on handovers
for each row execute function enforce_handover_lock_requirements();

create or replace function prevent_locked_handover_child_mutation()
returns trigger
language plpgsql
set search_path=public
as $$
declare
  target_handover_id uuid;
begin
  if tg_op='DELETE' then
    target_handover_id:=old.handover_id;
  else
    target_handover_id:=new.handover_id;
  end if;
  if exists(select 1 from handovers where id=target_handover_id and locked_at is not null) then
    raise exception 'Du lieu thuoc phieu ban giao da khoa';
  end if;
  if tg_op='DELETE' then
    return old;
  end if;
  return new;
end
$$;

drop trigger if exists handover_items_lock_guard on handover_items;
create trigger handover_items_lock_guard
before insert or update or delete on handover_items
for each row execute function prevent_locked_handover_child_mutation();
drop trigger if exists handover_participants_lock_guard on handover_participants;
create trigger handover_participants_lock_guard
before insert or update or delete on handover_participants
for each row execute function prevent_locked_handover_child_mutation();
drop trigger if exists checklist_results_lock_guard on checklist_results;
create trigger checklist_results_lock_guard
before insert or update or delete on checklist_results
for each row execute function prevent_locked_handover_child_mutation();
drop trigger if exists handover_amendments_lock_guard on handover_amendments;
create trigger handover_amendments_lock_guard
before insert or update or delete on handover_amendments
for each row execute function prevent_locked_handover_child_mutation();
