/**
 * Country dial codes used by the phone inputs across the app.
 * The canonical value stored/sent is always digits only, including the
 * country code (E.164 without "+"), e.g. "5583985591952".
 * The backend matches by suffix, so legacy records saved without the
 * country code keep working.
 */

export interface Country {
  code: string;
  name: string;
  dial: string;
  flag: string;
}

export const COUNTRIES: Country[] = [
  { code: "BR", name: "Brasil", dial: "55", flag: "🇧🇷" },
  { code: "PT", name: "Portugal", dial: "351", flag: "🇵🇹" },
  { code: "US", name: "Estados Unidos", dial: "1", flag: "🇺🇸" },
  { code: "AR", name: "Argentina", dial: "54", flag: "🇦🇷" },
  { code: "PY", name: "Paraguai", dial: "595", flag: "🇵🇾" },
  { code: "UY", name: "Uruguai", dial: "598", flag: "🇺🇾" },
  { code: "CL", name: "Chile", dial: "56", flag: "🇨🇱" },
  { code: "BO", name: "Bolívia", dial: "591", flag: "🇧🇴" },
  { code: "PE", name: "Peru", dial: "51", flag: "🇵🇪" },
  { code: "CO", name: "Colômbia", dial: "57", flag: "🇨🇴" },
  { code: "MX", name: "México", dial: "52", flag: "🇲🇽" },
  { code: "ES", name: "Espanha", dial: "34", flag: "🇪🇸" },
  { code: "IT", name: "Itália", dial: "39", flag: "🇮🇹" },
  { code: "FR", name: "França", dial: "33", flag: "🇫🇷" },
  { code: "DE", name: "Alemanha", dial: "49", flag: "🇩🇪" },
  { code: "GB", name: "Reino Unido", dial: "44", flag: "🇬🇧" },
  { code: "IE", name: "Irlanda", dial: "353", flag: "🇮🇪" },
  { code: "CH", name: "Suíça", dial: "41", flag: "🇨🇭" },
  { code: "BE", name: "Bélgica", dial: "32", flag: "🇧🇪" },
  { code: "NL", name: "Holanda", dial: "31", flag: "🇳🇱" },
  { code: "LU", name: "Luxemburgo", dial: "352", flag: "🇱🇺" },
  { code: "JP", name: "Japão", dial: "81", flag: "🇯🇵" },
  { code: "AO", name: "Angola", dial: "244", flag: "🇦🇴" },
  { code: "MZ", name: "Moçambique", dial: "258", flag: "🇲🇿" },
  { code: "CA", name: "Canadá", dial: "1", flag: "🇨🇦" },
];

export const DEFAULT_COUNTRY = COUNTRIES[0];

const onlyDigits = (s: string) => String(s || "").replace(/\D/g, "");

/**
 * Splits raw input into { dial, national }.
 * Accepts "+55 83 9...", "55839...", "83 9..." (assumed BR) and international
 * numbers with or without the leading "+".
 */
export function splitPhone(raw: string): { dial: string; national: string } {
  const hadPlus = String(raw || "").trim().startsWith("+");
  const d = onlyDigits(raw);
  if (!d) return { dial: DEFAULT_COUNTRY.dial, national: "" };

  // Brazilian number already carrying the country code
  if (d.startsWith("55") && d.length >= 12 && d.length <= 13) {
    return { dial: "55", national: d.slice(2) };
  }

  // Plain BR national number (10 or 11 digits) — the most common legacy case
  if (!hadPlus && d.length <= 11 && !d.startsWith("55")) {
    return { dial: DEFAULT_COUNTRY.dial, national: d };
  }

  const dials = Array.from(new Set(COUNTRIES.map((c) => c.dial))).sort(
    (a, b) => b.length - a.length,
  );
  for (const dial of dials) {
    if (d.startsWith(dial) && d.length - dial.length >= 6) {
      return { dial, national: d.slice(dial.length) };
    }
  }
  return { dial: DEFAULT_COUNTRY.dial, national: d };
}

/** Applies a readable mask to the national part for the given dial code. */
export function formatNational(dial: string, national: string): string {
  const d = onlyDigits(national);
  if (dial === "55") {
    if (d.length <= 2) return d;
    if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  }
  return d.replace(/(\d{3})(?=\d)/g, "$1 ").trim();
}

/** Canonical value: digits only, with country code. */
export function toE164Digits(dial: string, national: string): string {
  const n = onlyDigits(national);
  return n ? `${dial}${n}` : "";
}

/** Pretty display of a full number (with or without country code). */
export function formatFullPhone(raw: string): string {
  const { dial, national } = splitPhone(raw);
  if (!national) return "";
  return `+${dial} ${formatNational(dial, national)}`;
}

/** Basic validity: 8-15 digits total, BR requires 10-11 national digits. */
export function isValidPhone(dial: string, national: string): boolean {
  const n = onlyDigits(national);
  if (dial === "55") return n.length === 10 || n.length === 11;
  const total = dial.length + n.length;
  return n.length >= 6 && total >= 8 && total <= 15;
}
