ALTER TABLE public.reseller_credit_purchases ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.reseller_credit_purchases FROM anon, authenticated;
