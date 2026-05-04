# Design — Múltiplas tabelas de preço por produto (Recicláveis)

**Data:** 2026-05-03
**Branch base:** `redesign/praktikus-v2`
**Escopo:** apenas o cadastro de Produtos do segmento Recicláveis. Vendas/Compras/Caixa e Configurações ficam fora desta entrega.

---

## Contexto e motivação

Hoje cada `Product` no segmento Recicláveis tem **um único** `pricePerUnit`. Operações reais precisam de **N preços** por produto, conforme o canal de venda (balcão, atacado, parceiros). O exemplo concreto vindo do usuário: alumínio com Tabela 1 = R$ 6, Tabela 2 = R$ 7, Tabela 3 = R$ 8.

Esta entrega introduz o conceito de **tabela de preço** como entidade de primeira classe e adapta o cadastro de produtos (lista, modal, impressão) para acomodar múltiplos preços, mantendo Vendas/Compras/Caixa funcionando sem mudança via uma denormalização.

A referência visual está em [`_design-reference/handoff-produtos-multi-tabela/`](../../../_design-reference/handoff-produtos-multi-tabela/) — protótipo JSX, screenshots e plano de implementação. **A referência usa `@praktikus/ui-kit`; o app real usa CoreUI.** O JSX serve como mapa de comportamento e estética; os primitivos serão substituídos por equivalentes CoreUI.

## Estado atual (recon)

- **Backend:** módulo em `apps/backend/src/modules/recycling/products/` com entity `Product`, DTOs e service. Único campo de preço: `pricePerUnit numeric(10,4)`. Multi-tenancy por schema (`tenant_<id>`). Sem qualquer noção de "tabela de preço".
- **Frontend:** página `apps/frontend/src/pages/recycling/products/ProductsPage.tsx` com modal `<CModal size="sm">` simples. Form via `react-hook-form` + `zod`. Sem store Zustand de produtos (estado local). Print é client-side via `react-pdf` no componente `apps/frontend/src/components/recycling/PriceListPdf.tsx`.
- **Consumidores de preço:** `Sale` e `Purchase` gravam `unitPrice` no item (snapshot ao adicionar). Não referenciam `Product.pricePerUnit` por FK. Isso permite migração gradual sem quebrar histórico.
- **Sem endpoint de impressão no backend** — tudo client-side hoje.

## Decisões alinhadas com o usuário

| # | Decisão | Escolha |
|---|---|---|
| 1 | Escopo desta entrega | **A**: apenas cadastro de produtos. Vendas/Compras/Caixa e Configurações em entregas futuras. |
| 2 | Tabelas seed | 3 fixas: `Tabela 1 — Padrão`, `Tabela 2`, `Tabela 3`. Apenas a primeira tem nome qualificado. |
| 3 | Estratégia de migração | **Gradual**: mantém `Product.pricePerUnit` como denormalização sincronizada com `productPrices[default]`. |
| 4 | Modelo de dados | Tabelas relacionais separadas (`price_tables` + `product_prices`), não JSONB. |
| 5 | Modal de impressão | Apenas `Cancelar · Baixar PDF` (sem `Imprimir`). Mantém geração via `react-pdf`. |

## Fora de escopo (explícito)

- CRUD de tabelas em Configurações.
- Seletor de tabela em Vendas/Compras/Caixa.
- Endpoint backend de impressão (`GET /produtos/imprimir`).
- Tabs "Oficina/Recicláveis" no sidebar.
- Mudança de UI-kit (continua CoreUI).

---

## 1. Modelo de dados

Tudo no schema do tenant (`tenant_<id>`).

### 1.1 Entidade `PriceTable`

```ts
// apps/backend/src/modules/recycling/price-tables/price-table.entity.ts
@Entity('price_tables')
export class PriceTable {
  @PrimaryGeneratedColumn('uuid') id: string
  @Column() name: string                              // "Tabela 1 — Padrão"
  @Column({ nullable: true }) description: string | null
  @Column({ name: 'sort_order' }) sortOrder: number   // 1, 2, 3
  @Column({ name: 'is_default' }) isDefault: boolean
  @Column({ default: true }) active: boolean
  @CreateDateColumn() createdAt: Date
  @UpdateDateColumn() updatedAt: Date
}
```

**Constraint:** índice único parcial garantindo no máximo uma linha com `is_default = true`:

