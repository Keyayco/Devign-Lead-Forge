# Devign Lead Forge: Supabase and Vercel Setup Guide

## Executive assessment

The original project was not deployment-ready for a Supabase-plus-Vercel architecture without changes. It was a React/Vite frontend bundled with an Express server, tRPC procedures, Drizzle ORM, and a MySQL/TiDB database connection. It also used Manus OAuth as the identity provider. That combination works well as one long-lived Node application, but Vercel is optimized for static frontend assets and request-scoped Functions rather than a process that must remain listening on a port.

The project has now been adapted for the following target architecture:

| Layer | Production implementation | Purpose |
|---|---|---|
| Browser UI | React 19 + Vite static assets on Vercel | Fast browser delivery for the 5–10-person agent team |
| API | Existing Express + tRPC procedures exported through `api/[...path].ts` | Preserves the typed CRUD and claim-locking contract |
| Database | Supabase PostgreSQL through Drizzle and a server-only pooled connection | Durable shared lead storage |
| Identity | Manus OAuth | Preserves secure per-agent identity and the current `openId` ownership model |
| Authorization | tRPC authorization plus default-deny RLS | Keeps claim ownership and mutation checks server-side, while blocking accidental direct browser access |
| Deployment | One Vercel project for the Vite frontend and `/api/*` Functions | Keeps OAuth callbacks and cookies same-origin |

This is the recommended first deployment path. **Do not split the API onto a different hostname unless there is a concrete reason to do so.** A same-origin Vercel project avoids an additional CORS and cross-site-cookie problem and lets the existing OAuth helper continue to derive its redirect URL from `window.location.origin`.

> Vercel’s Vite guidance supports static Vite deployment, but it recommends a framework-specific Functions approach for server-side behavior. This project therefore keeps the Vite static build and exposes the existing Express/tRPC surface through a Vercel Node Function. Vercel’s SPA guidance also requires a rewrite for deep links.[1]

## What changed in the repository

The following changes are already present in the project checkpoint:

| File | Change |
|---|---|
| `drizzle/schema.ts` | Replaced MySQL tables with PostgreSQL `pgTable` definitions; mapped fields to Supabase-friendly snake_case columns. |
| `server/db.ts` | Replaced `mysql2` with `postgres` plus `drizzle-orm/postgres-js`; added serverless-friendly connection options and PostgreSQL `returning()` calls. |
| `drizzle.config.ts` | Switched the dialect to `postgresql` and directed new migrations to `supabase/migrations`. |
| `supabase/migrations/0000_living_quasimodo.sql` | Generated the initial `users` and `leads` PostgreSQL tables and foreign key. |
| `supabase/migrations/0001_security.sql` | Added timestamp triggers, indexes, RLS enablement, and default-deny public-table access. |
| `server/_core/index.ts` | Exported `createApp()` so the same API can run locally or be imported by a Vercel Function without starting a listener during import. |
| `api/[...path].ts` | Added the Vercel catch-all Function for OAuth, tRPC, and storage routes. |
| `vercel.json` | Added Vite build settings, the `dist/public` output directory, the Node 22 Function runtime, and SPA rewrites. |
| `package.json` | Added `postgres`, `@vercel/node`, `build:vercel`, `dev:vercel`, and `db:generate`. |
| `todo.md` | Added and tracked the Supabase/Vercel migration work. |

The project passes the TypeScript checker after this refactor. The existing functional tests should still be run before and after connecting the real database, because a local test suite does not prove that a remote Supabase connection string or OAuth allowlist is correct.

## Credential model

There are two very different Supabase credentials. The publishable key you supplied is a browser-facing key. It is not a database password and cannot be used by Drizzle to connect to PostgreSQL. The current application uses a server-side tRPC API, so the required production credential is the pooled Postgres URI.

| Variable | Where it is used | Exposure | Required for this architecture |
|---|---|---|---|
| `SUPABASE_DATABASE_URL` | `server/db.ts` through Drizzle | Server-only | **Yes** |
| `VITE_SUPABASE_URL` | Only needed if the browser later uses `@supabase/supabase-js` | Public | No, currently optional |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Only needed for direct browser Supabase APIs or a future Supabase Auth migration | Public | No, currently optional |
| `JWT_SECRET` | Manus session cookie signing | Server-only | **Yes** |
| `VITE_APP_ID` | Manus OAuth login URL | Public build variable | **Yes** |
| `VITE_OAUTH_PORTAL_URL` | Manus OAuth portal URL | Public build variable | **Yes** |
| `OAUTH_SERVER_URL` | Manus server-side SDK | Server-only | **Yes** |
| `OWNER_OPEN_ID` | Promotes the configured owner to admin during upsert | Server-only | Recommended |

