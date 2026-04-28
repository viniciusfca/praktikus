import { describe, it, expect } from 'vitest';
import { stripDigits } from './strip-digits';

describe('stripDigits', () => {
  it('removes all non-digit characters', () => {
    expect(stripDigits('12.345.678/0001-95')).toBe('12345678000195');
    expect(stripDigits('(11) 99999-9999')).toBe('11999999999');
    expect(stripDigits('abc123def456')).toBe('123456');
  });

  it('returns empty string for input with no digits', () => {
    expect(stripDigits('hello')).toBe('');
    expect(stripDigits('')).toBe('');
  });

  it('preserves digit-only input unchanged', () => {
    expect(stripDigits('12345678000195')).toBe('12345678000195');
  });
});
