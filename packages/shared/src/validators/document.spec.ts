import { describe, it, expect } from 'vitest';
import { isValidDocument, cpfOrCnpjZodSchema } from './document';

describe('isValidDocument', () => {
  it('accepts a valid CPF (11 digits)', () => {
    expect(isValidDocument('52998224725')).toBe(true);
  });

  it('accepts a valid CNPJ (14 digits)', () => {
    expect(isValidDocument('11222333000181')).toBe(true);
  });

  it('rejects 10-digit input', () => {
    expect(isValidDocument('1234567890')).toBe(false);
  });

  it('rejects 12-digit input', () => {
    expect(isValidDocument('123456789012')).toBe(false);
  });

  it('rejects 13-digit input', () => {
    expect(isValidDocument('1234567890123')).toBe(false);
  });

  it('rejects 15-digit input', () => {
    expect(isValidDocument('123456789012345')).toBe(false);
  });

  it('rejects empty and non-string input', () => {
    expect(isValidDocument('')).toBe(false);
    expect(isValidDocument(null as unknown as string)).toBe(false);
  });

  it('rejects 11 digits with bad CPF DV', () => {
    expect(isValidDocument('12345678900')).toBe(false);
  });

  it('rejects 14 digits with bad CNPJ DV', () => {
    expect(isValidDocument('12345678000199')).toBe(false);
  });
});

describe('cpfOrCnpjZodSchema', () => {
  it('accepts valid CPF or CNPJ with mask', () => {
    expect(cpfOrCnpjZodSchema.safeParse('529.982.247-25').success).toBe(true);
    expect(cpfOrCnpjZodSchema.safeParse('11.222.333/0001-81').success).toBe(true);
  });

  it('rejects with the combined message', () => {
    const result = cpfOrCnpjZodSchema.safeParse('1234567890');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('CPF ou CNPJ inválido');
    }
  });
});
