begin;

alter table profiles
  add column if not exists must_change_pin boolean not null default true;

create or replace function public.assign_default_employee_pin()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if new.employee_code is not null and new.pin_hash is null then
    new.pin_hash := extensions.crypt('888888', extensions.gen_salt('bf', 12));
    new.must_change_pin := true;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_assign_default_employee_pin on profiles;
create trigger profiles_assign_default_employee_pin
before insert or update of employee_code, pin_hash on profiles
for each row execute function public.assign_default_employee_pin();

update profiles
set pin_hash = extensions.crypt('888888', extensions.gen_salt('bf', 12)),
    must_change_pin = true
where employee_code is not null;

comment on column profiles.must_change_pin is
  'True until the employee replaces the initial 888888 PIN.';

commit;
