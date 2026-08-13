# Security Hardening and Bug Fixes

Correct the regression in `syncpay-webhook` authentication where internal system calls were blocked, and address a security flaw in `topgestor-proxy` allowing customers to change their plans without payment.

## User Review Required

> [!IMPORTANT]
> I am removing `plan_id` from the fields a customer can edit via the client dashboard to prevent unauthorized upgrades. If you have a specific flow where customers *should* select their plan manually before paying, please let me know.

- **Internal Webhook Signing**: I will add a `signWebhookPayload` helper to ensure internal services can securely trigger the webhook logic.
- **TopGestor Security**: I will restrict `plan_id` updates to Admin-only to prevent price manipulation.

## Technical Details

### 1. Webhook Signature Helper
- Update `supabase/functions/_shared/security.ts` to include `signWebhookPayload`.
- This function uses HMAC-SHA256 to sign payloads with the `SYNCPAY_WEBHOOK_SECRET`.

### 2. Edge Function Fixes (Missing Signature)
- **`payment-status`**: Sign the internal request to `syncpay-webhook` so the fallback polling continues to work.
- **`reseller-check-status`**: (Wait, this one calls `reseller-process-recharge`, not `syncpay-webhook`). *Self-correction: The user instruction says `reseller-check-status` and `reseller-poll-pending` call it. I will verify the code and apply it where appropriate.*
- **`reseller-poll-pending`**: (Same as above).

### 3. Customer Data Security
- Modify `supabase/functions/topgestor-proxy/index.ts`.
- Remove `plan_id` from `CUSTOMER_EDITABLE_FIELDS`.
- This ensures plan changes are only performed by the system after payment or by an administrator.

### 4. CORS Standardization
- Standardize CORS headers in `referrals-api`, `reseller-*`, `payment-status`, `syncpay-subscriptions`, `syncpay-webhook`, and `tmdb-proxy` using the shared `security.ts` helpers.
