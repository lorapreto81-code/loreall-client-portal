
CREATE POLICY "Backend only access"
  ON public.syncpay_subscriptions FOR SELECT
  USING (false);
