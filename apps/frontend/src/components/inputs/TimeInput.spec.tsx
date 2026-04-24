import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TimeInput } from './TimeInput';

describe('<TimeInput>', () => {
  it('inserts ":" after two digits automatically', async () => {
    const onChange = vi.fn();
    render(<TimeInput value="" onChange={onChange} />);
    const input = screen.getByRole('textbox');
    await userEvent.type(input, '1430');
    expect(input).toHaveValue('14:30');
    expect(onChange).toHaveBeenLastCalledWith('14:30');
  });

  it('displays initial value as-is when already HH:mm', () => {
    render(<TimeInput value="09:15" onChange={() => {}} />);
    expect(screen.getByRole('textbox')).toHaveValue('09:15');
  });

  it('truncates beyond 4 digits', async () => {
    const onChange = vi.fn();
    render(<TimeInput value="" onChange={onChange} />);
    const input = screen.getByRole('textbox');
    await userEvent.type(input, '143099');
    expect(onChange).toHaveBeenLastCalledWith('14:30');
  });

  it('strips non-digit characters', async () => {
    const onChange = vi.fn();
    render(<TimeInput value="" onChange={onChange} />);
    const input = screen.getByRole('textbox');
    await userEvent.type(input, 'ab14cd30');
    expect(onChange).toHaveBeenLastCalledWith('14:30');
  });

  it('emits partial value during typing', async () => {
    const onChange = vi.fn();
    render(<TimeInput value="" onChange={onChange} />);
    const input = screen.getByRole('textbox');
    await userEvent.type(input, '14');
    expect(onChange).toHaveBeenLastCalledWith('14');
  });
});
