-- Reseller links (public catalog)
CREATE TABLE public.reseller_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  warez_username text NOT NULL,
  warez_user_id integer NOT NULL,
  display_name text NOT NULL,
  credits integer NOT NULL,
  amount numeric(10,2) NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Purchases / recharges
CREATE TABLE public.reseller_credit_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reseller_link_id uuid REFERENCES public.reseller_links(id) ON DELETE SET NULL,
  warez_username text NOT NULL,
  warez_user_id integer NOT NULL,
  whatsapp text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  package_credits integer NOT NULL,
  amount numeric(10,2) NOT NULL,
  fastdepix_transaction_id bigint,
  qr_code_text text,
  qr_code_url text,
  qr_code_expires_at timestamptz,
  status text NOT NULL DEFAULT 'pending',
  paid_at timestamptz,
  recharge_status text NOT NULL DEFAULT 'pending',
  recharged_at timestamptz,
  warez_response jsonb,
  error_message text,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_rcp_status ON public.reseller_credit_purchases (status, recharge_status);
CREATE INDEX idx_rcp_fdtx ON public.reseller_credit_purchases (fastdepix_transaction_id);
CREATE INDEX idx_rcp_created ON public.reseller_credit_purchases (created_at DESC);
CREATE INDEX idx_rcp_link ON public.reseller_credit_purchases (reseller_link_id);

-- System config
CREATE TABLE public.system_config (
  config_key text PRIMARY KEY,
  config_value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.system_config (config_key, config_value) VALUES
  ('warez_api_url',   'https://wpainel.exemplo.com/api'),
  ('warez_api_token', 'COLE_SEU_TOKEN_AQUI'),
  ('credit_cost_brl', '8.00');

-- WAREZ logs
CREATE TABLE public.warez_api_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint text NOT NULL,
  method text NOT NULL DEFAULT 'POST',
  request_body jsonb NOT NULL DEFAULT '{}',
  response_status integer NOT NULL DEFAULT 0,
  response_body text NOT NULL DEFAULT '',
  duration_ms integer NOT NULL DEFAULT 0,
  error text,
  related_payment_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_warez_logs_created ON public.warez_api_logs (created_at DESC);

-- Triggers updated_at
CREATE TRIGGER trg_reseller_links_updated
  BEFORE UPDATE ON public.reseller_links
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_reseller_purchases_updated
  BEFORE UPDATE ON public.reseller_credit_purchases
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.reseller_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reseller_credit_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warez_api_logs ENABLE ROW LEVEL SECURITY;

-- Public can read active reseller links (needed for /revendedor/:slug)
CREATE POLICY "Public can view active reseller links"
  ON public.reseller_links FOR SELECT
  USING (is_active = true);

-- No public access to purchases, system_config, warez_api_logs.
-- All writes/admin reads go through service_role in edge functions.

-- Seed initial resellers
INSERT INTO public.reseller_links (slug, warez_username, warez_user_id, display_name, credits, amount) VALUES
  ('lucasagapito', 'LucasAgapito', 16068, 'Lucas Agapito', 10, 110.00),
  ('moneymaster',  'MoneyMaster',  14844, 'Money Master',  10, 110.00),
  ('bbjello',      'bbjello',       9421, 'bbjello',       10,  80.00);