For Vercel, add variables separately to **Production**, **Preview**, and **Development**. Vercel encrypts environment variables at rest, but changes apply only to new deployments, so redeploy after changing a variable.[2]

Use the Supabase **Session Pooler** URI for a serverless deployment. It normally resembles the following shape, but the host, project reference, region, and password must come from your own Supabase dashboard:

```text
postgresql://postgres.<project-ref>:<database-password>@aws-0-<region>.pooler.supabase.com:6543/postgres?sslmode=require
```

Keep that value in `SUPABASE_DATABASE_URL`. Never rename it to a `VITE_` variable and never commit it to Git. The publishable key can remain in the frontend only if you later add direct Supabase browser calls; it is not needed by the current tRPC path.

## Step 1: Create the Supabase project

Create a new Supabase project in the organization that will own the team’s lead data. Choose a region close to the agents and keep the database password in a password manager. The database password is different from the publishable key.

Open **Project Settings → Database → Connection string** and select the **Session Pooler** URI. Replace the password placeholder with the database password and retain `sslmode=require`. Add the completed URI to Vercel as `SUPABASE_DATABASE_URL`, and keep a local copy only in `.env.local`, which must remain untracked.

The repository deliberately does not auto-apply this migration to the existing Manus-managed database. That is intentional: the previous database was MySQL/TiDB, while the new migration is PostgreSQL syntax and should be applied only to the new Supabase project.

## Step 2: Apply the database migrations

The migration files must run in this order:

```text
supabase/migrations/0000_living_quasimodo.sql
supabase/migrations/0001_security.sql
```

The easiest first setup is the Supabase SQL Editor. Open the first file, run it, then open the second file and run it. Confirm that the Tables view contains `public.users` and `public.leads`, and confirm that `leads.claimed_by_user_id` references `users.id`.

The migration creates the following application columns:

| Application field | Supabase column | Notes |
|---|---|---|
| `name` | `name` | Required lead name |
| `contact` | `contact` | Required contact name or phone context |
| `email` | `email` | Required email address |
| `address` | `address` | Required free-form address |
| `type` | `type` | Required lead type |
| `demoLink` | `demo_link` | Required URL |
| `claimedByUserId` | `claimed_by_user_id` | Nullable foreign key to `users.id` |
| `claimedAt` | `claimed_at` | Set when the atomic claim succeeds |
| `createdAt` | `created_at` | UTC timestamp |
| `updatedAt` | `updated_at` | Maintained by a database trigger |

The first migration creates the tables and foreign key. The second migration creates the `updated_at` triggers, adds indexes for claim/type/recency queries, enables RLS, and revokes direct table privileges from the `anon` and `authenticated` roles.

Supabase recommends enabling RLS for every table in an exposed schema. It also notes that once RLS is enabled, a publishable-key request cannot access rows until policies are created.[3] This project intentionally creates **no** `anon` or `authenticated` policies because the browser is not using Supabase Auth; it is using Manus OAuth. The Vercel API uses its server-only database connection and enforces the Manus identity in the tRPC procedures.

This is defense in depth, not a substitute for the API authorization layer. A Supabase database connection made as a privileged database role can bypass RLS, so the application must continue to enforce the rules in `server/routers.ts`: authenticated agents may list and create leads, only owners may update or delete claimed leads, and a lead can be claimed only when `claimed_by_user_id` is still null.

## Step 3: Configure Manus OAuth for the Vercel domain

The current login implementation is intentionally preserved. It creates a one-time nonce, stores it in a secure host-only cookie, passes the nonce in the OAuth state, and verifies both values before exchanging the authorization code. The callback route is now available at `/api/oauth/callback` on the Vercel project.

In the Manus OAuth application configuration, register these redirect URLs:

```text
https://YOUR_PRODUCTION_DOMAIN/api/oauth/callback
http://localhost:3000/api/oauth/callback
```

Replace `YOUR_PRODUCTION_DOMAIN` with the final Vercel domain or custom domain. If the provider requires exact allowlisting for preview deployments, add the specific preview URL you intend to test. For the team’s normal workflow, a stable production domain is preferable.

