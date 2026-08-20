# Devign Lead Forge: Supabase Auth and Vercel Setup Guide

## Executive assessment

The application is now designed for a **same-origin Vercel deployment**: Vercel serves the React/Vite frontend and exposes the existing Express/tRPC API as a request-scoped Node Function under `/api`. Supabase provides PostgreSQL persistence and Supabase Auth email/password identity. This is a suitable lightweight architecture for a team of approximately 5–10 agents because the browser does not need a permanently running process, while lead ownership remains enforced by the API and database.

The previous Manus OAuth dependency has been removed from the application path. Agents create or use ordinary Supabase Auth accounts with an email address and password. Supabase maintains the browser session; the frontend attaches the current access token as an `Authorization: Bearer ...` header on each tRPC request; the Vercel API validates that token before resolving the corresponding internal user row.

| Layer | Production implementation | Responsibility |
|---|---|---|
| Browser UI | React 19 + Vite static assets on Vercel | Login, sign-up, lead table, CRUD forms, filtering, and claim state |
| Password identity | Supabase Auth email/password | Account creation, sign-in, session persistence, and sign-out |
| API | Express + tRPC exported through `api/[...path].ts` | Typed lead operations, bearer-token verification, and authorization |
| Database | Supabase PostgreSQL through Drizzle and a server-only pooled URI | Users, leads, timestamps, claim ownership, and atomic claim updates |
| Direct table access | Supabase RLS with default-deny public roles | Prevents the browser from bypassing the API through PostgREST |
| Deployment | One Vercel project for frontend and `/api/*` Functions | Same-origin API calls without a separate CORS or cookie domain |

> **Important:** The Supabase publishable key is not a database password. It may be present in the browser bundle. The PostgreSQL connection string is a different credential and must remain server-only.

## What changed in the repository

The authentication and deployment refactor is implemented in the following areas.

| File or directory | Purpose |
|---|---|
| `client/src/lib/supabase.ts` | Creates the browser Supabase client with persistent Auth sessions. |
| `client/src/_core/hooks/useAuth.ts` | Loads the Supabase session, signs in, signs up, signs out, and hydrates the internal agent profile through tRPC. |
| `client/src/components/AuthPanel.tsx` | Provides self-service email/password sign-in and account creation. |
| `client/src/main.tsx` | Adds the current Supabase access token to tRPC requests. |
| `server/supabaseAuth.ts` | Validates a bearer token with Supabase Auth’s `getUser` endpoint. |
| `server/_core/context.ts` | Maps the verified Supabase UUID into the internal `users` row. |
| `server/db.ts` | Uses `users.auth_user_id` and retains the existing numeric lead ownership model. |
| `server/_core/index.ts` | No longer registers an OAuth callback route and remains safe to import as a Vercel Function. |
| `server/_core/oauth.ts`, `server/_core/sdk.ts`, `server/_core/cookies.ts` | Removed from the runtime path because they existed only for Manus OAuth/session cookies. |
| `drizzle/schema.ts` | Uses `auth_user_id` for the Supabase Auth UUID. |
| `supabase/migrations/0000_living_quasimodo.sql` | Fresh installation schema using `auth_user_id`. |
| `supabase/migrations/0001_user_identity.sql` | Non-destructive rename for an older Supabase database that still has `open_id`. |
| `supabase/migrations/0002_security.sql` | RLS, timestamp triggers, indexes, and one-way claim protection. |
| `server/supabase.auth.test.ts` | Live smoke test for the configured Supabase URL and publishable key. |

## Credential model

Configure these values in Vercel for **Production**, **Preview**, and **Development** as appropriate. Vercel environment changes apply to new deployments, so redeploy after changing a value.[6]

| Variable | Required | Where used | Exposure |
|---|---:|---|---|
| `VITE_SUPABASE_URL` | Yes | Browser client and server Auth verification fallback | Public |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Yes | Browser Auth client and server Auth verification fallback | Public |
| `SUPABASE_DATABASE_URL` | Yes | Drizzle/Postgres in the Vercel API | Server-only |
| `SUPABASE_URL` | Optional | Explicit server-side alias for the project URL | Server-only if used |
| `SUPABASE_PUBLISHABLE_KEY` | Optional | Explicit server-side alias for the publishable key | Public credential; keep out of source |
| `VITE_APP_TITLE` | Optional | Site title/branding | Public |

