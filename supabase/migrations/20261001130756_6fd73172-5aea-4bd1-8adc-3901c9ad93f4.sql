CREATE TABLE public.customer_passwords (
  customer_id bigint PRIMARY KEY,
  password_hash text NOT NULL,
  salt text NOT NULL,
  failed_attempts integer NOT NULL DEFAULT 0,
  locked_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON public.customer_passwords FROM anon, authenticated;
GRANT ALL ON public.customer_passwords TO service_role;
ALTER TABLE public.customer_passwords ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role only" ON public.customer_passwords AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE TRIGGER trg_customer_passwords_updated BEFORE UPDATE ON public.customer_passwords FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();