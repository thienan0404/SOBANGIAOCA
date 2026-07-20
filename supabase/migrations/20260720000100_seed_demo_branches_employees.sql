begin;

create extension if not exists pgcrypto with schema extensions;

insert into organizations(name,code)
values('A25 Hotel','A25')
on conflict(code) do update set name=excluded.name;

insert into branches(organization_id,name,code,address)
select organization.id,demo.name,demo.code,demo.address
from organizations organization
cross join (values
  ('45 Phan Chu Trinh','PCT45','45 Phan Chu Trinh, Hà Nội'),
  ('14 Hồ Huấn Nghiệp','HHN14','14 Hồ Huấn Nghiệp, TP. Hồ Chí Minh'),
  ('18 Nguyễn Hy Quang','NHQ18','18 Nguyễn Hy Quang, Hà Nội')
) as demo(name,code,address)
where organization.code='A25'
on conflict(organization_id,code) do update
set name=excluded.name,address=excluded.address;

insert into roles(code,name)
values('RECEPTIONIST','Lễ tân')
on conflict(code) do update set name=excluded.name;

create temporary table demo_employees(
  id uuid primary key,
  email text not null,
  full_name text not null,
  employee_code text not null,
  branch_code text not null
) on commit drop;

insert into demo_employees(id,email,full_name,employee_code,branch_code) values
('10000000-0000-4000-8000-000000000001','nv01@a25hotel.com','Nguyễn Minh Anh','A25001','PCT45'),
('10000000-0000-4000-8000-000000000002','nv02@a25hotel.com','Trần Văn Nam','A25002','PCT45'),
('10000000-0000-4000-8000-000000000003','nv03@a25hotel.com','Lê Thị Hương','A25003','PCT45'),
('10000000-0000-4000-8000-000000000004','nv04@a25hotel.com','Phạm Quang Huy','A25004','HHN14'),
('10000000-0000-4000-8000-000000000005','nv05@a25hotel.com','Hoàng Thu Trang','A25005','HHN14'),
('10000000-0000-4000-8000-000000000006','nv06@a25hotel.com','Đỗ Minh Đức','A25006','HHN14'),
('10000000-0000-4000-8000-000000000007','nv07@a25hotel.com','Vũ Ngọc Mai','A25007','NHQ18'),
('10000000-0000-4000-8000-000000000008','nv08@a25hotel.com','Bùi Gia Bảo','A25008','NHQ18'),
('10000000-0000-4000-8000-000000000009','nv09@a25hotel.com','Nguyễn Khánh Linh','A25009','NHQ18');

insert into auth.users(
  instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,
  raw_app_meta_data,raw_user_meta_data,created_at,updated_at
)
select
  '00000000-0000-0000-0000-000000000000'::uuid,
  employee.id,'authenticated','authenticated',employee.email,
  extensions.crypt('A25@123456',extensions.gen_salt('bf')),now(),
  jsonb_build_object('provider','email','providers',jsonb_build_array('email')),
  jsonb_build_object('full_name',employee.full_name,'employee_code',employee.employee_code),
  now(),now()
from demo_employees employee
on conflict(id) do update set
  email=excluded.email,
  encrypted_password=excluded.encrypted_password,
  email_confirmed_at=excluded.email_confirmed_at,
  raw_app_meta_data=excluded.raw_app_meta_data,
  raw_user_meta_data=excluded.raw_user_meta_data,
  updated_at=now();

insert into auth.identities(
  id,provider_id,user_id,identity_data,provider,last_sign_in_at,created_at,updated_at
)
select
  gen_random_uuid(),employee.email,employee.id,
  jsonb_build_object('sub',employee.id::text,'email',employee.email,'email_verified',true),
  'email',now(),now(),now()
from demo_employees employee
on conflict(provider_id,provider) do update set
  identity_data=excluded.identity_data,
  updated_at=now();

insert into profiles(id,organization_id,full_name,email,employee_code,is_active)
select employee.id,organization.id,employee.full_name,employee.email,employee.employee_code,true
from demo_employees employee
join organizations organization on organization.code='A25'
on conflict(id) do update set
  organization_id=excluded.organization_id,
  full_name=excluded.full_name,
  email=excluded.email,
  employee_code=excluded.employee_code,
  is_active=true,
  updated_at=now();

insert into branch_memberships(profile_id,branch_id,role_id,is_active)
select employee.id,branch.id,role.id,true
from demo_employees employee
join organizations organization on organization.code='A25'
join branches branch on branch.organization_id=organization.id and branch.code=employee.branch_code
join roles role on role.code='RECEPTIONIST'
on conflict(profile_id,branch_id) do update set
  role_id=excluded.role_id,
  is_active=true;

commit;
