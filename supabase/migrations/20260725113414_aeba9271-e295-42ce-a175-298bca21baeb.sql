CREATE TABLE public.reseller_credit_adjustments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reseller_link_id UUID NOT NULL REFERENCES public.reseller_links(id) ON DELETE CASCADE,
  delta INTEGER NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  applied_purchase_id UUID REFERENCES public.reseller_credit_purchases(id),
  applied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_rca_link_status ON public.reseller_credit_adjustments(reseller_link_id, status);

GRANT ALL ON public.reseller_credit_adjustments TO service_role;

ALTER TABLE public.reseller_credit_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON public.reseller_credit_adjustments
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TRIGGER update_rca_updated_at
  BEFORE UPDATE ON public.reseller_credit_adjustments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Registra o débito de -10 do MoneyMaster (recarga duplicada em 22/07 - compra 476b6be9)
INSERT INTO public.reseller_credit_adjustments (reseller_link_id, delta, reason)
VALUES (
  '81ce6434-d9bf-458b-8aae-0d1598c5d86f',
  -10,
  'Débito de 10 créditos extras enviados por engano na recarga de 22/07/2026 (compra 476b6be9 - PATCH duplicado no painel Warez).'
);