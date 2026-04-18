import { useState, useEffect, useCallback } from 'react';
import { stockService, type StockBalance, type StockMovement } from '../../services/recycling/stock.service';

export function useStock() {
  const [balances, setBalances] = useState<StockBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    stockService.getBalances()
      .then(setBalances)
      .catch(() => setError('Erro ao carregar estoque'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  return { balances, loading, error, reload: load };
}

export function useProductMovements(productId: string | null) {
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback((id: string) => {
    setLoading(true);
    setError(null);
    stockService.getMovements(id)
      .then(setMovements)
      .catch(() => setError('Erro ao carregar movimentações'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (productId) {
      load(productId);
    } else {
      setMovements([]);
    }
  }, [productId, load]);

  return { movements, loading, error };
}
