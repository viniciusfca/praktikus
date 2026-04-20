# Recycling Dashboard Completion — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the two missing sections of the Recycling dashboard — Top Materials ranking and Coletas (collection appointments with weekly calendar, list view, drawer, comments, and dashboard widget).

**Architecture:** Two sequential phases, each independently shippable. Phase 1 (Top Materials) is a single endpoint + widget. Phase 2 (Coletas) mirrors the workshop `AppointmentsModule` pattern — new domain module with entity, comments sub-feature, CRUD + status transitions, weekly calendar UI, and dashboard widget.

**Tech Stack:** NestJS + TypeORM + class-validator (backend), React 19 + CoreUI + react-hook-form + zod + Chart.js (frontend), PostgreSQL schema-per-tenant, pnpm monorepo with `@praktikus/shared` for cross-package types.

**Spec:** [docs/plans/2026-04-19-recycling-dashboard-completion-design.md](2026-04-19-recycling-dashboard-completion-design.md)

---

## File Structure

### Phase 1 — Top Materials

**Create:**
- `apps/backend/src/modules/recycling/reports/dto/top-materials-query.dto.ts`
- `packages/shared/src/types/top-material.ts`

**Modify:**
- `apps/backend/src/modules/recycling/reports/reports.service.ts` — add `getTopMaterials`, extend `getDashboardSummary`
- `apps/backend/src/modules/recycling/reports/reports.controller.ts` — add GET route
- `apps/backend/src/modules/recycling/reports/reports.service.spec.ts` — add tests
- `packages/shared/src/index.ts` — export new type
- `apps/frontend/src/services/recycling/reports.service.ts` — add `getTopMaterials`, extend `DashboardSummary`
- `apps/frontend/src/hooks/recycling/useReports.ts` — add `useTopMaterials`
- `apps/frontend/src/pages/recycling/DashboardPage.tsx` — add Top Materials widget, rename KPI to "Compras (mês)"

### Phase 2 — Coletas

**Create (backend):**
- `packages/shared/src/enums/coleta-status.enum.ts`
- `packages/shared/src/types/coleta.ts`
- `apps/backend/src/modules/recycling/coletas/coleta.entity.ts`
- `apps/backend/src/modules/recycling/coletas/coleta-comment.entity.ts`
- `apps/backend/src/modules/recycling/coletas/dto/create-coleta.dto.ts`
- `apps/backend/src/modules/recycling/coletas/dto/update-coleta.dto.ts`
- `apps/backend/src/modules/recycling/coletas/dto/update-status.dto.ts`
- `apps/backend/src/modules/recycling/coletas/dto/list-coletas-query.dto.ts`
- `apps/backend/src/modules/recycling/coletas/dto/create-coleta-comment.dto.ts`
- `apps/backend/src/modules/recycling/coletas/coletas.service.ts`
- `apps/backend/src/modules/recycling/coletas/coletas.service.spec.ts`
- `apps/backend/src/modules/recycling/coletas/coletas.controller.ts`
- `apps/backend/src/modules/recycling/coletas/coleta-comments.service.ts`
- `apps/backend/src/modules/recycling/coletas/coleta-comments.service.spec.ts`
- `apps/backend/src/modules/recycling/coletas/coleta-comments.controller.ts`
- `apps/backend/src/modules/recycling/coletas/coletas.module.ts`
- `apps/backend/src/database/migrations/1746000000000-AddColetasToRecyclingTenants.ts`

**Modify (backend):**
- `apps/backend/src/database/tenant-migrations/create-tenant-tables.ts` — add `coletas` + `coleta_comments` tables and `can_manage_coletas` column
- `apps/backend/src/modules/recycling/employees/employee-permissions.entity.ts` — add `canManageColetas` field
- `apps/backend/src/modules/recycling/recycling.module.ts` — register `ColetasModule`
- `packages/shared/src/index.ts` — export new enum + types

**Create (frontend):**
- `apps/frontend/src/services/recycling/coletas.service.ts`
- `apps/frontend/src/hooks/recycling/useColetas.ts`
- `apps/frontend/src/pages/recycling/coletas/ColetasPage.tsx`
- `apps/frontend/src/pages/recycling/coletas/ColetaFormDialog.tsx`
- `apps/frontend/src/pages/recycling/coletas/ColetaDrawer.tsx`

**Modify (frontend):**
- `apps/frontend/src/App.tsx` — add `coletas` route
- `apps/frontend/src/layouts/RecyclingLayout.tsx` — add sidebar item
- `apps/frontend/src/pages/recycling/DashboardPage.tsx` — add "Próximas coletas" widget

---

## Phase 1 — Top Materials

### Task 1: Shared type for TopMaterial

**Files:**
- Create: `packages/shared/src/types/top-material.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Create type file**

File: `packages/shared/src/types/top-material.ts`

```typescript
export interface TopMaterial {
  productId: string;
  name: string;
  volumeKg: number;
  avgPricePerKg: number;
  changePct: number | null;
}
```

- [ ] **Step 2: Export from index**

Modify `packages/shared/src/index.ts` — add after the last `export *` line:

```typescript
export * from './types/top-material';
```

- [ ] **Step 3: Build shared package**

Run: `pnpm --filter @praktikus/shared build`
Expected: tsc emits `dist/` without errors.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/types/top-material.ts packages/shared/src/index.ts
git commit -m "feat(shared): add TopMaterial type"
```

---

### Task 2: Backend DTO for top-materials query

**Files:**
- Create: `apps/backend/src/modules/recycling/reports/dto/top-materials-query.dto.ts`

- [ ] **Step 1: Create DTO**

File: `apps/backend/src/modules/recycling/reports/dto/top-materials-query.dto.ts`

```typescript
import { IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class TopMaterialsQueryDto {
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}$/, { message: 'month must be YYYY-MM format' })
  month?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/backend/src/modules/recycling/reports/dto/top-materials-query.dto.ts
git commit -m "feat(recycling/reports): add TopMaterialsQueryDto"
```

---

### Task 3: Backend — getTopMaterials service method + tests

**Files:**
- Modify: `apps/backend/src/modules/recycling/reports/reports.service.ts`
- Modify: `apps/backend/src/modules/recycling/reports/reports.service.spec.ts`

- [ ] **Step 1: Write failing tests first**

Modify `apps/backend/src/modules/recycling/reports/reports.service.spec.ts` — append this `describe` block inside the outer `describe('RecyclingReportsService')`:

```typescript
  describe('getTopMaterials', () => {
    it('should throw on invalid tenantId', async () => {
      await expect(service.getTopMaterials('bad-id')).rejects.toThrow('Invalid tenantId');
    });

    it('should return top materials for current month with change vs previous', async () => {
      mockQueryRunner.query.mockImplementation(async (sql: string) => {
        if (sql.includes('SET LOCAL')) return undefined;
        if (sql.includes("date_trunc('month', CURRENT_DATE)")) {
          return [
            { product_id: 'p1', name: 'Alumínio', volume_kg: '820.0000', avg_price: '8.5000' },
            { product_id: 'p2', name: 'PET', volume_kg: '640.0000', avg_price: '2.2000' },
          ];
        }
        if (sql.includes("date_trunc('month', CURRENT_DATE) - interval")) {
          return [
            { product_id: 'p1', volume_kg: '720.0000' },
          ];
        }
        return [];
      });

      const result = await service.getTopMaterials(TENANT);
      expect(result).toHaveLength(2);
      expect(result[0].productId).toBe('p1');
      expect(result[0].volumeKg).toBe(820);
      expect(result[0].avgPricePerKg).toBe(8.5);
      expect(result[0].changePct).toBeCloseTo(13.9, 1);
      expect(result[1].changePct).toBeNull();
    });

    it('should accept explicit month parameter', async () => {
      const queries: string[] = [];
      mockQueryRunner.query.mockImplementation(async (sql: string) => {
        queries.push(sql);
        if (sql.includes('SET LOCAL')) return undefined;
        return [];
      });

      await service.getTopMaterials(TENANT, '2026-03', 10);
      const monthQuery = queries.find((q) => q.includes("'2026-03-01'"));
      expect(monthQuery).toBeDefined();
      expect(queries.some((q) => q.includes('LIMIT 10'))).toBe(true);
    });

    it('should return empty array when no purchases in month', async () => {
      mockQueryRunner.query.mockImplementation(async (sql: string) => {
        if (sql.includes('SET LOCAL')) return undefined;
        return [];
      });

      const result = await service.getTopMaterials(TENANT);
      expect(result).toEqual([]);
    });
  });
```

- [ ] **Step 2: Run tests to confirm they fail**

Run: `pnpm --filter backend test -- reports.service.spec.ts`
Expected: `getTopMaterials` tests fail (method doesn't exist).

- [ ] **Step 3: Implement `getTopMaterials` in service**

Modify `apps/backend/src/modules/recycling/reports/reports.service.ts` — add this method at the end of the class, before the closing brace:

```typescript
  async getTopMaterials(
    tenantId: string,
    month?: string,
    limit: number = 5,
  ): Promise<Array<{
    productId: string;
    name: string;
    volumeKg: number;
    avgPricePerKg: number;
    changePct: number | null;
  }>> {
    const schemaName = this.getSchemaName(tenantId);
    return this.withQueryRunner(tenantId, async (qr) => {
      const safeLimit = Math.max(1, Math.min(20, Math.floor(limit)));

      const monthStartExpr = month
        ? `'${month}-01'::date`
        : `date_trunc('month', CURRENT_DATE)`;
      const monthEndExpr = month
        ? `('${month}-01'::date + interval '1 month')`
        : `(date_trunc('month', CURRENT_DATE) + interval '1 month')`;
      const prevMonthStartExpr = month
        ? `('${month}-01'::date - interval '1 month')`
        : `(date_trunc('month', CURRENT_DATE) - interval '1 month')`;
      const prevMonthEndExpr = month
        ? `'${month}-01'::date`
        : `date_trunc('month', CURRENT_DATE)`;

      const currentRows: Array<{
        product_id: string;
        name: string;
        volume_kg: string;
        avg_price: string;
      }> = await qr.query(`
        SELECT
          p.id as product_id,
          p.name as name,
          SUM(pi.quantity) as volume_kg,
          CASE WHEN SUM(pi.quantity) > 0
               THEN SUM(pi.subtotal) / SUM(pi.quantity)
               ELSE 0
          END as avg_price
        FROM "${schemaName}".purchase_items pi
        JOIN "${schemaName}".purchases pu ON pu.id = pi.purchase_id
        JOIN "${schemaName}".products p ON p.id = pi.product_id
        WHERE pu.purchased_at >= ${monthStartExpr}
          AND pu.purchased_at < ${monthEndExpr}
        GROUP BY p.id, p.name
        ORDER BY SUM(pi.quantity) DESC
        LIMIT ${safeLimit}
      `);

      if (currentRows.length === 0) return [];

      const prevRows: Array<{ product_id: string; volume_kg: string }> = await qr.query(`
        SELECT pi.product_id as product_id, SUM(pi.quantity) as volume_kg
        FROM "${schemaName}".purchase_items pi
        JOIN "${schemaName}".purchases pu ON pu.id = pi.purchase_id
        WHERE pu.purchased_at >= ${prevMonthStartExpr}
          AND pu.purchased_at < ${prevMonthEndExpr}
          AND pi.product_id = ANY($1)
        GROUP BY pi.product_id
      `, [currentRows.map((r) => r.product_id)]);

      const prevMap = new Map(prevRows.map((r) => [r.product_id, Number(r.volume_kg)]));

      return currentRows.map((r) => {
        const current = Number(r.volume_kg);
        const prev = prevMap.get(r.product_id);
        const changePct = prev && prev > 0
          ? Math.round(((current - prev) / prev) * 1000) / 10
          : null;
        return {
          productId: r.product_id,
          name: r.name,
          volumeKg: current,
          avgPricePerKg: Number(r.avg_price),
          changePct,
        };
      });
    });
  }
```

- [ ] **Step 4: Run tests to confirm they pass**

Run: `pnpm --filter backend test -- reports.service.spec.ts`
Expected: All tests (existing + new `getTopMaterials`) pass.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/recycling/reports/reports.service.ts apps/backend/src/modules/recycling/reports/reports.service.spec.ts
git commit -m "feat(recycling/reports): add getTopMaterials service"
```

---

### Task 4: Backend — controller route for top-materials

**Files:**
- Modify: `apps/backend/src/modules/recycling/reports/reports.controller.ts`

- [ ] **Step 1: Add the new endpoint**

Modify `apps/backend/src/modules/recycling/reports/reports.controller.ts` — replace the existing file content with:

```typescript
import { Controller, Get, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { RolesGuard } from '../../core/auth/roles.guard';
import { Roles } from '../../core/auth/roles.decorator';
import { UserRole } from '../../core/auth/user.entity';
import { AuthUser } from '../../core/auth/jwt.strategy';
import { RecyclingReportsService } from './reports.service';
import { PeriodQueryDto } from './dto/period-query.dto';
import { TopMaterialsQueryDto } from './dto/top-materials-query.dto';

interface RequestWithUser extends Request {
  user: AuthUser;
}

@Controller('recycling/reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly reportsService: RecyclingReportsService) {}

  @Get('dashboard')
  getDashboardSummary(@Request() req: RequestWithUser) {
    return this.reportsService.getDashboardSummary(req.user.tenantId);
  }

  @Get('purchases')
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER)
  getPurchasesByPeriod(
    @Request() req: RequestWithUser,
    @Query() query: PeriodQueryDto,
  ) {
    return this.reportsService.getPurchasesByPeriod(req.user.tenantId, query.startDate, query.endDate);
  }

  @Get('top-materials')
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER)
  getTopMaterials(
    @Request() req: RequestWithUser,
    @Query() query: TopMaterialsQueryDto,
  ) {
    return this.reportsService.getTopMaterials(req.user.tenantId, query.month, query.limit);
  }
}
```

- [ ] **Step 2: Verify build**

Run: `pnpm --filter backend build`
Expected: Compiles without errors.

- [ ] **Step 3: Commit**

```bash
git add apps/backend/src/modules/recycling/reports/reports.controller.ts
git commit -m "feat(recycling/reports): add top-materials endpoint"
```

---

### Task 5: Backend — extend getDashboardSummary with monthly purchases

**Files:**
- Modify: `apps/backend/src/modules/recycling/reports/reports.service.ts`
- Modify: `apps/backend/src/modules/recycling/reports/reports.service.spec.ts`

- [ ] **Step 1: Update the existing test to expect `totalPurchasedMonth`**

Modify `apps/backend/src/modules/recycling/reports/reports.service.spec.ts` — inside `describe('getDashboardSummary')`, update the first test:

```typescript
    it('should return today totals, monthly total and cash session info', async () => {
      mockQueryRunner.query.mockImplementation(async (sql: string) => {
        if (sql.includes('SET LOCAL')) return undefined;
        if (sql.includes('CURRENT_DATE') && sql.includes('total_today')) {
          return [{ total_today: '1500.00', purchases_count: '5' }];
        }
        if (sql.includes("date_trunc('month'") && sql.includes('total_month')) {
          return [{ total_month: '14820.00', purchases_count_month: '42' }];
        }
        if (sql.includes('cash_sessions')) return [{ status: 'OPEN', opening_balance: '200.00' }];
        return [];
      });

      const result = await service.getDashboardSummary(TENANT);
      expect(result.totalPurchasedToday).toBe(1500);
      expect(result.purchasesCountToday).toBe(5);
      expect(result.totalPurchasedMonth).toBe(14820);
      expect(result.purchasesCountMonth).toBe(42);
      expect(result.cashSession?.openingBalance).toBe(200);
    });
