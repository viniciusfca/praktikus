# Entrega 7: PDF e Prontuário do Veículo — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Gerar PDF de orçamento de OS via `@react-pdf/renderer` e exibir histórico completo de OS por veículo em página dedicada.

**Architecture:** Backend adiciona `GET /api/workshop/vehicles/:id/service-orders` ao VehiclesController/Service, usando raw SQL com `manager.query()` via o padrão `withSchema<T>` existente. Frontend instala `@react-pdf/renderer`, cria componente puro `OsPdf`, adiciona botão de download na `ServiceOrderDetailPage`, e cria `VehicleHistoryPage` em `/workshop/vehicles/:id/history`.

**Tech Stack:** NestJS 10, TypeORM 0.3 (raw SQL via EntityManager.query), React 18, MUI v5, `@react-pdf/renderer`, pnpm workspaces.

**Design doc:** `docs/plans/2026-03-24-entrega-7-pdf-prontuario-design.md`

---

## Task 1: Backend — VehiclesService.getServiceOrders + controller endpoint

**Files:**
- Modify: `apps/backend/src/modules/workshop/vehicles/vehicles.service.ts`
- Modify: `apps/backend/src/modules/workshop/vehicles/vehicles.service.spec.ts`
- Modify: `apps/backend/src/modules/workshop/vehicles/vehicles.controller.ts`

### Context

`VehiclesService.withSchema` recebe `(manager: EntityManager)` — usa `manager.query()` para SQL raw. Entidades de OS vivem no mesmo schema de tenant. Não há FK explícita entre vehicles e service_orders (pelo design da plataforma), mas o campo `service_orders.veiculo_id` armazena o UUID do veículo.

O mock de testes em `vehicles.service.spec.ts` tem `mockQueryRunner.manager.getRepository` mas **não tem** `mockQueryRunner.manager.query` — você vai precisar adicionar.

### Step 1: Adicionar `manager.query` ao mock em `vehicles.service.spec.ts`

Abra o arquivo e localize o objeto `mockQueryRunner`. Adicione `query: jest.fn()` dentro de `manager`:

```typescript
const mockQueryRunner = {
  connect: jest.fn().mockResolvedValue(undefined),
  query: jest.fn().mockResolvedValue(undefined),
  manager: {
    getRepository: jest.fn().mockReturnValue(mockVehicleRepo),
    query: jest.fn(),  // <-- adicionar esta linha
  },
  release: jest.fn().mockResolvedValue(undefined),
};
```

### Step 2: Escrever os testes para `getServiceOrders`

Adicione ao final do `describe('VehiclesService', ...)`:

```typescript
describe('getServiceOrders', () => {
  const TENANT = '00000000-0000-0000-0000-000000000001';
  const VEHICLE_ID = '00000000-0000-0000-0000-000000000002';

  beforeEach(() => {
    mockQueryRunner.manager.query.mockReset();
  });

  it('should return empty array when vehicle has no service orders', async () => {
    mockQueryRunner.manager.query.mockResolvedValueOnce([]);

    const result = await service.getServiceOrders(TENANT, VEHICLE_ID);

    expect(result).toEqual([]);
    expect(mockQueryRunner.manager.query).toHaveBeenCalledTimes(1);
  });

  it('should return orders with items and computed total', async () => {
    const orders = [
      {
        id: 'so1',
        status: 'ENTREGUE',
        statusPagamento: 'PAGO',
        kmEntrada: '45000',
        combustivel: 'cheio',
        observacoesEntrada: null,
        createdAt: '2024-01-01T00:00:00Z',
      },
    ];
    const services = [
      { soId: 'so1', id: 'si1', nomeServico: 'Troca de óleo', valor: '150.00', mecanicoId: null },
    ];
    const parts = [
      { soId: 'so1', id: 'pi1', nomePeca: 'Filtro', quantidade: 1, valorUnitario: '50.00' },
    ];

    mockQueryRunner.manager.query
      .mockResolvedValueOnce(orders)    // service_orders query
      .mockResolvedValueOnce(services)  // so_items_services query
      .mockResolvedValueOnce(parts);    // so_items_parts query

    const result = await service.getServiceOrders(TENANT, VEHICLE_ID);

    expect(result).toHaveLength(1);
    expect(result[0].total).toBe(200);           // 150 + 50*1
    expect(result[0].itemsServices).toHaveLength(1);
    expect(result[0].itemsParts).toHaveLength(1);
    expect(mockQueryRunner.manager.query).toHaveBeenCalledTimes(3);
  });
});
```

