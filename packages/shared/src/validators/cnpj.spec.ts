import { describe, it, expect } from 'vitest';
import { isValidCnpj, cnpjZodSchema } from './cnpj';

describe('isValidCnpj', () => {
  it('accepts a valid CNPJ (digits only)', () => {
    expect(isValidCnpj('11222333000181')).toBe(true);
  });

  it('accepts a valid CNPJ with mask', () => {
    expect(isValidCnpj('11.222.333/0001-81')).toBe(true);
  });

  it('rejects CNPJ with wrong check digit', () => {
    expect(isValidCnpj('12345678000199')).toBe(false);
  });

  it('rejects CNPJ with all-equal digits even though algorithm passes', () => {
    expect(isValidCnpj('11111111111111')).toBe(false);
    expect(isValidCnpj('00000000000000')).toBe(false);
  });

  it('rejects strings with wrong length', () => {
    expect(isValidCnpj('1122233300018')).toBe(false);
    expect(isValidCnpj('112223330001811')).toBe(false);
    expect(isValidCnpj('')).toBe(false);
  });

  it('rejects non-string input gracefully', () => {
    expect(isValidCnpj(null as unknown as string)).toBe(false);
    expect(isValidCnpj(undefined as unknown as string)).toBe(false);
    expect(isValidCnpj(12345678000181 as unknown as string)).toBe(false);
  });
});

describe('cnpjZodSchema', () => {
  it('strips digits and accepts a valid CNPJ', () => {
    const result = cnpjZodSchema.safeParse('11.222.333/0001-81');
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe('11222333000181');
  });

  it('rejects an invalid CNPJ with the pt-BR message', () => {
    const result = cnpjZodSchema.safeParse('12345678000199');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('CNPJ inválido');
    }
  });
});