```sql
CREATE UNIQUE INDEX price_tables_one_default_idx
  ON price_tables (is_default) WHERE is_default = true;
```

### 1.2 Entidade `ProductPrice`

```ts
// apps/backend/src/modules/recycling/products/product-price.entity.ts
@Entity('product_prices')
export class ProductPrice {
  @PrimaryColumn({ name: 'product_id' }) productId: string
  @PrimaryColumn({ name: 'price_table_id' }) priceTableId: string
  @Column({ type: 'numeric', precision: 10, scale: 4 }) price: string
  @ManyToOne(() => Product, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'product_id' }) product: Product
  @ManyToOne(() => PriceTable, { onDelete: 'RESTRICT' })
    @JoinColumn({ name: 'price_table_id' }) priceTable: PriceTable
}
```

PK composta `(product_id, price_table_id)`. **Ausência de linha** = produto não tem preço naquela tabela = `—` na lista, omitido no PDF.

### 1.3 Entidade `Product` — sem mudança estrutural

`pricePerUnit` permanece. Passa a ser tratada como **denormalização** = `productPrices[defaultTableId].price`. Sincronizada pelo `ProductsService` em todo create/update.

### 1.4 Migrations

Quatro migrations em `apps/backend/src/database/tenant-migrations/` + atualização de `create-tenant-tables.ts` para tenants novos:

1. **`CreatePriceTablesTable`** — cria `price_tables` + índice único parcial.
2. **`SeedPriceTables`** — insere 3 linhas (UUIDs gerados por `gen_random_uuid()`):
   - `(name='Tabela 1 — Padrão', sort_order=1, is_default=true, active=true)`
   - `(name='Tabela 2', sort_order=2, is_default=false, active=true)`
   - `(name='Tabela 3', sort_order=3, is_default=false, active=true)`
3. **`CreateProductPricesTable`** — cria `product_prices` com FKs e PK composta.
4. **`BackfillProductPrices`** — para cada produto existente com `price_per_unit IS NOT NULL`, insere `(product.id, default_table.id, product.price_per_unit)`. Produtos com `price_per_unit IS NULL` (cenário improvável pelo schema atual) são pulados — ficam sem preço em qualquer tabela e aparecerão como `—` na lista até serem editados.

Idempotentes (todas com `IF NOT EXISTS` / `ON CONFLICT DO NOTHING`). Validação manual: `SELECT count(*) FROM product_prices` deve igualar `SELECT count(*) FROM products WHERE price_per_unit IS NOT NULL` após backfill.

---

## 2. API

### 2.1 Novo módulo `price-tables/`

```
apps/backend/src/modules/recycling/price-tables/
├── price-tables.module.ts
├── price-tables.controller.ts
├── price-tables.service.ts
├── price-table.entity.ts
└── dto/
    └── price-table-response.dto.ts
```

**Endpoint:** `GET /recycling/price-tables`

- Retorna `PriceTable[]` filtrado por `active = true`, ordenado por `sortOrder`.
- Controller extrai `tenantId` de `req.user.tenantId` (pós-guard JWT) e passa explicitamente ao service.
- Service usa o helper `withSchema(tenantId, ...)` existente.

Resposta:
```json
[
  { "id": "uuid", "name": "Tabela 1 — Padrão", "description": null, "sortOrder": 1, "isDefault": true },
  { "id": "uuid", "name": "Tabela 2", "description": null, "sortOrder": 2, "isDefault": false },
  { "id": "uuid", "name": "Tabela 3", "description": null, "sortOrder": 3, "isDefault": false }
]
```

### 2.2 Mudanças em `products.service.ts` e `products.controller.ts`

**Listagem (`findAll`):**

- Faz `leftJoin('product_prices', 'pp')` agrupando por produto.
- Agrega `prices: Record<string, number | null>` mapeando `priceTableId → price` (number) ou `null` quando ausente.
- Resposta inclui ambos `pricePerUnit` (denorm) e `prices` (mapa completo, com `null` para tabelas sem entrada).

**`create` e `update`:**

- DTOs ganham campo `prices: Record<string, number | null>`.
- Lógica em transação:
  1. Carrega tabelas ativas do tenant.
  2. Valida que a chave da tabela padrão está presente com `price > 0`.
  3. Para cada par `(tableId, price)`:
     - `price` numérico válido → `INSERT ... ON CONFLICT (product_id, price_table_id) DO UPDATE SET price = excluded.price`
     - `price === null` → `DELETE FROM product_prices WHERE product_id = ? AND price_table_id = ?`
     - Chaves não enviadas → ignoradas (preservam estado anterior em update).
  4. Atualiza `Product.pricePerUnit` com `prices[defaultTableId]`.

