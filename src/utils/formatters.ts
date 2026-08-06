/**
 * Standardizes common formatting logic.
 */

export const onlyDigits = (s: string) => s.replace(/\D/g, "");

export const formatPhone = (raw: string): string => {
  const d = onlyDigits(raw).slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};

export const maskName = (raw?: string) => {
  if (!raw) return "—";
  return raw
    .trim()
    .split(/\s+/)
    .map((word) => {
      if (word.length <= 2) return word;
      if (word.length === 3) return word[0] + "•" + word[2];
      const start = word.slice(0, 2);
      const end = word.slice(-1);
      const middle = "•".repeat(Math.max(2, word.length - 3));
      return start + middle + end;
    })
    .join(" ");
};

export const firstName = (name: string): string => (name || "").split(" ")[0];
