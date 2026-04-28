import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { UseFormSetValue, FieldValues } from 'react-hook-form';

vi.mock('../services/cep.service', () => ({
  lookupCep: vi.fn(),
}));

import { useCepLookup } from './useCepLookup';
import { lookupCep } from '../services/cep.service';

const mockLookup = lookupCep as unknown as ReturnType<typeof vi.fn>;

function renderUseCepLookup() {
  const setValue = vi.fn() as unknown as UseFormSetValue<FieldValues>;
  const hook = renderHook(() => useCepLookup<FieldValues>({ setValue }));
  return { hook, setValue: setValue as unknown as ReturnType<typeof vi.fn> };
}

describe('useCepLookup', () => {
  beforeEach(() => vi.clearAllMocks());

  it('does not call lookupCep when CEP has fewer than 8 digits', async () => {
    const { hook } = renderUseCepLookup();
    act(() => {
      hook.result.current.onCepChange('123');
    });
    await new Promise((r) => setTimeout(r, 400));
    expect(mockLookup).not.toHaveBeenCalled();
  });

  it('calls lookupCep and populates fields when CEP has 8 digits', async () => {
    mockLookup.mockResolvedValue({
      cep: '01001000', street: 'Praça da Sé', neighborhood: 'Sé', city: 'São Paulo', state: 'SP',
    });
    const { hook, setValue } = renderUseCepLookup();
    act(() => {
      hook.result.current.onCepChange('01001-000');
    });
    await waitFor(() => expect(mockLookup).toHaveBeenCalledWith('01001-000'));
    await waitFor(() => {
      expect(setValue).toHaveBeenCalledWith('street', 'Praça da Sé', { shouldDirty: true });
      expect(setValue).toHaveBeenCalledWith('neighborhood', 'Sé', { shouldDirty: true });
      expect(setValue).toHaveBeenCalledWith('city', 'São Paulo', { shouldDirty: true });
      expect(setValue).toHaveBeenCalledWith('state', 'SP', { shouldDirty: true });
    });
  });

  it('sets "CEP não encontrado" message on 404', async () => {
    mockLookup.mockRejectedValue({ response: { status: 404 } });
    const { hook } = renderUseCepLookup();
    act(() => {
      hook.result.current.onCepChange('00000000');
    });
    await waitFor(() => expect(hook.result.current.error).toBe('CEP não encontrado'));
  });

  it('sets generic error message on non-404 error', async () => {
    mockLookup.mockRejectedValue({ response: { status: 502 } });
    const { hook } = renderUseCepLookup();
    act(() => {
      hook.result.current.onCepChange('12345678');
    });
    await waitFor(() => expect(hook.result.current.error).toBe('Não foi possível consultar o CEP'));
  });

  it('toggles isLoading around the call', async () => {
    let resolve!: (v: any) => void;
    mockLookup.mockReturnValue(new Promise((r) => { resolve = r; }));
    const { hook } = renderUseCepLookup();
    act(() => {
      hook.result.current.onCepChange('01001000');
    });
    await waitFor(() => expect(hook.result.current.isLoading).toBe(true));
    act(() => {
      resolve({ cep: '01001000', street: '', neighborhood: '', city: '', state: '' });
    });
    await waitFor(() => expect(hook.result.current.isLoading).toBe(false));
  });
});
