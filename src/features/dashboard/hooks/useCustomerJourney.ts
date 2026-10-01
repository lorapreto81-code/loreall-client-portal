import { useState } from "react";

export type JourneyStep = "expired" | "expiring" | "profile" | "promo" | "none";

const SNOOZE_DAYS = 3;
const snoozeKey = (id: number) => `loreall_profile_snooze_${id}`;

/** Decides the single primary highlight of the client area, by priority. */
export function useCustomerJourney(opts: {
  customerId?: number;
  days: number;
  profileIncomplete: boolean;
  promoEligible: boolean;
}) {
  const { customerId, days, profileIncomplete, promoEligible } = opts;
  const [snoozedUntil, setSnoozedUntil] = useState<number>(() => {
    if (!customerId) return 0;
    return Number(localStorage.getItem(snoozeKey(customerId)) || 0);
  });
  const profileSnoozed = snoozedUntil > Date.now();

  let step: JourneyStep = "none";
  if (days < 0) step = "expired";
  else if (days <= 3) step = "expiring";
  else if (profileIncomplete && !profileSnoozed) step = "profile";
  else if (promoEligible) step = "promo";

  const snoozeProfile = () => {
    if (!customerId) return;
    const until = Date.now() + SNOOZE_DAYS * 86400_000;
    localStorage.setItem(snoozeKey(customerId), String(until));
    setSnoozedUntil(until);
  };

  return { step, profileSnoozed, snoozeProfile };
}
