# Entrega 8: Relatórios (somente OWNER) — Design Document
**Date:** 2026-03-24
**Status:** Approved

---

## 1. Objetivo

Implementar página de relatórios gerenciais exclusiva para o OWNER: KPIs de faturamento, gráfico de barras de faturamento por mês, gráfico de pizza de OS por status, e ranking dos top 10 serviços mais executados. Filtro por mês rápido ou intervalo customizado de datas.

---

## 2. Modelo de Dados

Nenhuma tabela nova. Todos os dados são agregados via SQL a partir das tabelas existentes: `service_orders`, `so_items_services`, `so_items_parts`.

**Critério de inclusão:** apenas OS com `status != 'ORCAMENTO'` (orçamentos não aprovados são excluídos do faturamento).

---

## 3. Backend API

### `GET /api/workshop/reports`

- `@Roles(UserRole.OWNER)` — acesso exclusivo para OWNER
- `JwtAuthGuard` + `RolesGuard` (classe)
- `tenantId` via `req.user.tenantId`
- Query params obrigatórios: `date_start` (ISO date) + `date_end` (ISO date)
- Usa padrão `withSchema<T>` + raw SQL com GROUP BY

**Response shape:**

```ts
{
  periodo: { dateStart: string; dateEnd: string }

  // KPIs
  faturamentoTotal: number       // soma de todas as OS no período
  faturamentoServicos: number    // soma de so_items_services.valor
  faturamentoPecas: number       // soma de so_items_parts.quantidade * valor_unitario
  totalOs: number                // contagem de OS no período
  osPagas: number                // contagem com status_pagamento = 'PAGO'

  // Gráfico de pizza
  osPorStatus: Array<{ status: string; count: number }>

  // Gráfico de barras (agrupado por mês)
  faturamentoPorMes: Array<{
    mes: string    // formato "YYYY-MM"
    servicos: number
    pecas: number
    total: number
  }>

  // Ranking de serviços
  topServicos: Array<{
    nomeServico: string
    quantidade: number    // vezes executado
    receita: number       // soma de valor
  }>  // top 10, ORDER BY quantidade DESC
}
```

**Implementação:** `ReportsService.getReport(tenantId, dateStart, dateEnd)` em `apps/backend/src/modules/workshop/reports/`. Módulo novo `ReportsModule`, registrado em `AppModule`. Usa múltiplas queries SQL com parâmetros (`$1`, `$2`) para evitar injeção.

---

## 4. Frontend

### Biblioteca

```
apps/frontend: recharts
```

### Página `ReportsPage`

**Rota:** `/workshop/reports` (dentro do `PrivateRoute`)

**Acesso:** somente OWNER — verificado via `useAuthStore` + `Roles`. Se EMPLOYEE acessar, redireciona para `/workshop/dashboard`.

**Sidebar:** entrada "Relatórios" adicionada ao `AppLayout` com ícone `BarChartIcon`, visível somente para OWNER.

**Filtro de período:**
- 6 chips de mês rápido (mês atual + 5 anteriores), formato "Mar 2026"
- Campos `De:` / `Até:` (`type="date"`) para intervalo customizado
- Ao clicar no chip, preenche automaticamente as datas e dispara a busca
- Botão "Buscar" explícito para o modo customizado

**KPIs (5 cards MUI):**
- Faturamento Total
- Faturamento em Serviços
- Faturamento em Peças
- Total de OS
- OS Pagas

**Gráficos (lado a lado):**
- `BarChart` (Recharts): faturamento por mês, série "Serviços" + série "Peças", eixo X = mês, eixo Y = valor em R$
- `PieChart` (Recharts): OS por status com legenda

**Tabela Top 10 Serviços:** colunas `#`, `Serviço`, `Qtd`, `Receita`

**Estado vazio:** se `totalOs === 0`, exibe mensagem "Nenhuma OS encontrada para o período selecionado."

### Serviço frontend

`apps/frontend/src/services/reports.service.ts`

```ts
reportsApi.get(dateStart: string, dateEnd: string): Promise<ReportData>
// GET /workshop/reports?date_start=...&date_end=...
```

---

## 5. Fora do Escopo (v2)

- Exportar relatório como PDF ou CSV
- Relatório por mecânico
- Comparativo entre períodos
- Gráfico de tendência (linha)
- Notificações de meta atingida
