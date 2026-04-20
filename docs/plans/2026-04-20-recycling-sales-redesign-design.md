# Design — Redesign da página de Vendas (Recicláveis)

**Data:** 2026-04-20
**Segmento:** Recicláveis
**Autor:** Vini Souza (via brainstorming)

---

## 1. Contexto

A página atual `/recycling/sales` (`SalesPage.tsx`) lista vendas com uma tabela básica: ID, Data, Comprador, Observações. Não há KPIs de período, não há total por venda visível, não há detalhe expandido com itens.

O mockup aprovado pede uma experiência mais rica:
- KPIs no topo (Hoje / Semana / Mês) espelhando o estilo do dashboard
- Tabela enriquecida mostrando comprador, material/volume, total
- Click numa linha abre modal detalhado com itens, comprador, operador, total, observações

Decisões de escopo já fechadas no brainstorming:
- **Sem status "Paga / Pendente"** (fica para spec futura)
- **Sem card "Margem Média"**
- **Sem botão "Filtrar"**
- **Nova venda continua em página separada `/recycling/sales/new`** (fora do escopo)

## 2. Meta

Entregar redesign da página de listagem + modal de detalhe, com:

- Novo endpoint de KPIs de vendas
- Endpoint `list` enriquecido (total, buyer name, resumo de materiais)
- Endpoint `GET /recycling/sales/:id` com dados completos da venda
- Redesign completo de `SalesPage.tsx` + novo componente `SaleDetailModal`

## 3. Seções da página

### 3.1 Cabeçalho

Mantém o padrão atual:
- Título `Vendas`
- Subtítulo `{total} vendas registradas` (ou placeholder se zero)
- Botão primário `+ Nova venda` → navega para `/recycling/sales/new`

### 3.2 KPI grid (novo)

Grid de 3 colunas (`repeat(auto-fit, minmax(220px, 1fr))`). Cada card reutiliza a primitiva `KpiCard` do dashboard ou replica o estilo inline.

| Card | Fonte | Subtítulo |
|------|-------|-----------|
| **Hoje** | `SUM(sale_items.subtotal) WHERE DATE(sold_at) = CURRENT_DATE` | `{count} venda(s)` |
| **Semana** | `SUM(sale_items.subtotal) WHERE sold_at >= CURRENT_DATE - interval '7 days'` | `{count} vendas` |
| **Mês** | `SUM(sale_items.subtotal) WHERE sold_at >= date_trunc('month', CURRENT_DATE)` | `{count} vendas` |

Estados: loading → skeleton simples; erro → mostra "—".

### 3.3 Tabela de vendas

Toolbar igual ao atual:
- Input de busca client-side (filtra por ID, nome do comprador, observação)
- Sem botão "Filtrar" (confirmado)
- Sem tabs de status (confirmado)

Colunas:

| Coluna | Conteúdo | Formato |
|--------|----------|---------|
| ID | `#{id.slice(0,8).toUpperCase()}` | mono 12px, weight 600 |
| Data | `DD/MM` + horário em linha inferior | tabular-nums |
| Comprador | `buyerName` | weight 500 |
| Material | single: `{firstProductName} · {totalKg}kg`; multi: `{itemCount} materiais · {totalKg}kg` | — |
| Total | `formatCurrency(total)` | weight 700, tabular-nums, cor teal |
| Ações | ícone 👁 (`cilEyeOpen`) | clicável mas redundante com click na linha |

Linha inteira é clicável (`cursor: pointer`) — click abre modal com detalhe.

Ordenação default: `sold_at DESC` (já é o atual comportamento do backend).

Footer da tabela mantém paginação atual: `Mostrando X–Y de Z` + `‹ 1 / N ›`.

Empty state:
- Zero vendas no sistema: ícone `cilCart` em círculo teal + "Nenhuma venda ainda" + "Registre a primeira venda"
- Busca sem resultados: "Nenhum resultado" + "Tente ajustar a busca"

### 3.4 Modal de detalhe (novo)

Componente `SaleDetailModal.tsx`. Trigger: click em qualquer linha da tabela.

**Header:**
- Título: `Venda #{id.slice(0,8).toUpperCase()}`
- Botão × (close)

**Corpo (três blocos):**

