# Recycling Sales Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the Vendas page to show period KPIs at the top, an enriched table (buyer, material summary, total) with row-click detail modal, and a backend that supports both.

**Architecture:** Backend gets a new sales summary report endpoint plus enriched `list()` and new `getById()` on `SalesService`. Frontend repositions the page with KPI cards, a richer table, and a new `SaleDetailModal` component.

**Tech Stack:** NestJS + TypeORM (backend), React 19 + CoreUI (frontend), PostgreSQL schema-per-tenant, pnpm monorepo.

**Spec:** [docs/plans/2026-04-20-recycling-sales-redesign-design.md](2026-04-20-recycling-sales-redesign-design.md)

---

## File Structure

### Backend

**Modify:**
- `apps/backend/src/modules/recycling/reports/reports.service.ts` — add `getSalesSummary`
- `apps/backend/src/modules/recycling/reports/reports.controller.ts` — add `@Get('sales-summary')`
- `apps/backend/src/modules/recycling/reports/reports.service.spec.ts` — new tests
- `apps/backend/src/modules/recycling/sales/sales.service.ts` — enrich `list()`, add `getById()`
- `apps/backend/src/modules/recycling/sales/sales.controller.ts` — add `@Get(':id')`
- `apps/backend/src/modules/recycling/sales/sales.service.spec.ts` — new tests

### Frontend

**Modify:**
- `apps/frontend/src/services/recycling/sales.service.ts` — types + `getById`, update list response type
- `apps/frontend/src/services/recycling/reports.service.ts` — `SalesSummary` type + `getSalesSummary`
- `apps/frontend/src/hooks/recycling/useReports.ts` — `useSalesSummary` hook
- `apps/frontend/src/hooks/recycling/useSales.ts` — update type to `SaleListItem[]`
- `apps/frontend/src/pages/recycling/sales/SalesPage.tsx` — full redesign

**Create:**
- `apps/frontend/src/pages/recycling/sales/SaleDetailModal.tsx`

---

## Task 1: Backend — getSalesSummary service + tests

**Files:**
- Modify: `apps/backend/src/modules/recycling/reports/reports.service.ts`
- Modify: `apps/backend/src/modules/recycling/reports/reports.service.spec.ts`

- [ ] **Step 1: Write failing tests**

Append inside the outer `describe('RecyclingReportsService')` in `apps/backend/src/modules/recycling/reports/reports.service.spec.ts`:

```typescript
  describe('getSalesSummary', () => {
    it('should throw on invalid tenantId', async () => {
      await expect(service.getSalesSummary('bad-id')).rejects.toThrow('Invalid tenantId');
    });

    it('should return totals for today, week and month', async () => {
      mockQueryRunner.query.mockImplementation(async (sql: string) => {
        if (sql.includes('SET LOCAL')) return undefined;
        if (sql.includes('DATE(s.sold_at) = CURRENT_DATE')) {
          return [{ total: '680.00', count: '1' }];
        }
        if (sql.includes("CURRENT_DATE - interval '7 days'")) {
          return [{ total: '1690.00', count: '4' }];
        }
        if (sql.includes("date_trunc('month'")) {
          return [{ total: '22540.00', count: '52' }];
        }
        return [];
      });

      const result = await service.getSalesSummary(TENANT);
      expect(result.today).toEqual({ total: 680, count: 1 });
      expect(result.week).toEqual({ total: 1690, count: 4 });
      expect(result.month).toEqual({ total: 22540, count: 52 });
    });

    it('should return zeros when no sales', async () => {
      mockQueryRunner.query.mockImplementation(async (sql: string) => {
        if (sql.includes('SET LOCAL')) return undefined;
        return [{ total: '0.00', count: '0' }];
      });

      const result = await service.getSalesSummary(TENANT);
      expect(result.today).toEqual({ total: 0, count: 0 });
      expect(result.week).toEqual({ total: 0, count: 0 });
      expect(result.month).toEqual({ total: 0, count: 0 });
    });
  });
```

- [ ] **Step 2: Run tests to confirm failure**