The frontend already builds its redirect URL with `window.location.origin`, so no Vercel hostname is hardcoded into the client. This matters because the OAuth redirect must match the domain the agent actually opened. The Manus OAuth guidance also requires a nonce bound to the browser cookie to prevent login CSRF and session fixation; preserve that flow and do not replace it with a callback that trusts a user-controlled redirect URL.[4]

Set the following Vercel variables:

```text
VITE_APP_ID=<your Manus application id>
VITE_OAUTH_PORTAL_URL=<your Manus OAuth portal URL>
OAUTH_SERVER_URL=https://api.manus.im
JWT_SECRET=<long random server secret>
OWNER_OPEN_ID=<the owner’s Manus openId, if using admin promotion>
```

Vercel and the production custom domain provide HTTPS, which is required by the secure OAuth cookie. The browser must permit cookies; Safari Private Browsing, strict anti-tracking modes, and “block all cookies” settings can prevent the login flow from completing.

## Step 4: Create the Vercel project

Connect the GitHub repository `Keyayco/Devign-Lead-Forge` to Vercel. Use the repository root as the project root. The checked-in `vercel.json` already specifies the important settings, but verify them in the project dashboard:

| Vercel setting | Value |
|---|---|
| Framework preset | Vite |
| Root directory | Repository root |
| Install command | `pnpm install` |
| Build command | `pnpm build:vercel` |
| Output directory | `dist/public` |
| Node runtime for API | `nodejs22.x` |
| Production branch | Your selected stable branch, normally `main` |

The build command generates only the static Vite assets. Vercel discovers `api/[...path].ts` as a Node Function and routes `/api/oauth/callback`, `/api/trpc/*`, and the storage proxy through the Express application. The SPA rewrite sends browser deep links to `index.html` while API Functions remain available under `/api`.[1]

Add the environment variables before the first production deployment. Use Vercel’s environment selector so the database and OAuth variables exist in every environment where you expect the app to work. After saving variables, create a new deployment; Vercel does not retroactively inject changed variables into an old deployment.[2]

The Supabase Vercel Marketplace integration is optional. It can synchronize variables and centralize billing, but the current Supabase documentation describes the integration as Public Alpha and lists limitations, including custom-domain restrictions for Marketplace-created resources.[5] For this internal tool, creating the Supabase project directly and adding only the required pooled URI to Vercel is the more predictable path.

## Step 5: Local development against Supabase

Install the Vercel CLI if it is not already installed, authenticate, and link the local checkout to the Vercel project:

```bash
pnpm add -g vercel
vercel login
vercel link
vercel env pull .env.local
```

Confirm that `.env.local` is ignored by Git. If you prefer to create it manually, use the variable names in the environment table above. Do not paste the database URI into source files or into browser-visible variables.

Run the normal Manus development server when you want the managed preview experience:

```bash
pnpm dev
```

Run the Vercel-shaped local environment when you want to verify the catch-all Function and rewrites:

```bash
pnpm dev:vercel
```

The Vercel-shaped test is especially useful for verifying that the API is imported without starting a second listener. Use the same-origin URL printed by Vercel Dev and complete a real Manus OAuth login. If the API is reached through a separate origin, you must add CORS and cross-site cookie configuration; that configuration is intentionally not part of the recommended same-origin setup.

## Step 6: Validate the production deployment

Run the static and server checks locally before pushing:

```bash
pnpm check
pnpm test
pnpm build:vercel
```

Then validate the deployment in this order:

| Check | Expected result |
|---|---|
| Open the Vercel URL | The Leads workspace shell renders. |
| Click the login action | Manus OAuth opens and returns to `/`. |
| Refresh after login | The agent identity remains available through the session cookie. |
| Add a lead | The record appears in the queue and persists after refresh. |
| Search by name | The visible queue narrows to matching leads. |
| Filter by type/status | The query returns only the selected subset. |
| Claim an unclaimed lead | The row shows the claiming agent and becomes locked. |
| Attempt a second claim concurrently | Only one agent succeeds; the other receives a conflict. |
| Edit/delete as the claimant | The action succeeds. |
| Edit/delete as another agent | The server rejects the action and the UI hides locked-row actions. |
| Open a deep browser path, if one is added later | Vercel serves the SPA entrypoint instead of a 404. |

Use Supabase’s Logs and Vercel’s Function logs together if a request fails. A database authentication error usually indicates the wrong URI or an unencoded password. An OAuth callback error usually indicates an allowlist mismatch, a cookie-blocking browser mode, or a missing `JWT_SECRET`/Manus OAuth variable.

