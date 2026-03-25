# Entrega 8: Relatórios — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implementar página de relatórios gerenciais exclusiva para OWNER, com KPIs de faturamento, gráficos de barras e pizza (Recharts), ranking top 10 serviços, e filtro por mês rápido ou intervalo de datas customizado.

**Architecture:** Backend adiciona `ReportsModule` com endpoint `GET /api/workshop/reports` (OWNER only) que agrega dados via 6 queries SQL raw com GROUP BY. Frontend instala `recharts`, cria `reports.service.ts` e `ReportsPage`, e restringe a entrada "Relatórios" do sidebar ao OWNER.

**Tech Stack:** NestJS 10, TypeORM raw SQL (EntityManager.query), React 18, MUI v5, Recharts, pnpm workspaces.

**Design doc:** `docs/plans/2026-03-24-entrega-8-relatorios-design.md`

---

## Task 1: Backend — ReportsModule (service + controller + module + register)

**Files:**
- Create: `apps/backend/src/modules/workshop/reports/reports.service.ts`
- Create: `apps/backend/src/modules/workshop/reports/reports.service.spec.ts`
- Create: `apps/backend/src/modules/workshop/reports/reports.controller.ts`
- Create: `apps/backend/src/modules/workshop/reports/reports.module.ts`
- Modify: `apps/backend/src/app.module.ts`

### Context

`ReportsService` usa o mesmo padrão `withSchema<T>` de `VehiclesService`: recebe `(manager: EntityManager)` e chama `manager.query()` para SQL raw. O método principal é `getReport(tenantId, dateStart, dateEnd)` que executa 6 queries separadas e combina os resultados. Apenas OS com `status != 'ORCAMENTO'` são incluídas.

O controller usa `@Roles(UserRole.OWNER)` a nível de classe para bloquear EMPLOYEE no backend.

### Step 1: Escrever os testes em `reports.service.spec.ts`

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { BadRequestException } from '@nestjs/common';
import { ReportsService } from './reports.service';

const TENANT = '00000000-0000-0000-0000-000000000001';

const mockManager = { query: jest.fn() };
const mockQueryRunner = {
  connect: jest.fn().mockResolvedValue(undefined),
  query: jest.fn().mockResolvedValue(undefined),  // SET search_path
  manager: mockManager,
  release: jest.fn().mockResolvedValue(undefined),
};
const mockDataSource = {
  createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
};

