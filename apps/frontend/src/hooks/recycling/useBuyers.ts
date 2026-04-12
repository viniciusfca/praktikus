import { useState, useEffect, useCallback } from 'react';
import { buyersService, type Buyer } from '../../services/recycling/buyers.service';

export function useBuyers(page: number, limit = 20, search?: string) {
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    buyersService.list(page, limit, search)
      .then((res) => {
        setBuyers(res.data);
        setTotal(res.total);
      })
      .catch(() => setError('Erro ao carregar compradores'))
      .finally(() => setLoading(false));
  }, [page, limit, search]);

  useEffect(() => { load(); }, [load]);

  return { buyers, total, loading, error, reload: load };
}
