-- Revoke accidental SELECT grant to authenticated users on reseller_signups
-- to ensure maximum security for stored plaintext desired_password.
REVOKE SELECT ON public.reseller_signups FROM authenticated;
