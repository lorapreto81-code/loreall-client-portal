CREATE TABLE public.otp_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  customer_id bigint,
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  consumed_at timestamptz,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.otp_codes TO service_role;

ALTER TABLE public.otp_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Deny all public access" ON public.otp_codes AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

CREATE INDEX idx_otp_codes_phone_created ON public.otp_codes (phone, created_at DESC);

CREATE TRIGGER trg_otp_codes_updated_at BEFORE UPDATE ON public.otp_codes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();