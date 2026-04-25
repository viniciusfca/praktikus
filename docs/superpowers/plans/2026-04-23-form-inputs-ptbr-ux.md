# Correção de UX em formulários (pt-BR) — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolver 5 bugs de UX em formulários brasileiros (separador decimal, máscaras de documento/telefone, hora 24h, comprador PF/PJ) criando componentes de input reutilizáveis.

**Architecture:** Construir um conjunto de componentes de input em `src/components/inputs/` (NumericInput, CurrencyInput, DocumentInput, PhoneInput, TimeInput) que encapsulam convenções pt-BR. Refatorar o modelo de Comprador para suportar CPF ou CNPJ (igual ao Fornecedor). Substituir os inputs HTML5 nativos pelos novos componentes em 5 páginas.

**Tech Stack:** React 19, CoreUI 5, react-hook-form 7, zod 4, Vitest (frontend). NestJS, TypeORM, class-validator (backend). PostgreSQL schema-per-tenant.

**Spec:** [docs/superpowers/specs/2026-04-23-form-inputs-ptbr-ux-design.md](../specs/2026-04-23-form-inputs-ptbr-ux-design.md)

---

## Phase 1 — Fundação (utilitários + componentes)

### Task 1: Expandir `utils/masks.ts` com novos helpers

**Files:**
- Modify: `apps/frontend/src/utils/masks.ts`
- Test: `apps/frontend/src/utils/masks.spec.ts` (novo)

- [ ] **Step 1: Criar arquivo de teste com casos para os 4 novos helpers**

Criar `apps/frontend/src/utils/masks.spec.ts`:

```typescript
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
    expect(parseDecimal('1.234.567,89', 2)).toBe(1234567.89);
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
```

- [ ] **Step 2: Rodar os testes e ver que falham**

Run: `pnpm --filter frontend test src/utils/masks.spec.ts`
Expected: FAIL — `formatCpf`, `formatDocument`, `parseDecimal`, `formatDecimal` não existem.

- [ ] **Step 3: Implementar os 4 helpers**

Adicionar ao final de `apps/frontend/src/utils/masks.ts`:

```typescript
export function formatCpf(digits: string): string {
  const d = digits.slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

export function formatDocument(digits: string, type: 'CPF' | 'CNPJ'): string {
  return type === 'CPF' ? formatCpf(digits) : formatCnpj(digits);
}

export function parseDecimal(input: string, decimals: number): number | null {
  if (!input) return null;
  // pt-BR: `.` = thousand separator, `,` = decimal separator.
  const normalized = input.replace(/\./g, '').replace(',', '.');
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return null;
  const n = Number(normalized);
  if (!Number.isFinite(n)) return null;
  const factor = 10 ** decimals;
  return Math.trunc(n * factor) / factor;
}

export function formatDecimal(value: number, decimals: number): string {
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
```

- [ ] **Step 4: Rodar testes e verificar que passam**

Run: `pnpm --filter frontend test src/utils/masks.spec.ts`
Expected: PASS — todos os casos.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/utils/masks.ts apps/frontend/src/utils/masks.spec.ts
git commit -m "feat(utils): add CPF, document, and pt-BR decimal formatters"
```

---

### Task 2: Componente `<NumericInput>`

**Files:**
- Create: `apps/frontend/src/components/inputs/NumericInput.tsx`
- Test: `apps/frontend/src/components/inputs/NumericInput.spec.tsx`

- [ ] **Step 1: Escrever testes para comportamentos essenciais**

Criar `apps/frontend/src/components/inputs/NumericInput.spec.tsx`:

```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { NumericInput } from './NumericInput';

