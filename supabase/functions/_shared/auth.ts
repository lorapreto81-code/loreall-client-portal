// Shared auth helpers: admin password (server-side secret) + signed customer sessions.

const encoder = new TextEncoder();

function b64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string): Uint8Array {
  const pad = s.replace(/-/g, "+").replace(/_/g, "/");
  const str = atob(pad + "=".repeat((4 - (pad.length % 4)) % 4));
  return Uint8Array.from(str, (c) => c.charCodeAt(0));
}

async function key(): Promise<CryptoKey> {
  const secret = Deno.env.get("CUSTOMER_SESSION_SECRET");
  if (!secret) throw new Error("CUSTOMER_SESSION_SECRET not configured");
  return await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export interface CustomerSession {
  sub: number; // customer id
  exp: number; // epoch seconds
}

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

export async function signCustomerToken(customerId: number): Promise<string> {
  const payload: CustomerSession = {
    sub: customerId,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  };
  const body = b64url(encoder.encode(JSON.stringify(payload)));
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", await key(), encoder.encode(body)));
  return `${body}.${b64url(sig)}`;
}

export async function verifyCustomerToken(token: string | null): Promise<CustomerSession | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  try {
    const ok = await crypto.subtle.verify("HMAC", await key(), b64urlDecode(sig), encoder.encode(body));
    if (!ok) return null;
    const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(body))) as CustomerSession;
    if (!payload?.sub || !payload?.exp) return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

/** Reads the customer session from the x-customer-token header. */
export async function getCustomerSession(req: Request): Promise<CustomerSession | null> {
  return await verifyCustomerToken(req.headers.get("x-customer-token"));
}

/**
 * Constant-time comparison to prevent timing attacks.
 */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

export function isAdminRequest(req: Request): boolean {
  const expected = Deno.env.get("ADMIN_PASSWORD");
  const provided = req.headers.get("x-admin-password");
  return !!expected && !!provided && constantTimeEqual(provided, expected);
}

export function isAdminPassword(provided: unknown): boolean {
  const expected = Deno.env.get("ADMIN_PASSWORD");
  if (!expected) {
    console.error("ADMIN_PASSWORD secret is NOT defined in environment");
  }
  return !!expected && typeof provided === "string" && constantTimeEqual(provided, expected);
}


