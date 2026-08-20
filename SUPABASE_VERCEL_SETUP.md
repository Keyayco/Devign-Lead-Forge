# Devign Lead Forge: Supabase and Vercel Setup

## Architecture

Devign Lead Forge is a lightweight, same-origin browser application for a team of approximately 5–10 agents. Vercel serves the React/Vite frontend and the request-scoped Node.js tRPC API. Supabase provides email/password authentication and PostgreSQL persistence. The browser stores the Supabase session and sends its short-lived access token as `Authorization: Bearer <token>` to `/api/trpc`; the API verifies the token before performing any lead operation.

| Layer | Production choice | Responsibility |
|---|---|---|
| Browser | React 19 + Vite static assets | Login, sign-up, lead CRUD forms, filtering, and claim status |
| Authentication | Supabase Auth email/password | Account creation, sign-in, session persistence, and sign-out |
| API | Vercel Node Function at `api/[...path].ts` | Token verification, tRPC procedures, authorization, and mapping |
| Database | Existing Supabase PostgreSQL schema | Profiles, leads, timestamps, ownership, and `claim_lead` RPC |
| Hosting | One Vercel project | Same-origin frontend and API; no cross-origin cookie or CORS setup |

The application does **not** use Manus OAuth, Manus session cookies, Manus storage, Manus notifications, or a managed TiDB/MySQL database in its active runtime path. Do not add a service-role key to the browser or commit any database password.

## Existing Supabase schema is authoritative

The provisioned database was inspected and must not be altered by this repair. The repository’s historical SQL files under `supabase/migrations/` describe an earlier schema and are retained for reference only; do **not** run them against the existing project unless you have separately verified that the target database is empty and intentionally being rebuilt.

The active contract is:

| Table | Columns used by the application |
|---|---|
| `public.profiles` | `id uuid`, `full_name text`, `email text`, `role text`, `created_at timestamptz`, `updated_at timestamptz` |
| `public.leads` | `id uuid`, `title text`, `company_name text`, `contact_name text`, `contact_email text`, `contact_phone text`, `source text`, `status text`, `claimed_by uuid`, `claimed_at timestamptz`, `notes text`, `created_by_id uuid`, `created_at timestamptz`, `updated_at timestamptz` |
| `public.claim_lead` | `claim_lead(p_lead_id uuid)`, returning the claimed `leads` row |

`profiles.id` and the lead ownership columns are Supabase Auth UUIDs. There is no active `public.users` table, no serial user key, and no numeric lead ID.

The live database inspection also confirmed that RLS is enabled on both tables. The provisioned policies permit authenticated lead reads, require the authenticated UUID to own inserted rows, restrict lead updates to the creator, claimant, or an admin profile, and restrict deletes to the creator or an admin. Anonymous requests have no matching lead policies. The application deliberately does not call PostgREST for lead CRUD; it uses the server-only Session Pooler connection after tRPC has verified the bearer token. This keeps the API as the primary authorization boundary while preserving the existing database policy contract.

> **Important:** Do not run `pnpm drizzle-kit migrate` or apply a generated Drizzle diff for this repair. The TypeScript schema mirrors the already-provisioned tables for typing and documentation; it is not permission to rename or recreate production tables.

## Approved UI-to-database mapping

The UI keeps the exact business headers requested by the team. The API translates those names into the existing columns without adding columns.

| UI field | Existing database storage | Mapping rule |
|---|---|---|
| **Name** | `company_name`; also `title` | The submitted name is written to both existing required text fields. |
| **Contact** | `contact_name` and `contact_phone` | The API splits `Name · Phone` at the first middle dot. A contact without a phone is valid. |
| **Email** | `contact_email` | The validated email is stored here. |
| **Address** | `notes` | The address is stored as the first notes line. |
| **Type** | `source` | The UI type filter reads and filters this column. |
| **Demo Link** | `notes` | The URL is stored as `Demo Link: <url>` on a separate notes line. |

