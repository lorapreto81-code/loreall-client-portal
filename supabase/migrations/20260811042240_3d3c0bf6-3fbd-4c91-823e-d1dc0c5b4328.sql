DROP VIEW IF EXISTS public.reseller_links_public;

GRANT SELECT (id, slug, display_name, credits, amount, price_per_credit, min_credits, max_credits, is_active)
ON public.reseller_links TO anon, authenticated;

CREATE POLICY "Public can view active reseller links"
ON public.reseller_links FOR SELECT
TO anon, authenticated
USING (is_active = true);