import postgres from "postgres";
import { createSupabaseRequestClient } from "./supabaseAuth.js";
import { ENV } from "./_core/env.js";

const DEMO_LINK_PREFIX = "Demo Link:";

export type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string;
  created_at?: string | null;
  updated_at?: string | null;
};

type DbLeadRow = {
  id: string;
  title: string;
  company_name: string;
  contact_name: string;
  contact_email: string | null;
  contact_phone: string | null;
  source: string | null;
  status: string | null;
  claimed_by: string | null;
  claimed_at: string | null;
  notes: string | null;
  created_by_id: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type LeadListRow = {
  id: string;
  name: string;
  contact: string;
  email: string;
  address: string;
  type: string;
  demoLink: string;
  claimedByUserId: string | null;
  claimedAt: Date | null;
  createdAt: Date | null;
  updatedAt: Date | null;
  claimedByName: string | null;
  claimedByEmail: string | null;
};

let sqlClient: ReturnType<typeof postgres> | null = null;

function getSql() {
  if (!ENV.databaseUrl) {
    throw new Error("SUPABASE_DATABASE_URL is not configured");
  }

  sqlClient ??= postgres(ENV.databaseUrl, {
    prepare: false,
    max: process.env.VERCEL ? 1 : 10,
    connect_timeout: 10,
  });
  return sqlClient;
}

function databaseError(operation: string, error: { message?: string } | null | undefined): Error {
  return new Error(`Supabase ${operation} failed: ${error?.message ?? "unknown database error"}`);
}

function parseNotes(notes: string | null): { address: string; demoLink: string } {
  if (!notes) return { address: "", demoLink: "" };

  const lines = notes.split("\n");
  const demoLineIndex = lines.findIndex(line => line.trim().startsWith(DEMO_LINK_PREFIX));
  const demoLink =
    demoLineIndex >= 0
      ? lines[demoLineIndex].trim().slice(DEMO_LINK_PREFIX.length).trim()
      : "";
  const address = lines
    .filter((_, index) => index !== demoLineIndex)
    .join("\n")
    .trim();

  return { address, demoLink };
}

function composeNotes(address = "", demoLink = ""): string | null {
  const notes = [address.trim(), demoLink.trim() ? `${DEMO_LINK_PREFIX} ${demoLink.trim()}` : ""]
    .filter(Boolean)
    .join("\n");
  return notes || null;
}

function splitContact(contact = ""): { name: string; phone: string | null } {
  const [name, ...phoneParts] = contact.split("·");
  const normalizedName = name.trim();
  const phone = phoneParts.join("·").trim();
  return { name: normalizedName, phone: phone || null };
}

function formatContact(contactName: string, contactPhone: string | null): string {
  return [contactName.trim(), contactPhone?.trim()].filter(Boolean).join(" · ");
}

function toDate(value: string | null): Date | null {
  return value ? new Date(value) : null;
}

async function getProfilesById(ids: string[]): Promise<Map<string, ProfileRow>> {
  const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
  if (uniqueIds.length === 0) return new Map();

  const sql = getSql();
  const rows = await sql<ProfileRow[]>`
    select id, full_name, email, role, created_at, updated_at
    from public.profiles
    where id = any(${sql.array(uniqueIds)}::uuid[])
  `;

  return new Map(rows.map(profile => [profile.id, profile]));
}

function toLeadListRow(row: DbLeadRow, profiles: Map<string, ProfileRow>): LeadListRow {
  const parsedNotes = parseNotes(row.notes);
  const claimer = row.claimed_by ? profiles.get(row.claimed_by) : undefined;
  return {
    id: row.id,
    name: row.company_name,
    contact: formatContact(row.contact_name, row.contact_phone),
    email: row.contact_email ?? "",
    address: parsedNotes.address,
    type: row.source ?? "",
    demoLink: parsedNotes.demoLink,
    claimedByUserId: row.claimed_by,
    claimedAt: toDate(row.claimed_at),
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at),
    claimedByName: claimer?.full_name ?? null,
    claimedByEmail: claimer?.email ?? null,
  };
}

async function hydrateLeads(rows: DbLeadRow[]): Promise<LeadListRow[]> {
  const profiles = await getProfilesById(
    rows.map(row => row.claimed_by).filter((id): id is string => Boolean(id)),
  );
  return rows.map(row => toLeadListRow(row, profiles));
}

async function getRawLeadById(id: string): Promise<DbLeadRow | undefined> {
  const sql = getSql();
  const rows = await sql<DbLeadRow[]>`
    select * from public.leads where id = ${id}::uuid limit 1
  `;
  return rows[0];
}

export async function upsertUser(input: {
  authUserId: string;
  name: string | null;
  email: string | null;
}): Promise<ProfileRow> {
  const sql = getSql();
  try {
    const rows = await sql<ProfileRow[]>`
      insert into public.profiles (id, full_name, email, updated_at)
      values (${input.authUserId}::uuid, ${input.name}, ${input.email}, now())
      on conflict (id) do update set
        full_name = excluded.full_name,
        email = excluded.email,
        updated_at = now()
      returning id, full_name, email, role, created_at, updated_at
    `;
    if (!rows[0]) throw new Error("profile upsert returned no row");
    return rows[0];
  } catch (error) {
    throw databaseError("profile upsert", error as { message?: string });
  }
}

