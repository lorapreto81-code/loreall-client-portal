const baseCors: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-customer-token, x-admin-password",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
};

/**
 * Enhanced security headers for all API responses.
 */
export const securityHeaders = {
  ...baseCors,
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'; sandbox allow-scripts",
};


/**
 * Standard JSON response helper with security headers.
 */
export const jsonResponse = (body: unknown, status = 200, extraHeaders = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...securityHeaders,
      ...extraHeaders,
      "Content-Type": "application/json",
    },
  });

/**
 * Simple IP-based rate limiting using Supabase.
 * Requires a table 'ip_rate_limits' or similar.
 */
export async function checkRateLimit(
  supabase: any,
  ip: string | null,
  action: string,
  limit = 10,
  windowMinutes = 60
) {
  if (!ip) return true; // Fail open if IP not detected? Or fail closed? Usually fail open for IP detection issues.

  const since = new Date(Date.now() - windowMinutes * 60_000).toISOString();
  
  // Reuse otp_codes table if appropriate, or a generic audit table.
  // For now, we'll check otp_codes as it already tracks IP.
  const { count } = await supabase
    .from("otp_codes")
    .select("id", { count: "exact", head: true })
    .eq("ip_address", ip)
    .gte("created_at", since);

  return (count ?? 0) < limit;
}