**a) Metadados** — grid 2 colunas:
- **Comprador:** nome + documento formatado se existir (`CPF 000.000.000-00` ou `CNPJ 00.000.000/0000-00`)
- **Data/Hora:** `18/04/2026 10:42`
- **Operador:** nome do usuário que registrou
- **Total:** destaque, fonte maior, weight 700, cor teal

**b) Itens** — `CTable` simples:

| Produto | Qtd | Preço/kg | Subtotal |
|---|---|---|---|

Linha de total na base da tabela alinhada à direita.

**c) Observações** — só aparece se `notes` presente. Card cinza suave com o texto.

**Footer:** apenas botão `Fechar` (secondary outline). Sem ações destrutivas nesta spec.

**Estados:**
- Loading: `CSpinner` centralizado no corpo
- Erro 404: "Venda não encontrada"
- Erro genérico: `CAlert` danger

## 4. Modelo de dados

Sem mudanças de schema. Campos derivados no backend:
- `total` = `SUM(sale_items.subtotal)` por venda
- `itemCount` = `COUNT(sale_items) WHERE sale_id = X`
- `firstProductName` = qualquer `products.name` entre os itens (usado só quando `itemCount === 1`)
- `totalKg` = `SUM(sale_items.quantity)`
- `buyer.name`, `operator.name` = JOINs

## 5. Endpoints

### 5.1 Novo: `GET /recycling/reports/sales-summary`

- **Guards:** `JwtAuthGuard` (aberto a autenticados, segue padrão de `/reports/dashboard`)
- **Response:**
  ```ts
  {
    today:  { total: number; count: number };
    week:   { total: number; count: number };
    month:  { total: number; count: number };
  }
  ```
- **Implementação:** `RecyclingReportsService.getSalesSummary(tenantId)` — três queries agregadas no schema do tenant. Cada uma faz `SELECT COALESCE(SUM(si.subtotal), 0), COUNT(DISTINCT s.id) FROM sales s JOIN sale_items si ON si.sale_id = s.id WHERE <janela>`.

**Janelas de data:**
- `today`: `DATE(s.sold_at) = CURRENT_DATE`
- `week`: `s.sold_at >= CURRENT_DATE - interval '7 days'` (últimos 7 dias inclusivo)
- `month`: `s.sold_at >= date_trunc('month', CURRENT_DATE) AND s.sold_at < date_trunc('month', CURRENT_DATE) + interval '1 month'`

### 5.2 Modificado: `GET /recycling/sales?page&limit`

Retorna array de `SaleListItem`:

```ts
type SaleListItem = {
  id: string;
  soldAt: string;          // ISO
  buyerId: string;
  buyerName: string;
  total: number;
  itemCount: number;
  firstProductName: string | null;
  totalKg: number;
  notes: string | null;
};
```

Envelope de paginação mantém o formato atual (`{ data, total, page, limit }`).

**Implementação:** usa QueryBuilder com JOIN + subqueries ou `LEFT JOIN LATERAL` para agregar itens por venda sem N+1. Exemplo:

```sql
SELECT
  s.id, s.sold_at, s.buyer_id, s.notes,
  b.name AS buyer_name,
  agg.total, agg.item_count, agg.total_kg, agg.first_product_name
FROM sales s
LEFT JOIN buyers b ON b.id = s.buyer_id
LEFT JOIN LATERAL (
  SELECT
    COALESCE(SUM(si.subtotal), 0) as total,
    COUNT(*) as item_count,
    COALESCE(SUM(si.quantity), 0) as total_kg,
    (SELECT p.name FROM sale_items si2 JOIN products p ON p.id = si2.product_id WHERE si2.sale_id = s.id LIMIT 1) as first_product_name
  FROM sale_items si
  WHERE si.sale_id = s.id
) agg ON TRUE
ORDER BY s.sold_at DESC
LIMIT $1 OFFSET $2
```

### 5.3 Novo: `GET /recycling/sales/:id`

