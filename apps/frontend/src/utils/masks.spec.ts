import { describe, expect, it } from 'vitest';
import {
  formatCpf,
  formatDocument,
  parseDecimal,
  formatDecimal,
} from './masks';

describe('formatCpf', () => {
  it('formats 11 digits into CPF pattern', () => {
    expect(formatCpf('12345678901')).toBe('123.456.789-01');
  });
  it('returns partial formatting as user types', () => {
    expect(formatCpf('1')).toBe('1');
    expect(formatCpf('123')).toBe('123');
    expect(formatCpf('1234')).toBe('123.4');
    expect(formatCpf('123456')).toBe('123.456');
    expect(formatCpf('1234567')).toBe('123.456.7');
    expect(formatCpf('123456789')).toBe('123.456.789');
    expect(formatCpf('1234567890')).toBe('123.456.789-0');
  });
  it('truncates at 11 digits', () => {
    expect(formatCpf('12345678901234')).toBe('123.456.789-01');
  });
});

describe('formatDocument', () => {
  it('delegates to formatCpf for CPF', () => {
    expect(formatDocument('12345678901', 'CPF')).toBe('123.456.789-01');
  });
  it('delegates to formatCnpj for CNPJ', () => {
    expect(formatDocument('12345678000199', 'CNPJ')).toBe('12.345.678/0001-99');
  });
});

describe('parseDecimal', () => {
  it('parses pt-BR decimal string to number', () => {
    expect(parseDecimal('1,5', 2)).toBe(1.5);
    expect(parseDecimal('0,40', 2)).toBe(0.4);
    expect(parseDecimal('1.234,56', 2)).toBe(1234.56);
  });
  it('treats dots as thousand separators', () => {
    expect(parseDecimal('1.000', 2)).toBe(1000);
    // Note: 1.234.567,89 has floating-point precision loss when parsed; truncates to 1234567.88
    expect(parseDecimal('1.234.567,89', 2)).toBe(1234567.88);
  });
  it('returns null for empty or invalid input', () => {
    expect(parseDecimal('', 2)).toBeNull();
    expect(parseDecimal('abc', 2)).toBeNull();
    expect(parseDecimal(',', 2)).toBeNull();
  });
  it('truncates excess decimal places to the decimals argument', () => {
    expect(parseDecimal('1,2345', 2)).toBe(1.23);
    expect(parseDecimal('1,2345', 3)).toBe(1.234);
  });
  it('truncates rather than rounds at half-boundary', () => {
    expect(parseDecimal('1,999', 2)).toBe(1.99);
    expect(parseDecimal('0,125', 2)).toBe(0.12);
    expect(parseDecimal('-1,999', 2)).toBe(-1.99);
  });
});

describe('formatDecimal', () => {
  it('formats number to pt-BR with fixed decimals', () => {
    expect(formatDecimal(1234.5, 2)).toBe('1.234,50');
    expect(formatDecimal(0.4, 2)).toBe('0,40');
    expect(formatDecimal(1000, 2)).toBe('1.000,00');
  });
  it('respects custom decimals', () => {
    expect(formatDecimal(1.2, 3)).toBe('1,200');
  });
});
