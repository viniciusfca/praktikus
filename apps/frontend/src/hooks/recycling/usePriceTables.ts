import { useEffect, useState, useCallback } from 'react';
import {
  priceTablesService,
  type PriceTable,
} from '../../services/recycling/price-tables.service';

let cache: PriceTable[] | null = null;

export function usePriceTables() {
  const [priceTables, setPriceTables] = useState<PriceTable[]>(cache ?? []);
  const [loading, setLoading] = useState(cache == null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await priceTablesService.list();
      cache = data;
      setPriceTables(data);
      setError(null);
    } catch (e) {
      setError('Erro ao carregar tabelas de preço');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (cache == null) {
      load().catch(() => {
        // erro já tratado internamente em load()
      });
    }
  }, [load]);

  return { priceTables, loading, error, reload: load };
}
