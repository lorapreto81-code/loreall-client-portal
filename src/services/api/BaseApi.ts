import { getCustomerToken } from "@/store/authStore";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export class BaseApi {
  protected static getSupabaseUrl() {
    return SUPABASE_URL;
  }

  protected static getHeaders(options: { isAdmin?: boolean } = {}) {
    const token = getCustomerToken();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
    };

    if (token) {
      headers["x-customer-token"] = token;
    }

    if (options.isAdmin) {
      const adminPass = sessionStorage.getItem("admin_password") || "";
      headers["x-admin-password"] = adminPass;
    }

    return headers;
  }

  protected static sanitize(val: any): any {
    if (typeof val === "string") {
      return val.replace(/<[^>]*>?/gm, "").trim().slice(0, 500);
    }
    return val;
  }

  protected static async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const maxRetries = 4;
    const timeout = 15000;

    let attempt = 0;

    const execute = async (): Promise<T> => {
      try {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(`${SUPABASE_URL}/functions/v1/${endpoint}`, {
          ...options,
          signal: controller.signal
        });
        clearTimeout(id);

        if (response.status === 401) {
          window.dispatchEvent(new CustomEvent("auth:unauthorized"));
          throw new Error("Sessão expirada. Faça login novamente.");
        }

        if (response.status === 429) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || "Muitas requisições. Aguarde alguns minutos.");
        }

        const data = await response.json().catch(() => ({}));
        
        if (!response.ok) {
          throw new Error(data.error || data.message || `Erro ${response.status}`);
        }

        return data as T;
      } catch (err: any) {
        if ((err.name === 'TypeError' && err.message === 'Failed to fetch') || err.name === 'AbortError') {
          if (attempt < maxRetries) {
            attempt++;
            const backoff = err.name === 'AbortError' ? 500 : 1000;
            console.warn(`[BaseApi] Retrying request to ${endpoint} (${err.name}, Attempt ${attempt}/${maxRetries})...`);
            await new Promise(resolve => setTimeout(resolve, backoff * attempt));
            return execute();
          }
          throw new Error("Não foi possível conectar ao servidor. Tente novamente em instantes.");
        }

        throw err;
      }
    };

    return execute();
  }
}
