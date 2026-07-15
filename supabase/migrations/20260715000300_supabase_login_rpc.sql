begin;

create or replace function public.a25_internal_branch_employee(
  p_identifier text,
  p_pin text
)
returns table(
  employee_id uuid,
  employee_name text,
  employee_code text,
  employee_must_change_pin boolean,
  branch_id uuid,
  branch_name text,
  branch_code text,
  branch_address text,
  organization_id uuid
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_code text;
  v_branch_count integer;
begin
  if auth.uid() is null then
    raise exception 'Phien dang nhap chi nhanh khong hop le';
  end if;

  if p_pin is null or p_pin !~ '^[0-9]{6}$' then
    raise exception 'PIN phai gom dung 6 chu so';
  end if;

  v_code := upper(trim(coalesce(p_identifier, '')));
  v_code := regexp_replace(v_code, '^A25EMP:', '', 'i');
  v_code := regexp_replace(v_code, '^A25://EMPLOYEE/', '', 'i');

  select count(*)
  into v_branch_count
  from branch_memberships bm
  join roles r on r.id = bm.role_id
  join profiles p on p.id = bm.profile_id
  where bm.profile_id = auth.uid()
    and bm.is_active
    and p.is_active
    and r.code = 'BRANCH_ACCOUNT';

  if v_branch_count <> 1 then
    raise exception 'Tai khoan phai duoc gan voi dung mot chi nhanh';
  end if;

  return query
  select
    employee.id,
    employee.full_name,
    employee.employee_code,
    employee.must_change_pin,
    b.id,
    b.name,
    b.code,
    b.address,
    b.organization_id
  from profiles employee
  join branch_memberships employee_membership
    on employee_membership.profile_id = employee.id
   and employee_membership.is_active
  join branches b on b.id = employee_membership.branch_id
  join branch_memberships account_membership
    on account_membership.branch_id = b.id
   and account_membership.profile_id = auth.uid()
   and account_membership.is_active
  join roles account_role on account_role.id = account_membership.role_id
  where account_role.code = 'BRANCH_ACCOUNT'
    and employee.is_active
    and upper(employee.employee_code) = v_code
    and coalesce(
      employee.pin_hash = extensions.crypt(p_pin, employee.pin_hash),
      false
    )
  limit 1;

  if not found then
    raise exception 'Ma nhan vien hoac PIN chua chinh xac';
  end if;
end;
$$;

revoke all on function public.a25_internal_branch_employee(text, text) from public;
revoke all on function public.a25_internal_branch_employee(text, text) from authenticated;

create or replace function public.a25_branch_login_context()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_context record;
  v_count integer;
  v_active jsonb;
begin
  if auth.uid() is null then
    raise exception 'Phien dang nhap chi nhanh khong hop le';
  end if;

  select count(*)
  into v_count
  from branch_memberships bm
  join roles r on r.id = bm.role_id
  join profiles p on p.id = bm.profile_id
  where bm.profile_id = auth.uid()
    and bm.is_active
    and p.is_active
    and r.code = 'BRANCH_ACCOUNT';

  if v_count <> 1 then
    raise exception 'Tai khoan phai duoc gan voi dung mot chi nhanh';
  end if;

  select
    p.id as account_id,
    p.full_name as account_name,
    p.email as account_email,
    b.id as branch_id,
    b.name as branch_name,
    b.code as branch_code,
    b.address as branch_address
  into v_context
  from profiles p
  join branch_memberships bm on bm.profile_id = p.id and bm.is_active
  join roles r on r.id = bm.role_id and r.code = 'BRANCH_ACCOUNT'
  join branches b on b.id = bm.branch_id
  where p.id = auth.uid() and p.is_active;

  select jsonb_build_object(
    'id', ws.id,
    'branchId', ws.branch_id,
    'profile', jsonb_build_object(
      'fullName', employee.full_name,
      'employeeCode', employee.employee_code
    )
  )
  into v_active
  from work_sessions ws
  join profiles employee on employee.id = ws.profile_id
  where ws.authenticated_by = auth.uid()
    and ws.status = 'ACTIVE'
    and ws.ended_at is null
  order by ws.actual_start desc
  limit 1;

  return jsonb_build_object(
    'account', jsonb_build_object(
      'id', v_context.account_id,
      'fullName', v_context.account_name,
      'email', v_context.account_email
    ),
    'branch', jsonb_build_object(
      'id', v_context.branch_id,
      'name', v_context.branch_name,
      'code', v_context.branch_code,
      'address', v_context.branch_address
    ),
    'activeSession', v_active
  );
end;
$$;

create or replace function public.a25_verify_employee(
  p_identifier text,
  p_pin text
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
  from public.a25_internal_branch_employee(p_identifier, p_pin);

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', assignment.id,
        'assignmentType', assignment.assignment_type,
        'shift', jsonb_build_object(
          'id', shift.id,
          'shiftCode', shift.shift_code,
          'startsAt', shift.starts_at,
          'endsAt', shift.ends_at,
          'branch', jsonb_build_object(
            'id', v_employee.branch_id,
            'name', v_employee.branch_name,
            'code', v_employee.branch_code,
            'address', v_employee.branch_address
          )
        )
      )
      order by shift.starts_at
    ),
    '[]'::jsonb
  )
  into v_assignments
  from shift_assignments assignment
  join shift_instances shift on shift.id = assignment.shift_instance_id
  where assignment.profile_id = v_employee.employee_id
    and shift.branch_id = v_employee.branch_id
    and shift.starts_at <= now() + interval '60 minutes'
    and shift.ends_at >= now();

  return jsonb_build_object(
    'employee', jsonb_build_object(
      'id', v_employee.employee_id,
      'fullName', v_employee.employee_name,
      'employeeCode', v_employee.employee_code,
      'mustChangePin', v_employee.employee_must_change_pin
    ),
    'branch', jsonb_build_object(
      'id', v_employee.branch_id,
      'name', v_employee.branch_name,
      'code', v_employee.branch_code,
      'address', v_employee.branch_address
    ),
    'assignments', v_assignments,
    'serverTime', now()
  );
