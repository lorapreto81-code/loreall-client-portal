ALTER TABLE public.referral_codes ADD COLUMN IF NOT EXISTS copy_count integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.increment_copy_count(p_code text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.referral_codes SET copy_count = copy_count + 1 WHERE code = p_code;
$$;

REVOKE ALL ON FUNCTION public.increment_copy_count(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_copy_count(text) TO service_role;