describe('<NumericInput>', () => {
  it('displays initial value formatted in pt-BR', () => {
    render(<NumericInput value={1234.5} onChange={() => {}} decimals={2} />);
    expect(screen.getByRole('textbox')).toHaveValue('1.234,50');
  });

  it('displays empty string when value is null', () => {
    render(<NumericInput value={null} onChange={() => {}} decimals={2} />);
    expect(screen.getByRole('textbox')).toHaveValue('');
  });

  it('calls onChange with parsed number as user types comma decimal', async () => {
    const onChange = vi.fn();
    render(<NumericInput value={null} onChange={onChange} decimals={2} />);
    const input = screen.getByRole('textbox');
    await userEvent.type(input, '12,5');
    expect(onChange).toHaveBeenLastCalledWith(12.5);
  });

  it('ignores dot key when decimals > 0', async () => {
    const onChange = vi.fn();
    render(<NumericInput value={null} onChange={onChange} decimals={2} />);
    const input = screen.getByRole('textbox');
    await userEvent.type(input, '1.5');
    expect(input).toHaveValue('15');
    expect(onChange).toHaveBeenLastCalledWith(15);
  });

  it('calls onChange with null when cleared', async () => {
    const onChange = vi.fn();
    render(<NumericInput value={10} onChange={onChange} decimals={2} />);
    const input = screen.getByRole('textbox');
    await userEvent.clear(input);
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it('reformats with thousand separator on blur', async () => {
    const onChange = vi.fn();
    render(<NumericInput value={null} onChange={onChange} decimals={2} />);
    const input = screen.getByRole('textbox');
    await userEvent.type(input, '1234,5');
    await userEvent.tab();
    expect(input).toHaveValue('1.234,50');
  });

  it('renders a prefix when provided', () => {
    render(<NumericInput value={10} onChange={() => {}} decimals={2} prefix="R$" />);
    expect(screen.getByText('R$')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Rodar testes — devem falhar**

Run: `pnpm --filter frontend test src/components/inputs/NumericInput.spec.tsx`
Expected: FAIL — módulo `./NumericInput` não existe.

- [ ] **Step 3: Implementar o componente**

Criar `apps/frontend/src/components/inputs/NumericInput.tsx`:

```tsx
import { CFormInput, CInputGroup, CInputGroupText } from '@coreui/react';
import type { CFormInputProps } from '@coreui/react/dist/esm/components/form/CFormInput';
import { useEffect, useState } from 'react';
import { formatDecimal, parseDecimal } from '../../utils/masks';

type BaseProps = Omit<CFormInputProps, 'type' | 'value' | 'onChange'>;

export interface NumericInputProps extends BaseProps {
  value: number | null;
  onChange: (value: number | null) => void;
  decimals?: number;
  prefix?: string;
  min?: number;
  max?: number;
}

export function NumericInput({
  value,
  onChange,
  decimals = 2,
  prefix,
  min,
  max,
  size,
  ...rest
}: NumericInputProps) {
  const [text, setText] = useState<string>(
    value === null || value === undefined ? '' : formatDecimal(value, decimals),
  );

  useEffect(() => {
    const nextFormatted =
      value === null || value === undefined ? '' : formatDecimal(value, decimals);
    const parsedCurrent = parseDecimal(text, decimals);
    if (parsedCurrent !== value) {
      setText(nextFormatted);
    }
  }, [value, decimals]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (decimals > 0 && e.key === '.') {
      e.preventDefault();
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    const allowed = decimals > 0 ? /^[\d.,]*$/ : /^[\d.]*$/;
    if (!allowed.test(raw)) return;
    setText(raw);
    const parsed = parseDecimal(raw, decimals);
    onChange(parsed);
  }

  function handleBlur() {
    const parsed = parseDecimal(text, decimals);
    if (parsed === null) {
      setText('');
      onChange(null);
      return;
    }
    let bounded = parsed;
    if (min !== undefined) bounded = Math.max(min, bounded);
    if (max !== undefined) bounded = Math.min(max, bounded);
    setText(formatDecimal(bounded, decimals));
    onChange(bounded);
  }

  const input = (
    <CFormInput
      {...rest}
      size={size}
      type="text"
      inputMode="decimal"
      value={text}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
    />
  );

  if (!prefix) return input;

  return (
    <CInputGroup size={size}>
      <CInputGroupText>{prefix}</CInputGroupText>
      {input}
    </CInputGroup>
  );
}
```

- [ ] **Step 4: Rodar testes — devem passar**

Run: `pnpm --filter frontend test src/components/inputs/NumericInput.spec.tsx`
Expected: PASS — todos os casos.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/components/inputs/NumericInput.tsx apps/frontend/src/components/inputs/NumericInput.spec.tsx
git commit -m "feat(inputs): add NumericInput with pt-BR decimal formatting"
```

---

### Task 3: Componente `<CurrencyInput>`

**Files:**
- Create: `apps/frontend/src/components/inputs/CurrencyInput.tsx`
- Test: `apps/frontend/src/components/inputs/CurrencyInput.spec.tsx`

- [ ] **Step 1: Escrever testes**

Criar `apps/frontend/src/components/inputs/CurrencyInput.spec.tsx`:

```typescript
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CurrencyInput } from './CurrencyInput';

describe('<CurrencyInput>', () => {
  it('renders with R$ prefix', () => {
    render(<CurrencyInput value={10} onChange={() => {}} />);
    expect(screen.getByText('R$')).toBeInTheDocument();
  });

  it('defaults to 2 decimal places', () => {
    render(<CurrencyInput value={1234.5} onChange={() => {}} />);
    expect(screen.getByRole('textbox')).toHaveValue('1.234,50');
  });
});
```

- [ ] **Step 2: Rodar testes — devem falhar**

Run: `pnpm --filter frontend test src/components/inputs/CurrencyInput.spec.tsx`
Expected: FAIL — módulo `./CurrencyInput` não existe.

- [ ] **Step 3: Implementar wrapper**

Criar `apps/frontend/src/components/inputs/CurrencyInput.tsx`:

```tsx
import { NumericInput, type NumericInputProps } from './NumericInput';

export type CurrencyInputProps = Omit<NumericInputProps, 'decimals' | 'prefix'>;

export function CurrencyInput(props: CurrencyInputProps) {
  return <NumericInput {...props} decimals={2} prefix="R$" />;
}
```

- [ ] **Step 4: Rodar testes — devem passar**

Run: `pnpm --filter frontend test src/components/inputs/CurrencyInput.spec.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/components/inputs/CurrencyInput.tsx apps/frontend/src/components/inputs/CurrencyInput.spec.tsx
git commit -m "feat(inputs): add CurrencyInput preset"
```

---

### Task 4: Componente `<DocumentInput>`

**Files:**
- Create: `apps/frontend/src/components/inputs/DocumentInput.tsx`
- Test: `apps/frontend/src/components/inputs/DocumentInput.spec.tsx`

- [ ] **Step 1: Escrever testes**

Criar `apps/frontend/src/components/inputs/DocumentInput.spec.tsx`:

```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DocumentInput } from './DocumentInput';

describe('<DocumentInput>', () => {
  it('formats CPF while typing', async () => {
    const onChange = vi.fn();
    render(<DocumentInput type="CPF" value="" onChange={onChange} />);
    const input = screen.getByRole('textbox');
    await userEvent.type(input, '12345678901');
    expect(input).toHaveValue('123.456.789-01');
    expect(onChange).toHaveBeenLastCalledWith('12345678901');
  });

  it('formats CNPJ while typing', async () => {
    const onChange = vi.fn();
    render(<DocumentInput type="CNPJ" value="" onChange={onChange} />);
    const input = screen.getByRole('textbox');
    await userEvent.type(input, '12345678000199');
    expect(input).toHaveValue('12.345.678/0001-99');
    expect(onChange).toHaveBeenLastCalledWith('12345678000199');
  });

  it('truncates input above CPF limit', async () => {
    const onChange = vi.fn();
    render(<DocumentInput type="CPF" value="" onChange={onChange} />);
    const input = screen.getByRole('textbox');
    await userEvent.type(input, '123456789012345');
    expect(onChange).toHaveBeenLastCalledWith('12345678901');
  });

  it('rerenders formatted value when type changes', () => {
    const { rerender } = render(
      <DocumentInput type="CNPJ" value="12345678000199" onChange={() => {}} />,
    );
    expect(screen.getByRole('textbox')).toHaveValue('12.345.678/0001-99');
    rerender(<DocumentInput type="CPF" value="12345678901" onChange={() => {}} />);
    expect(screen.getByRole('textbox')).toHaveValue('123.456.789-01');
  });

  it('strips non-digit characters from input', async () => {
    const onChange = vi.fn();
    render(<DocumentInput type="CPF" value="" onChange={onChange} />);
    const input = screen.getByRole('textbox');
    await userEvent.type(input, 'abc123def456');
    expect(onChange).toHaveBeenLastCalledWith('123456');
  });
});
```

- [ ] **Step 2: Rodar testes — devem falhar**

Run: `pnpm --filter frontend test src/components/inputs/DocumentInput.spec.tsx`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar**

Criar `apps/frontend/src/components/inputs/DocumentInput.tsx`:

```tsx
import { CFormInput } from '@coreui/react';
import type { CFormInputProps } from '@coreui/react/dist/esm/components/form/CFormInput';
import { formatDocument, stripDigits } from '../../utils/masks';

type BaseProps = Omit<CFormInputProps, 'type' | 'value' | 'onChange'>;

export interface DocumentInputProps extends BaseProps {
  type: 'CPF' | 'CNPJ';
  value: string;
  onChange: (digits: string) => void;
}

export function DocumentInput({ type, value, onChange, ...rest }: DocumentInputProps) {
  const maxDigits = type === 'CPF' ? 11 : 14;
  const displayValue = formatDocument(value.slice(0, maxDigits), type);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = stripDigits(e.target.value).slice(0, maxDigits);
    onChange(digits);
  }

  return (
    <CFormInput
      {...rest}
      type="text"
      inputMode="numeric"
      value={displayValue}
      onChange={handleChange}
    />
  );
}
```

- [ ] **Step 4: Rodar testes — devem passar**

Run: `pnpm --filter frontend test src/components/inputs/DocumentInput.spec.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/components/inputs/DocumentInput.tsx apps/frontend/src/components/inputs/DocumentInput.spec.tsx
git commit -m "feat(inputs): add DocumentInput with CPF/CNPJ masking"
```

---

### Task 5: Componente `<PhoneInput>`

**Files:**
- Create: `apps/frontend/src/components/inputs/PhoneInput.tsx`
- Test: `apps/frontend/src/components/inputs/PhoneInput.spec.tsx`

- [ ] **Step 1: Escrever testes**

Criar `apps/frontend/src/components/inputs/PhoneInput.spec.tsx`:

```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PhoneInput } from './PhoneInput';

describe('<PhoneInput>', () => {
  it('formats 11-digit mobile number', async () => {
    const onChange = vi.fn();
    render(<PhoneInput value="" onChange={onChange} />);
    const input = screen.getByRole('textbox');
    await userEvent.type(input, '11987654321');
    expect(input).toHaveValue('(11) 98765-4321');
    expect(onChange).toHaveBeenLastCalledWith('11987654321');
  });

  it('formats 10-digit landline', async () => {
    const onChange = vi.fn();
    render(<PhoneInput value="" onChange={onChange} />);
    const input = screen.getByRole('textbox');
    await userEvent.type(input, '1133334444');
    expect(input).toHaveValue('(11) 3333-4444');
  });

  it('truncates at 11 digits', async () => {
    const onChange = vi.fn();
    render(<PhoneInput value="" onChange={onChange} />);
    const input = screen.getByRole('textbox');
    await userEvent.type(input, '119876543210000');
    expect(onChange).toHaveBeenLastCalledWith('11987654321');
  });
});
```

- [ ] **Step 2: Rodar testes — devem falhar**

Run: `pnpm --filter frontend test src/components/inputs/PhoneInput.spec.tsx`
Expected: FAIL.

- [ ] **Step 3: Implementar**

Criar `apps/frontend/src/components/inputs/PhoneInput.tsx`:

```tsx
import { CFormInput } from '@coreui/react';
import type { CFormInputProps } from '@coreui/react/dist/esm/components/form/CFormInput';
import { formatPhone, stripDigits } from '../../utils/masks';

type BaseProps = Omit<CFormInputProps, 'type' | 'value' | 'onChange'>;

export interface PhoneInputProps extends BaseProps {
  value: string;
  onChange: (digits: string) => void;
}

export function PhoneInput({ value, onChange, ...rest }: PhoneInputProps) {
  const displayValue = formatPhone(value);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = stripDigits(e.target.value).slice(0, 11);
    onChange(digits);
  }

  return (
    <CFormInput
      {...rest}
      type="text"
      inputMode="numeric"
      value={displayValue}
      onChange={handleChange}
    />
  );
}
```

- [ ] **Step 4: Rodar testes — devem passar**

Run: `pnpm --filter frontend test src/components/inputs/PhoneInput.spec.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/components/inputs/PhoneInput.tsx apps/frontend/src/components/inputs/PhoneInput.spec.tsx
git commit -m "feat(inputs): add PhoneInput with BR phone masking"
```

---

### Task 6: Componente `<TimeInput>`

**Files:**
- Create: `apps/frontend/src/components/inputs/TimeInput.tsx`
- Test: `apps/frontend/src/components/inputs/TimeInput.spec.tsx`

- [ ] **Step 1: Escrever testes**

Criar `apps/frontend/src/components/inputs/TimeInput.spec.tsx`:

```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TimeInput } from './TimeInput';

describe('<TimeInput>', () => {
  it('inserts ":" after two digits automatically', async () => {
    const onChange = vi.fn();
    render(<TimeInput value="" onChange={onChange} />);
    const input = screen.getByRole('textbox');
    await userEvent.type(input, '1430');
    expect(input).toHaveValue('14:30');
    expect(onChange).toHaveBeenLastCalledWith('14:30');
  });

  it('displays initial value as-is when already HH:mm', () => {
    render(<TimeInput value="09:15" onChange={() => {}} />);
    expect(screen.getByRole('textbox')).toHaveValue('09:15');
  });

  it('truncates beyond 4 digits', async () => {
    const onChange = vi.fn();
    render(<TimeInput value="" onChange={onChange} />);
    const input = screen.getByRole('textbox');
    await userEvent.type(input, '143099');
    expect(onChange).toHaveBeenLastCalledWith('14:30');
  });

  it('strips non-digit characters', async () => {
    const onChange = vi.fn();
    render(<TimeInput value="" onChange={onChange} />);
    const input = screen.getByRole('textbox');
    await userEvent.type(input, 'ab14cd30');
    expect(onChange).toHaveBeenLastCalledWith('14:30');
  });

  it('emits partial value during typing', async () => {
    const onChange = vi.fn();
    render(<TimeInput value="" onChange={onChange} />);
    const input = screen.getByRole('textbox');
    await userEvent.type(input, '14');
    expect(onChange).toHaveBeenLastCalledWith('14');
  });
});
```

- [ ] **Step 2: Rodar testes — devem falhar**

Run: `pnpm --filter frontend test src/components/inputs/TimeInput.spec.tsx`
Expected: FAIL.

- [ ] **Step 3: Implementar**

Criar `apps/frontend/src/components/inputs/TimeInput.tsx`:

```tsx
import { CFormInput } from '@coreui/react';
import type { CFormInputProps } from '@coreui/react/dist/esm/components/form/CFormInput';
import { stripDigits } from '../../utils/masks';

type BaseProps = Omit<CFormInputProps, 'type' | 'value' | 'onChange'>;

export interface TimeInputProps extends BaseProps {
  value: string;
  onChange: (value: string) => void;
}

function formatTime(digits: string): string {
  const d = digits.slice(0, 4);
  if (d.length <= 2) return d;
  return `${d.slice(0, 2)}:${d.slice(2)}`;
}

export function TimeInput({ value, onChange, ...rest }: TimeInputProps) {
  const display = formatTime(stripDigits(value));

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = stripDigits(e.target.value).slice(0, 4);
    onChange(formatTime(digits));
  }

  return (
    <CFormInput
      {...rest}
      type="text"
      inputMode="numeric"
      placeholder="HH:mm"
      value={display}
      onChange={handleChange}
    />
  );
}
```

- [ ] **Step 4: Rodar testes — devem passar**

Run: `pnpm --filter frontend test src/components/inputs/TimeInput.spec.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/components/inputs/TimeInput.tsx apps/frontend/src/components/inputs/TimeInput.spec.tsx
git commit -m "feat(inputs): add TimeInput with HH:mm mask"
```

---

### Task 7: Barrel export dos inputs

**Files:**
- Create: `apps/frontend/src/components/inputs/index.ts`

- [ ] **Step 1: Criar o barrel**

Criar `apps/frontend/src/components/inputs/index.ts`:

```typescript
export { CurrencyInput } from './CurrencyInput';
export type { CurrencyInputProps } from './CurrencyInput';
export { DocumentInput } from './DocumentInput';
export type { DocumentInputProps } from './DocumentInput';
export { NumericInput } from './NumericInput';
export type { NumericInputProps } from './NumericInput';
export { PhoneInput } from './PhoneInput';
export type { PhoneInputProps } from './PhoneInput';
export { TimeInput } from './TimeInput';
export type { TimeInputProps } from './TimeInput';
```

- [ ] **Step 2: Verificar typecheck**

Run: `pnpm --filter frontend exec tsc --noEmit`
Expected: sem erros nos arquivos de `components/inputs/`.

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/components/inputs/index.ts
git commit -m "feat(inputs): add barrel export"
```

