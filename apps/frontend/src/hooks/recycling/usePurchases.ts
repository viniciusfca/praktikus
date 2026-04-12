import { useState, useEffect, useCallback } from 'react';
import { purchasesService, type Purchase } from '../../services/recycling/purchases.service';

export function usePurchases(page: number, limit = 20) {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    purchasesService.list(page, limit)
      .then((res) => {
        setPurchases(res.data);
        setTotal(res.total);
      })
      .catch(() => setError('Erro ao carregar compras'))
      .finally(() => setLoading(false));
  }, [page, limit]);

  useEffect(() => { load(); }, [load]);

  return { purchases, total, loading, error, reload: load };
}
