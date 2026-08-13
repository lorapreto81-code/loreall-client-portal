-- Revoke public access to reseller_links
REVOKE SELECT ON public.reseller_links FROM anon, authenticated;

-- Drop the permissive policy that allowed listing all resellers
DROP POLICY IF EXISTS "Public can view active reseller links" ON public.reseller_links;

-- Note: The service_role still has access, which is what the Edge Function uses.
-- We don't add new RLS policies for anon/auth because they should only access via the function now.