- **Guards:** mesmos do controller atual (JWT + RolesGuard herdado do módulo; `list` atual não exige OWNER, confirmar que `getById` segue o mesmo padrão aberto)
- **Response:**
  ```ts
  type SaleDetail = {
    id: string;
    soldAt: string;
    buyer: {
      id: string;
      name: string;
      document: string | null;
      documentType: 'CPF' | 'CNPJ' | null;
    };
    operator: { id: string; name: string };
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

**Implementação:** no service:
1. Fetch `SaleEntity` por id — se null → 404
2. Fetch `sale_items` JOIN `products` por `sale_id`
3. Fetch `buyer` via `BuyerEntity` (mesmo tenant schema)
4. Fetch `operator` via `public.users` JOIN — nome do user com aquele id
5. Somar subtotals e montar payload

## 6. Arquivos

### Backend

**Modificar:**
- `apps/backend/src/modules/recycling/reports/reports.service.ts` — adicionar `getSalesSummary()`
- `apps/backend/src/modules/recycling/reports/reports.controller.ts` — adicionar `@Get('sales-summary')`
- `apps/backend/src/modules/recycling/reports/reports.service.spec.ts` — testes novos
- `apps/backend/src/modules/recycling/sales/sales.service.ts` — enriquecer `list()`, adicionar `getById()`
- `apps/backend/src/modules/recycling/sales/sales.controller.ts` — adicionar `@Get(':id')`
- `apps/backend/src/modules/recycling/sales/sales.service.spec.ts` — testes dos 2 métodos

### Frontend

**Modificar:**
- `apps/frontend/src/services/recycling/reports.service.ts` — tipo `SalesSummary` + `getSalesSummary()`
- `apps/frontend/src/services/recycling/sales.service.ts` — tipo `SaleListItem` + `SaleDetail` + `getById()`; atualizar shape do `list()`
- `apps/frontend/src/hooks/recycling/useReports.ts` — hook `useSalesSummary()`
- `apps/frontend/src/hooks/recycling/useSales.ts` — retorno tipado com novo shape
- `apps/frontend/src/pages/recycling/sales/SalesPage.tsx` — redesign completo (KPIs + tabela enriquecida + integração com modal)

**Criar:**
- `apps/frontend/src/pages/recycling/sales/SaleDetailModal.tsx`

## 7. Permissões e segurança

- Todos os endpoints de vendas permanecem com os guards atuais (JwtAuthGuard + tenant scoping). Reports é aberto a autenticados (mesmo padrão dos outros `/recycling/reports/*` após o fix recente). O modal e a listagem não expõem dados que empregados não deveriam ver.

## 8. Riscos e mitigação

| Risco | Mitigação |
|-------|-----------|
| `LATERAL JOIN` pode ser devagar com muitas vendas | Aceitável para <10k vendas (escala do MVP). Se virar gargalo, materializa total/itemCount em colunas computadas da tabela `sales` via trigger ou migration |
| Operador (`users`) vive em `public` schema | Usar JOIN raw `JOIN public.users` nas queries raw (padrão já usado em outros services do projeto) |
| Semana vs mês usam timezone do servidor | Aceitamos como está (mesma limitação dos outros reports; tenant multi-fuso não é requisito) |
| Frontend precisa do `operator.name` mas a API de `list` não traz — só o modal traz via `getById` | Intencional: operator só aparece no detalhe, não na tabela principal. Reduz payload da listagem |

## 9. Rollout sugerido

1. Backend: `RecyclingReportsService.getSalesSummary` + endpoint + teste
2. Backend: `SalesService.list` enriquecido + teste
3. Backend: `SalesService.getById` + endpoint + teste
4. Frontend: serviço + hook `useSalesSummary`
5. Frontend: serviço `sales` (tipos + getById)
6. Frontend: `SaleDetailModal`
7. Frontend: redesign `SalesPage` integrando tudo

Entregável como um único PR (o escopo é coeso; não faz sentido subdividir).

## 10. Testes manuais de aceitação

- Criar 3 vendas (1 hoje, 1 há 3 dias, 1 há 2 meses) e verificar KPIs batem com os períodos corretos
- Criar venda com 1 item → tabela mostra `{produto} · {kg}kg`
- Criar venda com 3+ itens → tabela mostra `{count} materiais · {total_kg}kg`
- Click na linha abre modal com dados corretos (itens, comprador, operador, total)
- Observações só aparecem no modal se existirem
- Busca client-side filtra por ID, comprador e observações
- Paginação funciona
- Empty state aparece quando zero vendas
