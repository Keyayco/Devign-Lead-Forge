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
  console.log(JSON.stringify({ columns, functions }, null, 2));
} finally {
  await sql.end({ timeout: 5 });
}
