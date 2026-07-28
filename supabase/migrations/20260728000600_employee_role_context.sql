begin;

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
  v_role jsonb;
begin
  select *
  into v_employee
  from public.a25_internal_branch_employee_account(p_username,p_password);

  perform public.a25_internal_prepare_three_shifts(
    v_employee.organization_id,
    v_employee.branch_id
  );
  select jsonb_build_object('code',role.code,'name',role.name)
  into v_role
  from branch_memberships membership
  join roles role on role.id=membership.role_id
  where membership.profile_id=v_employee.employee_id
    and membership.branch_id=v_employee.branch_id
    and membership.is_active
  limit 1;

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
      'username',v_employee.employee_username,
      'role',v_role
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

create or replace function public.a25_work_session_role(p_work_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_context jsonb;
begin
  if auth.uid() is null then
    raise exception 'Phien dang nhap chi nhanh khong hop le';
  end if;

  select jsonb_build_object(
    'employeeId',profile.id,
    'employeeName',profile.full_name,
    'employeeCode',profile.employee_code,
    'role',jsonb_build_object('code',role.code,'name',role.name),
    'branchId',session.branch_id
  )
  into v_context
  from work_sessions session
  join profiles profile on profile.id=session.profile_id
  join branch_memberships membership
    on membership.profile_id=session.profile_id
   and membership.branch_id=session.branch_id
   and membership.is_active
  join roles role on role.id=membership.role_id
  where session.id=p_work_session_id
    and session.authenticated_by=auth.uid()
    and session.status='ACTIVE'
    and session.ended_at is null
  limit 1;

  return v_context;
end;
$$;

revoke all on function public.a25_work_session_role(uuid) from public;
grant execute on function public.a25_work_session_role(uuid) to authenticated;

commit;