On reads, the API reverses the mapping. `notes` is parsed into `address` and `demoLink`; the `contact` display value is reconstructed as `contact_name · contact_phone` when a phone exists. Existing free-form notes that have no `Demo Link:` marker are treated as the address portion and yield an empty demo-link value.

## Configure Supabase Auth

Open the Supabase project at `https://bctcdpkwdyxebuiurcgk.supabase.co` and go to **Authentication → Providers**. Enable the **Email** provider. The frontend uses `signUp`, `signInWithPassword`, `getSession`, `onAuthStateChange`, and `signOut` from the official Supabase JavaScript client.

Choose the email confirmation policy deliberately. For an internal team, leaving **Confirm email** enabled is the safer default. If it is enabled, an agent must confirm the invitation or sign-up email before the first successful sign-in. If the team is provisioned through an administrator and the project intentionally disables confirmation, sign-up can be used immediately; this is more convenient but verifies less about the email address.

In **Authentication → URL Configuration**, set the following values.

| Supabase setting | Value |
|---|---|
| Site URL | The final Vercel production URL or your custom domain |
| Local development URL | `http://localhost:3000` |
| Additional redirect URLs | Add only the exact Vercel preview URLs you intend to use |

The first sign-up request also passes the current browser origin as the email redirect destination. Password recovery UI is not part of this repair; use the Supabase dashboard or add a follow-up reset-password screen if self-service recovery is needed.

## Configure Vercel environment variables

Connect the GitHub repository `Keyayco/Devign-Lead-Forge` to Vercel. Use the repository root as the project root and keep the production branch on `main` unless your team has chosen another stable branch.

Set these variables for every Vercel environment that will be used: **Production**, **Preview**, and **Development** as appropriate.

| Variable | Required | Visibility | Purpose |
|---|---:|---|---|
| `VITE_SUPABASE_URL` | Yes | Public | Supabase project URL used by the browser client. |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Yes | Public | Supabase publishable key used only for Auth. |
| `SUPABASE_DATABASE_URL` | Yes | Server-only | Supabase Session Pooler URI used by server-side lead CRUD and profile lookups. |
| `SUPABASE_URL` | Recommended | Server-only | Explicit server-side Supabase URL; the code falls back to the Vite URL. |
| `SUPABASE_PUBLISHABLE_KEY` | Recommended | Server-only | Explicit server-side publishable key; the code falls back to the Vite key. |
| `VITE_APP_TITLE` | Optional | Public | Browser title and branding. |

Use the Supabase **Session Pooler** connection string from **Project Settings → Database → Connection string**. It normally uses a host similar to `aws-<n>-<region>.pooler.supabase.com`; use the exact project-specific host and port supplied by Supabase. URL-encode the database password, especially `@`, `:`, `/`, `?`, and `#`. Never prefix the database URI with `VITE_`.

The old variables `VITE_APP_ID`, `VITE_OAUTH_PORTAL_URL`, `OAUTH_SERVER_URL`, `OWNER_OPEN_ID`, `OWNER_NAME`, `JWT_SECRET`, `BUILT_IN_FORGE_API_URL`, `BUILT_IN_FORGE_API_KEY`, `VITE_FRONTEND_FORGE_API_URL`, and `VITE_FRONTEND_FORGE_API_KEY` are not required by the standalone deployment. Remove them from the Vercel project only after confirming that no separate application uses them.

## Vercel project settings

The checked-in `vercel.json` is intentionally API-safe.

| Setting | Value |
|---|---|
| Framework preset | Vite |
| Root directory | Repository root |
| Install command | `pnpm install` |
| Build command | `pnpm build:vercel` |
| Output directory | `dist/public` |
| API function | `api/[...path].ts` |
| API runtime | Vercel automatic Node.js runtime |

