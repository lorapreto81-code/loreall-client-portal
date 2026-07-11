
CREATE TABLE public.trial_signups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  referral_code TEXT NOT NULL,
  referrer_customer_id BIGINT NOT NULL,
  referrer_customer_name TEXT,
  name TEXT NOT NULL,
  whatsapp TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  topgestor_customer_id BIGINT,
  usuario TEXT,
  password TEXT,
  plan_id BIGINT,
  trial_days INTEGER,
  rejection_reason TEXT,
  approved_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  approved_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT trial_signups_status_check CHECK (status IN ('pending', 'approved', 'rejected'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trial_signups TO authenticated;
GRANT ALL ON public.trial_signups TO service_role;

ALTER TABLE public.trial_signups ENABLE ROW LEVEL SECURITY;

-- Access is controlled exclusively through the referrals-api edge function (service role).
-- We deny all direct access from clients — the edge function uses service role and bypasses RLS.
CREATE POLICY "Deny all direct client access"
  ON public.trial_signups
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- Prevent duplicate signups for the same WhatsApp while pending or approved
CREATE UNIQUE INDEX trial_signups_whatsapp_active_uniq
  ON public.trial_signups (whatsapp)
  WHERE status IN ('pending', 'approved');

CREATE INDEX trial_signups_status_created_idx
  ON public.trial_signups (status, created_at DESC);

CREATE INDEX trial_signups_referral_code_idx
  ON public.trial_signups (referral_code);

CREATE TRIGGER update_trial_signups_updated_at
  BEFORE UPDATE ON public.trial_signups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
