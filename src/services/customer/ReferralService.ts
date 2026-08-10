import { BaseApi } from "../api/BaseApi";

export interface ReferralRow {
  id: string;
  referrer_customer_id: number;
  referred_customer_id: number;
  referred_customer_name: string | null;
  referral_code: string;
  bonus_days: number;
  status: "pending_payment" | "pending_referrer_renewal" | "credited" | "rejected";
  rejection_reason: string | null;
  credited_at: string | null;
  created_at: string;
}

export class ReferralService extends BaseApi {
  private static async callReferrals(action: string, params: Record<string, string> = {}, options?: { method?: string; body?: Record<string, unknown> }) {
    const qp = new URLSearchParams({ action, ...params }).toString();
    return this.request(`referrals-api?${qp}`, {
      method: options?.method || "GET",
      headers: this.getHeaders(),
      ...(options?.body ? { body: JSON.stringify(options.body) } : {}),
    });
  }

  static async getOrCreateReferralCode(customer_id: number, customer_name: string): Promise<{ code: string }> {
    return this.callReferrals("get-or-create-code", {}, { method: "POST", body: { customer_id, customer_name } }) as Promise<{ code: string }>;
  }

  static async lookupReferralCode(code: string): Promise<{ valid: boolean; customer_id?: number; customer_name?: string; code?: string }> {
    return this.callReferrals("lookup-code", { code }) as Promise<{ valid: boolean; customer_id?: number; customer_name?: string; code?: string }>;
  }

  static async listReferralsByReferrer(customer_id: number): Promise<{ referrals: ReferralRow[]; credited: number; pending: number; total_days: number }> {
    return this.callReferrals("list-by-referrer", { customer_id: String(customer_id) }) as Promise<{ referrals: ReferralRow[]; credited: number; pending: number; total_days: number }>;
  }
}