export async function getUserByAuthUserId(authUserId: string): Promise<ProfileRow | undefined> {
  const sql = getSql();
  const rows = await sql<ProfileRow[]>`
    select id, full_name, email, role, created_at, updated_at
    from public.profiles
    where id = ${authUserId}::uuid
    limit 1
  `;
  return rows[0];
}

export async function listLeads(filters?: {
  search?: string;
  type?: string;
  claimStatus?: "all" | "claimed" | "unclaimed";
}): Promise<LeadListRow[]> {
  const sql = getSql();
  let query = sql<DbLeadRow[]>`select * from public.leads where true`;

  const search = filters?.search?.trim();
  if (search) query = sql<DbLeadRow[]>`${query} and company_name ilike ${`%${search}%`}`;
  if (filters?.type && filters.type !== "all") {
    query = sql<DbLeadRow[]>`${query} and source = ${filters.type}`;
  }
  if (filters?.claimStatus === "claimed") {
    query = sql<DbLeadRow[]>`${query} and claimed_by is not null`;
  }
  if (filters?.claimStatus === "unclaimed") {
    query = sql<DbLeadRow[]>`${query} and claimed_by is null`;
  }
  query = sql<DbLeadRow[]>`${query} order by updated_at desc nulls last`;

  try {
    return hydrateLeads(await query);
  } catch (error) {
    throw databaseError("lead list", error as { message?: string });
  }
}

export async function getLeadById(id: string): Promise<DbLeadRow | undefined> {
  try {
    return await getRawLeadById(id);
  } catch (error) {
    throw databaseError("lead lookup", error as { message?: string });
  }
}

export async function getLeadWithClaimer(id: string): Promise<LeadListRow | undefined> {
  const row = await getRawLeadById(id);
  if (!row) return undefined;
  const [lead] = await hydrateLeads([row]);
  return lead;
}

export type LeadInput = {
  name: string;
  contact?: string;
  email?: string;
  address?: string;
  type?: string;
  demoLink?: string;
};

function toLeadColumns(input: LeadInput) {
  const contact = splitContact(input.contact);
  return {
    title: input.name,
    company_name: input.name,
    contact_name: contact.name,
    contact_phone: contact.phone,
    contact_email: input.email?.trim() || null,
    source: input.type?.trim() || null,
    notes: composeNotes(input.address, input.demoLink),
  };
}

export async function createLead(createdById: string, input: LeadInput): Promise<LeadListRow | undefined> {
  const sql = getSql();
  const columns = toLeadColumns(input);
  try {
    const rows = await sql<DbLeadRow[]>`
      insert into public.leads
        (title, company_name, contact_name, contact_phone, contact_email, source, notes, created_by_id)
      values
        (${columns.title}, ${columns.company_name}, ${columns.contact_name}, ${columns.contact_phone},
         ${columns.contact_email}, ${columns.source}, ${columns.notes}, ${createdById}::uuid)
      returning *
    `;
    if (!rows[0]) throw new Error("lead creation returned no row");
    return getLeadWithClaimer(rows[0].id);
  } catch (error) {
    throw databaseError("lead creation", error as { message?: string });
  }
}

export async function updateLead(id: string, input: LeadInput): Promise<LeadListRow | undefined> {
  const sql = getSql();
  const columns = toLeadColumns(input);
  try {
    await sql`
      update public.leads set
        title = ${columns.title},
        company_name = ${columns.company_name},
        contact_name = ${columns.contact_name},
        contact_phone = ${columns.contact_phone},
        contact_email = ${columns.contact_email},
        source = ${columns.source},
        notes = ${columns.notes},
        updated_at = now()
      where id = ${id}::uuid
    `;
    return getLeadWithClaimer(id);
  } catch (error) {
    throw databaseError("lead update", error as { message?: string });
  }
}

export async function deleteLead(id: string): Promise<void> {
  const sql = getSql();
  try {
    await sql`delete from public.leads where id = ${id}::uuid`;
  } catch (error) {
    throw databaseError("lead deletion", error as { message?: string });
  }
}

/**
 * The provisioned function reads auth.uid(), so this one operation stays on
 * the Supabase client with the verified bearer token. PostgreSQL performs the
 * conditional null-to-owner transition atomically.
 */
export async function claimLead(accessToken: string, id: string): Promise<boolean> {
  const client = createSupabaseRequestClient(accessToken);
  const { data, error } = await client.rpc("claim_lead", { p_lead_id: id });
  if (error) throw databaseError("atomic lead claim", error);
  const claimedRow = Array.isArray(data) ? data[0] : data;
  return Boolean(claimedRow && (claimedRow as DbLeadRow).id === id);
}
