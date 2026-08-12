// Shared TopGestor helpers.

export const TG_API_BASE = "https://topgestor.me/api/v1";

export function tgToken(): string {
  const token = Deno.env.get("TOPGESTOR_API_TOKEN");
  if (!token) throw new Error("TOPGESTOR_API_TOKEN not configured");
  return token;
}

export function tgHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${tgToken()}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  };
}

/** Builds tolerant phone variants (with/without country code, DDD, extra 9). */
export function buildPhoneVariants(d: string): string[] {
  const set = new Set<string>();
  set.add(d);
  let local = d;
  if ((local.length === 12 || local.length === 13) && local.startsWith("55")) {
    local = local.slice(2);
    set.add(local);
  }
  if (local.length >= 11) set.add(local.slice(-11));
  if (local.length >= 10) set.add(local.slice(-10));
  if (local.length >= 9) set.add(local.slice(-9));
  if (local.length >= 8) set.add(local.slice(-8));

  const tail8 = local.slice(-8);
  const tail9 = local.length >= 9 ? local.slice(-9) : "";

  if (local.length >= 10) {
    const ddd = local.slice(0, 2);
    const rest = local.slice(2);
    if (rest.length === 8) set.add(ddd + "9" + rest);
    if (rest.length === 9 && rest.startsWith("9")) set.add(ddd + rest.slice(1));
  }

  set.add(tail8);
  if (tail9) set.add(tail9);

  return Array.from(set).filter((v) => v.length >= 8).slice(0, 6);
}

/** Returns a customer object without the sensitive IPTV password field. */
export function sanitizeCustomerForClient(c: Record<string, unknown>): Record<string, unknown> {
  const { password, ...safe } = c;
  return safe;
}

function normalizeList(j: unknown): Record<string, unknown>[] {
  if (!j) return [];
  if (Array.isArray(j)) return j as Record<string, unknown>[];
  const data = (j as { data?: unknown }).data;
  if (Array.isArray(data)) return data as Record<string, unknown>[];
  if (data) return [data as Record<string, unknown>];
  return [j as Record<string, unknown>];
}

/** Searches customers in TopGestor, tolerant to phone formatting. */
export async function tgSearchCustomers(query: string): Promise<Record<string, unknown>[]> {
  const digits = query.replace(/\D/g, "");
  const isPhone = digits.length >= 8;

  if (!isPhone) {
    const r = await fetch(`${TG_API_BASE}/customers/search/${encodeURIComponent(query)}`, { headers: tgHeaders() });
    if (!r.ok) return [];
    return normalizeList(await r.json().catch(() => null));
  }

  // OPTIMIZATION: Parallelize search across variants but only use variants that are actually likely to match.
  // We limit the number of variants to avoid hitting TopGestor rate limits too hard.
  const variants = buildPhoneVariants(digits);
  
  // Cache to store unique results by ID to avoid duplicates in the merged list.
  const seen = new Set<string>();
  const merged: Record<string, unknown>[] = [];

  const results = await Promise.all(
    variants.map(async (v) => {
      try {
        const r = await fetch(`${TG_API_BASE}/customers/search/${encodeURIComponent(v)}`, { headers: tgHeaders() });
        if (!r.ok) return [];
        const list = normalizeList(await r.json().catch(() => null));
        return list;
      } catch (err) {
        console.error(`[tgSearchCustomers] search for variant ${v} failed:`, err);
        return [];
      }
    })
  );

  for (const list of results) {
    for (const c of list) {
      if (!c || typeof c !== "object") continue;
      const key = String(c.id ?? JSON.stringify(c));
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(c);
      }
    }
  }

  return merged;
}
