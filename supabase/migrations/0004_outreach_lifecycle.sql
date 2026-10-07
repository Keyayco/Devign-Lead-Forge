-- FLOW v1.2: persist explicit outreach workflow state on the existing lead row.
-- Existing rows have no reliable outreach history, so they remain not_started.
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS outreach_status text NOT NULL DEFAULT 'not_started';

ALTER TABLE public.leads
  DROP CONSTRAINT IF EXISTS leads_outreach_status_check;

ALTER TABLE public.leads
  ADD CONSTRAINT leads_outreach_status_check
  CHECK (outreach_status IN ('not_started', 'contacted', 'responded', 'follow_up'));
