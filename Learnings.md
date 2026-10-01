Lead Forge — Learnings

«A running engineering learning log for Lead Forge.

This file records problems encountered, investigations performed, concepts learned, evidence collected, and lessons that should remain useful when developing or debugging the system in the future.»

---

Lesson 001 — When a Database Claim Fails

Date: 2026-10-01
Area: Supabase / PostgreSQL / Authentication / Row Level Security / RPC
Incident: Lead claiming returned "Lead is already claimed or does not exist"

---

1. The Problem

Lead Forge contains a lead-claiming system.

The intended behaviour is that a lead can have an owner:

claimed_by = user UUID

An unclaimed lead has:

claimed_by = NULL

The application uses a PostgreSQL database function called:

public.claim_lead(uuid)

When a user attempts to claim a lead, the application eventually calls this database function.

The error being returned was:

Lead is already claimed or does not exist

The confusing part was that some leads were visibly unclaimed.

For example:

Perfect Gardens
claimed_by = NULL

So the initial question was:

«If the lead exists and "claimed_by" is NULL, why can't another user claim it?»

---

2. First Principle: Follow the Request

A useful debugging technique is to stop looking at the error message in isolation.

Instead, follow the complete request path:

User
  ↓
Lead Forge UI
  ↓
tRPC
  ↓
Supabase authentication/session
  ↓
PostgreSQL RPC
  ↓
public.claim_lead()
  ↓
public.leads
  ↓
Row Level Security

This gives us multiple possible failure layers.

A useful mental model is:

Frontend
   │
   ▼
Application/API
   │
   ▼
Authentication
   │
   ▼
Database function
   │
   ▼
SQL operation
   │
   ▼
RLS / permissions
   │
   ▼
Database row

The important lesson:

«A successful network request does not mean the database operation was authorized.»

---

3. Connection Error vs Database Error

A major part of the investigation was learning to distinguish different classes of failure.

Connection failure

Examples:

Failed to fetch
Network error
Connection refused
Timeout

These usually indicate that the application could not successfully communicate with the backend.

Authentication failure

Examples:

Authentication required
Invalid JWT
Session expired
Unauthorized

These indicate that the request reached the authentication layer but the user's identity could not be established.

Database/RPC failure

Examples:

Lead is already claimed or does not exist

This is different.

The application successfully reached the database function and received a deliberate database exception.

Therefore:

«The existence of a specific PostgreSQL error strongly suggested that the request was getting much further into the system than a simple connection failure.»

---

4. PostgreSQL Functions / RPC

Supabase allows PostgreSQL database functions to be called remotely using RPC.

In Lead Forge:

claim_lead(uuid)

is a PostgreSQL function.

Supabase documentation:

