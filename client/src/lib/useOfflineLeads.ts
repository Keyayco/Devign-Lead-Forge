import { useCallback, useEffect, useRef, useState } from "react";
import {
  cacheLeads,
  countOutbox,
  findPendingOperation,
  getCachedLeads,
  getOutbox,
  isOfflineStorageAvailable,
  putCachedLead,
  removeOutboxOperation,
  saveOutboxOperation,
  type OfflineLead,
  type OfflineLeadInput,
  type OutboxOperation,
} from "./offlineDb";

export type OfflineSyncState = "idle" | "syncing" | "complete" | "error";

export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine
  );

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return online;
}

type ServerMutation<TInput, TResult> = (input: TInput) => Promise<TResult>;

type UseOfflineLeadsOptions = {
  userId: string | null | undefined;
  online: boolean;
  serverLeads: OfflineLead[];
  createOnline: ServerMutation<
    OfflineLeadInput,
    OfflineLead | null | undefined
  >;
  updateOnline: ServerMutation<
    { id: string } & OfflineLeadInput,
    OfflineLead | null | undefined
  >;
  getOnline: ServerMutation<{ id: string }, OfflineLead | null | undefined>;
  onServerDataInvalidated: () => Promise<unknown> | unknown;
};

function makeId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto)
    return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function now(): number {
  return Date.now();
}

export function useOfflineLeads({
  userId,
  online,
  serverLeads,
  createOnline,
  updateOnline,
  getOnline,
  onServerDataInvalidated,
}: UseOfflineLeadsOptions) {
  const [cachedLeads, setCachedLeads] = useState<OfflineLead[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncState, setSyncState] = useState<OfflineSyncState>("idle");
  const [syncError, setSyncError] = useState<string | null>(null);
  const syncInProgress = useRef(false);
  const storageAvailable = isOfflineStorageAvailable();

  const refreshLocalState = useCallback(async () => {
    if (!userId || !storageAvailable) {
      setCachedLeads([]);
      setPendingCount(0);
      return;
    }
    const [leads, count] = await Promise.all([
      getCachedLeads(userId),
      countOutbox(userId),
    ]);
    setCachedLeads(leads);
    setPendingCount(count);
  }, [storageAvailable, userId]);

  useEffect(() => {
    void refreshLocalState().catch(error => {
      setSyncState("error");
      setSyncError(
        error instanceof Error
          ? error.message
          : "Offline storage is unavailable"
      );
    });
  }, [refreshLocalState]);

  useEffect(() => {
    if (!userId || !storageAvailable || !serverLeads.length) return;
    void cacheLeads(userId, serverLeads)
      .then(refreshLocalState)
      .catch(error => {
        setSyncState("error");
        setSyncError(
          error instanceof Error ? error.message : "Unable to cache leads"
        );
      });
  }, [refreshLocalState, serverLeads, storageAvailable, userId]);

  const syncPending = useCallback(async () => {
    if (!userId || !online || !storageAvailable || syncInProgress.current)
      return;
    syncInProgress.current = true;
    setSyncState("syncing");
    setSyncError(null);

    try {
      const operations = await getOutbox(userId);
      for (const operation of operations) {
        if (operation.state === "conflicted") continue;
        const syncingOperation: OutboxOperation = {
          ...operation,
          state: "syncing",
          updatedAt: now(),
        };
        await saveOutboxOperation(syncingOperation);
        try {
          if (operation.kind === "create") {
            const created = await createOnline(operation.input);
            if (!created)
              throw new Error("The server did not return the created lead");
            const cached = await getCachedLeads(userId);
            const withoutTemporary = cached.filter(
              lead => lead.id !== operation.leadId
            );
            await cacheLeads(userId, [...withoutTemporary, created]);
          } else {
            const current = await getOnline({ id: operation.leadId });
            if (
              operation.baseUpdatedAt &&
              current?.updatedAt &&
              current.updatedAt !== operation.baseUpdatedAt
            ) {
              await saveOutboxOperation({
                ...operation,
                state: "conflicted",
                error:
                  "The server version changed before this offline edit was synchronized.",
                updatedAt: now(),
              });
              continue;
            }
            const updated = await updateOnline({
              id: operation.leadId,
              ...operation.input,
            });
            if (!updated)
              throw new Error("The server did not return the updated lead");
            await putCachedLead(userId, updated);
          }
          await removeOutboxOperation(operation.id);
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Synchronization failed";
          await saveOutboxOperation({
            ...operation,
            state: /forbidden|unauthorized|locked|claim/i.test(message)
              ? "conflicted"
              : "failed",
            error: message,
            updatedAt: now(),
          });
        }
      }
      await onServerDataInvalidated();
      await refreshLocalState();
      setSyncState((await countOutbox(userId)) > 0 ? "error" : "complete");
      if ((await countOutbox(userId)) > 0)
        setSyncError("Some offline changes need attention.");
    } catch (error) {
      setSyncState("error");
      setSyncError(
        error instanceof Error ? error.message : "Synchronization failed"
      );
    } finally {
      syncInProgress.current = false;
    }
  }, [
    createOnline,
    getOnline,
    onServerDataInvalidated,
    online,
    refreshLocalState,
    storageAvailable,
    updateOnline,
    userId,
  ]);

  useEffect(() => {
    if (online) void syncPending();
  }, [online, syncPending]);

  const enqueue = useCallback(
    async (
      kind: "create" | "update",
      input: OfflineLeadInput,
      existing?: OfflineLead
    ) => {
      if (!userId || !storageAvailable)
        throw new Error("Offline storage is unavailable in this browser");
      const timestamp = new Date().toISOString();
      const leadId = existing?.id ?? makeId("offline");
      const operationId = existing
        ? ((await findPendingOperation(userId, leadId))?.id ?? makeId("outbox"))
        : makeId("outbox");
      const optimistic: OfflineLead = {
        id: leadId,
        ...input,
        claimedByUserId: existing?.claimedByUserId ?? null,
        claimedByName: existing?.claimedByName ?? null,
        claimedByEmail: existing?.claimedByEmail ?? null,
        createdAt: existing?.createdAt ?? timestamp,
        updatedAt: timestamp,
      };
      await putCachedLead(userId, optimistic);
      await saveOutboxOperation({
        id: operationId,
        userId,
        kind,
        leadId,
        input,
        baseUpdatedAt: existing?.updatedAt ?? null,
        state: "pending",
        error: null,
        createdAt: now(),
        updatedAt: now(),
      });
      await refreshLocalState();
    },
    [refreshLocalState, storageAvailable, userId]
  );

  const enqueueCreate = useCallback(
    (input: OfflineLeadInput) => enqueue("create", input),
    [enqueue]
  );
  const enqueueUpdate = useCallback(
    (existing: OfflineLead, input: OfflineLeadInput) =>
      enqueue("update", input, existing),
    [enqueue]
  );

  return {
    cachedLeads,
    pendingCount,
    syncState,
    syncError,
    storageAvailable,
    refreshLocalState,
    syncPending,
    enqueueCreate,
    enqueueUpdate,
  };
}