Run: `pnpm --filter backend test -- reports.service.spec.ts`
Expected: `getSalesSummary` tests fail (method doesn't exist).

- [ ] **Step 3: Implement the method**

Modify `apps/backend/src/modules/recycling/reports/reports.service.ts` — add this method at the end of the class, before the closing brace:

```typescript
  async getSalesSummary(tenantId: string): Promise<{
    today: { total: number; count: number };
    week: { total: number; count: number };
    month: { total: number; count: number };
  }> {
    const schemaName = this.getSchemaName(tenantId);
    return this.withQueryRunner(tenantId, async (qr) => {
      const [today] = await qr.query(`
        SELECT
          COALESCE(SUM(si.subtotal), 0) as total,
          COUNT(DISTINCT s.id) as count
        FROM "${schemaName}".sales s
        JOIN "${schemaName}".sale_items si ON si.sale_id = s.id
        WHERE DATE(s.sold_at) = CURRENT_DATE
      `);

      const [week] = await qr.query(`
        SELECT
          COALESCE(SUM(si.subtotal), 0) as total,
          COUNT(DISTINCT s.id) as count
        FROM "${schemaName}".sales s
        JOIN "${schemaName}".sale_items si ON si.sale_id = s.id
        WHERE s.sold_at >= CURRENT_DATE - interval '7 days'
      `);

      const [month] = await qr.query(`
        SELECT
          COALESCE(SUM(si.subtotal), 0) as total,
          COUNT(DISTINCT s.id) as count
        FROM "${schemaName}".sales s
        JOIN "${schemaName}".sale_items si ON si.sale_id = s.id
        WHERE s.sold_at >= date_trunc('month', CURRENT_DATE)
          AND s.sold_at < date_trunc('month', CURRENT_DATE) + interval '1 month'
      `);

      return {
        today: { total: Number(today.total), count: Number(today.count) },
        week: { total: Number(week.total), count: Number(week.count) },
        month: { total: Number(month.total), count: Number(month.count) },
      };
    });
  }
```

- [ ] **Step 4: Run tests to confirm pass**

Run: `pnpm --filter backend test -- reports.service.spec.ts`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/recycling/reports/reports.service.ts apps/backend/src/modules/recycling/reports/reports.service.spec.ts
git commit --no-gpg-sign -m "feat(recycling/reports): add getSalesSummary service"
```

---

## Task 2: Backend — sales-summary controller route

**Files:**
- Modify: `apps/backend/src/modules/recycling/reports/reports.controller.ts`

- [ ] **Step 1: Add route**

Modify `apps/backend/src/modules/recycling/reports/reports.controller.ts` — add this handler inside the class (after `getTopMaterials`):

```typescript
  @Get('sales-summary')
  getSalesSummary(@Request() req: RequestWithUser) {
    return this.reportsService.getSalesSummary(req.user.tenantId);
  }
```

- [ ] **Step 2: Verify build**

Run: `pnpm --filter backend build`
Expected: Compiles without errors.

- [ ] **Step 3: Commit**

```bash
git add apps/backend/src/modules/recycling/reports/reports.controller.ts
git commit --no-gpg-sign -m "feat(recycling/reports): add sales-summary endpoint"
```

---

## Task 3: Backend — enrich SalesService.list() + tests

**Files:**
- Modify: `apps/backend/src/modules/recycling/sales/sales.service.ts`
- Modify: `apps/backend/src/modules/recycling/sales/sales.service.spec.ts`

- [ ] **Step 1: Write failing test for the enriched list**

Append inside `describe('SalesService')` in `apps/backend/src/modules/recycling/sales/sales.service.spec.ts`:

```typescript
  describe('list', () => {
    it('should return enriched sales with buyer name, total and material summary', async () => {
      mockQueryRunner.query.mockImplementation(async (sql: string) => {
        if (sql.includes('SET LOCAL')) return undefined;
        if (sql.includes('FROM "tenant_')) {
          return [
            {
              id: 'sale1',
              sold_at: new Date('2026-04-18T10:42:00Z'),
              buyer_id: 'buyer1',
              notes: null,
              buyer_name: 'MGLU Recicla',
              total: '680.00',
              item_count: '1',
              total_kg: '80.0000',
              first_product_name: 'Alumínio',
            },
          ];
        }
        if (sql.includes('COUNT(*)')) return [{ count: '1' }];
        return [];
      });

      const result = await service.list(TENANT, 1, 20);
      expect(result.total).toBe(1);
      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toMatchObject({
        id: 'sale1',
        buyerId: 'buyer1',
        buyerName: 'MGLU Recicla',
        total: 680,
        itemCount: 1,
        totalKg: 80,
        firstProductName: 'Alumínio',
        notes: null,
      });
    });

    it('should throw on invalid tenantId', async () => {
      await expect(service.list('bad-id', 1, 20)).rejects.toThrow('Invalid tenantId');
    });
  });
```

- [ ] **Step 2: Run tests to confirm failure**

Run: `pnpm --filter backend test -- sales.service.spec.ts`
Expected: New `list` tests fail.

- [ ] **Step 3: Replace the `list` method**

In `apps/backend/src/modules/recycling/sales/sales.service.ts`, replace the existing `list` method entirely with:

```typescript
  async list(
    tenantId: string,
    page: number,
    limit: number,
  ): Promise<{
    data: Array<{
      id: string;
      soldAt: string;
      buyerId: string;
      buyerName: string;
      total: number;
      itemCount: number;
      firstProductName: string | null;
      totalKg: number;
      notes: string | null;
    }>;
    total: number;
    page: number;
    limit: number;
  }> {
    const schemaName = this.getSchemaName(tenantId);
    const offset = (page - 1) * limit;
    return this.withSchema(tenantId, async (_manager, qr) => {
      const rows = await qr.query(
        `
        SELECT
          s.id,
          s.sold_at,
          s.buyer_id,
          s.notes,
          b.name as buyer_name,
          COALESCE(agg.total, 0) as total,
          COALESCE(agg.item_count, 0) as item_count,
          COALESCE(agg.total_kg, 0) as total_kg,
          agg.first_product_name
        FROM "${schemaName}".sales s
        LEFT JOIN "${schemaName}".buyers b ON b.id = s.buyer_id
        LEFT JOIN LATERAL (
          SELECT
            COALESCE(SUM(si.subtotal), 0) as total,
            COUNT(*) as item_count,
            COALESCE(SUM(si.quantity), 0) as total_kg,
            (
              SELECT p.name
              FROM "${schemaName}".sale_items si2
              JOIN "${schemaName}".products p ON p.id = si2.product_id
              WHERE si2.sale_id = s.id
              LIMIT 1
            ) as first_product_name
          FROM "${schemaName}".sale_items si
          WHERE si.sale_id = s.id
        ) agg ON TRUE
        ORDER BY s.sold_at DESC
        LIMIT $1 OFFSET $2
        `,
        [limit, offset],
      );

      const [{ count }] = await qr.query(
        `SELECT COUNT(*) as count FROM "${schemaName}".sales`,
      );

      return {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: rows.map((r: any) => ({
          id: r.id,
          soldAt: new Date(r.sold_at).toISOString(),
          buyerId: r.buyer_id,
          buyerName: r.buyer_name ?? '',
          total: Number(r.total),
          itemCount: Number(r.item_count),
          firstProductName: r.first_product_name ?? null,
          totalKg: Number(r.total_kg),
          notes: r.notes,
        })),
        total: Number(count),
        page,
        limit,
      };
    });
  }
```

- [ ] **Step 4: Run tests to confirm pass**

Run: `pnpm --filter backend test -- sales.service.spec.ts`
Expected: All tests pass (existing create tests + new list tests).

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/recycling/sales/sales.service.ts apps/backend/src/modules/recycling/sales/sales.service.spec.ts
git commit --no-gpg-sign -m "feat(recycling/sales): enrich list with buyer name, total and material summary"
```

---

## Task 4: Backend — SalesService.getById + tests

**Files:**
- Modify: `apps/backend/src/modules/recycling/sales/sales.service.ts`
- Modify: `apps/backend/src/modules/recycling/sales/sales.service.spec.ts`

- [ ] **Step 1: Write failing tests**

Append inside `describe('SalesService')` in the spec file:

```typescript
  describe('getById', () => {
    it('should throw NotFoundException when sale does not exist', async () => {
      mockQueryRunner.query.mockImplementation(async (sql: string) => {
        if (sql.includes('SET LOCAL')) return undefined;
        if (sql.includes('FROM "tenant_') && sql.includes('sales s')) return [];
        return [];
      });

      const { NotFoundException } = await import('@nestjs/common');
      await expect(service.getById(TENANT, 'missing')).rejects.toThrow(NotFoundException);
    });

    it('should return full sale detail with items, buyer and operator', async () => {
      mockQueryRunner.query.mockImplementation(async (sql: string) => {
        if (sql.includes('SET LOCAL')) return undefined;
        if (sql.includes('FROM "tenant_') && sql.includes('sales s') && sql.includes('LEFT JOIN')) {
          return [{
            id: 'sale1',
            sold_at: new Date('2026-04-18T10:42:00Z'),
            notes: 'Retirada em 2 cargas',
            buyer_id: 'buyer1',
            buyer_name: 'MGLU Recicla',
            buyer_document: '12345678000199',
            buyer_document_type: null,
            operator_id: 'op1',
            operator_name: 'Vini Silva',
          }];
        }
        if (sql.includes('sale_items si')) {
          return [
            {
              id: 'item1',
              product_id: 'p1',
              product_name: 'Alumínio',
              quantity: '80.0000',
              unit_price: '8.5000',
              subtotal: '680.00',
            },
          ];
        }
        return [];
      });

      const result = await service.getById(TENANT, 'sale1');
      expect(result.id).toBe('sale1');
      expect(result.buyer.name).toBe('MGLU Recicla');
      expect(result.operator.name).toBe('Vini Silva');
      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toMatchObject({
        productId: 'p1',
        productName: 'Alumínio',
        quantity: 80,
        unitPrice: 8.5,
        subtotal: 680,
      });
      expect(result.total).toBe(680);
    });
  });
```

- [ ] **Step 2: Run tests to confirm failure**

Run: `pnpm --filter backend test -- sales.service.spec.ts`
Expected: `getById` tests fail.

- [ ] **Step 3: Implement `getById`**

Add to `apps/backend/src/modules/recycling/sales/sales.service.ts`. First, extend the imports at the top:

```typescript
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
```

Add this method at the end of the class (after `create`):

```typescript
  async getById(
    tenantId: string,
    id: string,
  ): Promise<{
    id: string;
    soldAt: string;
    buyer: { id: string; name: string; document: string | null; documentType: 'CPF' | 'CNPJ' | null };
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
  }> {
    const schemaName = this.getSchemaName(tenantId);
    return this.withSchema(tenantId, async (_manager, qr) => {
      const rows = await qr.query(
        `
        SELECT
          s.id, s.sold_at, s.notes,
          b.id as buyer_id, b.name as buyer_name,
          b.cnpj as buyer_document, NULL as buyer_document_type,
          u.id as operator_id, u.name as operator_name
        FROM "${schemaName}".sales s
        LEFT JOIN "${schemaName}".buyers b ON b.id = s.buyer_id
        LEFT JOIN public.users u ON u.id = s.operator_id
        WHERE s.id = $1
        `,
        [id],
      );
      if (rows.length === 0) throw new NotFoundException('Venda não encontrada.');
      const row = rows[0];

      const items = await qr.query(
        `
        SELECT
          si.id, si.product_id, si.quantity, si.unit_price, si.subtotal,
          p.name as product_name
        FROM "${schemaName}".sale_items si
        JOIN "${schemaName}".products p ON p.id = si.product_id
        WHERE si.sale_id = $1
        ORDER BY si.created_at ASC
        `,
        [id],
      );

      let total = 0;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mappedItems = items.map((it: any) => {
        const subtotal = Number(it.subtotal);
        total += subtotal;
        return {
          id: it.id,
          productId: it.product_id,
          productName: it.product_name,
          quantity: Number(it.quantity),
          unitPrice: Number(it.unit_price),
          subtotal,
        };
      });

      return {
        id: row.id,
        soldAt: new Date(row.sold_at).toISOString(),
        buyer: {
          id: row.buyer_id ?? '',
          name: row.buyer_name ?? '',
          document: row.buyer_document ?? null,
          documentType: row.buyer_document_type ?? null,
        },
        operator: {
          id: row.operator_id ?? '',
          name: row.operator_name ?? '',
        },
        notes: row.notes,
        total,
        items: mappedItems,
      };
    });
  }
```

Note: The `buyers` table stores `cnpj` (not `document`/`document_type` like `suppliers`), so the buyer document is always treated as CNPJ. The DTO still exposes `documentType` for future compatibility but the query returns `NULL as buyer_document_type`; if a `document_type` column is added later, this query can be updated without changing the API shape.

- [ ] **Step 4: Run tests to confirm pass**

Run: `pnpm --filter backend test -- sales.service.spec.ts`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/recycling/sales/sales.service.ts apps/backend/src/modules/recycling/sales/sales.service.spec.ts
git commit --no-gpg-sign -m "feat(recycling/sales): add getById with expanded buyer, operator and items"
```

---

## Task 5: Backend — GET /recycling/sales/:id route

**Files:**
- Modify: `apps/backend/src/modules/recycling/sales/sales.controller.ts`

- [ ] **Step 1: Add route**

Replace the full content of `apps/backend/src/modules/recycling/sales/sales.controller.ts` with:

```typescript
import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { AuthUser } from '../../core/auth/jwt.strategy';
import { EmployeePermissionsGuard, RequirePermission } from '../employees/employee-permissions.guard';
import { SalesService } from './sales.service';
import { CreateSaleDto } from './dto/create-sale.dto';

interface RequestWithUser extends Request {
  user: AuthUser;
}

@Controller('recycling/sales')
@UseGuards(JwtAuthGuard, EmployeePermissionsGuard)
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Get()
  @RequirePermission('canRegisterSales')
  list(
    @Request() req: RequestWithUser,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.salesService.list(req.user.tenantId, Number(page), Number(limit));
  }

  @Get(':id')
  @RequirePermission('canRegisterSales')
  getById(
    @Request() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.salesService.getById(req.user.tenantId, id);
  }

  @Post()
  @RequirePermission('canRegisterSales')
  create(@Request() req: RequestWithUser, @Body() dto: CreateSaleDto) {
    return this.salesService.create(req.user.tenantId, req.user.userId, dto);
  }
}
```

- [ ] **Step 2: Verify build**

Run: `pnpm --filter backend build`
Expected: Compiles without errors.

- [ ] **Step 3: Commit**

```bash
git add apps/backend/src/modules/recycling/sales/sales.controller.ts
git commit --no-gpg-sign -m "feat(recycling/sales): add GET /sales/:id endpoint"
```

---

## Task 6: Frontend — sales service types + methods

**Files:**
- Modify: `apps/frontend/src/services/recycling/sales.service.ts`

- [ ] **Step 1: Replace service file**

Replace the entire content of `apps/frontend/src/services/recycling/sales.service.ts` with:

```typescript
import { api } from '../api';

