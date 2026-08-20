# Project TODO

- [x] Create the leads database table with exact business fields: name, contact, email, address, type, demo link, claimed-by identity, claimed-at timestamp, created-at timestamp, and updated-at timestamp.
- [x] Generate the Drizzle migration and apply the leads schema to the project database.
- [x] Add typed database helpers for listing, creating, updating, deleting, and atomically claiming leads.
- [x] Add protected tRPC procedures for full lead CRUD and claim status handling with one-way locking.
- [x] Enforce claim locking server-side so a lead can only be claimed when it is unclaimed; prevent non-owners from modifying or deleting claimed leads.
- [x] (Superseded) Use Manus OAuth identity for authenticated agent access and show the signed-in agent in the dashboard; replaced by Supabase Auth password identity.
- [x] Build the internal dashboard shell with persistent sidebar navigation and a polished, accessible visual system.
- [x] Build the leads table with exact visible column names: Name, Contact, Email, Address, Type, and Demo Link.
- [x] Add a visible claim status area and claim action that clearly identifies the claiming agent and locks claimed leads.
- [x] Add lead create and edit forms with validation for all requested fields.
- [x] Add delete confirmation flow and clear success/error feedback.
- [x] Add search by lead name and filtering by type and claimed/unclaimed status.
- [x] Add loading, empty, error, and responsive states for the leads view.
- [x] Add Vitest coverage for CRUD procedure validation and claim-locking behavior.
- [x] Run type checks, tests, and build verification.
- [x] Capture desktop and mobile screenshots to verify visual quality and accessibility.
- [x] Save the completed project checkpoint and provide the user with the version attachment.

## Decisions and assumptions

- The tool is an authenticated internal application for approximately 5–10 agents.
- Any authenticated agent may create, read, update, and delete unclaimed leads.
- Once claimed, a lead is locked to the claiming agent's identity; other agents cannot claim it or modify/delete it.
- The exact column labels requested by the user are preserved in the table UI.
- No fake customer reviews, ratings, or testimonials are included.

## Supabase & Vercel Migration (Phase 2 & 3)

- [x] Adapt database schema and connection configuration for Supabase PostgreSQL (SQL migration script for users and leads).
- [x] Provide default-deny Supabase Row Level Security (RLS), trigger configuration, and documented server-side Supabase Auth authorization for agent identity and atomic lead claiming.
- [x] Refactor client/server data fetching (or provide client-side Supabase/Vercel serverless functions) to support standalone Vercel deployment.
- [x] Write an extensive, step-by-step setup and migration guide covering Supabase project creation, environment variables, Vercel deployment, RLS, and password Auth setup.

## Supabase Password Authentication

- [x] Replace Manus OAuth session resolution with Supabase Auth email/password bearer-token verification.
- [x] Add public Supabase browser client with persistent password sessions and tRPC Authorization headers.
- [x] Add self-service agent sign-up, sign-in, sign-out, and confirmation messaging.
- [x] Map Supabase Auth UUIDs to internal users and preserve lead claim ownership checks.
- [x] Remove Manus OAuth routes, SDK, cookie helpers, and environment requirements from the runtime path.
- [x] Update Supabase migrations, RLS/security guidance, and setup documentation for password auth.
- [x] Add tests for Supabase Auth configuration, password auth boundaries, and regressions.
- [x] Run type checks, tests, production build, responsive verification, and save a new checkpoint.

## GitHub Push

- [x] Push the verified Supabase Auth password-login project to Keyayco/Devign-Lead-Forge on the main branch.

## Vercel Configuration Review & Push

- [x] Review supplied vercel.json against SPA and API function routing requirements.
- [x] Apply vercel.json update and test build verification.
- [x] Push the updated configuration to GitHub Keyayco/Devign-Lead-Forge main.

## Vercel Runtime Fix

- [x] Diagnose Vercel Function runtime configuration requirements for Node.js.
- [x] Update vercel.json to use the supported Node runtime format.
- [x] Verify build and push the runtime fix to GitHub Keyayco/Devign-Lead-Forge main.

## Supabase UUID Profiles & Vercel Repair Specification

- [x] Inspect package.json, vite.config.ts, server files, and API entrypoint for TypeScript errors and Manus runtime artifacts.
- [x] Migrate Drizzle schema to UUID profiles (`profiles.id` linking to `auth.users.id`) and UUID leads (`leads.id`, `leads.created_by_id`, `leads.claimed_by`).
- [x] Refactor server/db.ts and server/routers.ts to use atomic `claim_lead` and server-side bearer verification.
- [x] Refactor Vercel API entrypoint (`api/[...path].ts`) and express app to export a clean serverless handler without dev middleware.
- [x] Remove `vite-plugin-manus-runtime` and fix plugin types in `vite.config.ts`.
- [x] Run typecheck, vitest, production build, and push repaired project to GitHub main.

## Approved Existing-Schema Mapping

- [x] Implement the approved mapping without database changes: Name → company_name; Contact → contact_name plus contact_phone; Email → contact_email; Address → notes; Type → source; Demo Link → an explicit `Demo Link:` marker in notes.
- [x] Preserve title/status/created_by_id/claimed_by UUID fields and use public.claim_lead(p_lead_id uuid) for atomic claiming.
- [x] Replace serial users and numeric ownership references in active code with profiles UUIDs.
- [x] Remove active Manus runtime/plugin/debug/storage/notification dependencies and isolate local Vite middleware from Vercel production.
- [x] Verify the standalone Vercel API, Supabase Auth bearer flow, RLS-compatible CRUD, tests, build, and push the repair to GitHub main.

## Final Deployment Verification Gaps

- [x] Push the repaired project to GitHub main and record the resulting commit hash (`8270f78c1739908cca67058acc49958d73b95592`).
- [x] Document the live authenticated CRUD and atomic-claim verification blocker: the sandbox has the Supabase database contract and Auth smoke-test configuration, but no deployed Vercel URL or team test credentials were supplied; unit tests cover the protected procedures and RPC path.
- [x] Verify the direct browser/PostgREST boundary: live inspection confirms RLS is enabled, anonymous requests have no lead policies, and authenticated policies enforce ownership conditions; the API does not use browser table access for CRUD.
