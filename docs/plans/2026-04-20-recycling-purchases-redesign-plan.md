# Recycling Purchases Page Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replicate the Vendas (sales) page model on Compras (purchases): KPIs (Hoje/Semana/Mês), enriched listing with supplier + material summary, and a detail modal triggered by row click — while preserving the payment filter and badge column that are specific to purchases.

**Architecture:** Mirror the sales implementation (commits c8e0368…12f7e37) one-to-one. Adds a new `GET /recycling/reports/purchases-summary` endpoint; replaces `PurchasesService.list()` with an enriched raw-SQL query (JOIN suppliers + LATERAL over purchase_items); adds `PurchasesService.getById` + `GET /recycling/purchases/:id`. On the frontend, retypes the purchases service/hook, adds a new `PurchaseDetailModal` component and redesigns `PurchasesPage`.

**Tech Stack:** NestJS + TypeORM + raw SQL on backend; React 19 + CoreUI + Axios on frontend; Jest (backend) and Vitest (frontend) for tests.

**Spec:** `docs/plans/2026-04-20-recycling-purchases-redesign-design.md`

---

## File Structure

### Backend
- `apps/backend/src/modules/recycling/reports/reports.service.ts` — add `getPurchasesSummary(tenantId)` method
- `apps/backend/src/modules/recycling/reports/reports.controller.ts` — add `@Get('purchases-summary')` route
- `apps/backend/src/modules/recycling/reports/reports.service.spec.ts` — new `describe('getPurchasesSummary')` block
- `apps/backend/src/modules/recycling/purchases/purchases.service.ts` — replace `list()` with enriched raw SQL; add `getById(tenantId, id)`
- `apps/backend/src/modules/recycling/purchases/purchases.controller.ts` — add `@Get(':id')` route
- `apps/backend/src/modules/recycling/purchases/purchases.service.spec.ts` — rewrite `describe('list')` for new shape; add `describe('getById')`

### Frontend
- `apps/frontend/src/services/recycling/reports.service.ts` — add `PurchasesSummary` type + `getPurchasesSummary()`
- `apps/frontend/src/hooks/recycling/useReports.ts` — add `usePurchasesSummary()`
- `apps/frontend/src/services/recycling/purchases.service.ts` — replace `Purchase` with `PurchaseListItem`; add `PurchaseDetail` + `getById()`
- `apps/frontend/src/hooks/recycling/usePurchases.ts` — retype to `PurchaseListItem`
- `apps/frontend/src/pages/recycling/purchases/PurchaseDetailModal.tsx` — new component (mirror of `SaleDetailModal`)
- `apps/frontend/src/pages/recycling/purchases/PurchasesPage.tsx` — full redesign (KPIs + row-click modal + material column)

---

## Conventions

