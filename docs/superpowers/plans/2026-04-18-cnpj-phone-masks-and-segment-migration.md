# CNPJ/Phone Masks + Segment Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the missing `segment` column in the `tenants` DB table and add CNPJ/phone input masks to both registration pages.

**Architecture:** One new migration adds the `segment` column to `public.tenants`. A small utility module provides mask formatting functions used via `Controller` (react-hook-form) in both registration pages — no new dependencies, no hooks needed.

**Tech Stack:** TypeORM (migrations), React 19, react-hook-form `Controller`, zod, CoreUI

---

### Task 1: Migration — add `segment` column to `tenants`

**Files:**
- Create: `apps/backend/src/database/migrations/1745000000000-AddSegmentToTenants.ts`

**Context:** `TenantEntity` declares `segment: TenantSegment` but the initial migration
(`1700000000000-CreatePublicSchema.ts`) never included this column. The DB is missing it,
causing a `QueryFailedError: column TenantEntity.segment does not exist` on every `tenants`
SELECT. The entity default is `TenantSegment.WORKSHOP = 'WORKSHOP'`, so that is the safe
default for existing rows.

- [ ] **Step 1: Create the migration file**

```ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSegmentToTenants1745000000000 implements MigrationInterface {
  name = 'AddSegmentToTenants1745000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "public"."tenants"
        ADD COLUMN IF NOT EXISTS "segment" character varying NOT NULL DEFAULT 'WORKSHOP'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "public"."tenants" DROP COLUMN IF EXISTS "segment"
    `);
  }
}
```

- [ ] **Step 2: Run the migration**

```bash
pnpm --filter backend migration:run
```

Expected output: migration `AddSegmentToTenants1745000000000` executed successfully. No errors.

- [ ] **Step 3: Verify the column exists**

```bash
docker exec -it praktikus_postgres psql -U praktikus -d praktikus -c "\d public.tenants"
```

Expected: `segment | character varying | not null | default 'WORKSHOP'` in the table description.

- [ ] **Step 4: Verify registration no longer throws**

Start the stack (`docker-compose up -d`) and POST to `/api/auth/register/recycling` with valid data. Expect HTTP 201, no `column does not exist` in backend logs.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/database/migrations/1745000000000-AddSegmentToTenants.ts
git commit -m "fix(tenants): add missing segment column migration"
```

---

### Task 2: Frontend utility — mask formatting functions

**Files:**
- Create: `apps/frontend/src/utils/masks.ts`

**Context:** Two masks are needed across both registration pages. Centralising them avoids
duplication. The functions work on the raw digit string (what the form stores) and return a
display string. A third function strips non-digit characters for the reverse direction.

- [ ] **Step 1: Create the utility file**

```ts
export function stripDigits(value: string): string {
  return value.replace(/\D/g, '');
}

export function formatCnpj(digits: string): string {
  const d = digits.slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

export function formatPhone(digits: string): string {
  const d = digits.slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : '';
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}
```

- [ ] **Step 2: No test needed** — these are pure functions called in the UI; they will be
exercised implicitly by the E2E/manual test in Task 3. Skip a dedicated test file.

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/utils/masks.ts
git commit -m "feat(frontend): add CNPJ and phone mask utility functions"
```

---

### Task 3: Apply masks to `RegisterPage.tsx` (workshop)

**Files:**
- Modify: `apps/frontend/src/pages/auth/RegisterPage.tsx`

**Context:** The workshop registration page has CNPJ and optional phone fields without
masking. The Zod schema validates CNPJ as 14 raw digits — this must stay unchanged because
the form value stored is always stripped digits. Only the *display* value shown in the input
is formatted.

Use react-hook-form `Controller` for the two masked fields, keeping `register` for all
others. Import `Controller` from `react-hook-form`.

- [ ] **Step 1: Update imports at the top of `RegisterPage.tsx`**

Replace:
```ts
import { useForm } from 'react-hook-form';
```
With:
```ts
import { useForm, Controller } from 'react-hook-form';
```

Add after the existing service/store imports:
```ts
import { stripDigits, formatCnpj, formatPhone } from '../../utils/masks';
```

- [ ] **Step 2: Replace the CNPJ field (inside `activeStep === 0` block)**

Replace:
```tsx
<div className="mb-3">
  <CFormLabel>CNPJ</CFormLabel>
  <CFormInput
    placeholder="Apenas números (14 dígitos)"
    aria-label="CNPJ"
    {...form1.register('cnpj')}
    invalid={!!form1.formState.errors.cnpj}
  />
  {form1.formState.errors.cnpj && (
    <CFormFeedback invalid>{form1.formState.errors.cnpj.message}</CFormFeedback>
  )}
