-- Bruner Carnivale Venice 2027 — Supabase schema
-- Run this in the Supabase SQL Editor (Dashboard → SQL → New query).

-- ---------------------------------------------------------------------------
-- Whitelist (server-side only; never exposed as a table to the client)
-- ---------------------------------------------------------------------------
create table if not exists public.allowed_emails (
  email text primary key,
  note text,
  created_at timestamptz not null default now()
);

alter table public.allowed_emails enable row level security;

-- No SELECT/INSERT/UPDATE/DELETE policies for anon/authenticated.
-- Only the service role (dashboard / SQL) can manage rows directly.
-- Clients may only call is_email_allowed() below.

-- ---------------------------------------------------------------------------
-- Public RPC: returns true/false for one email (does not leak the full list)
-- ---------------------------------------------------------------------------
create or replace function public.is_email_allowed(check_email text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.allowed_emails
    where lower(email) = lower(trim(check_email))
  );
$$;

revoke all on function public.is_email_allowed(text) from public;
grant execute on function public.is_email_allowed(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Hard block: auth signups only for whitelisted emails
-- ---------------------------------------------------------------------------
create or replace function public.enforce_email_whitelist()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is null
     or not exists (
       select 1
       from public.allowed_emails
       where lower(email) = lower(new.email)
     )
  then
    raise exception 'Email is not on the guest list';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_email_whitelist on auth.users;
create trigger trg_enforce_email_whitelist
  before insert on auth.users
  for each row
  execute function public.enforce_email_whitelist();

-- ---------------------------------------------------------------------------
-- Initial guest list (add more later with INSERT)
-- ---------------------------------------------------------------------------
insert into public.allowed_emails (email, note) values
  ('aileenpb@gmail.com', 'initial'),
  ('christian.a.bruner@gmail.com', 'initial'),
  ('claudia@theweddinglibrary.com', 'initial')
on conflict (email) do nothing;

-- ---------------------------------------------------------------------------
-- Add a guest later (example):
--   insert into public.allowed_emails (email, note)
--   values ('friend@example.com', 'wave 2');
-- ---------------------------------------------------------------------------

-- RSVP + host report (also in rsvp.sql for existing projects).
-- Paste supabase/rsvp.sql into the SQL Editor if this project was already
-- created from an earlier schema.sql.

alter table public.allowed_emails
  add column if not exists is_host boolean not null default false;

update public.allowed_emails
set is_host = true
where lower(email) in (
  'aileenpb@gmail.com',
  'christian.a.bruner@gmail.com',
  'claudia@theweddinglibrary.com'
);

create table if not exists public.rsvps (
  email text primary key references public.allowed_emails (email) on delete cascade,
  status text not null check (status in ('yes', 'no', 'maybe')),
  updated_at timestamptz not null default now()
);

alter table public.rsvps enable row level security;

revoke all on table public.rsvps from public, anon, authenticated;

create or replace function public.get_my_rsvp()
returns table (status text, updated_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select r.status, r.updated_at
  from public.rsvps r
  where lower(r.email) = lower(trim(coalesce(auth.jwt() ->> 'email', '')));
$$;

revoke all on function public.get_my_rsvp() from public, anon;
grant execute on function public.get_my_rsvp() to authenticated;

create or replace function public.set_my_rsvp(new_status text)
returns table (status text, updated_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  guest_email text;
  normalized text;
begin
  normalized := lower(trim(new_status));
  if normalized not in ('yes', 'no', 'maybe') then
    raise exception 'Invalid RSVP';
  end if;

  select a.email
    into guest_email
  from public.allowed_emails a
  where lower(a.email) = lower(trim(coalesce(auth.jwt() ->> 'email', '')));

  if guest_email is null then
    raise exception 'Email is not on the guest list';
  end if;

  insert into public.rsvps (email, status, updated_at)
  values (guest_email, normalized, now())
  on conflict (email) do update
    set status = excluded.status,
        updated_at = now();

  return query
  select r.status, r.updated_at
  from public.rsvps r
  where r.email = guest_email;
end;
$$;

revoke all on function public.set_my_rsvp(text) from public, anon;
grant execute on function public.set_my_rsvp(text) to authenticated;

create or replace function public.i_am_host()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.allowed_emails a
    where lower(a.email) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
      and a.is_host
  );
$$;

revoke all on function public.i_am_host() from public, anon;
grant execute on function public.i_am_host() to authenticated;

create or replace function public.guest_rsvp_report()
returns table (
  email text,
  name text,
  rsvp text,
  rsvp_updated_at timestamptz,
  has_account boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.allowed_emails a
    where lower(a.email) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
      and a.is_host
  ) then
    raise exception 'Not authorized';
  end if;

  return query
  select
    a.email,
    a.note as name,
    r.status as rsvp,
    r.updated_at as rsvp_updated_at,
    exists (
      select 1
      from auth.users u
      where lower(u.email) = lower(a.email)
    ) as has_account
  from public.allowed_emails a
  left join public.rsvps r on lower(r.email) = lower(a.email)
  order by
    case r.status
      when 'yes' then 1
      when 'maybe' then 2
      when 'no' then 3
      else 4
    end,
    coalesce(a.note, a.email);
end;
$$;

revoke all on function public.guest_rsvp_report() from public, anon;
grant execute on function public.guest_rsvp_report() to authenticated;
