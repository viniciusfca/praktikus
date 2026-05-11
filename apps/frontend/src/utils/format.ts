export function formatBRL(value: number | null | undefined): string {
  if (value == null) return '—';
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Formata um telefone brasileiro armazenado como dígitos crus
 * (ex.: "51955873402") para o padrão de exibição "(51) 95587-3402".
 *
 * - 11 dígitos → celular: (DD) NNNNN-NNNN
 * - 10 dígitos → fixo:    (DD) NNNN-NNNN
 * - Qualquer outro comprimento: retorna o valor original (fallback)
 * - null/undefined/vazio: retorna '—'
 */
export function formatPhoneBr(raw: string | null | undefined): string {
  if (!raw) return '—';
  const digits = String(raw).replaceAll(/\D/g, '');
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return raw;
}
