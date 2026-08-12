const PRIMARY_ORIGIN = "https://cliente.loreallplay.com";
const ALLOWED_ORIGINS = [PRIMARY_ORIGIN];
const ALLOWED_ORIGIN_SUFFIXES = [".lovableproject.com", ".lovable.app"];

function isAllowedOrigin(origin: string): boolean {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  return ALLOWED_ORIGIN_SUFFIXES.some((suffix) => origin.endsWith(suffix));
}

export function corsHeadersFor(req?: Request): Record<string, string> {
  const origin = req?.headers.get("origin") || "";
  const allowOrigin = isAllowedOrigin(origin) ? origin : PRIMARY_ORIGIN;
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-customer-token, x-admin-password",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Vary": "Origin",
  };
}

export function securityHeadersFor(req?: Request): Record<string, string> {
  return {
    ...corsHeadersFor(req),
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "1; mode=block",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'; sandbox allow-scripts",
  };
}

// Fallback estático mantido por compatibilidade (resolve sempre para produção).
export const securityHeaders = securityHeadersFor();

export const jsonResponse = (
  body: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {},
  req?: Request,
) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...securityHeadersFor(req), ...extraHeaders, "Content-Type": "application/json" },
  });

export async function checkRateLimit(
  supabase: any,
  ip: string | null,
  action: string,
  limit = 10,
  windowMinutes = 60
) {
  if (!ip) return true;
  const since = new Date(Date.now() - windowMinutes * 60_000).toISOString();
  const { count } = await supabase
    .from("otp_codes")
    .select("id", { count: "exact", head: true })
    .eq("ip_address", ip)
    .gte("created_at", since);
  return (count ?? 0) < limit;
}
