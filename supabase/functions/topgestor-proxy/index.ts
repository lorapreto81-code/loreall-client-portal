import { getCustomerSession, isAdminRequest } from "../_shared/auth.ts";
import { TG_API_BASE as API_BASE, tgHeaders, tgSearchCustomers, applyTelasOverride } from "../_shared/tg.ts";
import { jsonResponse as json, securityHeadersFor } from "../_shared/security.ts";

async function proxyResponse(res: Response, req: Request): Promise<Response> {
  const body = await res.text();
  return new Response(body, {
    status: res.status,
    headers: { ...securityHeadersFor(req), "Content-Type": "application/json" },
  });
}


// Fields a customer is allowed to change on their own account.
const CUSTOMER_EDITABLE_FIELDS = ["name", "email", "whatsapp", "celular", "telefone", "cpf"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: securityHeadersFor(req) });
  }


  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    const admin = isAdminRequest(req);
    const session = admin ? null : await getCustomerSession(req);

    if (!admin && !session && action !== "get-plans") return json({ error: "unauthorized" }, 401, {}, req);

    // Actions restricted to the admin panel.
    const adminOnly = new Set(["search-customer", "list-customers"]);
    if (adminOnly.has(action || "") && !admin) return json({ error: "forbidden" }, 403, {}, req);

    // Actions bound to a specific customer id — must be the caller's own id.
    const ownedActions = new Set([
      "get-customer",
      "get-invoices",
      "generate-payment-link",
      "update-customer",
      "renew-customer",
    ]);
    const id = url.searchParams.get("id");
    if (ownedActions.has(action || "")) {
      if (!id) return json({ error: "id required" }, 400, {}, req);
      if (!admin && Number(id) !== session!.sub) return json({ error: "forbidden" }, 403, {}, req);
    }

    let apiRes: Response;

    switch (action) {
      case "search-customer": {
        const query = url.searchParams.get("query");
        if (!query) return json({ error: "query required" }, 400, {}, req);
        const merged = await tgSearchCustomers(query);
        return json({ data: merged }, 200, {}, req);
      }

      case "get-customer": {
        const r = await fetch(`${API_BASE}/customers/${id}`, { headers: tgHeaders() });
        const raw = await r.json().catch(() => ({}));
        if (!r.ok) return json(raw, r.status, {}, req);
        
        // Use service_role client to check for overrides
        const supaUrl = Deno.env.get("SUPABASE_URL")!;
        const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const { createClient } = await import("npm:@supabase/supabase-js@2");
        const supabaseClient = createClient(supaUrl, serviceKey);

        const customerObj = (raw?.data ?? raw) as Record<string, unknown>;
        const withOverride = await applyTelasOverride(supabaseClient, customerObj);
        
        return json(raw?.data ? { ...raw, data: withOverride } : withOverride, 200, {}, req);
      }

      case "get-invoices": {
        const perPage = String(Number(url.searchParams.get("per_page")) || 10);
        apiRes = await fetch(`${API_BASE}/customers/${id}/invoices?per_page=${perPage}`, { headers: tgHeaders() });
        break;
      }

      case "generate-payment-link": {
        apiRes = await fetch(`${API_BASE}/customers/${id}/payment-link`, {
          method: "POST",
          headers: tgHeaders(),
          body: JSON.stringify({}),
        });
        break;
      }

      case "get-plans": {
        // Allow both admin and customers to see plans (needed for renewal bottom sheet)
        const r = await fetch(`${API_BASE}/plans?per_page=200&status=ativo`, { headers: tgHeaders() });
        const rawData = await r.json().catch(() => ({}));
        console.log("[topgestor-proxy] rawData from TG:", JSON.stringify(rawData));
        const plans = Array.isArray(rawData) ? rawData : (rawData?.data || rawData?.plans || rawData?.list || []);
        console.log(`[topgestor-proxy] normalized plans count: ${plans.length}`);
        return json({ data: plans }, 200, {}, req);
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
        apiRes = await fetch(`${API_BASE}/customers?${qp.toString()}`, { headers: tgHeaders() });
        break;
      }

      case "update-customer": {
        const raw = await req.json().catch(() => ({}));
        if (!raw || typeof raw !== "object" || Array.isArray(raw)) return json({ error: "invalid body" }, 400, {}, req);

        // Customers may only patch a safe allow-list of their own fields.
        let body: Record<string, unknown> = raw as Record<string, unknown>;
        if (!admin) {
          body = {};
          for (const f of CUSTOMER_EDITABLE_FIELDS) {
            if (f in (raw as Record<string, unknown>)) {
              const val = (raw as Record<string, unknown>)[f];
              // Basic sanitization: strip HTML tags and limit string length
              if (typeof val === "string") {
                body[f] = val.replace(/<[^>]*>?/gm, "").trim().slice(0, 255);
              } else {
                body[f] = val;
              }
            }
          }
          if (typeof body.email === "string" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())) {
            return json({ error: "invalid email" }, 400, {}, req);
          }
          if (Object.keys(body).length === 0) return json({ error: "no updatable fields" }, 400, {}, req);
        }

        apiRes = await fetch(`${API_BASE}/customers/${id}`, {
          method: "PUT",
          headers: tgHeaders(),
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
        // IMPORTANT: do NOT call /renew (it extends the due date immediately).
        // Only generate the payment link — TopGestor renews automatically once paid.
        const linkRes = await fetch(`${API_BASE}/customers/${id}/payment-link`, {
          method: "POST",
          headers: tgHeaders(),
          body: JSON.stringify({}),
        });
        const linkData = await linkRes.json().catch(() => ({}));
        if (!linkRes.ok) return json(linkData, linkRes.status, {}, req);
        const checkoutUrl =
          linkData?.data?.checkout_url ||
          linkData?.checkout_url ||
          linkData?.data?.invoice?.checkout_url ||
          null;
        return json({ success: true, data: { ...(linkData?.data || {}), checkout_url: checkoutUrl } }, 200, {}, req);
      }

      default:
        return json({ error: "Invalid action" }, 400, {}, req);
    }

    return proxyResponse(apiRes, req);
  } catch (err) {
    console.error("[topgestor-proxy] error", err instanceof Error ? err.message : err);
    return json({ error: "Erro ao processar a requisição." }, 500, {}, req);
  }
});
