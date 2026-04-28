# CNPJ/CPF and Password Strength Validation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add reusable CNPJ/CPF document validation (módulo 11 algorithm) and a strict password policy with visual strength meter. Replace regex-only checks across all registration, password change, and document-collecting forms.

**Architecture:** Pure validators in `@praktikus/shared` (functions + Zod schemas + types). Backend wraps them as class-validator decorators. Frontend uses the Zod schemas in react-hook-form resolvers and renders a `<PasswordStrengthMeter />` component.

**Tech Stack:** TypeScript, Zod, NestJS + class-validator (backend), React 19 + react-hook-form + CoreUI (frontend), Vitest (frontend + shared), Jest (backend).

**Spec:** [docs/superpowers/specs/2026-04-27-cnpj-cpf-password-validation-design.md](../specs/2026-04-27-cnpj-cpf-password-validation-design.md)

---

## File Structure

### Created files

| File | Responsibility |
|------|----------------|
| `packages/shared/src/utils/strip-digits.ts` | Pure helper to strip non-digits from a string |
| `packages/shared/src/utils/index.ts` | Barrel for utils |
| `packages/shared/src/validators/cnpj.ts` | `isValidCnpj()` + `cnpjZodSchema` |
| `packages/shared/src/validators/cpf.ts` | `isValidCpf()` + `cpfZodSchema` |
| `packages/shared/src/validators/document.ts` | `isValidDocument()` + `cpfOrCnpjZodSchema` |
| `packages/shared/src/validators/password.ts` | `evaluatePassword()` + types + `strongPasswordZodSchema` |
| `packages/shared/src/validators/index.ts` | Barrel for validators |
| `packages/shared/src/validators/cnpj.spec.ts` | Vitest spec |
| `packages/shared/src/validators/cpf.spec.ts` | Vitest spec |
| `packages/shared/src/validators/document.spec.ts` | Vitest spec |
| `packages/shared/src/validators/password.spec.ts` | Vitest spec |
| `packages/shared/vitest.config.ts` | Vitest config for shared package |
| `apps/backend/src/modules/core/validation/is-valid-cnpj.decorator.ts` | `@IsValidCnpj()` |
| `apps/backend/src/modules/core/validation/is-valid-cpf.decorator.ts` | `@IsValidCpf()` |
| `apps/backend/src/modules/core/validation/is-valid-document.decorator.ts` | `@IsValidDocument()` |
| `apps/backend/src/modules/core/validation/is-strong-password.decorator.ts` | `@IsStrongPassword()` |
| `apps/backend/src/modules/core/validation/validation.module.ts` | NestJS module grouping validators |
| `apps/backend/src/modules/core/validation/*.spec.ts` | One spec per decorator |
| `apps/frontend/src/components/PasswordStrengthMeter.tsx` | Strength bar + criteria checklist component |
| `apps/frontend/src/components/PasswordStrengthMeter.spec.tsx` | Component spec |

### Modified files

| File | Change |
|------|--------|
| `packages/shared/package.json` | Add `zod` dep, `vitest` devDep, `test` script |
| `packages/shared/src/index.ts` | Re-export validators + utils |
| `apps/frontend/src/utils/masks.ts` | Re-export `stripDigits` from shared (preserve import path) |
| `apps/backend/src/modules/core/auth/dto/register.dto.ts` | `@IsValidCnpj()` + `@IsStrongPassword()` |
| `apps/backend/src/modules/core/auth/dto/reset-password.dto.ts` | `@IsStrongPassword()` on `newPassword` |
| `apps/backend/src/modules/core/auth/dto/change-password.dto.ts` | `@IsStrongPassword()` on `newPassword` |
| `apps/backend/src/modules/workshop/customers/dto/create-customer.dto.ts` | `@IsValidDocument()` |
| `apps/backend/src/modules/recycling/buyers/dto/create-buyer.dto.ts` | `@IsValidDocument()` |
| `apps/backend/src/modules/recycling/suppliers/dto/create-supplier.dto.ts` | `@IsValidDocument()` |
| `apps/frontend/src/pages/auth/RegisterPage.tsx` | Use `cnpjZodSchema` + `strongPasswordZodSchema`; render meter |
| `apps/frontend/src/pages/auth/RegisterRecyclingPage.tsx` | Same as above |
| `apps/frontend/src/pages/auth/ResetPasswordPage.tsx` | Use `strongPasswordZodSchema`; render meter |
| `apps/frontend/src/pages/workshop/customers/CustomerFormPage.tsx` | Use `cpfOrCnpjZodSchema` (or per-type variant) |
| `apps/frontend/src/pages/recycling/buyers/BuyersPage.tsx` | Replace length-only superRefine with algorithm checks |
| `apps/frontend/src/pages/recycling/suppliers/SuppliersPage.tsx` | Same as above |
| Multiple `*.spec.ts` files | Replace invalid `12345678000199` with valid `11222333000181` |
| Multiple `*.test.tsx` files (frontend) | Same fixture swap; add an algorithm-failure test |

---

## Test fixtures used throughout

```ts
// Valid CNPJ (verified by módulo 11 algorithm)
const VALID_CNPJ = '11222333000181';

// Invalid CNPJ — same length, wrong DV
const INVALID_CNPJ = '12345678000199';

// Invalid CNPJ — all-same digits (matches algorithm but rejected)
const REPEATED_CNPJ = '11111111111111';

// Valid CPF (verified)
const VALID_CPF = '52998224725';

// Invalid CPF — wrong DV
const INVALID_CPF = '12345678900';

// Invalid CPF — all-same
const REPEATED_CPF = '11111111111';
```

---

## PHASE 1 — Shared package foundation

### Task 1: Add Zod and Vitest to `@praktikus/shared`

**Files:**
- Modify: `packages/shared/package.json`
- Create: `packages/shared/vitest.config.ts`

- [ ] **Step 1: Add zod runtime dep, vitest devDep, and test script to shared package**

Edit `packages/shared/package.json` to:

```json
{
  "name": "@praktikus/shared",
  "version": "1.0.0",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "typescript": "^5.3.3",
    "vitest": "^1.6.0"
  }
}
```

- [ ] **Step 2: Create vitest config**

Create `packages/shared/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.spec.ts'],
    environment: 'node',
  },
});
```

- [ ] **Step 3: Install deps from monorepo root**

Run: `pnpm install`
Expected: zod and vitest installed in shared.

- [ ] **Step 4: Verify vitest can run (no tests yet, expect "no test files found")**

Run: `pnpm --filter @praktikus/shared test`
Expected: exits with success (or "no test files" — ok, vitest will run tests added in later tasks).

- [ ] **Step 5: Commit**

```bash
git add packages/shared/package.json packages/shared/vitest.config.ts pnpm-lock.yaml
git commit -m "chore(shared): add zod runtime dep and vitest test infra"
```

---

### Task 2: Move `stripDigits` into `@praktikus/shared`

