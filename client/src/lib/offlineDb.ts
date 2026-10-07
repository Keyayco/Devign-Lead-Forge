export type OfflineLeadStatus = "finessing" | "sold" | "cold" | "pipeline";
export type OfflineDemoStatus = "none" | "building" | "ready" | "sent";
export type OfflineOutreachStatus =
  | "not_started"
  | "contacted"
  | "responded"
  | "follow_up";

export type OfflineLead = {
  id: string;
  name: string;
  contact: string;
  email: string;
  address: string;
  type: string;
  demoLink: string;
  demoStatus: OfflineDemoStatus;
  outreachStatus: OfflineOutreachStatus;
  notes: string;
  status: OfflineLeadStatus;
  claimedByUserId: string | null;
  claimedByName: string | null;
  claimedByEmail: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type OfflineLeadInput = Omit<
  OfflineLead,
  | "id"
  | "claimedByUserId"
  | "claimedByName"
  | "claimedByEmail"
  | "createdAt"
  | "updatedAt"
>;

export type OutboxOperation = {
  id: string;
  userId: string;
  kind: "create" | "update";
  leadId: string;
  input: OfflineLeadInput;
  baseUpdatedAt: string | null;
  state: "pending" | "syncing" | "failed" | "conflicted";
  error: string | null;
  createdAt: number;
  updatedAt: number;
};

type LeadRecord = OfflineLead & { userId: string; cachedAt: number };

type Database = IDBDatabase;

const DB_NAME = "devign-lead-forge-offline";
const DB_VERSION = 1;
const LEADS_STORE = "leads";
const OUTBOX_STORE = "outbox";

let databasePromise: Promise<Database> | null = null;

function openDatabase(): Promise<Database> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(
      new Error("IndexedDB is unavailable in this browser")
    );
  }
  if (databasePromise) return databasePromise;

  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () =>
      reject(request.error ?? new Error("Unable to open offline storage"));
    request.onupgradeneeded = () => {
      const db = request.result;
      const leads = db.objectStoreNames.contains(LEADS_STORE)
        ? request.transaction!.objectStore(LEADS_STORE)
        : db.createObjectStore(LEADS_STORE, { keyPath: "id" });
      if (!leads.indexNames.contains("userId"))
        leads.createIndex("userId", "userId", { unique: false });

      const outbox = db.objectStoreNames.contains(OUTBOX_STORE)
        ? request.transaction!.objectStore(OUTBOX_STORE)
        : db.createObjectStore(OUTBOX_STORE, { keyPath: "id" });
      if (!outbox.indexNames.contains("userId"))
        outbox.createIndex("userId", "userId", { unique: false });
      if (!outbox.indexNames.contains("userLead"))
        outbox.createIndex("userLead", ["userId", "leadId"], { unique: false });
    };
    request.onsuccess = () => resolve(request.result);
  });

  return databasePromise;
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Offline storage request failed"));
  });
}

function transactionComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(
        transaction.error ?? new Error("Offline storage transaction failed")
      );
    transaction.onabort = () =>
      reject(
        transaction.error ?? new Error("Offline storage transaction aborted")
      );
  });
}

export async function getCachedLeads(userId: string): Promise<OfflineLead[]> {
  const db = await openDatabase();
  const transaction = db.transaction(LEADS_STORE, "readonly");
  const records = await requestResult<LeadRecord[]>(
    transaction.objectStore(LEADS_STORE).index("userId").getAll(userId)
  );
  return records.sort((a, b) =>
    (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "")
  );
}

export async function migrateUserScope(
  sourceUserId: string,
  targetUserId: string
): Promise<void> {
  if (!sourceUserId || sourceUserId === targetUserId) return;
  const db = await openDatabase();
  const transaction = db.transaction([LEADS_STORE, OUTBOX_STORE], "readwrite");
  const leadsStore = transaction.objectStore(LEADS_STORE);
  const outboxStore = transaction.objectStore(OUTBOX_STORE);
  const [leads, targetLeads, operations, targetOperations] = await Promise.all([
    requestResult<LeadRecord[]>(
      leadsStore.index("userId").getAll(sourceUserId)
    ),
    requestResult<LeadRecord[]>(
      leadsStore.index("userId").getAll(targetUserId)
    ),
    requestResult<OutboxOperation[]>(
      outboxStore.index("userId").getAll(sourceUserId)
    ),
    requestResult<OutboxOperation[]>(
      outboxStore.index("userId").getAll(targetUserId)
    ),
  ]);
  const currentLeads = new Map(targetLeads.map(lead => [lead.id, lead]));
  for (const lead of leads) {
    const current = currentLeads.get(lead.id);
    if (!current || lead.cachedAt > current.cachedAt)
      leadsStore.put({ ...lead, userId: targetUserId });
  }
  const currentOperations = new Map(
    targetOperations.map(operation => [operation.id, operation])
  );
  for (const operation of operations) {
    const current = currentOperations.get(operation.id);
    if (!current || operation.updatedAt > current.updatedAt)
      outboxStore.put({ ...operation, userId: targetUserId });
  }
  await transactionComplete(transaction);
}

export async function cacheLeads(
  userId: string,
  leads: OfflineLead[]
): Promise<void> {
  const db = await openDatabase();
  const transaction = db.transaction(LEADS_STORE, "readwrite");
  const store = transaction.objectStore(LEADS_STORE);
  for (const lead of leads)
    store.put({ ...lead, userId, cachedAt: Date.now() } satisfies LeadRecord);
  await transactionComplete(transaction);
}

export async function putCachedLead(
  userId: string,
  lead: OfflineLead
): Promise<void> {
  const db = await openDatabase();
  const transaction = db.transaction(LEADS_STORE, "readwrite");
  transaction
    .objectStore(LEADS_STORE)
    .put({ ...lead, userId, cachedAt: Date.now() } satisfies LeadRecord);
  await transactionComplete(transaction);
}

export async function getOutbox(userId: string): Promise<OutboxOperation[]> {
  const db = await openDatabase();
  const transaction = db.transaction(OUTBOX_STORE, "readonly");
  const records = await requestResult<OutboxOperation[]>(
    transaction.objectStore(OUTBOX_STORE).index("userId").getAll(userId)
  );
  return records.sort((a, b) => a.createdAt - b.createdAt);
}

export async function countOutbox(userId: string): Promise<number> {
  const db = await openDatabase();
  const transaction = db.transaction(OUTBOX_STORE, "readonly");
  return requestResult<number>(
    transaction.objectStore(OUTBOX_STORE).index("userId").count(userId)
  );
}

export async function saveOutboxOperation(
  operation: OutboxOperation
): Promise<void> {
  const db = await openDatabase();
  const transaction = db.transaction(OUTBOX_STORE, "readwrite");
  transaction.objectStore(OUTBOX_STORE).put(operation);
  await transactionComplete(transaction);
}

export async function removeOutboxOperation(id: string): Promise<void> {
  const db = await openDatabase();
  const transaction = db.transaction(OUTBOX_STORE, "readwrite");
  transaction.objectStore(OUTBOX_STORE).delete(id);
  await transactionComplete(transaction);
}

export async function findPendingOperation(
  userId: string,
  leadId: string
): Promise<OutboxOperation | undefined> {
  const operations = await getOutbox(userId);
  return operations.find(
    operation => operation.leadId === leadId && operation.state !== "conflicted"
  );
}

export function isOfflineStorageAvailable(): boolean {
  return typeof indexedDB !== "undefined";
}
