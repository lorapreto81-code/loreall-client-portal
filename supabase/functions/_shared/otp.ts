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

/** Removes international dial prefixes (00 / +) and leading zeros. */
export function normalizePhoneDigits(s: string): string {
  return onlyDigits(String(s || "")).replace(/^0+/, "");
}

/**
 * Stable key for a phone number, tolerant to country codes.
 * Brazilian numbers keep the legacy behaviour (last 10 digits);
 * foreign numbers keep their full digits (with country code) so that
 * e.g. +351 937 453 826 is not confused with a Brazilian number.
 */
export const phoneKey = (s: string) => {
  const d = normalizePhoneDigits(s);
  if (d.startsWith("55") && (d.length === 12 || d.length === 13)) return d.slice(-10);
  if (d.length <= 11) return d.slice(-10) || d;
  return d;
};

/** Brazilian numbers may or may not carry the extra "9" — normalize to 8-digit tail. */
function brTail8(d: string): string {
  const tail9 = d.slice(-9);
  if (d.length >= 11 && tail9.startsWith("9")) return d.slice(-8);
  return d.slice(-8);
}

/**
 * Compares two phone numbers written in any format / country.
 * Matches by the longest common significant suffix (min 8 digits),
 * so "937453826" matches "+351 937 453 826" and "83985591952" matches "5583985591952".
 */
export function phoneMatches(a: string, b: string): boolean {
  const x = normalizePhoneDigits(a);
  const y = normalizePhoneDigits(b);
  if (!x || !y) return false;
  if (x === y) return true;

  const n = Math.min(x.length, y.length, 11);
  if (n < 8) return false;
  if (x.slice(-n) === y.slice(-n)) return true;

  // Brazilian 9th-digit tolerance
  return brTail8(x) === brTail8(y) && x.slice(-10, -8) === y.slice(-10, -8);
}

/** Classifies a login identifier: WhatsApp number, e-mail or IPTV username. */
export function classifyIdentifier(raw: string) {
  const input = String(raw || "").trim();
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input);
  const digits = normalizePhoneDigits(input);
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
    const usuario = String(c.usuario ?? c.username ?? c.login ?? "").toLowerCase().trim();
    if (usuario && usuario === key) return true;
    const cEmail = String(c.email ?? "").toLowerCase().trim();
    if (cEmail && cEmail === key) return true;
    return false;
  }
  const phoneFields = [c.whatsapp, c.celular, c.phone, c.telefone, c.whatsapp_c];
  return phoneFields
    .filter(Boolean)
    .some((v) => phoneMatches(String(v), key));
}
