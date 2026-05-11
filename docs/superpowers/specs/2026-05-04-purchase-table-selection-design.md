# Design — Compra com seletor de tabela + auto-fill no cadastro de produto

**Data:** 2026-05-04
**Branch base:** `redesign/praktikus-v2`
**Escopo:** evolução pequena sobre o feature de [múltiplas tabelas de preço](2026-05-03-multi-price-tables-design.md) (já em produção). Três mudanças cirúrgicas:
1. **Compras**: novo campo "Tabela de preço" no header da Nova Compra. Sugestão de preço por item passa a vir da tabela escolhida. Trocar tabela com itens já adicionados pede confirmação e recalcula.
2. **Cadastro de produto**: deixar Tabela 2 e Tabela 3 em branco no modal passa a significar "use o valor da Tabela 1 ao salvar" (auto-fill no client antes de enviar).
3. **Inputs de preço do `PriceRow`**: aceitar vírgula como separador decimal e exibir no formato BR (ex.: `6,50`). Hoje o `<CFormInput type="number">` só aceita ponto.

Vendas e Caixa **ficam fora desta entrega**.

---

## Contexto e motivação

A entrega anterior introduziu o conceito de tabela de preço como entidade de primeira classe. Vendas/Compras/Caixa continuaram lendo `Product.pricePerUnit` (denormalização da Tabela 1) sem mudança — estratégia gradual.

O usuário relatou duas dores na operação real:

- **Compras** com fornecedores diferentes precisam usar tabelas diferentes. Hoje a sugestão de preço sempre vem da Padrão; o operador troca manualmente cada item.
- **Cadastrar produto** exigindo preencher 3 tabelas separadas é fricção quando, na maioria dos casos, o preço é o mesmo nas três. O botão "Replicar Tabela 1" ajuda mas exige clique extra.

Esta evolução resolve as duas com mudanças mínimas.

## Decisões alinhadas com o usuário

| # | Decisão | Escolha |
|---|---|---|
| 1 | Auto-fill no cadastro: storage vs. read-time fallback | **A — Storage**: vazio em t2/t3 vira o valor de t1 no momento do save (feito no client). |
| 2 | Persistir `priceTableId` na `Purchase`? | **Sim** — registro do contexto ("essa compra usou tabela X"). FK ON DELETE RESTRICT. |
| 3 | Servidor valida `unitPrice` contra `product.prices[priceTableId]`? | **Não** — continua confiando no client (preserva override manual). |
| 4 | Trocar tabela mid-purchase com itens já adicionados | **C — Confirm dialog**: avisa que vai sobrescrever overrides manuais, recalcula só se confirmar. |
| 5 | `PriceRow` aceita vírgula | Sim — refator interno usando `parseDecimal`/`formatDecimal` de `utils/masks.ts`. Visual atual (R$ overlay + /kg sufixo) preservado. |

## Fora de escopo (explícito)

- Vendas e Caixa (continuam usando `pricePerUnit` da Tabela 1 implicitamente).
- Backfill retroativo de produtos com `null` em t2/t3 (ficam como estão até serem editados).
- Renomear/remover o botão "Replicar Tabela 1" no modal de produto (mantido como affordance visual; com o auto-fill ele vira redundante mas inofensivo).
- Validação server-side de que `unitPrice` bate com a tabela escolhida (mantém override manual livre).
- CRUD de tabelas de preço em Configurações (continua sem implementar).
- Custom modal pra confirmação de troca de tabela em Compras — usamos `window.confirm` (consistente com `handleDelete` do `ProductsPage`).

---

## 1. Modelo de dados (backend)

### 1.1 `PurchaseEntity` ganha campo

```ts
// apps/backend/src/modules/recycling/purchases/purchase.entity.ts
@Column({ name: 'price_table_id', type: 'uuid' })
priceTableId: string;

@ManyToOne(() => PriceTableEntity, { onDelete: 'RESTRICT' })
@JoinColumn({ name: 'price_table_id' })
priceTable: PriceTableEntity;
```

