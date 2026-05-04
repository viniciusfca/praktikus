import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PriceRow } from './PriceRow';

describe('<PriceRow />', () => {
  const baseProps = {
    index: 1,
    name: 'Tabela 1 — Padrão',
    description: null as string | null,
    unitSymbol: 'kg',
    required: true,
    value: '',
    onChange: vi.fn(),
  };

  it('mostra asterisco quando required', () => {
    render(<PriceRow {...baseProps} />);
    expect(screen.getByText(/Tabela 1/i).textContent).toContain('*');
  });

  it('chama onChange quando o input muda', () => {
    const onChange = vi.fn();
    render(<PriceRow {...baseProps} onChange={onChange} />);
    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '8.5' } });
    expect(onChange).toHaveBeenCalledWith('8.5');
  });

  it('estado preenchido marca a linha como destacada (data-filled=true)', () => {
    const { container } = render(<PriceRow {...baseProps} value="8.5" />);
    const row = container.querySelector('[data-filled="true"]');
    expect(row).toBeInTheDocument();
  });

  it('estado vazio não marca destacada (data-filled=false)', () => {
    const { container } = render(<PriceRow {...baseProps} value="" />);
    const row = container.querySelector('[data-filled="false"]');
    expect(row).toBeInTheDocument();
  });
});
