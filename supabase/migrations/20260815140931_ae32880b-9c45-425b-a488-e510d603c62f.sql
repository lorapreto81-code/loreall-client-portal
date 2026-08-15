CREATE TABLE public.reseller_signups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  desired_username text NOT NULL,
  desired_password text NOT NULL,
  whatsapp text NOT NULL,
  credits integer NOT NULL,
  amount numeric(10,2) NOT NULL,
  status text NOT NULL DEFAULT 'pending_payment',
  qr_code_url text,
  qr_code_text text,
  qr_code_expires_at timestamptz,
  fastdepix_transaction_id text,
  warez_user_id text,
  reseller_link_id uuid REFERENCES public.reseller_links(id),
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

GRANT SELECT, INSERT, UPDATE ON public.reseller_signups TO service_role;
GRANT SELECT ON public.reseller_signups TO authenticated;

ALTER TABLE public.reseller_signups ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_reseller_signups_status ON public.reseller_signups (status, created_at DESC);
CREATE INDEX idx_reseller_signups_txn ON public.reseller_signups (fastdepix_transaction_id);