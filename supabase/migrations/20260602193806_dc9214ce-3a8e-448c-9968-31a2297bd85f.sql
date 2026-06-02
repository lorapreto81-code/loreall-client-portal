
CREATE POLICY "No public access" ON public.payments
  FOR SELECT TO anon, authenticated USING (false);

CREATE POLICY "No public access" ON public.referral_codes
  FOR SELECT TO anon, authenticated USING (false);

CREATE POLICY "No public access" ON public.referrals
  FOR SELECT TO anon, authenticated USING (false);

CREATE POLICY "No public access select" ON public.system_config
  FOR SELECT TO anon, authenticated USING (false);

CREATE POLICY "No public access select" ON public.warez_api_logs
  FOR SELECT TO anon, authenticated USING (false);

CREATE POLICY "No public access select" ON public.reseller_credit_purchases
  FOR SELECT TO anon, authenticated USING (false);
