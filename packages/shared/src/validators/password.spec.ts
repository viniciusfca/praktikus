import { describe, it, expect } from 'vitest';
import { evaluatePassword, strongPasswordZodSchema } from './password';

describe('evaluatePassword', () => {
  it('returns weak with no criteria for empty string', () => {
    const r = evaluatePassword('');
    expect(r.metCount).toBe(0);
    expect(r.strength).toBe('weak');
    expect(r.isValid).toBe(false);
    expect(r.criteria).toEqual({
      minLength: false,
      lowercase: false,
      uppercase: false,
      number: false,
      specialChar: false,
    });
  });

  it('detects each criterion individually', () => {
    expect(evaluatePassword('12345678').criteria).toMatchObject({
      minLength: true, number: true, lowercase: false, uppercase: false, specialChar: false,
    });
    expect(evaluatePassword('abcdefgh').criteria).toMatchObject({
      minLength: true, lowercase: true, uppercase: false, number: false, specialChar: false,
    });
    expect(evaluatePassword('ABCDEFGH').criteria).toMatchObject({
      minLength: true, uppercase: true, lowercase: false, number: false, specialChar: false,
    });
    expect(evaluatePassword('!@#$%^&*').criteria).toMatchObject({
      minLength: true, specialChar: true, lowercase: false, uppercase: false, number: false,
    });
  });

  it('classifies strength by metCount', () => {
    expect(evaluatePassword('a').strength).toBe('weak');
    expect(evaluatePassword('aB').strength).toBe('weak');
    expect(evaluatePassword('aB1').strength).toBe('medium');
    expect(evaluatePassword('aB1!').strength).toBe('medium');
    expect(evaluatePassword('aB1!aB1!').strength).toBe('strong');
  });

  it('isValid is true only when all five criteria are met', () => {
    expect(evaluatePassword('aB1!aB1!').isValid).toBe(true);
    expect(evaluatePassword('aB1aB1aa').isValid).toBe(false);
    expect(evaluatePassword('aB!aB!aa').isValid).toBe(false);
  });

  it('treats space and unicode-ish chars as special', () => {
    expect(evaluatePassword('Aa1 aaaa').criteria.specialChar).toBe(true);
  });
});

describe('strongPasswordZodSchema', () => {
  it('accepts a strong password', () => {
    expect(strongPasswordZodSchema.safeParse('Strong1!Pass').success).toBe(true);
  });

  it('rejects a weak password with the generic message', () => {
    const result = strongPasswordZodSchema.safeParse('weakpass');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Senha não atende a todos os critérios');
    }
  });
});
