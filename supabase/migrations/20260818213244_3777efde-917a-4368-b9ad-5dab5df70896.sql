CREATE TABLE public.referral_tier_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  min_referrals integer NOT NULL,
  bonus_days integer NOT NULL,
  bonus_description text,
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (min_referrals)
);

GRANT ALL ON public.referral_tier_config TO service_role;

INSERT INTO public.referral_tier_config (min_referrals, bonus_days, bonus_description, is_active)
VALUES (1, 30, 'Bônus padrão por indicação (comportamento atual)', true);

ALTER TABLE public.referral_tier_config ENABLE ROW LEVEL SECURITY;
-- Sem policy pra anon/authenticated: só admin/service role mexe nisso por enquanto.