</div>
```
With:
```tsx
<div className="mb-3">
  <CFormLabel>CNPJ</CFormLabel>
  <Controller
    control={form1.control}
    name="cnpj"
    render={({ field }) => (
      <CFormInput
        placeholder="00.000.000/0000-00"
        aria-label="CNPJ"
        value={formatCnpj(field.value || '')}
        onChange={(e) => field.onChange(stripDigits(e.target.value))}
        onBlur={field.onBlur}
        ref={field.ref}
        invalid={!!form1.formState.errors.cnpj}
      />
    )}
  />
  {form1.formState.errors.cnpj && (
    <CFormFeedback invalid>{form1.formState.errors.cnpj.message}</CFormFeedback>
  )}
</div>
```

- [ ] **Step 3: Replace the telefone field (inside `activeStep === 0` block)**

Replace:
```tsx
<div className="mb-4">
  <CFormLabel>Telefone</CFormLabel>
  <CFormInput {...form1.register('telefone')} />
</div>
```
With:
```tsx
<div className="mb-4">
  <CFormLabel>Telefone</CFormLabel>
  <Controller
    control={form1.control}
    name="telefone"
    render={({ field }) => (
      <CFormInput
        placeholder="(00) 00000-0000"
        aria-label="Telefone"
        value={formatPhone(field.value || '')}
        onChange={(e) => field.onChange(stripDigits(e.target.value))}
        onBlur={field.onBlur}
        ref={field.ref}
      />
    )}
  />
</div>
```

- [ ] **Step 4: Manual verification**

Open http://localhost:8080/register and type in the CNPJ field:
- Typing `12345678000195` should display `12.345.678/0001-95`
- The "Próximo" button should advance without a validation error

Typing in phone:
- `11987654321` should display `(11) 98765-4321`

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/pages/auth/RegisterPage.tsx
git commit -m "feat(register): add CNPJ and phone masks to workshop registration"
```

---

### Task 4: Apply masks to `RegisterRecyclingPage.tsx` (recycling)

**Files:**
- Modify: `apps/frontend/src/pages/auth/RegisterRecyclingPage.tsx`

**Context:** Identical to Task 3 but for the recycling variant. Same Zod schema, same fields,
same mask approach.

- [ ] **Step 1: Update imports**

Replace:
```ts
import { useForm } from 'react-hook-form';
```
With:
```ts
import { useForm, Controller } from 'react-hook-form';
```

Add:
```ts
import { stripDigits, formatCnpj, formatPhone } from '../../utils/masks';
```

- [ ] **Step 2: Replace the CNPJ field (inside `activeStep === 0` block)**

Replace:
```tsx
<div className="mb-3">
  <CFormLabel>CNPJ</CFormLabel>
  <CFormInput
    placeholder="Apenas números (14 dígitos)"
    aria-label="CNPJ"
    {...form1.register('cnpj')}
    invalid={!!form1.formState.errors.cnpj}
  />
  {form1.formState.errors.cnpj && (
    <CFormFeedback invalid>{form1.formState.errors.cnpj.message}</CFormFeedback>
  )}
</div>
```
With:
```tsx
<div className="mb-3">
  <CFormLabel>CNPJ</CFormLabel>
  <Controller
    control={form1.control}
    name="cnpj"
    render={({ field }) => (
      <CFormInput
        placeholder="00.000.000/0000-00"
        aria-label="CNPJ"
        value={formatCnpj(field.value || '')}
        onChange={(e) => field.onChange(stripDigits(e.target.value))}
        onBlur={field.onBlur}
        ref={field.ref}
        invalid={!!form1.formState.errors.cnpj}
      />
    )}
  />
  {form1.formState.errors.cnpj && (
    <CFormFeedback invalid>{form1.formState.errors.cnpj.message}</CFormFeedback>
  )}
</div>
```

- [ ] **Step 3: Replace the telefone field (inside `activeStep === 0` block)**

Replace:
```tsx
<div className="mb-4">
  <CFormLabel>Telefone</CFormLabel>
  <CFormInput {...form1.register('telefone')} />
</div>
```
With:
```tsx
<div className="mb-4">
  <CFormLabel>Telefone</CFormLabel>
  <Controller
    control={form1.control}
    name="telefone"
    render={({ field }) => (
      <CFormInput
        placeholder="(00) 00000-0000"
        aria-label="Telefone"
        value={formatPhone(field.value || '')}
        onChange={(e) => field.onChange(stripDigits(e.target.value))}
        onBlur={field.onBlur}
        ref={field.ref}
      />
    )}
  />
</div>
```

- [ ] **Step 4: Manual verification**

Open http://localhost:8080/register/recycling and complete the full registration flow:
- CNPJ `47960950000108` should display as `47.960.950/0001-08`
- The form should submit successfully (HTTP 201, redirect to `/recycling/dashboard`)
- No `segment does not exist` error in backend logs

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/pages/auth/RegisterRecyclingPage.tsx
git commit -m "feat(register): add CNPJ and phone masks to recycling registration"
```
