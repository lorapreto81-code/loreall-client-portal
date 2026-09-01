# Plan: Fix renewal price for legacy plans + clean "Seu plano" card

Three bugs confirmed in `RenewalBottomSheet.tsx`, `PlanCard.tsx`, and `planUtils.ts`. Two focused fixes, no schema/DB/edge-function changes.

## Problem 1 — Renewal shows wrong price for legacy plans (R$30 instead of R$35)

Today `periodCards` uses the new `area_plan_mapping` table whenever it returns *any* rows for the customer's (servidor, telas), even when the customer's current plan is a legacy one (e.g. "Legado R$35"). Warez/3-telas has a unified R$30 entry, so a legacy R$35 customer falls into it and is offered the wrong price grid.

`computeRenewalCards` already handles this correctly (it checks whether the customer's `plan_id` is in the "standard" set before offering the 4 periods), but it only runs as a fallback when the area table is empty — never when the customer is legacy.

### Fix

**`src/lib/planUtils.ts`** — add after `detectCurrentPeriod`:

```ts
export const isLegacyPlanName = (name?: string | null): boolean =>
  /legado/i.test(name || "");
```

**`src/components/RenewalBottomSheet.tsx`**:

1. Add `isLegacyPlanName` to the existing `@/lib/planUtils` import.
2. Change `areaPricingQuery.enabled` from
   `enabled: !!customer && open && !!servidor,`
   to
   `enabled: !!customer && open && !!servidor && !isLegacyPlanName(customer?.plan?.name),`
3. Change the `periodCards` useMemo from:
   ```ts
   const areaCards = buildCardsFromAreaPricing(areaPricingQuery.data || []);
   if (areaCards.length > 0) return areaCards;
   return computeRenewalCards(allPlans, currentPlanId, currentTelas);
   ```
   to:
   ```ts
   if (!isLegacyPlanName(customer?.plan?.name)) {
     const areaCards = buildCardsFromAreaPricing(areaPricingQuery.data || []);
     if (areaCards.length > 0) return areaCards;
   }
   return computeRenewalCards(allPlans, currentPlanId, currentTelas);
   ```
   and add `customer?.plan?.name` to the dependency array.

Guard rails: no legacy plan enters `area_plan_mapping`, so this preserves the automatic TopGestor link logic; standard customers are unchanged.

## Problem 2 — "Seu plano" card shows "Warez" and wrong screen count

`PlanCard.tsx` only strips the "N Telas" suffix from the raw TopGestor name via regex, so "Warez · Mensal · 3 Telas (Legado R$35)" becomes "Warez · Mensal(Legado R$35)" — server name and legacy tag leak, and the space before the parenthesis is missing. It also uses raw `customer.telas` for both the icons and the label, which is the field flagged as unreliable; the correct `extractTelasFromPlanName(customer.plan?.name)` is already used in `RenewalBottomSheet.tsx`.

### Fix

**`src/lib/planUtils.ts`** — add after `detectCurrentPeriod`:

```ts
const PERIOD_LABELS: Record<string, string> = {
  mensal: "Mensal",
  trimestral: "Trimestral",
  semestral: "Semestral",
  anual: "Anual",
};

export const getDisplayPlanLabel = (name?: string | null): string => {
  const period = detectCurrentPeriod(name || "");
  return period ? `Plano ${PERIOD_LABELS[period]}` : "Plano";
};
```

**`src/features/dashboard/components/PlanCard.tsx`**:

1. Add `extractTelasFromPlanName` and `getDisplayPlanLabel` to the `@/lib/planUtils` import.
2. Before the `return`, add:
   ```ts
   const telas = extractTelasFromPlanName(customer.plan?.name) || 1;
   ```
3. Replace the IIFE that cleans the raw name (the `.replace(/\s*[·-]?\s*\d+\s*telas?\s*/gi, "")` block) with:
   ```tsx
   {getDisplayPlanLabel(customer.plan?.name)}
   ```
4. Replace `Math.min(Number(customer.telas) || 1, 4)` with `Math.min(telas, 4)`.
5. Replace both `telasLabel(customer.telas)` occurrences (the card label and the "quero mais telas" WhatsApp message) with `telasLabel(telas)`.

Guard rails: only the dashboard card is touched. The full `customer.plan?.name` still goes into the WhatsApp support message verbatim (internal, for the attendant), and installation/login screens are untouched.

## Validation

- Legacy account (e.g. Rafael) → renewal shows only their current plan at R$35, no 4-period grid with the wrong price; the "Seu plano" card shows "Plano Mensal" (no "Warez"/"Legado") and "3 Telas".
- Standard Warez/Uniplay customer → 4-period area-pricing grid unchanged; card label respects the detected period (e.g. "Plano Trimestral", "Plano Anual").
