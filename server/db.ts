import {
  and,
  desc,
  eq,
  isNotNull,
  isNull,
  like,
  type SQL,
} from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
  InsertLead,
  InsertUser,
  leads,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

/**
 * Lazily create one shared Postgres/Drizzle client. Supabase's pooled
 * connection string is recommended for Vercel; prepare:false avoids prepared
 * statement issues when traffic moves between serverless instances.
 */
export async function getDb() {
  if (!_db) {
    const connectionString = ENV.databaseUrl;
    if (!connectionString) {
      console.warn("[Database] DATABASE_URL/SUPABASE_DATABASE_URL is not configured");
      return null;
    }

    const client = postgres(connectionString, {
      prepare: false,
      max: process.env.VERCEL ? 1 : 10,
    });
    _db = drizzle(client);
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  const values: InsertUser = {
    openId: user.openId,
    name: user.name ?? null,
    email: user.email ?? null,
    loginMethod: user.loginMethod ?? null,
    role: user.role ?? (user.openId === ENV.ownerOpenId ? "admin" : "user"),
    lastSignedIn: user.lastSignedIn ?? new Date(),
  };

  await db
    .insert(users)
    .values(values)
    .onConflictDoUpdate({
      target: users.openId,
      set: {
        name: values.name,
        email: values.email,
        loginMethod: values.loginMethod,
        role: values.role,
        lastSignedIn: values.lastSignedIn,
        updatedAt: new Date(),
      },
    });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export type LeadListRow = {
  id: number;
  name: string;
  contact: string;
  email: string;
  address: string;
  type: string;
  demoLink: string;
  claimedByUserId: number | null;
  claimedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  claimedByName: string | null;
  claimedByEmail: string | null;
};

export async function listLeads(filters?: {
  search?: string;
  type?: string;
  claimStatus?: "all" | "claimed" | "unclaimed";
}): Promise<LeadListRow[]> {
  const db = await getDb();
  if (!db) return [];

  const conditions: SQL[] = [];
  if (filters?.search?.trim()) {
    conditions.push(like(leads.name, `%${filters.search.trim()}%`));
  }
  if (filters?.type && filters.type !== "all") {
    conditions.push(eq(leads.type, filters.type));
  }
  if (filters?.claimStatus === "claimed") {
    conditions.push(isNotNull(leads.claimedByUserId));
  }
  if (filters?.claimStatus === "unclaimed") {
    conditions.push(isNull(leads.claimedByUserId));
  }

  const selection = {
    id: leads.id,
    name: leads.name,
    contact: leads.contact,
    email: leads.email,
    address: leads.address,
    type: leads.type,
    demoLink: leads.demoLink,
    claimedByUserId: leads.claimedByUserId,
    claimedAt: leads.claimedAt,
    createdAt: leads.createdAt,
    updatedAt: leads.updatedAt,
    claimedByName: users.name,
    claimedByEmail: users.email,
  };

  const query = db
    .select(selection)
    .from(leads)
    .leftJoin(users, eq(leads.claimedByUserId, users.id))
    .orderBy(desc(leads.updatedAt));

  const rows = conditions.length > 0 ? await query.where(and(...conditions)) : await query;
  return rows as LeadListRow[];
}

export async function getLeadById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(leads).where(eq(leads.id, id)).limit(1);
  return result[0];
}

export async function getLeadWithClaimer(id: number): Promise<LeadListRow | undefined> {
  const result = await listLeads();
  return result.find(lead => lead.id === id);
}

export async function createLead(input: InsertLead) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const [inserted] = await db.insert(leads).values(input).returning({ id: leads.id });
  if (!inserted?.id) throw new Error("Lead was created without an id");
  return getLeadWithClaimer(inserted.id);
}

export async function updateLead(
  id: number,
  input: Partial<Pick<InsertLead, "name" | "contact" | "email" | "address" | "type" | "demoLink">>,
) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(leads).set({ ...input, updatedAt: new Date() }).where(eq(leads.id, id));
  return getLeadWithClaimer(id);
}

export async function deleteLead(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.delete(leads).where(eq(leads.id, id));
}

/**
 * The conditional UPDATE is the claim lock. PostgreSQL returns one row only
 * for the winner, so simultaneous claims cannot both succeed.
 */
export async function claimLead(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");

  const [updated] = await db
    .update(leads)
    .set({ claimedByUserId: userId, claimedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(leads.id, id), isNull(leads.claimedByUserId)))
    .returning({ claimedByUserId: leads.claimedByUserId });

  return updated?.claimedByUserId === userId;
}