---

## Phase 2 — Backend: Comprador PF/PJ

### Task 8: Atualizar `BuyerEntity`

**Files:**
- Modify: `apps/backend/src/modules/recycling/buyers/buyer.entity.ts`

- [ ] **Step 1: Substituir campo `cnpj` por `document` + `documentType`**

Em `apps/backend/src/modules/recycling/buyers/buyer.entity.ts`, substituir o arquivo todo por:

```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'buyers' })
export class BuyerEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() name: string;
  @Column({ type: 'varchar', nullable: true }) document: string | null;
  @Column({ name: 'document_type', type: 'varchar', nullable: true }) documentType: 'CPF' | 'CNPJ' | null;
  @Column({ type: 'varchar', nullable: true }) phone: string | null;
  @Column({ name: 'contact_name', type: 'varchar', nullable: true }) contactName: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;
}
```

- [ ] **Step 2: Verificar typecheck (vai falhar em service/DTOs — ok, tarefas seguintes)**

Run: `pnpm --filter backend exec tsc --noEmit`
Expected: erros em `buyers.service.ts`, `create-buyer.dto.ts`, `buyers.service.spec.ts`, `sales.service.ts` referenciando `cnpj`. É esperado — corrigimos nas próximas tarefas.

- [ ] **Step 3: NÃO commitar ainda** — esperar tarefas 9-13 para ter backend coerente. Commit conjunto ao final da Task 13.

