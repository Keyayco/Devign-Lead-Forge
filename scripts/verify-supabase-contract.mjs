import postgres from "postgres";

const connectionString = process.env.SUPABASE_DATABASE_URL;
if (!connectionString) throw new Error("SUPABASE_DATABASE_URL is required");

const sql = postgres(connectionString, {
  prepare: false,
  max: 1,
  connect_timeout: 10,
});

try {
  const columns = await sql`
    select table_name, column_name, data_type, is_nullable
    from information_schema.columns
    where table_schema = 'public'
      and table_name in ('profiles', 'leads')
    order by table_name, ordinal_position
  `;
  const functions = await sql`
    select routine_schema, routine_name, data_type
    from information_schema.routines
    where routine_schema = 'public'
      and routine_name = 'claim_lead'
  `;
  const security = await sql`
    select c.relname as table_name, c.relrowsecurity as rls_enabled,
           c.relforcerowsecurity as rls_forced,
           coalesce(json_agg(json_build_object('policy', p.policyname, 'roles', p.roles, 'cmd', p.cmd, 'using', p.qual, 'with_check', p.with_check))
             filter (where p.policyname is not null), '[]'::json) as policies
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    left join pg_policies p on p.schemaname = n.nspname and p.tablename = c.relname
    where n.nspname = 'public' and c.relname in ('profiles', 'leads')
    group by c.relname, c.relrowsecurity, c.relforcerowsecurity
    order by c.relname
  `;
  const grants = await sql`
    select table_name, grantee, privilege_type
    from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name in ('profiles', 'leads')
      and grantee in ('anon', 'authenticated')
    order by table_name, grantee, privilege_type
  `;
  console.log(JSON.stringify({ columns, functions, security, grants }, null, 2));
} finally {
  await sql.end({ timeout: 5 });
}
