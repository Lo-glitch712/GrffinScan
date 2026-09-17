-- GriffinScan tables. Run once in Supabase → SQL Editor → New query.

create table if not exists public.students (
  id text primary key,
  lastname text not null,
  firstname text not null,
  course text not null,
  yearsection text not null,
  password text not null default '',
  created_at timestamptz default now()
);

alter table public.students add column if not exists password text not null default '';

create table if not exists public.events (
  id bigint generated always as identity primary key,
  name text not null,
  is_open boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz
);

create table if not exists public.hosts (
  id bigint generated always as identity primary key,
  username text unique not null,
  password text not null,
  current_session text
);

create table if not exists public.admins (
  id bigint generated always as identity primary key,
  username text unique not null,
  password text not null,
  current_session text
);

create table if not exists public.attendance (
  student_id text not null references public.students(id) on delete cascade,
  event_id bigint not null references public.events(id) on delete cascade,
  primary key (student_id, event_id)
);

insert into public.admins (username, password)
values ('admin', 'admin')
on conflict (username) do update
set password = excluded.password;

insert into public.hosts (username, password)
values ('host', 'host')
on conflict (username) do update
set password = excluded.password;

alter table public.students enable row level security;
alter table public.events enable row level security;
alter table public.hosts enable row level security;
alter table public.admins enable row level security;
alter table public.attendance enable row level security;

drop policy if exists "griffinscan students" on public.students;
drop policy if exists "griffinscan events" on public.events;
drop policy if exists "griffinscan hosts" on public.hosts;
drop policy if exists "griffinscan admins" on public.admins;
drop policy if exists "griffinscan attendance" on public.attendance;

create policy "griffinscan students" on public.students for all using (true) with check (true);
create policy "griffinscan events" on public.events for all using (true) with check (true);
create policy "griffinscan hosts" on public.hosts for all using (true) with check (true);
create policy "griffinscan admins" on public.admins for all using (true) with check (true);
create policy "griffinscan attendance" on public.attendance for all using (true) with check (true);

grant usage on schema public to anon, authenticated;
grant all on table public.students, public.events, public.hosts, public.admins, public.attendance to anon, authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;