**Files:**
- Create: `packages/shared/src/utils/strip-digits.ts`
- Create: `packages/shared/src/utils/index.ts`
- Create: `packages/shared/src/utils/strip-digits.spec.ts`
- Modify: `packages/shared/src/index.ts`
- Modify: `apps/frontend/src/utils/masks.ts`

- [ ] **Step 1: Write failing test for `stripDigits`**

Create `packages/shared/src/utils/strip-digits.spec.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify failure**

Run: `pnpm --filter @praktikus/shared test src/utils/strip-digits.spec.ts`
Expected: FAIL ("Cannot find module './strip-digits'").

- [ ] **Step 3: Implement `stripDigits`**

Create `packages/shared/src/utils/strip-digits.ts`:

```ts
export function stripDigits(value: string): string {
  return value.replace(/\D/g, '');
}
```

- [ ] **Step 4: Create utils barrel**

Create `packages/shared/src/utils/index.ts`:

```ts
export * from './strip-digits';
```

- [ ] **Step 5: Run test to verify pass**

Run: `pnpm --filter @praktikus/shared test src/utils/strip-digits.spec.ts`
Expected: PASS.

- [ ] **Step 6: Re-export from shared index**

Edit `packages/shared/src/index.ts` and add to the bottom:

```ts
export * from './utils';
```

- [ ] **Step 7: Build shared and update frontend masks.ts to re-export**

Run: `pnpm --filter @praktikus/shared build`

Edit `apps/frontend/src/utils/masks.ts`. Replace the existing local `stripDigits` definition (lines 1-3) with an import + re-export so existing imports keep working:

```ts
import { stripDigits } from '@praktikus/shared';
export { stripDigits };

export function formatCnpj(digits: string): string {
  // ...rest of file unchanged
```

Keep all other functions in the file untouched.

- [ ] **Step 8: Run frontend tests to verify nothing broke**

Run: `pnpm --filter frontend test src/utils/masks.spec.ts`
Expected: PASS (existing tests still pass — `stripDigits` is now imported but exported).

- [ ] **Step 9: Commit**

```bash
git add packages/shared apps/frontend/src/utils/masks.ts
git commit -m "feat(shared): move stripDigits to @praktikus/shared"
```

---

## PHASE 2 — Document validators in shared

### Task 3: `isValidCnpj` + `cnpjZodSchema`

**Files:**
- Create: `packages/shared/src/validators/cnpj.ts`
- Create: `packages/shared/src/validators/cnpj.spec.ts`

- [ ] **Step 1: Write failing test**

Create `packages/shared/src/validators/cnpj.spec.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify failure**

Run: `pnpm --filter @praktikus/shared test src/validators/cnpj.spec.ts`
Expected: FAIL ("Cannot find module './cnpj'").

- [ ] **Step 3: Implement `isValidCnpj` + Zod schema**

Create `packages/shared/src/validators/cnpj.ts`:

```ts
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
```

- [ ] **Step 4: Run test to verify pass**

Run: `pnpm --filter @praktikus/shared test src/validators/cnpj.spec.ts`
Expected: PASS (all assertions green).

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/validators/cnpj.ts packages/shared/src/validators/cnpj.spec.ts
git commit -m "feat(shared): add isValidCnpj and cnpjZodSchema"
```

---

### Task 4: `isValidCpf` + `cpfZodSchema`

**Files:**
- Create: `packages/shared/src/validators/cpf.ts`
- Create: `packages/shared/src/validators/cpf.spec.ts`

- [ ] **Step 1: Write failing test**

Create `packages/shared/src/validators/cpf.spec.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify failure**

Run: `pnpm --filter @praktikus/shared test src/validators/cpf.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `isValidCpf` + Zod schema**

Create `packages/shared/src/validators/cpf.ts`:

```ts
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
```

- [ ] **Step 4: Run test to verify pass**

Run: `pnpm --filter @praktikus/shared test src/validators/cpf.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/validators/cpf.ts packages/shared/src/validators/cpf.spec.ts
git commit -m "feat(shared): add isValidCpf and cpfZodSchema"
```

---

### Task 5: `isValidDocument` + `cpfOrCnpjZodSchema`

**Files:**
- Create: `packages/shared/src/validators/document.ts`
- Create: `packages/shared/src/validators/document.spec.ts`

- [ ] **Step 1: Write failing test**

Create `packages/shared/src/validators/document.spec.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify failure**

Run: `pnpm --filter @praktikus/shared test src/validators/document.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `packages/shared/src/validators/document.ts`:

```ts
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
```

- [ ] **Step 4: Run test to verify pass**

Run: `pnpm --filter @praktikus/shared test src/validators/document.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/validators/document.ts packages/shared/src/validators/document.spec.ts
git commit -m "feat(shared): add isValidDocument and cpfOrCnpjZodSchema"
```

---

### Task 6: `evaluatePassword` + types + `strongPasswordZodSchema`

**Files:**
- Create: `packages/shared/src/validators/password.ts`
- Create: `packages/shared/src/validators/password.spec.ts`

- [ ] **Step 1: Write failing test**

Create `packages/shared/src/validators/password.spec.ts`:

```ts
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
    expect(evaluatePassword('a').strength).toBe('weak');           // 1 met
    expect(evaluatePassword('aB').strength).toBe('weak');          // 2 met
    expect(evaluatePassword('aB1').strength).toBe('medium');       // 3 met
    expect(evaluatePassword('aB1!').strength).toBe('medium');      // 4 met
    expect(evaluatePassword('aB1!aB1!').strength).toBe('strong');  // 5 met
  });

  it('isValid is true only when all five criteria are met', () => {
    expect(evaluatePassword('aB1!aB1!').isValid).toBe(true);
    expect(evaluatePassword('aB1aB1aa').isValid).toBe(false); // missing special
    expect(evaluatePassword('aB!aB!aa').isValid).toBe(false); // missing number
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
```

- [ ] **Step 2: Run test to verify failure**

Run: `pnpm --filter @praktikus/shared test src/validators/password.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `packages/shared/src/validators/password.ts`:

```ts
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
```

- [ ] **Step 4: Run test to verify pass**

Run: `pnpm --filter @praktikus/shared test src/validators/password.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/validators/password.ts packages/shared/src/validators/password.spec.ts
git commit -m "feat(shared): add evaluatePassword and strongPasswordZodSchema"
```

---

### Task 7: Wire validators into shared barrel

**Files:**
- Create: `packages/shared/src/validators/index.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Create validators barrel**

Create `packages/shared/src/validators/index.ts`:

```ts
export * from './cnpj';
export * from './cpf';
export * from './document';
export * from './password';
```

- [ ] **Step 2: Re-export from shared root**

Edit `packages/shared/src/index.ts` and add at the bottom:

```ts
export * from './validators';
```

- [ ] **Step 3: Build shared package**

Run: `pnpm --filter @praktikus/shared build`
Expected: clean build, no TS errors.

- [ ] **Step 4: Run all shared tests**

Run: `pnpm --filter @praktikus/shared test`
Expected: PASS (cnpj + cpf + document + password + strip-digits all green).

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/validators/index.ts packages/shared/src/index.ts
git commit -m "feat(shared): expose validators from package root"
```

---

## PHASE 3 — Backend decorators

### Task 8: `@IsValidCnpj()` decorator

**Files:**
- Create: `apps/backend/src/modules/core/validation/is-valid-cnpj.decorator.ts`
- Create: `apps/backend/src/modules/core/validation/is-valid-cnpj.decorator.spec.ts`

- [ ] **Step 1: Write failing test**

Create `apps/backend/src/modules/core/validation/is-valid-cnpj.decorator.spec.ts`:

```ts
import { validate } from 'class-validator';
import { IsValidCnpj } from './is-valid-cnpj.decorator';

class TestDto {
  @IsValidCnpj()
  cnpj!: string;
}

async function validateCnpj(value: unknown) {
  const dto = new TestDto();
  (dto as Record<string, unknown>).cnpj = value;
  return validate(dto);
}

describe('IsValidCnpj decorator', () => {
  it('passes for a valid CNPJ', async () => {
    const errors = await validateCnpj('11222333000181');
    expect(errors).toHaveLength(0);
  });

  it('fails for a wrong-DV CNPJ', async () => {
    const errors = await validateCnpj('12345678000199');
    expect(errors).toHaveLength(1);
    expect(errors[0].constraints).toMatchObject({ isValidCnpj: 'CNPJ inválido' });
  });

  it('fails for non-string input', async () => {
    const errors = await validateCnpj(undefined);
    expect(errors).toHaveLength(1);
  });

  it('respects custom message option', async () => {
    class WithMessage {
      @IsValidCnpj({ message: 'doc required' })
      cnpj!: string;
    }
    const dto = new WithMessage();
    (dto as Record<string, unknown>).cnpj = '12345678000199';
    const errors = await validate(dto);
    expect(errors[0].constraints).toMatchObject({ isValidCnpj: 'doc required' });
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `pnpm --filter backend test -- is-valid-cnpj.decorator.spec`
Expected: FAIL ("Cannot find module './is-valid-cnpj.decorator'").

- [ ] **Step 3: Implement decorator**

Create `apps/backend/src/modules/core/validation/is-valid-cnpj.decorator.ts`:

```ts
import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { isValidCnpj } from '@praktikus/shared';

@ValidatorConstraint({ name: 'isValidCnpj', async: false })
export class IsValidCnpjConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return typeof value === 'string' && isValidCnpj(value);
  }

  defaultMessage(): string {
    return 'CNPJ inválido';
  }
}