NOT NULL no banco. ON DELETE RESTRICT impede deletar uma tabela de preço que tem compras associadas (consistente com o tratamento de `product_prices`).

### 1.2 Helper SQL único e idempotente

A tabela `purchases` é criada antes de `price_tables` no fluxo atual (`recyclingTables` vem antes de `buildPriceTablesSql` em `create-tenant-tables.ts`). Para novos tenants, a coluna `price_table_id` precisa ser adicionada **após** `price_tables` existir e estar seedada.

**Estratégia:** criar um helper SQL idempotente em `apps/backend/src/database/tenant-migrations/price-tables.sql.ts` (mesmo arquivo das outras helpers), que serve para **ambos** os caminhos — provisioning de novo tenant e migration de tenant existente:

```ts
// price-tables.sql.ts
export function buildPurchasesPriceTableSetupSql(schemaName: string): string[] {
  return [
    // 1) Adicionar coluna se não existir (idempotente)
    `ALTER TABLE "${schemaName}".purchases
       ADD COLUMN IF NOT EXISTS price_table_id UUID`,

    // 2) Backfill: para qualquer linha sem priceTableId, atribuir a tabela padrão.
    //    Em tenant novo a tabela está vazia; em tenant existente preenche linhas legadas.
    `UPDATE "${schemaName}".purchases p
        SET price_table_id = pt.id
       FROM "${schemaName}".price_tables pt
      WHERE pt.is_default = true AND pt.active = true AND p.price_table_id IS NULL`,

    // 3) NOT NULL (idempotente — Postgres aceita SET NOT NULL em coluna já NOT NULL)
    `ALTER TABLE "${schemaName}".purchases
       ALTER COLUMN price_table_id SET NOT NULL`,

    // 4) FK condicional (Postgres não tem ADD CONSTRAINT IF NOT EXISTS; usa DO block)
    `DO $do$ BEGIN
       IF NOT EXISTS (
         SELECT 1 FROM information_schema.table_constraints
          WHERE table_schema = '${schemaName}'
            AND table_name = 'purchases'
            AND constraint_name = 'fk_purchases_price_table'
       ) THEN
         ALTER TABLE "${schemaName}".purchases
           ADD CONSTRAINT fk_purchases_price_table
           FOREIGN KEY (price_table_id)
           REFERENCES "${schemaName}".price_tables(id)
           ON DELETE RESTRICT;
       END IF;
     END $do$`,
  ];
}
```

### 1.3 Wiring no `create-tenant-tables.ts`

Atualizar o branch RECYCLING para chamar o novo helper **após** os seeds:

```ts
return [
  ...recyclingTables,                         // já existente
  ...buildPriceTablesSql(schemaName),         // já existente
  ...buildPriceTablesSeedSql(schemaName),     // já existente
  ...buildPurchasesPriceTableSetupSql(schemaName),  // NOVO
  ...whatsappTables,                          // já existente
];
```

### 1.4 Migration TypeORM (tenants existentes)

`apps/backend/src/database/migrations/1748300000000-AddPriceTableIdToPurchases.ts`:

```ts
import { MigrationInterface, QueryRunner } from 'typeorm';
import { TenantSegment } from '@praktikus/shared';
import { buildPurchasesPriceTableSetupSql } from '../tenant-migrations/price-tables.sql';

export class AddPriceTableIdToPurchases1748300000000 implements MigrationInterface {
  name = 'AddPriceTableIdToPurchases1748300000000';

  public async up(qr: QueryRunner): Promise<void> {
    const tenants: Array<{ id: string }> = await qr.query(
      `SELECT id FROM "public"."tenants" WHERE segment = $1`,
      [TenantSegment.RECYCLING],
    );
    for (const t of tenants) {
      const schema = `tenant_${t.id.replace(/-/g, '')}`;
      for (const sql of buildPurchasesPriceTableSetupSql(schema)) {
        await qr.query(sql);
      }
    }
  }

  public async down(qr: QueryRunner): Promise<void> {
    const tenants: Array<{ id: string }> = await qr.query(
      `SELECT id FROM "public"."tenants" WHERE segment = $1`,
      [TenantSegment.RECYCLING],
    );
    for (const t of tenants) {
      const schema = `tenant_${t.id.replace(/-/g, '')}`;
      await qr.query(
        `ALTER TABLE "${schema}".purchases DROP CONSTRAINT IF EXISTS fk_purchases_price_table`,
      );
      await qr.query(
        `ALTER TABLE "${schema}".purchases DROP COLUMN IF EXISTS price_table_id`,
      );
    }
  }
}
```

