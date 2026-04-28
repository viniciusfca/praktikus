import { describe, it, expect } from 'vitest';
import { isValidCpf, cpfZodSchema } from './cpf';

describe('isValidCpf', () => {
  it('accepts a valid CPF (digits only)', () => {
    expect(isValidCpf('52998224725')).toBe(true);
  });

  it('accepts a valid CPF with mask', () => {
    expect(isValidCpf('529.982.247-25')).toBe(true);
  });

  it('rejects CPF with wrong check digit', () => {
    expect(isValidCpf('12345678900')).toBe(false);
  });

  it('rejects CPF with all-equal digits', () => {
    expect(isValidCpf('11111111111')).toBe(false);
    expect(isValidCpf('00000000000')).toBe(false);
  });

  it('rejects wrong length', () => {
    expect(isValidCpf('1234567890')).toBe(false);
    expect(isValidCpf('123456789012')).toBe(false);
    expect(isValidCpf('')).toBe(false);
  });

  it('rejects non-string input gracefully', () => {
    expect(isValidCpf(null as unknown as string)).toBe(false);
    expect(isValidCpf(undefined as unknown as string)).toBe(false);
  });
});

describe('cpfZodSchema', () => {
  it('strips digits and accepts a valid CPF', () => {
    const result = cpfZodSchema.safeParse('529.982.247-25');
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe('52998224725');
  });

  it('rejects an invalid CPF with the pt-BR message', () => {
    const result = cpfZodSchema.safeParse('12345678900');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('CPF inválido');
    }
  });
});
