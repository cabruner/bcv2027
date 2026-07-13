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