```

And update the second test inside the same `describe`:

```typescript
    it('should return null cashSession when no open session', async () => {
      mockQueryRunner.query.mockImplementation(async (sql: string) => {
        if (sql.includes('SET LOCAL')) return undefined;
        if (sql.includes('CURRENT_DATE') && sql.includes('total_today')) {
          return [{ total_today: '0.00', purchases_count: '0' }];
        }
        if (sql.includes("date_trunc('month'") && sql.includes('total_month')) {
          return [{ total_month: '0.00', purchases_count_month: '0' }];
        }
        if (sql.includes('cash_sessions')) return [];
        return [];
      });

      const result = await service.getDashboardSummary(TENANT);
      expect(result.cashSession).toBeNull();
      expect(result.totalPurchasedMonth).toBe(0);
    });
```

- [ ] **Step 2: Run tests to confirm they fail**

Run: `pnpm --filter backend test -- reports.service.spec.ts`
Expected: `getDashboardSummary` tests fail because `totalPurchasedMonth` is undefined.

- [ ] **Step 3: Update `getDashboardSummary`**

Modify `apps/backend/src/modules/recycling/reports/reports.service.ts` — replace the `getDashboardSummary` method with:

```typescript
  async getDashboardSummary(tenantId: string): Promise<{
    totalPurchasedToday: number;
    purchasesCountToday: number;
    totalPurchasedMonth: number;
    purchasesCountMonth: number;
    cashSession: { status: string; openingBalance: number } | null;
  }> {
    const schemaName = this.getSchemaName(tenantId);
    return this.withQueryRunner(tenantId, async (qr) => {
      const [today] = await qr.query(`
        SELECT
          COALESCE(SUM(total_amount), 0) as total_today,
          COUNT(*) as purchases_count
        FROM "${schemaName}".purchases
        WHERE DATE(purchased_at) = CURRENT_DATE
      `);

      const [month] = await qr.query(`
        SELECT
          COALESCE(SUM(total_amount), 0) as total_month,
          COUNT(*) as purchases_count_month
        FROM "${schemaName}".purchases
        WHERE purchased_at >= date_trunc('month', CURRENT_DATE)
          AND purchased_at < date_trunc('month', CURRENT_DATE) + interval '1 month'
      `);

      const cashSessions = await qr.query(`
        SELECT status, opening_balance
        FROM "${schemaName}".cash_sessions
        WHERE status = 'OPEN'
        LIMIT 1
      `);

      return {
        totalPurchasedToday: Number(today.total_today),
        purchasesCountToday: Number(today.purchases_count),
        totalPurchasedMonth: Number(month.total_month),
        purchasesCountMonth: Number(month.purchases_count_month),
        cashSession: cashSessions.length > 0
          ? { status: cashSessions[0].status, openingBalance: Number(cashSessions[0].opening_balance) }
          : null,
      };
    });
  }
```

- [ ] **Step 4: Run tests to confirm they pass**

Run: `pnpm --filter backend test -- reports.service.spec.ts`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/recycling/reports/reports.service.ts apps/backend/src/modules/recycling/reports/reports.service.spec.ts
git commit -m "feat(recycling/reports): include monthly purchases in dashboard summary"
```

---

### Task 6: Frontend — reports service updates

**Files:**
- Modify: `apps/frontend/src/services/recycling/reports.service.ts`

- [ ] **Step 1: Extend reports service**

Replace `apps/frontend/src/services/recycling/reports.service.ts` entirely:

```typescript
import { api } from '../api';
import type { TopMaterial } from '@praktikus/shared';

export type { TopMaterial };

export interface DashboardSummary {
  totalPurchasedToday: number;
  purchasesCountToday: number;
  totalPurchasedMonth: number;
  purchasesCountMonth: number;
  cashSession: { status: string; openingBalance: number } | null;
}

export interface PurchasePeriodEntry {
  date: string;
  total: number;
  count: number;
}

export const reportsService = {
  async getDashboardSummary(): Promise<DashboardSummary> {
    const { data } = await api.get<DashboardSummary>('/recycling/reports/dashboard');
    return data;
  },
  async getPurchasesByPeriod(startDate: string, endDate: string): Promise<PurchasePeriodEntry[]> {
    const { data } = await api.get<PurchasePeriodEntry[]>('/recycling/reports/purchases', {
      params: { startDate, endDate },
    });
    return data;
  },
  async getTopMaterials(month?: string, limit = 5): Promise<TopMaterial[]> {
    const { data } = await api.get<TopMaterial[]>('/recycling/reports/top-materials', {
      params: { ...(month ? { month } : {}), limit },
    });
    return data;
  },
};
```

- [ ] **Step 2: Type-check**

Run: `pnpm --filter frontend build`
Expected: Compiles without errors.

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/services/recycling/reports.service.ts
git commit -m "feat(recycling/reports): frontend service for top-materials + monthly summary"
```

---

### Task 7: Frontend — useTopMaterials hook

**Files:**
- Modify: `apps/frontend/src/hooks/recycling/useReports.ts`

- [ ] **Step 1: Add hook**

Append to `apps/frontend/src/hooks/recycling/useReports.ts`:

```typescript
import type { TopMaterial } from '../../services/recycling/reports.service';

export function useTopMaterials(month?: string, limit = 5) {
  const [materials, setMaterials] = useState<TopMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(() => {
    setLoading(true);
    setError(null);
    reportsService.getTopMaterials(month, limit)
      .then(setMaterials)
      .catch(() => setError('Erro ao carregar top materiais'))
      .finally(() => setLoading(false));
  }, [month, limit]);

  useEffect(() => { refetch(); }, [refetch]);

  return { materials, loading, error, refetch };
}
```

Note: `useState`, `useEffect`, `useCallback` and `reportsService` are already imported at the top of the file; `TopMaterial` is the one new import — merge with existing imports so the file has one import from `'../../services/recycling/reports.service'`.

- [ ] **Step 2: Commit**

```bash
git add apps/frontend/src/hooks/recycling/useReports.ts
git commit -m "feat(recycling/reports): useTopMaterials hook"
```

---

### Task 8: Frontend — Top Materials widget + Compras (mês) KPI

**Files:**
- Modify: `apps/frontend/src/pages/recycling/DashboardPage.tsx`

- [ ] **Step 1: Replace the Top Materials placeholder + KPI grid**

Modify `apps/frontend/src/pages/recycling/DashboardPage.tsx`:

At the top, update the imports section — add to the existing import from `../../hooks/recycling/useReports`:

```typescript
import { useDashboardSummary, usePurchasesByPeriod, useTopMaterials } from '../../hooks/recycling/useReports';
```

Inside the `RecyclingDashboardPage` component, after the existing `usePurchasesByPeriod` call, add:

```typescript
  const { materials: topMaterials, loading: topLoading } = useTopMaterials(undefined, 5);
```

Replace the "Compras (hoje)" `KpiCard` block with:

```tsx
        <KpiCard
          label="Compras (mês)"
          value={formatCurrency(summary?.totalPurchasedMonth ?? 0)}
          sub={`${summary?.purchasesCountMonth ?? 0} ${(summary?.purchasesCountMonth ?? 0) === 1 ? 'operação' : 'operações'}`}
          icon={cilBasket}
          tone="neutral"
        />
```

Add a new helper `TopMaterialsCard` component above `RecyclingDashboardPage`:

```tsx
const BAR_COLORS = ['#348E91', '#1f6b6e', '#0f4e51', '#8bb9bb', '#2aa198'];

