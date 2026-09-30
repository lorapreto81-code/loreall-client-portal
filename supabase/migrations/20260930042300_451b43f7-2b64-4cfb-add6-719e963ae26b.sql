CREATE TABLE public.discount_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  discount_type text NOT NULL DEFAULT 'percent',
  discount_value numeric NOT NULL,
  max_uses integer,
  valid_until timestamptz,
  one_per_customer boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.discount_codes TO service_role;
ALTER TABLE public.discount_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role only" ON public.discount_codes FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE TRIGGER trg_discount_codes_updated BEFORE UPDATE ON public.discount_codes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.discount_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  discount_code_id uuid NOT NULL REFERENCES public.discount_codes(id) ON DELETE CASCADE,
  customer_id bigint NOT NULL,
  payment_id uuid REFERENCES public.payments(id) ON DELETE SET NULL,
  original_amount numeric NOT NULL,
  discount_amount numeric NOT NULL,
  final_amount numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_discount_redemptions_code ON public.discount_redemptions(discount_code_id);
GRANT ALL ON public.discount_redemptions TO service_role;
ALTER TABLE public.discount_redemptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role only" ON public.discount_redemptions FOR ALL TO service_role USING (true) WITH CHECK (true);