- **TDD (backend):** each backend task writes the failing Jest test first, runs it to confirm failure, implements minimum code, runs again to confirm green.
- **Frontend:** tests are not required for UI work here (repo has no vitest tests for pages/hooks today); verify with `tsc --noEmit` after each task.
- **Commits:** at end of each task. Use `--no-gpg-sign` (user's workspace has SSH signing with passphrase; authorized).
- **Test command (backend, one file):** `pnpm --filter backend test -- <relative-path-to-spec>`
- **Type-check (frontend):** `cd apps/frontend && npx tsc --noEmit`

---

## Task 1: Backend — `getPurchasesSummary` service method + endpoint

**Files:**
- Modify: `apps/backend/src/modules/recycling/reports/reports.service.ts`
- Modify: `apps/backend/src/modules/recycling/reports/reports.controller.ts`
- Modify: `apps/backend/src/modules/recycling/reports/reports.service.spec.ts`

- [ ] **Step 1.1: Add failing tests for `getPurchasesSummary`**

Edit `apps/backend/src/modules/recycling/reports/reports.service.spec.ts` and append a new describe block inside the top-level `describe('RecyclingReportsService', ...)`, after the existing `describe('getSalesSummary', ...)` block and before `describe('getTopMaterials', ...)`:

```typescript
describe('getPurchasesSummary', () => {
  it('should throw on invalid tenantId', async () => {
    await expect(service.getPurchasesSummary('bad-id')).rejects.toThrow('Invalid tenantId');
  });

  it('should return totals for today, week and month', async () => {
    mockQueryRunner.query.mockImplementation(async (sql: string) => {
      if (sql.includes('SET LOCAL')) return undefined;
      if (sql.includes('DATE(purchased_at) = CURRENT_DATE')) {
        return [{ total: '1500.00', count: '5' }];
      }
      if (sql.includes("CURRENT_DATE - interval '7 days'")) {
        return [{ total: '7200.00', count: '18' }];
      }
      if (sql.includes("date_trunc('month'")) {
        return [{ total: '14820.00', count: '42' }];
      }
      return [];
    });

    const result = await service.getPurchasesSummary(TENANT);
    expect(result.today).toEqual({ total: 1500, count: 5 });
    expect(result.week).toEqual({ total: 7200, count: 18 });
    expect(result.month).toEqual({ total: 14820, count: 42 });
  });

  it('should return zeros when no purchases', async () => {
    mockQueryRunner.query.mockImplementation(async (sql: string) => {
      if (sql.includes('SET LOCAL')) return undefined;
      return [{ total: '0.00', count: '0' }];
    });

    const result = await service.getPurchasesSummary(TENANT);
    expect(result.today).toEqual({ total: 0, count: 0 });
    expect(result.week).toEqual({ total: 0, count: 0 });
    expect(result.month).toEqual({ total: 0, count: 0 });
  });
});
```

- [ ] **Step 1.2: Run the tests and confirm failure**

Run: `pnpm --filter backend test -- src/modules/recycling/reports/reports.service.spec.ts`
Expected: FAIL — `service.getPurchasesSummary is not a function`.

- [ ] **Step 1.3: Implement `getPurchasesSummary`**

Edit `apps/backend/src/modules/recycling/reports/reports.service.ts`. Append this method inside the `RecyclingReportsService` class, immediately after `getSalesSummary` (end of file, before the closing brace):

```typescript
async getPurchasesSummary(tenantId: string): Promise<{
  today: { total: number; count: number };
  week: { total: number; count: number };
  month: { total: number; count: number };
}> {
  const schemaName = this.getSchemaName(tenantId);
  return this.withQueryRunner(tenantId, async (qr) => {
    const [today] = await qr.query(`
      SELECT
        COALESCE(SUM(total_amount), 0) as total,
        COUNT(*) as count
      FROM "${schemaName}".purchases
      WHERE DATE(purchased_at) = CURRENT_DATE
    `);

    const [week] = await qr.query(`
      SELECT
        COALESCE(SUM(total_amount), 0) as total,
        COUNT(*) as count
      FROM "${schemaName}".purchases
      WHERE purchased_at >= CURRENT_DATE - interval '7 days'
    `);

    const [month] = await qr.query(`
      SELECT
        COALESCE(SUM(total_amount), 0) as total,
        COUNT(*) as count
      FROM "${schemaName}".purchases
      WHERE purchased_at >= date_trunc('month', CURRENT_DATE)
        AND purchased_at < date_trunc('month', CURRENT_DATE) + interval '1 month'
    `);

    return {
      today: { total: Number(today.total), count: Number(today.count) },
      week: { total: Number(week.total), count: Number(week.count) },
      month: { total: Number(month.total), count: Number(month.count) },
    };
  });
}
```

- [ ] **Step 1.4: Run the tests and confirm they pass**

Run: `pnpm --filter backend test -- src/modules/recycling/reports/reports.service.spec.ts`
Expected: PASS — all new `getPurchasesSummary` tests green; existing tests still green.

- [ ] **Step 1.5: Expose the controller route**

Edit `apps/backend/src/modules/recycling/reports/reports.controller.ts`. Add a new handler at the end of the class, right after `getSalesSummary`:

```typescript
@Get('purchases-summary')
getPurchasesSummary(@Request() req: RequestWithUser) {
  return this.reportsService.getPurchasesSummary(req.user.tenantId);
}
```

- [ ] **Step 1.6: Commit**

```bash
git add apps/backend/src/modules/recycling/reports/reports.service.ts \
        apps/backend/src/modules/recycling/reports/reports.controller.ts \
        apps/backend/src/modules/recycling/reports/reports.service.spec.ts
git commit --no-gpg-sign -m "$(cat <<'EOF'
feat(recycling/reports): add purchases-summary endpoint

Returns today/week/month totals and counts for purchases, mirroring
the sales-summary endpoint. Used by the Compras page KPI grid.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Backend — enrich `PurchasesService.list()`

**Files:**
- Modify: `apps/backend/src/modules/recycling/purchases/purchases.service.ts`
- Modify: `apps/backend/src/modules/recycling/purchases/purchases.service.spec.ts`

- [ ] **Step 2.1: Replace the `list` test with the new enriched shape**

Edit `apps/backend/src/modules/recycling/purchases/purchases.service.spec.ts`. Replace the entire existing `describe('list', ...)` block (which currently uses `createQueryBuilder`) with this new block. Leave the `describe('create', ...)` block untouched.

```typescript
describe('list', () => {
  it('should return enriched purchases with supplier name, total and material summary', async () => {
    mockQueryRunner.query.mockImplementation(async (sql: string) => {
      if (sql.includes('SET LOCAL')) return undefined;
      if (sql.includes('COUNT(*) as count')) return [{ count: '1' }];
      if (sql.includes('FROM "tenant_')) {
        return [
          {
            id: 'purchase1',
            purchased_at: new Date('2026-04-18T10:42:00Z'),
            supplier_id: 'supplier1',
            payment_method: 'CASH',
            total_amount: '480.00',
            notes: null,
            supplier_name: 'Sucata Santa Lúcia',
            item_count: '2',
            total_kg: '120.0000',
            first_product_name: 'PET',
          },
        ];
      }
      return [];
    });

    const result = await service.list(TENANT, 1, 20);
    expect(result.total).toBe(1);
    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toMatchObject({
      id: 'purchase1',
      supplierId: 'supplier1',
      supplierName: 'Sucata Santa Lúcia',
      paymentMethod: 'CASH',
      total: 480,
      itemCount: 2,
      totalKg: 120,
      firstProductName: 'PET',
      notes: null,
    });
  });

  it('should throw on invalid tenantId', async () => {
    await expect(service.list('bad-id', 1, 20)).rejects.toThrow('Invalid tenantId');
  });
});
```

- [ ] **Step 2.2: Run the tests and confirm failure**

Run: `pnpm --filter backend test -- src/modules/recycling/purchases/purchases.service.spec.ts`
Expected: FAIL — the current `list()` uses the query builder which returns `[{ id: 'p1' }]` without the enriched fields (`supplierName`, `itemCount`, etc.). The `mockToMatchObject` will fail.

- [ ] **Step 2.3: Rewrite `PurchasesService.list()`**

Edit `apps/backend/src/modules/recycling/purchases/purchases.service.ts`. Replace the existing `list` method (lines ~41-56) with:

```typescript
async list(
  tenantId: string,
  page: number,
  limit: number,
): Promise<{
  data: Array<{
    id: string;
    purchasedAt: string;
    supplierId: string;
    supplierName: string;
    paymentMethod: string;
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
        p.id,
        p.purchased_at,
        p.supplier_id,
        p.payment_method,
        p.total_amount,
        p.notes,
        s.name as supplier_name,
        COALESCE(agg.item_count, 0) as item_count,
        COALESCE(agg.total_kg, 0) as total_kg,
        agg.first_product_name
      FROM "${schemaName}".purchases p
      LEFT JOIN "${schemaName}".suppliers s ON s.id = p.supplier_id
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*) as item_count,
          COALESCE(SUM(pi.quantity), 0) as total_kg,
          (
            SELECT pr.name
            FROM "${schemaName}".purchase_items pi2
            JOIN "${schemaName}".products pr ON pr.id = pi2.product_id
            WHERE pi2.purchase_id = p.id
            LIMIT 1
          ) as first_product_name
        FROM "${schemaName}".purchase_items pi
        WHERE pi.purchase_id = p.id
      ) agg ON TRUE
      ORDER BY p.purchased_at DESC
      LIMIT $1 OFFSET $2
      `,
      [limit, offset],
    );

    const [{ count }] = await qr.query(
      `SELECT COUNT(*) as count FROM "${schemaName}".purchases`,
    );

    return {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: rows.map((r: any) => ({
        id: r.id,
        purchasedAt: new Date(r.purchased_at).toISOString(),
        supplierId: r.supplier_id,
        supplierName: r.supplier_name ?? '',
        paymentMethod: r.payment_method,
        total: Number(r.total_amount),
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

- [ ] **Step 2.4: Run the tests and confirm they pass**

Run: `pnpm --filter backend test -- src/modules/recycling/purchases/purchases.service.spec.ts`
Expected: PASS — new `list` tests green, `create` tests still green.

- [ ] **Step 2.5: Commit**

```bash
git add apps/backend/src/modules/recycling/purchases/purchases.service.ts \
        apps/backend/src/modules/recycling/purchases/purchases.service.spec.ts
git commit --no-gpg-sign -m "$(cat <<'EOF'
feat(recycling/purchases): enrich list with supplier name, total and material summary

Replaces query-builder list with raw SQL that joins suppliers and
aggregates purchase_items via LATERAL, mirroring the sales listing.
Response shape changes: Purchase → PurchaseListItem with supplierName,
itemCount, firstProductName, totalKg and a flattened total.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Backend — `PurchasesService.getById` + endpoint

**Files:**
- Modify: `apps/backend/src/modules/recycling/purchases/purchases.service.ts`
- Modify: `apps/backend/src/modules/recycling/purchases/purchases.controller.ts`
- Modify: `apps/backend/src/modules/recycling/purchases/purchases.service.spec.ts`

- [ ] **Step 3.1: Add failing tests for `getById`**

Edit `apps/backend/src/modules/recycling/purchases/purchases.service.spec.ts` and append a new describe block at the end of the top-level `describe('PurchasesService', ...)`:

```typescript
describe('getById', () => {
  it('should throw NotFoundException when purchase does not exist', async () => {
    mockQueryRunner.query.mockImplementation(async (sql: string) => {
      if (sql.includes('SET LOCAL')) return undefined;
      if (sql.includes('FROM "tenant_') && sql.includes('purchases p')) return [];
      return [];
    });

    const { NotFoundException } = await import('@nestjs/common');
    await expect(service.getById(TENANT, 'missing')).rejects.toThrow(NotFoundException);
  });

  it('should return full purchase detail with items, supplier and operator', async () => {
    mockQueryRunner.query.mockImplementation(async (sql: string) => {
      if (sql.includes('SET LOCAL')) return undefined;
      if (sql.includes('FROM "tenant_') && sql.includes('purchases p') && sql.includes('LEFT JOIN')) {
        return [{
          id: 'purchase1',
          purchased_at: new Date('2026-04-18T10:42:00Z'),
          payment_method: 'PIX',
          notes: 'Entregue em 3 sacos',
          supplier_id: 'supplier1',
          supplier_name: 'Sucata Santa Lúcia',
          supplier_document: '12345678000199',
          supplier_document_type: 'CNPJ',
          operator_id: 'op1',
          operator_name: 'Vini Silva',
        }];
      }
      if (sql.includes('purchase_items pi')) {
        return [
          {
            id: 'item1',
            product_id: 'p1',
            product_name: 'PET',
            quantity: '120.0000',
            unit_price: '4.0000',
            subtotal: '480.00',
          },
        ];
      }
      return [];
    });

    const result = await service.getById(TENANT, 'purchase1');
    expect(result.id).toBe('purchase1');
    expect(result.supplier.name).toBe('Sucata Santa Lúcia');
    expect(result.supplier.document).toBe('12345678000199');
    expect(result.supplier.documentType).toBe('CNPJ');
    expect(result.operator.name).toBe('Vini Silva');
    expect(result.paymentMethod).toBe('PIX');
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      productId: 'p1',
      productName: 'PET',
      quantity: 120,
      unitPrice: 4,
      subtotal: 480,
    });
    expect(result.total).toBe(480);
  });
});
```

- [ ] **Step 3.2: Run the tests and confirm failure**

Run: `pnpm --filter backend test -- src/modules/recycling/purchases/purchases.service.spec.ts`
Expected: FAIL — `service.getById is not a function`.

- [ ] **Step 3.3: Implement `getById` in the service**

Edit `apps/backend/src/modules/recycling/purchases/purchases.service.ts`. First, update the imports on the first line:

```typescript
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
```

Then append this method at the end of the `PurchasesService` class (after `create`, before the closing brace):

```typescript
async getById(
  tenantId: string,
  id: string,
): Promise<{
  id: string;
  purchasedAt: string;
  supplier: { id: string; name: string; document: string | null; documentType: 'CPF' | 'CNPJ' | null };
  operator: { id: string; name: string };
  paymentMethod: string;
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
        p.id, p.purchased_at, p.payment_method, p.notes,
        s.id as supplier_id, s.name as supplier_name,
        s.document as supplier_document, s.document_type as supplier_document_type,
        u.id as operator_id, u.name as operator_name
      FROM "${schemaName}".purchases p
      LEFT JOIN "${schemaName}".suppliers s ON s.id = p.supplier_id
      LEFT JOIN public.users u ON u.id = p.operator_id
      WHERE p.id = $1
      `,
      [id],
    );
    if (rows.length === 0) throw new NotFoundException('Compra não encontrada.');
    const row = rows[0];

    const items = await qr.query(
      `
      SELECT
        pi.id, pi.product_id, pi.quantity, pi.unit_price, pi.subtotal,
        pr.name as product_name
      FROM "${schemaName}".purchase_items pi
      JOIN "${schemaName}".products pr ON pr.id = pi.product_id
      WHERE pi.purchase_id = $1
      ORDER BY pi.created_at ASC
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
      purchasedAt: new Date(row.purchased_at).toISOString(),
      supplier: {
        id: row.supplier_id ?? '',
        name: row.supplier_name ?? '',
        document: row.supplier_document ?? null,
        documentType: row.supplier_document_type ?? null,
      },
      operator: {
        id: row.operator_id ?? '',
        name: row.operator_name ?? '',
      },
      paymentMethod: row.payment_method,
      notes: row.notes,
      total,
      items: mappedItems,
    };
  });
}
```

- [ ] **Step 3.4: Run the tests and confirm they pass**

Run: `pnpm --filter backend test -- src/modules/recycling/purchases/purchases.service.spec.ts`
Expected: PASS — `getById` tests green, `list` + `create` still green.

- [ ] **Step 3.5: Expose the controller route**

Edit `apps/backend/src/modules/recycling/purchases/purchases.controller.ts`. Import `Param` from `@nestjs/common`:

```typescript
import { Body, Controller, Get, Param, Post, Query, Request, UseGuards } from '@nestjs/common';
```

Then add a new handler after `list` and before `create`:

```typescript
@Get(':id')
@RequirePermission('canViewStock')
getById(@Request() req: RequestWithUser, @Param('id') id: string) {
  return this.purchasesService.getById(req.user.tenantId, id);
}
```

- [ ] **Step 3.6: Commit**

```bash
git add apps/backend/src/modules/recycling/purchases/purchases.service.ts \
        apps/backend/src/modules/recycling/purchases/purchases.controller.ts \
        apps/backend/src/modules/recycling/purchases/purchases.service.spec.ts
git commit --no-gpg-sign -m "$(cat <<'EOF'
feat(recycling/purchases): add GET /purchases/:id with full detail

Returns purchase with items joined to products, supplier metadata
(name + document + documentType), operator name via cross-schema
JOIN to public.users, payment method and notes. 404 when missing.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Frontend — reports service type + hook for purchases summary

**Files:**
- Modify: `apps/frontend/src/services/recycling/reports.service.ts`
- Modify: `apps/frontend/src/hooks/recycling/useReports.ts`

- [ ] **Step 4.1: Add `PurchasesSummary` type and service method**

Edit `apps/frontend/src/services/recycling/reports.service.ts`. Add a new type right after the `SalesSummary` interface:

```typescript
export interface PurchasesSummary {
  today: { total: number; count: number };
  week: { total: number; count: number };
  month: { total: number; count: number };
}
```

Then add a new method at the end of the `reportsService` object (after `getSalesSummary`, before the closing brace):

```typescript
  async getPurchasesSummary(): Promise<PurchasesSummary> {
    const { data } = await api.get<PurchasesSummary>('/recycling/reports/purchases-summary');
    return data;
  },
```

- [ ] **Step 4.2: Add `usePurchasesSummary` hook**

Edit `apps/frontend/src/hooks/recycling/useReports.ts`. Update the imports line to include `PurchasesSummary`:

```typescript
import { reportsService, type DashboardSummary, type PurchasePeriodEntry, type TopMaterial, type SalesSummary, type PurchasesSummary } from '../../services/recycling/reports.service';
```

Then append a new hook at the end of the file:

```typescript
export function usePurchasesSummary() {
  const [summary, setSummary] = useState<PurchasesSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(() => {
    setLoading(true);
    setError(null);
    reportsService.getPurchasesSummary()
      .then(setSummary)
      .catch(() => setError('Erro ao carregar resumo de compras'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  return { summary, loading, error, refetch };
}
```

- [ ] **Step 4.3: Type-check**

Run: `cd apps/frontend && npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 4.4: Commit**

```bash
git add apps/frontend/src/services/recycling/reports.service.ts \
        apps/frontend/src/hooks/recycling/useReports.ts
git commit --no-gpg-sign -m "$(cat <<'EOF'
feat(recycling/reports): purchases-summary frontend service and hook

Adds PurchasesSummary type, getPurchasesSummary() method and
usePurchasesSummary() hook. Consumed by the Compras KPI grid.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Frontend — retype purchases service + hook, add `getById`

This task changes the shape of `Purchase` → `PurchaseListItem`. The current `PurchasesPage` reads `p.totalAmount`; the new type exposes it as `p.total`. We patch the page minimally in this task (just the one field) so the project type-checks cleanly; the full redesign happens in Task 7.

**Files:**
- Modify: `apps/frontend/src/services/recycling/purchases.service.ts`
- Modify: `apps/frontend/src/hooks/recycling/usePurchases.ts`
- Modify: `apps/frontend/src/pages/recycling/purchases/PurchasesPage.tsx` (minimal adjustment only)

- [ ] **Step 5.1: Confirm no unexpected callers of `purchasesService.list` or `Purchase`**

Run: `cd /home/vinicius/Projetos/vinicius/praktikus && grep -rn "purchasesService\\.list\\|from .*purchases\\.service" apps/frontend/src | grep -v "purchases\\.service\\.ts"`
Expected output contains only:
- `apps/frontend/src/hooks/recycling/usePurchases.ts` (we'll patch it)
- `apps/frontend/src/pages/recycling/purchases/PurchasesPage.tsx` (we'll patch it)
- `apps/frontend/src/pages/recycling/purchases/NewPurchasePage.tsx` — this uses `purchasesService.create`, not `list`, so it's safe.

If anything else appears, pause and inspect — those consumers must be adjusted in this task too.

- [ ] **Step 5.2: Rewrite `purchases.service.ts` with new types**

Replace the full contents of `apps/frontend/src/services/recycling/purchases.service.ts` with:

```typescript
import { api } from '../api';
import { PaymentMethod } from '@praktikus/shared';

export { PaymentMethod };

export interface PurchaseListItem {
  id: string;
  purchasedAt: string;
  supplierId: string;
  supplierName: string;
  paymentMethod: PaymentMethod;
  total: number;
  itemCount: number;
  firstProductName: string | null;
  totalKg: number;
  notes: string | null;
}

export interface PurchaseDetail {
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
}

export interface CreatePurchasePayload {
  supplierId: string;
  paymentMethod: PaymentMethod;
  items: Array<{ productId: string; quantity: number; unitPrice: number }>;
  notes?: string;
}

export const purchasesService = {
  async list(page = 1, limit = 20): Promise<{ data: PurchaseListItem[]; total: number; page: number; limit: number }> {
    const { data } = await api.get('/recycling/purchases', { params: { page, limit } });
    return data;
  },
  async getById(id: string): Promise<PurchaseDetail> {
    const { data } = await api.get<PurchaseDetail>(`/recycling/purchases/${id}`);
    return data;
  },
  async create(payload: CreatePurchasePayload): Promise<{ id: string }> {
    const { data } = await api.post<{ id: string }>('/recycling/purchases', payload);
    return data;
  },
};
```

Note: `create` return type changed from `Purchase` to `{ id: string }` because the POST response body is now of a different shape (the enriched list item). `NewPurchasePage` only uses the response's `id` for navigation — confirm in next step.

- [ ] **Step 5.3: Verify `NewPurchasePage` only reads `id` from `create()` response**

Run: `cd /home/vinicius/Projetos/vinicius/praktikus && grep -n "purchasesService\\.create\\|\\.create(" apps/frontend/src/pages/recycling/purchases/NewPurchasePage.tsx`
Expected: the result of `create()` is only used for `.id` (for navigation). If it uses any other field, adjust the service type accordingly.

- [ ] **Step 5.4: Retype `usePurchases` hook**

Replace the full contents of `apps/frontend/src/hooks/recycling/usePurchases.ts` with:

```typescript
import { useState, useEffect, useCallback } from 'react';
import { purchasesService, type PurchaseListItem } from '../../services/recycling/purchases.service';

export function usePurchases(page: number, limit = 20) {
  const [purchases, setPurchases] = useState<PurchaseListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    purchasesService.list(page, limit)
      .then((res) => {
        setPurchases(res.data);
        setTotal(res.total);
      })
      .catch(() => setError('Erro ao carregar compras'))
      .finally(() => setLoading(false));
  }, [page, limit]);

  useEffect(() => { load(); }, [load]);

  return { purchases, total, loading, error, reload: load };
}
```

- [ ] **Step 5.5: Minimal adjustment of `PurchasesPage.tsx` to keep type-check green**

The only field-rename impact in the existing page is `p.totalAmount` → `p.total`. Open `apps/frontend/src/pages/recycling/purchases/PurchasesPage.tsx` and find this block around line 361:

```typescript
                    <CTableDataCell
                      style={{
                        textAlign: 'right',
                        fontVariantNumeric: 'tabular-nums',
                        fontWeight: 600,
                        color: 'var(--cui-body-color)',
                      }}
                    >
                      {formatCurrency(p.totalAmount)}
                    </CTableDataCell>
```

Replace the `{formatCurrency(p.totalAmount)}` line with:

```typescript
                      {formatCurrency(p.total)}
```

No other changes in this step. The full redesign happens in Task 7.

- [ ] **Step 5.6: Type-check**

Run: `cd apps/frontend && npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 5.7: Commit**

```bash
git add apps/frontend/src/services/recycling/purchases.service.ts \
        apps/frontend/src/hooks/recycling/usePurchases.ts \
        apps/frontend/src/pages/recycling/purchases/PurchasesPage.tsx
git commit --no-gpg-sign -m "$(cat <<'EOF'
feat(recycling/purchases): frontend types and getById method

Purchase → PurchaseListItem (enriched). Adds PurchaseDetail and
getById() mirroring the sales service. Adapts PurchasesPage only
for the totalAmount → total rename; full redesign follows.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Frontend — `PurchaseDetailModal` component

**Files:**
- Create: `apps/frontend/src/pages/recycling/purchases/PurchaseDetailModal.tsx`

- [ ] **Step 6.1: Create the component**

Create `apps/frontend/src/pages/recycling/purchases/PurchaseDetailModal.tsx` with:

```tsx
import { useEffect, useState } from 'react';
import {
  CModal, CModalBody, CModalFooter, CModalHeader, CModalTitle,
  CButton, CSpinner, CAlert,
  CTable, CTableBody, CTableDataCell, CTableHead, CTableHeaderCell, CTableRow,
} from '@coreui/react';
import { purchasesService, type PurchaseDetail } from '../../../services/recycling/purchases.service';

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

const PAYMENT_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  CASH: { label: 'Dinheiro', color: '#16a34a', bg: 'rgba(22, 163, 74, 0.12)' },
  PIX: { label: 'PIX', color: 'var(--cui-primary)', bg: 'rgba(52, 142, 145, 0.12)' },
  CARD: { label: 'Cartão', color: '#6b7280', bg: 'rgba(107, 114, 128, 0.12)' },
};

function PaymentBadge({ method }: { method: string }) {
  const c = PAYMENT_CONFIG[method] ?? PAYMENT_CONFIG.CARD;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '3px 10px',
        borderRadius: 999,
        fontSize: 11.5,
        fontWeight: 600,
        color: c.color,
        background: c.bg,
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.color, flexShrink: 0 }} />
      {c.label}
    </span>
  );
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

