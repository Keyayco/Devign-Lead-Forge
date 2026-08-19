-- Backfill migration for databases created before Supabase Auth replaced Manus OAuth.
-- It is intentionally idempotent for fresh and existing Supabase projects.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'open_id'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'auth_user_id'
  ) THEN
    ALTER TABLE public.users RENAME COLUMN open_id TO auth_user_id;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_open_id_unique'
  ) THEN
    ALTER TABLE public.users DROP CONSTRAINT users_open_id_unique;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_auth_user_id_unique'
  ) THEN
    ALTER TABLE public.users ADD CONSTRAINT users_auth_user_id_unique UNIQUE (auth_user_id);
  END IF;
END $$;