The application no longer requires `VITE_APP_ID`, `VITE_OAUTH_PORTAL_URL`, `OAUTH_SERVER_URL`, `OWNER_OPEN_ID`, `JWT_SECRET`, or a Manus session cookie. Remove those old variables from the Vercel project once you have confirmed there are no other applications using them.

The configured Supabase project URL is:

```text
https://bctcdpkwdyxebuiurcgk.supabase.co
```

The publishable key supplied for this project is already configured through the project’s secret manager. Do not paste it into Git, database SQL, or a server log. It is not necessary to expose a service-role key for this application.

For `SUPABASE_DATABASE_URL`, use Supabase’s **Session Pooler** connection string from **Project Settings → Database → Connection string**. It normally resembles the following, but the project reference, region, and password must come from your Supabase dashboard:

```text
postgresql://postgres.<project-ref>:<database-password>@aws-0-<region>.pooler.supabase.com:6543/postgres?sslmode=require
```

The password in the URI must be URL-encoded if it contains characters such as `@`, `:`, `/`, `?`, or `#`. Never prefix this variable with `VITE_`.

## Step 1: Configure Supabase Auth

Create or open the Supabase project at the URL above. In **Authentication → Providers**, enable the **Email** provider. Supabase’s password Auth flow supports email/password account creation and password sign-in through `signUp` and `signInWithPassword`.[1] [2] [3]

Choose the email-confirmation policy deliberately. For a real internal team, keeping **Confirm email** enabled is the safer default because an agent must prove control of the address before the account becomes usable. If you disable confirmation for a tightly controlled environment, the app can sign the agent in immediately after account creation; this is convenient but provides weaker account-verification guarantees.

In **Authentication → URL Configuration**, set:

| Setting | Value |
|---|---|
| Site URL | `https://YOUR_PRODUCTION_DOMAIN` |
| Local development URL | `http://localhost:3000` |
| Preview URL | Add only the exact preview URLs you intend to use, if needed |

The current sign-up flow sends the agent back to the origin that started sign-up. Use HTTPS for production. Password recovery is not yet exposed as a UI action in the project; if the team needs self-service recovery, add a `resetPasswordForEmail` screen and a password-update screen as a follow-up feature.

## Step 2: Apply the Supabase database migrations

Run the SQL files in this order in the **Supabase SQL Editor**, or apply them through the Supabase CLI after linking the project:

```text
supabase/migrations/0000_living_quasimodo.sql
supabase/migrations/0001_user_identity.sql
supabase/migrations/0002_security.sql
```

For a new Supabase project, run all three files. For an existing Supabase database created from the earlier version of this repository, run `0001_user_identity.sql` only if `public.users` still contains `open_id`, then run `0002_security.sql`. Do not run these PostgreSQL files against the managed TiDB/MySQL database attached to a Manus preview; that database uses a different SQL dialect. The repository’s built-in database is not the production target for this deployment.

The schema contains the following application fields:

| Application field | Supabase column | Meaning |
|---|---|---|
| `name` | `name` | Required lead name |
| `contact` | `contact` | Required contact context |
| `email` | `email` | Required lead email |
| `address` | `address` | Required free-form address |
| `type` | `type` | Required lead type |
| `demoLink` | `demo_link` | Required URL |
| `claimedByUserId` | `claimed_by_user_id` | Internal numeric owner reference |
| `claimedAt` | `claimed_at` | UTC timestamp for the winning claim |
| `createdAt` | `created_at` | Creation timestamp |
| `updatedAt` | `updated_at` | Maintained by the database trigger |
| Supabase UUID | `users.auth_user_id` | Stable mapping to `auth.users.id` |

The security migration enables RLS on `public.users` and `public.leads`, revokes table privileges from `anon` and `authenticated`, and intentionally creates no direct table policies. This is a **default-deny** design: the browser may use Supabase Auth, but it must use the Vercel API to read or mutate lead data. Supabase recommends enabling RLS for exposed tables, and an RLS-enabled table cannot be read through a publishable-key request until an applicable policy exists.[4]