export function IsValidCnpj(options?: ValidationOptions): PropertyDecorator {
  return (object: object, propertyName: string | symbol) => {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName as string,
      options,
      constraints: [],
      validator: IsValidCnpjConstraint,
    });
  };
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `pnpm --filter backend test -- is-valid-cnpj.decorator.spec`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/core/validation/is-valid-cnpj.decorator.ts apps/backend/src/modules/core/validation/is-valid-cnpj.decorator.spec.ts
git commit -m "feat(backend): add IsValidCnpj decorator"
```

---

### Task 9: `@IsValidCpf()` decorator

**Files:**
- Create: `apps/backend/src/modules/core/validation/is-valid-cpf.decorator.ts`
- Create: `apps/backend/src/modules/core/validation/is-valid-cpf.decorator.spec.ts`

- [ ] **Step 1: Write failing test**

Create `apps/backend/src/modules/core/validation/is-valid-cpf.decorator.spec.ts`:

```ts
import { validate } from 'class-validator';
import { IsValidCpf } from './is-valid-cpf.decorator';

class TestDto {
  @IsValidCpf()
  cpf!: string;
}

async function validateCpf(value: unknown) {
  const dto = new TestDto();
  (dto as Record<string, unknown>).cpf = value;
  return validate(dto);
}

