import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { PhoneInput } from './PhoneInput';

function PhoneInputTest(props: { onChangeSpy?: (value: string) => void }) {
  const [value, setValue] = useState('');
  const onChange = (v: string) => {
    setValue(v);
    props.onChangeSpy?.(v);
  };
  return <PhoneInput value={value} onChange={onChange} />;
}

describe('<PhoneInput>', () => {
  it('formats 11-digit mobile number', async () => {
    const onChange = vi.fn();
    render(<PhoneInputTest onChangeSpy={onChange} />);
    const input = screen.getByRole('textbox');
    await userEvent.type(input, '11987654321');
    expect(input).toHaveValue('(11) 98765-4321');
    expect(onChange).toHaveBeenLastCalledWith('11987654321');
  });

  it('formats 10-digit landline', async () => {
    const onChange = vi.fn();
    render(<PhoneInputTest onChangeSpy={onChange} />);
    const input = screen.getByRole('textbox');
    await userEvent.type(input, '1133334444');
    expect(input).toHaveValue('(11) 3333-4444');
  });

  it('truncates at 11 digits', async () => {
    const onChange = vi.fn();
    render(<PhoneInputTest onChangeSpy={onChange} />);
    const input = screen.getByRole('textbox');
    await userEvent.type(input, '119876543210000');
    expect(onChange).toHaveBeenLastCalledWith('11987654321');
  });
});
