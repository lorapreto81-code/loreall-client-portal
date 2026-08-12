import { jsonResponse as json, securityHeaders } from "../_shared/security.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: securityHeaders });
  return json({ error: "Este método de login foi descontinuado. Use o acesso por código via WhatsApp ou e-mail." }, 410);
});
