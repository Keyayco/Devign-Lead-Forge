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

The service worker is registered only in production. The manifest includes a stable app ID, root scope, standalone display mode, portrait orientation, theme metadata, and valid 192px and 512px PNG icons. PWA installation still depends on the browser, HTTPS deployment, and the browser's installability rules.

## Android offline-launch acceptance test

Use the deployed HTTPS Vercel URL in Chrome on Android. While online, sign in, wait for the Lead Forge workspace and at least one lead to load, and keep the page open for a few seconds so the service worker can install and precache the production HTML, JavaScript, CSS, manifest, icons, and same-origin static assets. In Chrome, open the browser menu and choose **Add to Home screen** or **Install app**, then launch Lead Forge from the new home-screen icon once while still online.

For the zero-network test, close every Lead Forge window and recent-app instance, turn off both Wi-Fi and mobile data, and launch the home-screen icon again. The installed app must open to the cached application shell rather than a browser network-error page. A previously synchronized lead should appear from the user-scoped IndexedDB cache. Search and the existing filters should work against that cached data. The offline indicator should show `Offline`; claim and delete remain intentionally unavailable offline. Restore connectivity before signing out or attempting protected server mutations.

If Android opens a network error instead of the app shell, the service worker did not control the installed scope before the test. Reopen the deployed URL online, wait for one reload after the worker installs, launch the installed shortcut once online, and repeat the test. Also confirm that the deployed response is HTTPS and that Chrome is not using an old installed shortcut from a previous deployment.

## User feedback

The workspace header shows `Online`, `Offline`, `N changes pending`, `Syncing...`, `Sync complete`, or `Sync error`. Offline saves explicitly say that the change is stored on the device and will synchronize after reconnection. Offline claim attempts show `You're offline. Reconnect to claim this lead.`

## Limitations

The current implementation is deliberately a simple reliable outbox rather than a distributed synchronization system. It does not support offline claiming or deleting, does not synchronize access tokens, and does not automatically merge conflicting edits. A conflict remains visible as a failed/conflicted local operation and requires a future explicit resolution experience.

The automated sandbox checks validate the TypeScript, production build, authorization boundaries, current lead rules, PWA manifest and icon inclusion, service-worker shell references, and local synchronization code paths. A live Android network-unavailable acceptance test still requires the deployed HTTPS application and must be performed on the target Android device before describing offline launch as field-validated.
