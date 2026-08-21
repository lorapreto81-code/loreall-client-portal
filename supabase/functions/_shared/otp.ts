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

/** Classifies a login identifier: WhatsApp number, e-mail or IPTV username. */
export function classifyIdentifier(raw: string) {
  const input = String(raw || "").trim();
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input);
  const digits = onlyDigits(input);
  // Anything with letters (or too short to be a phone) is treated as e-mail/username.
  const isTextual = isEmail || /[a-zA-Z]/.test(input) || digits.length < 8;
  const key = isTextual ? input.toLowerCase() : phoneKey(digits);
  return { input, isEmail, digits, isTextual, key };
}

/** Matches a TopGestor customer against a phone / e-mail / username key. */
export function customerMatchesIdentifier(
  c: Record<string, unknown>,
  key: string,
  isTextual: boolean,
): boolean {
  if (isTextual) {
    const localPart = key.split("@")[0];
    const usuario = String(c.usuario ?? c.username ?? c.login ?? "").toLowerCase().trim();
    if (usuario && (usuario === key || usuario === localPart)) return true;
    const cEmail = String(c.email ?? "").toLowerCase().trim();
    if (cEmail && (cEmail === key || (localPart.length >= 3 && cEmail.includes(localPart)))) return true;
    const cName = String(c.name ?? "").toLowerCase().trim();
    if (localPart.length >= 3 && cName.includes(localPart)) return true;
    return false;
  }
  const phoneFields = [c.whatsapp, c.celular, c.phone, c.telefone, c.whatsapp_c];
  return phoneFields
    .filter(Boolean)
    .map((v) => phoneKey(String(v)))
    .some((p) => p === key);
}