Migration usa o mesmo helper que `create-tenant-tables.ts`, então a SQL fica em UM lugar só.

### 1.5 Registrar entity

`PriceTableEntity` já é um relation em `Purchase` agora. Como `database.module.ts` já registra `PriceTableEntity` (corrigido pós-Task 19 do plano anterior), nada novo aqui.

---

## 2. API (backend)

### 2.1 `CreatePurchaseDto`

`apps/backend/src/modules/recycling/purchases/dto/create-purchase.dto.ts` ganha:

```ts
@IsUUID()
priceTableId: string;
```

### 2.2 `PurchasesService.create`

Mudanças:

1. **Antes da transação**, validar que `priceTableId` corresponde a uma tabela ativa do tenant. Se não, `BadRequestException('Tabela de preço inválida ou inativa')`.
2. Persistir `priceTableId` no `purchaseRepo.create({...})`.
3. **NÃO** revalidar `unitPrice` contra `product.prices[priceTableId]` — preserva override manual existente.

```ts
// dentro do withSchema (antes do startTransaction):
const priceTable = await manager.getRepository(PriceTableEntity).findOne({
  where: { id: dto.priceTableId, active: true },
});
if (!priceTable) {
  throw new BadRequestException('Tabela de preço inválida ou inativa');
}

// no purchaseRepo.create:
const purchase = purchaseRepo.create({
  supplierId: dto.supplierId,
  priceTableId: dto.priceTableId,  // NOVO
  operatorId,
  cashSessionId: session.id,
  paymentMethod: dto.paymentMethod,
  totalAmount,
  notes: dto.notes ?? null,
  purchasedAt: new Date(),
});
```

### 2.3 Resposta de Purchase

`GET /recycling/purchases` e `GET /recycling/purchases/:id` ganham `priceTableId` no JSON. Frontend resolve o nome da tabela via `usePriceTables()` (cache de sessão).

Exemplo resposta:

```jsonc
{
  "id": "...",
  "supplierId": "...",
  "priceTableId": "...",     // NOVO
  "paymentMethod": "CASH",
  "totalAmount": "120.00",
  "purchasedAt": "...",
  "items": [...]
}
```

### 2.4 Tipos compartilhados

Em `packages/shared/src/types/recycling.ts`, atualizar (se houver) o tipo de `Purchase` para incluir `priceTableId: string`. Se não há tipo shared de Purchase ainda, deixar como está (frontend tem o seu próprio tipo `Purchase` em `services/recycling/purchases.service.ts`).

---

## 3. UI Compras

Página: `apps/frontend/src/pages/recycling/purchases/NewPurchasePage.tsx`.

### 3.1 Carregamento

A página passa a buscar **três recursos** em paralelo: `suppliers`, `products`, `priceTables` (este último via `usePriceTables()`). Loading skeleton até os três estarem prontos.

### 3.2 Header da compra

Card "Dados da compra" ganha `<CFormSelect>` "Tabela de preço *" alinhado com Fornecedor e Forma de pagamento. Default: `priceTables.find(t => t.isDefault)?.id`. Schema zod: `priceTableId: z.string().uuid('Selecione uma tabela')`.

Layout (≥768px): grid `1fr 1fr 1fr` (Fornecedor / Forma de pagamento / Tabela). Em mobile colapsa pra 1 coluna.

