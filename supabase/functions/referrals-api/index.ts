import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonRes(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Code generator: 6 chars uppercase, no ambiguous (0/O, 1/I)
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function genCode(): string {
  let s = "";
  const buf = new Uint8Array(6);
  crypto.getRandomValues(buf);
  for (let i = 0; i < 6; i++) s += ALPHABET[buf[i] % ALPHABET.length];
  return s;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    // ----- get-or-create-code -----
    if (action === "get-or-create-code") {
      const body = await req.json().catch(() => ({}));
      const customerId = Number(body.customer_id);
      const customerName: string = body.customer_name || "";
      if (!customerId) return jsonRes({ error: "customer_id required" }, 400);

      const { data: existing } = await supabase
        .from("referral_codes")
        .select("*")
        .eq("customer_id", customerId)
        .maybeSingle();

      if (existing) return jsonRes({ code: existing.code, customer_id: customerId });

      // try a few times to avoid collision
      for (let i = 0; i < 5; i++) {
        const code = genCode();
        const { data: inserted, error } = await supabase
          .from("referral_codes")
          .insert({ customer_id: customerId, customer_name: customerName, code })
          .select()
          .single();
        if (!error && inserted) return jsonRes({ code: inserted.code, customer_id: customerId });
        if (error && !`${error.message}`.toLowerCase().includes("duplicate")) {
          console.error("[referrals-api] insert error", error);
          return jsonRes({ error: error.message }, 500);
        }
      }
      return jsonRes({ error: "could not generate unique code" }, 500);
    }

    // ----- lookup-code -----
    if (action === "lookup-code") {
      const code = (url.searchParams.get("code") || "").trim().toUpperCase();
      if (!code) return jsonRes({ error: "code required" }, 400);
      const { data } = await supabase
        .from("referral_codes")
        .select("customer_id, customer_name, code")
        .eq("code", code)
        .maybeSingle();
      if (!data) return jsonRes({ valid: false }, 200);
      return jsonRes({ valid: true, ...data });
    }

    // ----- list-by-referrer -----
    if (action === "list-by-referrer") {
      const customerId = Number(url.searchParams.get("customer_id"));
      if (!customerId) return jsonRes({ error: "customer_id required" }, 400);

      const { data: referrals } = await supabase
        .from("referrals")
        .select("*")
        .eq("referrer_customer_id", customerId)
        .order("created_at", { ascending: false });

      const list = referrals || [];
      const credited = list.filter((r) => r.status === "credited").length;
      const pending = list.filter((r) =>
        r.status === "pending_payment" || r.status === "pending_referrer_renewal"
      ).length;
      const totalDays = list
        .filter((r) => r.status === "credited")
        .reduce((acc, r) => acc + (r.bonus_days || 0), 0);

      return jsonRes({ referrals: list, credited, pending, total_days: totalDays });
    }

    return jsonRes({ error: "Invalid action" }, 400);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[referrals-api] error", message);
    return jsonRes({ error: message }, 500);
  }
});
