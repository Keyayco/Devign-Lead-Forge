-- Devign Lead Forge Supabase hardening
--
-- The application keeps Manus OAuth as its identity provider. The Vercel API
-- connects through the Supabase pooled Postgres connection and performs the
-- authoritative user/lead authorization in server/routers.ts. Because the
-- browser does not receive a Supabase Auth JWT, these public tables use
-- default-deny RLS rather than pretending that auth.uid() represents a Manus
-- openId. This prevents accidental direct browser access through the public
-- Supabase API while preserving the server-side API path.

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

alter table public.users enable row level security;
alter table public.leads enable row level security;

revoke all on table public.users from anon, authenticated;
revoke all on table public.leads from anon, authenticated;

-- No anon/authenticated policies are intentionally created. PostgreSQL RLS
-- therefore denies direct browser reads and writes. The Vercel API uses the
-- server-only Supabase database connection and still enforces Manus identity
-- and claim ownership in the tRPC procedures.

create index if not exists leads_claimed_by_user_id_idx
  on public.leads (claimed_by_user_id);
create index if not exists leads_type_idx
  on public.leads (type);
create index if not exists leads_updated_at_idx
  on public.leads (updated_at desc);
