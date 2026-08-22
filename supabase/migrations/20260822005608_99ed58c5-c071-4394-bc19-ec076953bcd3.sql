ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reseller_credit_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.syncpay_subscriptions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.referral_codes FROM anon, authenticated;
REVOKE ALL ON public.reseller_credit_adjustments FROM anon, authenticated;
REVOKE ALL ON public.syncpay_subscriptions FROM anon, authenticated;

GRANT ALL ON public.referral_codes TO service_role;
GRANT ALL ON public.reseller_credit_adjustments TO service_role;
GRANT ALL ON public.syncpay_subscriptions TO service_role;

DROP POLICY IF EXISTS "Deny all public access" ON public.referral_codes;
CREATE POLICY "Deny all public access" ON public.referral_codes AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "Deny all public access" ON public.reseller_credit_adjustments;
CREATE POLICY "Deny all public access" ON public.reseller_credit_adjustments AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "Deny all public access" ON public.syncpay_subscriptions;
CREATE POLICY "Deny all public access" ON public.syncpay_subscriptions AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);