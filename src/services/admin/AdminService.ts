import { BaseApi } from "../api/BaseApi";

export class AdminService extends BaseApi {
  private static async callAdmin(action: string, options: { method?: string; body?: Record<string, unknown>; params?: Record<string, string> } = {}) {
    const qp = new URLSearchParams({ action, ...(options.params || {}) }).toString();
    return this.request(`reseller-admin?${qp}`, {
      method: options.method || "GET",
      headers: this.getHeaders({ isAdmin: true }),
      ...(options.body ? { body: JSON.stringify(options.body) } : {}),
    });
  }

  static async getConfig() {
    return this.callAdmin("get-config");
  }

  static async updateConfig(entries: Record<string, string>) {
    return this.callAdmin("update-config", { method: "POST", body: { entries } });
  }

  static async listLinks() {
    return this.callAdmin("list-links");
  }

  static async createLink(body: Record<string, unknown>) {
    return this.callAdmin("create-link", { method: "POST", body });
  }

  static async updateLink(body: Record<string, unknown>) {
    return this.callAdmin("update-link", { method: "POST", body });
  }

  static async deleteLink(id: string) {
    return this.callAdmin("delete-link", { method: "POST", body: { id } });
  }

  static async listOtpLogs() {
    return this.callAdmin("list-otp-logs");
  }

  // Add more admin methods as needed following this pattern
}
