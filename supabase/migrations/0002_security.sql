-- Devign Lead Forge Supabase hardening for password-based Supabase Auth.
--
-- Supabase Auth owns the user identity and issues the bearer access token. The
-- Vercel API validates that token, upserts auth.users metadata into the
-- internal users.auth_user_id mapping, and performs lead authorization in
-- server/routers.ts. The browser uses Supabase Auth directly, but lead data is
-- intentionally served through the API rather than directly through PostgREST.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists users_set_updated_at on public.users;
create trigger users_set_updated_at
before update on public.users
for each row execute function public.set_updated_at();

drop trigger if exists leads_set_updated_at on public.leads;
create trigger leads_set_updated_at
before update on public.leads
for each row execute function public.set_updated_at();

-- Claiming is intentionally one-way. The API performs the null-to-owner
-- transition atomically, while this trigger prevents accidental reassignment
-- or release through any direct SQL update path.
create or replace function public.prevent_claim_reassignment()
returns trigger
language plpgsql
as $$
begin
  if old.claimed_by_user_id is not null
     and new.claimed_by_user_id is distinct from old.claimed_by_user_id then
    raise exception 'Lead claim ownership is locked';
  end if;
  return new;
end;
$$;

drop trigger if exists leads_prevent_claim_reassignment on public.leads;
create trigger leads_prevent_claim_reassignment
before update on public.leads
for each row execute function public.prevent_claim_reassignment();

alter table public.users enable row level security;
alter table public.leads enable row level security;

-- No anon/authenticated policies are intentionally created. PostgreSQL RLS
-- therefore denies direct browser reads and writes. The Vercel API uses the
-- server-only Supabase Postgres connection and enforces the verified Supabase
-- Auth identity and lead ownership in the tRPC procedures.
revoke all on table public.users from anon, authenticated;
revoke all on table public.leads from anon, authenticated;

create index if not exists leads_claimed_by_user_id_idx
  on public.leads (claimed_by_user_id);
create index if not exists leads_type_idx
  on public.leads (type);
create index if not exists leads_updated_at_idx
  on public.leads (updated_at desc);
