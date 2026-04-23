/**
 * Formats a CPF/CNPJ string with a type prefix suitable for standalone
 * display (PDF labels, plain-text reports). Modal/inline usage should
 * prefer an unprefixed variant because the context is already labeled.
 *
 * CPF (11 chars): "CPF XXX.XXX.XXX-XX"
 * CNPJ (14 chars, or null type as legacy fallback): "CNPJ XX.XXX.XXX/XXXX-XX"
 * Returns the raw string if neither length matches, or null if doc is null.
 */
export function formatDocumentWithType(
  doc: string | null,
  type: 'CPF' | 'CNPJ' | null,
): string | null {
  if (!doc) return null;
  if (type === 'CPF' && doc.length === 11) {
    return `CPF ${doc.slice(0, 3)}.${doc.slice(3, 6)}.${doc.slice(6, 9)}-${doc.slice(9)}`;
  }
  if ((type === 'CNPJ' || !type) && doc.length === 14) {
    return `CNPJ ${doc.slice(0, 2)}.${doc.slice(2, 5)}.${doc.slice(5, 8)}/${doc.slice(8, 12)}-${doc.slice(12)}`;
  }
  return doc;
}
