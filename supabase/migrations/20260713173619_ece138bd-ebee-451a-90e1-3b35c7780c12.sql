CREATE TABLE public.confirmed_customer_emails (
  customer_id BIGINT PRIMARY KEY,
  email TEXT NOT NULL,
  confirmed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX confirmed_customer_emails_email_lower_idx
  ON public.confirmed_customer_emails (LOWER(email));

GRANT ALL ON public.confirmed_customer_emails TO service_role;

ALTER TABLE public.confirmed_customer_emails ENABLE ROW LEVEL SECURITY;

-- Sem policies para anon/authenticated: acesso apenas via edge functions com service_role.

CREATE TRIGGER trg_confirmed_customer_emails_updated_at
BEFORE UPDATE ON public.confirmed_customer_emails
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();