end;
$$;

create or replace function public.a25_change_employee_pin(
  p_identifier text,
  p_current_pin text,
  p_new_pin text
)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_employee record;
begin
  if p_new_pin is null or p_new_pin !~ '^[0-9]{6}$' then
    raise exception 'PIN moi phai gom dung 6 chu so';
  end if;
  if p_new_pin = '888888' then
    raise exception 'PIN moi khong duoc trung PIN mac dinh';
  end if;
  if p_new_pin = p_current_pin then
    raise exception 'PIN moi phai khac PIN hien tai';
  end if;

  select *
  into v_employee
  from public.a25_internal_branch_employee(p_identifier, p_current_pin);

  update profiles
  set
    pin_hash = extensions.crypt(p_new_pin, extensions.gen_salt('bf', 12)),
    must_change_pin = false
  where id = v_employee.employee_id;

  return true;
end;
$$;

create or replace function public.a25_start_work_session(
  p_identifier text,
  p_pin text,
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
  from public.a25_internal_branch_employee(p_identifier, p_pin);

  if v_employee.employee_must_change_pin then
    raise exception 'Ban phai doi PIN mac dinh truoc khi xac nhan ca';
  end if;

  select id, branch_id, shift_instance_id
  into v_active
  from work_sessions
  where profile_id = v_employee.employee_id
    and status = 'ACTIVE'
    and ended_at is null
  order by actual_start desc
  limit 1;

  if found then
    if v_active.branch_id = v_employee.branch_id
       and v_active.shift_instance_id = p_shift_instance_id then
      return jsonb_build_object('id', v_active.id, 'branchId', v_active.branch_id);
    end if;
    raise exception 'Nhan vien dang co mot phien lam viec khac';
  end if;

  select
    shift.id,
    shift.organization_id,
    shift.branch_id,
    shift.starts_at
  into v_shift
  from shift_assignments assignment
  join shift_instances shift on shift.id = assignment.shift_instance_id
  where assignment.profile_id = v_employee.employee_id
    and assignment.shift_instance_id = p_shift_instance_id
    and shift.branch_id = v_employee.branch_id
    and shift.starts_at <= now() + interval '60 minutes'
    and shift.ends_at >= now();

  if not found then
    raise exception 'Khong tim thay lich phan ca phu hop voi gio thuc te';
  end if;

  v_difference_minutes := round(extract(epoch from (now() - v_shift.starts_at)) / 60);
  v_schedule_match := case
    when abs(v_difference_minutes) <= 15 then 'ON_TIME'
    when v_difference_minutes < 0 then 'EARLY'
    else 'LATE'
  end;

  insert into work_sessions(
    organization_id,
    profile_id,
    authenticated_by,
    branch_id,
    shift_instance_id,
    schedule_match,
    scheduled_start,
    actual_start
  )
  values(
    v_shift.organization_id,
    v_employee.employee_id,
    auth.uid(),
    v_employee.branch_id,
    v_shift.id,
    v_schedule_match,
    v_shift.starts_at,
    now()
  )
  returning id into v_session_id;

  return jsonb_build_object('id', v_session_id, 'branchId', v_employee.branch_id);
end;
$$;

create or replace function public.a25_end_work_session()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update work_sessions
  set status = 'COMPLETED', ended_at = now()
  where authenticated_by = auth.uid()
    and status = 'ACTIVE'
    and ended_at is null;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.a25_branch_login_context() from public;
revoke all on function public.a25_verify_employee(text, text) from public;
revoke all on function public.a25_change_employee_pin(text, text, text) from public;
revoke all on function public.a25_start_work_session(text, text, uuid) from public;
revoke all on function public.a25_end_work_session() from public;

grant execute on function public.a25_branch_login_context() to authenticated;
grant execute on function public.a25_verify_employee(text, text) to authenticated;
grant execute on function public.a25_change_employee_pin(text, text, text) to authenticated;
grant execute on function public.a25_start_work_session(text, text, uuid) to authenticated;
grant execute on function public.a25_end_work_session() to authenticated;

commit;
