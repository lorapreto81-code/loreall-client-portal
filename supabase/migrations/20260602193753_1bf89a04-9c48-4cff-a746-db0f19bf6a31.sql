
-- Payments: remove public read
DROP POLICY IF EXISTS "Public can read payment by id" ON public.payments;

-- Referral codes: remove public read
DROP POLICY IF EXISTS "Public can read referral codes" ON public.referral_codes;

-- Referrals: remove public read
DROP POLICY IF EXISTS "Public can read referrals" ON public.referrals;

-- Explicit deny-all on system_config (RLS already enabled; make intent explicit)
DROP POLICY IF EXISTS "Deny all public access" ON public.system_config;
CREATE POLICY "Deny all public access" ON public.system_config
  AS RESTRICTIVE FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

-- Explicit deny-all on warez_api_logs
DROP POLICY IF EXISTS "Deny all public access" ON public.warez_api_logs;
CREATE POLICY "Deny all public access" ON public.warez_api_logs
  AS RESTRICTIVE FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

-- Explicit deny-all on reseller_credit_purchases (already no policies, but make explicit)
DROP POLICY IF EXISTS "Deny all public access" ON public.reseller_credit_purchases;
ALTER TABLE public.reseller_credit_purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Deny all public access" ON public.reseller_credit_purchases
  AS RESTRICTIVE FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

-- Remove tables from realtime publication so row changes are not broadcast
ALTER PUBLICATION supabase_realtime DROP TABLE public.payments;
ALTER PUBLICATION supabase_realtime DROP TABLE public.reseller_credit_purchases;
