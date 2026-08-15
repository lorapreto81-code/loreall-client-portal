ALTER TABLE public.otp_codes ADD COLUMN IF NOT EXISTS matched_customer_ids jsonb NOT NULL DEFAULT '[]'::jsonb;
