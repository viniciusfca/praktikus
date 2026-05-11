import { z } from 'zod';
import type { PriceTable } from '@praktikus/shared';

const requiredPriceCell = z.preprocess(
  (v) => (v === '' || v === null || v === undefined ? NaN : Number(v)),
  z.number().positive('Preço obrigatório e maior que zero'),
);

const optionalPriceCell = z.preprocess(
  (v) => (v === '' || v === null || v === undefined ? null : Number(v)),
  z.number().positive('Use um valor maior que zero').nullable(),
);

export type ProductFormData = {
  name: string;
  unitId: string;
  active: boolean;
  prices: Record<string, number | string | null>;
};

export function buildProductSchema(priceTables: PriceTable[]) {
  const defaultTable = priceTables.find((t) => t.isDefault);
  if (!defaultTable) {
    throw new Error('Nenhuma tabela padrão configurada');
  }
  const pricesShape = Object.fromEntries(
    priceTables.map((t) => [
      t.id,
      t.id === defaultTable.id ? requiredPriceCell : optionalPriceCell,
    ]),
  );
  return z.object({
    name: z.string().min(1, 'Nome obrigatório').max(120),
    unitId: z.string().min(1, 'Selecione uma unidade'),
    active: z.boolean(),
    prices: z.object(pricesShape),
  });
}