### 2.3 DTOs

```ts
// CreateProductDto
@IsString() @IsNotEmpty() @MaxLength(120) name: string
@IsUUID() unitId: string
@IsBoolean() @IsOptional() active?: boolean = true
@IsObject() @ValidatePriceMap() prices: Record<string, number | null>
```

`@ValidatePriceMap()` é decorator customizado em `apps/backend/src/common/validators/price-map.validator.ts`:

- Todas as chaves devem ser UUIDs válidos.
- Valores devem ser `number` positivo (> 0) ou `null`.

A validação de regra de negócio (chave da tabela padrão presente, IDs correspondem a tabelas existentes ativas) acontece no service — porque depende do estado do tenant, não apenas do payload. Erros do service viram `BadRequestException` (422) com path `prices.<id>`.

`UpdateProductDto`: tudo opcional. Se `prices` vier, mesmas regras se aplicam ao subconjunto enviado.

### 2.4 Resposta de produto

```jsonc
{
  "id": "...",
  "name": "Alumínio latinha",
  "unitId": "...",
  "unit": { "id": "...", "symbol": "kg" },
  "pricePerUnit": "8.0000",
  "prices": {
    "<t1-uuid>": 8.0,
    "<t2-uuid>": 8.5,
    "<t3-uuid>": null
  },
  "active": true,
  "createdAt": "...",
  "updatedAt": "..."
}
```

### 2.5 Print

**Sem mudança no backend.** A geração do PDF continua client-side. O componente `PriceListPdf` (Seção 5) será refatorado para receber a tabela escolhida e a lista filtrada.

---

## 3. UI: Lista de produtos

Página: [`apps/frontend/src/pages/recycling/products/ProductsPage.tsx`](../../../apps/frontend/src/pages/recycling/products/ProductsPage.tsx).

### 3.1 Carregamento de dados

A página passa a buscar **dois recursos**:

- `products` (já existe).
- `priceTables` via novo hook `usePriceTables()` em `apps/frontend/src/hooks/recycling/use-price-tables.ts`. Cache simples por sessão (sem invalidação no escopo A — catálogo é fixo).

Loading skeleton até ambos os recursos estarem prontos.

### 3.2 Service e tipos

- Novo: `apps/frontend/src/services/recycling/price-tables.service.ts` com `list()`.
- Tipos compartilhados em [`packages/shared/src/types/recycling.ts`](../../../packages/shared/src/types/recycling.ts):

```ts
export type PriceTable = {
  id: string
  name: string
  description: string | null
  sortOrder: number
  isDefault: boolean
}

export type Product = {
  id: string
  name: string
  unitId: string
  unit: { id: string; symbol: string }
  pricePerUnit: string
  prices: Record<string, number | null>
  active: boolean
  createdAt: string
  updatedAt: string
}
```

### 3.3 Cabeçalho da página

- Título: `Produtos`
- Subtítulo dinâmico: `{N} produtos · {M} tabelas de preço`
- Ações:
  - `Imprimir tabela` (variant outline, ícone `cilPrint`) — abre `<PrintTableDialog>` (Seção 5).
  - `Novo produto` (variant primary, ícone `cilPlus`) — abre `<ProductDialog>` (Seção 4).

### 3.4 Tabela

`<CTable responsive>` com colunas:

| Produto | Unidade | _N colunas dinâmicas, uma por tabela em `sortOrder`_ | Status | Ações |
|---|---|---|---|---|

- Cabeçalho de coluna de tabela: nome em uppercase, peso 600, alinhado à direita.
- Célula de preço: `text-align: right`, `font-feature-settings: 'tnum'`. Valor formatado como `R$ 8,00` via util `formatBRL(v)`. Quando `null`, mostra `—` em `--cui-text-muted`.
- Coluna `Status`: badge verde (Ativo) / cinza (Inativo).
- Coluna `Ações`: ícones de editar e excluir, ghost.

### 3.5 Responsivo

- ≥ 768px: tabela completa.
- < 768px: scroll horizontal nativo do `<CTable responsive>`. Sem refactor de cards no escopo A (3 tabelas é manejável).

### 3.6 Util de formatação

`apps/frontend/src/utils/format.ts` (criar se não existir):

