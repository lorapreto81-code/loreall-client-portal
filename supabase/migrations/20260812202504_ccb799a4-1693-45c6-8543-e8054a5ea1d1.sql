ALTER TABLE public.reseller_links ADD COLUMN IF NOT EXISTS whatsapp text;
COMMENT ON COLUMN public.reseller_links.whatsapp IS 'WhatsApp number for reseller authentication (OTP)';
GRANT SELECT (whatsapp) ON public.reseller_links TO service_role;