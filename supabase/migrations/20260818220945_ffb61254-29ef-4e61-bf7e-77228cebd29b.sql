-- Deny-all restrictive policies + revoke Data API grants for backend-only tables
REVOKE ALL ON public.referral_tier_config FROM anon, authenticated;
REVOKE ALL ON public.reseller_links FROM anon, authenticated;
REVOKE ALL ON public.reseller_signups FROM anon, authenticated;
GRANT ALL ON public.referral_tier_config TO service_role;
GRANT ALL ON public.reseller_links TO service_role;
GRANT ALL ON public.reseller_signups TO service_role;

DROP POLICY IF EXISTS "Deny all public access" ON public.referral_tier_config;
CREATE POLICY "Deny all public access" ON public.referral_tier_config AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "Deny all public access" ON public.reseller_links;
CREATE POLICY "Deny all public access" ON public.reseller_links AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "Deny all public access" ON public.reseller_signups;
CREATE POLICY "Deny all public access" ON public.reseller_signups AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);