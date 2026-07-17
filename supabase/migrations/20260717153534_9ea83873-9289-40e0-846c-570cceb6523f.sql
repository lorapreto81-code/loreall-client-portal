
CREATE UNIQUE INDEX IF NOT EXISTS payments_provider_tx_uniq
  ON public.payments (provider_transaction_id)
  WHERE provider_transaction_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS reseller_purchases_provider_tx_uniq
  ON public.reseller_credit_purchases (provider_transaction_id)
  WHERE provider_transaction_id IS NOT NULL;