export interface SaleItemPayload {
  productId: string;
  quantity: number;
  unitPrice: number;
}

export interface Sale {
  id: string;
  buyerId: string;
  operatorId: string;
  soldAt: string;
  notes: string | null;
  createdAt: string;
}

export interface SaleListItem {
  id: string;
  soldAt: string;
  buyerId: string;
  buyerName: string;
  total: number;
  itemCount: number;
  firstProductName: string | null;
  totalKg: number;
  notes: string | null;
}

export interface SaleDetailItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface SaleDetail {
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
  items: SaleDetailItem[];
}

export interface CreateSalePayload {
  buyerId: string;
  items: SaleItemPayload[];
  notes?: string;
}

export const salesService = {
  async list(page = 1, limit = 20): Promise<{ data: SaleListItem[]; total: number; page: number; limit: number }> {
    const { data } = await api.get('/recycling/sales', { params: { page, limit } });
    return data;
  },
  async getById(id: string): Promise<SaleDetail> {
    const { data } = await api.get<SaleDetail>(`/recycling/sales/${id}`);
    return data;
  },
  async create(payload: CreateSalePayload): Promise<Sale> {
    const { data } = await api.post<Sale>('/recycling/sales', payload);
    return data;
  },
};
```

- [ ] **Step 2: Verify build**

Run: `pnpm --filter frontend build`
Expected: Succeeds (TS compilation). Vite may fail on Node 18 — the TS check is sufficient.

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/services/recycling/sales.service.ts
git commit --no-gpg-sign -m "feat(recycling/sales): frontend types and getById method"
```