## Data migration from the previous database

If the current Manus-managed database contains real lead data, do not point the new application at it after changing the schema. Export the old data first, transform the column names, and import it into Supabase. The old names were camelCase/MySQL-oriented; the new Supabase schema uses snake_case:

```text
openId              -> open_id
loginMethod         -> login_method
claimedByUserId     -> claimed_by_user_id
claimedAt           -> claimed_at
demoLink            -> demo_link
createdAt           -> created_at
updatedAt           -> updated_at
lastSignedIn        -> last_signed_in
```

Do not migrate session cookies or access tokens. Agents should sign in again through Manus OAuth, which will upsert their `users` row. Preserve a lead’s `claimed_by_user_id` only if the corresponding `users.open_id` has been mapped into the new Supabase `users.id` value; otherwise import the lead as unclaimed and have the appropriate agent reclaim it through the application.

If you preserve numeric lead IDs during an import, reset the PostgreSQL sequence after loading the rows so future inserts do not collide. If the previous database is empty or only contains test records, start with a clean Supabase project and do not seed fake customer data.

## Security and operating recommendations

The most important security boundary is the Vercel API. The browser never receives `SUPABASE_DATABASE_URL`, and the Supabase publishable key is not used by the current CRUD path. The API verifies the Manus session and uses the authenticated user’s numeric `users.id` for ownership decisions.

The claim operation remains an atomic conditional PostgreSQL update. It succeeds only when the target row is still unclaimed. A second agent cannot overwrite the first agent because the `WHERE claimed_by_user_id IS NULL` condition no longer matches after the first update commits.

For the 5–10-agent use case, the Supabase pooled connection and the Vercel Function model are sufficient. Avoid long-running workers, in-memory lead state, and per-request migrations. Run migrations as a deliberate release step in Supabase SQL Editor or from an operator machine with the server-only database URI; do not make the Vercel build run destructive database changes.

Rotate the JWT secret and database password through Vercel/Supabase when needed, redeploy after variable changes, and review Supabase database logs periodically. If you later decide that Supabase Auth should replace Manus OAuth, treat that as a separate authentication migration: the database policies can then use `auth.uid()`, but the current Manus `openId` mapping, session callback, and test assumptions would need a dedicated redesign.

## Troubleshooting matrix

| Symptom | Likely cause | Corrective action |
|---|---|---|
| `DATABASE_URL` or connection errors | `SUPABASE_DATABASE_URL` is missing, malformed, or uses the direct host in a serverless-heavy setup | Use the Supabase Session Pooler URI with `sslmode=require`, add it server-side in all required Vercel environments, then redeploy. |
| Login returns `invalid oauth state` | The nonce cookie was blocked, the callback domain is not allowlisted, or the login was started on a different origin | Use HTTPS, allowlist the exact callback URL, and retry in a cookie-permitting browser. |
| Login returns to the wrong host | Frontend and API were split across origins without adapting the callback redirect | Use the single Vercel project architecture, or explicitly implement a trusted API/frontend origin contract. |
| Browser can see the shell but lead requests fail | The Function environment is missing `JWT_SECRET`, `OAUTH_SERVER_URL`, or the database URI | Check Vercel Function logs and verify the variables in the deployment environment. |
| Direct Supabase REST requests return no rows | RLS is enabled and no public policies exist by design | Use the Vercel tRPC API, or deliberately migrate to Supabase Auth and write `auth.uid()` policies. |
| Vercel deep link returns 404 | The SPA rewrite was removed or overridden | Restore the `vercel.json` rewrite and redeploy. |
| A second agent can claim a lead | The API was bypassed or the database schema was not applied | Confirm the application uses the conditional `claimLead` mutation and that the Supabase foreign key/table migration ran successfully. |

## References

[1]: https://vercel.com/docs/frameworks/frontend/vite "Vite on Vercel"
[2]: https://vercel.com/docs/environment-variables "Vercel Environment Variables"
[3]: https://supabase.com/docs/guides/database/postgres/row-level-security "Supabase Row Level Security"
[4]: https://github.com/Keyayco/Devign-Lead-Forge/blob/main/client/src/const.ts "Devign Lead Forge OAuth login helper"
[5]: https://supabase.com/docs/guides/integrations/vercel-marketplace "Supabase Vercel Marketplace"