The SPA rewrite excludes `/api` and `/api/*`, so browser routes go to `index.html` while tRPC requests continue to reach the Vercel Function. Do not replace it with an unconditional `/(.*) → /index.html` rewrite unless you have separately verified that the API route still wins in the chosen Vercel configuration.

## Local development

Install dependencies and pull environment variables into a local file that is ignored by Git.

```bash
pnpm install
pnpm add -g vercel
vercel login
vercel link
vercel env pull .env.local
pnpm dev
```

The application intentionally does not fall back to the old managed database URL. If `SUPABASE_DATABASE_URL` is missing, server-side database calls fail closed rather than silently writing to a different database. To test the Vercel-shaped function locally, run `pnpm dev:vercel` after linking the project.

For a team member, the normal onboarding flow is to open the application, choose **Create one**, provide a display name, email, and password, confirm the email if required, and then sign in. The first authenticated API request creates or updates that user’s `profiles` row using the Supabase Auth UUID.

## Request and authorization flow

The browser Supabase client persists the session and refreshes it when necessary. The tRPC client obtains the current access token and includes it in the bearer header. The API calls Supabase Auth `getUser(accessToken)`. It then resolves or upserts the matching `profiles.id` UUID and uses that verified ID for all ownership decisions.

CRUD procedures are protected by tRPC authentication middleware. Create writes the verified user ID to `created_by_id`. The application reads and mutates leads only through the API and supports search, type, and claim-status filters. Update and delete first read the row and reject a lead claimed by another UUID. The browser cannot supply a substitute owner ID. Direct PostgREST access remains governed by the live RLS policies described above; do not treat the publishable key as a server credential.

Claiming uses the database function `public.claim_lead(p_lead_id uuid)` rather than a client-side read followed by a write. PostgreSQL performs the claim transition atomically, so simultaneous requests from two agents cannot both win. The API returns a conflict when the RPC does not return the requested lead.

## Verification checklist

Run the repository checks before pushing or deploying.

```bash
pnpm check
pnpm test
pnpm build:vercel
```

The current test suite covers the bearer authorization boundary, UUID profile mapping, invalid input, ownership enforcement, atomic claim procedure path, CRUD procedure arguments, Supabase Auth endpoint reachability, database configuration boundaries, and Vercel entrypoint construction.

After deployment, verify the following sequence with two test accounts.

| Test | Expected result |
|---|---|
| Open the Vercel URL | Password sign-in panel renders. |
| Create or invite an account | Supabase Auth creates the account or requests email confirmation. |
| Sign in and refresh | The session and internal profile identity persist. |
| Create a lead | The row appears with the six requested headers. |
| Edit an unclaimed lead | The mapped values round-trip without losing the address or demo link. |
| Claim from account A | The row becomes locked to account A. |
| Claim the same row from account B | The API returns a conflict and ownership is unchanged. |
| Edit/delete from account A | The operation succeeds. |
| Edit/delete from account B | The API rejects it and the UI hides actions for the locked row. |
| Filter by Type and claim status | The API filters `source` and `claimed_by` correctly. |
| Inspect the database | The row uses existing columns only; no new migration is required. |
| Inspect RLS | RLS is enabled; authenticated policies are present for ownership checks, while anonymous requests have no lead policy. |

When debugging a `401`, check that the browser has an active Supabase session and that the tRPC request contains the bearer token. For a database failure, check the Session Pooler host, port, URL-encoded password, Vercel environment scope, and whether the function can reach Supabase from the selected region.

## GitHub and deployment sequence

Push the reviewed code to `main`, import the repository into Vercel, add the environment variables, and deploy from Vercel. The repository must have a checkpoint before publishing through the project management UI. If you use the GitHub CLI, verify the remote and branch first:

```bash
git remote -v
git status --short
git push origin main
```

Vercel will build from the pushed commit. If you change environment variables, trigger a new deployment because Vercel environment changes apply to new builds and function instances.