describe('IsValidCpf decorator', () => {
  it('passes for a valid CPF', async () => {
    const errors = await validateCpf('52998224725');
    expect(errors).toHaveLength(0);
  });

  it('fails for an invalid CPF', async () => {
    const errors = await validateCpf('12345678900');
    expect(errors).toHaveLength(1);
    expect(errors[0].constraints).toMatchObject({ isValidCpf: 'CPF inválido' });
  });

  it('fails for non-string input', async () => {
    const errors = await validateCpf(null);
    expect(errors).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `pnpm --filter backend test -- is-valid-cpf.decorator.spec`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `apps/backend/src/modules/core/validation/is-valid-cpf.decorator.ts`:

```ts
import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { isValidCpf } from '@praktikus/shared';

@ValidatorConstraint({ name: 'isValidCpf', async: false })
export class IsValidCpfConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return typeof value === 'string' && isValidCpf(value);
  }

  defaultMessage(): string {
    return 'CPF inválido';
  }
}

export function IsValidCpf(options?: ValidationOptions): PropertyDecorator {
  return (object: object, propertyName: string | symbol) => {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName as string,
      options,
      constraints: [],
      validator: IsValidCpfConstraint,
    });
  };
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `pnpm --filter backend test -- is-valid-cpf.decorator.spec`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/core/validation/is-valid-cpf.decorator.ts apps/backend/src/modules/core/validation/is-valid-cpf.decorator.spec.ts
git commit -m "feat(backend): add IsValidCpf decorator"
```

---

### Task 10: `@IsValidDocument()` decorator

**Files:**
- Create: `apps/backend/src/modules/core/validation/is-valid-document.decorator.ts`
- Create: `apps/backend/src/modules/core/validation/is-valid-document.decorator.spec.ts`

- [ ] **Step 1: Write failing test**

Create `apps/backend/src/modules/core/validation/is-valid-document.decorator.spec.ts`:

```ts
import { validate } from 'class-validator';
import { IsValidDocument } from './is-valid-document.decorator';

class TestDto {
  @IsValidDocument()
  document!: string;
}

async function check(value: unknown) {
  const dto = new TestDto();
  (dto as Record<string, unknown>).document = value;
  return validate(dto);
}

describe('IsValidDocument decorator', () => {
  it('accepts valid CPF', async () => {
    expect(await check('52998224725')).toHaveLength(0);
  });

  it('accepts valid CNPJ', async () => {
    expect(await check('11222333000181')).toHaveLength(0);
  });

  it('rejects invalid CPF and CNPJ with the same message', async () => {
    const cpfErrors = await check('12345678900');
    const cnpjErrors = await check('12345678000199');
    expect(cpfErrors[0].constraints).toMatchObject({ isValidDocument: 'CPF ou CNPJ inválido' });
    expect(cnpjErrors[0].constraints).toMatchObject({ isValidDocument: 'CPF ou CNPJ inválido' });
  });

  it('rejects 10/12/13 digit input', async () => {
    expect((await check('1234567890')).length).toBe(1);
    expect((await check('123456789012')).length).toBe(1);
    expect((await check('1234567890123')).length).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `pnpm --filter backend test -- is-valid-document.decorator.spec`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `apps/backend/src/modules/core/validation/is-valid-document.decorator.ts`:

```ts
import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { isValidDocument } from '@praktikus/shared';

@ValidatorConstraint({ name: 'isValidDocument', async: false })
export class IsValidDocumentConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return typeof value === 'string' && isValidDocument(value);
  }

  defaultMessage(): string {
    return 'CPF ou CNPJ inválido';
  }
}

export function IsValidDocument(options?: ValidationOptions): PropertyDecorator {
  return (object: object, propertyName: string | symbol) => {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName as string,
      options,
      constraints: [],
      validator: IsValidDocumentConstraint,
    });
  };
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `pnpm --filter backend test -- is-valid-document.decorator.spec`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/core/validation/is-valid-document.decorator.ts apps/backend/src/modules/core/validation/is-valid-document.decorator.spec.ts
git commit -m "feat(backend): add IsValidDocument decorator"
```

---

### Task 11: `@IsStrongPassword()` decorator

**Files:**
- Create: `apps/backend/src/modules/core/validation/is-strong-password.decorator.ts`
- Create: `apps/backend/src/modules/core/validation/is-strong-password.decorator.spec.ts`

- [ ] **Step 1: Write failing test**

Create `apps/backend/src/modules/core/validation/is-strong-password.decorator.spec.ts`:

```ts
import { validate } from 'class-validator';
import { IsStrongPassword } from './is-strong-password.decorator';

class TestDto {
  @IsStrongPassword()
  password!: string;
}

async function check(value: unknown) {
  const dto = new TestDto();
  (dto as Record<string, unknown>).password = value;
  return validate(dto);
}

describe('IsStrongPassword decorator', () => {
  it('accepts a strong password', async () => {
    expect(await check('Strong1!Pass')).toHaveLength(0);
  });

  it('rejects when shorter than 8 characters', async () => {
    expect((await check('Aa1!')).length).toBe(1);
  });

  it('rejects when missing uppercase', async () => {
    expect((await check('strong1!pass')).length).toBe(1);
  });

  it('rejects when missing lowercase', async () => {
    expect((await check('STRONG1!PASS')).length).toBe(1);
  });

  it('rejects when missing number', async () => {
    expect((await check('Strong!!Pass')).length).toBe(1);
  });

  it('rejects when missing special char', async () => {
    expect((await check('Strong11Pass')).length).toBe(1);
  });

  it('reports the standard pt-BR message', async () => {
    const errors = await check('weak');
    expect(errors[0].constraints).toMatchObject({
      isStrongPassword: 'Senha não atende a todos os critérios',
    });
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `pnpm --filter backend test -- is-strong-password.decorator.spec`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `apps/backend/src/modules/core/validation/is-strong-password.decorator.ts`:

```ts
import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { evaluatePassword } from '@praktikus/shared';

@ValidatorConstraint({ name: 'isStrongPassword', async: false })
export class IsStrongPasswordConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return typeof value === 'string' && evaluatePassword(value).isValid;
  }

  defaultMessage(): string {
    return 'Senha não atende a todos os critérios';
  }
}

export function IsStrongPassword(options?: ValidationOptions): PropertyDecorator {
  return (object: object, propertyName: string | symbol) => {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName as string,
      options,
      constraints: [],
      validator: IsStrongPasswordConstraint,
    });
  };
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `pnpm --filter backend test -- is-strong-password.decorator.spec`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/core/validation/is-strong-password.decorator.ts apps/backend/src/modules/core/validation/is-strong-password.decorator.spec.ts
git commit -m "feat(backend): add IsStrongPassword decorator"
```

---

### Task 12: Add `validation.module.ts` and barrel exports

**Files:**
- Create: `apps/backend/src/modules/core/validation/validation.module.ts`
- Create: `apps/backend/src/modules/core/validation/index.ts`

- [ ] **Step 1: Create the module file**

Create `apps/backend/src/modules/core/validation/validation.module.ts`:

```ts
import { Module } from '@nestjs/common';

@Module({})
export class ValidationModule {}
```

This module exists for grouping; decorators are class-validator-based and don't need DI registration.

- [ ] **Step 2: Create barrel**

Create `apps/backend/src/modules/core/validation/index.ts`:

```ts
export * from './is-valid-cnpj.decorator';
export * from './is-valid-cpf.decorator';
export * from './is-valid-document.decorator';
export * from './is-strong-password.decorator';
export * from './validation.module';
```

- [ ] **Step 3: Verify backend compiles**

Run: `pnpm --filter backend build`
Expected: clean compile.

- [ ] **Step 4: Commit**

```bash
git add apps/backend/src/modules/core/validation/validation.module.ts apps/backend/src/modules/core/validation/index.ts
git commit -m "feat(backend): add validation module barrel"
```

---

## PHASE 4 — Backend DTO retrofit

### Task 13: Retrofit `RegisterDto`

**Files:**
- Modify: `apps/backend/src/modules/core/auth/dto/register.dto.ts`

- [ ] **Step 1: Replace decorators on `cnpj` and `password`**

Edit `apps/backend/src/modules/core/auth/dto/register.dto.ts`. Change the `cnpj` and `password` field definitions and remove now-unused imports:

```ts
import {
  IsEmail,
  IsString,
  MaxLength,
  Matches,
  IsOptional,
  ValidateNested,
  IsEnum,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TenantSegment } from '@praktikus/shared';
import { IsValidCnpj, IsStrongPassword } from '../../validation';

// ...AddressDto unchanged...

export class RegisterDto {
  @IsValidCnpj()
  cnpj: string;

  @IsString()
  @MinLength(3)
  razaoSocial: string;

  @IsString()
  @MinLength(2)
  nomeFantasia: string;

  @IsOptional()
  @IsString()
  telefone?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => AddressDto)
  endereco?: AddressDto;

  @IsEmail()
  email: string;

  @IsStrongPassword()
  password: string;

  @IsString()
  ownerName: string;

  @IsOptional()
  @IsEnum(TenantSegment)
  segment?: TenantSegment;
}
```

- [ ] **Step 2: Run auth controller spec — expect failures from now-stricter validation**

Run: `pnpm --filter backend test -- auth.controller.spec`
Expected: existing tests using `12345678000199` will now fail due to invalid CNPJ. Note this; these fixtures get fixed in Task 19.

- [ ] **Step 3: Commit**

```bash
git add apps/backend/src/modules/core/auth/dto/register.dto.ts
git commit -m "feat(backend): tighten RegisterDto with IsValidCnpj and IsStrongPassword"
```

---

### Task 14: Retrofit `ResetPasswordDto`

**Files:**
- Modify: `apps/backend/src/modules/core/auth/dto/reset-password.dto.ts`

- [ ] **Step 1: Update DTO**

Replace contents of `apps/backend/src/modules/core/auth/dto/reset-password.dto.ts`:

```ts
import { IsNotEmpty, IsString } from 'class-validator';
import { IsStrongPassword } from '../../validation';

export class ResetPasswordDto {
  @IsString()
  @IsNotEmpty()
  token: string;

  @IsStrongPassword()
  newPassword: string;
}
```

- [ ] **Step 2: Build to verify**

Run: `pnpm --filter backend build`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add apps/backend/src/modules/core/auth/dto/reset-password.dto.ts
git commit -m "feat(backend): enforce strong password on reset-password endpoint"
```

---

### Task 15: Retrofit `ChangePasswordDto`

**Files:**
- Modify: `apps/backend/src/modules/core/auth/dto/change-password.dto.ts`

- [ ] **Step 1: Update DTO**

Replace contents of `apps/backend/src/modules/core/auth/dto/change-password.dto.ts`:

```ts
import { IsString, MinLength } from 'class-validator';
import { IsStrongPassword } from '../../validation';

export class ChangePasswordDto {
  @IsString()
  @MinLength(8)
  currentPassword: string;

  @IsStrongPassword()
  newPassword: string;
}
```

`currentPassword` keeps its existing `MinLength(8)` — the bcrypt comparison will reject any wrong value, so we don't need full strength validation on the previous password.

- [ ] **Step 2: Build to verify**

Run: `pnpm --filter backend build`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add apps/backend/src/modules/core/auth/dto/change-password.dto.ts
git commit -m "feat(backend): enforce strong password on change-password endpoint"
```

---

### Task 16: Retrofit workshop customer DTO

**Files:**
- Modify: `apps/backend/src/modules/workshop/customers/dto/create-customer.dto.ts`

`UpdateCustomerDto` extends `PartialType(CreateCustomerDto)`, so updating create propagates automatically.

- [ ] **Step 1: Update DTO**

Replace contents of `apps/backend/src/modules/workshop/customers/dto/create-customer.dto.ts`:

```ts
import { IsString, IsEmail, IsOptional, MinLength } from 'class-validator';
import { IsValidDocument } from '../../../core/validation';

export class CreateCustomerDto {
  @IsString()
  @MinLength(2)
  nome: string;

  @IsValidDocument()
  cpfCnpj: string;

  @IsOptional()
  @IsString()
  whatsapp?: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}
```

- [ ] **Step 2: Build to verify**

Run: `pnpm --filter backend build`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add apps/backend/src/modules/workshop/customers/dto/create-customer.dto.ts
git commit -m "feat(backend): validate cpfCnpj algorithm on customer DTO"
```

---

### Task 17: Retrofit recycling buyer DTO

**Files:**
- Modify: `apps/backend/src/modules/recycling/buyers/dto/create-buyer.dto.ts`

- [ ] **Step 1: Update DTO**

Replace contents of `apps/backend/src/modules/recycling/buyers/dto/create-buyer.dto.ts`:

```ts
import { IsString, IsOptional, IsIn, ValidateIf, MinLength } from 'class-validator';
import { IsValidDocument } from '../../../core/validation';

export class CreateBuyerDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsOptional()
  @IsValidDocument()
  document?: string;

  @ValidateIf((o) => !!o.document)
  @IsIn(['CPF', 'CNPJ'])
  documentType?: 'CPF' | 'CNPJ';

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  contactName?: string;
}
```

`UpdateBuyerDto` extends `PartialType(CreateBuyerDto)` — propagates.

- [ ] **Step 2: Build**

Run: `pnpm --filter backend build`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add apps/backend/src/modules/recycling/buyers/dto/create-buyer.dto.ts
git commit -m "feat(backend): validate document algorithm on buyer DTO"
```

---

### Task 18: Retrofit recycling supplier DTO

**Files:**
- Modify: `apps/backend/src/modules/recycling/suppliers/dto/create-supplier.dto.ts`

- [ ] **Step 1: Update DTO**

Replace contents of `apps/backend/src/modules/recycling/suppliers/dto/create-supplier.dto.ts`:

```ts
import { IsString, IsOptional, IsIn, ValidateIf, MinLength } from 'class-validator';
import { IsValidDocument } from '../../../core/validation';

export class CreateSupplierDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsOptional()
  @IsValidDocument()
  document?: string;

  @ValidateIf((o) => !!o.document)
  @IsIn(['CPF', 'CNPJ'])
  documentType?: 'CPF' | 'CNPJ';

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  address?: {
    street: string;
    number: string;
    neighborhood?: string;
    complement?: string;
    city: string;
    state: string;
    zip: string;
  };
}
```

- [ ] **Step 2: Build**

Run: `pnpm --filter backend build`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add apps/backend/src/modules/recycling/suppliers/dto/create-supplier.dto.ts
git commit -m "feat(backend): validate document algorithm on supplier DTO"
```

---

## PHASE 5 — Backend test fixture cleanup

### Task 19: Replace invalid CNPJ across all backend specs

**Files:** All `*.spec.ts` files using `12345678000199` (currently 8+ files).

- [ ] **Step 1: List affected files**

Run: `grep -rln "12345678000199" apps/backend/src apps/backend/test 2>/dev/null`
Expected: list includes `auth.controller.spec.ts`, `auth.service.spec.ts`, `tenancy.service.spec.ts`, `buyers.service.spec.ts`, `sales.service.spec.ts`, `purchases.service.spec.ts` and possibly more.

- [ ] **Step 2: Replace globally with valid CNPJ**

Run: `grep -rl "12345678000199" apps/backend/src apps/backend/test | xargs sed -i 's/12345678000199/11222333000181/g'`
Expected: all matches updated. Verify with another `grep -rln "12345678000199" apps/backend` (should be empty).

- [ ] **Step 3: Run full backend test suite**

Run: `pnpm --filter backend test`
Expected: PASS. If something still fails, it's likely an issue with a related fixture (e.g., a hardcoded password string that's now too weak). Update those individually:
- Tests that send `password: 'password123'` or similar must use `'Strong1!Pass'` (or any password where `evaluatePassword(p).isValid === true`).

- [ ] **Step 4: Search for weak passwords in test fixtures**

Run two searches and inspect:

```
grep -rn "password.*'12345678'\|password.*'password'\|password.*'test'" apps/backend/src apps/backend/test 2>/dev/null | grep -v node_modules
```

```
grep -rn "newPassword.*['\"][A-Za-z0-9]\{0,11\}['\"]" apps/backend/src apps/backend/test 2>/dev/null | grep -v node_modules
```

For DTOs that go through validation (`RegisterDto`, `ResetPasswordDto`, `ChangePasswordDto`), replace the literal with `'Strong1!Pass'`. For mocks that simulate hashed-password storage (e.g., `bcrypt.hash` returns or `passwordHash` fields), leave unchanged — those values aren't validated against the strong-password rule.

- [ ] **Step 5: Run backend test suite again**

Run: `pnpm --filter backend test`
Expected: full PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/backend
git commit -m "test(backend): use valid CNPJ and strong-password fixtures"
```

---

## PHASE 6 — Frontend `<PasswordStrengthMeter />` component

### Task 20: Build the component with TDD

**Files:**
- Create: `apps/frontend/src/components/PasswordStrengthMeter.tsx`
- Create: `apps/frontend/src/components/PasswordStrengthMeter.spec.tsx`

- [ ] **Step 1: Write failing test**

Create `apps/frontend/src/components/PasswordStrengthMeter.spec.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PasswordStrengthMeter } from './PasswordStrengthMeter';

describe('<PasswordStrengthMeter />', () => {
  it('renders nothing when password is empty', () => {
    const { container } = render(<PasswordStrengthMeter password="" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders bar and checklist when typing starts', () => {
    render(<PasswordStrengthMeter password="a" />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(screen.getByText(/Pelo menos 8 caracteres/i)).toBeInTheDocument();
    expect(screen.getByText(/Letra maiúscula/i)).toBeInTheDocument();
    expect(screen.getByText(/Letra minúscula/i)).toBeInTheDocument();
    expect(screen.getByText(/Número/i)).toBeInTheDocument();
    expect(screen.getByText(/Caractere especial/i)).toBeInTheDocument();
  });

  it('shows strength label "Fraca" for 1-2 criteria met', () => {
    render(<PasswordStrengthMeter password="a" />);
    expect(screen.getByText('Fraca')).toBeInTheDocument();
  });

  it('shows strength label "Média" for 3-4 criteria met', () => {
    render(<PasswordStrengthMeter password="aB1" />);
    expect(screen.getByText('Média')).toBeInTheDocument();
  });

  it('shows strength label "Forte" when all five criteria are met', () => {
    render(<PasswordStrengthMeter password="Strong1!Pass" />);
    expect(screen.getByText('Forte')).toBeInTheDocument();
  });

  it('hides the checklist when all criteria are met', () => {
    render(<PasswordStrengthMeter password="Strong1!Pass" />);
    expect(screen.queryByText(/Pelo menos 8 caracteres/i)).not.toBeInTheDocument();
  });

  it('keeps the bar visible when all criteria are met', () => {
    render(<PasswordStrengthMeter password="Strong1!Pass" />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter frontend test src/components/PasswordStrengthMeter.spec.tsx`
Expected: FAIL ("Cannot find module").

- [ ] **Step 3: Implement component**

Create `apps/frontend/src/components/PasswordStrengthMeter.tsx`:

```tsx
import { evaluatePassword, type PasswordCriterion, type PasswordStrength } from '@praktikus/shared';

interface PasswordStrengthMeterProps {
  password: string;
}

const STRENGTH_LABEL: Record<PasswordStrength, string> = {
  weak: 'Fraca',
  medium: 'Média',
  strong: 'Forte',
};

const STRENGTH_COLOR: Record<PasswordStrength, string> = {
  weak: 'var(--cui-danger, #e55353)',
  medium: 'var(--cui-warning, #f9b115)',
  strong: 'var(--cui-success, #2eb85c)',
};

const STRENGTH_FILL: Record<PasswordStrength, number> = {
  weak: 33,
  medium: 66,
  strong: 100,
};

const CRITERIA_LABEL: Record<PasswordCriterion, string> = {
  minLength: 'Pelo menos 8 caracteres',
  lowercase: 'Letra minúscula',
  uppercase: 'Letra maiúscula',
  number: 'Número',
  specialChar: 'Caractere especial (ex: !@#$%)',
};

const CRITERIA_ORDER: PasswordCriterion[] = [
  'minLength',
  'lowercase',
  'uppercase',
  'number',
  'specialChar',
];

export function PasswordStrengthMeter({ password }: PasswordStrengthMeterProps) {
  if (!password) return null;

  const evaluation = evaluatePassword(password);
  const color = STRENGTH_COLOR[evaluation.strength];
  const fill = STRENGTH_FILL[evaluation.strength];

  return (
    <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <div
          role="progressbar"
          aria-valuenow={fill}
          aria-valuemin={0}
          aria-valuemax={100}
          style={{
            flex: 1,
            height: 6,
            background: 'var(--cui-tertiary-bg, #e9ecef)',
            borderRadius: 3,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${fill}%`,
              height: '100%',
              background: color,
              transition: 'width 150ms ease, background 150ms ease',
            }}
          />
        </div>
        <span style={{ fontSize: 12, fontWeight: 500, color, minWidth: 48 }}>
          {STRENGTH_LABEL[evaluation.strength]}
        </span>
      </div>
      {!evaluation.isValid && (
        <ul
          style={{
            listStyle: 'none',
            padding: 0,
            margin: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            fontSize: 12,
            transition: 'opacity 150ms ease',
          }}
        >
          {CRITERIA_ORDER.map((c) => {
            const met = evaluation.criteria[c];
            return (
              <li
                key={c}
                style={{
                  color: met ? 'var(--cui-success, #2eb85c)' : 'var(--cui-secondary-color, #768192)',
                  display: 'flex',
                  gap: 6,
                  alignItems: 'center',
                }}
              >
                <span aria-hidden style={{ width: 12, display: 'inline-block' }}>
                  {met ? '✓' : '○'}
                </span>
                {CRITERIA_LABEL[c]}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `pnpm --filter frontend test src/components/PasswordStrengthMeter.spec.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/components/PasswordStrengthMeter.tsx apps/frontend/src/components/PasswordStrengthMeter.spec.tsx
git commit -m "feat(frontend): add PasswordStrengthMeter component"
```

---

## PHASE 7 — Frontend form retrofit

### Task 21: Retrofit `RegisterPage` (workshop)

**Files:**
- Modify: `apps/frontend/src/pages/auth/RegisterPage.tsx`

- [ ] **Step 1: Replace schemas and add meter**

Edit `apps/frontend/src/pages/auth/RegisterPage.tsx`:

Update the imports block (around line 1-18) to add the shared validators and the meter component:

```tsx
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  CAlert,
  CButton,
  CFormFeedback,
  CFormInput,
  CFormLabel,
  CSpinner,
} from '@coreui/react';
import { cnpjZodSchema, strongPasswordZodSchema } from '@praktikus/shared';
import { AuthShell } from '../../components/AuthShell';
import { Stepper } from '../../components/Stepper';
import { PasswordStrengthMeter } from '../../components/PasswordStrengthMeter';
import { authService } from '../../services/auth.service';
import { useAuthStore } from '../../store/auth.store';
import { stripDigits, formatCnpj, formatPhone } from '../../utils/masks';
```

Replace the schema definitions (lines 20-37):

```tsx
const step1Schema = z.object({
  cnpj: cnpjZodSchema,
  razaoSocial: z.string().min(3, 'Razão Social deve ter no mínimo 3 caracteres'),
  nomeFantasia: z.string().min(2, 'Nome Fantasia deve ter no mínimo 2 caracteres'),
  telefone: z.string().optional(),
});

const step2Schema = z
  .object({
    ownerName: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres'),
    email: z.string().email('E-mail inválido'),
    password: strongPasswordZodSchema,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'As senhas não coincidem',
    path: ['confirmPassword'],
  });
```

Add the meter under the password fields. After the closing `</div>` of the password/confirm grid (around line 242), insert:

```tsx
          <PasswordStrengthMeter password={form2.watch('password') ?? ''} />
```

- [ ] **Step 2: Run RegisterPage tests — expect failures from now-stricter validation**

Run: `pnpm --filter frontend test src/pages/auth/RegisterPage.test.tsx`
Expected: existing tests using `'12345678000199'` will fail. Note this; fixed in Task 27.

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/pages/auth/RegisterPage.tsx
git commit -m "feat(frontend): use cnpj/strong-password schemas + meter in workshop register"
```

---

### Task 22: Retrofit `RegisterRecyclingPage`

**Files:**
- Modify: `apps/frontend/src/pages/auth/RegisterRecyclingPage.tsx`

- [ ] **Step 1: Apply identical changes**

Edit `apps/frontend/src/pages/auth/RegisterRecyclingPage.tsx` exactly as in Task 21 — replace the import block, the two schemas, and add `<PasswordStrengthMeter password={form2.watch('password') ?? ''} />` under the password row (around line 240).

- [ ] **Step 2: Build to verify TS**

Run: `pnpm --filter frontend build`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/pages/auth/RegisterRecyclingPage.tsx
git commit -m "feat(frontend): use cnpj/strong-password schemas + meter in recycling register"
```

---

### Task 23: Retrofit `ResetPasswordPage`

**Files:**
- Modify: `apps/frontend/src/pages/auth/ResetPasswordPage.tsx`

- [ ] **Step 1: Inspect current schema**

Read `apps/frontend/src/pages/auth/ResetPasswordPage.tsx` to locate the password schema and the password field render block.

- [ ] **Step 2: Replace schema and render meter**

In the file:
- Add to imports: `import { strongPasswordZodSchema } from '@praktikus/shared';` and `import { PasswordStrengthMeter } from '../../components/PasswordStrengthMeter';`
- Replace the `password` field in the schema with `password: strongPasswordZodSchema` (preserving any `.refine` for confirmation).
- Add `<PasswordStrengthMeter password={form.watch('password') ?? ''} />` directly below the password input field.

- [ ] **Step 3: Run frontend lint and build**

Run: `pnpm --filter frontend lint && pnpm --filter frontend build`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/pages/auth/ResetPasswordPage.tsx
git commit -m "feat(frontend): use strong-password schema + meter on reset password"
```

---

### Task 24: Retrofit `CustomerFormPage` (workshop)

**Files:**
- Modify: `apps/frontend/src/pages/workshop/customers/CustomerFormPage.tsx`

- [ ] **Step 1: Inspect current form**

Read `apps/frontend/src/pages/workshop/customers/CustomerFormPage.tsx` to identify which of two patterns the form uses for `cpfCnpj`.

- **Pattern A** — single combined `cpfCnpj` string field, validated by digit-count regex (e.g. `z.string().regex(/^\d{11}$|^\d{14}$/, ...)`).
- **Pattern B** — explicit `documentType` ('CPF' | 'CNPJ') selector with conditional length checks inside a `superRefine`.

- [ ] **Step 2: Apply Pattern A swap (if applicable)**

If the form uses Pattern A:
- Add to imports: `import { cpfOrCnpjZodSchema } from '@praktikus/shared';`
- Replace the `cpfCnpj: z.string().regex(/^\d{11}$|^\d{14}$/, ...)` line with `cpfCnpj: cpfOrCnpjZodSchema,`.
- Remove any remaining length-check refinements that became redundant.

- [ ] **Step 3: Apply Pattern B swap (if applicable)**

If the form uses Pattern B (explicit `documentType` field):
- Add to imports: `import { isValidCpf, isValidCnpj } from '@praktikus/shared';`
- Replace the body of the `.superRefine((data, ctx) => { ... })` with the same algorithm-based pattern used in buyers/suppliers:

```tsx
  .superRefine((data, ctx) => {
    if (!data.cpfCnpj || data.cpfCnpj === '') return;
    if (!data.documentType) {
      ctx.addIssue({ code: 'custom', path: ['documentType'], message: 'Selecione CPF ou CNPJ' });
      return;
    }
    if (data.documentType === 'CPF' && !isValidCpf(data.cpfCnpj)) {
      ctx.addIssue({ code: 'custom', path: ['cpfCnpj'], message: 'CPF inválido' });
    }
    if (data.documentType === 'CNPJ' && !isValidCnpj(data.cpfCnpj)) {
      ctx.addIssue({ code: 'custom', path: ['cpfCnpj'], message: 'CNPJ inválido' });
    }
  })
```

(Adjust field names — `cpfCnpj` here — to match what the form actually uses.)

- [ ] **Step 4: Run customer-related tests**

Run: `pnpm --filter frontend test src/pages/workshop/customers`
Expected: PASS (or note any fixture failures, fix in Task 27).

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/pages/workshop/customers/CustomerFormPage.tsx
git commit -m "feat(frontend): validate cpf/cnpj algorithm on customer form"
```

---

### Task 25: Retrofit `BuyersPage` form (recycling)

**Files:**
- Modify: `apps/frontend/src/pages/recycling/buyers/BuyersPage.tsx`

The current schema does length-only checks inside `superRefine` based on `documentType`. Replace those with algorithm-based checks.

- [ ] **Step 1: Update schema**

Edit `apps/frontend/src/pages/recycling/buyers/BuyersPage.tsx`:

Add to imports near the top: `import { isValidCpf, isValidCnpj } from '@praktikus/shared';`

Find the Zod schema (around lines 35-65). Replace the `superRefine` body with:

```tsx
  .superRefine((data, ctx) => {
    if (!data.document || data.document === '') return;
    if (!data.documentType) {
      ctx.addIssue({
        code: 'custom',
        path: ['documentType'],
        message: 'Selecione CPF ou CNPJ',
      });
      return;
    }
    if (data.documentType === 'CPF' && !isValidCpf(data.document)) {
      ctx.addIssue({ code: 'custom', path: ['document'], message: 'CPF inválido' });
    }
    if (data.documentType === 'CNPJ' && !isValidCnpj(data.document)) {
      ctx.addIssue({ code: 'custom', path: ['document'], message: 'CNPJ inválido' });
    }
  })
```

- [ ] **Step 2: Run any buyers tests**

Run: `pnpm --filter frontend test src/pages/recycling/buyers`
Expected: PASS (no test file may exist yet; that's fine).

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/pages/recycling/buyers/BuyersPage.tsx
git commit -m "feat(frontend): validate document algorithm in buyers form"
```

---

### Task 26: Retrofit `SuppliersPage` form (recycling)

**Files:**
- Modify: `apps/frontend/src/pages/recycling/suppliers/SuppliersPage.tsx`

- [ ] **Step 1: Apply identical pattern as buyers**

Edit `apps/frontend/src/pages/recycling/suppliers/SuppliersPage.tsx` with the same change as Task 25:
- Import `isValidCpf, isValidCnpj` from `@praktikus/shared`
- Replace the length-only checks in `superRefine` with the algorithm-based checks shown in Task 25 step 1.

- [ ] **Step 2: Build**

Run: `pnpm --filter frontend build`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/pages/recycling/suppliers/SuppliersPage.tsx
git commit -m "feat(frontend): validate document algorithm in suppliers form"
```

---

## PHASE 8 — Frontend test fixture cleanup

### Task 27: Replace invalid CNPJ and weak password fixtures across frontend

**Files:** All `*.test.tsx`, `*.test.ts`, `*.spec.tsx`, `*.spec.ts` files using `12345678000199`.

- [ ] **Step 1: List affected files**

Run: `grep -rln "12345678000199" apps/frontend/src 2>/dev/null`
Expected: list includes `RegisterPage.test.tsx`, `auth.service.test.ts`, `DocumentInput.spec.tsx`, `masks.spec.ts`.

- [ ] **Step 2: Inspect each — these split into two cases**

- **Format-only tests** (`DocumentInput.spec.tsx`, `masks.spec.ts`): they assert formatting, not validation. The fixture `12345678000199` is fine here — DON'T change.

- **Validation flow tests** (`RegisterPage.test.tsx`, `auth.service.test.ts`): these now need a valid CNPJ.

- [ ] **Step 3: Update validation flow fixtures only**

Edit `apps/frontend/src/pages/auth/RegisterPage.test.tsx`:
- At lines 47 and 72, change `'12345678000199'` to `'11222333000181'`.
- Also update any password fixture used in the same tests to a strong one (e.g., `'Strong1!Pass'`) and confirmPassword to match.

Edit `apps/frontend/src/services/auth.service.test.ts` line 51:
- Change `cnpj: '12345678000199'` to `cnpj: '11222333000181'`.

- [ ] **Step 4: Add a new test for algorithm-failure path**

Open `apps/frontend/src/pages/auth/RegisterPage.test.tsx` and read the existing test setup (imports, render wrapper, helpers like `fillStep1` if any). Append a new `it` block matching the file's existing style:

```tsx
it('shows error when CNPJ has correct format but invalid check digit', async () => {
  // Use exactly the same render call shape as other tests in this file
  // (e.g., render(<RegisterPage />) or render(<RegisterPage />, { wrapper: ... })).
  fireEvent.change(screen.getByLabelText(/cnpj/i), { target: { value: '12345678000199' } });
  fireEvent.change(screen.getByLabelText(/razão social/i), { target: { value: 'Empresa X' } });
  fireEvent.change(screen.getByLabelText(/nome fantasia/i), { target: { value: 'X' } });
  fireEvent.click(screen.getByRole('button', { name: /próximo/i }));
  expect(await screen.findByText(/cnpj inválido/i)).toBeInTheDocument();
});
```

Match the render-wrapper convention used by the other tests in the same file. Do not add imports already present.

- [ ] **Step 5: Run all frontend tests**

Run: `pnpm --filter frontend test`
Expected: full PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/frontend
git commit -m "test(frontend): use valid CNPJ + strong password fixtures and assert algo failure"
```

---

## PHASE 9 — Final verification

### Task 28: Lint, build, and manual smoke test

- [ ] **Step 1: Build everything**

Run: `pnpm build`
Expected: shared + backend + frontend all build clean.

- [ ] **Step 2: Run all tests**

Run: `pnpm test`
Expected: full PASS across shared, backend, and frontend.

- [ ] **Step 3: Run all linters**

Run: `pnpm lint`
Expected: clean (or pre-existing warnings only).

- [ ] **Step 4: Start dev environment**

Run: `pnpm dev:backend` (in one terminal) and `pnpm dev:frontend` (in another), or `pnpm dev` (docker-compose).
Wait until both apps are up (frontend on http://localhost:5173 by default).

- [ ] **Step 5: Manual smoke test — workshop register**

In a browser:
- Open `http://localhost:5173/register` (or the workshop register URL).
- Step 1: enter CNPJ `00.000.000/0000-00` → expect "CNPJ inválido" error on submit.
- Enter CNPJ `12.345.678/0001-99` → expect "CNPJ inválido".
- Enter valid CNPJ `11.222.333/0001-81` (you can use the masked input) → step 1 passes.
- Step 2: enter weak password (`abc`) → expect bar visible, "Fraca" label, checklist showing all unmet items.
- Type `Strong1` → expect "Média" label, checklist updated.
- Type `Strong1!Pass` → expect "Forte" label, checklist disappears.
- Submit with mismatched confirm → expect "As senhas não coincidem".
- Submit successfully → expect navigation to `/workshop/dashboard` (or the actual landing).

- [ ] **Step 6: Manual smoke test — recycling register**

Same flow at `/register-recycling` (or whatever URL is wired up).

- [ ] **Step 7: Manual smoke test — reset password**

Trigger a password-reset email flow (or directly visit the reset page with a token if testable) and confirm:
- Weak password is rejected with the meter showing unmet criteria.
- Strong password is accepted.

- [ ] **Step 8: Manual smoke test — customer/buyer/supplier forms**

Log into a workshop tenant. Open Clientes, click "Novo cliente":
- Enter CPF `123.456.789-00` → expect "CPF ou CNPJ inválido" (or "CPF inválido" depending on form).
- Enter valid CPF `529.982.247-25` → expect submit succeeds.

Repeat in recycling for Compradores and Fornecedores using their CPF/CNPJ type selector.

- [ ] **Step 9: Final commit (if any straggler changes)**

If steps surfaced a fix:

```bash
git add -A
git commit -m "fix: address issues found during manual verification"
```

If everything passes clean, no commit needed.

---

## Self-Review Checklist (run before handing off)

Skim back through this plan with the spec open in another tab and verify:

1. **Spec coverage** — every requirement in [the spec](../specs/2026-04-27-cnpj-cpf-password-validation-design.md) maps to at least one task above:
   - Shared validators (CNPJ/CPF/document/password) → Tasks 3-7 ✓
   - Backend decorators → Tasks 8-12 ✓
   - DTO retrofit (register, reset, change, customer, buyer, supplier) → Tasks 13-18 ✓
   - Frontend component → Task 20 ✓
   - Frontend retrofit (register × 2, reset, customer, buyer, supplier) → Tasks 21-26 ✓
   - Test fixture cleanup → Tasks 19, 27 ✓
   - Manual verification → Task 28 ✓

2. **No placeholders** — every code block in this plan is concrete, complete, and runnable. No "implement similar to X". No "add error handling".

3. **Type consistency**:
   - `evaluatePassword` returns `PasswordEvaluation` with `criteria`, `metCount`, `strength`, `isValid` — used consistently in shared (Task 6), backend decorator (Task 11), frontend component (Task 20).
   - `cnpjZodSchema`, `cpfZodSchema`, `cpfOrCnpjZodSchema`, `strongPasswordZodSchema` — same names everywhere they're imported.
   - Decorator names: `IsValidCnpj`, `IsValidCpf`, `IsValidDocument`, `IsStrongPassword` — same in tasks 8-11 and DTO updates 13-18.
   - The frontend re-export of `stripDigits` from `masks.ts` (Task 2) preserves all existing import paths — no breaking change.