export function PurchaseDetailModal({
  purchaseId,
  onClose,
}: {
  purchaseId: string | null;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<PurchaseDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!purchaseId) { setDetail(null); return; }
    setLoading(true);
    setError(null);
    purchasesService.getById(purchaseId)
      .then(setDetail)
      .catch((e) => {
        if (e?.response?.status === 404) setError('Compra não encontrada.');
        else setError('Erro ao carregar compra.');
      })
      .finally(() => setLoading(false));
  }, [purchaseId]);

  const open = !!purchaseId;
  const shortId = detail ? `#${detail.id.slice(0, 8).toUpperCase()}` : '';

  return (
    <CModal visible={open} onClose={onClose} size="lg" alignment="center">
      <CModalHeader>
        <CModalTitle>Compra {shortId}</CModalTitle>
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
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 16,
              marginBottom: 20,
            }}>
              <Field
                label="Fornecedor"
                value={
                  <>
                    <div>{detail.supplier.name || '—'}</div>
                    {detail.supplier.document && (
                      <div style={{ fontSize: 12, color: 'var(--cui-secondary-color)' }}>
                        {formatDocument(detail.supplier.document, detail.supplier.documentType)}
                      </div>
                    )}
                  </>
                }
              />
              <Field
                label="Data/Hora"
                value={new Date(detail.purchasedAt).toLocaleString('pt-BR')}
              />
              <Field label="Operador" value={detail.operator.name || '—'} />
              <Field label="Pagamento" value={<PaymentBadge method={detail.paymentMethod} />} />
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