### Step 3: Executar e confirmar que os testes falham

```bash
cd apps/backend && npx jest --testPathPattern="vehicles.service" --no-coverage 2>&1 | tail -20
```

Esperado: FAIL — `service.getServiceOrders is not a function`

### Step 4: Implementar `getServiceOrders` em `vehicles.service.ts`

Adicione o método após `delete`:

```typescript
async getServiceOrders(tenantId: string, vehicleId: string) {
  return this.withSchema(tenantId, async (manager) => {
    const orders = await manager.query<any[]>(
      `SELECT id,
              status,
              status_pagamento    AS "statusPagamento",
              km_entrada          AS "kmEntrada",
              combustivel,
              observacoes_entrada AS "observacoesEntrada",
              created_at          AS "createdAt"
       FROM   service_orders
       WHERE  veiculo_id = $1
       ORDER  BY created_at DESC`,
      [vehicleId],
    );

    if (orders.length === 0) return [];

    const soIds = orders.map((o) => o.id);

    const services = await manager.query<any[]>(
      `SELECT so_id         AS "soId",
              id,
              nome_servico  AS "nomeServico",
              valor,
              mecanico_id   AS "mecanicoId"
       FROM   so_items_services
       WHERE  so_id = ANY($1)`,
      [soIds],
    );

    const parts = await manager.query<any[]>(
      `SELECT so_id          AS "soId",
              id,
              nome_peca      AS "nomePeca",
              quantidade,
              valor_unitario AS "valorUnitario"
       FROM   so_items_parts
       WHERE  so_id = ANY($1)`,
      [soIds],
    );

    return orders.map((o) => {
      const itemsServices = services.filter((s) => s.soId === o.id);
      const itemsParts = parts.filter((p) => p.soId === o.id);
      const totalServices = itemsServices.reduce((acc, s) => acc + Number(s.valor), 0);
      const totalParts = itemsParts.reduce(
        (acc, p) => acc + Number(p.valorUnitario) * Number(p.quantidade),
        0,
      );
      return { ...o, itemsServices, itemsParts, total: totalServices + totalParts };
    });
  });
}
```

### Step 5: Executar e confirmar que os testes passam

```bash
cd apps/backend && npx jest --testPathPattern="vehicles.service" --no-coverage 2>&1 | tail -20
```

Esperado: PASS — todos os testes

### Step 6: Adicionar endpoint ao `vehicles.controller.ts`

Adicione após o método `getById`:

```typescript
@Get(':id/service-orders')
getServiceOrders(
  @Request() req: RequestWithUser,
  @Param('id', ParseUUIDPipe) id: string,
) {
  return this.vehiclesService.getServiceOrders(req.user.tenantId, id);
}
```

### Step 7: Confirmar que toda a suite backend passa

```bash
cd apps/backend && npx jest --no-coverage 2>&1 | tail -10
```

Esperado: todos os testes PASS

### Step 8: Commit

```bash
git add apps/backend/src/modules/workshop/vehicles/vehicles.service.ts \
        apps/backend/src/modules/workshop/vehicles/vehicles.service.spec.ts \
        apps/backend/src/modules/workshop/vehicles/vehicles.controller.ts
git commit -m "feat(vehicles): add getServiceOrders endpoint with items and total"
```

---

## Task 2: Frontend — Instalar @react-pdf/renderer e criar OsPdf