### 3.3 Sugestão de preço ao escolher produto

Atualizar `handleProductChange`:

```ts
const handleProductChange = (index: number, productId: string) => {
  const product = products.find(p => p.id === productId);
  if (!product) return;
  const tableId = watch('priceTableId');
  const suggested = product.prices[tableId] ?? product.pricePerUnit;
  setValue(`items.${index}.unitPrice`, suggested);
  // mantém auto-focus em quantity (existente)
};
```

O `?? product.pricePerUnit` é defensivo para dados legados (produtos com `null` em tabelas não-padrão). Após a Mudança #2 (auto-fill no save), produtos novos sempre terão valor em todas as tabelas.

### 3.4 Trocar tabela com itens já adicionados

Handler do `<CFormSelect onChange>` da tabela:

```ts
const handleTableChange = (newTableId: string) => {
  const items = watch('items') ?? [];
  const hasItems = items.some(i => i.productId);
  if (!hasItems) {
    setValue('priceTableId', newTableId);
    return;
  }
  const ok = window.confirm(
    'Trocar a tabela vai recalcular o preço sugerido dos itens já adicionados, ' +
    'sobrescrevendo edições manuais. Continuar?',
  );
  if (!ok) return; // mantém a tabela atual
  setValue('priceTableId', newTableId);
  items.forEach((it, idx) => {
    if (!it.productId) return;
    const product = products.find(p => p.id === it.productId);
    if (!product) return;
    const newPrice = product.prices[newTableId] ?? product.pricePerUnit;
    setValue(`items.${idx}.unitPrice`, newPrice);
  });
};
```

`window.confirm` é consistente com `handleDelete` do `ProductsPage`. Pode evoluir pra `<CModal>` próprio depois se a UX exigir.

### 3.5 Service e payload

`apps/frontend/src/services/recycling/purchases.service.ts` — `CreatePurchasePayload` ganha `priceTableId: string`. O método `create` envia o payload com a chave nova (axios já serializa).

---

## 4. UI Cadastro de Produto (auto-fill no save)

Componente: `apps/frontend/src/components/recycling/ProductDialog.tsx`. Mudança apenas no `onSubmit`:

```ts
const onSubmit = handleSubmit(async (data) => {
  const defaultTable = sorted.find(t => t.isDefault);
  if (!defaultTable) throw new Error('Tabela padrão não configurada');
  const defaultRaw = data.prices[defaultTable.id];
  const defaultValue = Number(defaultRaw);

  const prices: Record<string, number | null> = {};
  for (const [k, v] of Object.entries(data.prices)) {
    if (v == null || v === '') {
      // NOVO: vazio em tabela não-padrão = mesmo valor da padrão
      prices[k] = k === defaultTable.id ? null : defaultValue;
    } else {
      prices[k] = Number(v);
    }
  }
  await onSave({
    name: data.name,
    unitId: data.unitId,
    active: data.active,
    prices,
  });
});
```

A diferença vs. hoje: linha `prices[k] = k === defaultTable.id ? null : defaultValue`. Antes era sempre `null`. Para a padrão, o `null` é defensivo (zod já validou `> 0`).

### 4.1 Texto do callout no modal

Substituir o texto atual:
> ~~"As tabelas são gerenciadas em **Configurações → Tabelas de preço**. Tabelas em branco aparecerão como '—' na listagem."~~

Por:
> "A Tabela 1 (Padrão) é obrigatória. **Se você deixar as outras tabelas em branco, elas vão herdar o valor da Tabela 1 ao salvar.**"

(Remove a menção a Configurações para não criar expectativa quebrada — Configurações continua fora de escopo.)

### 4.2 Botão "Replicar Tabela 1"

**Mantém.** Continua sendo affordance visual útil (usuário vê o valor preenchido nos inputs antes de salvar). Com o auto-fill no save, o botão tornou-se redundante para o resultado final, mas ainda diferencia "preencher e ver" de "deixar em branco e confiar no auto-fill". Não vamos renomear nem remover.