- [ ] **Step 6.2: Type-check**

Run: `cd apps/frontend && npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 6.3: Commit**

```bash
git add apps/frontend/src/pages/recycling/purchases/PurchaseDetailModal.tsx
git commit --no-gpg-sign -m "$(cat <<'EOF'
feat(recycling/purchases): PurchaseDetailModal component

Shows supplier (with formatted CPF/CNPJ), date, operator, payment
method badge, total, purchase items table, and optional notes.
Fetches via purchasesService.getById(). Mirrors SaleDetailModal.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Frontend — redesign `PurchasesPage`

**Files:**
- Modify: `apps/frontend/src/pages/recycling/purchases/PurchasesPage.tsx`

- [ ] **Step 7.1: Replace the full page**

Replace the **entire contents** of `apps/frontend/src/pages/recycling/purchases/PurchasesPage.tsx` with:

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
import { cilPlus, cilSearch, cilBasket, cilArrowTop } from '@coreui/icons';
import { usePurchases } from '../../../hooks/recycling/usePurchases';
import { usePurchasesSummary } from '../../../hooks/recycling/useReports';
import { PurchaseDetailModal } from './PurchaseDetailModal';

type PaymentFilter = 'all' | 'CASH' | 'PIX' | 'CARD';

const PAYMENT_FILTERS: { value: PaymentFilter; label: string }[] = [
  { value: 'all', label: 'Todas' },
  { value: 'CASH', label: 'Dinheiro' },
  { value: 'PIX', label: 'PIX' },
  { value: 'CARD', label: 'Cartão' },
];

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