**Files:**
- Modify: `apps/frontend/package.json` (via pnpm add)
- Create: `apps/frontend/src/components/OsPdf.tsx`

### Context

`@react-pdf/renderer` usa um renderer React separado. O componente `OsPdf` é **puro** (sem hooks, sem chamadas de API) e recebe todos os dados via props. Para geração programática, usa-se `pdf(<Documento />).toBlob()`. O pacote inclui tipos TypeScript.

### Step 1: Instalar a dependência

```bash
cd apps/frontend && pnpm add @react-pdf/renderer
```

Verificar que aparece em `apps/frontend/package.json` em `dependencies`.

### Step 2: Criar `apps/frontend/src/components/OsPdf.tsx`

```tsx
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { ServiceOrderDetail } from '../services/service-orders.service';

export interface OsPdfProps {
  so: ServiceOrderDetail;
  empresa: { nomeFantasia: string };
  cliente: { nome: string; cpfCnpj: string };
  veiculo: { placa: string; marca: string; modelo: string; ano: number };
}

const fmt = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const s = StyleSheet.create({
  page:        { padding: 32, fontSize: 10, fontFamily: 'Helvetica' },
  header:      { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  title:       { fontSize: 16, fontWeight: 'bold' },
  sub:         { color: '#555' },
  section:     { marginBottom: 12 },
  sectionHead: { fontSize: 11, fontWeight: 'bold', borderBottomWidth: 1, borderBottomColor: '#ccc', paddingBottom: 4, marginBottom: 6 },
  row:         { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  tHead:       { flexDirection: 'row', backgroundColor: '#f0f0f0', padding: 4, marginBottom: 2 },
  tRow:        { flexDirection: 'row', padding: '2 0', borderBottomWidth: 0.5, borderBottomColor: '#eee' },
  c3:          { flex: 3 },
  c1r:         { flex: 1, textAlign: 'right' },
  signature:   { marginTop: 48, borderTopWidth: 1, borderTopColor: '#333', width: 220, paddingTop: 4, color: '#555' },
});

export function OsPdf({ so, empresa, cliente, veiculo }: OsPdfProps) {
  const totalServices = so.itemsServices.reduce((a, s) => a + Number(s.valor), 0);
  const totalParts = so.itemsParts.reduce(
    (a, p) => a + Number(p.valorUnitario) * Number(p.quantidade),
    0,
  );
  const total = totalServices + totalParts;

  return (
    <Document>
      <Page size="A4" style={s.page}>

        {/* Cabeçalho */}
        <View style={s.header}>
          <Text style={s.title}>{empresa.nomeFantasia}</Text>
          <View>
            <Text>OS #{so.id.slice(0, 8).toUpperCase()}</Text>
            <Text style={s.sub}>{new Date(so.createdAt).toLocaleDateString('pt-BR')}</Text>
          </View>
        </View>

        {/* Cliente e Veículo */}
        <View style={s.section}>
          <Text style={s.sectionHead}>Cliente e Veículo</Text>
          <View style={s.row}>
            <View style={{ flex: 1 }}>
              <Text style={s.sub}>Cliente</Text>
              <Text>{cliente.nome}</Text>
              <Text style={s.sub}>{cliente.cpfCnpj}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.sub}>Veículo</Text>
              <Text>{veiculo.placa} — {veiculo.marca} {veiculo.modelo}</Text>
              <Text style={s.sub}>Ano: {veiculo.ano}</Text>
            </View>
          </View>
        </View>

        {/* Checklist de Entrada */}
        {(so.kmEntrada || so.combustivel || so.observacoesEntrada) && (
          <View style={s.section}>
            <Text style={s.sectionHead}>Checklist de Entrada</Text>
            {so.kmEntrada && (
              <View style={s.row}>
                <Text style={s.sub}>KM:</Text><Text>{so.kmEntrada}</Text>
              </View>
            )}
            {so.combustivel && (
              <View style={s.row}>
                <Text style={s.sub}>Combustível:</Text><Text>{so.combustivel}</Text>
              </View>
            )}
            {so.observacoesEntrada && (
              <View style={s.row}>
                <Text style={s.sub}>Observações:</Text><Text>{so.observacoesEntrada}</Text>
              </View>
            )}
          </View>
        )}

        {/* Serviços */}
        {so.itemsServices.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionHead}>Serviços</Text>
            <View style={s.tHead}>
              <Text style={s.c3}>Descrição</Text>
              <Text style={s.c1r}>Valor</Text>
            </View>
            {so.itemsServices.map((item) => (
              <View key={item.id} style={s.tRow}>
                <Text style={s.c3}>{item.nomeServico}</Text>
                <Text style={s.c1r}>{fmt(Number(item.valor))}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Peças */}
        {so.itemsParts.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionHead}>Peças</Text>
            <View style={s.tHead}>
              <Text style={s.c3}>Descrição</Text>
              <Text style={s.c1r}>Qtd</Text>
              <Text style={s.c1r}>Val. Unit.</Text>
              <Text style={s.c1r}>Subtotal</Text>
            </View>
            {so.itemsParts.map((item) => (
              <View key={item.id} style={s.tRow}>
                <Text style={s.c3}>{item.nomePeca}</Text>
                <Text style={s.c1r}>{item.quantidade}</Text>
                <Text style={s.c1r}>{fmt(Number(item.valorUnitario))}</Text>
                <Text style={s.c1r}>{fmt(Number(item.valorUnitario) * item.quantidade)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Totais */}
        <View style={[s.section, { alignItems: 'flex-end' }]}>
          <View style={s.row}><Text style={[s.sub, { marginRight: 16 }]}>Total Serviços:</Text><Text>{fmt(totalServices)}</Text></View>
          <View style={s.row}><Text style={[s.sub, { marginRight: 16 }]}>Total Peças:</Text><Text>{fmt(totalParts)}</Text></View>
          <View style={[s.row, { marginTop: 4 }]}>
            <Text style={{ fontWeight: 'bold', marginRight: 16 }}>TOTAL GERAL:</Text>
            <Text style={{ fontWeight: 'bold' }}>{fmt(total)}</Text>
          </View>
        </View>

        {/* Assinatura */}
        <View style={s.signature}>
          <Text>Assinatura do Cliente</Text>
        </View>

      </Page>
    </Document>
  );
}
```

