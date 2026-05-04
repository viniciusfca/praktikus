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

  it('chama onChange com ponto quando o usuário digita ponto', () => {
    const onChange = vi.fn();
    render(<PriceRow {...baseProps} onChange={onChange} />);
    const input = screen.getByPlaceholderText('0,00');
    fireEvent.change(input, { target: { value: '8.5' } });
    expect(onChange).toHaveBeenCalledWith('8.5');
  });

  it('chama onChange com ponto quando o usuário digita vírgula (normalização)', () => {
    const onChange = vi.fn();
    render(<PriceRow {...baseProps} onChange={onChange} />);
    const input = screen.getByPlaceholderText('0,00');
    fireEvent.change(input, { target: { value: '8,5' } });
    expect(onChange).toHaveBeenCalledWith('8.5');
  });

  it('ignora caracteres não-numéricos (não chama onChange)', () => {
    const onChange = vi.fn();
    render(<PriceRow {...baseProps} onChange={onChange} value="" />);
    const input = screen.getByPlaceholderText('0,00');
    fireEvent.change(input, { target: { value: 'abc' } });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('formata valor em formato BR após blur', () => {
    render(<PriceRow {...baseProps} value="8.5" />);
    const input = screen.getByPlaceholderText('0,00') as HTMLInputElement;
    fireEvent.blur(input);
    expect(input.value).toBe('8,50');
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
