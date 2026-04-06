# CoreUI Migration — Phase 2: Dashboard + Reports

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace MUI components and Recharts in DashboardPage and ReportsPage with CoreUI components and @coreui/chartjs (Chart.js). Remove recharts from dependencies.

**Architecture:** DashboardPage becomes a simple CCard grid. ReportsPage gets CChartBar (stacked) and CChartDoughnut via `@coreui/chartjs`. All MUI imports removed from both files. `recharts` removed from package.json after rewrite.

**Tech Stack:** `@coreui/react`, `@coreui/icons-react`, `@coreui/chartjs`, `chart.js`; MUI still in other pages.

---

### Task 1: Install chart.js dependencies

**Files:**
- Modify: `apps/frontend/package.json`

**Step 1: Add dependencies**

In `apps/frontend/package.json`, add to `"dependencies"`:
```json
"@coreui/chartjs": "^4.0.0",
"chart.js": "^4.4.0"
```

**Step 2: Install**

```bash
cd apps/frontend && pnpm install
```

Expected: packages install, no errors.

**Step 3: Commit**

```bash
git add apps/frontend/package.json pnpm-lock.yaml
git commit -m "feat(frontend): install @coreui/chartjs and chart.js"
```

---

### Task 2: Rewrite DashboardPage with CoreUI

**Files:**
- Modify: `apps/frontend/src/pages/workshop/DashboardPage.tsx`

**Step 1: Rewrite the file**

```tsx
import { CCard, CCardBody, CRow, CCol } from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilNotes, cilCalendar, cilChartLine } from '@coreui/icons';

const summaryCards = [
  { label: 'OS Abertas', value: '—', icon: cilNotes },
  { label: 'Agendamentos Hoje', value: '—', icon: cilCalendar },
  { label: 'Faturamento do Mês', value: '—', icon: cilChartLine },
];

export function DashboardPage() {
  return (
    <>
      <h5 className="fw-bold mb-4">Dashboard</h5>
      <CRow className="g-3">
        {summaryCards.map((card) => (
          <CCol key={card.label} xs={12} sm={6} md={4}>
            <CCard>
              <CCardBody className="d-flex align-items-center gap-3">
                <CIcon icon={card.icon} size="3xl" className="text-primary" />
                <div>
                  <div className="fs-4 fw-bold">{card.value}</div>
                  <div className="text-secondary small">{card.label}</div>
                </div>
              </CCardBody>
            </CCard>
          </CCol>
        ))}
      </CRow>
    </>
  );
}
```

**Step 2: Verify build**

```bash
cd apps/frontend && pnpm build
```

Expected: BUILD success. No MUI imports in DashboardPage.tsx.

**Step 3: Commit**

```bash
git add apps/frontend/src/pages/workshop/DashboardPage.tsx
git commit -m "feat(dashboard): rewrite DashboardPage with CoreUI CCard grid"
```

---

### Task 3: Rewrite ReportsPage with CoreUI + CChartBar/CChartDoughnut

**Files:**
- Modify: `apps/frontend/src/pages/workshop/reports/ReportsPage.tsx`

**Context:** Current page uses Recharts `BarChart` (stacked by month) and `PieChart` (OS by status), plus MUI components throughout. Preserve all business logic — only swap the component library.

**Chart data structures:**
- Bar chart: `data.faturamentoPorMes[]` → `{ mes, servicos, pecas, total }`
  - Two stacked datasets: Serviços + Peças
  - Y-axis ticks formatted as `R$Xk`
  - Tooltip formatted as `R$ X.XXX,XX`
- Doughnut: `data.osPorStatus[]` → `{ status, count }`
  - Labels use STATUS_LABEL mapping
  - backgroundColor array matches PIE_COLORS

**Step 1: Rewrite the file**

