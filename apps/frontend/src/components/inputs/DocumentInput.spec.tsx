import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DocumentInput } from './DocumentInput';

describe('<DocumentInput>', () => {
  it('formats CPF while typing', async () => {
    const onChange = vi.fn();
    render(<DocumentInput type="CPF" value="" onChange={onChange} />);
    const input = screen.getByRole('textbox');
    await userEvent.type(input, '12345678901');
    expect(input).toHaveValue('123.456.789-01');
    expect(onChange).toHaveBeenLastCalledWith('12345678901');
  });

  it('formats CNPJ while typing', async () => {
    const onChange = vi.fn();
    render(<DocumentInput type="CNPJ" value="" onChange={onChange} />);
    const input = screen.getByRole('textbox');
    await userEvent.type(input, '12345678000199');
    expect(input).toHaveValue('12.345.678/0001-99');
    expect(onChange).toHaveBeenLastCalledWith('12345678000199');
  });

  it('truncates input above CPF limit', async () => {
    const onChange = vi.fn();
    render(<DocumentInput type="CPF" value="" onChange={onChange} />);
    const input = screen.getByRole('textbox');
    await userEvent.type(input, '123456789012345');
    expect(onChange).toHaveBeenLastCalledWith('12345678901');
  });

  it('rerenders formatted value when type changes', () => {
    const { rerender } = render(
      <DocumentInput type="CNPJ" value="12345678000199" onChange={() => {}} />,
    );
    expect(screen.getByRole('textbox')).toHaveValue('12.345.678/0001-99');
    rerender(<DocumentInput type="CPF" value="12345678901" onChange={() => {}} />);
    expect(screen.getByRole('textbox')).toHaveValue('123.456.789-01');
  });

  it('strips non-digit characters from input', async () => {
    const onChange = vi.fn();
    render(<DocumentInput type="CPF" value="" onChange={onChange} />);
    const input = screen.getByRole('textbox');
    await userEvent.type(input, 'abc123def456');
    expect(onChange).toHaveBeenLastCalledWith('123456');
  });
});
