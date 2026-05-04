import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProductDialog } from './ProductDialog';
import type { PriceTable } from '@praktikus/shared';

const tables: PriceTable[] = [
  { id: 't1', name: 'Tabela 1 — Padrão', description: null, sortOrder: 1, isDefault: true },
  { id: 't2', name: 'Tabela 2', description: null, sortOrder: 2, isDefault: false },
  { id: 't3', name: 'Tabela 3', description: null, sortOrder: 3, isDefault: false },
];

const units = [{ id: '11111111-1111-1111-1111-111111111111', name: 'Quilograma', abbreviation: 'kg' }];

const baseProps = {
  open: true,
  onClose: vi.fn(),
  onSave: vi.fn(),
  priceTables: tables,
  units,
  product: null,
};

describe('<ProductDialog />', () => {
  it('botão Salvar fica disabled enquanto Tabela 1 está vazia', async () => {
    render(<ProductDialog {...baseProps} />);
    const save = screen.getByRole('button', { name: /Salvar/i });
    expect(save).toBeDisabled();
  });

  it('Replicar Tabela 1 copia o valor para t2 e t3', async () => {
    const user = userEvent.setup();
    render(<ProductDialog {...baseProps} />);
    const inputs = screen.getAllByRole('spinbutton');
    await user.clear(inputs[0]);
    await user.type(inputs[0], '8.5');

    const replicar = screen.getByRole('button', { name: /Replicar Tabela 1/i });
    expect(replicar).not.toBeDisabled();
    await user.click(replicar);

    await waitFor(() => {
      expect((inputs[1] as HTMLInputElement).value).toBe('8.5');
      expect((inputs[2] as HTMLInputElement).value).toBe('8.5');
    });
  });

  it('Replicar fica disabled quando Tabela 1 está vazia', () => {
    render(<ProductDialog {...baseProps} />);
    const replicar = screen.getByRole('button', { name: /Replicar Tabela 1/i });
    expect(replicar).toBeDisabled();
  });

  it('submit transforma string vazia em null nos preços', async () => {
    const onSave = vi.fn();
    const user = userEvent.setup();
    render(<ProductDialog {...baseProps} onSave={onSave} />);

    await user.type(screen.getByLabelText(/Nome/i), 'Alumínio');
    // Select unit
    const unitSelect = screen.getByLabelText(/Unidade/i);
    await user.selectOptions(unitSelect, '11111111-1111-1111-1111-111111111111');
    const inputs = screen.getAllByRole('spinbutton');
    await user.type(inputs[0], '8'); // só padrão

    await user.click(screen.getByRole('button', { name: /Salvar/i }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Alumínio',
          prices: expect.objectContaining({
            t1: 8,
            t2: null,
            t3: null,
          }),
        }),
      );
    });
  });
});
