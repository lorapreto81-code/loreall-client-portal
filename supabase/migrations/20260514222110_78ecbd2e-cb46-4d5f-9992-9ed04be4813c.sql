-- Tabela de códigos únicos por cliente TopGestor
CREATE TABLE public.referral_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id bigint NOT NULL UNIQUE,
  customer_name text,
  code text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_referral_codes_code ON public.referral_codes(code);

ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;

-- Leitura pública (códigos não são sensíveis e clientes não têm auth.uid)
CREATE POLICY "Public can read referral codes"
  ON public.referral_codes FOR SELECT
  USING (true);

-- Tabela de indicações
CREATE TABLE public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_customer_id bigint NOT NULL,
  referred_customer_id bigint NOT NULL,
  referred_customer_name text,
  referred_payment_id uuid REFERENCES public.payments(id) ON DELETE SET NULL,
  referral_code text NOT NULL,
  bonus_days integer NOT NULL DEFAULT 30,
  status text NOT NULL DEFAULT 'pending_payment',
  -- pending_payment | pending_referrer_renewal | credited | rejected
  rejection_reason text,
  credited_at timestamptz,
  renewal_response jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (referred_customer_id, referrer_customer_id)
);

CREATE INDEX idx_referrals_referrer ON public.referrals(referrer_customer_id);
CREATE INDEX idx_referrals_referred ON public.referrals(referred_customer_id);
CREATE INDEX idx_referrals_status ON public.referrals(status);

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

-- Leitura pública (filtragem feita no edge function por customer_id)
CREATE POLICY "Public can read referrals"
  ON public.referrals FOR SELECT
  USING (true);

CREATE TRIGGER update_referrals_updated_at
  BEFORE UPDATE ON public.referrals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();