---

## Task 7: Frontend — reports service + useSalesSummary hook

**Files:**
- Modify: `apps/frontend/src/services/recycling/reports.service.ts`
- Modify: `apps/frontend/src/hooks/recycling/useReports.ts`

- [ ] **Step 1: Add SalesSummary type and method**

Modify `apps/frontend/src/services/recycling/reports.service.ts` — append the new type and service method at the end (before the closing of the `reportsService` object):

1a) Add the type near the other types (after `PurchasePeriodEntry`):

```typescript
export interface SalesSummary {
  today: { total: number; count: number };
  week: { total: number; count: number };
  month: { total: number; count: number };
}
```

1b) Inside the `reportsService` object, after `getTopMaterials`, add:

```typescript
  async getSalesSummary(): Promise<SalesSummary> {
    const { data } = await api.get<SalesSummary>('/recycling/reports/sales-summary');
    return data;
  },
```

- [ ] **Step 2: Add useSalesSummary hook**

Append to `apps/frontend/src/hooks/recycling/useReports.ts`:

```typescript
import type { SalesSummary } from '../../services/recycling/reports.service';

export function useSalesSummary() {
  const [summary, setSummary] = useState<SalesSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(() => {
    setLoading(true);
    setError(null);
    reportsService.getSalesSummary()
      .then(setSummary)
      .catch(() => setError('Erro ao carregar resumo de vendas'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  return { summary, loading, error, refetch };
}
```

