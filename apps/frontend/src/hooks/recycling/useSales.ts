import { useState, useEffect, useCallback } from 'react';
import { salesService, type Sale } from '../../services/recycling/sales.service';

export function useSales(page: number, limit = 20) {
  const [sales, setSales] = useState<Sale[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    salesService.list(page, limit)
      .then((res) => {
        setSales(res.data);
        setTotal(res.total);
      })
      .catch(() => setError('Erro ao carregar vendas'))
      .finally(() => setLoading(false));
  }, [page, limit]);

  useEffect(() => { load(); }, [load]);

  return { sales, total, loading, error, reload: load };
}
