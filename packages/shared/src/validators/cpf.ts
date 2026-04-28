import { z } from 'zod';
import { stripDigits } from '../utils/strip-digits';

function computeDigit(digits: string, factor: number): number {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    sum += parseInt(digits[i], 10) * (factor - i);
  }
  const remainder = sum % 11;
  return remainder < 2 ? 0 : 11 - remainder;
}

export function isValidCpf(value: string): boolean {
  if (typeof value !== 'string') return false;
  const digits = stripDigits(value);
  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;

  const dv1 = computeDigit(digits.slice(0, 9), 10);
  if (dv1 !== parseInt(digits[9], 10)) return false;

  const dv2 = computeDigit(digits.slice(0, 10), 11);
  if (dv2 !== parseInt(digits[10], 10)) return false;

  return true;
}

export const cpfZodSchema = z
  .string()
  .transform(stripDigits)
  .refine(isValidCpf, { message: 'CPF inválido' });
