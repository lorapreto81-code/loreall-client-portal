GRANT SELECT ON public.syncpay_plans TO anon;
GRANT SELECT ON public.syncpay_plans TO authenticated;
GRANT ALL ON public.syncpay_plans TO service_role;

-- Se a RLS não estiver habilitada, habilitamos
ALTER TABLE public.syncpay_plans ENABLE ROW LEVEL SECURITY;

-- Removemos políticas antigas se existirem para evitar conflitos (opcional, mas seguro)
DROP POLICY IF EXISTS "Allow public read on active plans" ON public.syncpay_plans;

-- Criamos a política que permite leitura pública apenas de planos ativos
CREATE POLICY "Allow public read on active plans" 
ON public.syncpay_plans 
FOR SELECT 
TO anon, authenticated 
USING (status = 'active');