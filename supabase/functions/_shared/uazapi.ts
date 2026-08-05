// Shared helper to send WhatsApp text messages through the TopGestor Uazapi instance.

export const UAZAPI_BASE = "https://topgestor.uazapi.com";

export function uazapiToken(): string {
  const token = Deno.env.get("UAZAPI_TOKEN");
  if (!token) throw new Error("UAZAPI_TOKEN not configured");
  return token;
}

/** Normalizes a Brazilian phone number to the 55DDDNUMBER format expected by Uazapi. */
export function toWhatsappNumber(raw: string): string {
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("55") && (d.length === 12 || d.length === 13)) return d;
  if (d.length === 10 || d.length === 11) return `55${d}`;
  if (d.length > 13) d = d.slice(-13);
  return d;
}

export async function sendWhatsappText(number: string, text: string): Promise<boolean> {
  const res = await fetch(`${UAZAPI_BASE}/send/text`, {
    method: "POST",
    headers: {
      token: uazapiToken(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ number: toWhatsappNumber(number), text }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("[uazapi] send failed", res.status, body.slice(0, 300));
    return false;
  }
  return true;
}
