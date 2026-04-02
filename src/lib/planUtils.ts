export interface Plan {
  id: number;
  plan_name?: string;
  name?: string;
  plan_value?: number | string;
  value?: number | string;
  plan_description?: string;
  description?: string;
}

export const getPlanName = (p: Plan) => p.plan_name || p.name || "Plano";
export const getPlanValue = (p: Plan) => {
  const v = p.plan_value ?? p.value;
  return typeof v === "string" ? parseFloat(v) : (v || 0);
};

const PERIOD_MAP: { months: number; label: string; keyword: string }[] = [
  { months: 1, label: "1 mês", keyword: "mensal" },
  { months: 3, label: "3 meses", keyword: "trimestral" },
  { months: 6, label: "6 meses", keyword: "semestral" },
  { months: 12, label: "12 meses", keyword: "anual" },
];

export { PERIOD_MAP };

export const matchesScreenCount = (planName: string, count: number): boolean => {
  const lower = planName.toLowerCase();
  if (count === 1) return lower.includes("1 tela") && !lower.includes("1 telas");
  return lower.includes(`${count} telas`);
};

export const hasAnyScreenTag = (planName: string): boolean =>
  /[123]\s*telas?/i.test(planName);

export const matchesPeriod = (planName: string, keyword: string): boolean =>
  planName.toLowerCase().includes(keyword);

export const detectCurrentPeriod = (planName: string): string | null => {
  const lower = planName.toLowerCase();
  for (const p of PERIOD_MAP) {
    if (lower.includes(p.keyword)) return p.keyword;
  }
  return null;
};

export const screenLabel = (n: number) => (n === 1 ? "1 Tela" : `${n} Telas`);
