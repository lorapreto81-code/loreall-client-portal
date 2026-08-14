ALTER TABLE public.trial_signups ADD COLUMN IF NOT EXISTS trial_hours integer;
COMMENT ON COLUMN public.trial_signups.trial_hours IS 'Selected trial duration in hours at approval time';