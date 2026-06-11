
INSERT INTO public.system_config (config_key, config_value) VALUES
  ('pix_provider_customers', 'fastdepix'),
  ('pix_provider_resellers', 'fastdepix'),
  ('syncpay_api_url', 'https://api.syncpay.pro')
ON CONFLICT (config_key) DO NOTHING;

ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'fastdepix';
ALTER TABLE public.reseller_credit_purchases ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'fastdepix';

CREATE INDEX IF NOT EXISTS idx_payments_provider ON public.payments(provider);
CREATE INDEX IF NOT EXISTS idx_reseller_purchases_provider ON public.reseller_credit_purchases(provider);
