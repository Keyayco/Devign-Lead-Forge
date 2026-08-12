import { and, desc, eq, isNull, isNotNull, like } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertLead,
  InsertUser,
  leads,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }

    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function listLeads(filters?: {
  search?: string;
  type?: string;
  claimStatus?: "all" | "claimed" | "unclaimed";
}) {
  const db = await getDb();
  if (!db) return [];

  const conditions = [];
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

  return conditions.length > 0
    ? query.where(and(...conditions))
    : query;
}

export async function getLeadById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(leads).where(eq(leads.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getLeadWithClaimer(id: number) {
  const result = await listLeads();
  return result.find(lead => lead.id === id);
}

export async function createLead(input: InsertLead) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const [inserted] = await db.insert(leads).values(input).$returningId();
  if (!inserted?.id) throw new Error("Lead was created without an id");
  return getLeadWithClaimer(Number(inserted.id));
}

export async function updateLead(
  id: number,
  input: Partial<Pick<InsertLead, "name" | "contact" | "email" | "address" | "type" | "demoLink">>,
) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(leads).set(input).where(eq(leads.id, id));
  return getLeadWithClaimer(id);
}

export async function deleteLead(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.delete(leads).where(eq(leads.id, id));
}

/**
 * Claiming uses a conditional UPDATE so two simultaneous agents cannot both
 * win. Only the first update matching the unclaimed row changes it.
 */
export async function claimLead(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");

  await db
    .update(leads)
    .set({ claimedByUserId: userId, claimedAt: new Date() })
    .where(and(eq(leads.id, id), isNull(leads.claimedByUserId)));

  // Re-read the row instead of relying on driver-specific mutation metadata.
  // If another agent won the race, the stored owner will be different.
  const updated = await getLeadById(id);
  return updated?.claimedByUserId === userId;
}