### Step 3: Verificar TypeScript

```bash
cd apps/frontend && npx tsc --noEmit 2>&1 | head -20
```

Esperado: sem erros

### Step 4: Commit

```bash
git add apps/frontend/src/components/OsPdf.tsx apps/frontend/package.json pnpm-lock.yaml
git commit -m "feat(pdf): add OsPdf component with @react-pdf/renderer"
```

---

## Task 3: Frontend — companiesService

**Files:**
- Create: `apps/frontend/src/services/companies.service.ts`

### Context

O backend já tem `GET /api/workshop/company` em `CompaniesController.getProfile()`. Não existe frontend service para isso ainda. O campo relevante para o PDF é `nomeFantasia`.

### Step 1: Criar `apps/frontend/src/services/companies.service.ts`

```typescript
import { api } from './api';

export interface CompanyProfile {
  id: string;
  nomeFantasia: string;
  razaoSocial: string;
  cnpj: string;
  telefone: string | null;
  logoUrl: string | null;
}

export const companiesService = {
  async getProfile(): Promise<CompanyProfile> {
    const { data } = await api.get<CompanyProfile>('/workshop/company');
    return data;
  },
};
```

### Step 2: Verificar TypeScript

```bash
cd apps/frontend && npx tsc --noEmit 2>&1 | head -20
```

Esperado: sem erros

### Step 3: Commit

```bash
git add apps/frontend/src/services/companies.service.ts
git commit -m "feat(companies): add companiesService.getProfile to frontend"
```

---

## Task 4: Frontend — Botão "Baixar PDF" na ServiceOrderDetailPage

**Files:**
- Modify: `apps/frontend/src/pages/workshop/service-orders/ServiceOrderDetailPage.tsx`

