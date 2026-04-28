# Auto-focus no campo Qtd após selecionar produto (Nova Compra / Nova Venda)

**Data:** 2026-04-27
**Branch:** redesign/praktikus-v2
**Escopo:** apenas frontend (2 arquivos)

---

## Contexto

Nas páginas `NewPurchasePage.tsx` e `NewSalePage.tsx`, ao selecionar um produto na coluna "Produto" da tabela de itens, o backend pré-preenche o `unitPrice` (via `setValue` no `handleProductChange`). A quantidade vem com default `1,000` (3 casas decimais).

Hoje o usuário precisa **clicar manualmente** no campo "Qtd (kg)" para digitar a quantidade real. Em fluxos de digitação rápida (ex.: balança a balança no caixa), isso adiciona um clique desnecessário em cada item.

## Objetivo

Após selecionar um produto, **mover o foco automaticamente para o input de Qtd da mesma linha** e **selecionar o conteúdo atual** (`1,000`), de modo que o próximo dígito digitado substitui o default. Comportamento "tabular" comum em ERPs e planilhas.

## Decisão de design (validada no brainstorming)

- Atribuir um `id` determinístico no `<NumericInput>` da quantidade para localizá-lo no DOM (`item-quantity-${index}`).
- Após o `setValue(unitPrice)` no `handleProductChange`, usar `requestAnimationFrame` para esperar o render reativo do `<Controller>`, então `document.getElementById(...)?.focus()` seguido de `.select()`.
- Aplicar nos **dois arquivos** (compra e venda), que já têm `handleProductChange` quase idêntico.

## Arquitetura

### Mudança em ambos os arquivos

**`apps/frontend/src/pages/recycling/purchases/NewPurchasePage.tsx`** e
**`apps/frontend/src/pages/recycling/sales/NewSalePage.tsx`**:

#### 1. Adicionar `id` ao `<NumericInput>` de quantidade

No `<Controller name={\`items.${index}.quantity\`}>`, dentro do `render={({ field }) => ...}`, adicionar a prop `id`:

```tsx
<NumericInput
  id={`item-quantity-${index}`}
  value={field.value ?? null}
  onChange={field.onChange}
  decimals={3}
  size="sm"
  placeholder="0,000"
  invalid={!!errors.items?.[index]?.quantity}
/>
```

A prop `id` cai no `...rest` do `NumericInput` e é repassada ao `<CFormInput>` interno, que a renderiza no `<input>` do DOM. Verificado lendo `apps/frontend/src/components/inputs/NumericInput.tsx` — a interface `NumericInputProps extends BaseProps` onde `BaseProps = Omit<CFormInputProps, 'type' | 'value' | 'onChange'>`, então `id` está disponível e é spread em `<CFormInput {...rest}>`.

#### 2. Atualizar `handleProductChange`

Antes:

```tsx
const handleProductChange = (index: number, productId: string) => {
  const product = products.find((p) => p.id === productId);
  if (product) {
    setValue(`items.${index}.unitPrice`, product.pricePerUnit);
  }
};
```

Depois:

```tsx
const handleProductChange = (index: number, productId: string) => {
  const product = products.find((p) => p.id === productId);
  if (!product) return;
  setValue(`items.${index}.unitPrice`, product.pricePerUnit);

  // Auto-focus na quantidade da mesma linha. requestAnimationFrame garante que o
  // <Controller> reagiu ao setValue e o input já está montado/atualizado no DOM.
  requestAnimationFrame(() => {
    const el = document.getElementById(`item-quantity-${index}`) as HTMLInputElement | null;
    el?.focus();
    el?.select();
  });
};
```

`select()` cobre o caso esperado de o usuário começar a digitar imediatamente — o valor default `1,000` fica selecionado e é substituído pelo primeiro dígito.

### Por que não usar React refs

Manter refs em array (um ref por linha do `useFieldArray`) exige `forwardRef` no `NumericInput` (que hoje não tem) e gerenciar `useRef([])` com sincronização de tamanho ao adicionar/remover itens. Para uma única ação de foco pós-evento, `getElementById` é mais simples, sem custo arquitetural duradouro, e funciona porque o `id` é estável durante a vida da linha.

### Por que `requestAnimationFrame`

O `setValue` do react-hook-form atualiza o estado do form, que dispara um re-render. O `<Controller>` recebe o novo `value` no próximo ciclo. Acessar `getElementById` síncrono dentro do `handleProductChange` pode pegar o input antes do re-render terminar (especialmente em React 19 com batching agressivo). `requestAnimationFrame` agenda para após o próximo paint, quando o DOM está estável.

`setTimeout(..., 0)` funcionaria, mas `requestAnimationFrame` é semanticamente mais correto (esperar próximo render frame).

## Testes

Sem testes automatizados específicos — o comportamento é DOM/timing e exigiria mockar `requestAnimationFrame` + jsdom focus management, dando complexidade desproporcional ao valor.

Smoke manual:

1. Em `/recycling/purchases/new`: selecionar fornecedor → click "Adicionar item" → trocar select de produto para qualquer produto → cursor pula automaticamente para o input "Qtd (kg)" e o conteúdo `1,000` aparece selecionado → digitar `25` substitui para `25` (não vira `1,00025`) → ao tab, vai pra "Preço unit." (já preenchido com price do produto).
2. Adicionar segundo item → trocar produto da segunda linha → cursor pula para Qtd da linha 2 (não da linha 1).
3. Repetir o teste em `/recycling/sales/new` (Nova Venda).
4. Mobile: comportamento pode variar (em iOS o `focus()` programático às vezes não abre teclado por restrição do sistema). Aceitável — UX em mobile recai para tap manual no campo.

## Riscos

- **Mobile (iOS) bloqueia foco programático fora de gesture**: o foco pode não acontecer ou o teclado pode não abrir automaticamente. Aceitável: o usuário toca no campo manualmente como hoje. Não regride nada.
- **`getElementById` retorna null** se a linha foi removida entre o evento e o RAF: o `?.focus()` é defensivo (`?.`) e silenciosamente não faz nada. Sem erro.
- **Ids duplicados** se a página alguma vez renderizar dois `useFieldArray` — não acontece, mas se acontecer no futuro, o `getElementById` pega o primeiro. Mitigação: revisar caso essa página vire genérica (out-of-scope).
- **Acessibilidade**: focar programaticamente após uma ação do usuário é aceitável e até desejável (movimentação intencional do foco em fluxos de entrada de dados). Sem WCAG concern.

## Fora de escopo

- Estender o mesmo comportamento para outros campos auto-preenchidos no app (ex.: ColetaFormDialog) — feature isolada por enquanto, replicar quando solicitado.
- Configuração de comportamento (toggle "auto-focus on") nas settings do tenant — YAGNI; se um usuário não gostar, podemos adicionar depois.
- Refatorar `NumericInput` para aceitar `forwardRef` — não necessário para esta tarefa.
- Reset do default `1,000` da quantidade quando produto muda — mantém-se o default atual; o `select()` resolve a UX do "começar a digitar e substituir".
