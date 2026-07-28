alter type handover_status add value if not exists 'MANAGEMENT_CHANGES_REQUESTED' after 'PENDING_MANAGEMENT_APPROVAL';
alter type handover_status add value if not exists 'ACCOUNTING_CHANGES_REQUESTED' after 'PENDING_ACCOUNTING_APPROVAL';

alter table handovers
  add column if not exists operational_locked_at timestamptz;

comment on column handovers.operational_locked_at is
  'Locks the operational handover snapshot after giver and receiver sign; later corrections are append-only amendments.';

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

  if old.operational_locked_at is not null and (
    new.organization_id is distinct from old.organization_id or
    new.branch_id is distinct from old.branch_id or
    new.shift_instance_id is distinct from old.shift_instance_id or
    new.code is distinct from old.code or
    new.notes is distinct from old.notes or
    new.created_by is distinct from old.created_by or
    new.submitted_at is distinct from old.submitted_at or
    new.confirmed_at is distinct from old.confirmed_at or
    new.operational_locked_at is distinct from old.operational_locked_at
  ) then
    raise exception 'Phien ban ban giao van hanh da khoa; hay tao ban dieu chinh';
  end if;

  if old.operational_locked_at is null and new.operational_locked_at is not null and (
    select count(distinct participant_type)
    from handover_participants
    where handover_id=new.id
      and participant_type in ('GIVER','RECEIVER')
      and confirmed_at is not null
      and signature_hash is not null
  ) <> 2 then
    raise exception 'Chua du chu ky nguoi giao va nguoi nhan de khoa van hanh';
  end if;
  if old.operational_locked_at is null and new.operational_locked_at is not null and exists (
    select 1 from checklist_results
    where handover_id=new.id
      and (not is_completed or receiver_checked_at is null)
  ) then
    raise exception 'Chua hoan tat kiem ke hai ben de khoa van hanh';
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

create or replace function prevent_operational_snapshot_mutation()
returns trigger
language plpgsql
set search_path=public
as $$
declare
  target_handover_id uuid;
begin
  target_handover_id:=case when tg_op='DELETE' then old.handover_id else new.handover_id end;
  if exists(
    select 1 from handovers
    where id=target_handover_id
      and operational_locked_at is not null
  ) then
    raise exception 'Phien ban ban giao van hanh da khoa; hay tao ban dieu chinh';
  end if;
  if tg_op='DELETE' then
    return old;
  end if;
  return new;
end
$$;

drop trigger if exists handover_items_operational_lock_guard on handover_items;
create trigger handover_items_operational_lock_guard
before insert or update or delete on handover_items
for each row execute function prevent_operational_snapshot_mutation();

drop trigger if exists checklist_results_operational_lock_guard on checklist_results;
create trigger checklist_results_operational_lock_guard
before insert or update or delete on checklist_results
for each row execute function prevent_operational_snapshot_mutation();

create or replace function enforce_append_only_handover_amendments()
returns trigger
language plpgsql
set search_path=public
as $$
begin
  if tg_op in ('UPDATE','DELETE') then
    raise exception 'Ban dieu chinh la bat bien va khong the sua hoac xoa';
  end if;
  return new;
end
$$;

drop trigger if exists handover_amendments_append_only_guard on handover_amendments;
create trigger handover_amendments_append_only_guard
before update or delete on handover_amendments
for each row execute function enforce_append_only_handover_amendments();