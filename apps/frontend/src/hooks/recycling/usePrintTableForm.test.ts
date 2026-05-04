import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { PriceTable } from '@praktikus/shared';
import type { Product } from '../../services/recycling/products.service';
import { usePrintTableForm } from './usePrintTableForm';

const tables: PriceTable[] = [
  { id: 't1', name: 'Tabela 1 — Padrão', description: null, sortOrder: 1, isDefault: true },
  { id: 't2', name: 'Tabela 2', description: null, sortOrder: 2, isDefault: false },
];

const products: Product[] = [
  {
    id: 'p1', name: 'Alumínio', unitId: 'u', pricePerUnit: 8,
    prices: { t1: 8, t2: 9 }, active: true,
  },
  {
    id: 'p2', name: 'Cobre', unitId: 'u', pricePerUnit: 26,
    prices: { t1: 26, t2: null }, active: true,
  },
  {
    id: 'p3', name: 'Vidro', unitId: 'u', pricePerUnit: 0.25,
    prices: { t1: 0.25, t2: 0.30 }, active: false,
  },
];

describe('usePrintTableForm', () => {
  it('default seleciona a tabela padrão', () => {
    const { result } = renderHook(() => usePrintTableForm(tables, products));
    expect(result.current.tableId).toBe('t1');
    expect(result.current.layout).toBe('full');
    expect(result.current.includeInactive).toBe(false);
  });

  it('filtra inativos por padrão', () => {
    const { result } = renderHook(() => usePrintTableForm(tables, products));
    expect(result.current.filteredProducts.map((p) => p.id)).toEqual(['p1', 'p2']);
  });

  it('inclui inativos quando includeInactive=true', () => {
    const { result } = renderHook(() => usePrintTableForm(tables, products));
    act(() => result.current.setIncludeInactive(true));
    expect(result.current.filteredProducts.map((p) => p.id)).toEqual(['p1', 'p2', 'p3']);
  });

  it('omite produtos sem preço na tabela escolhida', () => {
    const { result } = renderHook(() => usePrintTableForm(tables, products));
    act(() => result.current.setTableId('t2'));
    expect(result.current.filteredProducts.map((p) => p.id)).toEqual(['p1']);
  });

  it('canDownload é false quando lista filtrada está vazia', () => {
    const { result } = renderHook(() =>
      usePrintTableForm(tables, [{ ...products[0], prices: { t1: null, t2: null } }]),
    );
    expect(result.current.canDownload).toBe(false);
  });
});
