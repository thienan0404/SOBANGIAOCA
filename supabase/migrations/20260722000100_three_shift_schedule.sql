begin;

alter table shift_definitions
  add column if not exists handover_start_time time,
  add column if not exists handover_end_time time,
  add column if not exists handover_to_code text;

create unique index if not exists shift_instances_definition_start_unique
  on shift_instances(branch_id,shift_definition_id,starts_at)
  where shift_definition_id is not null;

insert into shift_definitions(
  organization_id,name,code,start_time,end_time,
  handover_start_time,handover_end_time,handover_to_code
)
select organization.id,definition.name,definition.code,definition.start_time,definition.end_time,
       definition.handover_start_time,definition.handover_end_time,definition.handover_to_code
from organizations organization
cross join (values
  ('Ca 1','CA1','07:00'::time,'16:00'::time,'15:30'::time,'16:00'::time,'Ca 2'),
  ('Ca 2','CA2','13:30'::time,'22:30'::time,'22:15'::time,'22:30'::time,'Ca 3'),
  ('Ca 3','CA3','22:15'::time,'07:15'::time,'07:00'::time,'07:15'::time,'Ca 1')
) as definition(name,code,start_time,end_time,handover_start_time,handover_end_time,handover_to_code)
where organization.code='A25'
on conflict(organization_id,code) do update set
  name=excluded.name,
  start_time=excluded.start_time,
  end_time=excluded.end_time,
  handover_start_time=excluded.handover_start_time,
  handover_end_time=excluded.handover_end_time,
  handover_to_code=excluded.handover_to_code;

create or replace function public.a25_internal_prepare_three_shifts(
  p_organization_id uuid,
  p_branch_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_local_now timestamp;
  v_work_date date;
begin
  v_local_now:=now() at time zone 'Asia/Ho_Chi_Minh';
  v_work_date:=case
    when v_local_now::time<'07:15'::time then v_local_now::date-1
    else v_local_now::date
  end;

  insert into shift_instances(
    organization_id,branch_id,shift_definition_id,shift_code,
    starts_at,ends_at,status
  )
  select
    p_organization_id,
    p_branch_id,
    definition.id,
    definition.name,
    (v_work_date+definition.start_time) at time zone 'Asia/Ho_Chi_Minh',
    (
      v_work_date
      + case when definition.end_time<=definition.start_time then 1 else 0 end
      + definition.end_time
    ) at time zone 'Asia/Ho_Chi_Minh',
    'OPEN'
  from shift_definitions definition
  where definition.organization_id=p_organization_id
    and definition.code in('CA1','CA2','CA3')
  on conflict(branch_id,shift_definition_id,starts_at)
    where shift_definition_id is not null
  do update set
    shift_code=excluded.shift_code,
    ends_at=excluded.ends_at,
    status='OPEN';
end;
$$;

create or replace function public.a25_verify_employee_account(
  p_username text,
  p_password text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_employee record;
  v_assignments jsonb;
begin
  select *
  into v_employee
  from public.a25_internal_branch_employee_account(p_username,p_password);

  perform public.a25_internal_prepare_three_shifts(
    v_employee.organization_id,
    v_employee.branch_id
  );

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id',shift.id,
        'assignmentType','RECEPTIONIST',
        'canConfirm',now()>=shift.starts_at-interval '60 minutes' and now()<=shift.ends_at,
        'availability',case
          when now()<shift.starts_at-interval '60 minutes' then 'UPCOMING'
          when now()>shift.ends_at then 'ENDED'
          else 'AVAILABLE'
        end,
        'handover',jsonb_build_object(
          'toShift',definition.handover_to_code,
          'startsAt',(
            (shift.starts_at at time zone 'Asia/Ho_Chi_Minh')::date
            + case when definition.handover_start_time<definition.start_time then 1 else 0 end
            + definition.handover_start_time
          ) at time zone 'Asia/Ho_Chi_Minh',
          'endsAt',(
            (shift.starts_at at time zone 'Asia/Ho_Chi_Minh')::date
            + case when definition.handover_end_time<definition.start_time then 1 else 0 end
            + definition.handover_end_time
          ) at time zone 'Asia/Ho_Chi_Minh'
        ),
        'shift',jsonb_build_object(
          'id',shift.id,
          'shiftCode',shift.shift_code,
          'startsAt',shift.starts_at,
          'endsAt',shift.ends_at,
          'branch',jsonb_build_object(
            'id',v_employee.branch_id,
            'name',v_employee.branch_name,
            'code',v_employee.branch_code,
            'address',v_employee.branch_address
          )
        )
      )
      order by case definition.code when 'CA1' then 1 when 'CA2' then 2 else 3 end
    ),
    '[]'::jsonb
  )
  into v_assignments
  from shift_instances shift
  join shift_definitions definition on definition.id=shift.shift_definition_id
  where shift.branch_id=v_employee.branch_id
    and definition.code in('CA1','CA2','CA3')
    and shift.starts_at>=(
      case
        when (now() at time zone 'Asia/Ho_Chi_Minh')::time<'07:15'::time
          then ((now() at time zone 'Asia/Ho_Chi_Minh')::date-1+'00:00'::time)
        else ((now() at time zone 'Asia/Ho_Chi_Minh')::date+'00:00'::time)
      end
    ) at time zone 'Asia/Ho_Chi_Minh'
    and shift.starts_at<(
      case
        when (now() at time zone 'Asia/Ho_Chi_Minh')::time<'07:15'::time
          then ((now() at time zone 'Asia/Ho_Chi_Minh')::date+'00:00'::time)
        else ((now() at time zone 'Asia/Ho_Chi_Minh')::date+1+'00:00'::time)
      end
    ) at time zone 'Asia/Ho_Chi_Minh';

  return jsonb_build_object(
    'employee',jsonb_build_object(
      'id',v_employee.employee_id,
      'fullName',v_employee.employee_name,
      'employeeCode',v_employee.employee_code,
      'username',v_employee.employee_username
    ),
    'branch',jsonb_build_object(
      'id',v_employee.branch_id,
      'name',v_employee.branch_name,
      'code',v_employee.branch_code,
      'address',v_employee.branch_address
    ),
    'assignments',v_assignments,
    'serverTime',now()
  );
