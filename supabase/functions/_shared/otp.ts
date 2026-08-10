// Shared OTP helpers: code generation and hashing.

const encoder = new TextEncoder();

export function generateOtpCode(): string {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return String(buf[0] % 1_000_000).padStart(6, "0");
}

/** Hashes the code with the session secret so plain codes are never stored. */
export async function hashOtp(code: string, phone: string): Promise<string> {
  const secret = Deno.env.get("CUSTOMER_SESSION_SECRET");
  if (!secret) throw new Error("CUSTOMER_SESSION_SECRET not configured");
  const data = encoder.encode(`${secret}:${phone}:${code}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export const onlyDigits = (s: string) => s.replace(/\D/g, "");

/** Last 10 digits — used to match numbers regardless of country code (e.g. 5583... vs 83...).
 * Brazilian numbers are 10 or 11 digits (DDD + number). 10 is enough to be unique within a reasonable scope.
 */
export const phoneKey = (s: string) => onlyDigits(s).slice(-10);