The claim trigger rejects any update that changes an already-populated `claimed_by_user_id`. The API’s conditional PostgreSQL update performs the only supported transition, from `NULL` to the winning internal user id. This gives the system two layers of claim protection: the API authorization rule and the database’s one-way ownership guard.

## Step 3: Configure Vercel

Connect the GitHub repository `Keyayco/Devign-Lead-Forge` to Vercel and use the repository root as the project root. The checked-in configuration already describes a Vite build, the static output directory, a Node 22 API Function, and SPA rewrites.

| Vercel setting | Value |
|---|---|
| Framework preset | Vite |
| Root directory | Repository root |
| Install command | `pnpm install` |
| Build command | `pnpm build:vercel` |
| Output directory | `dist/public` |
| API runtime | Node.js 22 |
| Production branch | Your stable branch, normally `main` |

Add the environment variables before the first deployment:

```text
VITE_SUPABASE_URL=https://bctcdpkwdyxebuiurcgk.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<your configured publishable key>
SUPABASE_DATABASE_URL=<your Supabase Session Pooler URI>
```

The Vite build produces static frontend assets. Vercel discovers `api/[...path].ts` as a Node Function. The checked-in SPA rewrite uses a negative lookahead to send browser routes to `index.html` while explicitly excluding `/api` and `/api/*`, so the Supabase-authenticated tRPC Function remains reachable.[5] [6]

Keep the frontend and API in the same Vercel project and domain. That avoids CORS configuration and avoids having to send bearer tokens between unrelated origins. If you intentionally split them, add an explicit trusted-origin CORS policy and never use wildcard origins for authenticated requests.

## Step 4: Run locally

Install dependencies and link the repository to the Vercel project:

```bash
pnpm install
pnpm add -g vercel
vercel login
vercel link
vercel env pull .env.local
```

Ensure `.env.local` is ignored by Git. For local API/database testing, `.env.local` must contain a valid `SUPABASE_DATABASE_URL`; otherwise the API will correctly report that the production database is not configured rather than accidentally connecting to the managed TiDB database.

Run the application with:

```bash
pnpm dev
```

To exercise the Vercel-shaped Function locally, use:

```bash
pnpm dev:vercel
```

The local sign-up flow is:

1. Open the local URL and choose **Need an account? Create one**.
2. Enter a name, email, and password of at least six characters.
3. If email confirmation is enabled, open the confirmation email and return to the site.
4. Sign in with the same email and password.
5. The first authenticated tRPC request creates or updates the internal `users` row using the Supabase Auth UUID.

## Step 5: Understand the request and authorization flow

The browser Supabase client stores and refreshes the Auth session. The tRPC client calls `supabase.auth.getSession()` before a request and adds the access token as a bearer header. The API calls Supabase Auth’s `getUser(accessToken)` endpoint to validate the token, then upserts `users.auth_user_id` and resolves the numeric internal user id. Supabase documents access tokens as JWTs used to identify users and support authorization decisions.[7]

The lead procedures do not trust an id supplied by the browser. `ctx.user.id` comes from the verified token-to-user mapping. A lead is claimable only when `claimed_by_user_id` is still null. An update or delete on a claimed lead is allowed only to the claiming internal user. This preserves the existing claim-lock behavior while changing only the identity provider.

The publishable key is not a substitute for API authorization. It allows the browser to talk to Supabase Auth, but the table privileges and RLS setup prevent the browser from reading `public.leads` directly. The database URL is never sent to the browser.

## Step 6: Verify the deployment

Run the repository checks before pushing:

```bash
pnpm check
pnpm test
pnpm build:vercel
```

The Supabase Auth smoke test calls `/auth/v1/settings` with the configured project URL and publishable key. It verifies that the supplied public credential is accepted without attempting to create a user or modify data.

After deployment, verify the following sequence:

| Check | Expected result |
|---|---|
| Open the Vercel URL | The password access panel renders. |
| Create a new account | Supabase returns either an active session or a confirmation message. |
| Confirm email, if enabled | The agent can sign in successfully. |
| Refresh the browser | The Supabase session persists and the internal agent identity reloads. |
| Add a lead | The record persists in Supabase PostgreSQL. |
| Search and filter | Name, type, and claim-status filters work. |
| Claim an unclaimed lead | The winning agent is shown and the row is locked. |
| Attempt a second claim | The API returns a conflict and ownership is unchanged. |
| Edit/delete as claimant | The operation succeeds. |
| Edit/delete as another agent | The API rejects the operation and the UI hides locked-row actions. |
| Query Supabase REST directly with the publishable key | Direct table access is denied by the default-deny security setup. |

Use Vercel Function logs and Supabase Auth/Postgres logs together when debugging. A `401` on `/api/trpc` usually means the browser has no active session or the bearer token was not attached. A database connection failure usually means `SUPABASE_DATABASE_URL` is missing, uses the wrong pooler host, contains an unencoded password, or is not available in the selected Vercel environment.

## Data migration considerations

If you have real leads in the earlier application, export and transform them before importing into Supabase. The prior internal user key was a Manus OAuth identifier; it cannot be assumed to match a Supabase Auth UUID. Agents should create Supabase Auth accounts first. Then map imported ownership only when you can reliably associate an old owner with the new `users.id`; otherwise import those leads as unclaimed and let the correct agent claim them through the application.

Do not migrate Manus session cookies or access tokens. They are not part of the new authentication model. Do not import passwords from another system. Agents should create new Supabase Auth passwords, and the Supabase Auth service should remain the only password verifier.[1]

## Operational security checklist

Keep the database connection string server-only, rotate it through Vercel and Supabase when needed, and redeploy after rotation. Keep the publishable key in public variables only; never replace it with a service-role key in the browser. Keep RLS enabled even though the application uses a server API, because RLS is a valuable defense against accidental direct table exposure.[4]

Use the Supabase Auth dashboard to disable accounts or enforce stronger password policies as the team grows. The current interface does not include password reset or account deletion screens. Those should be added before treating the tool as a full employee-lifecycle system. For a small internal team, the immediate operational process can be: create the account, verify the email if required, and disable departed agents in Supabase Auth.

## Troubleshooting

| Symptom | Likely cause | Resolution |
|---|---|---|
| “Supabase Auth is not configured” | Missing public URL or key | Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` to the active Vercel environment and redeploy. |
| Account creation returns a confirmation notice but sign-in fails | Email confirmation is enabled | Confirm the address, then sign in again. Check Auth email logs if the message does not arrive. |
| Lead list is empty after successful login | Missing `SUPABASE_DATABASE_URL` or migrations not applied | Add the Session Pooler URI, apply all migrations, and inspect Function logs. |
| `/api/trpc` returns `UNAUTHORIZED` | No session bearer token or expired session | Sign in again and confirm the browser request contains `Authorization: Bearer ...`. |
| Direct REST table requests return `401`/`403` | Expected default-deny RLS | Use the Vercel API for lead data; do not grant broad public table policies. |
| Claim appears to succeed twice | Incorrect schema or old API deployment | Confirm `0002_security.sql` and the conditional claim update are deployed, then redeploy Vercel. |
| Vercel page loads but a browser route returns 404 | SPA rewrite missing | Keep the checked-in `vercel.json` rewrites and redeploy. |
| Local preview still tries to use the managed database | Old environment fallback | Set `SUPABASE_DATABASE_URL` explicitly; the current runtime no longer falls back to `DATABASE_URL`. |

## References

[1]: https://supabase.com/docs/guides/auth/passwords "Supabase Password-based Auth"
[2]: https://supabase.com/docs/reference/javascript/auth-signup "Supabase JavaScript signUp reference"
[3]: https://supabase.com/docs/reference/javascript/auth-signinwithpassword "Supabase JavaScript signInWithPassword reference"
[4]: https://supabase.com/docs/guides/database/postgres/row-level-security "Supabase Row Level Security"
[5]: https://vercel.com/docs/frameworks/frontend/vite "Vercel Vite deployment documentation"
[6]: https://vercel.com/docs/rewrites "Vercel rewrites documentation"
[7]: https://supabase.com/docs/guides/auth/jwts "Supabase JWT documentation"
