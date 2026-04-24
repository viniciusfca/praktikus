import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { NumericInput } from './NumericInput';

describe('<NumericInput>', () => {
  it('displays initial value formatted in pt-BR', () => {
    render(<NumericInput value={1234.5} onChange={() => {}} decimals={2} />);
    expect(screen.getByRole('textbox')).toHaveValue('1.234,50');
  });

  it('displays empty string when value is null', () => {
    render(<NumericInput value={null} onChange={() => {}} decimals={2} />);
    expect(screen.getByRole('textbox')).toHaveValue('');
  });

  it('calls onChange with parsed number as user types comma decimal', async () => {
    const onChange = vi.fn();
    render(<NumericInput value={null} onChange={onChange} decimals={2} />);
    const input = screen.getByRole('textbox');
    await userEvent.type(input, '12,5');
    expect(onChange).toHaveBeenLastCalledWith(12.5);
  });

  it('ignores dot key when decimals > 0', async () => {
    const onChange = vi.fn();
    render(<NumericInput value={null} onChange={onChange} decimals={2} />);
    const input = screen.getByRole('textbox');
    await userEvent.type(input, '1.5');
    expect(input).toHaveValue('15');
    expect(onChange).toHaveBeenLastCalledWith(15);
  });

  it('calls onChange with null when cleared', async () => {
    const onChange = vi.fn();
    render(<NumericInput value={10} onChange={onChange} decimals={2} />);
    const input = screen.getByRole('textbox');
    await userEvent.clear(input);
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it('reformats with thousand separator on blur', async () => {
    const onChange = vi.fn();
    render(<NumericInput value={null} onChange={onChange} decimals={2} />);
    const input = screen.getByRole('textbox');
    await userEvent.type(input, '1234,5');
    await userEvent.tab();
    expect(input).toHaveValue('1.234,50');
  });

  it('renders a prefix when provided', () => {
    render(<NumericInput value={10} onChange={() => {}} decimals={2} prefix="R$" />);
    expect(screen.getByText('R$')).toBeInTheDocument();
  });
});
