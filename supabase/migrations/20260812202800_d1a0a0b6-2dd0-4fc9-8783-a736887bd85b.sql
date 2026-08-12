ALTER TABLE public.otp_codes ADD COLUMN IF NOT EXISTS reseller_id uuid REFERENCES public.reseller_links(id);
GRANT SELECT (reseller_id) ON public.otp_codes TO service_role;
GRANT INSERT (reseller_id) ON public.otp_codes TO service_role;
GRANT UPDATE (reseller_id) ON public.otp_codes TO service_role;