function TopMaterialsCard({
  materials,
  loading,
  onSeeStock,
}: {
  materials: Array<{ productId: string; name: string; volumeKg: number; avgPricePerKg: number; changePct: number | null }>;
  loading: boolean;
  onSeeStock: () => void;
}) {
  const maxVolume = materials.reduce((m, r) => Math.max(m, r.volumeKg), 0) || 1;
  return (
    <Card padding={0}>
      <CardHeader
        title="Top materiais"
        desc="volume comprado no mês"
        action={
          <button
            type="button"
            onClick={onSeeStock}
            style={{
              border: 0,
              background: 'transparent',
              color: 'var(--cui-primary)',
              fontSize: 12.5,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Ver estoque →
          </button>
        }
      />
      <div style={{ padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 20 }}>
            <CSpinner size="sm" color="primary" />
          </div>
        )}
        {!loading && materials.length === 0 && (
          <div style={{ color: 'var(--cui-secondary-color)', fontSize: 13, padding: '12px 0' }}>
            Sem compras no mês ainda — registre uma compra para ver o ranking.
          </div>
        )}
        {!loading && materials.map((m, idx) => {
          const pct = Math.round((m.volumeKg / maxVolume) * 100);
          const delta = m.changePct;
          const deltaColor =
            delta === null ? 'var(--cui-secondary-color)'
            : delta >= 0 ? '#16a34a' : '#dc2626';
          const deltaLabel =
            delta === null ? '—'
            : `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%`;
          return (
            <div key={m.productId}>
              <div
                style={{
                  height: 3,
                  width: `${pct}%`,
                  background: BAR_COLORS[idx % BAR_COLORS.length],
                  borderRadius: 2,
                  marginBottom: 6,
                }}
              />
              <div
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  justifyContent: 'space-between',
                  gap: 10,
                  fontSize: 13,
                }}
              >
                <div style={{ fontWeight: 600, color: 'var(--cui-body-color)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {m.name}
                </div>
                <div style={{ color: 'var(--cui-secondary-color)', fontVariantNumeric: 'tabular-nums' }}>
                  {Number(m.avgPricePerKg).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/kg
                </div>
                <div style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', minWidth: 60, textAlign: 'right' }}>
                  {Math.round(m.volumeKg)} kg
                </div>
                <div style={{ color: deltaColor, fontWeight: 600, fontSize: 12, minWidth: 48, textAlign: 'right' }}>
                  {deltaLabel}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
```

Finally, below the "Chart + Caixa row" grid closing tag, add a new grid row for Top Materials:

```tsx
      {/* ── Top materials row ─────────────────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr)',
          gap: 16,
        }}
      >
        <TopMaterialsCard
          materials={topMaterials}
          loading={topLoading}
          onSeeStock={() => navigate('/recycling/stock')}
        />
      </div>
```

- [ ] **Step 2: Run dev server and verify**

Run: `pnpm --filter frontend dev` (in another terminal) and open `http://localhost:5173/recycling/dashboard`.
Expected: KPI shows "Compras (mês)" with monthly total. Top Materials card shows ranking (or empty state if no purchases this month).

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/pages/recycling/DashboardPage.tsx
git commit -m "feat(recycling/dashboard): add Top Materials widget and Compras (mês) KPI"
```

---

## Phase 2 — Coletas

### Task 9: Shared — ColetaStatus enum + Coleta types

**Files:**
- Create: `packages/shared/src/enums/coleta-status.enum.ts`
- Create: `packages/shared/src/types/coleta.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Create enum**

File: `packages/shared/src/enums/coleta-status.enum.ts`

```typescript
export enum ColetaStatus {
  AGENDADA = 'AGENDADA',
  CONCLUIDA = 'CONCLUIDA',
  CANCELADA = 'CANCELADA',
}
```

- [ ] **Step 2: Create types**

File: `packages/shared/src/types/coleta.ts`

```typescript
import { ColetaStatus } from '../enums/coleta-status.enum';

export interface Coleta {
  id: string;
  supplierId: string;
  employeeId: string | null;
  scheduledAt: string;
  status: ColetaStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ColetaComment {
  id: string;
  coletaId: string;
  texto: string;
  createdById: string;
  createdAt: string;
}
```

- [ ] **Step 3: Export from index**

Append to `packages/shared/src/index.ts`:

```typescript
export * from './enums/coleta-status.enum';
export * from './types/coleta';
```

- [ ] **Step 4: Build shared**

Run: `pnpm --filter @praktikus/shared build`
Expected: Succeeds.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/enums/coleta-status.enum.ts packages/shared/src/types/coleta.ts packages/shared/src/index.ts
git commit -m "feat(shared): add ColetaStatus enum and Coleta types"
```

---

### Task 10: Backend — Coleta + ColetaComment entities

**Files:**
- Create: `apps/backend/src/modules/recycling/coletas/coleta.entity.ts`
- Create: `apps/backend/src/modules/recycling/coletas/coleta-comment.entity.ts`

- [ ] **Step 1: Create coleta entity**

File: `apps/backend/src/modules/recycling/coletas/coleta.entity.ts`

```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { ColetaStatus } from '@praktikus/shared';

@Entity({ name: 'coletas' })
export class ColetaEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'supplier_id', type: 'uuid' })
  supplierId: string;

  @Column({ name: 'employee_id', type: 'uuid', nullable: true })
  employeeId: string | null;

  @Column({ name: 'scheduled_at', type: 'timestamptz' })
  scheduledAt: Date;

  @Column({ type: 'varchar', default: ColetaStatus.AGENDADA })
  status: ColetaStatus;

  @Column({ type: 'varchar', nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
```

- [ ] **Step 2: Create comment entity**

File: `apps/backend/src/modules/recycling/coletas/coleta-comment.entity.ts`

```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity({ name: 'coleta_comments' })
export class ColetaCommentEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'coleta_id', type: 'uuid' })
  coletaId: string;

  @Column()
  texto: string;

  @Column({ name: 'created_by_id', type: 'uuid' })
  createdById: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/backend/src/modules/recycling/coletas/coleta.entity.ts apps/backend/src/modules/recycling/coletas/coleta-comment.entity.ts
git commit -m "feat(recycling/coletas): add entities"
```

---

### Task 11: Backend — add `can_manage_coletas` permission + tenant tables

**Files:**
- Modify: `apps/backend/src/modules/recycling/employees/employee-permissions.entity.ts`
- Modify: `apps/backend/src/database/tenant-migrations/create-tenant-tables.ts`

- [ ] **Step 1: Add column to entity**

Modify `apps/backend/src/modules/recycling/employees/employee-permissions.entity.ts` — add after `canRegisterSales`:

```typescript
  @Column({ name: 'can_manage_coletas', default: true })
  canManageColetas: boolean;
```

- [ ] **Step 2: Add tables and column to tenant provisioning**

Modify `apps/backend/src/database/tenant-migrations/create-tenant-tables.ts`:

2a) In the `employee_permissions` CREATE TABLE (inside `recyclingTables` array), add the new column at the end of column list:

```sql
can_manage_coletas BOOLEAN NOT NULL DEFAULT true,
```

Replace the existing `employee_permissions` block (currently ending with `updated_at TIMESTAMPTZ DEFAULT NOW()`) with the updated version:

```typescript
    `CREATE TABLE IF NOT EXISTS "${schemaName}".employee_permissions (
      user_id UUID PRIMARY KEY,
      can_manage_suppliers BOOLEAN NOT NULL DEFAULT true,
      can_manage_buyers BOOLEAN NOT NULL DEFAULT false,
      can_manage_products BOOLEAN NOT NULL DEFAULT false,
      can_open_close_cash BOOLEAN NOT NULL DEFAULT true,
      can_view_stock BOOLEAN NOT NULL DEFAULT true,
      can_view_reports BOOLEAN NOT NULL DEFAULT false,
      can_register_purchases BOOLEAN NOT NULL DEFAULT true,
      can_register_sales BOOLEAN NOT NULL DEFAULT true,
      can_manage_coletas BOOLEAN NOT NULL DEFAULT true,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,
```

2b) Append to `recyclingTables` (after `employee_permissions`) the two new tables. Note: the codebase stores `users` in `public` schema (not per-tenant), and existing tables like `purchases.operator_id` and `cash_sessions.operator_id` use plain `UUID` columns without FK to users. We follow that pattern — `employee_id` has no FK.

```typescript
    `CREATE TABLE IF NOT EXISTS "${schemaName}".coletas (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      supplier_id UUID NOT NULL REFERENCES "${schemaName}".suppliers(id) ON DELETE RESTRICT,
      employee_id UUID,
      scheduled_at TIMESTAMPTZ NOT NULL,
      status VARCHAR NOT NULL DEFAULT 'AGENDADA',
      notes VARCHAR,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_coletas_scheduled_at ON "${schemaName}".coletas(scheduled_at)`,
    `CREATE INDEX IF NOT EXISTS idx_coletas_status ON "${schemaName}".coletas(status)`,
    `CREATE TABLE IF NOT EXISTS "${schemaName}".coleta_comments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      coleta_id UUID NOT NULL REFERENCES "${schemaName}".coletas(id) ON DELETE CASCADE,
      texto VARCHAR NOT NULL,
      created_by_id UUID NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
```

- [ ] **Step 3: Verify build**

Run: `pnpm --filter backend build`
Expected: TypeScript compiles without errors.

- [ ] **Step 4: Commit**

```bash
git add apps/backend/src/modules/recycling/employees/employee-permissions.entity.ts apps/backend/src/database/tenant-migrations/create-tenant-tables.ts
git commit -m "feat(recycling): provision coletas tables and can_manage_coletas permission"
```

---

### Task 12: Backend — migration for existing recycling tenants

**Files:**
- Create: `apps/backend/src/database/migrations/1746000000000-AddColetasToRecyclingTenants.ts`

- [ ] **Step 1: Create migration**

File: `apps/backend/src/database/migrations/1746000000000-AddColetasToRecyclingTenants.ts`

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddColetasToRecyclingTenants1746000000000 implements MigrationInterface {
  name = 'AddColetasToRecyclingTenants1746000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const tenants: Array<{ id: string }> = await queryRunner.query(
      `SELECT id FROM "public"."tenants" WHERE segment = 'RECYCLING'`,
    );

    for (const tenant of tenants) {
      const schemaName = `tenant_${tenant.id.replace(/-/g, '')}`;

      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS "${schemaName}".coletas (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          supplier_id UUID NOT NULL REFERENCES "${schemaName}".suppliers(id) ON DELETE RESTRICT,
          employee_id UUID,
          scheduled_at TIMESTAMPTZ NOT NULL,
          status VARCHAR NOT NULL DEFAULT 'AGENDADA',
          notes VARCHAR,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);
      await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_coletas_scheduled_at ON "${schemaName}".coletas(scheduled_at)`);
      await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_coletas_status ON "${schemaName}".coletas(status)`);
      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS "${schemaName}".coleta_comments (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          coleta_id UUID NOT NULL REFERENCES "${schemaName}".coletas(id) ON DELETE CASCADE,
          texto VARCHAR NOT NULL,
          created_by_id UUID NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);
      await queryRunner.query(`
        ALTER TABLE "${schemaName}".employee_permissions
        ADD COLUMN IF NOT EXISTS can_manage_coletas BOOLEAN NOT NULL DEFAULT true
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const tenants: Array<{ id: string }> = await queryRunner.query(
      `SELECT id FROM "public"."tenants" WHERE segment = 'RECYCLING'`,
    );

    for (const tenant of tenants) {
      const schemaName = `tenant_${tenant.id.replace(/-/g, '')}`;
      await queryRunner.query(`ALTER TABLE "${schemaName}".employee_permissions DROP COLUMN IF EXISTS can_manage_coletas`);
      await queryRunner.query(`DROP TABLE IF EXISTS "${schemaName}".coleta_comments`);
      await queryRunner.query(`DROP TABLE IF EXISTS "${schemaName}".coletas`);
    }
  }
}
```

- [ ] **Step 2: Run migration**

Run: `pnpm --filter backend migration:run`
Expected: `Migration AddColetasToRecyclingTenants1746000000000 has been executed successfully.`

- [ ] **Step 3: Verify schema change in a local tenant**

Open a psql shell (`docker-compose exec db psql -U postgres`) and run:

```sql
\d tenant_<your_uuid>.coletas
\d tenant_<your_uuid>.coleta_comments
SELECT can_manage_coletas FROM tenant_<your_uuid>.employee_permissions LIMIT 1;
```

Expected: Both tables exist; column `can_manage_coletas` exists.

- [ ] **Step 4: Commit**

```bash
git add apps/backend/src/database/migrations/1746000000000-AddColetasToRecyclingTenants.ts
git commit -m "feat(db): migrate existing recycling tenants to coletas tables"
```

---

### Task 13: Backend — DTOs for coletas

**Files:**
- Create: `apps/backend/src/modules/recycling/coletas/dto/create-coleta.dto.ts`
- Create: `apps/backend/src/modules/recycling/coletas/dto/update-coleta.dto.ts`
- Create: `apps/backend/src/modules/recycling/coletas/dto/update-status.dto.ts`
- Create: `apps/backend/src/modules/recycling/coletas/dto/list-coletas-query.dto.ts`
- Create: `apps/backend/src/modules/recycling/coletas/dto/create-coleta-comment.dto.ts`

- [ ] **Step 1: Create create-coleta.dto.ts**

```typescript
import { IsDateString, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateColetaDto {
  @IsUUID()
  supplierId: string;

  @IsOptional()
  @IsUUID()
  employeeId?: string | null;

  @IsDateString()
  scheduledAt: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string | null;
}
```

- [ ] **Step 2: Create update-coleta.dto.ts**

```typescript
import { IsDateString, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class UpdateColetaDto {
  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @IsOptional()
  @IsUUID()
  employeeId?: string | null;

  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string | null;
}
```

- [ ] **Step 3: Create update-status.dto.ts**

```typescript
import { IsIn } from 'class-validator';
import { ColetaStatus } from '@praktikus/shared';

export class UpdateColetaStatusDto {
  @IsIn([ColetaStatus.CONCLUIDA, ColetaStatus.CANCELADA])
  status: ColetaStatus.CONCLUIDA | ColetaStatus.CANCELADA;
}
```

- [ ] **Step 4: Create list-coletas-query.dto.ts**

```typescript
import { IsDateString, IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ColetaStatus } from '@praktikus/shared';

export class ListColetasQueryDto {
  @IsOptional()
  @IsDateString()
  start?: string;

  @IsOptional()
  @IsDateString()
  end?: string;

  @IsOptional()
  @IsIn([ColetaStatus.AGENDADA, ColetaStatus.CONCLUIDA, ColetaStatus.CANCELADA])
  status?: ColetaStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
```

- [ ] **Step 5: Create create-coleta-comment.dto.ts**

```typescript
import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateColetaCommentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  texto: string;
}
```

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/modules/recycling/coletas/dto/
git commit -m "feat(recycling/coletas): DTOs for CRUD and status"
```

---

### Task 14: Backend — ColetasService + tests

**Files:**
- Create: `apps/backend/src/modules/recycling/coletas/coletas.service.ts`
- Create: `apps/backend/src/modules/recycling/coletas/coletas.service.spec.ts`

- [ ] **Step 1: Write failing tests first**

File: `apps/backend/src/modules/recycling/coletas/coletas.service.spec.ts`

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ColetaStatus } from '@praktikus/shared';
import { ColetasService } from './coletas.service';

const mockRepo = () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn((x) => x),
  save: jest.fn(async (x) => ({ id: 'c1', ...x })),
  remove: jest.fn(),
  createQueryBuilder: jest.fn(),
});

const supplierRepo = mockRepo();
const userRepo = mockRepo();
const coletaRepo = mockRepo();

const mockQueryRunner = {
  connect: jest.fn().mockResolvedValue(undefined),
  query: jest.fn(),
  release: jest.fn().mockResolvedValue(undefined),
  manager: {
    getRepository: jest.fn((entity: { name: string }) => {
      if (entity.name === 'SupplierEntity') return supplierRepo;
      if (entity.name === 'UserEntity') return userRepo;
      if (entity.name === 'ColetaEntity') return coletaRepo;
      return mockRepo();
    }),
  },
};
const mockDataSource = { createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner) };

describe('ColetasService', () => {
  let service: ColetasService;
  const TENANT = '00000000-0000-0000-0000-000000000001';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ColetasService, { provide: DataSource, useValue: mockDataSource }],
    }).compile();
    service = module.get<ColetasService>(ColetasService);
    jest.clearAllMocks();
  });

  it('throws on invalid tenantId', async () => {
    await expect(
      service.create('bad-id', { supplierId: 'x', scheduledAt: '2026-04-20T10:00:00Z' } as any),
    ).rejects.toThrow('Invalid tenantId');
  });

  describe('create', () => {
    it('creates coleta when supplier exists', async () => {
      supplierRepo.findOne.mockResolvedValue({ id: 'sup1', name: 'S' });
      coletaRepo.save.mockResolvedValue({
        id: 'c1', supplierId: 'sup1', employeeId: null,
        scheduledAt: new Date(), status: ColetaStatus.AGENDADA, notes: null,
      });

      const result = await service.create(TENANT, {
        supplierId: 'sup1',
        scheduledAt: '2026-04-20T10:00:00Z',
      } as any);

      expect(result.id).toBe('c1');
      expect(result.status).toBe(ColetaStatus.AGENDADA);
    });

    it('throws if supplier does not exist', async () => {
      supplierRepo.findOne.mockResolvedValue(null);
      await expect(
        service.create(TENANT, { supplierId: 'missing', scheduledAt: '2026-04-20T10:00:00Z' } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws if employee is not EMPLOYEE role', async () => {
      supplierRepo.findOne.mockResolvedValue({ id: 'sup1' });
      userRepo.findOne.mockResolvedValue({ id: 'u1', role: 'OWNER' });
      await expect(
        service.create(TENANT, {
          supplierId: 'sup1', employeeId: 'u1', scheduledAt: '2026-04-20T10:00:00Z',
        } as any),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateStatus', () => {
    it('allows AGENDADA → CONCLUIDA', async () => {
      coletaRepo.findOne.mockResolvedValue({ id: 'c1', status: ColetaStatus.AGENDADA });
      coletaRepo.save.mockResolvedValue({ id: 'c1', status: ColetaStatus.CONCLUIDA });
      const result = await service.updateStatus(TENANT, 'c1', ColetaStatus.CONCLUIDA);
      expect(result.status).toBe(ColetaStatus.CONCLUIDA);
    });

    it('rejects CONCLUIDA → CANCELADA', async () => {
      coletaRepo.findOne.mockResolvedValue({ id: 'c1', status: ColetaStatus.CONCLUIDA });
      await expect(service.updateStatus(TENANT, 'c1', ColetaStatus.CANCELADA))
        .rejects.toThrow(BadRequestException);
    });

    it('404 if not found', async () => {
      coletaRepo.findOne.mockResolvedValue(null);
      await expect(service.updateStatus(TENANT, 'x', ColetaStatus.CONCLUIDA))
        .rejects.toThrow(NotFoundException);
    });
  });

  describe('delete', () => {
    it('deletes AGENDADA coleta', async () => {
      coletaRepo.findOne.mockResolvedValue({ id: 'c1', status: ColetaStatus.AGENDADA });
      await service.delete(TENANT, 'c1');
      expect(coletaRepo.remove).toHaveBeenCalled();
    });

    it('refuses to delete CONCLUIDA', async () => {
      coletaRepo.findOne.mockResolvedValue({ id: 'c1', status: ColetaStatus.CONCLUIDA });
      await expect(service.delete(TENANT, 'c1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('upcoming', () => {
    it('returns AGENDADA coletas ordered by scheduledAt ASC with limit', async () => {
      const qb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([{ id: 'c1' }, { id: 'c2' }]),
      };
      coletaRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.upcoming(TENANT, 4);
      expect(result).toHaveLength(2);
      expect(qb.where).toHaveBeenCalledWith('c.status = :status', { status: ColetaStatus.AGENDADA });
      expect(qb.orderBy).toHaveBeenCalledWith('c.scheduledAt', 'ASC');
      expect(qb.limit).toHaveBeenCalledWith(4);
    });
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

Run: `pnpm --filter backend test -- coletas.service.spec.ts`
Expected: Fails because `ColetasService` doesn't exist.

- [ ] **Step 3: Implement the service**

File: `apps/backend/src/modules/recycling/coletas/coletas.service.ts`

```typescript
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';
import { ColetaStatus } from '@praktikus/shared';
import { ColetaEntity } from './coleta.entity';
import { SupplierEntity } from '../suppliers/supplier.entity';
import { UserEntity, UserRole } from '../../core/auth/user.entity';
import { CreateColetaDto } from './dto/create-coleta.dto';
import { UpdateColetaDto } from './dto/update-coleta.dto';
import { ListColetasQueryDto } from './dto/list-coletas-query.dto';

@Injectable()
export class ColetasService {
  constructor(private readonly dataSource: DataSource) {}

  private getSchemaName(tenantId: string): string {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantId)) {
      throw new Error('Invalid tenantId');
    }
    return `tenant_${tenantId.replace(/-/g, '')}`;
  }

  private async withSchema<T>(
    tenantId: string,
    fn: (qr: QueryRunner) => Promise<T>,
  ): Promise<T> {
    const schemaName = this.getSchemaName(tenantId);
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    try {
      await qr.query(`SET search_path TO "${schemaName}", public`);
      return await fn(qr);
    } finally {
      await qr.release();
    }
  }

  private async assertSupplier(qr: QueryRunner, supplierId: string): Promise<void> {
    const repo = qr.manager.getRepository(SupplierEntity);
    const s = await repo.findOne({ where: { id: supplierId } });
    if (!s) throw new NotFoundException('Fornecedor não encontrado.');
  }

  private async assertEmployee(
    qr: QueryRunner,
    tenantId: string,
    employeeId: string,
  ): Promise<void> {
    const repo = qr.manager.getRepository(UserEntity);
    const u = await repo.findOne({ where: { id: employeeId, tenantId } });
    if (!u) throw new NotFoundException('Funcionário não encontrado.');
    if (u.role !== UserRole.EMPLOYEE) {
      throw new BadRequestException('Motorista deve ser um funcionário.');
    }
  }

  async list(tenantId: string, query: ListColetasQueryDto): Promise<ColetaEntity[]> {
    return this.withSchema(tenantId, async (qr) => {
      const repo = qr.manager.getRepository(ColetaEntity);
      const qb = repo.createQueryBuilder('c').orderBy('c.scheduledAt', 'ASC');
      if (query.start) qb.andWhere('c.scheduledAt >= :start', { start: query.start });
      if (query.end) qb.andWhere('c.scheduledAt <= :end', { end: query.end });
      if (query.status) qb.andWhere('c.status = :status', { status: query.status });
      return qb.getMany();
    });
  }

  async upcoming(tenantId: string, limit: number = 4): Promise<ColetaEntity[]> {
    return this.withSchema(tenantId, async (qr) => {
      const repo = qr.manager.getRepository(ColetaEntity);
      return repo.createQueryBuilder('c')
        .where('c.status = :status', { status: ColetaStatus.AGENDADA })
        .orderBy('c.scheduledAt', 'ASC')
        .limit(Math.max(1, Math.min(50, Math.floor(limit))))
        .getMany();
    });
  }

  async getById(tenantId: string, id: string): Promise<ColetaEntity> {
    return this.withSchema(tenantId, async (qr) => {
      const repo = qr.manager.getRepository(ColetaEntity);
      const item = await repo.findOne({ where: { id } });
      if (!item) throw new NotFoundException('Coleta não encontrada.');
      return item;
    });
  }

  async create(tenantId: string, dto: CreateColetaDto): Promise<ColetaEntity> {
    return this.withSchema(tenantId, async (qr) => {
      await this.assertSupplier(qr, dto.supplierId);
      if (dto.employeeId) await this.assertEmployee(qr, tenantId, dto.employeeId);

      const repo = qr.manager.getRepository(ColetaEntity);
      return repo.save(
        repo.create({
          supplierId: dto.supplierId,
          employeeId: dto.employeeId ?? null,
          scheduledAt: new Date(dto.scheduledAt),
          status: ColetaStatus.AGENDADA,
          notes: dto.notes ?? null,
        }),
      );
    });
  }

  async update(tenantId: string, id: string, dto: UpdateColetaDto): Promise<ColetaEntity> {
    return this.withSchema(tenantId, async (qr) => {
      const repo = qr.manager.getRepository(ColetaEntity);
      const item = await repo.findOne({ where: { id } });
      if (!item) throw new NotFoundException('Coleta não encontrada.');

      if (dto.supplierId) await this.assertSupplier(qr, dto.supplierId);
      if (dto.employeeId) await this.assertEmployee(qr, tenantId, dto.employeeId);

      if (dto.supplierId !== undefined) item.supplierId = dto.supplierId;
      if (dto.employeeId !== undefined) item.employeeId = dto.employeeId ?? null;
      if (dto.scheduledAt !== undefined) item.scheduledAt = new Date(dto.scheduledAt);
      if (dto.notes !== undefined) item.notes = dto.notes ?? null;

      return repo.save(item);
    });
  }

  async updateStatus(
    tenantId: string,
    id: string,
    nextStatus: ColetaStatus.CONCLUIDA | ColetaStatus.CANCELADA,
  ): Promise<ColetaEntity> {
    return this.withSchema(tenantId, async (qr) => {
      const repo = qr.manager.getRepository(ColetaEntity);
      const item = await repo.findOne({ where: { id } });
      if (!item) throw new NotFoundException('Coleta não encontrada.');
      if (item.status !== ColetaStatus.AGENDADA) {
        throw new BadRequestException('Só é possível alterar status de coletas AGENDADAS.');
      }
      item.status = nextStatus;
      return repo.save(item);
    });
  }

  async delete(tenantId: string, id: string): Promise<void> {
    return this.withSchema(tenantId, async (qr) => {
      const repo = qr.manager.getRepository(ColetaEntity);
      const item = await repo.findOne({ where: { id } });
      if (!item) throw new NotFoundException('Coleta não encontrada.');
      if (item.status !== ColetaStatus.AGENDADA) {
        throw new BadRequestException('Só é possível deletar coletas AGENDADAS. Use cancelar para estados finais.');
      }
      await repo.remove(item);
    });
  }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

Run: `pnpm --filter backend test -- coletas.service.spec.ts`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/recycling/coletas/coletas.service.ts apps/backend/src/modules/recycling/coletas/coletas.service.spec.ts
git commit -m "feat(recycling/coletas): service with CRUD + status transitions"
```

---

### Task 15: Backend — ColetasController

**Files:**
- Create: `apps/backend/src/modules/recycling/coletas/coletas.controller.ts`

- [ ] **Step 1: Create controller**

File: `apps/backend/src/modules/recycling/coletas/coletas.controller.ts`

```typescript
import {
  Body, Controller, Delete, Get, HttpCode, Param,
  ParseUUIDPipe, Patch, Post, Put, Query, Request, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { AuthUser } from '../../core/auth/jwt.strategy';
import {
  EmployeePermissionsGuard,
  RequirePermission,
} from '../employees/employee-permissions.guard';
import { ColetasService } from './coletas.service';
import { CreateColetaDto } from './dto/create-coleta.dto';
import { UpdateColetaDto } from './dto/update-coleta.dto';
import { UpdateColetaStatusDto } from './dto/update-status.dto';
import { ListColetasQueryDto } from './dto/list-coletas-query.dto';

interface RequestWithUser extends Request {
  user: AuthUser;
}

@Controller('recycling/coletas')
@UseGuards(JwtAuthGuard, EmployeePermissionsGuard)
@RequirePermission('canManageColetas')
export class ColetasController {
  constructor(private readonly coletasService: ColetasService) {}

  @Get()
  list(
    @Request() req: RequestWithUser,
    @Query() query: ListColetasQueryDto,
  ) {
    return this.coletasService.list(req.user.tenantId, query);
  }

  @Get('upcoming')
  upcoming(
    @Request() req: RequestWithUser,
    @Query('limit') limit?: string,
  ) {
    const parsed = limit ? parseInt(limit, 10) : 4;
    return this.coletasService.upcoming(req.user.tenantId, Number.isFinite(parsed) ? parsed : 4);
  }

  @Get(':id')
  getById(@Request() req: RequestWithUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.coletasService.getById(req.user.tenantId, id);
  }

  @Post()
  create(@Request() req: RequestWithUser, @Body() dto: CreateColetaDto) {
    return this.coletasService.create(req.user.tenantId, dto);
  }

  @Put(':id')
  update(
    @Request() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateColetaDto,
  ) {
    return this.coletasService.update(req.user.tenantId, id, dto);
  }

  @Patch(':id/status')
  updateStatus(
    @Request() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateColetaStatusDto,
  ) {
    return this.coletasService.updateStatus(req.user.tenantId, id, dto.status);
  }

  @Delete(':id')
  @HttpCode(204)
  delete(@Request() req: RequestWithUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.coletasService.delete(req.user.tenantId, id);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/backend/src/modules/recycling/coletas/coletas.controller.ts
git commit -m "feat(recycling/coletas): controller"
```

---

### Task 16: Backend — ColetaCommentsService + tests

**Files:**
- Create: `apps/backend/src/modules/recycling/coletas/coleta-comments.service.ts`
- Create: `apps/backend/src/modules/recycling/coletas/coleta-comments.service.spec.ts`

- [ ] **Step 1: Write failing tests**

File: `apps/backend/src/modules/recycling/coletas/coleta-comments.service.spec.ts`

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ColetaCommentsService } from './coleta-comments.service';

const coletaRepo = { findOne: jest.fn() };
const commentRepo = {
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn((x) => x),
  save: jest.fn(async (x) => ({ id: 'cm1', ...x })),
  remove: jest.fn(),
};

const mockQueryRunner = {
  connect: jest.fn().mockResolvedValue(undefined),
  query: jest.fn().mockResolvedValue(undefined),
  release: jest.fn().mockResolvedValue(undefined),
  manager: {
    getRepository: jest.fn((entity: { name: string }) => {
      if (entity.name === 'ColetaEntity') return coletaRepo;
      if (entity.name === 'ColetaCommentEntity') return commentRepo;
      return {};
    }),
  },
};
const mockDataSource = { createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner) };

describe('ColetaCommentsService', () => {
  let service: ColetaCommentsService;
  const TENANT = '00000000-0000-0000-0000-000000000001';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ColetaCommentsService, { provide: DataSource, useValue: mockDataSource }],
    }).compile();
    service = module.get<ColetaCommentsService>(ColetaCommentsService);
    jest.clearAllMocks();
  });

  describe('addComment', () => {
    it('creates comment when coleta exists', async () => {
      coletaRepo.findOne.mockResolvedValue({ id: 'c1' });
      const result = await service.addComment(TENANT, 'c1', { texto: 'hi' }, 'user1');
      expect(result.id).toBe('cm1');
      expect(commentRepo.save).toHaveBeenCalled();
    });

    it('throws 404 when coleta missing', async () => {
      coletaRepo.findOne.mockResolvedValue(null);
      await expect(service.addComment(TENANT, 'x', { texto: 'hi' }, 'user1'))
        .rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteComment', () => {
    it('allows author to delete', async () => {
      commentRepo.findOne.mockResolvedValue({ id: 'cm1', coletaId: 'c1', createdById: 'user1' });
      await service.deleteComment(TENANT, 'c1', 'cm1', { userId: 'user1', role: 'EMPLOYEE' });
      expect(commentRepo.remove).toHaveBeenCalled();
    });

    it('allows OWNER to delete others comments', async () => {
      commentRepo.findOne.mockResolvedValue({ id: 'cm1', coletaId: 'c1', createdById: 'other' });
      await service.deleteComment(TENANT, 'c1', 'cm1', { userId: 'owner1', role: 'OWNER' });
      expect(commentRepo.remove).toHaveBeenCalled();
    });

    it('forbids non-author employees from deleting', async () => {
      commentRepo.findOne.mockResolvedValue({ id: 'cm1', coletaId: 'c1', createdById: 'other' });
      await expect(
        service.deleteComment(TENANT, 'c1', 'cm1', { userId: 'user1', role: 'EMPLOYEE' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

Run: `pnpm --filter backend test -- coleta-comments.service.spec.ts`
Expected: Fails — service doesn't exist.

- [ ] **Step 3: Implement service**

File: `apps/backend/src/modules/recycling/coletas/coleta-comments.service.ts`

```typescript
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';
import { ColetaEntity } from './coleta.entity';
import { ColetaCommentEntity } from './coleta-comment.entity';
import { CreateColetaCommentDto } from './dto/create-coleta-comment.dto';
import { UserRole } from '../../core/auth/user.entity';

@Injectable()
export class ColetaCommentsService {
  constructor(private readonly dataSource: DataSource) {}

  private getSchemaName(tenantId: string): string {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantId)) {
      throw new Error('Invalid tenantId');
    }
    return `tenant_${tenantId.replace(/-/g, '')}`;
  }

  private async withSchema<T>(
    tenantId: string,
    fn: (qr: QueryRunner) => Promise<T>,
  ): Promise<T> {
    const schemaName = this.getSchemaName(tenantId);
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    try {
      await qr.query(`SET search_path TO "${schemaName}", public`);
      return await fn(qr);
    } finally {
      await qr.release();
    }
  }

  async listComments(tenantId: string, coletaId: string): Promise<ColetaCommentEntity[]> {
    return this.withSchema(tenantId, async (qr) => {
      const repo = qr.manager.getRepository(ColetaCommentEntity);
      return repo.find({ where: { coletaId }, order: { createdAt: 'ASC' } });
    });
  }

  async addComment(
    tenantId: string,
    coletaId: string,
    dto: CreateColetaCommentDto,
    userId: string,
  ): Promise<ColetaCommentEntity> {
    return this.withSchema(tenantId, async (qr) => {
      const coletaRepo = qr.manager.getRepository(ColetaEntity);
      const coleta = await coletaRepo.findOne({ where: { id: coletaId } });
      if (!coleta) throw new NotFoundException('Coleta não encontrada.');

      const commentRepo = qr.manager.getRepository(ColetaCommentEntity);
      return commentRepo.save(
        commentRepo.create({ coletaId, texto: dto.texto, createdById: userId }),
      );
    });
  }

  async deleteComment(
    tenantId: string,
    coletaId: string,
    commentId: string,
    actor: { userId: string; role: string },
  ): Promise<void> {
    return this.withSchema(tenantId, async (qr) => {
      const repo = qr.manager.getRepository(ColetaCommentEntity);
      const item = await repo.findOne({ where: { id: commentId, coletaId } });
      if (!item) throw new NotFoundException('Comentário não encontrado.');
      if (item.createdById !== actor.userId && actor.role !== UserRole.OWNER) {
        throw new ForbiddenException('Sem permissão para remover este comentário.');
      }
      await repo.remove(item);
    });
  }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

Run: `pnpm --filter backend test -- coleta-comments.service.spec.ts`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/recycling/coletas/coleta-comments.service.ts apps/backend/src/modules/recycling/coletas/coleta-comments.service.spec.ts
git commit -m "feat(recycling/coletas): comments service with author/owner delete rules"
```

---

### Task 17: Backend — ColetaCommentsController

**Files:**
- Create: `apps/backend/src/modules/recycling/coletas/coleta-comments.controller.ts`

- [ ] **Step 1: Create controller**

File: `apps/backend/src/modules/recycling/coletas/coleta-comments.controller.ts`

```typescript
import {
  Body, Controller, Delete, Get, HttpCode, Param,
  ParseUUIDPipe, Post, Request, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { AuthUser } from '../../core/auth/jwt.strategy';
import {
  EmployeePermissionsGuard,
  RequirePermission,
} from '../employees/employee-permissions.guard';
import { ColetaCommentsService } from './coleta-comments.service';
import { CreateColetaCommentDto } from './dto/create-coleta-comment.dto';

interface RequestWithUser extends Request {
  user: AuthUser;
}

@Controller('recycling/coletas/:coletaId/comments')
@UseGuards(JwtAuthGuard, EmployeePermissionsGuard)
@RequirePermission('canManageColetas')
export class ColetaCommentsController {
  constructor(private readonly commentsService: ColetaCommentsService) {}

  @Get()
  list(
    @Request() req: RequestWithUser,
    @Param('coletaId', ParseUUIDPipe) coletaId: string,
  ) {
    return this.commentsService.listComments(req.user.tenantId, coletaId);
  }

  @Post()
  add(
    @Request() req: RequestWithUser,
    @Param('coletaId', ParseUUIDPipe) coletaId: string,
    @Body() dto: CreateColetaCommentDto,
  ) {
    return this.commentsService.addComment(req.user.tenantId, coletaId, dto, req.user.userId);
  }

  @Delete(':commentId')
  @HttpCode(204)
  delete(
    @Request() req: RequestWithUser,
    @Param('coletaId', ParseUUIDPipe) coletaId: string,
    @Param('commentId', ParseUUIDPipe) commentId: string,
  ) {
    return this.commentsService.deleteComment(req.user.tenantId, coletaId, commentId, {
      userId: req.user.userId,
      role: req.user.role,
    });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/backend/src/modules/recycling/coletas/coleta-comments.controller.ts
git commit -m "feat(recycling/coletas): comments controller"
```

---

### Task 18: Backend — ColetasModule + register

**Files:**
- Create: `apps/backend/src/modules/recycling/coletas/coletas.module.ts`
- Modify: `apps/backend/src/modules/recycling/recycling.module.ts`

- [ ] **Step 1: Create module**

File: `apps/backend/src/modules/recycling/coletas/coletas.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { ColetasController } from './coletas.controller';
import { ColetasService } from './coletas.service';
import { ColetaCommentsController } from './coleta-comments.controller';
import { ColetaCommentsService } from './coleta-comments.service';
import { EmployeesModule } from '../employees/employees.module';

@Module({
  imports: [EmployeesModule],
  controllers: [ColetasController, ColetaCommentsController],
  providers: [ColetasService, ColetaCommentsService],
})
export class ColetasModule {}
```

- [ ] **Step 2: Register in recycling.module.ts**

Replace `apps/backend/src/modules/recycling/recycling.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { EmployeesModule } from './employees/employees.module';
import { UnitsModule } from './units/units.module';
import { ProductsModule } from './products/products.module';
import { SuppliersModule } from './suppliers/suppliers.module';
import { CashRegisterModule } from './cash-register/cash-register.module';
import { PurchasesModule } from './purchases/purchases.module';
import { StockModule } from './stock/stock.module';
import { BuyersModule } from './buyers/buyers.module';
import { SalesModule } from './sales/sales.module';
import { ReportsModule } from './reports/reports.module';
import { ColetasModule } from './coletas/coletas.module';

@Module({
  imports: [EmployeesModule, UnitsModule, ProductsModule, SuppliersModule, CashRegisterModule, PurchasesModule, StockModule, BuyersModule, SalesModule, ReportsModule, ColetasModule],
})
export class RecyclingModule {}
```

- [ ] **Step 3: Smoke-test the backend**

Run: `pnpm --filter backend start:dev` (in another terminal).
Open: `curl -i http://localhost:3000/recycling/coletas` (unauthenticated).
Expected: 401 (guard rejecting). Server starts without errors.

- [ ] **Step 4: Commit**

```bash
git add apps/backend/src/modules/recycling/coletas/coletas.module.ts apps/backend/src/modules/recycling/recycling.module.ts
git commit -m "feat(recycling/coletas): register module"
```

---

### Task 19: Frontend — coletas service

**Files:**
- Create: `apps/frontend/src/services/recycling/coletas.service.ts`

- [ ] **Step 1: Create service**

File: `apps/frontend/src/services/recycling/coletas.service.ts`

```typescript
import { api } from '../api';
import { ColetaStatus, type Coleta, type ColetaComment } from '@praktikus/shared';

export { ColetaStatus };
export type { Coleta, ColetaComment };

export interface CreateColetaPayload {
  supplierId: string;
  employeeId?: string | null;
  scheduledAt: string;
  notes?: string | null;
}

export type UpdateColetaPayload = Partial<CreateColetaPayload>;

export interface ListColetasParams {
  start?: string;
  end?: string;
  status?: ColetaStatus;
  limit?: number;
}

export const coletasService = {
  async list(params: ListColetasParams = {}): Promise<Coleta[]> {
    const { data } = await api.get<Coleta[]>('/recycling/coletas', { params });
    return data;
  },

  async upcoming(limit = 4): Promise<Coleta[]> {
    const { data } = await api.get<Coleta[]>('/recycling/coletas/upcoming', { params: { limit } });
    return data;
  },

  async getById(id: string): Promise<Coleta> {
    const { data } = await api.get<Coleta>(`/recycling/coletas/${id}`);
    return data;
  },

  async create(payload: CreateColetaPayload): Promise<Coleta> {
    const { data } = await api.post<Coleta>('/recycling/coletas', payload);
    return data;
  },

  async update(id: string, payload: UpdateColetaPayload): Promise<Coleta> {
    const { data } = await api.put<Coleta>(`/recycling/coletas/${id}`, payload);
    return data;
  },

  async updateStatus(
    id: string,
    status: ColetaStatus.CONCLUIDA | ColetaStatus.CANCELADA,
  ): Promise<Coleta> {
    const { data } = await api.patch<Coleta>(`/recycling/coletas/${id}/status`, { status });
    return data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/recycling/coletas/${id}`);
  },
};

export const coletaCommentsService = {
  async list(coletaId: string): Promise<ColetaComment[]> {
    const { data } = await api.get<ColetaComment[]>(`/recycling/coletas/${coletaId}/comments`);
    return data;
  },
  async create(coletaId: string, texto: string): Promise<ColetaComment> {
    const { data } = await api.post<ColetaComment>(
      `/recycling/coletas/${coletaId}/comments`,
      { texto },
    );
    return data;
  },
  async delete(coletaId: string, commentId: string): Promise<void> {
    await api.delete(`/recycling/coletas/${coletaId}/comments/${commentId}`);
  },
};
```

- [ ] **Step 2: Verify build**

Run: `pnpm --filter frontend build`
Expected: Succeeds.

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/services/recycling/coletas.service.ts
git commit -m "feat(recycling/coletas): frontend service"
```

---

### Task 20: Frontend — useColetas hooks

**Files:**
- Create: `apps/frontend/src/hooks/recycling/useColetas.ts`

- [ ] **Step 1: Create hooks file**

File: `apps/frontend/src/hooks/recycling/useColetas.ts`

```typescript
import { useCallback, useEffect, useState } from 'react';
import {
  coletasService,
  coletaCommentsService,
  type Coleta,
  type ColetaComment,
} from '../../services/recycling/coletas.service';

export function useColetasByWeek(weekStart: Date, weekEnd: Date) {
  const [coletas, setColetas] = useState<Coleta[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const items = await coletasService.list({
        start: weekStart.toISOString(),
        end: new Date(weekEnd.getTime() + 86_400_000).toISOString(),
      });
      setColetas(items);
    } catch {
      setError('Erro ao carregar coletas.');
    } finally {
      setLoading(false);
    }
  }, [weekStart.toISOString(), weekEnd.toISOString()]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  return { coletas, loading, error, refetch: load };
}

export function useUpcomingColetas(limit = 4) {
  const [coletas, setColetas] = useState<Coleta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(() => {
    setLoading(true);
    setError(null);
    coletasService.upcoming(limit)
      .then(setColetas)
      .catch(() => setError('Erro ao carregar próximas coletas'))
      .finally(() => setLoading(false));
  }, [limit]);

  useEffect(() => { refetch(); }, [refetch]);

  return { coletas, loading, error, refetch };
}

export function useColetaComments(coletaId: string | null) {
  const [comments, setComments] = useState<ColetaComment[]>([]);
  const [loading, setLoading] = useState(false);

  const refetch = useCallback(() => {
    if (!coletaId) { setComments([]); return; }
    setLoading(true);
    coletaCommentsService.list(coletaId)
      .then(setComments)
      .finally(() => setLoading(false));
  }, [coletaId]);

  useEffect(() => { refetch(); }, [refetch]);

  return { comments, loading, refetch };
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/frontend/src/hooks/recycling/useColetas.ts
git commit -m "feat(recycling/coletas): hooks for weekly list, upcoming, comments"
```

---

### Task 21: Frontend — ColetaFormDialog

**Files:**
- Create: `apps/frontend/src/pages/recycling/coletas/ColetaFormDialog.tsx`

- [ ] **Step 1: Create dialog**

File: `apps/frontend/src/pages/recycling/coletas/ColetaFormDialog.tsx`

```tsx
import { useEffect, useState } from 'react';
import {
  CModal, CModalBody, CModalFooter, CModalHeader, CModalTitle,
  CButton, CForm, CFormInput, CFormLabel, CFormSelect, CFormTextarea, CAlert, CSpinner,
} from '@coreui/react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { coletasService, type Coleta } from '../../../services/recycling/coletas.service';
import { suppliersService, type Supplier } from '../../../services/recycling/suppliers.service';
import { employeesService, type Employee } from '../../../services/recycling/employees.service';

const schema = z.object({
  supplierId: z.string().uuid({ message: 'Selecione um fornecedor' }),
  scheduledDate: z.string().min(1, 'Informe a data'),
  scheduledTime: z.string().min(1, 'Informe o horário'),
  employeeId: z.string().optional(),
  notes: z.string().max(1000).optional(),
});
type FormValues = z.infer<typeof schema>;

export function ColetaFormDialog({
  open,
  onClose,
  onSaved,
  editing,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  editing: Coleta | null;
}) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [search, setSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    handleSubmit, reset, formState: { errors }, control, register,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { supplierId: '', scheduledDate: '', scheduledTime: '', employeeId: '', notes: '' },
  });

  useEffect(() => {
    if (!open) return;
    suppliersService.list(1, 50, search || undefined).then((r) => setSuppliers(r.data));
  }, [open, search]);

  useEffect(() => {
    if (!open) return;
    employeesService.list().then(setEmployees).catch(() => setEmployees([]));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      const d = new Date(editing.scheduledAt);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const hh = String(d.getHours()).padStart(2, '0');
      const mi = String(d.getMinutes()).padStart(2, '0');
      reset({
        supplierId: editing.supplierId,
        scheduledDate: `${yyyy}-${mm}-${dd}`,
        scheduledTime: `${hh}:${mi}`,
        employeeId: editing.employeeId ?? '',
        notes: editing.notes ?? '',
      });
    } else {
      reset({ supplierId: '', scheduledDate: '', scheduledTime: '', employeeId: '', notes: '' });
    }
    setError(null);
  }, [open, editing, reset]);

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    setError(null);
    try {
      const scheduledAt = new Date(`${values.scheduledDate}T${values.scheduledTime}:00`).toISOString();
      const payload = {
        supplierId: values.supplierId,
        scheduledAt,
        employeeId: values.employeeId || null,
        notes: values.notes || null,
      };
      if (editing) {
        await coletasService.update(editing.id, payload);
      } else {
        await coletasService.create(payload);
      }
      onSaved();
      onClose();
    } catch (e: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
      setError(e?.response?.data?.message ?? 'Erro ao salvar coleta.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <CModal visible={open} onClose={onClose} alignment="center">
      <CModalHeader>
        <CModalTitle>{editing ? 'Editar coleta' : 'Nova coleta'}</CModalTitle>
      </CModalHeader>
      <CForm onSubmit={handleSubmit(onSubmit)}>
        <CModalBody>
          {error && <CAlert color="danger" className="mb-3">{error}</CAlert>}

          <div className="mb-3">
            <CFormLabel htmlFor="supplierSearch">Buscar fornecedor</CFormLabel>
            <CFormInput
              id="supplierSearch"
              placeholder="Digite para filtrar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="mb-3">
            <CFormLabel>Fornecedor *</CFormLabel>
            <Controller
              control={control}
              name="supplierId"
              render={({ field }) => (
                <CFormSelect {...field} invalid={!!errors.supplierId}>
                  <option value="">— Selecione —</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </CFormSelect>
              )}
            />
            {errors.supplierId && <div className="invalid-feedback d-block">{errors.supplierId.message}</div>}
          </div>

          <div className="row">
            <div className="col-6 mb-3">
              <CFormLabel>Data *</CFormLabel>
              <CFormInput type="date" {...register('scheduledDate')} invalid={!!errors.scheduledDate} />
              {errors.scheduledDate && <div className="invalid-feedback d-block">{errors.scheduledDate.message}</div>}
            </div>
            <div className="col-6 mb-3">
              <CFormLabel>Hora *</CFormLabel>
              <CFormInput type="time" {...register('scheduledTime')} invalid={!!errors.scheduledTime} />
              {errors.scheduledTime && <div className="invalid-feedback d-block">{errors.scheduledTime.message}</div>}
            </div>
          </div>

          <div className="mb-3">
            <CFormLabel>Motorista (opcional)</CFormLabel>
            <Controller
              control={control}
              name="employeeId"
              render={({ field }) => (
                <CFormSelect {...field}>
                  <option value="">— Sem motorista vinculado —</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>{e.name}</option>
                  ))}
                </CFormSelect>
              )}
            />
          </div>

          <div className="mb-3">
            <CFormLabel>Observações</CFormLabel>
            <CFormTextarea rows={3} {...register('notes')} />
          </div>
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" variant="outline" onClick={onClose} disabled={submitting}>
            Cancelar
          </CButton>
          <CButton type="submit" color="primary" disabled={submitting}>
            {submitting ? <CSpinner size="sm" /> : (editing ? 'Salvar' : 'Criar')}
          </CButton>
        </CModalFooter>
      </CForm>
    </CModal>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/frontend/src/pages/recycling/coletas/ColetaFormDialog.tsx
git commit -m "feat(recycling/coletas): form dialog for create/edit"
```

---

### Task 22: Frontend — ColetaDrawer

**Files:**
- Create: `apps/frontend/src/pages/recycling/coletas/ColetaDrawer.tsx`

- [ ] **Step 1: Create drawer**

File: `apps/frontend/src/pages/recycling/coletas/ColetaDrawer.tsx`

```tsx
import { useEffect, useState } from 'react';
import { COffcanvas, COffcanvasBody, COffcanvasHeader, COffcanvasTitle, CButton, CSpinner, CFormInput } from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilSend, cilPen, cilTrash, cilCheckCircle, cilXCircle } from '@coreui/icons';
import {
  coletasService,
  coletaCommentsService,
  ColetaStatus,
  type Coleta,
  type ColetaComment,
} from '../../../services/recycling/coletas.service';
import { suppliersService, type Supplier } from '../../../services/recycling/suppliers.service';
import { employeesService, type Employee } from '../../../services/recycling/employees.service';

const STATUS_STYLES: Record<ColetaStatus, { bg: string; text: string; label: string; border: string }> = {
  [ColetaStatus.AGENDADA]: { bg: 'rgba(52,142,145,0.12)', text: 'var(--cui-primary)', border: 'var(--cui-primary)', label: 'Agendada' },
  [ColetaStatus.CONCLUIDA]: { bg: 'rgba(22,163,74,0.12)', text: '#15803d', border: '#16a34a', label: 'Concluída' },
  [ColetaStatus.CANCELADA]: { bg: 'rgba(107,114,128,0.10)', text: '#6b7280', border: '#9ca3af', label: 'Cancelada' },
};

function formatAddress(s: Supplier | null): string {
  if (!s || !s.address) return 'Endereço não cadastrado';
  const a = s.address;
  const parts = [`${a.street}, ${a.number}`, a.complement, a.city && `${a.city}/${a.state}`].filter(Boolean);
  return parts.join(' — ');
}

export function ColetaDrawer({
  coletaId,
  onClose,
  onEdit,
  onChanged,
}: {
  coletaId: string | null;
  onClose: () => void;
  onEdit: (c: Coleta) => void;
  onChanged: () => void;
}) {
  const [coleta, setColeta] = useState<Coleta | null>(null);
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [comments, setComments] = useState<ColetaComment[]>([]);
  const [newText, setNewText] = useState('');
  const [loading, setLoading] = useState(false);
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    if (!coletaId) { setColeta(null); return; }
    setLoading(true);
    coletasService.getById(coletaId).then(async (c) => {
      setColeta(c);
      const sup = await suppliersService.getById(c.supplierId).catch(() => null);
      setSupplier(sup);
      if (c.employeeId) {
        const emps = await employeesService.list().catch(() => []);
        setEmployee(emps.find((e) => e.id === c.employeeId) ?? null);
      } else {
        setEmployee(null);
      }
      const cs = await coletaCommentsService.list(c.id).catch(() => []);
      setComments(cs);
    }).finally(() => setLoading(false));
  }, [coletaId]);

  const changeStatus = async (next: ColetaStatus.CONCLUIDA | ColetaStatus.CANCELADA) => {
    if (!coleta) return;
    const verb = next === ColetaStatus.CONCLUIDA ? 'concluir' : 'cancelar';
    if (!window.confirm(`Confirmar ${verb} esta coleta?`)) return;
    await coletasService.updateStatus(coleta.id, next);
    onChanged();
    onClose();
  };

  const handleDelete = async () => {
    if (!coleta) return;
    if (!window.confirm('Confirmar exclusão da coleta?')) return;
    await coletasService.delete(coleta.id);
    onChanged();
    onClose();
  };

  const addComment = async () => {
    if (!coleta || !newText.trim()) return;
    setPosting(true);
    try {
      const created = await coletaCommentsService.create(coleta.id, newText.trim());
      setComments((prev) => [...prev, created]);
      setNewText('');
    } finally {
      setPosting(false);
    }
  };

  const status = coleta ? STATUS_STYLES[coleta.status] : null;
  const isAgendada = coleta?.status === ColetaStatus.AGENDADA;

  return (
    <COffcanvas placement="end" visible={!!coletaId} onHide={onClose}>
      <COffcanvasHeader>
        <COffcanvasTitle>Coleta</COffcanvasTitle>
        <CButton color="secondary" variant="ghost" size="sm" onClick={onClose}>×</CButton>
      </COffcanvasHeader>
      <COffcanvasBody>
        {loading && <div className="text-center py-3"><CSpinner size="sm" /></div>}
        {coleta && status && (
          <>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '4px 12px', borderRadius: 999,
              fontSize: 12, fontWeight: 700, textTransform: 'uppercase',
              color: status.text, background: status.bg, marginBottom: 16,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: status.border }} />
              {status.label}
            </div>

            <Field label="Fornecedor" value={supplier?.name ?? '—'} />
            <Field label="Endereço" value={formatAddress(supplier)} />
            <Field label="Telefone" value={supplier?.phone ?? '—'} />
            <Field label="Motorista" value={employee?.name ?? '—'} />
            <Field label="Data/Hora" value={new Date(coleta.scheduledAt).toLocaleString('pt-BR')} />
            {coleta.notes && <Field label="Observações" value={coleta.notes} />}

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
              {isAgendada && (
                <>
                  <CButton color="primary" variant="outline" size="sm" onClick={() => onEdit(coleta)}>
                    <CIcon icon={cilPen} size="sm" /> Editar
                  </CButton>
                  <CButton color="success" size="sm" onClick={() => changeStatus(ColetaStatus.CONCLUIDA)}>
                    <CIcon icon={cilCheckCircle} size="sm" /> Concluir
                  </CButton>
                  <CButton color="warning" variant="outline" size="sm" onClick={() => changeStatus(ColetaStatus.CANCELADA)}>
                    <CIcon icon={cilXCircle} size="sm" /> Cancelar
                  </CButton>
                  <CButton color="danger" variant="outline" size="sm" onClick={handleDelete}>
                    <CIcon icon={cilTrash} size="sm" /> Deletar
                  </CButton>
                </>
              )}
            </div>

            <hr style={{ margin: '20px 0' }} />

            <h6 style={{ fontSize: 13, fontWeight: 600 }}>Comentários</h6>
            {comments.length === 0 && (
              <p style={{ color: 'var(--cui-secondary-color)', fontSize: 13 }}>Nenhum comentário.</p>
            )}
            {comments.map((c) => (
              <div key={c.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--cui-border-color)' }}>
                <div style={{ fontSize: 13 }}>{c.texto}</div>
                <div style={{ fontSize: 11, color: 'var(--cui-secondary-color)', marginTop: 2 }}>
                  {new Date(c.createdAt).toLocaleString('pt-BR')}
                </div>
              </div>
            ))}

            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <CFormInput
                placeholder="Adicionar comentário..."
                value={newText}
                onChange={(e) => setNewText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addComment(); } }}
                disabled={posting}
              />
              <CButton color="primary" onClick={addComment} disabled={posting || !newText.trim()}>
                <CIcon icon={cilSend} size="sm" />
              </CButton>
            </div>
          </>
        )}
      </COffcanvasBody>
    </COffcanvas>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 11, color: 'var(--cui-secondary-color)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.04em', marginBottom: 2 }}>
        {label}
      </div>
      <div style={{ fontSize: 14, color: 'var(--cui-body-color)' }}>{value}</div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/frontend/src/pages/recycling/coletas/ColetaDrawer.tsx
git commit -m "feat(recycling/coletas): drawer with status actions and comments"
```

---

### Task 23: Frontend — ColetasPage (calendar + list)

**Files:**
- Create: `apps/frontend/src/pages/recycling/coletas/ColetasPage.tsx`

- [ ] **Step 1: Create page**

File: `apps/frontend/src/pages/recycling/coletas/ColetasPage.tsx`

```tsx
import { useCallback, useMemo, useState } from 'react';
import {
  CAlert, CButton, CFormInput, CSpinner,
  CTable, CTableBody, CTableDataCell, CTableHead, CTableHeaderCell, CTableRow,
} from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilPlus, cilChevronLeft, cilChevronRight, cilCalendar, cilList, cilPen, cilTrash, cilSearch } from '@coreui/icons';
import { PageHead } from '../../../components/PageHead';
import {
  coletasService, ColetaStatus, type Coleta,
} from '../../../services/recycling/coletas.service';
import { useColetasByWeek } from '../../../hooks/recycling/useColetas';
import { ColetaFormDialog } from './ColetaFormDialog';
import { ColetaDrawer } from './ColetaDrawer';

const STATUS_STYLES: Record<ColetaStatus, { bg: string; border: string; text: string; label: string }> = {
  [ColetaStatus.AGENDADA]:  { bg: 'rgba(52,142,145,0.12)', border: 'var(--cui-primary)', text: 'var(--cui-primary)', label: 'Agendada' },
  [ColetaStatus.CONCLUIDA]: { bg: 'rgba(22,163,74,0.12)',  border: '#16a34a', text: '#15803d', label: 'Concluída' },
  [ColetaStatus.CANCELADA]: { bg: 'rgba(107,114,128,0.10)', border: '#9ca3af', text: '#6b7280', label: 'Cancelada' },
};

const DAY_LABELS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
const HOURS = Array.from({ length: 14 }, (_, i) => i + 7);
const HOUR_HEIGHT = 56;
const CARD_HEIGHT = 28;

function getWeekDates(referenceDate: Date): Date[] {
  const day = referenceDate.getDay();
  const monday = new Date(referenceDate);
  monday.setDate(referenceDate.getDate() - day + (day === 0 ? -6 : 1));
  monday.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function StatusPill({ status }: { status: ColetaStatus }) {
  const s = STATUS_STYLES[status];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '3px 10px', borderRadius: 999, fontSize: 11.5, fontWeight: 600,
      color: s.text, background: s.bg, whiteSpace: 'nowrap',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.border }} />
      {s.label}
    </span>
  );
}

export function ColetasPage() {
  const [view, setView] = useState<'calendar' | 'list'>('calendar');
  const [weekRef, setWeekRef] = useState(new Date());
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Coleta | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  const weekDates = useMemo(() => getWeekDates(weekRef), [weekRef]);
  const weekStart = weekDates[0];
  const weekEnd = weekDates[6];

  const { coletas, loading, refetch } = useColetasByWeek(weekStart, weekEnd);

  const prevWeek = () => setWeekRef((d) => { const n = new Date(d); n.setDate(d.getDate() - 7); return n; });
  const nextWeek = () => setWeekRef((d) => { const n = new Date(d); n.setDate(d.getDate() + 7); return n; });
  const goToday = () => setWeekRef(new Date());

  const openNew = () => { setEditing(null); setFormOpen(true); };
  const openEdit = useCallback((c: Coleta) => { setEditing(c); setFormOpen(true); setSelectedId(null); }, []);

  const handleDelete = async (id: string) => {
    if (!window.confirm('Confirmar exclusão?')) return;
    try { await coletasService.delete(id); refetch(); }
    catch { setError('Erro ao deletar coleta.'); }
  };

  const weekLabel = `${weekDates[0].toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} – ${weekDates[6].toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}`;

  const filteredList = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return coletas;
    return coletas.filter((c) =>
      (c.notes ?? '').toLowerCase().includes(q) || (c.status ?? '').toLowerCase().includes(q),
    );
  }, [coletas, search]);

  return (
    <>
      <PageHead
        title="Coletas"
        subtitle={`Semana de ${weekLabel}`}
        actions={
          <>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <CButton color="secondary" variant="outline" size="sm" onClick={prevWeek} style={{ borderRadius: 8, padding: '4px 10px' }} aria-label="Semana anterior">
                <CIcon icon={cilChevronLeft} size="sm" />
              </CButton>
              <CButton color="secondary" variant="outline" size="sm" onClick={goToday} style={{ borderRadius: 8 }}>Hoje</CButton>
              <CButton color="secondary" variant="outline" size="sm" onClick={nextWeek} style={{ borderRadius: 8, padding: '4px 10px' }} aria-label="Próxima semana">
                <CIcon icon={cilChevronRight} size="sm" />
              </CButton>
            </div>

            <div style={{
              display: 'inline-flex', padding: 3, gap: 2,
              background: 'var(--cui-card-cap-bg)', border: '1px solid var(--cui-border-color)', borderRadius: 8,
            }}>
              {([
                ['calendar', cilCalendar, 'Calendário'],
                ['list', cilList, 'Lista'],
              ] as const).map(([v, icon, label]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setView(v)}
                  title={label}
                  aria-label={label}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    padding: '5px 10px', borderRadius: 6, border: 0,
                    background: view === v ? 'var(--cui-card-bg)' : 'transparent',
                    color: view === v ? 'var(--cui-body-color)' : 'var(--cui-secondary-color)',
                    fontSize: 12.5, fontWeight: view === v ? 600 : 500,
                    boxShadow: view === v ? '0 1px 2px rgba(10,12,13,0.06)' : 'none',
                    cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.12s',
                  }}
                >
                  <CIcon icon={icon} size="sm" />
                </button>
              ))}
            </div>

            <CButton color="primary" onClick={openNew} style={{ borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <CIcon icon={cilPlus} size="sm" /> Nova coleta
            </CButton>
          </>
        }
      />

      {error && <CAlert color="danger" className="mb-3">{error}</CAlert>}
      {loading && <div className="text-center py-4"><CSpinner color="primary" size="sm" /></div>}

      {!loading && view === 'calendar' && (
        <div style={{
          border: '1px solid var(--cui-border-color)', borderRadius: 12,
          overflow: 'hidden', background: 'var(--cui-card-bg)',
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: `60px repeat(7, 1fr)`, borderBottom: '1px solid var(--cui-border-color)' }}>
            <div />
            {weekDates.map((d, i) => (
              <div key={i} style={{ textAlign: 'center', padding: 8, borderLeft: '1px solid var(--cui-border-color)' }}>
                <div style={{ fontSize: 11, color: 'var(--cui-secondary-color)', textTransform: 'uppercase', fontWeight: 600 }}>{DAY_LABELS[i]}</div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{d.getDate()}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: `60px repeat(7, 1fr)`, position: 'relative' }}>
            <div>
              {HOURS.map((h) => (
                <div key={h} style={{ height: HOUR_HEIGHT, borderBottom: '1px solid var(--cui-border-color)', padding: 4, fontSize: 11, color: 'var(--cui-secondary-color)' }}>
                  {String(h).padStart(2, '0')}:00
                </div>
              ))}
            </div>
            {weekDates.map((d, i) => (
              <div key={i} style={{ position: 'relative', borderLeft: '1px solid var(--cui-border-color)' }}>
                {HOURS.map((h) => (
                  <div key={h} style={{ height: HOUR_HEIGHT, borderBottom: '1px solid var(--cui-border-color)' }} />
                ))}
                {coletas
                  .filter((c) => isSameDay(new Date(c.scheduledAt), d))
                  .map((c) => {
                    const date = new Date(c.scheduledAt);
                    const minutesFrom7 = (date.getHours() - 7) * 60 + date.getMinutes();
                    const top = (minutesFrom7 / 60) * HOUR_HEIGHT;
                    const s = STATUS_STYLES[c.status];
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setSelectedId(c.id)}
                        style={{
                          position: 'absolute', top, left: 4, right: 4, height: CARD_HEIGHT,
                          padding: '3px 6px', borderRadius: 6, border: 0,
                          borderLeft: `3px solid ${s.border}`, background: s.bg, color: s.text,
                          textAlign: 'left', cursor: 'pointer', overflow: 'hidden',
                          fontSize: 11, fontFamily: 'inherit',
                        }}
                      >
                        <strong>{date.toTimeString().slice(0, 5)}</strong>
                      </button>
                    );
                  })}
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && view === 'list' && (
        <div>
          <div style={{ marginBottom: 12, position: 'relative' }}>
            <CIcon icon={cilSearch} size="sm" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--cui-secondary-color)' }} />
            <CFormInput
              placeholder="Buscar por observações ou status..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: 32 }}
            />
          </div>

          <CTable hover>
            <CTableHead>
              <CTableRow>
                <CTableHeaderCell>Data / Hora</CTableHeaderCell>
                <CTableHeaderCell>Observações</CTableHeaderCell>
                <CTableHeaderCell>Status</CTableHeaderCell>
                <CTableHeaderCell style={{ textAlign: 'right' }}>Ações</CTableHeaderCell>
              </CTableRow>
            </CTableHead>
            <CTableBody>
              {filteredList.length === 0 && (
                <CTableRow>
                  <CTableDataCell colSpan={4} style={{ textAlign: 'center', color: 'var(--cui-secondary-color)' }}>
                    Nenhuma coleta nessa semana.
                  </CTableDataCell>
                </CTableRow>
              )}
              {filteredList.map((c) => {
                const d = new Date(c.scheduledAt);
                return (
                  <CTableRow key={c.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedId(c.id)}>
                    <CTableDataCell>
                      <div style={{ fontWeight: 600 }}>{d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</div>
                      <div style={{ fontSize: 12, color: 'var(--cui-secondary-color)' }}>{d.toTimeString().slice(0, 5)}</div>
                    </CTableDataCell>
                    <CTableDataCell>{c.notes ?? '—'}</CTableDataCell>
                    <CTableDataCell><StatusPill status={c.status} /></CTableDataCell>
                    <CTableDataCell style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                      <CButton size="sm" variant="ghost" onClick={() => openEdit(c)}>
                        <CIcon icon={cilPen} size="sm" />
                      </CButton>
                      <CButton size="sm" color="danger" variant="ghost" onClick={() => handleDelete(c.id)}>
                        <CIcon icon={cilTrash} size="sm" />
                      </CButton>
                    </CTableDataCell>
                  </CTableRow>
                );
              })}
            </CTableBody>
          </CTable>
        </div>
      )}

      <ColetaFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={refetch}
        editing={editing}
      />

      <ColetaDrawer
        coletaId={selectedId}
        onClose={() => setSelectedId(null)}
        onEdit={openEdit}
        onChanged={refetch}
      />
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/frontend/src/pages/recycling/coletas/ColetasPage.tsx
git commit -m "feat(recycling/coletas): page with calendar and list views"
```

---

### Task 24: Frontend — Sidebar + route

**Files:**
- Modify: `apps/frontend/src/App.tsx`
- Modify: `apps/frontend/src/layouts/RecyclingLayout.tsx`

- [ ] **Step 1: Add route in App.tsx**

Modify `apps/frontend/src/App.tsx`:

Add import near the other recycling imports:

```typescript
import { ColetasPage } from './pages/recycling/coletas/ColetasPage';
```

Inside the `/recycling` route block, after `<Route path="sales/new" element={<NewSalePage />} />`, add:

```tsx
<Route path="coletas" element={<ColetasPage />} />
```

- [ ] **Step 2: Add sidebar item**

Modify `apps/frontend/src/layouts/RecyclingLayout.tsx`:

Add `cilTruck` to the `@coreui/icons` import.

In the `navItems` array, insert between "Vendas" and "Fornecedores":

```typescript
  { label: 'Coletas', icon: cilTruck, path: '/recycling/coletas', ownerOnly: false },
```

- [ ] **Step 3: Verify**

Run: `pnpm --filter frontend dev` and log in as a RECYCLING tenant.
Expected: Sidebar item "Coletas" appears. Clicking navigates to `/recycling/coletas` with empty calendar.

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/App.tsx apps/frontend/src/layouts/RecyclingLayout.tsx
git commit -m "feat(recycling/coletas): sidebar item and route"
```

---

### Task 25: Frontend — Dashboard "Próximas coletas" widget

**Files:**
- Modify: `apps/frontend/src/pages/recycling/DashboardPage.tsx`

- [ ] **Step 1: Add widget**

Modify `apps/frontend/src/pages/recycling/DashboardPage.tsx`:

Add near the other hook imports:

```typescript
import { useUpcomingColetas } from '../../hooks/recycling/useColetas';
```

Inside `RecyclingDashboardPage`, after `useTopMaterials` call, add:

```typescript
  const { coletas: upcomingColetas, loading: coletasLoading } = useUpcomingColetas(4);
```

Add helper above `RecyclingDashboardPage`:

```tsx
const COLETA_STATUS_COLORS: Record<string, { bg: string; text: string; border: string; label: string }> = {
  AGENDADA: { bg: 'rgba(52,142,145,0.12)', text: 'var(--cui-primary)', border: 'var(--cui-primary)', label: 'Agendada' },
  CONCLUIDA: { bg: 'rgba(22,163,74,0.12)', text: '#15803d', border: '#16a34a', label: 'Concluída' },
  CANCELADA: { bg: 'rgba(107,114,128,0.10)', text: '#6b7280', border: '#9ca3af', label: 'Cancelada' },
};

function formatWhen(isoDate: string): { time: string; label: string } {
  const d = new Date(isoDate);
  const time = d.toTimeString().slice(0, 5);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const target = new Date(d); target.setHours(0, 0, 0, 0);
  const diffDays = Math.round((target.getTime() - today.getTime()) / 86_400_000);
  let label = d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' });
  if (diffDays === 0) label = 'HOJE';
  else if (diffDays === 1) label = 'AMANHÃ';
  return { time, label };
}

function UpcomingColetasCard({
  coletas,
  loading,
  onSeeAll,
  onNew,
}: {
  coletas: Array<{ id: string; scheduledAt: string; status: string; supplierId: string }>;
  loading: boolean;
  onSeeAll: () => void;
  onNew: () => void;
}) {
  return (
    <Card padding={0}>
      <CardHeader
        title="Próximas coletas"
        desc="hoje e amanhã"
        action={
          <button
            type="button"
            onClick={onSeeAll}
            style={{
              border: 0, background: 'transparent', color: 'var(--cui-primary)',
              fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Ver todas →
          </button>
        }
      />
      <div style={{ padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 20 }}>
            <CSpinner size="sm" color="primary" />
          </div>
        )}
        {!loading && coletas.length === 0 && (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div style={{ color: 'var(--cui-secondary-color)', fontSize: 13, marginBottom: 10 }}>
              Nenhuma coleta agendada.
            </div>
            <CButton color="primary" size="sm" onClick={onNew} style={{ borderRadius: 8 }}>
              Nova coleta
            </CButton>
          </div>
        )}
        {!loading && coletas.map((c) => {
          const w = formatWhen(c.scheduledAt);
          const s = COLETA_STATUS_COLORS[c.status] ?? COLETA_STATUS_COLORS.AGENDADA;
          return (
            <div key={c.id} style={{
              display: 'grid', gridTemplateColumns: '80px 1fr auto',
              alignItems: 'center', gap: 10,
              padding: '8px 10px', borderRadius: 8, background: 'var(--cui-card-cap-bg)',
            }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{w.time}</div>
                <div style={{ fontSize: 10, color: 'var(--cui-secondary-color)', textTransform: 'uppercase', fontWeight: 600 }}>
                  {w.label}
                </div>
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c.supplierId.slice(0, 8)}
                </div>
                <div style={{ fontSize: 11, color: 'var(--cui-secondary-color)' }}>
                  Clique para detalhes
                </div>
              </div>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600,
                color: s.text, background: s.bg, whiteSpace: 'nowrap',
              }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: s.border }} />
                {s.label}
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
```

Change the Top Materials grid row to a 2-column grid that holds both widgets. Replace the `Top materials row` block with:

```tsx
      {/* ── Top materials + upcoming coletas ─────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
          gap: 16,
        }}
        className="pk-dashboard-grid"
      >
        <TopMaterialsCard
          materials={topMaterials}
          loading={topLoading}
          onSeeStock={() => navigate('/recycling/stock')}
        />
        <UpcomingColetasCard
          coletas={upcomingColetas}
          loading={coletasLoading}
          onSeeAll={() => navigate('/recycling/coletas')}
          onNew={() => navigate('/recycling/coletas')}
        />
      </div>
```

- [ ] **Step 2: Enrich widget with supplier names (follow-up refinement)**

Inside `RecyclingDashboardPage`, replace the plain `upcomingColetas` render by fetching supplier names once:

```typescript
  const [supplierMap, setSupplierMap] = useState<Record<string, { name: string; address: string | null }>>({});

  useEffect(() => {
    if (upcomingColetas.length === 0) return;
    const ids = Array.from(new Set(upcomingColetas.map((c) => c.supplierId)));
    Promise.all(ids.map((id) => suppliersService.getById(id).catch(() => null)))
      .then((results) => {
        const map: Record<string, { name: string; address: string | null }> = {};
        results.forEach((s) => {
          if (!s) return;
          const addr = s.address ? `${s.address.street}, ${s.address.number}` : null;
          map[s.id] = { name: s.name, address: addr };
        });
        setSupplierMap(map);
      });
  }, [upcomingColetas]);
```

Add `import { suppliersService } from '../../services/recycling/suppliers.service';` near the top of the file.

Then update `UpcomingColetasCard` signature to take `supplierMap` and render `supplierMap[c.supplierId]?.name ?? '...'` in the middle column, with address below:

```tsx
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {supplierMap[c.supplierId]?.name ?? '…'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--cui-secondary-color)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {supplierMap[c.supplierId]?.address ?? 'Endereço não cadastrado'}
                </div>
              </div>
```

Pass `supplierMap` into the component call.

- [ ] **Step 3: Smoke test**

Run: `pnpm --filter frontend dev` and open `/recycling/dashboard`.
Expected:
- Top Materials widget shows 5 items or empty state
- Upcoming Coletas widget shows list or empty CTA
- Creating a new coleta via `/recycling/coletas` refreshes the widget when you come back to dashboard

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/pages/recycling/DashboardPage.tsx
git commit -m "feat(recycling/dashboard): upcoming coletas widget"
```

---

## Acceptance Testing (manual)

After all tasks complete, verify manually:

**Phase 1 — Top Materials:**
- [ ] Dashboard shows "Compras (mês)" KPI with correct monthly total
- [ ] Top Materials widget shows 5 products ordered by volume
- [ ] Products without previous-month data show `—` for delta
- [ ] Empty state displays when there are zero purchases this month
- [ ] Widget is only visible to OWNER (endpoint gated)

**Phase 2 — Coletas:**
- [ ] Sidebar shows "Coletas" menu for OWNER and EMPLOYEE users
- [ ] Creating a coleta with fornecedor + data + hora saves and appears in calendar at correct position
- [ ] Creating without motorista works; drawer shows "—" in motorista
- [ ] Status pill shows correct color in both calendar card (left border) and drawer
- [ ] Concluir and Cancelar change status; coleta disappears from "Próximas" widget
- [ ] Deletar blocked on CONCLUIDA/CANCELADA (error toast)
- [ ] Comments can be added and deleted (by author); OWNER can delete any comment
- [ ] List view search filters by notes and status text
- [ ] Week navigation moves + shows correct date range
- [ ] Employee without `canManageColetas` gets 403 when calling endpoints (test via Postman or by toggling permission)
- [ ] Dashboard "Próximas coletas" widget shows up to 4 items with HOJE/AMANHÃ labels

---

## Notes on Execution Order

- Phase 1 (Tasks 1–8) can be shipped as a single PR and merged before starting Phase 2
- Tasks 9–12 (entities + migrations) must complete before 13–18 (services/controllers)
- Frontend tasks 19–25 can start in parallel with late backend tasks (16–18) once the service contracts are stable
- Don't skip the `pnpm --filter @praktikus/shared build` step after modifying shared — TypeScript project references require the `dist/` output

---

## Out of Scope (documented in spec)

- Monthly calendar view (only weekly)
- Coleta → compra automatic integration
- Mobile driver view
- Notifications (email/push)
- Route/map view
- Updating KPIs other than "Compras (mês)" (Vendas mês, Volume processado, Estoque em valor remain as placeholders)