Merge the `SalesSummary` import with any existing imports from `'../../services/recycling/reports.service'` so the file has a single import line from that path.

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/services/recycling/reports.service.ts apps/frontend/src/hooks/recycling/useReports.ts
git commit --no-gpg-sign -m "feat(recycling/reports): sales-summary frontend service and hook"
```

---

## Task 8: Frontend — update useSales + SaleDetailModal

**Files:**
- Modify: `apps/frontend/src/hooks/recycling/useSales.ts`
- Create: `apps/frontend/src/pages/recycling/sales/SaleDetailModal.tsx`

- [ ] **Step 1: Update useSales hook to use SaleListItem**

Replace the full content of `apps/frontend/src/hooks/recycling/useSales.ts` with:

```typescript
import { useState, useEffect, useCallback } from 'react';
import { salesService, type SaleListItem } from '../../services/recycling/sales.service';

export function useSales(page: number, limit = 20) {
  const [sales, setSales] = useState<SaleListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    salesService.list(page, limit)
      .then((res) => {
        setSales(res.data);
        setTotal(res.total);
      })
      .catch(() => setError('Erro ao carregar vendas'))
      .finally(() => setLoading(false));
  }, [page, limit]);

  useEffect(() => { load(); }, [load]);

  return { sales, total, loading, error, reload: load };
}
```

- [ ] **Step 2: Create SaleDetailModal component**

Create `apps/frontend/src/pages/recycling/sales/SaleDetailModal.tsx`:

```tsx
import { useEffect, useState } from 'react';
import {
  CModal, CModalBody, CModalFooter, CModalHeader, CModalTitle,
  CButton, CSpinner, CAlert,
  CTable, CTableBody, CTableDataCell, CTableHead, CTableHeaderCell, CTableRow,
} from '@coreui/react';
import { salesService, type SaleDetail } from '../../../services/recycling/sales.service';

