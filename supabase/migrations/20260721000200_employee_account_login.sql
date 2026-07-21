begin;

create table if not exists employee_credentials(
  profile_id uuid primary key references profiles(id) on delete cascade,
  username text not null unique check(username=lower(username)),
  password_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table employee_credentials enable row level security;
revoke all on table employee_credentials from anon,authenticated;

insert into employee_credentials(profile_id,username,password_hash)
select
  profile.id,
  lower(split_part(profile.email,'@',1)),
  extensions.crypt('A25@123456',extensions.gen_salt('bf',12))
from profiles profile
where profile.employee_code is not null
on conflict(profile_id) do update
set username=excluded.username,
    updated_at=now();

create or replace function public.a25_internal_branch_employee_account(
  p_username text,
  p_password text
)
returns table(
  employee_id uuid,
  employee_name text,
  employee_code text,
  employee_username text,
  branch_id uuid,
  branch_name text,
  branch_code text,
  branch_address text,
  organization_id uuid
)
language plpgsql
security definer
set search_path = public,extensions
as $$
declare
  v_username text;
  v_branch_count integer;
begin
  if auth.uid() is null then
    raise exception 'Phien dang nhap chi nhanh khong hop le';
  end if;

  v_username:=lower(trim(coalesce(p_username,'')));
  if length(v_username)<3 or coalesce(p_password,'')='' then
    raise exception 'Tai khoan nhan vien hoac mat khau chua chinh xac';
  end if;

  select count(*)
  into v_branch_count
  from branch_memberships membership
  join roles role on role.id=membership.role_id
  join profiles account on account.id=membership.profile_id
  where membership.profile_id=auth.uid()
    and membership.is_active
    and account.is_active
    and role.code='BRANCH_ACCOUNT';

  if v_branch_count<>1 then
    raise exception 'Tai khoan phai duoc gan voi dung mot chi nhanh';
  end if;

  return query
  select
    employee.id,
    employee.full_name,
    employee.employee_code,
    credential.username,
    branch.id,
    branch.name,
    branch.code,
    branch.address,
    branch.organization_id
  from employee_credentials credential
  join profiles employee on employee.id=credential.profile_id
  join branch_memberships employee_membership
    on employee_membership.profile_id=employee.id
   and employee_membership.is_active
  join branches branch on branch.id=employee_membership.branch_id
  join branch_memberships account_membership
    on account_membership.branch_id=branch.id
   and account_membership.profile_id=auth.uid()
   and account_membership.is_active
  join roles account_role
    on account_role.id=account_membership.role_id
   and account_role.code='BRANCH_ACCOUNT'
  where employee.is_active
    and credential.username=v_username
    and credential.password_hash=extensions.crypt(p_password,credential.password_hash)
  limit 1;

  if not found then
    raise exception 'Tai khoan nhan vien hoac mat khau chua chinh xac';
  end if;
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

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id',assignment.id,
        'assignmentType',assignment.assignment_type,
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
      order by shift.starts_at
    ),
    '[]'::jsonb
  )
  into v_assignments
  from shift_assignments assignment
  join shift_instances shift on shift.id=assignment.shift_instance_id
  where assignment.profile_id=v_employee.employee_id
    and shift.branch_id=v_employee.branch_id
    and shift.starts_at<=now()+interval '60 minutes'
    and shift.ends_at>=now();

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

  select shift.id,shift.organization_id,shift.branch_id,shift.starts_at
  into v_shift
  from shift_assignments assignment
  join shift_instances shift on shift.id=assignment.shift_instance_id
  where assignment.profile_id=v_employee.employee_id
    and assignment.shift_instance_id=p_shift_instance_id
    and shift.branch_id=v_employee.branch_id
    and shift.starts_at<=now()+interval '60 minutes'
    and shift.ends_at>=now();

  if not found then
    raise exception 'Khong tim thay lich phan ca phu hop voi gio thuc te';
  end if;

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

revoke all on function public.a25_internal_branch_employee_account(text,text) from public;
revoke all on function public.a25_verify_employee_account(text,text) from public;
revoke all on function public.a25_start_work_session_account(text,text,uuid) from public;

grant execute on function public.a25_verify_employee_account(text,text) to authenticated;
grant execute on function public.a25_start_work_session_account(text,text,uuid) to authenticated;

commit;