---

### Task 9: Atualizar template de criação de tabela (tenants novos)

**Files:**
- Modify: `apps/backend/src/database/tenant-migrations/create-tenant-tables.ts:127-135`

- [ ] **Step 1: Substituir definição da tabela `buyers`**

Em `apps/backend/src/database/tenant-migrations/create-tenant-tables.ts`, substituir o bloco que cria a tabela `buyers` (linhas 127-135):

```typescript
    `CREATE TABLE IF NOT EXISTS "${schemaName}".buyers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR NOT NULL,
      document VARCHAR(14),
      document_type VARCHAR(4),
      phone VARCHAR,
      contact_name VARCHAR,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,
```

- [ ] **Step 2: Verificar typecheck**

Run: `pnpm --filter backend exec tsc --noEmit`
Expected: o erro continua apenas em DTO/service/sales — ainda esperado.

- [ ] **Step 3: NÃO commitar ainda.**

---

### Task 10: Migration para renomear `cnpj` → `document` + adicionar `document_type`

**Files:**
- Create: `apps/backend/src/database/migrations/1746200000000-RenameBuyerCnpjToDocument.ts`
- Test: (manual — migration dry-run descrita em Step 4)

- [ ] **Step 1: Criar a migration**

Criar `apps/backend/src/database/migrations/1746200000000-RenameBuyerCnpjToDocument.ts`:

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class RenameBuyerCnpjToDocument1746200000000 implements MigrationInterface {
  name = 'RenameBuyerCnpjToDocument1746200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const tenants: Array<{ id: string }> = await queryRunner.query(
      `SELECT id FROM "public"."tenants" WHERE segment = 'RECYCLING'`,
    );

    // Pre-check: any existing cnpj values must have exactly 14 digits.
    for (const tenant of tenants) {
      const schemaName = `tenant_${tenant.id.replace(/-/g, '')}`;
      const invalid: Array<{ id: string; cnpj: string }> = await queryRunner.query(
        `SELECT id, cnpj FROM "${schemaName}".buyers WHERE cnpj IS NOT NULL AND LENGTH(cnpj) <> 14`,
      );
      if (invalid.length > 0) {
        const list = invalid.map((r) => `${r.id} (cnpj=${r.cnpj})`).join(', ');
        throw new Error(
          `Cannot migrate: tenant ${tenant.id} has ${invalid.length} buyer(s) with invalid CNPJ length: ${list}`,
        );
      }
    }

    for (const tenant of tenants) {
      const schemaName = `tenant_${tenant.id.replace(/-/g, '')}`;
      await queryRunner.query(
        `ALTER TABLE "${schemaName}".buyers RENAME COLUMN cnpj TO document`,
      );
      await queryRunner.query(
        `ALTER TABLE "${schemaName}".buyers ADD COLUMN document_type VARCHAR(4)`,
      );
      await queryRunner.query(
        `UPDATE "${schemaName}".buyers SET document_type = 'CNPJ' WHERE document IS NOT NULL`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const tenants: Array<{ id: string }> = await queryRunner.query(
      `SELECT id FROM "public"."tenants" WHERE segment = 'RECYCLING'`,
    );
    for (const tenant of tenants) {
      const schemaName = `tenant_${tenant.id.replace(/-/g, '')}`;
      // Fail fast if there are CPFs — can't reverse safely.
      const cpfs: Array<{ id: string }> = await queryRunner.query(
        `SELECT id FROM "${schemaName}".buyers WHERE document_type = 'CPF'`,
      );
      if (cpfs.length > 0) {
        throw new Error(
          `Cannot rollback: tenant ${tenant.id} has ${cpfs.length} buyer(s) with CPF — field cnpj cannot hold them.`,
        );
      }
      await queryRunner.query(`ALTER TABLE "${schemaName}".buyers DROP COLUMN document_type`);
      await queryRunner.query(
        `ALTER TABLE "${schemaName}".buyers RENAME COLUMN document TO cnpj`,
      );
    }
  }
}
```

- [ ] **Step 2: Verificar que o arquivo compila**

Run: `pnpm --filter backend exec tsc --noEmit`
Expected: sem novos erros na migration; os erros antigos (DTO/service/sales) seguem.

