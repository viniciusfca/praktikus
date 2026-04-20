import { useCallback, useEffect, useState } from 'react';
import {
  coletasService,
  coletaCommentsService,
  type Coleta,
  type ColetaComment,
} from '../../services/recycling/coletas.service';

export function useColetasByWeek(weekStart: Date, weekEnd: Date) {
  const [coletas, setColetas] = useState<Coleta[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const items = await coletasService.list({
        start: weekStart.toISOString(),
        end: new Date(weekEnd.getTime() + 86_400_000).toISOString(),
      });
      setColetas(items);
    } catch {
      setError('Erro ao carregar coletas.');
    } finally {
      setLoading(false);
    }
  }, [weekStart.toISOString(), weekEnd.toISOString()]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  return { coletas, loading, error, refetch: load };
}

export function useUpcomingColetas(limit = 4) {
  const [coletas, setColetas] = useState<Coleta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(() => {
    setLoading(true);
    setError(null);
    coletasService.upcoming(limit)
      .then(setColetas)
      .catch(() => setError('Erro ao carregar próximas coletas'))
      .finally(() => setLoading(false));
  }, [limit]);

  useEffect(() => { refetch(); }, [refetch]);

  return { coletas, loading, error, refetch };
}

export function useColetaComments(coletaId: string | null) {
  const [comments, setComments] = useState<ColetaComment[]>([]);
  const [loading, setLoading] = useState(false);

  const refetch = useCallback(() => {
    if (!coletaId) { setComments([]); return; }
    setLoading(true);
    coletaCommentsService.list(coletaId)
      .then(setComments)
      .finally(() => setLoading(false));
  }, [coletaId]);

  useEffect(() => { refetch(); }, [refetch]);

  return { comments, loading, refetch };
}