- "Supabase Database Functions" (https://supabase.com/docs/guides/database/functions)
- "Supabase Database Overview" (https://supabase.com/docs/guides/database/overview)

A database function allows important data operations to happen inside PostgreSQL rather than relying entirely on frontend logic.

This is particularly useful for operations where correctness matters.

---

5. The Actual "claim_lead()" Function

The production database contained:

CREATE OR REPLACE FUNCTION public.claim_lead(p_lead_id uuid)
RETURNS leads
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  claimed_lead public.leads;
BEGIN

  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  UPDATE public.leads
  SET
    claimed_by = auth.uid(),
    claimed_at = now(),
    updated_at = now()
  WHERE id = p_lead_id
    AND claimed_by IS NULL
  RETURNING *
  INTO claimed_lead;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lead is already claimed or does not exist';
  END IF;

  RETURN claimed_lead;

END;
$function$;

The critical part is:

WHERE id = p_lead_id
  AND claimed_by IS NULL

This means:

«Update this exact lead, but only if it is currently unclaimed.»

---

6. Why This Is Atomic

The claim operation is deliberately performed as one database update:

UPDATE leads
SET claimed_by = auth.uid()
WHERE id = p_lead_id
  AND claimed_by IS NULL

This is important.

Imagine two agents click Claim at nearly the same time.

Both requests arrive:

Agent A → claim lead
Agent B → claim lead

The database evaluates:

claimed_by IS NULL

for the update.

Once one transaction successfully changes the row:

claimed_by = Agent A

the other operation can no longer satisfy:

claimed_by IS NULL

This is much safer than:

1. Check whether lead is unclaimed.
2. If unclaimed, update it.

because separate application-level checks can create race conditions.

PostgreSQL's "UPDATE ... RETURNING" also lets the operation return the row that was actually updated.

Reference:

- "PostgreSQL UPDATE" (https://www.postgresql.org/docs/current/sql-update.html)

---

7. Understanding "auth.uid()"

The function uses:

auth.uid()

This represents the authenticated user's UUID in the Supabase/PostgreSQL request context.

Conceptually:

Agent A logs in
       ↓
Supabase session
       ↓
Authenticated request
       ↓
auth.uid()
       ↓
Agent A's UUID

The claim function therefore does not receive the claiming user's ID from the frontend.

It gets the identity from the authenticated database request:

claimed_by = auth.uid()

This is an important security principle:

«Do not trust the client to tell the database which user they are.»

The authenticated context should establish identity.

---

8. Security Invoker vs Security Definer

The production function was:

security_definer = false

Therefore it operates as a security invoker.

That means the function runs using the permissions/security context of the user calling it rather than automatically using the function creator's privileges.

Supabase recommends understanding this distinction carefully.

Reference:

- "Supabase Database Functions — Security Invoker / Definer" (https://supabase.com/docs/guides/database/functions)

Important terminology:

SECURITY INVOKER
    ↓
Use caller's security context

SECURITY DEFINER
    ↓
Use function owner's security context

"SECURITY DEFINER" is powerful and should not be used casually because it can allow a function to operate with privileges the caller does not normally possess.

---

9. Row Level Security — RLS

The major discovery was PostgreSQL Row Level Security.

RLS allows the database to decide which rows a particular user is allowed to access or modify.

Supabase relies heavily on PostgreSQL RLS for application security.

Reference:

- "Supabase Row Level Security" (https://supabase.com/docs/guides/database/postgres/row-level-security)
- "PostgreSQL Row Security Policies" (https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- "PostgreSQL CREATE POLICY" (https://www.postgresql.org/docs/current/sql-createpolicy.html)

---

10. Lead Forge's Actual RLS Policy

The production "leads_update" policy was:

(
  (auth.uid() = created_by_id)
  OR
  (auth.uid() = claimed_by)
  OR
  (
    EXISTS (
      SELECT 1
      FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  )
)

In plain English:

An authenticated user can update a lead if:

They created it
        OR
They already claimed it
        OR
They are an admin

This is a deliberate authorization model.

---

11. The Important Interaction

Now put the two pieces together.

The claim function wants to do:

UPDATE public.leads
SET claimed_by = auth.uid()
WHERE id = p_lead_id
  AND claimed_by IS NULL;

But the normal update policy says:

You may UPDATE if:

you created the lead
OR
you already own the lead
OR
you are an admin

For an unclaimed lead:

claimed_by = NULL

a normal agent who did not create the lead does not satisfy:

auth.uid() = claimed_by

Therefore the normal RLS authorization model does not give that user general permission to modify another user's lead.

This is not necessarily a bug.

It is a security design decision.

---

12. Why the Error Was Misleading

The database function contains:

IF NOT FOUND THEN
  RAISE EXCEPTION 'Lead is already claimed or does not exist';
END IF;

That message combines two possibilities:

Lead doesn't exist
        OR
Lead isn't available for the UPDATE

The actual database state may therefore be:

Lead exists
claimed_by = NULL

while the attempted update still does not successfully modify the row.

This taught an important debugging lesson:

«An error message can describe the logical outcome of an operation without describing the underlying reason the operation failed.»

The message was not proof that the lead was actually already claimed.

---

13. "USING" and "WITH CHECK"

PostgreSQL RLS policies for "UPDATE" can involve two concepts:

"USING"

Controls which existing rows the user is allowed to operate on.

Conceptually:

Which existing rows can this user update?

"WITH CHECK"

Controls whether the resulting row is allowed after the update.

Conceptually:

Is the modified version of the row allowed?

The Lead Forge policy uses the same authorization expression for both.

PostgreSQL documentation:

- "CREATE POLICY — USING and WITH CHECK" (https://www.postgresql.org/docs/current/sql-createpolicy.html)

This distinction becomes extremely important when designing secure database applications.

---

14. Why the Lead Was Still Visible

Lead Forge's "SELECT" policy was:

true

for authenticated users.

Therefore authenticated agents can read the leads.

That creates an important distinction:

Can see lead?
        ≠
Can modify lead?

In Lead Forge:

SELECT
    authenticated users → yes

UPDATE
    creator → yes
    claimed owner → yes
    admin → yes
    unrelated agent → no

This is intentional access control.

---

15. The Bigger Security Lesson

A database application has multiple separate questions:

Authentication

«Who are you?»

Example:

auth.uid()

Authorization

«What are you allowed to do?»

Example:

created_by_id = auth.uid()

Data state

«What is currently true about the record?»

Example:

claimed_by IS NULL

Application logic

«What should happen when the operation is requested?»

Example:

claim_lead()

These are related, but they are not the same thing.

A user can be:

authenticated = YES

while still being:

authorized to perform this update = NO

---

16. The Debugging Method We Used

When the problem first appeared, several explanations were possible:

Frontend bug
API bug
Authentication bug
Connection problem
Database problem
RPC problem
RLS problem

Instead of changing code immediately, we inspected the system layer by layer.

Step 1 — Verify the function exists

SELECT
  p.oid::regprocedure AS function_signature
FROM pg_proc p
JOIN pg_namespace n
  ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'claim_lead';

Result:

claim_lead(uuid)

Step 2 — Inspect the function definition

SELECT
  p.oid::regprocedure AS function_signature,
  pg_get_functiondef(p.oid) AS definition
FROM pg_proc p
JOIN pg_namespace n
  ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'claim_lead';

This exposed the actual production SQL.

Step 3 — Inspect the table schema

Instead of assuming columns existed:

SELECT *
FROM public.leads
LIMIT 1;

This revealed the actual schema.

Step 4 — Find genuinely unclaimed leads

SELECT
  id,
  title,
  company_name,
  claimed_by,
  claimed_at,
  updated_at
FROM public.leads
WHERE claimed_by IS NULL
ORDER BY updated_at DESC
LIMIT 10;

This proved that unclaimed leads really existed.

Step 5 — Inspect RLS

SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'leads';

This exposed the authorization model.

PostgreSQL provides "pg_policies" specifically for inspecting policy definitions.

Reference:

- "PostgreSQL pg_policies" (https://www.postgresql.org/docs/current/view-pg-policies.html)

---

17. The Current Lead Forge Authorization Model

The investigation clarified the current design:

Operation| Creator| Claimed Owner| Admin| Other Agent
View lead| Yes| Yes| Yes| Yes
Edit own lead| Yes| Yes| Yes| No
Edit claimed lead| —| Yes| Yes| No
Delete own lead| Yes| —| Yes| No
Delete another user's lead| No| No| Yes| No
Claim another user's unclaimed lead| Currently restricted by RLS| —| Yes| Restricted

This is not something to change merely because a test exposed it.

The authorization model should first be decided intentionally.

---

18. What We Did NOT Change

No production database changes were made during this investigation.

We did not:

- weaken RLS;
- make the function "SECURITY DEFINER";
- grant additional permissions;
- modify the claim function;
- change the frontend;
- change the API;
- bypass authentication;
- change ownership rules.

This is an important engineering practice:

«Diagnose first. Change second.»

---

19. When This Becomes a Real Product Requirement

The current model is acceptable if the intended workflow is:

Agent creates lead
       ↓
Agent owns/works their lead

But if the intended workflow becomes:

Agent A creates lead
       ↓
Lead enters shared queue
       ↓
Agent B claims lead
       ↓
Agent B becomes owner

then the authorization model needs to explicitly support that workflow.

That should be a deliberate security decision rather than an accidental RLS modification.

Possible future architecture could involve a narrowly scoped claim mechanism rather than simply allowing every authenticated user to update every lead.

Do not implement that change until the desired workflow is confirmed.

---

20. Learning Path

The investigation touched several layers of software engineering.

Learn them in this order.

Level 1 — SQL Basics

Learn:

- "SELECT"
- "WHERE"
- "ORDER BY"
- "LIMIT"
- "UPDATE"
- "NULL"
- "AND" / "OR"
- UUIDs

Start with:

- "PostgreSQL SQL Tutorial" (https://www.postgresql.org/docs/current/tutorial.html)
- "PostgreSQL SELECT" (https://www.postgresql.org/docs/current/sql-select.html)
- "PostgreSQL UPDATE" (https://www.postgresql.org/docs/current/sql-update.html)
- "SQLBolt" (https://sqlbolt.com/)

---

Level 2 — Relational Databases

Learn:

- tables
- rows
- columns
- primary keys
- foreign keys
- relationships
- indexes
- constraints

Resources:

- "PostgreSQL Documentation" (https://www.postgresql.org/docs/current/)
- "Supabase Database Overview" (https://supabase.com/docs/guides/database/overview)

---

Level 3 — Authentication

Learn:

- authentication vs authorization
- sessions
- access tokens
- user IDs
- "auth.uid()"

Resources:

- "Supabase Auth" (https://supabase.com/docs/guides/auth)
- "Supabase Auth Architecture" (https://supabase.com/docs/guides/auth)

Core question:

Who is making this request?

---

Level 4 — Authorization

Learn:

- permissions
- roles
- ownership
- least privilege
- role-based access control

Core question:

What is this user allowed to do?

---

Level 5 — Row Level Security

Learn:

- RLS
- policies
- "USING"
- "WITH CHECK"
- "SELECT" policies
- "INSERT" policies
- "UPDATE" policies
- "DELETE" policies
- permissive vs restrictive policies

Resources:

- "Supabase RLS Guide" (https://supabase.com/docs/guides/database/postgres/row-level-security)
- "PostgreSQL Row Security" (https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- "PostgreSQL CREATE POLICY" (https://www.postgresql.org/docs/current/sql-createpolicy.html)

---

Level 6 — PostgreSQL Functions

Learn:

- SQL functions
- PL/pgSQL
- parameters
- return values
- "DECLARE"
- "BEGIN / END"
- "IF"
- "RAISE EXCEPTION"
- "RETURNING"

Resources:

- "Supabase Database Functions" (https://supabase.com/docs/guides/database/functions)
- "PL/pgSQL" (https://www.postgresql.org/docs/current/plpgsql.html)

---

Level 7 — RPC

Learn how an application can call a database function.

Conceptually:

Application
    ↓
RPC
    ↓
PostgreSQL function
    ↓
Database

Resource:

- "Supabase Database Functions / RPC" (https://supabase.com/docs/guides/database/functions)

---

Level 8 — Security Context

Learn:

SECURITY INVOKER
SECURITY DEFINER

Then learn why "SECURITY DEFINER" can be dangerous if implemented incorrectly.

Resources:

- "Supabase Database Functions — Security" (https://supabase.com/docs/guides/database/functions)
- "Supabase RLS — Security Definer Functions" (https://supabase.com/docs/guides/database/postgres/row-level-security)

---

Level 9 — Transactions and Race Conditions

Learn why this:

SELECT → check → UPDATE

can be less safe than performing the condition directly inside the update:

UPDATE leads
SET claimed_by = auth.uid()
WHERE id = ?
AND claimed_by IS NULL;

Study:

- transactions
- concurrency
- race conditions
- atomic operations
- isolation
- locks

Resources:

- "PostgreSQL Concurrency Control" (https://www.postgresql.org/docs/current/mvcc.html)
- "PostgreSQL Transaction Isolation" (https://www.postgresql.org/docs/current/transaction-iso.html)
- "PostgreSQL UPDATE" (https://www.postgresql.org/docs/current/sql-update.html)

---

21. The Mental Model to Keep

When debugging a modern database application, think:

                  ┌───────────────┐
                  │    USER       │
                  └───────┬───────┘
                          │
                          ▼
                  ┌───────────────┐
                  │  FRONTEND     │
                  └───────┬───────┘
                          │
                          ▼
                  ┌───────────────┐
                  │ API / tRPC    │
                  └───────┬───────┘
                          │
                          ▼
                  ┌───────────────┐
                  │ AUTH SESSION  │
                  └───────┬───────┘
                          │
                          ▼
                  ┌───────────────┐
                  │ PostgreSQL RPC│
                  └───────┬───────┘
                          │
                          ▼
                  ┌───────────────┐
                  │ SQL OPERATION │
                  └───────┬───────┘
                          │
                          ▼
                  ┌───────────────┐
                  │     RLS       │
                  └───────┬───────┘
                          │
                          ▼
                  ┌───────────────┐
                  │ DATABASE ROW  │
                  └───────────────┘

When something fails, don't immediately assume:

«"The code is broken."»

Ask:

1. Did the request leave the frontend?
2. Did the API receive it?
3. Was the user authenticated?
4. Which database function was called?
5. What SQL did the function actually execute?
6. What row did the SQL target?
7. What did the RLS policies allow?
8. What state was the database row actually in?
9. Was the operation atomic?
10. Was the resulting behaviour actually intended?

That sequence turns debugging from guessing into investigation.

---

22. Final Lesson

The most important lesson from this incident was not a particular SQL statement.

It was learning to distinguish:

WHAT THE APPLICATION WANTS TO DO

from:

WHAT THE DATABASE ALLOWS THE USER TO DO

Lead Forge's claim system sits at the intersection of:

Frontend
+
API
+
Authentication
+
PostgreSQL functions
+
SQL
+
RLS
+
Authorization
+
Concurrency

Understanding those layers makes database bugs much easier to reason about.

Diagnose the layer before changing the code.
