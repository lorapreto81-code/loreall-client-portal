CREATE TABLE public.area_plan_mapping (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  servidor text NOT NULL,
  telas integer NOT NULL,
  periodicidade text NOT NULL,
  topgestor_plan_id bigint NOT NULL,
  display_name text NOT NULL,
  base_amount numeric(10,2) NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (servidor, telas, periodicidade)
);

GRANT ALL ON public.area_plan_mapping TO service_role;

ALTER TABLE public.area_plan_mapping ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Deny all public access"
ON public.area_plan_mapping
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_area_plan_mapping_updated_at
BEFORE UPDATE ON public.area_plan_mapping
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.area_plan_mapping (servidor, telas, periodicidade, topgestor_plan_id, display_name, base_amount) VALUES
  ('warez', 3, 'mensal', 72836, 'Mensal · 3 Telas', 30.00),
  ('warez', 3, 'trimestral', 72837, 'Trimestral · 3 Telas', 79.90),
  ('warez', 3, 'semestral', 72838, 'Semestral · 3 Telas', 149.90),
  ('warez', 3, 'anual', 21290, 'Anual · 3 Telas', 229.90),
  ('uniplay_iptv', 3, 'mensal', 72836, 'Mensal · 3 Telas', 30.00),
  ('uniplay_iptv', 3, 'trimestral', 72837, 'Trimestral · 3 Telas', 79.90),
  ('uniplay_iptv', 3, 'semestral', 72838, 'Semestral · 3 Telas', 149.90),
  ('uniplay_iptv', 3, 'anual', 21290, 'Anual · 3 Telas', 229.90)
ON CONFLICT (servidor, telas, periodicidade) DO UPDATE SET
  topgestor_plan_id = EXCLUDED.topgestor_plan_id,
  display_name = EXCLUDED.display_name,
  base_amount = EXCLUDED.base_amount;