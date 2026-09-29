CREATE TABLE public.customer_checkout_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id bigint NOT NULL,
  token text NOT NULL UNIQUE,
  customer_name text,
  is_active boolean NOT NULL DEFAULT true,
  use_count integer NOT NULL DEFAULT 0,
  last_used_at timestamptz,
  last_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX customer_checkout_links_active_uidx ON public.customer_checkout_links(customer_id) WHERE is_active;
GRANT ALL ON public.customer_checkout_links TO service_role;
ALTER TABLE public.customer_checkout_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Deny all public access" ON public.customer_checkout_links AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE TRIGGER trg_customer_checkout_links_updated BEFORE UPDATE ON public.customer_checkout_links FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();