- [ ] **Step 3: NÃO rodar a migration ainda** — ela só deve rodar depois que DTO/service estiverem coerentes (senão fica sistema quebrado). Será executada junto com a Task 12.

---

### Task 11: Atualizar DTOs do Buyer

**Files:**
- Modify: `apps/backend/src/modules/recycling/buyers/dto/create-buyer.dto.ts`
- (update-buyer.dto.ts herda via `PartialType`, sem mudança necessária)

- [ ] **Step 1: Substituir conteúdo de `create-buyer.dto.ts`**

Em `apps/backend/src/modules/recycling/buyers/dto/create-buyer.dto.ts`:

```typescript
import { IsString, IsOptional, Matches, IsIn, ValidateIf, MinLength } from 'class-validator';

export class CreateBuyerDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsOptional()
  @Matches(/^\d{11}$|^\d{14}$/, { message: 'Documento deve ter 11 (CPF) ou 14 (CNPJ) dígitos' })
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

- [ ] **Step 2: Verificar typecheck**

Run: `pnpm --filter backend exec tsc --noEmit`
Expected: o erro continua em `buyers.service.ts`, `buyers.service.spec.ts`, `sales.service.ts`.

- [ ] **Step 3: NÃO commitar ainda.**

---

### Task 12: Atualizar `BuyersService` + testes

**Files:**
- Modify: `apps/backend/src/modules/recycling/buyers/buyers.service.ts:67-78` (método `create`)
- Modify: `apps/backend/src/modules/recycling/buyers/buyers.service.spec.ts`

- [ ] **Step 1: Atualizar `BuyersService.create` para novos campos**

Em `apps/backend/src/modules/recycling/buyers/buyers.service.ts`, substituir o método `create` (linhas 67-78):

```typescript
  async create(tenantId: string, dto: CreateBuyerDto): Promise<BuyerEntity> {
    return this.withSchema(tenantId, async (manager) => {
      const repo = manager.getRepository(BuyerEntity);
      const buyer = repo.create({
        name: dto.name,
        document: dto.document ?? null,
        documentType: dto.documentType ?? null,
        phone: dto.phone ?? null,
        contactName: dto.contactName ?? null,
      });
      return repo.save(buyer);
    });
  }
```

(o método `update` usa `Object.assign(buyer, dto)` e já trabalha com o DTO — sem mudança necessária.)

- [ ] **Step 2: Atualizar o spec do service**

Em `apps/backend/src/modules/recycling/buyers/buyers.service.spec.ts`, procurar todos os testes que referenciam `cnpj` como campo do Buyer e substituir por `document` + `documentType`. Adicionar um caso novo para PF (CPF 11 dígitos).

Trecho a incluir (ajustar aos demais casos existentes no spec; mantém-se a estrutura em volta):

```typescript
  describe('create', () => {
    it('creates a buyer with CNPJ', async () => {
      mockBuyerRepo.create.mockReturnValue({ id: 'b1', name: 'ACME', document: '12345678000199', documentType: 'CNPJ' });
      mockBuyerRepo.save.mockResolvedValue({ id: 'b1', name: 'ACME', document: '12345678000199', documentType: 'CNPJ' });
      const result = await service.create(TENANT, {
        name: 'ACME',
        document: '12345678000199',
        documentType: 'CNPJ',
      });
      expect(result.document).toBe('12345678000199');
      expect(result.documentType).toBe('CNPJ');
    });

    it('creates a buyer with CPF (pessoa física)', async () => {
      mockBuyerRepo.create.mockReturnValue({ id: 'b2', name: 'João', document: '12345678901', documentType: 'CPF' });
      mockBuyerRepo.save.mockResolvedValue({ id: 'b2', name: 'João', document: '12345678901', documentType: 'CPF' });
      const result = await service.create(TENANT, {
        name: 'João',
        document: '12345678901',
        documentType: 'CPF',
      });
      expect(result.document).toBe('12345678901');
      expect(result.documentType).toBe('CPF');
    });

    it('creates a buyer without document', async () => {
      mockBuyerRepo.create.mockReturnValue({ id: 'b3', name: 'Anônimo', document: null, documentType: null });
      mockBuyerRepo.save.mockResolvedValue({ id: 'b3', name: 'Anônimo', document: null, documentType: null });
      const result = await service.create(TENANT, { name: 'Anônimo' });
      expect(result.document).toBeNull();
      expect(result.documentType).toBeNull();
    });
  });
```

Remover casos antigos que referenciam o campo `cnpj` como retorno ou entrada. Manter os outros casos (`list`, `getById`, `update`, `delete`) ajustando a `cnpj` → `document`/`documentType` apenas onde houver referência.

- [ ] **Step 3: Rodar testes do módulo**

Run: `pnpm --filter backend test -- buyers.service.spec.ts`
Expected: PASS.

- [ ] **Step 4: NÃO commitar ainda — falta atualizar a query em sales.service.**

---

### Task 13: Atualizar `SalesService` + commit backend

**Files:**
- Modify: `apps/backend/src/modules/recycling/sales/sales.service.ts:208`

- [ ] **Step 1: Atualizar query que lê buyer**

Em `apps/backend/src/modules/recycling/sales/sales.service.ts`, substituir a linha 208:

```typescript
          b.document as buyer_document, b.document_type as buyer_document_type,
```

(a linha anterior era `b.cnpj as buyer_document, NULL as buyer_document_type,`.)

- [ ] **Step 2: Procurar e eliminar qualquer outra referência a `cnpj` no módulo buyer/sales**

Run: `grep -rn "cnpj" apps/backend/src/modules/recycling/buyers apps/backend/src/modules/recycling/sales`
Expected: zero ocorrências em produção (spec antigo já atualizado em Task 12).

- [ ] **Step 3: Rodar typecheck completo do backend**

Run: `pnpm --filter backend exec tsc --noEmit`
Expected: PASS — sem erros.

- [ ] **Step 4: Rodar suite de testes do backend**

Run: `pnpm --filter backend test`
Expected: PASS — todos os testes.

- [ ] **Step 5: Rodar a migration num banco de dev local**

Run: `pnpm --filter backend migration:run`
Expected: migration `RenameBuyerCnpjToDocument1746200000000` executa sem erro. Para ambientes de dev sem dados, nada a backfillar; para dev com dados, verifique que `document_type='CNPJ'` em linhas com `document IS NOT NULL`.

- [ ] **Step 6: Commit — mudança completa do backend**

```bash
git add apps/backend/src/modules/recycling/buyers \
        apps/backend/src/database/migrations/1746200000000-RenameBuyerCnpjToDocument.ts \
        apps/backend/src/database/tenant-migrations/create-tenant-tables.ts \
        apps/backend/src/modules/recycling/sales/sales.service.ts