function formatCurrency(value: number): string {
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDocument(doc: string | null, type: 'CPF' | 'CNPJ' | null): string | null {
  if (!doc) return null;
  if (type === 'CPF' && doc.length === 11) {
    return `${doc.slice(0, 3)}.${doc.slice(3, 6)}.${doc.slice(6, 9)}-${doc.slice(9)}`;
  }
  if ((type === 'CNPJ' || !type) && doc.length === 14) {
    return `${doc.slice(0, 2)}.${doc.slice(2, 5)}.${doc.slice(5, 8)}/${doc.slice(8, 12)}-${doc.slice(12)}`;
  }
  return doc;
}

function Field({ label, value }: { label: string; value: string | React.ReactNode }) {
  return (
    <div>
      <div style={{
        fontSize: 11,
        color: 'var(--cui-secondary-color)',
        textTransform: 'uppercase',
        fontWeight: 600,
        letterSpacing: '0.04em',
        marginBottom: 4,
      }}>
        {label}
      </div>
      <div style={{ fontSize: 14, color: 'var(--cui-body-color)' }}>{value}</div>
    </div>
  );
}

export function SaleDetailModal({
  saleId,
  onClose,
}: {
  saleId: string | null;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<SaleDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!saleId) { setDetail(null); return; }
    setLoading(true);
    setError(null);
    salesService.getById(saleId)
      .then(setDetail)
      .catch((e) => {
        if (e?.response?.status === 404) setError('Venda não encontrada.');
        else setError('Erro ao carregar venda.');
      })
      .finally(() => setLoading(false));
  }, [saleId]);

  const open = !!saleId;
  const shortId = detail ? `#${detail.id.slice(0, 8).toUpperCase()}` : '';

  return (
    <CModal visible={open} onClose={onClose} size="lg" alignment="center">
      <CModalHeader>
        <CModalTitle>Venda {shortId}</CModalTitle>
      </CModalHeader>
      <CModalBody>
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
            <CSpinner color="primary" />
          </div>
        )}
        {error && <CAlert color="danger" className="mb-0">{error}</CAlert>}
        {detail && (
          <>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              gap: 16,
              marginBottom: 20,
            }}>
              <Field
                label="Comprador"
                value={
                  <>
                    <div>{detail.buyer.name || '—'}</div>
                    {detail.buyer.document && (
                      <div style={{ fontSize: 12, color: 'var(--cui-secondary-color)' }}>
                        {formatDocument(detail.buyer.document, detail.buyer.documentType)}
                      </div>
                    )}
                  </>
                }
              />
              <Field
                label="Data/Hora"
                value={new Date(detail.soldAt).toLocaleString('pt-BR')}
              />
              <Field label="Operador" value={detail.operator.name || '—'} />
              <Field
                label="Total"
                value={
                  <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--cui-primary)' }}>
                    {formatCurrency(detail.total)}
                  </span>
                }
              />
            </div>

            <div style={{ marginBottom: detail.notes ? 20 : 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Itens</div>
              <CTable small bordered className="mb-0">
                <CTableHead>
                  <CTableRow>
                    <CTableHeaderCell>Produto</CTableHeaderCell>
                    <CTableHeaderCell style={{ textAlign: 'right' }}>Qtd</CTableHeaderCell>
                    <CTableHeaderCell style={{ textAlign: 'right' }}>Preço/kg</CTableHeaderCell>
                    <CTableHeaderCell style={{ textAlign: 'right' }}>Subtotal</CTableHeaderCell>
                  </CTableRow>
                </CTableHead>
                <CTableBody>
                  {detail.items.map((it) => (
                    <CTableRow key={it.id}>
                      <CTableDataCell>{it.productName}</CTableDataCell>
                      <CTableDataCell style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {it.quantity.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} kg
                      </CTableDataCell>
                      <CTableDataCell style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {formatCurrency(it.unitPrice)}
                      </CTableDataCell>
                      <CTableDataCell style={{ textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                        {formatCurrency(it.subtotal)}
                      </CTableDataCell>
                    </CTableRow>
                  ))}
                  <CTableRow>
                    <CTableDataCell colSpan={3} style={{ textAlign: 'right', fontWeight: 600 }}>Total</CTableDataCell>
                    <CTableDataCell style={{ textAlign: 'right', fontWeight: 700, color: 'var(--cui-primary)', fontVariantNumeric: 'tabular-nums' }}>
                      {formatCurrency(detail.total)}
                    </CTableDataCell>
                  </CTableRow>
                </CTableBody>
              </CTable>
            </div>

            {detail.notes && (
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Observações</div>
                <div style={{
                  padding: 12,
                  background: 'var(--cui-card-cap-bg)',
                  borderRadius: 8,
                  fontSize: 13,
                  color: 'var(--cui-body-color)',
                  whiteSpace: 'pre-wrap',
                }}>
                  {detail.notes}
                </div>
              </div>
            )}
          </>
        )}
      </CModalBody>
      <CModalFooter>
        <CButton color="secondary" variant="outline" onClick={onClose}>Fechar</CButton>
      </CModalFooter>
    </CModal>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/hooks/recycling/useSales.ts apps/frontend/src/pages/recycling/sales/SaleDetailModal.tsx
git commit --no-gpg-sign -m "feat(recycling/sales): SaleDetailModal and useSales typed with SaleListItem"
```

---

## Task 9: Frontend — redesign SalesPage

**Files:**
- Modify: `apps/frontend/src/pages/recycling/sales/SalesPage.tsx`

- [ ] **Step 1: Full page rewrite**

Replace the entire content of `apps/frontend/src/pages/recycling/sales/SalesPage.tsx` with:

```tsx
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CAlert,
  CButton,
  CFormInput,
  CSpinner,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilPlus, cilSearch, cilCart, cilArrowTop, cilEyeOpen } from '@coreui/icons';
import { useSales } from '../../../hooks/recycling/useSales';
import { useSalesSummary } from '../../../hooks/recycling/useReports';
import { SaleDetailModal } from './SaleDetailModal';

function formatCurrency(value: number): string {
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function formatKg(value: number): string {
  return `${Math.round(value).toLocaleString('pt-BR')}kg`;
}

function materialSummary(item: { itemCount: number; firstProductName: string | null; totalKg: number }): string {
  if (item.itemCount === 0) return '—';
  if (item.itemCount === 1 && item.firstProductName) {
    return `${item.firstProductName} · ${formatKg(item.totalKg)}`;
  }
  return `${item.itemCount} materiais · ${formatKg(item.totalKg)}`;
}

// ── KPI Card (inline, matches dashboard style) ──────────────────────────────
function KpiCard({
  label,
  value,
  sub,
  loading,
}: {
  label: string;
  value: string;
  sub: string;
  loading: boolean;
}) {
  return (
    <div
      style={{
        padding: '18px 20px',
        background: 'var(--cui-card-bg)',
        border: '1px solid var(--cui-border-color)',
        borderRadius: 14,
      }}
    >
      <div
        style={{
          fontSize: 11,
          color: 'var(--cui-secondary-color)',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          fontWeight: 600,
        }}
      >
        <CIcon icon={cilArrowTop} style={{ width: 13, height: 13 }} />
        {label}
      </div>
      <div
        style={{
          marginTop: 8,
          fontSize: 26,
          fontWeight: 700,
          letterSpacing: '-0.02em',
          fontVariantNumeric: 'tabular-nums',
          color: 'var(--cui-body-color)',
        }}
      >
        {loading ? '—' : value}
      </div>
      <div style={{ marginTop: 4, fontSize: 12, color: 'var(--cui-secondary-color)' }}>
        {sub}
      </div>
    </div>
  );
}

// ── Main page ───────────────────────────────────────────────────────────────
export function SalesPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const limit = 20;
  const { sales, total, loading, error } = useSales(page, limit);
  const { summary, loading: summaryLoading } = useSalesSummary();
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sales;
    return sales.filter((s) => {
      const hay = `${s.id} ${s.buyerName} ${s.notes ?? ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [sales, search]);

  const totalPages = Math.ceil(total / limit) || 1;
  const shownFrom = total === 0 ? 0 : (page - 1) * limit + 1;
  const shownTo = Math.min(page * limit, total);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* ── Page head ─────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 20,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: 22,
              fontWeight: 600,
              letterSpacing: '-0.02em',
              color: 'var(--cui-body-color)',
            }}
          >
            Vendas
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13.5, color: 'var(--cui-secondary-color)' }}>
            Registre saídas de material vendido para compradores.
          </p>
        </div>
        <CButton
          color="primary"
          onClick={() => navigate('/recycling/sales/new')}
          style={{ borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <CIcon icon={cilPlus} size="sm" /> Nova venda
        </CButton>
      </div>

      {/* ── KPI grid ─────────────────────────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 14,
        }}
      >
        <KpiCard
          label="Hoje"
          value={formatCurrency(summary?.today.total ?? 0)}
          sub={`${summary?.today.count ?? 0} ${(summary?.today.count ?? 0) === 1 ? 'venda' : 'vendas'}`}
          loading={summaryLoading}
        />
        <KpiCard
          label="Semana"
          value={formatCurrency(summary?.week.total ?? 0)}
          sub={`${summary?.week.count ?? 0} ${(summary?.week.count ?? 0) === 1 ? 'venda' : 'vendas'}`}
          loading={summaryLoading}
        />
        <KpiCard
          label="Mês"
          value={formatCurrency(summary?.month.total ?? 0)}
          sub={`${summary?.month.count ?? 0} ${(summary?.month.count ?? 0) === 1 ? 'venda' : 'vendas'}`}
          loading={summaryLoading}
        />
      </div>

      {error && <CAlert color="danger" className="mb-0">{error}</CAlert>}

      {/* ── Table card ───────────────────────────────────────────── */}
      <div className="pk-table-card">
        <div className="pk-table-toolbar">
          <div style={{ position: 'relative', flex: 1, minWidth: 240, maxWidth: 360 }}>
            <CIcon
              icon={cilSearch}
              style={{
                position: 'absolute',
                left: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--cui-secondary-color)',
                pointerEvents: 'none',
                width: 14,
                height: 14,
              }}
            />
            <CFormInput
              placeholder="Buscar por comprador, material ou ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: 36 }}
              size="sm"
              aria-label="Buscar vendas"
            />
          </div>
        </div>

        <CTable hover responsive className="mb-0">
          <CTableHead>
            <CTableRow>
              <CTableHeaderCell>ID</CTableHeaderCell>
              <CTableHeaderCell>Data</CTableHeaderCell>
              <CTableHeaderCell>Comprador</CTableHeaderCell>
              <CTableHeaderCell>Material</CTableHeaderCell>
              <CTableHeaderCell style={{ textAlign: 'right' }}>Total</CTableHeaderCell>
              <CTableHeaderCell style={{ width: 60, textAlign: 'center' }}> </CTableHeaderCell>
            </CTableRow>
          </CTableHead>
          <CTableBody>
            {loading ? (
              <CTableRow>
                <CTableDataCell colSpan={6} className="text-center py-4">
                  <CSpinner size="sm" color="primary" />
                </CTableDataCell>
              </CTableRow>
            ) : filtered.length === 0 ? (
              <CTableRow>
                <CTableDataCell colSpan={6} className="text-center py-5">
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: 12,
                      background: 'rgba(52,142,145,0.1)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <CIcon icon={cilCart} size="lg" style={{ color: 'var(--cui-primary)' }} />
                    </div>
                    <div style={{ fontWeight: 600, color: 'var(--cui-body-color)' }}>
                      {sales.length === 0 ? 'Nenhuma venda ainda' : 'Nenhum resultado'}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--cui-secondary-color)' }}>
                      {sales.length === 0
                        ? 'Registre a primeira venda para começar.'
                        : 'Tente ajustar a busca.'}
                    </div>
                  </div>
                </CTableDataCell>
              </CTableRow>
            ) : (
              filtered.map((s) => (
                <CTableRow
                  key={s.id}
                  style={{ cursor: 'pointer' }}
                  onClick={() => setSelectedId(s.id)}
                >
                  <CTableDataCell style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 12,
                    color: 'var(--cui-body-color)',
                    fontWeight: 600,
                  }}>
                    #{s.id.slice(0, 8).toUpperCase()}
                  </CTableDataCell>
                  <CTableDataCell>
                    <div style={{ fontSize: 13, color: 'var(--cui-body-color)', fontVariantNumeric: 'tabular-nums' }}>
                      {formatDate(s.soldAt)}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--cui-secondary-color)', fontVariantNumeric: 'tabular-nums' }}>
                      {formatTime(s.soldAt)}
                    </div>
                  </CTableDataCell>
                  <CTableDataCell>
                    {s.buyerName ? (
                      <span style={{ fontWeight: 500, color: 'var(--cui-body-color)' }}>{s.buyerName}</span>
                    ) : (
                      <span style={{ color: 'var(--cui-secondary-color)' }}>—</span>
                    )}
                  </CTableDataCell>
                  <CTableDataCell>
                    <span style={{ fontSize: 13, color: 'var(--cui-body-color)' }}>
                      {materialSummary(s)}
                    </span>
                  </CTableDataCell>
                  <CTableDataCell style={{
                    textAlign: 'right',
                    fontWeight: 700,
                    fontVariantNumeric: 'tabular-nums',
                    color: 'var(--cui-primary)',
                  }}>
                    {formatCurrency(s.total)}
                  </CTableDataCell>
                  <CTableDataCell style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(s.id)}
                      aria-label="Ver detalhes"
                      style={{
                        border: 0,
                        background: 'transparent',
                        color: 'var(--cui-secondary-color)',
                        cursor: 'pointer',
                        padding: 4,
                      }}
                    >
                      <CIcon icon={cilEyeOpen} size="sm" />
                    </button>
                  </CTableDataCell>
                </CTableRow>
              ))
            )}
          </CTableBody>
        </CTable>

        <div className="pk-table-footer">
          <span>{total > 0 ? `Mostrando ${shownFrom}–${shownTo} de ${total}` : 'Nenhum registro'}</span>
          {total > limit && (
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
              <CButton color="secondary" variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)} aria-label="Página anterior">‹</CButton>
              <span style={{ display: 'inline-flex', alignItems: 'center', padding: '0 10px', fontWeight: 500, color: 'var(--cui-body-color)' }}>{page} / {totalPages}</span>
              <CButton color="secondary" variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)} aria-label="Próxima página">›</CButton>
            </div>
          )}
        </div>
      </div>

      <SaleDetailModal saleId={selectedId} onClose={() => setSelectedId(null)} />
    </div>
  );
}
```

- [ ] **Step 2: Smoke test**

Run: `pnpm --filter frontend dev` (or `docker-compose restart frontend`), open `http://localhost:8080/recycling/sales`, and verify:
- Three KPI cards at top show values from `/recycling/reports/sales-summary`
- Table shows enriched rows (buyer name, material summary, total in teal)
- Click on row opens the detail modal with items, total, observations (if any)

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/pages/recycling/sales/SalesPage.tsx
git commit --no-gpg-sign -m "feat(recycling/sales): redesign page with KPIs, enriched table and detail modal"
```

---

## Acceptance Testing (manual)

After all tasks complete, verify:

- [ ] Open `/recycling/sales` as OWNER — see 3 KPI cards with today/week/month values
- [ ] Open `/recycling/sales` as EMPLOYEE — same view works (reports summary is open to any authenticated user)
- [ ] Create 2 sales (1 with single product, 1 with 3 products), refresh:
  - Single: Material column shows `{produto} · {kg}kg`
  - Multi: Material column shows `3 materiais · {kg total}kg`
- [ ] Click on a sale row → modal opens with full detail (items table, operator name, total in teal)
- [ ] If the sale has `notes` → the "Observações" block appears in the modal
- [ ] Search field filters by ID, buyer name and observation text
- [ ] Empty state shows on zero sales; "Nenhum resultado" shows when search has no matches
- [ ] Pagination footer works when >20 sales
- [ ] Nova venda button still navigates to `/recycling/sales/new` unchanged

---

## Notes on execution order

- Tasks 1–5 are backend; can be shipped as one deploy before frontend starts
- Tasks 6–9 are frontend; each task depends on the previous (service → hook → component → page)
- Task 3 changes the list response shape — the old frontend `Sale` type was replaced by `SaleListItem` in Task 6, so do not run the frontend against the backend until Task 6 is deployed (or test manually by hitting the endpoint with curl)

## Out of scope (per spec)

- Status "Paga / Pendente"
- Card "Margem Média"
- Botão "Filtrar"
- Nova venda em modal (continua na página separada)
