import { BaseApi } from "../api/BaseApi";
import { Customer } from "@/store/authStore";

export class CustomerService extends BaseApi {
  static async getCustomer(customerId: number): Promise<{ data: Customer }> {
    return this.request<{ data: Customer }>(`topgestor-proxy?action=get-customer&id=${customerId}`, {
      headers: this.getHeaders(),
    });
  }

  static async updateCustomer(customerId: number, body: Partial<Customer>): Promise<any> {
    const sanitizedBody = Object.fromEntries(
      Object.entries(body).map(([k, v]) => [k, this.sanitize(v)])
    );

    return this.request(`topgestor-proxy?action=update-customer&id=${customerId}`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(sanitizedBody),
    });
  }

  static async getPlans(): Promise<any> {
    return this.request("topgestor-proxy?action=get-plans", {
      headers: this.getHeaders(),
    });
  }
}