end;
$$;

create or replace function public.a25_start_work_session_account(
  p_username text,
  p_password text,
  p_shift_instance_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_employee record;
  v_shift record;
  v_active record;
  v_session_id uuid;
  v_schedule_match text;
  v_difference_minutes integer;
begin
  select *
  into v_employee
  from public.a25_internal_branch_employee_account(p_username,p_password);

  select id,branch_id,shift_instance_id
  into v_active
  from work_sessions
  where profile_id=v_employee.employee_id
    and status='ACTIVE'
    and ended_at is null
  order by actual_start desc
  limit 1;

  if found then
    if v_active.branch_id=v_employee.branch_id
       and v_active.shift_instance_id=p_shift_instance_id then
      return jsonb_build_object('id',v_active.id,'branchId',v_active.branch_id);
    end if;
    raise exception 'Nhan vien dang co mot phien lam viec khac';
  end if;

  select shift.id,shift.organization_id,shift.branch_id,shift.starts_at,shift.ends_at
  into v_shift
  from shift_instances shift
  join shift_definitions definition on definition.id=shift.shift_definition_id
  where shift.id=p_shift_instance_id
    and shift.branch_id=v_employee.branch_id
    and definition.code in('CA1','CA2','CA3')
    and now()>=shift.starts_at-interval '60 minutes'
    and now()<=shift.ends_at;

  if not found then
    raise exception 'Ca lam viec chua den gio hoac da ket thuc';
  end if;

  insert into shift_assignments(shift_instance_id,profile_id,assignment_type)
  values(v_shift.id,v_employee.employee_id,'RECEPTIONIST')
  on conflict(shift_instance_id,profile_id) do update
  set assignment_type=excluded.assignment_type;

  v_difference_minutes:=round(extract(epoch from(now()-v_shift.starts_at))/60);
  v_schedule_match:=case
    when abs(v_difference_minutes)<=15 then 'ON_TIME'
    when v_difference_minutes<0 then 'EARLY'
    else 'LATE'
  end;

  insert into work_sessions(
    organization_id,profile_id,authenticated_by,branch_id,shift_instance_id,
    schedule_match,scheduled_start,actual_start
  )
  values(
    v_shift.organization_id,v_employee.employee_id,auth.uid(),v_employee.branch_id,
    v_shift.id,v_schedule_match,v_shift.starts_at,now()
  )
  returning id into v_session_id;

  return jsonb_build_object('id',v_session_id,'branchId',v_employee.branch_id);
end;
$$;

revoke all on function public.a25_internal_prepare_three_shifts(uuid,uuid) from public;
revoke all on function public.a25_internal_prepare_three_shifts(uuid,uuid) from authenticated;
revoke all on function public.a25_verify_employee_account(text,text) from public;
revoke all on function public.a25_start_work_session_account(text,text,uuid) from public;

grant execute on function public.a25_verify_employee_account(text,text) to authenticated;
grant execute on function public.a25_start_work_session_account(text,text,uuid) to authenticated;

commit;
