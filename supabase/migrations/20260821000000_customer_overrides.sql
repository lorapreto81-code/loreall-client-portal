CREATE TABLE public.customer_overrides (
    customer_id integer PRIMARY KEY,
    telas_override integer,
    notes text,
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.customer_overrides ENABLE ROW LEVEL SECURITY;

-- No policies for anon/authenticated roles: strictly service_role only.
GRANT ALL ON public.customer_overrides TO service_role;
