# Design — Redesign da página de Compras (Recicláveis)

**Data:** 2026-04-20
**Segmento:** Recicláveis
**Autor:** Vini Souza (via brainstorming)

---

## 1. Contexto

A página atual `/recycling/purchases` (`PurchasesPage.tsx`) já tem toolbar com busca, filtro de pagamento em pills e tabela básica (ID, Data, Fornecedor, Pagamento, Total). Falta a camada de KPIs e o detalhe expandido por linha.

O objetivo é replicar o modelo aprovado para Vendas (`docs/plans/2026-04-20-recycling-sales-redesign-design.md`), preservando o que Compras já tem de específico:

- KPIs no topo (Hoje / Semana / Mês) espelhando o estilo do dashboard
- Tabela enriquecida com resumo de materiais + documento do fornecedor acessível no detalhe
- Click numa linha abre modal detalhado com itens, fornecedor, operador, pagamento, total, observações
- **Preservar** o filtro de pagamento (pills) e o badge de pagamento na tabela — Compras afeta fluxo de caixa, info é útil à vista

Decisões de escopo já fechadas no brainstorming:
- Manter filtro de pagamento em pills (`Todas / Dinheiro / PIX / Cartão`)
- Manter coluna "Pagamento" na tabela com `PaymentBadge` já existente
- Usar endpoint separado `GET /recycling/reports/purchases-summary`, sem mexer em `getDashboardSummary`
- **Nova compra continua em página separada `/recycling/purchases/new`** (fora do escopo)

## 2. Meta

Entregar redesign da página de listagem + modal de detalhe, com:

- Novo endpoint de KPIs de compras
- Endpoint `list` enriquecido (supplier name, resumo de materiais)
- Endpoint `GET /recycling/purchases/:id` com dados completos
- Redesign completo de `PurchasesPage.tsx` + novo `PurchaseDetailModal`

## 3. Seções da página

### 3.1 Cabeçalho

Mantém o padrão atual:
- Título `Compras`
- Subtítulo `{total} compra(s) registrada(s)` (fallback quando zero)
- Botão primário `+ Nova compra` → `/recycling/purchases/new`

### 3.2 KPI grid (novo)

Grid de 3 colunas (`repeat(auto-fit, minmax(220px, 1fr))`). Reutiliza a primitiva `KpiCard` copiada inline do `SalesPage.tsx` (se um dia virar consumidor recorrente, extraímos para `components/`).

| Card | Fonte | Subtítulo |
|------|-------|-----------|
| **Hoje** | `SUM(p.total_amount) WHERE DATE(p.purchased_at) = CURRENT_DATE` | `{count} compra(s)` |
| **Semana** | `SUM(p.total_amount) WHERE p.purchased_at >= CURRENT_DATE - interval '7 days'` | `{count} compras` |
| **Mês** | `SUM(p.total_amount) WHERE p.purchased_at >= date_trunc('month', CURRENT_DATE) AND p.purchased_at < date_trunc('month', CURRENT_DATE) + interval '1 month'` | `{count} compras` |

Diferença vs sales: `purchases.total_amount` já é materializado, logo não há JOIN com `purchase_items` na query de summary. Ícone `cilArrowTop` mantido (neutro — sinaliza "atividade no período").

Estados: loading → valor "—"; erro → idem.

### 3.3 Tabela de compras

Toolbar:
- Input de busca client-side (filtra por ID, fornecedor, observações)
- Pills de filtro de pagamento preservadas (`Todas / Dinheiro / PIX / Cartão`) — filtragem client-side sobre a página atual

Colunas (6):

| Coluna | Conteúdo | Formato |
|--------|----------|---------|
| ID | `#{id.slice(0,8).toUpperCase()}` | mono 12px, weight 600 |
| Data | `DD/MM` + horário em linha inferior | tabular-nums |
| Fornecedor | `supplierName` | weight 500 |
| Material | single: `{firstProductName} · {totalKg}kg`; multi: `{itemCount} materiais · {totalKg}kg` | — |
| Pagamento | `<PaymentBadge method={paymentMethod} />` (componente já existente no arquivo) | — |
| Total | `formatCurrency(total)` | weight 700, tabular-nums, cor teal |

