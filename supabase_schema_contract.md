# Verified Supabase Schema Contract

Read-only inspection completed against the configured Supabase Session Pooler on the current project.

## `public.profiles`

| Column | PostgreSQL type | Nullability | Default |
|---|---|---:|---|
| `id` | `uuid` | no | none |
| `full_name` | `text` | yes | none |
| `email` | `text` | yes | none |
| `role` | `text` | no | `user` |
| `created_at` | `timestamptz` | yes | `now()` |
| `updated_at` | `timestamptz` | yes | `now()` |

## `public.leads`

| Column | PostgreSQL type | Nullability | Default |
|---|---|---:|---|
| `id` | `uuid` | no | `gen_random_uuid()` |
| `title` | `text` | no | none |
| `company_name` | `text` | no | none |
| `contact_name` | `text` | no | none |
| `contact_email` | `text` | yes | none |
| `contact_phone` | `text` | yes | none |
| `source` | `text` | yes | none |
| `status` | `text` | yes | `new` |
| `claimed_by` | `uuid` | yes | none |
| `claimed_at` | `timestamptz` | yes | none |
| `notes` | `text` | yes | none |
| `created_by_id` | `uuid` | yes | none |
| `created_at` | `timestamptz` | yes | `now()` |
| `updated_at` | `timestamptz` | yes | `now()` |

## Atomic claim function

The provisioned database exposes `public.claim_lead(p_lead_id uuid)` and returns a `leads` row. The application must call this function rather than implementing a client-side `SELECT` followed by `UPDATE`.

The existing database is authoritative. No `public.users` table, serial ownership key, schema migration, or new business columns should be introduced by this repair.
