CREATE TABLE public.email_reminder_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id bigint NOT NULL,
  due_date date NOT NULL,
  kind text NOT NULL,
  email text,
  status text NOT NULL DEFAULT 'sent',
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (customer_id, due_date, kind)
);
GRANT ALL ON public.email_reminder_log TO service_role;
ALTER TABLE public.email_reminder_log ENABLE ROW LEVEL SECURITY;
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;