Linha inteira clicável (`cursor: pointer`) — click abre modal.

Ordenação default: `purchased_at DESC` (já é o atual comportamento do backend).

Footer: `Mostrando X–Y de Z` + `‹ page / N ›`, idêntico ao atual.

Empty state:
- Zero compras no sistema: ícone `cilBasket` em círculo teal + "Nenhuma compra ainda" + "Registre a primeira compra para começar."
- Busca/filtro sem resultados: "Nenhum resultado" + "Tente ajustar a busca ou o filtro."

### 3.4 Modal de detalhe (novo)

Componente `PurchaseDetailModal.tsx`. Trigger: click em qualquer linha da tabela.

**Header:**
- Título: `Compra #{id.slice(0,8).toUpperCase()}`
- Botão × (close)

**Corpo (três blocos):**

**a) Metadados** — grid `repeat(auto-fit, minmax(180px, 1fr))` com 5 campos (evita célula vazia assimétrica em 2 cols × 3 rows). Usa o mesmo helper `Field` do `SaleDetailModal`:
- **Fornecedor:** nome + documento formatado se existir. Como `suppliers.document` e `suppliers.document_type` existem na entity (ao contrário de `buyers.cnpj`), podemos formatar CPF/CNPJ corretamente com a mesma função `formatDocument(doc, type)` do sales modal.
- **Data/Hora:** `DD/MM/YYYY HH:MM` (via `toLocaleString('pt-BR')`)
- **Operador:** nome via JOIN em `public.users`
- **Pagamento:** `<PaymentBadge method={paymentMethod} />`
- **Total:** destaque teal, fonte 20, weight 700

**b) Itens** — `CTable small bordered`:

| Produto | Qtd | Preço/kg | Subtotal |
|---|---|---|---|

Linha de total ao fim, alinhada à direita, cor teal.

**c) Observações** — só aparece se `notes` presente. Card cinza suave com o texto, `whiteSpace: pre-wrap`.

**Footer:** apenas botão `Fechar` (secondary outline). Sem ações destrutivas nesta spec.

**Estados:**
- Loading: `CSpinner` centralizado no corpo
- Erro 404: "Compra não encontrada."
- Erro genérico: `CAlert` danger

## 4. Modelo de dados

Sem mudanças de schema. Campos derivados no backend:
- `total` = `p.total_amount` (já materializado — diferença chave vs sales)
- `itemCount` = `COUNT(purchase_items) WHERE purchase_id = X`
- `firstProductName` = qualquer `products.name` entre os itens (usado quando `itemCount === 1`)
- `totalKg` = `SUM(purchase_items.quantity)`
- `supplier.name`, `supplier.document`, `supplier.documentType`, `operator.name` = JOINs

## 5. Endpoints

### 5.1 Novo: `GET /recycling/reports/purchases-summary`

- **Guards:** `JwtAuthGuard` (aberto a autenticados, mesmo padrão de `sales-summary` e `dashboard`)
- **Response:**
  ```ts
  {
    today: { total: number; count: number };
    week:  { total: number; count: number };
    month: { total: number; count: number };
  }
  ```
- **Implementação:** `RecyclingReportsService.getPurchasesSummary(tenantId)` dentro de `withQueryRunner` (uma transação, idem `getSalesSummary`). Três queries:

```sql
-- today
SELECT COALESCE(SUM(total_amount), 0) AS total, COUNT(*) AS count
FROM "<schema>".purchases
WHERE DATE(purchased_at) = CURRENT_DATE;

-- week (últimos 7 dias inclusivo)
SELECT COALESCE(SUM(total_amount), 0) AS total, COUNT(*) AS count
FROM "<schema>".purchases
WHERE purchased_at >= CURRENT_DATE - interval '7 days';

-- month (mês corrente)
SELECT COALESCE(SUM(total_amount), 0) AS total, COUNT(*) AS count
FROM "<schema>".purchases
WHERE purchased_at >= date_trunc('month', CURRENT_DATE)
  AND purchased_at < date_trunc('month', CURRENT_DATE) + interval '1 month';
```

