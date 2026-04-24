export function stripDigits(value: string): string {
  return value.replace(/\D/g, '');
}

export function formatCnpj(digits: string): string {
  const d = digits.slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

export function formatPhone(digits: string): string {
  const d = digits.slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : '';
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function formatCpf(digits: string): string {
  const d = digits.slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

export function formatDocument(digits: string, type: 'CPF' | 'CNPJ'): string {
  return type === 'CPF' ? formatCpf(digits) : formatCnpj(digits);
}

export function parseDecimal(input: string, decimals: number): number | null {
  if (!input) return null;
  // pt-BR: `.` = thousand separator, `,` = decimal separator.
  const normalized = input.replace(/\./g, '').replace(',', '.');
  const match = normalized.match(/^(-?)(\d+)(?:\.(\d+))?$/);
  if (!match) return null;
  const [, sign, intPart, fracPart = ''] = match;
  const truncatedFrac = fracPart.slice(0, decimals);
  const numericStr = truncatedFrac ? `${sign}${intPart}.${truncatedFrac}` : `${sign}${intPart}`;
  const n = Number(numericStr);
  return Number.isFinite(n) ? n : null;
}

export function formatDecimal(value: number, decimals: number): string {
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