git commit -m "refactor(buyers): support PF/PJ with document + documentType fields"
```

---

## Phase 3 — Frontend: integração por página

### Task 14: Atualizar tipo `Buyer` no service do frontend

**Files:**
- Modify: `apps/frontend/src/services/recycling/buyers.service.ts:3-10`

- [ ] **Step 1: Substituir a interface `Buyer`**

Em `apps/frontend/src/services/recycling/buyers.service.ts`:

```typescript
export interface Buyer {
  id: string;
  name: string;
  document: string | null;
  documentType: 'CPF' | 'CNPJ' | null;
  phone: string | null;
  contactName: string | null;
  createdAt: string;
}
```

- [ ] **Step 2: Verificar typecheck**

Run: `pnpm --filter frontend exec tsc --noEmit`
Expected: erros apenas em `BuyersPage.tsx` referenciando `buyer.cnpj` — esperado, corrigimos na Task 18.

- [ ] **Step 3: NÃO commitar — junto com a Task 18.**

---

### Task 15: `ProductsPage` — usar `<CurrencyInput>`

**Files:**
- Modify: `apps/frontend/src/pages/recycling/products/ProductsPage.tsx`

- [ ] **Step 1: Ler o arquivo completo**

Run: `cat apps/frontend/src/pages/recycling/products/ProductsPage.tsx | head -180`

Identificar: a declaração do schema (linhas ~31-35), a instância do `useForm` (linhas ~59-64), o input do preço (linhas ~141-148).

- [ ] **Step 2: Trocar input de preço por `<CurrencyInput>` via `Controller`**

Adicionar import no topo:

```tsx
import { Controller } from 'react-hook-form';
import { CurrencyInput } from '../../../components/inputs';
```

Ajustar o `useForm` para incluir `control` no destructuring:

```tsx
const {
  register,
  control,
  handleSubmit,
  reset,
  formState: { errors, isSubmitting },
} = useForm<FormData>({ resolver: zodResolver(schema) });
```

Substituir o bloco atual do input de preço (linhas ~141-148, que usa `CFormInput type="number"` com `{...register('pricePerUnit', { valueAsNumber: true })}`) por:

```tsx
<Controller
  control={control}
  name="pricePerUnit"
  render={({ field }) => (
    <CurrencyInput
      value={field.value ?? null}
      onChange={field.onChange}
      invalid={!!errors.pricePerUnit}
      placeholder="0,00"
    />
  )}
/>
```

- [ ] **Step 3: Atualizar o schema Zod para `multipleOf(0.01)`**

Localizar a linha que define `pricePerUnit` no schema (perto da linha 34) e trocar por:

```typescript
pricePerUnit: z.number().positive().multipleOf(0.01, 'Use até 2 casas decimais'),
```

- [ ] **Step 4: Rodar typecheck**

Run: `pnpm --filter frontend exec tsc --noEmit`
Expected: sem novos erros em `ProductsPage.tsx`.

- [ ] **Step 5: Rodar tests do frontend**

Run: `pnpm --filter frontend test`
Expected: PASS (pode não haver testes específicos de ProductsPage — apenas os dos componentes e utils).

- [ ] **Step 6: Commit**

```bash
git add apps/frontend/src/pages/recycling/products/ProductsPage.tsx
git commit -m "fix(products): use CurrencyInput for price (pt-BR decimal)"
```

---

### Task 16: `NewPurchasePage` — `<CurrencyInput>` + `<NumericInput>` para quantidade

**Files:**
- Modify: `apps/frontend/src/pages/recycling/purchases/NewPurchasePage.tsx`

- [ ] **Step 1: Ler a página, focar em schema (~32-43), items (~359-472), function `totals` (~170-179)**

Run: `sed -n '25,50p' apps/frontend/src/pages/recycling/purchases/NewPurchasePage.tsx`
Run: `sed -n '400,475p' apps/frontend/src/pages/recycling/purchases/NewPurchasePage.tsx`

- [ ] **Step 2: Atualizar schema Zod**

Localizar o schema do item (linhas ~32-36) e substituir por:

```typescript
const itemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().positive().multipleOf(0.001, 'Use até 3 casas decimais'),
  unitPrice: z.number().positive().multipleOf(0.01, 'Use até 2 casas decimais').max(999999.99),
});
```

- [ ] **Step 3: Adicionar import dos novos componentes**

No topo do arquivo, adicionar apenas:

```tsx
import { CurrencyInput, NumericInput } from '../../../components/inputs';
```

(`Controller` já está importado de `react-hook-form` e `control` já está no destructuring do `useForm` — nada a mudar.)

- [ ] **Step 4: (pulado — `control` já disponível)**

- [ ] **Step 5: Substituir input de Qtd (kg) na tabela de itens**

No JSX da tabela (linhas ~420-430 da coluna "Qtd"), substituir o `CFormInput type="number"` por (observe a prop `size="sm"` preservada da versão atual):

```tsx
<Controller
  control={control}
  name={`items.${index}.quantity`}
  render={({ field }) => (
    <NumericInput
      value={field.value ?? null}
      onChange={field.onChange}
      decimals={3}
      size="sm"
      placeholder="0,000"
      invalid={!!errors.items?.[index]?.quantity}
    />
  )}
/>
```

- [ ] **Step 6: Substituir input de Preço unit. (R$) na tabela de itens**

No JSX da coluna "Preço unit." (linhas ~426-440), substituir por:

```tsx
<Controller
  control={control}
  name={`items.${index}.unitPrice`}
  render={({ field }) => (
    <CurrencyInput
      value={field.value ?? null}
      onChange={field.onChange}
      size="sm"
      placeholder="0,00"
      invalid={!!errors.items?.[index]?.unitPrice}
    />
  )}
/>
```

- [ ] **Step 7: Rodar typecheck**

Run: `pnpm --filter frontend exec tsc --noEmit`
Expected: sem erros.

- [ ] **Step 8: Rodar tests**

Run: `pnpm --filter frontend test`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add apps/frontend/src/pages/recycling/purchases/NewPurchasePage.tsx
git commit -m "fix(purchases): use CurrencyInput/NumericInput for price and quantity"
```

---

### Task 17: `SuppliersPage` — `<DocumentInput>` + `<PhoneInput>`

**Files:**
- Modify: `apps/frontend/src/pages/recycling/suppliers/SuppliersPage.tsx`

A página já tem schema `superRefine` completo com CPF/CNPJ, já extrai `documentType = watch('documentType')` na linha ~132, e usa uma função local `formatDocument(doc, type)` para listagem (linha 72-78) que trata `null → '—'` — **mantemos a local** porque cobre caso nulo; a utilitária `formatDocument(digits, type)` é para inputs. O telefone aparece em dois blocos JSX (condicional a `documentType`): ambos precisam virar `<PhoneInput>`.

- [ ] **Step 1: Adicionar imports e `control` no useForm**

No topo do arquivo, adicionar:

