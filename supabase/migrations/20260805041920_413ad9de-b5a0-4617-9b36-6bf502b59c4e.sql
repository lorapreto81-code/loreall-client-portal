ALTER TABLE public.confirmed_customer_emails ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.confirmed_customer_emails FROM anon, authenticated;
GRANT ALL ON public.confirmed_customer_emails TO service_role;
DROP POLICY IF EXISTS "Deny all public access" ON public.confirmed_customer_emails;
CREATE POLICY "Deny all public access" ON public.confirmed_customer_emails AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS "No public access select" ON public.confirmed_customer_emails;
CREATE POLICY "No public access select" ON public.confirmed_customer_emails FOR SELECT TO anon, authenticated USING (false);