describe('ReportsService', () => {
  let service: ReportsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();
    service = module.get<ReportsService>(ReportsService);
    jest.clearAllMocks();
    mockQueryRunner.query.mockResolvedValue(undefined);
  });

  describe('getReport', () => {
    it('should throw BadRequestException when dateStart > dateEnd', async () => {
      await expect(
        service.getReport(TENANT, '2026-03-31', '2026-03-01'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should return aggregated report data for a valid period', async () => {
      const kpiRows = [{ totalOs: '5', osPagas: '3' }];
      const servicosRows = [{ faturamentoServicos: '1500.00' }];
      const pecasRows = [{ faturamentoPecas: '500.00' }];
      const statusRows = [
        { status: 'ENTREGUE', count: '3' },
        { status: 'FINALIZADA', count: '2' },
      ];
      const mesRows = [
        { mes: '2026-03', servicos: '1500.00', pecas: '500.00', total: '2000.00' },
      ];
      const topRows = [
        { nomeServico: 'Troca de óleo', quantidade: '3', receita: '450.00' },
      ];

      mockManager.query
        .mockResolvedValueOnce(kpiRows)
        .mockResolvedValueOnce(servicosRows)
        .mockResolvedValueOnce(pecasRows)
        .mockResolvedValueOnce(statusRows)
        .mockResolvedValueOnce(mesRows)
        .mockResolvedValueOnce(topRows);

      const result = await service.getReport(TENANT, '2026-03-01', '2026-03-31');

      expect(result.totalOs).toBe(5);
      expect(result.osPagas).toBe(3);
      expect(result.faturamentoServicos).toBe(1500);
      expect(result.faturamentoPecas).toBe(500);
      expect(result.faturamentoTotal).toBe(2000);
      expect(result.osPorStatus).toHaveLength(2);
      expect(result.osPorStatus[0]).toEqual({ status: 'ENTREGUE', count: 3 });
      expect(result.faturamentoPorMes).toHaveLength(1);
      expect(result.faturamentoPorMes[0]).toEqual({
        mes: '2026-03',
        servicos: 1500,
        pecas: 500,
        total: 2000,
      });
      expect(result.topServicos).toHaveLength(1);
      expect(result.topServicos[0]).toEqual({
        nomeServico: 'Troca de óleo',
        quantidade: 3,
        receita: 450,
      });
      expect(mockManager.query).toHaveBeenCalledTimes(6);
    });

    it('should return zeros when no OS in the period', async () => {
      mockManager.query
        .mockResolvedValueOnce([{ totalOs: '0', osPagas: '0' }])
        .mockResolvedValueOnce([{ faturamentoServicos: null }])
        .mockResolvedValueOnce([{ faturamentoPecas: null }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await service.getReport(TENANT, '2026-01-01', '2026-01-31');

      expect(result.totalOs).toBe(0);
      expect(result.faturamentoTotal).toBe(0);
      expect(result.osPorStatus).toEqual([]);
      expect(result.faturamentoPorMes).toEqual([]);
      expect(result.topServicos).toEqual([]);
    });
  });
});
```

### Step 2: Rodar e confirmar FAIL

```bash
cd apps/backend && npx jest --testPathPattern="reports.service" --no-coverage 2>&1 | tail -10
```

Esperado: FAIL — `Cannot find module './reports.service'`

### Step 3: Criar `reports.service.ts`

```typescript
import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';

@Injectable()
export class ReportsService {
  constructor(private readonly dataSource: DataSource) {}

  private getSchemaName(tenantId: string): string {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantId)) {
      throw new Error('Invalid tenantId');
    }
    return `tenant_${tenantId.replace(/-/g, '')}`;
  }

  private async withSchema<T>(
    tenantId: string,
    fn: (manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    const schemaName = this.getSchemaName(tenantId);
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    try {
      await qr.query(`SET search_path TO "${schemaName}", public`);
      return await fn(qr.manager);
    } finally {
      await qr.release();
    }
  }

  async getReport(tenantId: string, dateStart: string, dateEnd: string) {
    if (new Date(dateStart) > new Date(dateEnd)) {
      throw new BadRequestException('date_start não pode ser maior que date_end.');
    }

    return this.withSchema(tenantId, async (manager) => {
      // Query 1: KPIs de OS
      const [kpi] = await manager.query<any[]>(
        `SELECT
           COUNT(*)                                             AS "totalOs",
           COUNT(CASE WHEN status_pagamento = 'PAGO' THEN 1 END) AS "osPagas"
         FROM service_orders
         WHERE status != 'ORCAMENTO'
           AND created_at::date >= $1::date
           AND created_at::date <= $2::date`,
        [dateStart, dateEnd],
      );

      // Query 2: Faturamento de serviços
      const [svRow] = await manager.query<any[]>(
        `SELECT COALESCE(SUM(s.valor), 0) AS "faturamentoServicos"
         FROM so_items_services s
         JOIN service_orders so ON so.id = s.so_id
         WHERE so.status != 'ORCAMENTO'
           AND so.created_at::date >= $1::date
           AND so.created_at::date <= $2::date`,
        [dateStart, dateEnd],
      );

      // Query 3: Faturamento de peças
      const [pvRow] = await manager.query<any[]>(
        `SELECT COALESCE(SUM(p.quantidade * p.valor_unitario), 0) AS "faturamentoPecas"
         FROM so_items_parts p
         JOIN service_orders so ON so.id = p.so_id
         WHERE so.status != 'ORCAMENTO'
           AND so.created_at::date >= $1::date
           AND so.created_at::date <= $2::date`,
        [dateStart, dateEnd],
      );

      // Query 4: OS por status
      const statusRows = await manager.query<any[]>(
        `SELECT status, COUNT(*) AS count
         FROM service_orders
         WHERE status != 'ORCAMENTO'
           AND created_at::date >= $1::date
           AND created_at::date <= $2::date
         GROUP BY status
         ORDER BY count DESC`,
        [dateStart, dateEnd],
      );

      // Query 5: Faturamento por mês
      const mesRows = await manager.query<any[]>(
        `SELECT
           TO_CHAR(so.created_at, 'YYYY-MM') AS mes,
           COALESCE(SUM(sv.total_servicos), 0) AS servicos,
           COALESCE(SUM(pv.total_pecas), 0)    AS pecas,
           COALESCE(SUM(sv.total_servicos), 0) + COALESCE(SUM(pv.total_pecas), 0) AS total
         FROM service_orders so
         LEFT JOIN (
           SELECT so_id, SUM(valor) AS total_servicos
           FROM so_items_services GROUP BY so_id
         ) sv ON sv.so_id = so.id
         LEFT JOIN (
           SELECT so_id, SUM(quantidade * valor_unitario) AS total_pecas
           FROM so_items_parts GROUP BY so_id
         ) pv ON pv.so_id = so.id
         WHERE so.status != 'ORCAMENTO'
           AND so.created_at::date >= $1::date
           AND so.created_at::date <= $2::date
         GROUP BY mes
         ORDER BY mes ASC`,
        [dateStart, dateEnd],
      );

      // Query 6: Top 10 serviços
      const topRows = await manager.query<any[]>(
        `SELECT
           s.nome_servico AS "nomeServico",
           COUNT(*)       AS quantidade,
           SUM(s.valor)   AS receita
         FROM so_items_services s
         JOIN service_orders so ON so.id = s.so_id
         WHERE so.status != 'ORCAMENTO'
           AND so.created_at::date >= $1::date
           AND so.created_at::date <= $2::date
         GROUP BY s.nome_servico
         ORDER BY quantidade DESC
         LIMIT 10`,
        [dateStart, dateEnd],
      );

      const faturamentoServicos = Math.round(Number(svRow.faturamentoServicos ?? 0) * 100) / 100;
      const faturamentoPecas = Math.round(Number(pvRow.faturamentoPecas ?? 0) * 100) / 100;

      return {
        periodo: { dateStart, dateEnd },
        faturamentoTotal: Math.round((faturamentoServicos + faturamentoPecas) * 100) / 100,
        faturamentoServicos,
        faturamentoPecas,
        totalOs: Number(kpi.totalOs),
        osPagas: Number(kpi.osPagas),
        osPorStatus: statusRows.map((r) => ({ status: r.status, count: Number(r.count) })),
        faturamentoPorMes: mesRows.map((r) => ({
          mes: r.mes,
          servicos: Math.round(Number(r.servicos) * 100) / 100,
          pecas: Math.round(Number(r.pecas) * 100) / 100,
          total: Math.round(Number(r.total) * 100) / 100,
        })),
        topServicos: topRows.map((r) => ({
          nomeServico: r.nomeServico,
          quantidade: Number(r.quantidade),
          receita: Math.round(Number(r.receita) * 100) / 100,
        })),
      };
    });
  }
}
```

### Step 4: Rodar e confirmar PASS

```bash
cd apps/backend && npx jest --testPathPattern="reports.service" --no-coverage 2>&1 | tail -10
```

Esperado: 3 testes PASS

### Step 5: Criar `reports.controller.ts`

```typescript
import { BadRequestException, Controller, Get, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { RolesGuard } from '../../core/auth/roles.guard';
import { Roles } from '../../core/auth/roles.decorator';
import { UserRole } from '../../core/auth/user.entity';
import { AuthUser } from '../../core/auth/jwt.strategy';
import { ReportsService } from './reports.service';

interface RequestWithUser extends Request {
  user: AuthUser;
}

@Controller('workshop/reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.OWNER)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get()
  getReport(
    @Request() req: RequestWithUser,
    @Query('date_start') dateStart?: string,
    @Query('date_end') dateEnd?: string,
  ) {
    if (!dateStart || !dateEnd) {
      throw new BadRequestException('date_start e date_end são obrigatórios.');
    }
    return this.reportsService.getReport(req.user.tenantId, dateStart, dateEnd);
  }
}
```

### Step 6: Criar `reports.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
```

### Step 7: Registrar em `app.module.ts`

Adicionar import e inserir no array `imports` após `ServiceOrdersModule`:

```typescript
import { ReportsModule } from './modules/workshop/reports/reports.module';
// no @Module imports array:
ReportsModule,
```

### Step 8: Confirmar suite completa

```bash
cd apps/backend && npx jest --no-coverage 2>&1 | tail -10
```

Esperado: todos os testes PASS

### Step 9: Commit

```bash
git add apps/backend/src/modules/workshop/reports/ apps/backend/src/app.module.ts
git commit -m "feat(reports): add ReportsModule with aggregated SQL endpoint (OWNER only)"
```

---

## Task 2: Frontend — recharts + reports.service.ts + ReportsPage

**Files:**
- Create: `apps/frontend/src/services/reports.service.ts`
- Create: `apps/frontend/src/pages/workshop/reports/ReportsPage.tsx`

### Context

Instalar `recharts`. O `ReportsPage` é exclusivo de OWNER — verificar `user?.role` via `useAuthStore` e redirecionar para `/workshop/dashboard` se EMPLOYEE acessar diretamente. O filtro de período tem dois modos: chips de mês rápido (mês atual + 5 anteriores) e campos de data customizados com botão "Buscar". Ao clicar num chip, dispara a busca automaticamente.

`recharts` usa SVG e funciona bem com MUI dark theme. Imports necessários: `BarChart`, `Bar`, `XAxis`, `YAxis`, `CartesianGrid`, `Tooltip`, `Legend`, `PieChart`, `Pie`, `Cell`, `ResponsiveContainer`.

### Step 1: Instalar recharts

```bash
cd apps/frontend && pnpm add recharts
```

### Step 2: Criar `apps/frontend/src/services/reports.service.ts`

```typescript
import { api } from './api';

export interface ReportOsStatus {
  status: string;
  count: number;
}

export interface ReportMes {
  mes: string;
  servicos: number;
  pecas: number;
  total: number;
}

export interface ReportTopServico {
  nomeServico: string;
  quantidade: number;
  receita: number;
}

export interface ReportData {
  periodo: { dateStart: string; dateEnd: string };
  faturamentoTotal: number;
  faturamentoServicos: number;
  faturamentoPecas: number;
  totalOs: number;
  osPagas: number;
  osPorStatus: ReportOsStatus[];
  faturamentoPorMes: ReportMes[];
  topServicos: ReportTopServico[];
}

export const reportsApi = {
  async get(dateStart: string, dateEnd: string): Promise<ReportData> {
    const { data } = await api.get<ReportData>('/workshop/reports', {
      params: { date_start: dateStart, date_end: dateEnd },
    });
    return data;
  },
};
```

### Step 3: Criar `apps/frontend/src/pages/workshop/reports/ReportsPage.tsx`

```tsx
import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import {
  Alert, Box, Button, Card, CardContent, Chip,
  CircularProgress, Paper, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, PieChart, Pie, Cell, ResponsiveContainer,
} from 'recharts';
import { useAuthStore } from '../../../store/auth.store';
import { reportsApi, type ReportData } from '../../../services/reports.service';

const PIE_COLORS = ['#1976d2', '#9c27b0', '#ed6c02', '#2e7d32', '#d32f2f', '#0288d1'];

const STATUS_LABEL: Record<string, string> = {
  APROVADO: 'Aprovado',
  EM_EXECUCAO: 'Em Execução',
  AGUARDANDO_PECA: 'Aguard. Peça',
  FINALIZADA: 'Finalizada',
  ENTREGUE: 'Entregue',
};

const fmt = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function getMonthChips() {
  const chips = [];
  const now = new Date();
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label = d.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const lastDay = new Date(year, d.getMonth() + 1, 0).getDate();
    chips.push({
      label,
      dateStart: `${year}-${month}-01`,
      dateEnd: `${year}-${month}-${lastDay}`,
    });
  }
  return chips;
}

export function ReportsPage() {
  const user = useAuthStore((s) => s.user);

  if (user?.role !== 'OWNER') {
    return <Navigate to="/workshop/dashboard" replace />;
  }

  const monthChips = getMonthChips();
  const [dateStart, setDateStart] = useState(monthChips[0].dateStart);
  const [dateEnd, setDateEnd] = useState(monthChips[0].dateEnd);
  const [activeChip, setActiveChip] = useState(0);
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (start = dateStart, end = dateEnd) => {
    setLoading(true);
    setError(null);
    try {
      const result = await reportsApi.get(start, end);
      setData(result);
    } catch {
      setError('Erro ao carregar relatório.');
    } finally {
      setLoading(false);
    }
  };

  const handleChipClick = (index: number, chip: typeof monthChips[0]) => {
    setActiveChip(index);
    setDateStart(chip.dateStart);
    setDateEnd(chip.dateEnd);
    handleSearch(chip.dateStart, chip.dateEnd);
  };

  return (
    <Box>
      <Typography variant="h5" fontWeight="bold" sx={{ mb: 3 }}>
        Relatórios
      </Typography>

      {/* Filtros */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
        {monthChips.map((chip, i) => (
          <Chip
            key={chip.dateStart}
            label={chip.label}
            onClick={() => handleChipClick(i, chip)}
            color={activeChip === i ? 'primary' : 'default'}
            variant={activeChip === i ? 'filled' : 'outlined'}
          />
        ))}
      </Box>
      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 3 }}>
        <TextField
          label="De"
          type="date"
          size="small"
          InputLabelProps={{ shrink: true }}
          value={dateStart}
          onChange={(e) => { setDateStart(e.target.value); setActiveChip(-1); }}
        />
        <TextField
          label="Até"
          type="date"
          size="small"
          InputLabelProps={{ shrink: true }}
          value={dateEnd}
          onChange={(e) => { setDateEnd(e.target.value); setActiveChip(-1); }}
        />
        <Button variant="contained" onClick={() => handleSearch()} disabled={loading}>
          Buscar
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {loading && <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>}

      {data && !loading && (
        <>
          {data.totalOs === 0 && (
            <Typography color="text.secondary" sx={{ mb: 2 }}>
              Nenhuma OS encontrada para o período selecionado.
            </Typography>
          )}

          {/* KPIs */}
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 3 }}>
            {[
              { label: 'Faturamento Total', value: fmt(data.faturamentoTotal) },
              { label: 'Serviços', value: fmt(data.faturamentoServicos) },
              { label: 'Peças', value: fmt(data.faturamentoPecas) },
              { label: 'Total de OS', value: String(data.totalOs) },
              { label: 'OS Pagas', value: String(data.osPagas) },
            ].map((kpi) => (
              <Card key={kpi.label} variant="outlined" sx={{ flex: '1 1 150px' }}>
                <CardContent sx={{ pb: '12px !important' }}>
                  <Typography variant="caption" color="text.secondary">{kpi.label}</Typography>
                  <Typography variant="h6" fontWeight="bold">{kpi.value}</Typography>
                </CardContent>
              </Card>
            ))}
          </Box>

          {/* Gráficos */}
          {data.totalOs > 0 && (
            <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
              {/* Barras: faturamento por mês */}
              <Card variant="outlined" sx={{ flex: '2 1 400px' }}>
                <CardContent>
                  <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 2 }}>
                    Faturamento por Mês
                  </Typography>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={data.faturamentoPorMes}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="mes" />
                      <YAxis tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                      <Tooltip formatter={(v: number) => fmt(v)} />
                      <Legend />
                      <Bar dataKey="servicos" name="Serviços" stackId="a" fill="#1976d2" />
                      <Bar dataKey="pecas" name="Peças" stackId="a" fill="#9c27b0" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Pizza: OS por status */}
              <Card variant="outlined" sx={{ flex: '1 1 280px' }}>
                <CardContent>
                  <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 2 }}>
                    OS por Status
                  </Typography>
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie
                        data={data.osPorStatus}
                        dataKey="count"
                        nameKey="status"
                        cx="50%"
                        cy="50%"
                        outerRadius={90}
                        label={({ status, count }) => `${STATUS_LABEL[status] ?? status}: ${count}`}
                      >
                        {data.osPorStatus.map((entry, index) => (
                          <Cell key={entry.status} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number, name: string) => [v, STATUS_LABEL[name] ?? name]} />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </Box>
          )}

          {/* Top 10 serviços */}
          {data.topServicos.length > 0 && (
            <Card variant="outlined">
              <CardContent>
                <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 2 }}>
                  Top 10 Serviços
                </Typography>
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>#</TableCell>
                        <TableCell>Serviço</TableCell>
                        <TableCell align="right">Qtd</TableCell>
                        <TableCell align="right">Receita</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {data.topServicos.map((s, i) => (
                        <TableRow key={s.nomeServico}>
                          <TableCell>{i + 1}</TableCell>
                          <TableCell>{s.nomeServico}</TableCell>
                          <TableCell align="right">{s.quantidade}</TableCell>
                          <TableCell align="right">{fmt(s.receita)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </Box>
  );
}
```

### Step 4: Verificar TypeScript

```bash
cd apps/frontend && npx tsc --noEmit 2>&1 | head -20
```

Esperado: sem erros

### Step 5: Commit

```bash
git add apps/frontend/src/services/reports.service.ts \
        apps/frontend/src/pages/workshop/reports/ReportsPage.tsx \
        apps/frontend/package.json pnpm-lock.yaml
git commit -m "feat(reports): add reportsApi service and ReportsPage with charts"
```

---

## Task 3: Frontend — AppLayout OWNER filter + App.tsx route

**Files:**
- Modify: `apps/frontend/src/layouts/AppLayout.tsx`
- Modify: `apps/frontend/src/App.tsx`

### Context

O `AppLayout.tsx` já tem "Relatórios" em `navItems` com `BarChartIcon`, mas exibe para todos os usuários. Precisa filtrar pelo role `OWNER`. O `useAuthStore` já está importado no `AppLayout`.

O `App.tsx` já tem as rotas de `/workshop` — só adicionar `reports`.

Leia ambos os arquivos antes de editar.

### Step 1: Ler os arquivos

```bash
cat apps/frontend/src/layouts/AppLayout.tsx
cat apps/frontend/src/App.tsx
```

### Step 2: Atualizar `AppLayout.tsx`

O array `navItems` já existe. Adicionar um campo `ownerOnly?: boolean` aos items relevantes e filtrar ao renderizar.

**Opção mais simples** — filtrar diretamente no map. Adicione `const user = useAuthStore((s) => s.user);` após as desestruturações existentes do store, e filtre o array:

```typescript
const user = useAuthStore((s) => s.user);
const visibleItems = navItems.filter(
  (item) => !item.ownerOnly || user?.role === 'OWNER',
);
```

Adicione `ownerOnly: true` ao item "Relatórios" no array `navItems`:

```typescript
{ label: 'Relatórios', icon: <BarChartIcon />, path: '/workshop/reports', ownerOnly: true },
```

A interface do item muda para:
```typescript
const navItems: Array<{ label: string; icon: JSX.Element; path: string; ownerOnly?: boolean }> = [...]
```

Substitua o `.map(navItems...)` no JSX por `.map(visibleItems...)`.

### Step 3: Atualizar `App.tsx`

Adicionar import:
```typescript
import { ReportsPage } from './pages/workshop/reports/ReportsPage';
```

Adicionar rota dentro do bloco `/workshop`:
```tsx
<Route path="reports" element={<ReportsPage />} />
```

### Step 4: Verificar TypeScript e testes

```bash
cd apps/frontend && npx tsc --noEmit 2>&1 | head -20
```

```bash
cd apps/backend && npx jest --no-coverage 2>&1 | tail -10
```

Esperado: sem erros TypeScript, todos os testes backend passando

### Step 5: Commit

```bash
git add apps/frontend/src/layouts/AppLayout.tsx \
        apps/frontend/src/App.tsx
git commit -m "feat(reports): restrict Relatórios sidebar to OWNER and register route"
```

---

## Verificação Final

```bash
# Backend
cd apps/backend && npx jest --no-coverage 2>&1 | tail -10

# Frontend TypeScript
cd apps/frontend && npx tsc --noEmit 2>&1 | head -10

# Frontend Vitest
cd apps/frontend && npx vitest run 2>&1 | tail -10
```

Todos devem passar sem erros.
