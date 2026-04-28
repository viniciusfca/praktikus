import { z } from 'zod';

export type PasswordCriterion =
  | 'minLength'
  | 'lowercase'
  | 'uppercase'
  | 'number'
  | 'specialChar';

export type PasswordStrength = 'weak' | 'medium' | 'strong';

export interface PasswordEvaluation {
  criteria: Record<PasswordCriterion, boolean>;
  metCount: number;
  strength: PasswordStrength;
  isValid: boolean;
}

export const PASSWORD_MIN_LENGTH = 8;

export function evaluatePassword(value: string): PasswordEvaluation {
  const safe = typeof value === 'string' ? value : '';

  const criteria: Record<PasswordCriterion, boolean> = {
    minLength: safe.length >= PASSWORD_MIN_LENGTH,
    lowercase: /[a-z]/.test(safe),
    uppercase: /[A-Z]/.test(safe),
    number: /[0-9]/.test(safe),
    specialChar: /[^A-Za-z0-9]/.test(safe),
  };

  const metCount = Object.values(criteria).filter(Boolean).length;

  let strength: PasswordStrength;
  if (metCount <= 2) strength = 'weak';
  else if (metCount <= 4) strength = 'medium';
  else strength = 'strong';

  return { criteria, metCount, strength, isValid: metCount === 5 };
}

export const strongPasswordZodSchema = z
  .string()
  .refine((v) => evaluatePassword(v).isValid, {
    message: 'Senha não atende a todos os critérios',
  });
