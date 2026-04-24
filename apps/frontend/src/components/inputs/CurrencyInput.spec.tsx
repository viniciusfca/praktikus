import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CurrencyInput } from './CurrencyInput';

describe('<CurrencyInput>', () => {
  it('renders with R$ prefix', () => {
    render(<CurrencyInput value={10} onChange={() => {}} />);
    expect(screen.getByText('R$')).toBeInTheDocument();
  });

  it('defaults to 2 decimal places', () => {
    render(<CurrencyInput value={1234.5} onChange={() => {}} />);
    expect(screen.getByRole('textbox')).toHaveValue('1.234,50');
  });
});