### Context

A `ServiceOrderDetailPage` já carrega `so` (ServiceOrderDetail), `customer` (Customer) e `vehicle` (Vehicle) em state. Precisamos adicionar:
1. Import de `companiesService` e `CompanyProfile`
2. Import de `OsPdf` e `pdf` (de `@react-pdf/renderer`)
3. State `empresa: CompanyProfile | null`
4. Carregar `empresa` no `useEffect` de mount (separado do `load`, igual ao catalog)
5. Handler `handleDownloadPdf`
6. Botão "Baixar PDF" no header

Leia o arquivo inteiro antes de editar.

### Step 1: Ler o arquivo

```bash
cat apps/frontend/src/pages/workshop/service-orders/ServiceOrderDetailPage.tsx
```

### Step 2: Adicionar imports

Após os imports existentes, adicione:

```typescript
import { pdf } from '@react-pdf/renderer';
import { OsPdf } from '../../../components/OsPdf';
import { companiesService, type CompanyProfile } from '../../../services/companies.service';
```

### Step 3: Adicionar state e useEffect de empresa

Após `const [addPartOpen, setAddPartOpen] = useState(false);`, adicione:

```typescript
const [empresa, setEmpresa] = useState<CompanyProfile | null>(null);
```

Após o `useEffect` de mount do catalog (o que tem `[]` como dependência), adicione um novo:

```typescript
useEffect(() => {
  companiesService.getProfile().then(setEmpresa).catch(() => null);
}, []);
```

### Step 4: Adicionar `handleDownloadPdf`

Após `handleGenerateLink`, adicione:

```typescript
const handleDownloadPdf = async () => {
  if (!so || !empresa || !customer || !vehicle) return;
  try {
    const blob = await pdf(
      <OsPdf
        so={so}
        empresa={{ nomeFantasia: empresa.nomeFantasia }}
        cliente={{ nome: customer.nome, cpfCnpj: customer.cpfCnpj }}
        veiculo={{ placa: vehicle.placa, marca: vehicle.marca, modelo: vehicle.modelo, ano: vehicle.ano }}
      />,
    ).toBlob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `OS-${so.id.slice(0, 8).toUpperCase()}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch {
    setError('Erro ao gerar PDF.');
  }
};
```

### Step 5: Adicionar botão no header

No header, após os botões de transição (o `{nextStatuses.map(...)}` block) e o botão de gerar link, adicione:

```tsx
<Button
  size="small"
  variant="outlined"
  onClick={handleDownloadPdf}
  disabled={!empresa}
>
  Baixar PDF
</Button>
```

### Step 6: Verificar TypeScript

```bash
cd apps/frontend && npx tsc --noEmit 2>&1 | head -20
```

Esperado: sem erros. Se houver erro de tipos do `@react-pdf/renderer`, verifique se o pacote foi instalado corretamente.

### Step 7: Commit

```bash
git add apps/frontend/src/pages/workshop/service-orders/ServiceOrderDetailPage.tsx
git commit -m "feat(service-orders): add PDF download button to detail page"
```

---

## Task 5: Frontend — vehiclesService.getServiceOrders + VehicleHistoryPage

**Files:**
- Modify: `apps/frontend/src/services/vehicles.service.ts`
- Create: `apps/frontend/src/pages/workshop/vehicles/VehicleHistoryPage.tsx`

### Context

Adicionar o tipo `VehicleServiceOrder` e o método `getServiceOrders` ao `vehiclesService` existente. Depois criar a `VehicleHistoryPage` que exibe a timeline de OS do veículo. O campo `status` no response é string (não o enum `SoStatus` — não importar de service-orders para evitar acoplamento desnecessário).

### Step 1: Adicionar tipos e método em `vehicles.service.ts`

Após a interface `CreateVehiclePayload`, adicione:

```typescript
export interface VehicleSoItemService {
  id: string;
  nomeServico: string;
  valor: number;
  mecanicoId: string | null;
}

