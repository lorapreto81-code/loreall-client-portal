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
  const num = typeof v === "string" ? parseFloat(v) : (v || 0);
  // Garante que o valor retornado seja o valor real vindo da API do TopGestor
  return num;
};

export const mapProviderToServidor = (iptvProvider?: string | null): string | null => {
  const v = String(iptvProvider || "").toLowerCase().trim();
  if (v === "wplay_main") return "warez";
  if (v === "uniplay_main") return "uniplay_iptv"; // cobre P2P e IPTV — preço igual pra 1 tela
  return null; // desconhecido: quem chama deve cair no sistema antigo
};

export interface AreaPricingPlan {
  periodicidade: string;
  topgestor_plan_id: number;
  display_name: string;
  base_amount: number;
  final_amount: number;
}

export const buildCardsFromAreaPricing = (areaPlans: AreaPricingPlan[]): PeriodCard[] => {
  return PERIOD_MAP
    .map((period) => {
      const found = areaPlans.find((p) => p.periodicidade === period.keyword);
      if (!found) return null;
      return {
        ...period,
        plan: {
          id: found.topgestor_plan_id,
          plan_name: found.display_name,
          plan_value: found.final_amount,
        },
      };
    })
    .filter((c): c is PeriodCard => c != null);
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
  // We prioritize "1 tela" but remain flexible to "1 telas" if it exists in the DB
  if (count === 1) return lower.includes("1 tela");
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

// Nome "padrão" (tabela oficial): "Mensal 2 telas", "Anual 1 tela", etc.
// Aceita emoji/símbolo no início e ignora.
export const isStandardPlanName = (planName: string): boolean => {
  const cleaned = planName
    .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}\uFE0F]/gu, "")
    .trim()
    .toLowerCase();
  
  // More permissive regex: allows space or no space between number and "tela"
  // Also allows any number of screens (not just 1-3)
  return /^(mensal|trimestral|semestral|anual)\s+\d+\s*tela(s)?$/.test(cleaned);
};

export interface PeriodCard {
  months: number;
  label: string;
  keyword: string;
  plan?: Plan;
}

// Decide quais cards de renovação mostrar com base no plano atual do cliente.
// - Se o plano atual é um plano "padrão" da tabela (ex: Mensal 2 telas R$30),
//   mostra os 4 períodos padrão para a mesma quantidade de telas.
// - Se o plano atual é fora da tabela (Uniplay Mensal, Mensal 2 telas R$50,
//   planos sem indicação de telas, etc.), mostra APENAS o plano atual,
//   sem oferecer upgrades.
export const computeRenewalCards = (
  allPlans: Plan[],
  currentPlanId: number | undefined,
  currentTelas: number,
): PeriodCard[] => {
  // 1. Determine current plan's properties
  const currentPlan = allPlans.find((p) => p.id === currentPlanId);
  const currentName = currentPlan ? getPlanName(currentPlan) : "";
  const currentHasScreens = hasAnyScreenTag(currentName);

  // 2. Build the standard set of plans for the dashboard
  const standardSet: Record<string, Plan> = {};
  for (const period of PERIOD_MAP) {
    const candidates = allPlans.filter((p) => {
      const name = getPlanName(p);
      // Try standard plan name first
      if (isStandardPlanName(name)) {
        if (!matchesPeriod(name, period.keyword)) return false;
        const screensToMatch = currentHasScreens ? currentTelas : 1;
        return matchesScreenCount(name, screensToMatch);
      }
      
      // Fallback for non-standard plan names: just match the period keyword 
      // if the name doesn't specify screens (or if it matches the screen count)
      const hasScreens = hasAnyScreenTag(name);
      if (matchesPeriod(name, period.keyword)) {
        if (!hasScreens) return true; // Accept plans without screen tags as generic
        const screensToMatch = currentHasScreens ? currentTelas : 1;
        return matchesScreenCount(name, screensToMatch);
      }
      
      return false;
    });

    if (candidates.length > 0) {
      // Sort by value (cheapest first for that period)
      candidates.sort((a, b) => getPlanValue(a) - getPlanValue(b));
      standardSet[period.keyword] = candidates[0];
    }
  }

  const standardIds = new Set(Object.values(standardSet).map((p) => Number(p.id)));
  const isStandardCustomer = currentPlanId != null && standardIds.has(Number(currentPlanId));

  if (isStandardCustomer || !currentPlan) {
    return PERIOD_MAP
      .map((p) => ({ ...p, plan: standardSet[p.keyword] }))
      .filter((c) => c.plan != null);
  }

  // Plano fora da tabela: oferecer somente o plano atual.
  if (!currentPlan) return [];
  const name = getPlanName(currentPlan);
  const periodKey = detectCurrentPeriod(name);
  const period = PERIOD_MAP.find((p) => p.keyword === periodKey) || {
    months: 1,
    label: "Renovar",
    keyword: "renovar",
  };
  return [{ ...period, plan: currentPlan }];
};
