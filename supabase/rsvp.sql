-- Bruner Carnivale Venice 2027 — RSVP + host report
-- Additive. Safe to re-run.
-- Paste this whole file into the Supabase SQL Editor and run it on the
-- existing project (the live site already has schema.sql).

-- ---------------------------------------------------------------------------
-- Host flag on the whitelist (Aileen & Chris). Add more later with:
--   update public.allowed_emails set is_host = true where email = 'you@example.com';
-- ---------------------------------------------------------------------------
alter table public.allowed_emails
  add column if not exists is_host boolean not null default false;

update public.allowed_emails
set is_host = true
where lower(email) in (
  'aileenpb@gmail.com',
  'christian.a.bruner@gmail.com'
);

-- ---------------------------------------------------------------------------
-- One RSVP per invited email. Guests never read this table directly.
-- ---------------------------------------------------------------------------
create table if not exists public.rsvps (
  email text primary key references public.allowed_emails (email) on delete cascade,
  status text not null check (status in ('yes', 'no', 'maybe')),
  updated_at timestamptz not null default now()
);

alter table public.rsvps enable row level security;

revoke all on table public.rsvps from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Guest: read own RSVP
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- Guest: set or change own RSVP (yes / no / maybe)
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- Host check (does not leak the guest list)
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- Host report: every invited email, including people who have not replied.
-- ---------------------------------------------------------------------------
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

-- Optional dashboard query (SQL Editor, service role — not for the website):
--   select
--     coalesce(r.status, 'no reply') as rsvp,
--     count(*) as guests
--   from public.allowed_emails a
--   left join public.rsvps r on r.email = a.email
--   group by 1
--   order by 1;
