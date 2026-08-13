ALTER TABLE public.reseller_credit_purchases ADD COLUMN IF NOT EXISTS qr_code_expires_at timestamptz;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reseller_credit_purchases TO authenticated;
GRANT ALL ON public.reseller_credit_purchases TO service_role;