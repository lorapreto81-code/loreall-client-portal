CREATE POLICY "Service role only" ON public.customer_overrides
FOR ALL TO service_role USING (true);