Nota: o `getDashboardSummary` existente continua intocado. Leve duplicação de informação (today/month) foi decisão consciente (Abordagem A).

### 5.2 Modificado: `GET /recycling/purchases?page&limit`

Retorna array de `PurchaseListItem`:

```ts
type PurchaseListItem = {
  id: string;
  purchasedAt: string;            // ISO
  supplierId: string;
  supplierName: string;
  paymentMethod: PaymentMethod;   // 'CASH' | 'PIX' | 'CARD'
  total: number;                  // === purchase.total_amount
  itemCount: number;
  firstProductName: string | null;
  totalKg: number;
  notes: string | null;
};
```

Envelope de paginação mantém o formato atual (`{ data, total, page, limit }`).

**Implementação (raw SQL, espelho estrutural da list de sales):**

```sql
SELECT
  p.id,
  p.purchased_at,
  p.supplier_id,
  p.payment_method,
  p.total_amount,
  p.notes,
  s.name AS supplier_name,
  agg.item_count,
  agg.total_kg,
  agg.first_product_name
FROM "<schema>".purchases p
LEFT JOIN "<schema>".suppliers s ON s.id = p.supplier_id
LEFT JOIN LATERAL (
  SELECT
    COUNT(*) AS item_count,
    COALESCE(SUM(pi.quantity), 0) AS total_kg,
    (
      SELECT pr.name
      FROM "<schema>".purchase_items pi2
      JOIN "<schema>".products pr ON pr.id = pi2.product_id
      WHERE pi2.purchase_id = p.id
      LIMIT 1
    ) AS first_product_name
  FROM "<schema>".purchase_items pi
  WHERE pi.purchase_id = p.id
) agg ON TRUE
ORDER BY p.purchased_at DESC
LIMIT $1 OFFSET $2;
```

`COUNT(*)` separado para `total` do envelope (mantém semântica atual).

**Breaking change:** o tipo `Purchase` atual (`apps/frontend/src/services/recycling/purchases.service.ts`) é substituído por `PurchaseListItem`. Durante implementação, fazer grep por `purchasesService.list`, `Purchase` e `usePurchases` para confirmar que só a listagem consome esse retorno. Se outros callers (dashboard, componentes de relatório) dependerem do shape antigo, ajustar em conjunto.

### 5.3 Novo: `GET /recycling/purchases/:id`

- **Guards:** `JwtAuthGuard + EmployeePermissionsGuard` (módulo já aplica), `@RequirePermission('canViewStock')` (espelho do `list`)
- **Response:**
  ```ts
  type PurchaseDetail = {
    id: string;
    purchasedAt: string;
    supplier: {
      id: string;
      name: string;
      document: string | null;
      documentType: 'CPF' | 'CNPJ' | null;
    };
    operator: { id: string; name: string };
    paymentMethod: PaymentMethod;
    notes: string | null;
    total: number;
    items: Array<{
      id: string;
      productId: string;
      productName: string;
      quantity: number;
      unitPrice: number;
      subtotal: number;
    }>;
  };
  ```
- **404** se não existir.

**Implementação:** raw SQL espelhando `SalesService.getById()` — uma query para `purchases + suppliers + users`, outra para `purchase_items + products`. Soma subtotals dos itens para `total` (redundante com `p.total_amount`, mas bate com o display das linhas do modal).

## 6. Arquivos

### Backend

**Modificar:**
- `apps/backend/src/modules/recycling/reports/reports.service.ts` — adicionar `getPurchasesSummary()`
- `apps/backend/src/modules/recycling/reports/reports.controller.ts` — adicionar `@Get('purchases-summary')`
- `apps/backend/src/modules/recycling/reports/reports.service.spec.ts` — cobrir novo método
- `apps/backend/src/modules/recycling/purchases/purchases.service.ts` — substituir `list()` por versão enriquecida; adicionar `getById()`
- `apps/backend/src/modules/recycling/purchases/purchases.controller.ts` — adicionar `@Get(':id')`
- `apps/backend/src/modules/recycling/purchases/purchases.service.spec.ts` — atualizar teste de `list` (novo shape); adicionar teste de `getById`

