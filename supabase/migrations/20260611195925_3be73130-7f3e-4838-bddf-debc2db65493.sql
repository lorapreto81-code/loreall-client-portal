
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS provider_transaction_id TEXT;
ALTER TABLE public.reseller_credit_purchases ADD COLUMN IF NOT EXISTS provider_transaction_id TEXT;
CREATE INDEX IF NOT EXISTS idx_payments_provider_tx ON public.payments(provider_transaction_id) WHERE provider_transaction_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_reseller_purchases_provider_tx ON public.reseller_credit_purchases(provider_transaction_id) WHERE provider_transaction_id IS NOT NULL;
