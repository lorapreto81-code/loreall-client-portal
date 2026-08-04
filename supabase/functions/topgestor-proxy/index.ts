import { getCustomerSession, isAdminRequest } from "../_shared/auth.ts";
import { TG_API_BASE as API_BASE, tgHeaders, tgSearchCustomers } from "../_shared/tg.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-customer-token, x-admin-password",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function proxyResponse(res: Response): Promise<Response> {
  const body = await res.text();
  return new Response(body, {
    status: res.status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Fields a customer is allowed to change on their own account.
const CUSTOMER_EDITABLE_FIELDS = ["name", "email", "whatsapp", "celular", "telefone", "cpf", "plan_id"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    const admin = isAdminRequest(req);
    const session = admin ? null : await getCustomerSession(req);

    if (!admin && !session) return json({ error: "unauthorized" }, 401);

    // Actions restricted to the admin panel.
    const adminOnly = new Set(["search-customer", "list-customers"]);
    if (adminOnly.has(action || "") && !admin) return json({ error: "forbidden" }, 403);

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
      if (!id) return json({ error: "id required" }, 400);
      if (!admin && Number(id) !== session!.sub) return json({ error: "forbidden" }, 403);
    }

    let apiRes: Response;

    switch (action) {
      case "search-customer": {
        const query = url.searchParams.get("query");
        if (!query) return json({ error: "query required" }, 400);
        const merged = await tgSearchCustomers(query);
        return json({ data: merged });
      }

      case "get-customer": {
        apiRes = await fetch(`${API_BASE}/customers/${id}`, { headers: tgHeaders() });
        break;
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
        apiRes = await fetch(`${API_BASE}/plans`, { headers: tgHeaders() });
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
        apiRes = await fetch(`${API_BASE}/customers?${qp.toString()}`, { headers: tgHeaders() });
        break;
      }

      case "update-customer": {
        const raw = await req.json().catch(() => ({}));
        if (!raw || typeof raw !== "object" || Array.isArray(raw)) return json({ error: "invalid body" }, 400);

        // Customers may only patch a safe allow-list of their own fields.
        let body: Record<string, unknown> = raw as Record<string, unknown>;
        if (!admin) {
          body = {};
          for (const f of CUSTOMER_EDITABLE_FIELDS) {
            if (f in (raw as Record<string, unknown>)) body[f] = (raw as Record<string, unknown>)[f];
          }
          if (typeof body.email === "string" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())) {
            return json({ error: "invalid email" }, 400);
          }
          if (Object.keys(body).length === 0) return json({ error: "no updatable fields" }, 400);
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
        if (!linkRes.ok) return json(linkData, linkRes.status);
        const checkoutUrl =
          linkData?.data?.checkout_url ||
          linkData?.checkout_url ||
          linkData?.data?.invoice?.checkout_url ||
          null;
        return json({ success: true, data: { ...(linkData?.data || {}), checkout_url: checkoutUrl } });
      }

      default:
        return json({ error: "Invalid action" }, 400);
    }

    return proxyResponse(apiRes);
  } catch (err) {
    console.error("[topgestor-proxy] error", err instanceof Error ? err.message : err);
    return json({ error: "Erro ao processar a requisição." }, 500);
  }
});
