# Auto-focus Qtd após selecionar produto — Plano

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Quando o usuário seleciona um produto na tabela de itens das telas Nova Compra ou Nova Venda, o foco vai automaticamente para o input "Qtd (kg)" da mesma linha, com o conteúdo selecionado pra que o próximo dígito substitua o default `1,000`.

**Architecture:** Atribuir um `id` determinístico ao `<NumericInput>` da quantidade (`item-quantity-${index}`) e, no `handleProductChange`, após o `setValue(unitPrice)`, usar `requestAnimationFrame` para aguardar o re-render do Controller e então `getElementById(...).focus() + .select()`.

**Tech Stack:** React 19 + react-hook-form + Controller + NumericInput (interno).

**Spec:** [docs/superpowers/specs/2026-04-27-auto-focus-quantity-after-product-design.md](../specs/2026-04-27-auto-focus-quantity-after-product-design.md)

---

## File Structure

**Modificados:**
- `apps/frontend/src/pages/recycling/purchases/NewPurchasePage.tsx`
- `apps/frontend/src/pages/recycling/sales/NewSalePage.tsx`

**Sem novos arquivos. Sem testes automatizados** (DOM/timing — smoke manual cobre).

---

## Task 1: Aplicar nas duas páginas (commit atômico)

**Files:**
- Modify: `apps/frontend/src/pages/recycling/purchases/NewPurchasePage.tsx`
- Modify: `apps/frontend/src/pages/recycling/sales/NewSalePage.tsx`

### Step 1.1: Atualizar `handleProductChange` em `NewPurchasePage.tsx`

Localizar o bloco em torno da linha 163:

```tsx
  const handleProductChange = (index: number, productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (product) {
      setValue(`items.${index}.unitPrice`, product.pricePerUnit);
    }
  };
```

Substituir por:

```tsx
  const handleProductChange = (index: number, productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;
    setValue(`items.${index}.unitPrice`, product.pricePerUnit);

    // Auto-focus na quantidade da mesma linha após o re-render do Controller.
    requestAnimationFrame(() => {
      const el = document.getElementById(`item-quantity-${index}`) as HTMLInputElement | null;
      el?.focus();
      el?.select();
    });
  };
```

### Step 1.2: Adicionar `id` ao `<NumericInput>` da quantidade em `NewPurchasePage.tsx`

Localizar o bloco do `<Controller name={\`items.${index}.quantity\`}>` (em torno da linha 412):

```tsx
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
```

Substituir por (apenas adiciona a linha `id=...`):

```tsx
                            name={`items.${index}.quantity`}
                            render={({ field }) => (
                              <NumericInput
                                id={`item-quantity-${index}`}
                                value={field.value ?? null}
                                onChange={field.onChange}
                                decimals={3}
                                size="sm"
                                placeholder="0,000"
                                invalid={!!errors.items?.[index]?.quantity}
                              />
                            )}
```

### Step 1.3: Atualizar `handleProductChange` em `NewSalePage.tsx`

Localizar o bloco em torno da linha 182:

```tsx
  const handleProductChange = (index: number, productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (product) {
      setValue(`items.${index}.unitPrice`, product.pricePerUnit);
    }
  };
```

Substituir por:

```tsx
  const handleProductChange = (index: number, productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;
    setValue(`items.${index}.unitPrice`, product.pricePerUnit);

    // Auto-focus na quantidade da mesma linha após o re-render do Controller.
    requestAnimationFrame(() => {
      const el = document.getElementById(`item-quantity-${index}`) as HTMLInputElement | null;
      el?.focus();
      el?.select();
    });
  };
```

### Step 1.4: Adicionar `id` ao `<NumericInput>` da quantidade em `NewSalePage.tsx`

Localizar o bloco do `<Controller name={\`items.${index}.quantity\`}>` (em torno da linha 444). **Atenção:** o `invalid` aqui é diferente do NewPurchasePage — inclui `|| insufficient`. Preservar essa diferença.

Antes:

```tsx
                            name={`items.${index}.quantity`}
                            render={({ field }) => (
                              <NumericInput
                                value={field.value ?? null}
                                onChange={field.onChange}
                                decimals={3}
                                size="sm"
                                placeholder="0,000"
                                invalid={!!errors.items?.[index]?.quantity || insufficient}
                              />
                            )}
```

Depois:

```tsx
                            name={`items.${index}.quantity`}
                            render={({ field }) => (
                              <NumericInput
                                id={`item-quantity-${index}`}
                                value={field.value ?? null}
                                onChange={field.onChange}
                                decimals={3}
                                size="sm"
                                placeholder="0,000"
                                invalid={!!errors.items?.[index]?.quantity || insufficient}
                              />
                            )}
```

### Step 1.5: Typecheck

Run:
```bash
source ~/.nvm/nvm.sh && nvm use 20 > /dev/null && cd /home/vinicius/Projetos/vinicius/praktikus && pnpm --filter frontend exec tsc --noEmit
```
Expected: zero errors.

### Step 1.6: Build (production)

Run:
```bash
source ~/.nvm/nvm.sh && nvm use 20 > /dev/null && pnpm --filter frontend build
```
Expected: `✓ built in ...ms`. Zero errors.

### Step 1.7: Tests

Run:
```bash
source ~/.nvm/nvm.sh && nvm use 20 > /dev/null && pnpm --filter frontend test
```
Expected: 78/80 baseline. Falhas pré-existentes em `App.test.tsx` e `LoginPage.test.tsx` permanecem; **nenhuma nova falha introduzida**.

### Step 1.8: Commit (atômico)

```bash
cd /home/vinicius/Projetos/vinicius/praktikus
git add apps/frontend/src/pages/recycling/purchases/NewPurchasePage.tsx \
        apps/frontend/src/pages/recycling/sales/NewSalePage.tsx
git commit -m "feat(items): auto-focus quantity after product selection"
```

---

## Task 2: Smoke test manual

**Files:** (apenas execução)

### Step 2.1: Subir o frontend

Se o stack está rodando via Docker:

```bash
docker compose up -d --build frontend
```

Ou em modo dev:

```bash
source ~/.nvm/nvm.sh && nvm use 20 > /dev/null && pnpm --filter frontend dev
```

### Step 2.2: Smoke checklist

**Nova Compra (`/recycling/purchases/new`):**

1. Selecionar fornecedor → click "Adicionar item".
2. Trocar select de produto da linha 1 para qualquer produto → cursor pula automaticamente para o input "Qtd (kg)" da linha 1; o conteúdo `1,000` aparece selecionado.
3. Sem clicar em lugar nenhum, digitar `25` → o input mostra `25` (não `1,00025`).
4. Adicionar segundo item → trocar produto da linha 2 → cursor pula para Qtd da linha 2 (não da linha 1). Repetir digitação `15`.
5. Submeter "Registrar compra" → flow normal sem regressão.

**Nova Venda (`/recycling/sales/new`):**

6. Selecionar comprador → click "Adicionar item".
7. Trocar produto → cursor pula para Qtd da mesma linha → conteúdo selecionado → digitar substitui o default.
8. Submeter "Registrar venda" → flow normal sem regressão.

**Mobile (DevTools, ≤640px):**

9. Em iOS o foco programático pode não abrir o teclado automaticamente — aceitável (degradação para tap manual). Em Android/Chrome, costuma funcionar.

### Step 2.3: Push (opcional)

Se o smoke passar:

```bash
git push origin redesign/praktikus-v2
```

---

## Resumo de commits

1. `feat(items): auto-focus quantity after product selection` — ambos os arquivos num commit atômico.
