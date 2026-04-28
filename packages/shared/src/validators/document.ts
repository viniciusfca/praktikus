import { z } from 'zod';
import { stripDigits } from '../utils/strip-digits';
import { isValidCpf } from './cpf';
import { isValidCnpj } from './cnpj';

export function isValidDocument(value: string): boolean {
  if (typeof value !== 'string') return false;
  const digits = stripDigits(value);
  if (digits.length === 11) return isValidCpf(digits);
  if (digits.length === 14) return isValidCnpj(digits);
  return false;
}

export const cpfOrCnpjZodSchema = z
  .string()
  .transform(stripDigits)
  .refine(isValidDocument, { message: 'CPF ou CNPJ inválido' });