### 4.3 Input de preço aceitar vírgula e exibir formato BR

**Bug atual:** o `<CFormInput type="number">` no `PriceRow` aceita apenas `.` como separador decimal. Em pt-BR isso é fricção — o usuário tenta digitar `6,50` e nada acontece.

**Solução:** refatorar o `PriceRow` para gerenciar o texto do input internamente, parseando vírgula OU ponto, e exibindo no formato BR. Reutilizar os helpers já existentes em [`apps/frontend/src/utils/masks.ts`](../../../apps/frontend/src/utils/masks.ts):
- `parseDecimal(text, decimals)` — converte `"6,50"` ou `"6.50"` em `6.5` (number) ou `null`.
- `formatDecimal(num, decimals)` — formata `6.5` em `"6,50"`.

O componente `NumericInput` em `apps/frontend/src/components/inputs/NumericInput.tsx` já implementa exatamente esse padrão. **Não vamos** trocar o `<CFormInput>` cru pelo `<NumericInput>` direto porque o `NumericInput` usa `<CInputGroup>` para o prefixo `R$`, o que mudaria o visual atual (R$ vira uma célula separada com borda). O `PriceRow` mantém o R$ como overlay absoluto + `/{unitSymbol}` como sufixo absoluto.

**Mudança no `PriceRow`** (mantendo a API pública `value: string | null | undefined; onChange: (string) => void`):

```tsx
import { useEffect, useState } from 'react';
import { formatDecimal, parseDecimal } from '../../utils/masks';

// Dentro de PriceRow, substituir o <CFormInput type="number" ...> por:
const [text, setText] = useState<string>(() => formatInitial(value));

useEffect(() => {
  const incoming = formatInitial(value);
  const parsedCurrent = parseDecimal(text, 2);
  const parsedIncoming = parseDecimal(incoming, 2);
  // só re-renderiza se o valor externo realmente diferir do que está no input
  if (parsedCurrent !== parsedIncoming) {
    setText(incoming);
  }
}, [value]);

function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
  const raw = e.target.value;
  if (!/^[\d.,]*$/.test(raw)) return; // só dígitos, vírgula e ponto
  setText(raw);
  // propaga string normalizada (ponto) pro form/zod consumirem como hoje
  const normalized = raw.replace(',', '.');
  onChange(normalized);
}

function handleBlur() {
  const parsed = parseDecimal(text, 2);
  if (parsed === null) {
    setText('');
    onChange('');
    return;
  }
  setText(formatDecimal(parsed, 2)); // exibe "6,50"
  onChange(String(parsed));            // propaga "6.5"
}

function formatInitial(v: number | string | null | undefined): string {
  if (v == null || v === '') return '';
  const n = typeof v === 'number' ? v : parseDecimal(String(v), 2);
  return n == null ? '' : formatDecimal(n, 2);
}

// ...

<CFormInput
  type="text"
  inputMode="decimal"
  placeholder="0,00"
  value={text}
  onChange={handleChange}
  onBlur={handleBlur}
  invalid={!!error}
  style={...} // preserva estilo atual (paddings + textAlign right + tnum)
/>
```

A schema zod (`buildProductSchema`) e o `onSubmit` do `ProductDialog` continuam recebendo string e fazendo `Number(v)` — sem mudança lá.

**Tests novos no `PriceRow.test.tsx`**:
- Digitar `'6,5'` no input → `onChange` é chamado com `'6.5'` (vírgula normalizada).
- Digitar `'8.5'` → `onChange` chamado com `'8.5'`.
- Digitar `'abc'` → `onChange` não é chamado (input bloqueia caracteres inválidos).
- Após blur com valor `8.5`, o input exibe `'8,50'` (formato BR).

(Os 4 testes existentes precisam ser ajustados: o input agora é `type="text"`, então `getByRole('spinbutton')` não funciona mais — usar `getByPlaceholderText('0,00')` ou similar.)

---

## 5. Testes

