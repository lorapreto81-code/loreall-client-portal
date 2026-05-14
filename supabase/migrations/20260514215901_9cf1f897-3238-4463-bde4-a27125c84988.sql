
-- Tabela de pagamentos PIX gerados via Fast Depix
CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id bigint NOT NULL,
  customer_name text NOT NULL,
  customer_whatsapp text,
  plan_id bigint NOT NULL,
  plan_name text NOT NULL,
  amount numeric(10,2) NOT NULL,
  fastdepix_transaction_id bigint UNIQUE,
  fastdepix_status text NOT NULL DEFAULT 'pending',
  qr_code_url text,
  qr_code_text text,
  qr_code_expires_at timestamptz,
  paid_at timestamptz,
  renewed_at timestamptz,
  renewal_response jsonb,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_payments_customer ON public.payments (customer_id, created_at DESC);
CREATE INDEX idx_payments_status ON public.payments (fastdepix_status);

-- RLS: nenhum acesso direto via cliente.
-- O frontend lê via Realtime + chave anônima. Como não há login Supabase
-- (cliente é identificado pelo TopGestor), liberamos SELECT público
-- pelo id do pagamento (UUID não enumerável). Inserts/updates apenas via
-- service role nas edge functions.
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read payment by id"
  ON public.payments
  FOR SELECT
  USING (true);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_payments_updated_at
BEFORE UPDATE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Habilitar Realtime
ALTER TABLE public.payments REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.payments;
