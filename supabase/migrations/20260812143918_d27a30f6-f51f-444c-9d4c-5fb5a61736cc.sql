-- Incremental schema for SyncPay subscription events. Existing rows are preserved.
ALTER TABLE public.syncpay_subscriptions
  ADD COLUMN IF NOT EXISTS syncpay_status text,
  ADD COLUMN IF NOT EXISTS access_status text,
  ADD COLUMN IF NOT EXISTS mandate_id text,
  ADD COLUMN IF NOT EXISTS mandate_status text,
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS overdue_since timestamptz,
  ADD COLUMN IF NOT EXISTS suspended_at timestamptz,
  ADD COLUMN IF NOT EXISTS retry_count integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.syncpay_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dedupe_key text NOT NULL UNIQUE,
  event text NOT NULL,
  subscription_token text,
  plan_token text,
  occurred_at timestamptz,
  payload jsonb NOT NULL,
  processing_status text NOT NULL DEFAULT 'received',
  processing_error text,
  attempts integer NOT NULL DEFAULT 0,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS syncpay_webhook_events_subscription_idx
  ON public.syncpay_webhook_events (subscription_token, created_at DESC);
GRANT ALL ON public.syncpay_webhook_events TO service_role;
ALTER TABLE public.syncpay_webhook_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Deny public SyncPay webhook events" ON public.syncpay_webhook_events;
CREATE POLICY "Deny public SyncPay webhook events" ON public.syncpay_webhook_events
  AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);