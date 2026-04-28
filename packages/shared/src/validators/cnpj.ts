import { z } from 'zod';
import { stripDigits } from '../utils/strip-digits';

const FIRST_WEIGHTS = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const SECOND_WEIGHTS = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

function computeDigit(digits: string, weights: number[]): number {
  let sum = 0;
  for (let i = 0; i < weights.length; i++) {
    sum += parseInt(digits[i], 10) * weights[i];
  }
  const remainder = sum % 11;
  return remainder < 2 ? 0 : 11 - remainder;
}

export function isValidCnpj(value: string): boolean {
  if (typeof value !== 'string') return false;
  const digits = stripDigits(value);
  if (digits.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(digits)) return false;

  const dv1 = computeDigit(digits.slice(0, 12), FIRST_WEIGHTS);
  if (dv1 !== parseInt(digits[12], 10)) return false;

  const dv2 = computeDigit(digits.slice(0, 13), SECOND_WEIGHTS);
  if (dv2 !== parseInt(digits[13], 10)) return false;

  return true;
}

export const cnpjZodSchema = z
  .string()
  .transform(stripDigits)
  .refine(isValidCnpj, { message: 'CNPJ inválido' });