```ts
export const formatBRL = (v: number | null | undefined): string =>
  v == null ? '—' : `R$ ${v.toFixed(2).replace('.', ',')}`
```

---

## 4. UI: Modal Novo/Editar produto

Componente novo: `apps/frontend/src/components/recycling/ProductDialog.tsx`. Substitui o modal atual.

### 4.1 Tamanho e layout

- `<CModal size="xl">` com classe `pk-product-dialog`.
- Body em grid 2 colunas: `1fr 1.4fr; gap: 24px`.
- Em `< 720px` colapsa pra coluna única (`grid-template-columns: 1fr`).

### 4.2 Coluna esquerda — Informações do material

- Section label `INFORMAÇÕES DO MATERIAL` (uppercase, 12px, peso 600, cor muted, ícone `cilLayers`).
- `name` — `<CFormInput>` com label "Nome *" e placeholder "Ex.: Alumínio latinha".
- `unitId` — `<CFormSelect>` populado de `useUnits()` (hook existente).
- Bloco de status — cartão com fundo `--cui-tertiary-bg`, borda, padding 10×12. Contém `<CFormSwitch>` + dois rótulos:
  - Ativo: "Disponível para compra e venda."
  - Inativo: "Oculto nas operações de caixa."

### 4.3 Coluna direita — Preços por tabela

- Header da seção: label `PREÇOS POR TABELA` à esquerda + botão ghost `Replicar Tabela 1` à direita.
- Texto auxiliar (12px, muted): "Defina o preço deste material em cada tabela. A Tabela 1 (Padrão) é obrigatória; as demais são opcionais."
- Lista de `<PriceRow>` — uma linha por tabela ativa em ordem de `sortOrder`.
- Callout informativo no rodapé (fundo `--cui-primary-bg-subtle`, ícone `cilCheck`):
  > "As tabelas são gerenciadas em **Configurações → Tabelas de preço**. Tabelas em branco aparecerão como '—' na listagem."

### 4.4 Componente `<PriceRow>`

`apps/frontend/src/components/recycling/PriceRow.tsx`. Grid `28px / 1fr / 160px`, gap 12, padding 10×12, borda 1px.

| Slot | Conteúdo |
|---|---|
| 1. Badge | Quadrado 28×28, radius pequeno, contém o número da tabela. Vazio: bg `--cui-tertiary-bg`, texto muted. Preenchido: bg `--cui-primary`, texto branco. |
| 2. Identificação | Nome da tabela (peso 540, lh 1.2) com asterisco vermelho se `isDefault`. Abaixo, descrição em 12px muted. |
| 3. Input | `<CFormInput type="number">` com prefixo absoluto `R$` (esquerda, 10px) e sufixo `/{unit.symbol}` (direita, 10px). `step="0.01"`, `min="0"`, `inputMode="decimal"`, `text-align: right`, `font-feature-settings: 'tnum'`. |

Quando o input tem valor (`!= null && != ''`):
- Borda da linha: `--cui-primary` (em vez de `--cui-border-color`).
- Fundo da linha: `--cui-primary-bg-subtle`.
- Transição de 150ms em `border-color` e `background`.

### 4.5 Form, schema e validação

`react-hook-form` + `zod`. Schema dinâmico em `apps/frontend/src/schemas/recycling/product.schema.ts`:

```ts
// String vazia ou null viram null; string numérica é convertida pra número.
const priceCell = z.preprocess(
  (v) => (v === '' || v === null || v === undefined ? null : Number(v)),
  z.number().positive().nullable(),
)

const requiredPriceCell = z.preprocess(
  (v) => (v === '' || v === null || v === undefined ? NaN : Number(v)),
  z.number().positive('Preço obrigatório e maior que zero'),
)

export const buildProductSchema = (priceTables: PriceTable[]) => {
  const defaultTable = priceTables.find(t => t.isDefault)!
  return z.object({
    name: z.string().min(1, 'Nome obrigatório').max(120),
    unitId: z.string().uuid('Unidade inválida'),
    active: z.boolean(),
    prices: z.object(
      Object.fromEntries(priceTables.map(t => [
        t.id,
        t.id === defaultTable.id ? requiredPriceCell : priceCell,
      ]))
    ),
  })
}
```

A construção dinâmica é necessária porque os IDs das tabelas são UUIDs do banco — não constantes. O schema fica acoplado às tabelas carregadas, não a IDs hardcoded.