```tsx
import { useCallback, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import {
  CAlert,
  CButton,
  CCard,
  CCardBody,
  CCol,
  CFormInput,
  CFormLabel,
  CRow,
  CSpinner,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react';
import { CChartBar, CChartDoughnut } from '@coreui/chartjs';
import axios from 'axios';
import { useAuthStore } from '../../../store/auth.store';
import { reportsApi, type ReportData } from '../../../services/reports.service';

const PIE_COLORS = ['#321fdb', '#9b59b6', '#fd7e14', '#1b9e3e', '#e55353', '#39f'];

const STATUS_LABEL: Record<string, string> = {
  APROVADO: 'Aprovado',
  EM_EXECUCAO: 'Em Execução',
  AGUARDANDO_PECA: 'Aguard. Peça',
  FINALIZADA: 'Finalizada',
  ENTREGUE: 'Entregue',
};

const fmt = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const monthChips = (() => {
  const chips = [];
  const now = new Date();
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
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
})();

export function ReportsPage() {
  const user = useAuthStore((s) => s.user);

  const [dateStart, setDateStart] = useState(monthChips[0].dateStart);
  const [dateEnd, setDateEnd] = useState(monthChips[0].dateEnd);
  const [activeChip, setActiveChip] = useState(0);
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  const handleSearch = useCallback(async (start = dateStart, end = dateEnd) => {
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    setError(null);
    try {
      const result = await reportsApi.get(start, end, controller.signal);
      setData(result);
    } catch (err) {
      if (axios.isCancel(err)) return;
      setError('Erro ao carregar relatório.');
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [dateStart, dateEnd]);

  if (user?.role !== 'OWNER') {
    return <Navigate to="/workshop/dashboard" replace />;
  }

  const handleChipClick = (index: number, chip: typeof monthChips[0]) => {
    setActiveChip(index);
    setDateStart(chip.dateStart);
    setDateEnd(chip.dateEnd);
    handleSearch(chip.dateStart, chip.dateEnd);
  };

  return (
    <>
      <h5 className="fw-bold mb-4">Relatórios</h5>

      {/* Month chips */}
      <div className="d-flex flex-wrap gap-2 mb-3">
        {monthChips.map((chip, i) => (
          <button
            key={chip.dateStart}
            type="button"
            className={`btn btn-sm ${activeChip === i ? 'btn-primary' : 'btn-outline-secondary'}`}
            onClick={() => handleChipClick(i, chip)}
          >
            {chip.label}
          </button>
        ))}
      </div>

      {/* Date range + search */}
      <CRow className="g-2 align-items-end mb-4">
        <CCol xs="auto">
          <CFormLabel className="mb-1">De</CFormLabel>
          <CFormInput
            type="date"
            size="sm"
            value={dateStart}
            onChange={(e) => { setDateStart(e.target.value); setActiveChip(-1); }}
          />
        </CCol>
        <CCol xs="auto">
          <CFormLabel className="mb-1">Até</CFormLabel>
          <CFormInput
            type="date"
            size="sm"
            value={dateEnd}
            onChange={(e) => { setDateEnd(e.target.value); setActiveChip(-1); }}
          />
        </CCol>
        <CCol xs="auto">
          <CButton color="primary" size="sm" onClick={() => handleSearch()} disabled={loading}>
            Buscar
          </CButton>
        </CCol>
      </CRow>

      {error && <CAlert color="danger" className="mb-3">{error}</CAlert>}
      {loading && (
        <div className="d-flex justify-content-center py-5">
          <CSpinner color="primary" />
        </div>
      )}

      {data && !loading && (
        <>
          {data.totalOs === 0 && (
            <p className="text-secondary mb-3">
              Nenhuma OS encontrada para o período selecionado.
            </p>
          )}

          {/* KPIs */}
          <CRow className="g-3 mb-4">
            {[
              { label: 'Faturamento Total', value: fmt(data.faturamentoTotal) },
              { label: 'Serviços', value: fmt(data.faturamentoServicos) },
              { label: 'Peças', value: fmt(data.faturamentoPecas) },
              { label: 'Total de OS', value: String(data.totalOs) },
              { label: 'OS Pagas', value: String(data.osPagas) },
            ].map((kpi) => (
              <CCol key={kpi.label} xs={6} md={4} lg="auto" style={{ flex: '1 1 150px' }}>
                <CCard>
                  <CCardBody className="py-3">
                    <div className="text-secondary small">{kpi.label}</div>
                    <div className="fs-5 fw-bold">{kpi.value}</div>
                  </CCardBody>
                </CCard>
              </CCol>
            ))}
          </CRow>

          {/* Charts */}
          {data.totalOs > 0 && (
            <CRow className="g-3 mb-4">
              <CCol xs={12} lg={8}>
                <CCard>
                  <CCardBody>
                    <div className="fw-semibold mb-3">Faturamento por Mês</div>
                    <CChartBar
                      data={{
                        labels: data.faturamentoPorMes.map((m) => m.mes),
                        datasets: [
                          {
                            label: 'Serviços',
                            backgroundColor: '#321fdb',
                            data: data.faturamentoPorMes.map((m) => m.servicos),
                            stack: 'a',
                          },
                          {
                            label: 'Peças',
                            backgroundColor: '#9b59b6',
                            data: data.faturamentoPorMes.map((m) => m.pecas),
                            stack: 'a',
                          },
                        ],
                      }}
                      options={{
                        plugins: {
                          tooltip: {
                            callbacks: {
                              label: (ctx) =>
                                `${ctx.dataset.label}: ${fmt(Number(ctx.raw))}`,
                            },
                          },
                        },
                        scales: {
                          y: {
                            stacked: true,
                            ticks: {
                              // eslint-disable-next-line @typescript-eslint/no-explicit-any
                              callback: (v: any) =>
                                `R$${(Number(v) / 1000).toFixed(0)}k`,
                            },
                          },
                          x: { stacked: true },
                        },
                        responsive: true,
                        maintainAspectRatio: true,
                      }}
                    />
                  </CCardBody>
                </CCard>
              </CCol>
              <CCol xs={12} lg={4}>
                <CCard>
                  <CCardBody>
                    <div className="fw-semibold mb-3">OS por Status</div>
                    <CChartDoughnut
                      data={{
                        labels: data.osPorStatus.map(
                          (s) => STATUS_LABEL[s.status] ?? s.status
                        ),
                        datasets: [
                          {
                            data: data.osPorStatus.map((s) => s.count),
                            backgroundColor: PIE_COLORS,
                            hoverOffset: 4,
                          },
                        ],
                      }}
                    />
                  </CCardBody>
                </CCard>
              </CCol>
            </CRow>
          )}

          {/* Top 10 services */}
          {data.topServicos.length > 0 && (
            <CCard>
              <CCardBody>
                <div className="fw-semibold mb-3">Top 10 Serviços</div>
                <CTable small bordered striped responsive>
                  <CTableHead>
                    <CTableRow>
                      <CTableHeaderCell>#</CTableHeaderCell>
                      <CTableHeaderCell>Serviço</CTableHeaderCell>
                      <CTableHeaderCell className="text-end">Qtd</CTableHeaderCell>
                      <CTableHeaderCell className="text-end">Receita</CTableHeaderCell>
                    </CTableRow>
                  </CTableHead>
                  <CTableBody>
                    {data.topServicos.map((s, i) => (
                      <CTableRow key={i}>
                        <CTableDataCell>{i + 1}</CTableDataCell>
                        <CTableDataCell>{s.nomeServico}</CTableDataCell>
                        <CTableDataCell className="text-end">{s.quantidade}</CTableDataCell>
                        <CTableDataCell className="text-end">{fmt(s.receita)}</CTableDataCell>
                      </CTableRow>
                    ))}
                  </CTableBody>
                </CTable>
              </CCardBody>
            </CCard>
          )}
        </>
      )}
    </>
  );
}
```

**Step 2: Verify build**

```bash
cd apps/frontend && pnpm build
```

Expected: BUILD success. No `recharts` or `@mui/material` imports in ReportsPage.tsx.

**Step 3: Commit**

```bash
git add apps/frontend/src/pages/workshop/reports/ReportsPage.tsx
git commit -m "feat(reports): rewrite ReportsPage with CoreUI + CChartBar/CChartDoughnut"
```

---

### Task 4: Remove recharts

**Files:**
- Modify: `apps/frontend/package.json`

**Step 1: Remove recharts from package.json**

Remove the line `"recharts": "^3.8.0"` from `"dependencies"` in `apps/frontend/package.json`.

**Step 2: Uninstall**

```bash
cd apps/frontend && pnpm remove recharts
```

Expected: recharts removed from node_modules and lockfile.

**Step 3: Verify build still passes**

```bash
cd apps/frontend && pnpm build
```

Expected: BUILD success. No recharts imports anywhere.

**Step 4: Commit**

```bash
git add apps/frontend/package.json pnpm-lock.yaml
git commit -m "chore(frontend): remove recharts dependency"
```
