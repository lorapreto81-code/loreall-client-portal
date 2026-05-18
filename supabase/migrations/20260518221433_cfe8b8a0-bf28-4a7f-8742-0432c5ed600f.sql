
ALTER TABLE public.reseller_links
  ADD COLUMN IF NOT EXISTS price_per_credit numeric(10,2) NOT NULL DEFAULT 11.00,
  ADD COLUMN IF NOT EXISTS min_credits integer NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS max_credits integer NOT NULL DEFAULT 30;

UPDATE public.reseller_links SET price_per_credit = 8.00 WHERE slug = 'bbjello';
UPDATE public.reseller_links SET price_per_credit = 11.00 WHERE slug IN ('lucasagapito','moneymaster');