### 4.6 Botão "Replicar Tabela 1"

- Copia `prices[defaultTableId]` para todas as demais chaves via `setValue('prices.<id>', value)`.
- `disabled` quando o input da padrão está vazio.
- `aria-label`: "Replica o valor da Tabela 1 nas demais tabelas".

### 4.7 Footer

- `Cancelar` (variant ghost) — fecha sem salvar.
- `Salvar produto` / `Salvar alterações` (variant primary, ícone `cilCheck`) — `disabled` quando `!formState.isValid || isSubmitting`.

Ao submeter, o `transform()` do zod já normalizou strings vazias em `null`. Service envia tal qual ao backend.

### 4.8 Edição vs criação

- **Criação:** `prices` inicial = `Object.fromEntries(priceTables.map(t => [t.id, '']))`.
- **Edição:** `prices` inicial vem do produto. Para tabelas que não tinham entrada (vieram como `null`), o input fica vazio. Se uma tabela nova foi adicionada depois (escopo B futuro), entradas faltantes são `''`.

### 4.9 Tratamento de erro de servidor

Erro 422 do backend com `{ field: 'prices.<id>', message: '...' }` → `react-hook-form.setError('prices.<id>', { message })`. Erro genérico (500) → toast existente do app.

---

## 5. UI: Modal Imprimir tabela

Componente novo: `apps/frontend/src/components/recycling/PrintTableDialog.tsx`. Substitui o comportamento atual de "baixar PDF direto".

### 5.1 Tamanho e estrutura

- `<CModal size="lg">`.
- Título: "Imprimir tabela de preços".
- Subtítulo: "Escolha qual tabela será impressa e ajuste o que aparece no documento."
- Body em grid 2 colunas (`1fr 1fr`, gap 20). Colapsa pra coluna única em mobile.

Recebe `priceTables` e `products` por prop (a página já carregou ambos).

### 5.2 Coluna esquerda — Configurações

1. **Seletor de tabela** — radio cards verticais, um por tabela. Estrutura de cada card: input radio + nome + descrição. Card selecionado: borda `--cui-primary` + fundo `--cui-primary-bg-subtle`. Padrão: a tabela com `isDefault`.

2. **Toggle de layout** — par segmentado:
   - `Completo` — colunas Produto · Unidade · Preço por unidade.
   - `Compacto` — colunas Produto · Preço.

3. **Switch "Incluir produtos inativos"** — bloco com `<CFormSwitch>` + label + texto auxiliar "Por padrão, apenas ativos." Padrão: `false`.

### 5.3 Coluna direita — Pré-visualização

Painel branco simulando a página impressa, atualizado em tempo real:

- Cabeçalho: nome da empresa (de `useTenant().name`) + nome da tabela escolhida + data atual em `dd/MM/yyyy HH:mm`.
- Tabela com até **8 produtos** (ordenados por nome).
- Footer "+ N outros produtos" quando a lista efetiva tem mais que 8.
- Empty state quando nenhum produto tem preço naquela tabela: ícone neutro + texto "Nenhum produto com preço nesta tabela. Cadastre preços em Tabela X primeiro."

Abaixo do painel, contador: `{X} de {Y} produtos com preço definido nesta tabela.`

### 5.4 Footer

- `Cancelar` (variant ghost).
- `Baixar PDF` (variant primary, ícone `cilCloudDownload`) — `disabled` quando lista efetiva está vazia.

### 5.5 Geração do PDF

Refator de `apps/frontend/src/components/recycling/PriceListPdf.tsx` para receber:

```ts
type Props = {
  tenant: { name: string }
  table: PriceTable
  products: Product[]   // já filtrados por (active|inactive) e (price !== null em table)
  layout: 'full' | 'compact'
}
```

O componente passa a ser "burro": a filtragem (`includeInactive`, omitir produtos sem preço naquela tabela) acontece no `PrintTableDialog` antes da geração, não dentro do PDF.

Trigger de download:

```ts
// slugify simples inline — sem nova dependência
const slug = (s: string) => s.toLowerCase().normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/(^-|-$)/g, '')

const blob = await pdf(<PriceListPdf {...props} />).toBlob()
saveAs(blob, `tabela-precos-${slug(table.name)}-${dateStr}.pdf`)
```

Sem novo endpoint backend.

### 5.6 Estado interno

Hook custom `usePrintTableForm(priceTables, products)` em `apps/frontend/src/hooks/recycling/use-print-table-form.ts` retorna:

```ts
{
  tableId, setTableId,
  layout, setLayout,
  includeInactive, setIncludeInactive,
  selectedTable, filteredProducts, canDownload,
  download, // async
}
```

Mantém o componente de modal limpo, com lógica testável isolada.

---

## 6. Tipos compartilhados

[`packages/shared/src/types/recycling.ts`](../../../packages/shared/src/types/recycling.ts) ganha:

```ts
export type PriceTable = {
  id: string
  name: string
  description: string | null
  sortOrder: number
  isDefault: boolean
}

export type ProductPriceMap = Record<string, number | null>

// Atualizar o tipo Product existente para incluir prices: ProductPriceMap.
```

Per CLAUDE.md ("não duplique tipos entre backend e frontend"), os tipos `PriceTable` e `ProductPriceMap` vivem em `@praktikus/shared` e são importados por ambos os lados. As entidades TypeORM do backend (`PriceTable`, `ProductPrice`) implementam ou expõem o mesmo shape público.

O tipo `Product` do frontend (atualmente em `apps/frontend/src/services/recycling/products.service.ts` ou similar) ganha o campo `prices: ProductPriceMap`.

---

## 7. Testes

### 7.1 Backend

Em `apps/backend/test/integration/recycling/`:

- `price-tables.e2e-spec.ts`
  - GET retorna 3 tabelas seedadas, ordenadas por `sortOrder`.
  - GET de tenant sem tabelas (cenário improvável pós-seed) retorna `[]`.
- `products-multi-price.e2e-spec.ts`
  - POST com `prices` válido cria produto + entries em `product_prices`.
  - POST sem chave da tabela padrão → 422 com `path = 'prices'`.
  - POST com `price = 0` na padrão → 422.
  - POST com `null` em t2/t3 → não cria entries para essas tabelas.
  - PUT com `null` em uma tabela que tinha preço → deleta a entry.
  - PUT com `prices` ausente → preserva entries existentes, atualiza só os campos enviados.
  - Resposta de GET inclui `prices` com `null` para tabelas sem entry.
  - `pricePerUnit` denormalizado fica igual a `prices[default]` após cada save.

### 7.2 Frontend

- `apps/frontend/src/hooks/recycling/use-price-tables.test.ts` — fetch + cache de sessão.
- `apps/frontend/src/components/recycling/PriceRow.test.tsx` — render por estado (vazio/preenchido), asterisco quando `required`, callback de `onChange`.
- `apps/frontend/src/components/recycling/ProductDialog.test.tsx`
  - Validação: salvar `disabled` enquanto padrão vazio.
  - "Replicar Tabela 1" copia o valor para as demais.
  - "Replicar" `disabled` quando padrão vazio.
  - Submit: strings vazias viram `null` no payload.
- `apps/frontend/src/hooks/recycling/use-print-table-form.test.ts` — filtragem por `includeInactive`, omitir produtos sem preço, `canDownload` falso quando lista vazia.

---

## 8. Critérios de aceite (QA manual)

- [ ] Criar produto novo informando preços nas 3 tabelas → listagem mostra 3 colunas com os valores.
- [ ] Criar produto preenchendo só a Tabela 1 → listagem mostra `—` em Tabela 2 e 3.
- [ ] Editar produto, apagar valor da Tabela 2 → após salvar, célula vira `—` e DELETE foi feito em `product_prices`.
- [ ] Tentar salvar com Tabela 1 vazia → botão Salvar fica disabled.
- [ ] Botão "Replicar Tabela 1" copia o valor pra Tabelas 2 e 3.
- [ ] Modal de impressão com Tabela 2 selecionada e produto sem preço em t2 → produto não aparece no PDF.
- [ ] Modal de impressão alternando Completo/Compacto → preview reflete a mudança.
- [ ] Modal de impressão com "Incluir inativos" off → produtos inativos somem do preview.
- [ ] Vendas/Compras existentes continuam usando o preço da Tabela 1 (via `pricePerUnit`).
- [ ] Migration roda em tenant com produtos pré-existentes sem perder preço.
- [ ] Responsivo: modal de cadastro colapsa pra coluna única em < 720px.

---

## 9. Quality Gate

Como toda entrega: a última task do plano de implementação será a **task obrigatória de Quality Gate (Sonar)** seguindo [`_quality-gate-task-template.md`](_quality-gate-task-template.md).
