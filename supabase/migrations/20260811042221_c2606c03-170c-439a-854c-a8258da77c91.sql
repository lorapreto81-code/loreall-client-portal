DROP POLICY IF EXISTS "Public can view active reseller links" ON public.reseller_links;
REVOKE SELECT ON public.reseller_links FROM anon, authenticated;
GRANT ALL ON public.reseller_links TO service_role;

CREATE OR REPLACE VIEW public.reseller_links_public
WITH (security_invoker = false) AS
SELECT id, slug, display_name, credits, amount, price_per_credit, min_credits, max_credits, is_active
FROM public.reseller_links
WHERE is_active = true;

GRANT SELECT ON public.reseller_links_public TO anon, authenticated;