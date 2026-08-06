import { onlyDigits } from "./formatters";
import { daysUntil } from "@/lib/format";

export const logo = "/logo.png";
export const REF_KEY = "loreall_pending_ref";
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const WHATSAPP_NUMBER = "5583985591952";

/** Returns color for days remaining */
export const getDaysColor = (days: number): string => {
  if (days < 0) return "#E24B4A";
  if (days < 7) return "#F09595";
  if (days <= 15) return "#FAC775";
  return "#5DCAA5";
};

/** Short status pill for the header. */
export const getStatusPill = (days: number): { label: string; bg: string; color: string } => {
  if (days < 0) return { label: "Vencido", bg: "rgba(226,75,74,0.15)", color: "#E24B4A" };
  if (days === 0) return { label: "Vence hoje", bg: "rgba(240,149,149,0.18)", color: "#E24B4A" };
  if (days === 1) return { label: "1 dia", bg: "rgba(250,199,117,0.20)", color: "#B47700" };
  if (days < 7) return { label: `${days} dias`, bg: "rgba(250,199,117,0.20)", color: "#B47700" };
  return { label: "Ativo", bg: "rgba(93,202,165,0.15)", color: "#2E9A73" };
};

/** Plural for telas */
export const telasLabel = (n: number | string): string => {
  const num = typeof n === "number" ? n : parseInt(String(n), 10) || 1;
  return num === 1 ? "1 simultânea" : `${num} simultâneas`;
};