### Frontend

**Modificar:**
- `apps/frontend/src/services/recycling/reports.service.ts` — tipo `PurchasesSummary` + `getPurchasesSummary()`
- `apps/frontend/src/services/recycling/purchases.service.ts` — substituir `Purchase` por `PurchaseListItem`; adicionar `PurchaseDetail` + `getById()`
- `apps/frontend/src/hooks/recycling/useReports.ts` — hook `usePurchasesSummary()`
- `apps/frontend/src/hooks/recycling/usePurchases.ts` — retipar com `PurchaseListItem`
- `apps/frontend/src/pages/recycling/purchases/PurchasesPage.tsx` — redesign completo (KPIs + tabela enriquecida + integração com modal; filtro de pagamento preservado)

**Criar:**
- `apps/frontend/src/pages/recycling/purchases/PurchaseDetailModal.tsx`

## 7. Permissões e segurança

- `list` e `getById` de purchases: `canViewStock` (já é a permissão usada por `list`)
- `purchases-summary`: só `JwtAuthGuard`, mesmo padrão dos demais `/recycling/reports/*`
- Todos os endpoints continuam tenant-scoped via `withSchema`/`withQueryRunner`
- Modal não expõe dados sensíveis que empregados não devam ver; segue o mesmo critério do `SaleDetailModal`

## 8. Riscos e mitigação

| Risco | Mitigação |
|-------|-----------|
| Mudança do shape de `Purchase` → `PurchaseListItem` quebra consumers fora da página | Grep por `purchasesService.list`, `Purchase` e `usePurchases` antes do merge; ajustar callers em conjunto no mesmo PR |
| `payment_method` como string no badge se API retornar valor fora do enum | `PaymentBadge` já tem fallback (`config[method] ?? config.CARD`) |
| `LATERAL JOIN` pode ficar devagar com > 10k compras | Aceitável para MVP. Se virar gargalo, materializar `item_count`/`total_kg` em colunas via trigger, ou migrar para colunas computadas em `purchases` |
| Operador (`users`) vive em `public` schema | JOIN raw `JOIN public.users` — padrão já validado em `SalesService.getById` |
| Semana vs mês usam timezone do servidor | Aceito (mesma limitação dos outros reports; multi-timezone não é requisito) |
| `SupplierEntity.document` pode estar null para cadastros antigos | Modal trata graciosamente: `document` só renderiza se presente |

## 9. Rollout sugerido

1. Backend: `RecyclingReportsService.getPurchasesSummary` + endpoint + teste
2. Backend: `PurchasesService.list` enriquecido + teste atualizado
3. Backend: `PurchasesService.getById` + endpoint + teste
4. Frontend: `reports.service` (tipo + método) + hook `usePurchasesSummary`
5. Frontend: `purchases.service` (tipos + getById)
6. Frontend: `PurchaseDetailModal`
7. Frontend: redesign `PurchasesPage` integrando tudo

Entregável como um único PR (escopo coeso, igual ao redesign de Vendas).

## 10. Testes manuais de aceitação

- Criar 3 compras (1 hoje, 1 há 3 dias, 1 há 2 meses) → KPIs batem com os períodos corretos
- Compra com 1 item → tabela mostra `{produto} · {kg}kg`
- Compra com 3+ itens → tabela mostra `{count} materiais · {total_kg}kg`
- Click na linha abre modal com fornecedor + documento formatado (CPF e CNPJ), operador, itens, pagamento (badge), total e observações (quando houver)
- Fornecedor sem documento: modal exibe só o nome, sem quebra visual
- Busca client-side filtra por ID, fornecedor e observações
- Filtro de pagamento (pills) continua funcional sobre a página atual
- Paginação funcional
- Empty state aparece quando zero compras
- Empty state de busca/filtro aparece quando resultado vazio
