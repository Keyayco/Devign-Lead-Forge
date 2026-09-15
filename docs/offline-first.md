# Lead Forge Offline-First Layer

Lead Forge now has a small client-side offline layer around the existing Supabase and tRPC architecture. It does **not** replace Supabase, change authentication, alter RLS, modify atomic claiming, or add database entities.

## Runtime model

When online, the existing tRPC procedures remain authoritative. Successful lead lists are copied into a user-scoped IndexedDB cache. When offline, the workspace reads from that cache and applies the existing search, type, claim-status, and lead-status filters locally.

Safe offline writes are stored in an IndexedDB outbox rather than being presented as server-confirmed:

| Operation              | Offline behavior                                                  | Synchronization                                                                                                            |
| ---------------------- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Create lead            | Creates a temporary local record marked pending                   | Calls the existing protected `leads.create` procedure when online, then replaces the temporary record with the server row. |
| Edit lead              | Updates the cached record and queues the full existing lead input | Reads the latest server row, checks its `updatedAt`, then calls the existing protected `leads.update` procedure.           |
| Change status or notes | Included in the normal edit payload                               | Uses the same update path; no separate database fields are introduced.                                                     |
| Claim lead             | Refused                                                           | Claiming remains server-authoritative and atomic through the existing RPC.                                                 |
| Delete lead            | Refused by the offline layer                                      | Deletion remains server-authoritative through the existing protected procedure.                                            |

## IndexedDB structure

The database is named `devign-lead-forge-offline` and contains two stores:

- `leads` stores the minimum fields needed by the existing cards and Lead Brief: identity, contact details, address, demo link, notes, status, ownership display information, and timestamps. Each record is scoped by the authenticated Supabase user ID.
- `outbox` stores `create` and `update` operations with the user ID, lead ID, input payload, original `updatedAt` value, timestamps, and one of `pending`, `syncing`, `failed`, or `conflicted`.

The browser session itself remains managed by Supabase Auth. IndexedDB is not used as an authentication store and does not contain access tokens.

## Synchronization and conflicts

The outbox runs when the browser reports connectivity and can also be triggered from the compact sync indicator. Each operation is sent through the existing authenticated tRPC client, so the normal Supabase bearer token, backend context, ownership checks, and RLS boundaries remain in force.

Before an offline edit is applied, the client calls the protected `leads.get` procedure and compares the current server `updatedAt` with the value captured when the offline edit began. A mismatch marks the operation `conflicted` and preserves the local cached version and the outbox payload for user review rather than silently overwriting newer server data.

Authorization, ownership, and claim conflicts are also retained as conflicted operations. They are never converted into local ownership or silently discarded.

## PWA shell boundary

The application includes a lightweight manifest and service worker. The service worker caches the static shell and same-origin static assets, but explicitly skips `/api/` requests. Authenticated lead responses are therefore not put into a generic service-worker cache; lead data is handled explicitly through IndexedDB.

The service worker is registered only in production. PWA installation still depends on the browser, HTTPS deployment, and the browser's installability rules.

## User feedback

The workspace header shows `Online`, `Offline`, `N changes pending`, `Syncing...`, `Sync complete`, or `Sync error`. Offline saves explicitly say that the change is stored on the device and will synchronize after reconnection. Offline claim attempts show `You're offline. Reconnect to claim this lead.`

## Limitations

The current implementation is deliberately a simple reliable outbox rather than a distributed synchronization system. It does not support offline claiming or deleting, does not synchronize access tokens, and does not automatically merge conflicting edits. A conflict remains visible as a failed/conflicted local operation and requires a future explicit resolution experience.

The automated sandbox checks validate the TypeScript, production build, authorization boundaries, current lead rules, PWA asset inclusion, and local synchronization code paths. A live browser/network-unavailable acceptance test requires a deployed session with real Supabase environment variables and must be performed before describing offline support as fully field-validated.