export interface VehicleSoItemPart {
  id: string;
  nomePeca: string;
  quantidade: number;
  valorUnitario: number;
}

export interface VehicleServiceOrder {
  id: string;
  status: string;
  statusPagamento: string;
  kmEntrada: string | null;
  combustivel: string | null;
  observacoesEntrada: string | null;
  createdAt: string;
  itemsServices: VehicleSoItemService[];
  itemsParts: VehicleSoItemPart[];
  total: number;
}
```

No objeto `vehiclesService`, após `delete`, adicione:

```typescript
async getServiceOrders(id: string): Promise<VehicleServiceOrder[]> {
  const { data } = await api.get<VehicleServiceOrder[]>(
    `/workshop/vehicles/${id}/service-orders`,
  );
  return data;
},
```

### Step 2: Criar `apps/frontend/src/pages/workshop/vehicles/VehicleHistoryPage.tsx`

```tsx
import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Alert, Box, Button, Card, CardContent, Chip,
  CircularProgress, Divider, Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import {
  vehiclesService,
  type Vehicle,
  type VehicleServiceOrder,
} from '../../../services/vehicles.service';

const STATUS_LABEL: Record<string, string> = {
  ORCAMENTO: 'Orçamento',
  APROVADO: 'Aprovado',
  EM_EXECUCAO: 'Em Execução',
  AGUARDANDO_PECA: 'Aguard. Peça',
  FINALIZADA: 'Finalizada',
  ENTREGUE: 'Entregue',
};

const STATUS_COLOR: Record<string, 'default' | 'info' | 'primary' | 'warning' | 'secondary' | 'success'> = {
  ORCAMENTO: 'default',
  APROVADO: 'info',
  EM_EXECUCAO: 'primary',
  AGUARDANDO_PECA: 'warning',
  FINALIZADA: 'secondary',
  ENTREGUE: 'success',
};

const fmt = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function VehicleHistoryPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [orders, setOrders] = useState<VehicleServiceOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [v, os] = await Promise.all([
        vehiclesService.getById(id),
        vehiclesService.getServiceOrders(id),
      ]);
      setVehicle(v);
      setOrders(os);
    } catch {
      setError('Erro ao carregar histórico do veículo.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}><CircularProgress /></Box>;

  return (
    <Box>
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() => navigate('/workshop/vehicles')}
        sx={{ mb: 2 }}
      >
        Veículos
      </Button>

      {vehicle && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="h5" fontWeight="bold">
            {vehicle.placa} — {vehicle.marca} {vehicle.modelo} {vehicle.ano}
          </Typography>
          <Typography variant="subtitle1" color="text.secondary">
            Prontuário do Veículo
          </Typography>
        </Box>
      )}

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {orders.length === 0 && !loading && (
        <Typography color="text.secondary">
          Nenhuma ordem de serviço registrada para este veículo.
        </Typography>
      )}

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {orders.map((o) => {
          const services = o.itemsServices.map((s) => s.nomeServico).join(', ');
          const parts = o.itemsParts
            .map((p) => `${p.nomePeca} x${p.quantidade}`)
            .join(', ');

          return (
            <Card key={o.id} variant="outlined">
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    {new Date(o.createdAt).toLocaleDateString('pt-BR', {
                      day: '2-digit', month: 'long', year: 'numeric',
                    })}
                  </Typography>
                  <Chip
                    label={STATUS_LABEL[o.status] ?? o.status}
                    color={STATUS_COLOR[o.status] ?? 'default'}
                    size="small"
                  />
                </Box>

                {o.kmEntrada && (
                  <Typography variant="body2" color="text.secondary">
                    KM entrada: {o.kmEntrada}
                  </Typography>
                )}

                {services && (
                  <Typography variant="body2" sx={{ mt: 0.5 }}>
                    <strong>Serviços:</strong> {services}
                  </Typography>
                )}

                {parts && (
                  <Typography variant="body2">
                    <strong>Peças:</strong> {parts}
                  </Typography>
                )}

                <Divider sx={{ my: 1 }} />

                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography fontWeight="bold">
                    {fmt(o.total)}
                  </Typography>
                  <Button
                    size="small"
                    onClick={() => navigate(`/workshop/service-orders/${o.id}`)}
                  >
                    Ver OS →
                  </Button>
                </Box>
              </CardContent>
            </Card>
          );
        })}
      </Box>
    </Box>
  );
}
```

### Step 3: Verificar TypeScript

```bash
cd apps/frontend && npx tsc --noEmit 2>&1 | head -20
```

Esperado: sem erros

### Step 4: Commit

```bash
git add apps/frontend/src/services/vehicles.service.ts \
        apps/frontend/src/pages/workshop/vehicles/VehicleHistoryPage.tsx
