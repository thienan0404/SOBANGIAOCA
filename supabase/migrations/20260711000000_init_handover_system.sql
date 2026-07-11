create extension if not exists pgcrypto;

create type public.staff_role as enum ('admin', 'manager', 'receptionist');
create type public.shift_type as enum ('morning', 'afternoon', 'night');
create type public.shift_status as enum ('open', 'handed_over', 'acknowledged');
create type public.item_status as enum ('open', 'in_progress', 'pending_confirmation', 'completed');
create type public.item_priority as enum ('urgent', 'high', 'normal', 'low');

create table public.hotels (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  timezone text not null default 'Asia/Ho_Chi_Minh',
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  hotel_id uuid not null references public.hotels(id) on delete restrict,
  full_name text not null,
  role public.staff_role not null default 'receptionist',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.shifts (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  shift_type public.shift_type not null,
  handover_to public.shift_type not null,
  business_date date not null default current_date,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  status public.shift_status not null default 'open',
  opened_by uuid not null references public.profiles(id),
  received_by uuid references public.profiles(id),
  acknowledged_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.handover_items (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null references public.shifts(id) on delete cascade,
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  title text not null check (char_length(title) between 3 and 180),
  details text not null default '',
  room_number text,
  category text not null default 'general',
  priority public.item_priority not null default 'normal',
  status public.item_status not null default 'open',
  due_at timestamptz,
  created_by uuid not null references public.profiles(id),
  assigned_to uuid references public.profiles(id),
  completed_by uuid references public.profiles(id),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.shift_acknowledgements (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null references public.shifts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  acknowledged_at timestamptz not null default now(),
  unique (shift_id, user_id)
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  entity_type text not null,
  entity_id uuid not null,
  action text not null,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);

create index handover_items_hotel_status_idx on public.handover_items(hotel_id, status, created_at desc);
create index handover_items_shift_idx on public.handover_items(shift_id, created_at desc);
create index shifts_hotel_date_idx on public.shifts(hotel_id, business_date desc, starts_at desc);
create index audit_logs_hotel_created_idx on public.audit_logs(hotel_id, created_at desc);

insert into public.hotels (name, address)
values ('A25 Hotel', 'Hà Nội')
on conflict do nothing;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger shifts_set_updated_at before update on public.shifts for each row execute function public.set_updated_at();
create trigger handover_items_set_updated_at before update on public.handover_items for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare default_hotel uuid;
begin
  select id into default_hotel from public.hotels order by created_at limit 1;
  insert into public.profiles (id, hotel_id, full_name)
  values (new.id, default_hotel, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.current_hotel_id()
returns uuid language sql stable security definer set search_path = public
as $$ select hotel_id from public.profiles where id = auth.uid() and is_active = true $$;

create or replace function public.current_staff_role()
returns public.staff_role language sql stable security definer set search_path = public
as $$ select role from public.profiles where id = auth.uid() and is_active = true $$;

alter table public.hotels enable row level security;
alter table public.profiles enable row level security;
alter table public.shifts enable row level security;
alter table public.handover_items enable row level security;
alter table public.shift_acknowledgements enable row level security;
alter table public.audit_logs enable row level security;

create policy hotels_select_member on public.hotels for select to authenticated using (id = public.current_hotel_id());
create policy profiles_select_colleagues on public.profiles for select to authenticated using (hotel_id = public.current_hotel_id());
create policy profiles_update_self on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid() and hotel_id = public.current_hotel_id());
create policy shifts_select_member on public.shifts for select to authenticated using (hotel_id = public.current_hotel_id());
create policy shifts_insert_member on public.shifts for insert to authenticated with check (hotel_id = public.current_hotel_id() and opened_by = auth.uid());
create policy shifts_update_member on public.shifts for update to authenticated using (hotel_id = public.current_hotel_id()) with check (hotel_id = public.current_hotel_id());
create policy items_select_member on public.handover_items for select to authenticated using (hotel_id = public.current_hotel_id());
create policy items_insert_member on public.handover_items for insert to authenticated with check (hotel_id = public.current_hotel_id() and created_by = auth.uid());
create policy items_update_member on public.handover_items for update to authenticated using (hotel_id = public.current_hotel_id()) with check (hotel_id = public.current_hotel_id());
create policy items_delete_manager on public.handover_items for delete to authenticated using (hotel_id = public.current_hotel_id() and public.current_staff_role() in ('admin', 'manager'));
create policy acknowledgements_select_member on public.shift_acknowledgements for select to authenticated using (exists (select 1 from public.shifts s where s.id = shift_id and s.hotel_id = public.current_hotel_id()));
create policy acknowledgements_insert_self on public.shift_acknowledgements for insert to authenticated with check (user_id = auth.uid() and exists (select 1 from public.shifts s where s.id = shift_id and s.hotel_id = public.current_hotel_id()));
create policy audit_select_manager on public.audit_logs for select to authenticated using (hotel_id = public.current_hotel_id() and public.current_staff_role() in ('admin', 'manager'));

create or replace function public.audit_handover_item()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.audit_logs (hotel_id, actor_id, entity_type, entity_id, action, old_data, new_data)
  values (coalesce(new.hotel_id, old.hotel_id), auth.uid(), 'handover_item', coalesce(new.id, old.id), lower(tg_op), to_jsonb(old), to_jsonb(new));
  return coalesce(new, old);
end;
$$;
create trigger handover_item_audit after insert or update or delete on public.handover_items for each row execute function public.audit_handover_item();

alter publication supabase_realtime add table public.handover_items;
alter publication supabase_realtime add table public.shifts;

grant usage on schema public to authenticated;
grant select on public.hotels, public.profiles, public.shifts, public.handover_items, public.shift_acknowledgements to authenticated;
grant insert, update on public.shifts, public.handover_items to authenticated;
grant delete on public.handover_items to authenticated;
grant insert on public.shift_acknowledgements to authenticated;
