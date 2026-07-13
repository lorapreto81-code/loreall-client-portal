// Utilitários para CPF/CNPJ: máscara, validação e exibição parcial.

export const onlyDigits = (v: string) => String(v || "").replace(/\D/g, "");

/** Aplica máscara progressiva: CPF (000.000.000-00) até 11 dígitos; CNPJ (00.000.000/0000-00) a partir de 12. */
export function maskDoc(v: string): string {
  const d = onlyDigits(v).slice(0, 14);
  if (d.length <= 11) {
    // CPF
    if (d.length <= 3) return d;
    if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
    if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  }
  // CNPJ
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

export function isValidCPF(v: string): boolean {
  const c = onlyDigits(v);
  if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false;
  let s = 0;
  for (let i = 0; i < 9; i++) s += parseInt(c[i]) * (10 - i);
  let d1 = (s * 10) % 11; if (d1 === 10) d1 = 0;
  if (d1 !== parseInt(c[9])) return false;
  s = 0;
  for (let i = 0; i < 10; i++) s += parseInt(c[i]) * (11 - i);
  let d2 = (s * 10) % 11; if (d2 === 10) d2 = 0;
  return d2 === parseInt(c[10]);
}

export function isValidCNPJ(v: string): boolean {
  const c = onlyDigits(v);
  if (c.length !== 14 || /^(\d)\1+$/.test(c)) return false;
  const calc = (base: string, weights: number[]) => {
    let s = 0;
    for (let i = 0; i < weights.length; i++) s += parseInt(base[i]) * weights[i];
    const r = s % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const d1 = calc(c.slice(0, 12), w1);
  if (d1 !== parseInt(c[12])) return false;
  const d2 = calc(c.slice(0, 13), w2);
  return d2 === parseInt(c[13]);
}

export type DocKind = "cpf" | "cnpj" | null;

export function detectDoc(v: string): DocKind {
  const d = onlyDigits(v);
  if (d.length === 11) return "cpf";
  if (d.length === 14) return "cnpj";
  return null;
}

export function isValidDoc(v: string): boolean {
  const kind = detectDoc(v);
  if (kind === "cpf") return isValidCPF(v);
  if (kind === "cnpj") return isValidCNPJ(v);
  return false;
}

/** Retorna documento mascarado com dígitos ocultos, ex.: ***.***.789-00 ou **.***.***/0001-** */
export function maskDocPartial(v: string): string {
  const d = onlyDigits(v);
  if (d.length === 11) {
    return `***.***.${d.slice(6, 9)}-${d.slice(9)}`;
  }
  if (d.length === 14) {
    return `**.***.***/${d.slice(8, 12)}-**`;
  }
  return "";
}