git commit -m "feat(vehicles): add getServiceOrders method and VehicleHistoryPage"
```

---

## Task 6: Frontend — App.tsx + VehiclesPage botão Histórico

**Files:**
- Modify: `apps/frontend/src/App.tsx`
- Modify: `apps/frontend/src/pages/workshop/vehicles/VehiclesPage.tsx`

### Context

Leia ambos os arquivos antes de editar. O `App.tsx` já tem as rotas de `vehicles/new` e `vehicles/:id/edit`. A nova rota `vehicles/:id/history` deve ficar **antes** de `vehicles/:id/edit` para evitar conflito de matching.

A `VehiclesPage` tem uma coluna "Ações" com ícones de editar e deletar. Adicionar ícone de histórico (pode usar `HistoryIcon` do MUI).

### Step 1: Ler os arquivos

```bash
cat apps/frontend/src/App.tsx
cat apps/frontend/src/pages/workshop/vehicles/VehiclesPage.tsx
```

### Step 2: Atualizar `App.tsx`

Adicionar import:

```typescript
import { VehicleHistoryPage } from './pages/workshop/vehicles/VehicleHistoryPage';
```

Adicionar rota dentro do bloco `/workshop`, após `vehicles/new` e **antes** de `vehicles/:id/edit`:

```tsx
<Route path="vehicles/:id/history" element={<VehicleHistoryPage />} />
```

Resultado da ordem das rotas de vehicles:

```tsx
<Route path="vehicles" element={<VehiclesPage />} />
<Route path="vehicles/new" element={<VehicleFormPage />} />
<Route path="vehicles/:id/history" element={<VehicleHistoryPage />} />
<Route path="vehicles/:id/edit" element={<VehicleFormPage />} />
```

### Step 3: Atualizar `VehiclesPage.tsx`

Adicionar import do ícone (junto com os outros imports do MUI Icons):

```typescript
import HistoryIcon from '@mui/icons-material/History';
```

Na coluna "Ações" de cada linha da tabela, adicionar botão de histórico **antes** do botão de editar:

```tsx
<IconButton
  size="small"
  title="Prontuário"
  onClick={() => navigate(`/workshop/vehicles/${v.id}/history`)}
>
  <HistoryIcon fontSize="small" />
</IconButton>
```

### Step 4: Verificar TypeScript e tests

```bash
cd apps/frontend && npx tsc --noEmit 2>&1 | head -20
```

```bash
cd apps/backend && npx jest --no-coverage 2>&1 | tail -10
```

Esperado: sem erros TypeScript, todos os testes passando

### Step 5: Commit

```bash
git add apps/frontend/src/App.tsx \
        apps/frontend/src/pages/workshop/vehicles/VehiclesPage.tsx
git commit -m "feat(vehicles): add history route and history button in VehiclesPage"
```

---

## Verificação Final

```bash
# Backend — todos os testes
cd apps/backend && npx jest --no-coverage 2>&1 | tail -10

# Frontend — TypeScript
cd apps/frontend && npx tsc --noEmit 2>&1 | head -20

# Frontend — Vitest
cd apps/frontend && npx vitest run 2>&1 | tail -15
```

Todos devem passar sem erros.
