create or replace function protect_operational_handover_signatures()
returns trigger
language plpgsql
set search_path=public
as $$
declare
  target_handover_id uuid;
  target_type participant_type;
  current_status handover_status;
  is_operationally_locked boolean;
begin
  if tg_op='DELETE' then
    target_handover_id:=old.handover_id;
    target_type:=old.participant_type;
  else
    target_handover_id:=new.handover_id;
    target_type:=new.participant_type;
  end if;

  select operational_locked_at is not null,status
  into is_operationally_locked,current_status
  from handovers
  where id=target_handover_id;

  if not is_operationally_locked then
    return case when tg_op='DELETE' then old else new end;
  end if;

  if target_type='GIVER' then
    raise exception 'Chu ky nguoi giao thuoc phien ban van hanh da khoa';
  end if;
  if target_type='RECEIVER' and (
    tg_op<>'UPDATE' or current_status not in (
      'MANAGEMENT_CHANGES_REQUESTED',
      'ACCOUNTING_CHANGES_REQUESTED'
    )
  ) then
    raise exception 'Chu ky nguoi nhan chi duoc cap nhat khi ky ban dieu chinh';
  end if;
  return case when tg_op='DELETE' then old else new end;
end
$$;

drop trigger if exists handover_participants_operational_signature_guard on handover_participants;
create trigger handover_participants_operational_signature_guard
before insert or update or delete on handover_participants
for each row execute function protect_operational_handover_signatures();