```tsx
import { Controller } from 'react-hook-form';
import { DocumentInput, PhoneInput } from '../../../components/inputs';
```

Adicionar `control` ao destructuring existente em `const { register, handleSubmit, reset, watch, formState: ... } = useForm<FormData>(...)` (linhas ~124-130):

```tsx
const {
  register,
  control,
  handleSubmit,
  reset,
  watch,
  formState: { errors, isSubmitting },
} = useForm<FormData>({ resolver: zodResolver(schema) });
```

- [ ] **Step 2: Substituir o `CFormInput` do documento**

Localizar o bloco condicional `{documentType ? (...)}` (por volta da linha 235) e, dentro do `then` branch, substituir:

```tsx
<CFormInput
  {...register('document')}
  placeholder={documentType === 'CPF' ? '00000000000' : '00000000000000'}
  invalid={!!errors.document}
/>
```

por:

```tsx
<Controller
  control={control}
  name="document"
  render={({ field }) => (
    <DocumentInput
      type={documentType === 'CPF' ? 'CPF' : 'CNPJ'}
      value={field.value ?? ''}
      onChange={field.onChange}
      invalid={!!errors.document}
      placeholder={documentType === 'CPF' ? '000.000.000-00' : '00.000.000/0000-00'}
    />
  )}
/>
```

- [ ] **Step 3: Substituir ambos os `CFormInput` de telefone**

A página tem dois blocos de telefone: um quando `!documentType` (linha ~252) e outro quando `documentType` existe (linha ~258). Ambos usam:

```tsx
<CFormInput {...register('phone')} placeholder="(00) 00000-0000" />
```

Substituir ambos (mesmo conteúdo, dois lugares) por:

```tsx
<Controller
  control={control}
  name="phone"
  render={({ field }) => (
    <PhoneInput
      value={field.value ?? ''}
      onChange={field.onChange}
      placeholder="(00) 00000-0000"
    />
  )}
/>
```

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter frontend exec tsc --noEmit`
Expected: sem erros.

- [ ] **Step 5: Tests**

Run: `pnpm --filter frontend test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/frontend/src/pages/recycling/suppliers/SuppliersPage.tsx
git commit -m "fix(suppliers): use DocumentInput and PhoneInput with masks"
```

---

### Task 18: `BuyersPage` — refatorar para `document`/`documentType` + componentes novos

**Files:**
- Modify: `apps/frontend/src/services/recycling/buyers.service.ts` (já alterado em Task 14)
- Modify: `apps/frontend/src/pages/recycling/buyers/BuyersPage.tsx`

- [ ] **Step 1: Ler a página (schema ~30-35, reset ~100-115, submit ~115-125, form ~155-180, tabela ~370-380)**

Run: `cat apps/frontend/src/pages/recycling/buyers/BuyersPage.tsx`

- [ ] **Step 2: Substituir o schema Zod**

Localizar o schema (~linhas 30-35) e substituir por:

```typescript
const schema = z
  .object({
    name: z.string().min(2, 'Nome obrigatório'),
    document: z
      .string()
      .regex(/^\d{11}$|^\d{14}$/, 'Documento deve ter 11 (CPF) ou 14 (CNPJ) dígitos')
      .optional()
      .or(z.literal('')),
    documentType: z.enum(['CPF', 'CNPJ']).optional(),
    phone: z.string().optional(),
    contactName: z.string().optional(),
  })
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
    if (data.documentType === 'CPF' && data.document.length !== 11) {
      ctx.addIssue({ code: 'custom', path: ['document'], message: 'CPF deve ter 11 dígitos' });
    }
    if (data.documentType === 'CNPJ' && data.document.length !== 14) {
      ctx.addIssue({ code: 'custom', path: ['document'], message: 'CNPJ deve ter 14 dígitos' });
    }
  });

type FormData = z.infer<typeof schema>;
```

- [ ] **Step 3: Adicionar imports**

Adicionar `CFormSelect` ao bloco existente de imports de `@coreui/react` (ele ainda não está lá). E adicionar os novos imports:

```tsx
import { Controller } from 'react-hook-form';
import { DocumentInput, PhoneInput } from '../../../components/inputs';
import { formatDocument } from '../../../utils/masks';
```

- [ ] **Step 4: Atualizar ambos os branches do `reset`**

No `useEffect` de abertura do modal (linhas ~98-113), trocar o branch de edição:

```tsx
reset({
  name: editing.name,
  document: editing.document ?? '',
  documentType: editing.documentType ?? undefined,
  phone: editing.phone ?? '',
  contactName: editing.contactName ?? '',
});
```

E o branch de novo comprador:

```tsx
reset({ name: '', document: '', documentType: undefined, phone: '', contactName: '' });
```

- [ ] **Step 5: Atualizar o handler `onSubmit`**

No handler `onSubmit` (linhas ~115-122), substituir o bloco `const payload = { ..., cnpj: data.cnpj || null, ... }` por:

```typescript
const payload = {
  name: data.name,
  document: data.document || null,
  documentType: data.document ? data.documentType ?? null : null,
  phone: data.phone || null,
  contactName: data.contactName || null,
};
```

O resto do handler (chamada a `buyersService.create/update(payload)`) permanece igual.

- [ ] **Step 6: Trocar o campo único de CNPJ no form por select `documentType` + `<DocumentInput>`**

Localizar o bloco que hoje tem o rótulo "CNPJ (14 dígitos, opcional)" e seu input (linhas ~160-170). Substituir por:

```tsx
<div className="row g-3">
  <div className="col-md-4">
    <label className="form-label">Tipo de documento</label>
    <CFormSelect {...register('documentType')} invalid={!!errors.documentType}>
      <option value="">—</option>
      <option value="CPF">CPF</option>
      <option value="CNPJ">CNPJ</option>
    </CFormSelect>
    {errors.documentType && (
      <CFormFeedback invalid>{errors.documentType.message}</CFormFeedback>
    )}
  </div>
  <div className="col-md-8">
    <label className="form-label">
      {watch('documentType') === 'CPF' ? 'CPF' : 'CNPJ'} (opcional)
    </label>
    <Controller
      control={control}
      name="document"
      render={({ field }) => (
        <DocumentInput
          type={watch('documentType') === 'CPF' ? 'CPF' : 'CNPJ'}
          value={field.value ?? ''}
          onChange={field.onChange}
          invalid={!!errors.document}
          placeholder={watch('documentType') === 'CPF' ? '000.000.000-00' : '00.000.000/0000-00'}
        />
      )}
    />
    {errors.document && <CFormFeedback invalid>{errors.document.message}</CFormFeedback>}
  </div>