### 5.1 Backend (`apps/backend/src/modules/recycling/purchases/purchases.service.spec.ts`)

Adicionar (e adaptar mocks para incluir `PriceTableEntity` no `manager.getRepository` switch):

- `create rejeita priceTableId que não existe` → `BadRequestException`.
- `create rejeita priceTableId de tabela inativa` → `BadRequestException`.
- `create persiste priceTableId quando válido` → `purchaseRepo.create` recebido com a chave.
- `create continua trustando unitPrice do client` (não revalida contra product.prices) — mock onde `product.prices[t1] = 5` mas client envia `unitPrice = 10`, resultado fica 10.

### 5.2 Frontend

**`NewPurchasePage`** não tem testes hoje. **Não criar testes apenas para esta mudança** — adicionar uma suíte E2E nova ficaria fora do escopo. (Se a complexidade da página crescer no futuro, faz sentido refatorar pra testar o handler `handleTableChange` num hook isolado.)

**`ProductDialog.test.tsx`** ganha um teste:
- Submit com Tabela 1 = `8`, Tabela 2 e 3 vazias → payload `prices: { t1: 8, t2: 8, t3: 8 }`.

(Ajustar o teste existente "submit transforma string vazia em null nos preços" — esse teste vai falhar com a nova lógica. Substituir asserção: agora as strings vazias viram o valor da padrão, não `null`.)

**`PriceRow.test.tsx`** ganha 3 testes (e os 4 existentes precisam ajuste de seletor — `getByRole('spinbutton')` não funciona mais com `type="text"`; usar `getByPlaceholderText` ou ref direta):
- Digitar `'6,5'` → `onChange('6.5')`.
- Digitar `'abc'` → `onChange` não é chamado.
- Blur com `8.5` no estado interno → input exibe `'8,50'`.

---

## 6. Critérios de aceite (QA manual)

- [ ] Em Nova Compra, novo campo "Tabela de preço" no header com a Padrão pré-selecionada.
- [ ] Adicionar item → `unitPrice` é sugerido a partir de `product.prices[selectedTableId]`.
- [ ] Editar `unitPrice` manualmente → valor não é sobrescrito por mudanças subsequentes na tabela (a menos que o usuário confirme a troca).
- [ ] Trocar tabela com itens já adicionados → confirm dialog. Confirmar → preços sugeridos atualizam (incluindo overrides). Cancelar → tudo permanece.
- [ ] Trocar tabela com lista de itens vazia → não pede confirmação, troca direto.
- [ ] Salvar compra → backend persiste `price_table_id`. `GET /recycling/purchases/:id` retorna o campo.
- [ ] Tentar criar compra com `priceTableId` inválido (via API direta) → 400.
- [ ] Cadastrar produto preenchendo só Tabela 1 → após save, listagem mostra o mesmo valor em todas as 3 colunas (não mais `—`).
- [ ] Cadastrar produto preenchendo Tabela 1 e Tabela 2 (deixando Tabela 3 vazia) → Tabela 3 fica com o valor da Tabela 1.
- [ ] Editar produto existente que tem `null` em Tabela 2/3 → ao reabrir o modal, inputs aparecem vazios (mantido pra dar opção de continuar mantendo o legado). Mas ao salvar, inputs vazios passam a virar valor da Tabela 1.
- [ ] Migration `AddPriceTableIdToPurchases` roda contra tenant com compras existentes → todas ganham `price_table_id` apontando pra Padrão; coluna fica `NOT NULL`.
- [ ] No modal de produto, digitar `6,50` no preço da Tabela 1 → o input aceita; após blur, exibe `6,50`.
- [ ] Salvar produto com preço digitado como `6,50` → backend recebe `prices: { t1: 6.5, ... }` (number).
- [ ] Tentar digitar letra no preço → input ignora (não muda).

---

## 7. Quality Gate

Última task obrigatória do plano: **Quality Gate (Sonar)** seguindo [`_quality-gate-task-template.md`](_quality-gate-task-template.md).
