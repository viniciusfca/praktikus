import { useMemo, useState } from 'react';
import type { PriceTable } from '@praktikus/shared';
import type { Product } from '../../services/recycling/products.service';

export type PrintLayout = 'full' | 'compact';

export function usePrintTableForm(
  priceTables: PriceTable[],
  products: Product[],
) {
  const defaultTable = priceTables.find((t) => t.isDefault) ?? priceTables[0];
  const [tableId, setTableId] = useState<string>(defaultTable?.id ?? '');
  const [layout, setLayout] = useState<PrintLayout>('full');
  const [includeInactive, setIncludeInactive] = useState(false);

  const selectedTable = useMemo(
    () => priceTables.find((t) => t.id === tableId) ?? defaultTable,
    [priceTables, tableId, defaultTable],
  );

  const filteredProducts = useMemo(() => {
    return products
      .filter((p) => (includeInactive ? true : p.active))
      .filter((p) => p.prices[tableId] != null)
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [products, tableId, includeInactive]);

  const canDownload = filteredProducts.length > 0;

  return {
    tableId,
    setTableId,
    layout,
    setLayout,
    includeInactive,
    setIncludeInactive,
    selectedTable,
    filteredProducts,
    canDownload,
  };
}