</div>
```

Adicionar `control` e `watch` ao destructuring do `useForm` caso ainda não estejam.

- [ ] **Step 7: Substituir input de telefone por `<PhoneInput>`**

Localizar o `CFormInput` de telefone (linha ~171) e trocar por:

```tsx
<Controller
  control={control}
  name="phone"
  render={({ field }) => (
    <PhoneInput
      value={field.value ?? ''}
      onChange={field.onChange}
      placeholder="(00) 00000-0000"
    />
  )}
/>
```

- [ ] **Step 7b: Adicionar reset de `document` quando `documentType` muda**

Para evitar UX confusa (ex.: usuário digita CNPJ de 14 dígitos, depois troca pra CPF — o display trunca visualmente mas o form state ainda tem 14 dígitos), adicionar um `useEffect` logo após os hooks do `useForm`:

```tsx
const watchedDocumentType = watch('documentType');
useEffect(() => {
  // When the user switches between CPF/CNPJ, clear the document field so they start fresh.
  setValue('document', '', { shouldValidate: false, shouldDirty: false });
}, [watchedDocumentType, setValue]);
```

Isso exige `setValue` no destructuring do `useForm`.

- [ ] **Step 8: Atualizar formatação na tabela**

Localizar a função local `formatCnpj` (linhas ~42-45) e removê-la. Na linha ~375 onde ela é usada (`{formatCnpj(b.cnpj)}`), trocar por:

```tsx
{b.document && b.documentType ? formatDocument(b.document, b.documentType) : '—'}
```

- [ ] **Step 9: Typecheck**

Run: `pnpm --filter frontend exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 10: Tests**

Run: `pnpm --filter frontend test`
Expected: PASS.

- [ ] **Step 11: Commit**

```bash
git add apps/frontend/src/services/recycling/buyers.service.ts \
        apps/frontend/src/pages/recycling/buyers/BuyersPage.tsx
git commit -m "feat(buyers): support PF/PJ with masked document and phone inputs"
```

---

### Task 19: `ColetaFormDialog` — `<TimeInput>` 24h

**Files:**
- Modify: `apps/frontend/src/pages/recycling/coletas/ColetaFormDialog.tsx:305`
- Modify: `apps/frontend/src/pages/recycling/coletas/ColetaFormDialog.tsx:13-19` (schema)

- [ ] **Step 1: Ler o arquivo**

Run: `sed -n '1,30p' apps/frontend/src/pages/recycling/coletas/ColetaFormDialog.tsx`
Run: `sed -n '295,320p' apps/frontend/src/pages/recycling/coletas/ColetaFormDialog.tsx`

- [ ] **Step 2: Atualizar schema**

Trocar a linha do `scheduledTime` por:

```typescript
scheduledTime: z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Hora inválida (use HH:mm, 24h)'),
```

- [ ] **Step 3: Adicionar import**

No topo, adicionar apenas:

```tsx
import { TimeInput } from '../../../components/inputs';
```

(`Controller` já está importado de `react-hook-form` e `control` já está no destructuring do `useForm` — nada mais a adicionar.)

- [ ] **Step 4: Substituir o input de hora**

Localizar a linha 305 (`<CFormInput type="time" lang="pt-BR" {...register('scheduledTime')} />`) e substituir por:

```tsx
<Controller
  control={control}
  name="scheduledTime"
  render={({ field }) => (
    <TimeInput
      value={field.value ?? ''}
      onChange={field.onChange}
      invalid={!!errors.scheduledTime}
    />
  )}
/>
```

- [ ] **Step 5: Typecheck**

Run: `pnpm --filter frontend exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Tests**

Run: `pnpm --filter frontend test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/frontend/src/pages/recycling/coletas/ColetaFormDialog.tsx
git commit -m "fix(coletas): use TimeInput for 24h time entry"
```

---

## Phase 4 — Validação final

### Task 20: Smoke test manual + lint

**Files:** (apenas execução, sem mudanças)

- [ ] **Step 1: Lint em tudo**

Run: `pnpm lint`
Expected: PASS.

- [ ] **Step 2: Typecheck em backend e frontend**

Run: `pnpm --filter backend exec tsc --noEmit && pnpm --filter frontend exec tsc --noEmit`
Expected: PASS em ambos.

- [ ] **Step 3: Suite de testes completa**

Run: `pnpm test`
Expected: todos os testes PASS.

- [ ] **Step 4: Smoke browser — subir o ambiente**

Run: `docker-compose up -d` (se ainda não estiver rodando) e `pnpm --filter frontend dev`

Abrir o browser em `http://localhost:5173` e testar manualmente:

- **Novo produto:** digitar `0,4` e `1.234,56` no preço. Ambos aceitos. Tecla `.` bloqueada. Submeter — valor correto no payload (checar Network tab: `pricePerUnit: 0.4` e `1234.56`).
- **Nova compra:** adicionar item. Preço unit. aceita `4,5` → exibe `4,50`. Qtd aceita `10,5` → exibe `10,500`. Subtotal bate. Registrar compra com sucesso.
- **Novo fornecedor:** tipo CPF → digitar `12345678901` → mostra `123.456.789-01`. Trocar para CNPJ → campo trunca/limpa. Telefone `11987654321` → mostra `(11) 98765-4321`. Salvar.
- **Novo comprador:** criar como CPF (pessoa física) — campo documento aplica máscara. Salvar e verificar que aparece na listagem formatado. Criar outro como CNPJ. Verificar que ambos persistem corretamente.
- **Nova coleta:** campo hora — digitar `1430` → vira `14:30`. Tentar `2999` → campo aceita, mas ao submeter o schema acusa "Hora inválida". Corrigir para `14:30` e salvar. Verificar no banco que `scheduled_at` tem a hora correta (não meio-dia nem nada deslocado).

Se qualquer cenário falhar, voltar à task correspondente e corrigir antes de seguir.

- [ ] **Step 5: (opcional) Abrir PR**

Caso o usuário autorize:

```bash
gh pr create --title "fix: pt-BR UX fixes across recycling forms" --body "..."
```

---

## Resumo de Commits Planejados

1. `feat(utils): add CPF, document, and pt-BR decimal formatters`
2. `feat(inputs): add NumericInput with pt-BR decimal formatting`
3. `feat(inputs): add CurrencyInput preset`
4. `feat(inputs): add DocumentInput with CPF/CNPJ masking`
5. `feat(inputs): add PhoneInput with BR phone masking`
6. `feat(inputs): add TimeInput with HH:mm mask`
7. `feat(inputs): add barrel export`
8. `refactor(buyers): support PF/PJ with document + documentType fields`
9. `fix(products): use CurrencyInput for price (pt-BR decimal)`
10. `fix(purchases): use CurrencyInput/NumericInput for price and quantity`
11. `fix(suppliers): use DocumentInput and PhoneInput with masks`
12. `feat(buyers): support PF/PJ with masked document and phone inputs`
13. `fix(coletas): use TimeInput for 24h time entry`
