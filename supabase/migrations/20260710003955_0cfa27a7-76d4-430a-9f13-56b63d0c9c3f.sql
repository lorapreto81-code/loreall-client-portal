
CREATE TABLE public.syncpay_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  syncpay_plan_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  amount NUMERIC(10,2) NOT NULL,
  periodicity_days INTEGER NOT NULL DEFAULT 30,
  billing_advance_days INTEGER DEFAULT 3,
  grace_period_days INTEGER DEFAULT 5,
  max_retry_attempts INTEGER DEFAULT 3,
  billing_method TEXT NOT NULL DEFAULT 'qr_code',
  status TEXT NOT NULL DEFAULT 'active',
  checkout_url TEXT,
  topgestor_plan_id INTEGER,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.syncpay_plans TO anon, authenticated;
GRANT ALL ON public.syncpay_plans TO service_role;
ALTER TABLE public.syncpay_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view active plans"
  ON public.syncpay_plans FOR SELECT
  USING (status = 'active');

CREATE TRIGGER update_syncpay_plans_updated_at
  BEFORE UPDATE ON public.syncpay_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.syncpay_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  syncpay_subscription_id TEXT NOT NULL UNIQUE,
  syncpay_plan_id TEXT NOT NULL,
  customer_id INTEGER,
  customer_name TEXT,
  customer_email TEXT,
  customer_cpf TEXT,
  customer_phone TEXT,
  billing_method TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  next_charge_at TIMESTAMPTZ,
  last_charge_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.syncpay_subscriptions TO authenticated;
GRANT ALL ON public.syncpay_subscriptions TO service_role;
ALTER TABLE public.syncpay_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_syncpay_subs_customer ON public.syncpay_subscriptions(customer_id);
CREATE INDEX idx_syncpay_subs_plan ON public.syncpay_subscriptions(syncpay_plan_id);

CREATE TRIGGER update_syncpay_subs_updated_at
  BEFORE UPDATE ON public.syncpay_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS charge_id TEXT;

CREATE INDEX IF NOT EXISTS idx_payments_subscription ON public.payments(subscription_id);
