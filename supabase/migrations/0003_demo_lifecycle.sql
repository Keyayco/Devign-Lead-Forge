-- FLOW v1.1: persist the demo lifecycle on the existing lead row.
-- Existing demo links are conservatively treated as READY, never SENT;
-- a link alone is not evidence that outreach occurred.
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS demo_status text NOT NULL DEFAULT 'none';

UPDATE public.leads
SET demo_status = 'ready'
WHERE demo_status = 'none'
  AND notes LIKE '%Demo Link:%';

ALTER TABLE public.leads
  DROP CONSTRAINT IF EXISTS leads_demo_status_check;

ALTER TABLE public.leads
  ADD CONSTRAINT leads_demo_status_check
  CHECK (demo_status IN ('none', 'building', 'ready', 'sent'));
