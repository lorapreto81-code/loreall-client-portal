import { BaseApi } from "../api/BaseApi";

export interface CreatePixResponse {
  payment_id: string;
  qr_code_url: string;
  qr_code_text: string;
  expires_at: string;
  amount: number;
}

export class PaymentService extends BaseApi {
  static async createPix(body: {
    customer_id: number;
    customer_name: string;
    customer_whatsapp?: string;
    plan_id: number;
    plan_name: string;
    amount: number;
    referral_code?: string;
  }): Promise<CreatePixResponse> {
    return this.request<CreatePixResponse>("create-pix", {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(body),
    });
  }

  static async getPaymentStatus(params: { action: string; payment_id?: string; customer_id: number; limit?: number }): Promise<any> {
    return this.request("payment-status", {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(params),
    });
  }

  static async renewCustomer(customerId: number, planId: number): Promise<any> {
    return this.request(`topgestor-proxy?action=renew-customer&id=${customerId}`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify({ plan_id: planId }),
    });
  }
}
