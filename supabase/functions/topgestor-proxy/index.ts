const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const API_BASE = "https://topgestor.me/api/v1";

async function getToken(): string {
  const token = Deno.env.get("TOPGESTOR_API_TOKEN");
  if (!token) throw new Error("TOPGESTOR_API_TOKEN not configured");
  return token;
}

function apiHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  };
}

async function proxyResponse(res: Response): Promise<Response> {
  const body = await res.text();
  return new Response(body, {
    status: res.status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const token = await getToken();
    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    let apiRes: Response;

    switch (action) {
      case "search-customer": {
        const query = url.searchParams.get("query");
        if (!query) return new Response(JSON.stringify({ error: "query required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

        const digits = query.replace(/\D/g, "");
        const isPhone = digits.length >= 8;

        // Para telefones, tentamos várias variações em paralelo para tolerar
        // formatos errados (espaços, com/sem DDD, com/sem 9, com/sem 55).
        const buildPhoneVariants = (d: string): string[] => {
          const set = new Set<string>();
          set.add(d);
          // remove código país 55 se vier com 12-13 dígitos
          let local = d;
          if ((local.length === 12 || local.length === 13) && local.startsWith("55")) {
            local = local.slice(2);
            set.add(local);
          }
          // últimos N dígitos
          if (local.length >= 11) set.add(local.slice(-11));
          if (local.length >= 10) set.add(local.slice(-10));
          if (local.length >= 9) set.add(local.slice(-9));
          if (local.length >= 8) set.add(local.slice(-8));

          // Sem DDD: número puro (8 ou 9 dígitos)
          const tail8 = local.slice(-8);
          const tail9 = local.length >= 9 ? local.slice(-9) : "";

          // Se temos DDD (>=10), gerar variantes com/sem o 9 após o DDD
          if (local.length >= 10) {
            const ddd = local.slice(0, 2);
            const rest = local.slice(2);
            // com 9 (celular)
            if (rest.length === 8) set.add(ddd + "9" + rest);
            // sem 9 (caso tenha sido digitado errado)
            if (rest.length === 9 && rest.startsWith("9")) set.add(ddd + rest.slice(1));
          }

          set.add(tail8);
          if (tail9) set.add(tail9);

          // Limitar a 6 variantes para não estourar rate limit
          return Array.from(set).filter((v) => v.length >= 8).slice(0, 6);
        };

        if (!isPhone) {
          apiRes = await fetch(`${API_BASE}/customers/search/${encodeURIComponent(query)}`, { headers: apiHeaders(token) });
          break;
        }

        const variants = buildPhoneVariants(digits);
        const results = await Promise.all(
          variants.map((v) =>
            fetch(`${API_BASE}/customers/search/${encodeURIComponent(v)}`, { headers: apiHeaders(token) })
              .then(async (r) => {
                if (!r.ok) return [] as any[];
                const j = await r.json().catch(() => null);
                if (!j) return [] as any[];
                const arr = Array.isArray(j) ? j : Array.isArray(j.data) ? j.data : j.data ? [j.data] : Array.isArray(j) ? j : [j];
                return Array.isArray(arr) ? arr : [];
              })
              .catch(() => [] as any[])
          )
        );

        const merged: any[] = [];
        const seen = new Set<string>();
        for (const list of results) {
          for (const c of list) {
            if (!c || typeof c !== "object") continue;
            const key = String((c as any).id ?? JSON.stringify(c));
            if (seen.has(key)) continue;
            seen.add(key);
            merged.push(c);
          }
        }

        return new Response(JSON.stringify({ data: merged }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "get-customer": {
        const id = url.searchParams.get("id");
        if (!id) return new Response(JSON.stringify({ error: "id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        apiRes = await fetch(`${API_BASE}/customers/${id}`, { headers: apiHeaders(token) });
        break;
      }

      case "get-invoices": {
        const id = url.searchParams.get("id");
        const perPage = url.searchParams.get("per_page") || "10";
        if (!id) return new Response(JSON.stringify({ error: "id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        apiRes = await fetch(`${API_BASE}/customers/${id}/invoices?per_page=${perPage}`, { headers: apiHeaders(token) });
        break;
      }

      case "generate-payment-link": {
        const id = url.searchParams.get("id");
        if (!id) return new Response(JSON.stringify({ error: "id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        apiRes = await fetch(`${API_BASE}/customers/${id}/payment-link`, {
          method: "POST",
          headers: apiHeaders(token),
          body: JSON.stringify({}),
        });
        break;
      }

      case "get-plans": {
        apiRes = await fetch(`${API_BASE}/plans`, { headers: apiHeaders(token) });
        break;
      }

      case "list-customers": {
        const perPage = url.searchParams.get("per_page") || "100";
        const page = url.searchParams.get("page") || "1";
        const status = url.searchParams.get("status") || "";
        const search = url.searchParams.get("search") || "";
        const archived = url.searchParams.get("archived") || "";
        const qp = new URLSearchParams({ per_page: perPage, page });
        if (status) qp.set("status", status);
        if (search) qp.set("search", search);
        if (archived) qp.set("archived", archived);
        apiRes = await fetch(`${API_BASE}/customers?${qp.toString()}`, { headers: apiHeaders(token) });
        break;
      }

      case "update-customer": {
        const id = url.searchParams.get("id");
        if (!id) return new Response(JSON.stringify({ error: "id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const body = await req.json();
        apiRes = await fetch(`${API_BASE}/customers/${id}`, {
          method: "PUT",
          headers: apiHeaders(token),
          body: JSON.stringify(body),
        });

        // Se o cliente informou/atualizou um e-mail via app, registramos como confirmado
        // (diferencia dos e-mails inventados gerados na criação do cadastro no TopGestor).
        if (apiRes.ok && typeof body?.email === "string" && body.email.trim()) {
          const email = String(body.email).trim().toLowerCase();
          const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
          const supaUrl = Deno.env.get("SUPABASE_URL");
          const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
          if (validEmail && supaUrl && serviceKey) {
            try {
              await fetch(
                `${supaUrl}/rest/v1/confirmed_customer_emails?on_conflict=customer_id`,
                {
                  method: "POST",
                  headers: {
                    apikey: serviceKey,
                    Authorization: `Bearer ${serviceKey}`,
                    "Content-Type": "application/json",
                    Prefer: "resolution=merge-duplicates,return=minimal",
                  },
                  body: JSON.stringify({
                    customer_id: Number(id),
                    email,
                    confirmed_at: new Date().toISOString(),
                  }),
                },
              );
            } catch (e) {
              console.error("confirm-email upsert failed:", e);
            }
          }
        }
        break;
      }

      case "renew-customer": {
        const id = url.searchParams.get("id");
        if (!id) return new Response(JSON.stringify({ error: "id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        // IMPORTANT: do NOT call /renew (it extends the due date immediately).
        // Only generate the payment link — TopGestor renews automatically once paid.
        const linkRes = await fetch(`${API_BASE}/customers/${id}/payment-link`, {
          method: "POST",
          headers: apiHeaders(token),
          body: JSON.stringify({}),
        });
        const linkData = await linkRes.json().catch(() => ({}));
        if (!linkRes.ok) {
          return new Response(JSON.stringify(linkData), {
            status: linkRes.status,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const checkoutUrl =
          linkData?.data?.checkout_url ||
          linkData?.checkout_url ||
          linkData?.data?.invoice?.checkout_url ||
          null;
        return new Response(
          JSON.stringify({ success: true, data: { ...(linkData?.data || {}), checkout_url: checkoutUrl } }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      default:
        return new Response(JSON.stringify({ error: "Invalid action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return proxyResponse(apiRes);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("topgestor-proxy error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
