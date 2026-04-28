import { useState } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import type { UseFormSetValue, FieldValues } from 'react-hook-form';
import { lookupCep } from '../services/cep.service';

interface UseCepLookupOptions<T extends FieldValues> {
  setValue: UseFormSetValue<T>;
  fields?: {
    street?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
  };
}

export function useCepLookup<T extends FieldValues>({
  setValue,
  fields,
}: UseCepLookupOptions<T>) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // setValue is generic over Path<T> and FieldPathValue<T, Path<T>> — at this layer
  // we don't know the concrete form shape, so cast to a permissive signature.
  const set = setValue as unknown as (
    name: string,
    value: string,
    options?: { shouldDirty?: boolean },
  ) => void;

  const onCepChange = useDebouncedCallback(async (rawCep: string) => {
    const clean = rawCep.replace(/\D/g, '');
    if (clean.length !== 8) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await lookupCep(rawCep);
      const opts = { shouldDirty: true };
      set(fields?.street ?? 'street', data.street, opts);
      set(fields?.neighborhood ?? 'neighborhood', data.neighborhood, opts);
      set(fields?.city ?? 'city', data.city, opts);
      set(fields?.state ?? 'state', data.state, opts);
    } catch (err) {
      const e = err as { response?: { status?: number } };
      if (e?.response?.status === 404) setError('CEP não encontrado');
      else setError('Não foi possível consultar o CEP');
    } finally {
      setIsLoading(false);
    }
  }, 300);

  return { onCepChange, isLoading, error };
}