const PAYMENT_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  CASH: { label: 'Dinheiro', color: '#16a34a', bg: 'rgba(22, 163, 74, 0.12)' },
  PIX: { label: 'PIX', color: 'var(--cui-primary)', bg: 'rgba(52, 142, 145, 0.12)' },
  CARD: { label: 'Cartão', color: '#6b7280', bg: 'rgba(107, 114, 128, 0.12)' },
};

function PaymentBadge({ method }: { method: string }) {
  const c = PAYMENT_CONFIG[method] ?? PAYMENT_CONFIG.CARD;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '3px 10px',
        borderRadius: 999,
        fontSize: 11.5,
        fontWeight: 600,
        color: c.color,
        background: c.bg,
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.color, flexShrink: 0 }} />
      {c.label}
    </span>
  );
}

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

export function PurchasesPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const limit = 20;
  const { purchases, total, loading, error } = usePurchases(page, limit);
  const { summary, loading: summaryLoading } = usePurchasesSummary();

  const [search, setSearch] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return purchases.filter((p) => {
      if (paymentFilter !== 'all' && p.paymentMethod !== paymentFilter) return false;
      if (q) {
        const hay = `${p.id} ${p.supplierName} ${p.notes ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [purchases, paymentFilter, search]);

  const totalPages = Math.ceil(total / limit) || 1;
  const shownFrom = total === 0 ? 0 : (page - 1) * limit + 1;
  const shownTo = Math.min(page * limit, total);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Page head */}
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
            Compras
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13.5, color: 'var(--cui-secondary-color)' }}>
            {total > 0
              ? `${total} ${total === 1 ? 'compra registrada' : 'compras registradas'}`
              : 'Registre entradas de material comprado de fornecedores.'}
          </p>
        </div>
        <CButton
          color="primary"
          onClick={() => navigate('/recycling/purchases/new')}
          style={{ borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <CIcon icon={cilPlus} size="sm" /> Nova compra
        </CButton>
      </div>

      {/* KPI grid */}
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
          sub={`${summary?.today.count ?? 0} ${(summary?.today.count ?? 0) === 1 ? 'compra' : 'compras'}`}
          loading={summaryLoading}
        />
        <KpiCard
          label="Semana"
          value={formatCurrency(summary?.week.total ?? 0)}
          sub={`${summary?.week.count ?? 0} ${(summary?.week.count ?? 0) === 1 ? 'compra' : 'compras'}`}
          loading={summaryLoading}
        />
        <KpiCard
          label="Mês"
          value={formatCurrency(summary?.month.total ?? 0)}
          sub={`${summary?.month.count ?? 0} ${(summary?.month.count ?? 0) === 1 ? 'compra' : 'compras'}`}
          loading={summaryLoading}
        />
      </div>

      {error && <CAlert color="danger" className="mb-0">{error}</CAlert>}

      {/* Table card */}
      <div className="pk-table-card">
        <div className="pk-table-toolbar" style={{ flexWrap: 'wrap' }}>
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
              placeholder="Buscar por fornecedor, material ou ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: 36 }}
              size="sm"
              aria-label="Buscar compras"
            />
          </div>

          <div
            style={{
              display: 'inline-flex',
              gap: 2,
              padding: 3,
              background: 'var(--cui-card-cap-bg)',
              border: '1px solid var(--cui-border-color)',
              borderRadius: 10,
              flexWrap: 'wrap',
            }}
          >
            {PAYMENT_FILTERS.map((f) => {
              const active = paymentFilter === f.value;
              const count =
                f.value === 'all'
                  ? purchases.length
                  : purchases.filter((p) => p.paymentMethod === f.value).length;
              return (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setPaymentFilter(f.value)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '4px 10px',
                    border: 0,
                    borderRadius: 7,
                    background: active ? 'var(--cui-card-bg)' : 'transparent',
                    color: active ? 'var(--cui-body-color)' : 'var(--cui-secondary-color)',
                    fontSize: 12.5,
                    fontWeight: active ? 600 : 500,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    boxShadow: active ? '0 1px 2px rgba(10,12,13,0.06)' : 'none',
                    transition: 'all 0.12s',
                  }}
                >
                  {f.label}
                  {count > 0 && (
                    <span
                      style={{
                        fontSize: 10.5,
                        padding: '1px 5px',
                        borderRadius: 999,
                        fontWeight: 700,
                        background: active ? 'rgba(52,142,145,0.12)' : 'rgba(107,114,128,0.12)',
                        color: active ? 'var(--cui-primary)' : 'var(--cui-secondary-color)',
                      }}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <CTable hover responsive className="mb-0">
          <CTableHead>
            <CTableRow>
              <CTableHeaderCell>ID</CTableHeaderCell>
              <CTableHeaderCell>Data</CTableHeaderCell>
              <CTableHeaderCell>Fornecedor</CTableHeaderCell>
              <CTableHeaderCell>Material</CTableHeaderCell>
              <CTableHeaderCell>Pagamento</CTableHeaderCell>
              <CTableHeaderCell style={{ textAlign: 'right' }}>Total</CTableHeaderCell>
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
                      <CIcon icon={cilBasket} size="lg" style={{ color: 'var(--cui-primary)' }} />
                    </div>
                    <div style={{ fontWeight: 600, color: 'var(--cui-body-color)' }}>
                      {purchases.length === 0 ? 'Nenhuma compra ainda' : 'Nenhum resultado'}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--cui-secondary-color)' }}>
                      {purchases.length === 0
                        ? 'Registre a primeira compra para começar.'
                        : 'Tente ajustar a busca ou o filtro.'}
                    </div>
                  </div>
                </CTableDataCell>
              </CTableRow>
            ) : (
              filtered.map((p) => (
                <CTableRow
                  key={p.id}
                  style={{ cursor: 'pointer' }}
                  onClick={() => setSelectedId(p.id)}
                >
                  <CTableDataCell style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 12,
                    color: 'var(--cui-body-color)',
                    fontWeight: 600,
                  }}>
                    #{p.id.slice(0, 8).toUpperCase()}
                  </CTableDataCell>
                  <CTableDataCell>
                    <div style={{ fontSize: 13, color: 'var(--cui-body-color)', fontVariantNumeric: 'tabular-nums' }}>
                      {formatDate(p.purchasedAt)}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--cui-secondary-color)', fontVariantNumeric: 'tabular-nums' }}>
                      {formatTime(p.purchasedAt)}
                    </div>
                  </CTableDataCell>
                  <CTableDataCell>
                    {p.supplierName ? (
                      <span style={{ fontWeight: 500, color: 'var(--cui-body-color)' }}>{p.supplierName}</span>
                    ) : (
                      <span style={{ color: 'var(--cui-secondary-color)' }}>—</span>
                    )}
                  </CTableDataCell>
                  <CTableDataCell>
                    <span style={{ fontSize: 13, color: 'var(--cui-body-color)' }}>
                      {materialSummary(p)}
                    </span>
                  </CTableDataCell>
                  <CTableDataCell>
                    <PaymentBadge method={p.paymentMethod} />
                  </CTableDataCell>
                  <CTableDataCell style={{
                    textAlign: 'right',
                    fontWeight: 700,
                    fontVariantNumeric: 'tabular-nums',
                    color: 'var(--cui-primary)',
                  }}>
                    {formatCurrency(p.total)}
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

      <PurchaseDetailModal purchaseId={selectedId} onClose={() => setSelectedId(null)} />
    </div>
  );
}
```

- [ ] **Step 7.2: Type-check**

Run: `cd apps/frontend && npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 7.3: Boot the dev environment and smoke-test**

The engineer runs the app (`docker-compose up` if needed, plus `pnpm --filter frontend dev`) and verifies:

- `/recycling/purchases` loads with the new layout: title, 3 KPI cards, toolbar with search + payment pills, 6-column table, footer pagination.
- Clicking any row opens the `PurchaseDetailModal` showing supplier (with formatted CPF/CNPJ when present), date, operator, payment badge, total, items, and notes if any.
- Payment filter pills still filter rows correctly.
- Empty state appears when there are zero compras; "Nenhum resultado" appears when search/filter produces zero rows.
- KPIs reflect real data: create one compra today, verify `Hoje` count and total update after a refresh.

If anything is off, stop and investigate before committing. Document the finding in the PR.

- [ ] **Step 7.4: Commit**

```bash
git add apps/frontend/src/pages/recycling/purchases/PurchasesPage.tsx
git commit --no-gpg-sign -m "$(cat <<'EOF'
feat(recycling/purchases): redesign page with KPIs, enriched table and detail modal

Adds Hoje/Semana/Mês KPI grid using purchases-summary endpoint.
New Material column shows '{product} · {kg}kg' or '{n} materiais
· {total}kg'. Row click opens PurchaseDetailModal. Payment filter
pills and badge column preserved.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Final checks

- [ ] **Full backend test suite**

Run: `pnpm --filter backend test`
Expected: all green.

- [ ] **Full frontend type-check**

Run: `cd apps/frontend && npx tsc --noEmit`
Expected: exit 0.

- [ ] **Full frontend test suite** (sanity check — no tests added by this plan, but make sure nothing else broke)

Run: `pnpm --filter frontend test`
Expected: all green.

- [ ] **Lint pass**

Run: `pnpm lint`
Expected: clean or only pre-existing warnings.

- [ ] **Commit-log review**

Run: `git log --oneline main..HEAD`
Expected: the 7 task commits are present in order, with clear `feat(...)` messages, plus the design-doc commit that already exists (`ad79f72`).
