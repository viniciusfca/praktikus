# Entrega 7: PDF e Prontuário do Veículo — Design Document
**Date:** 2026-03-24
**Status:** Approved

---

## 1. Objetivo

Implementar dois recursos: (1) geração de PDF do orçamento de uma OS via `@react-pdf/renderer` no frontend, com download direto; (2) página de prontuário do veículo mostrando o histórico completo de ordens de serviço com itens, KM e mecânico.

---

## 2. Modelo de Dados

Nenhuma tabela nova. Entrega 7 é puramente leitura + geração client-side.

---

## 3. Backend API

### Novo endpoint: `GET /api/workshop/vehicles/:id/service-orders`

Adicionado ao `VehiclesController` e `VehiclesService`. Requer `JwtAuthGuard` + `RolesGuard` (ALL roles). `tenantId` via `req.user.tenantId`. Usa o padrão `withSchema<T>(QueryRunner)`.

**Response:** lista ordenada por `created_at DESC`, cada item:

```ts
{
  id: string
  status: string
  statusPagamento: string
  kmEntrada: string | null
  combustivel: string | null
  observacoesEntrada: string | null
  createdAt: string
  itemsServices: Array<{ id: string; nomeServico: string; valor: number; mecanicoId: string | null }>
  itemsParts: Array<{ id: string; nomePeca: string; quantidade: number; valorUnitario: number }>
  total: number  // calculado no backend: sum(services.valor) + sum(parts.quantidade * valorUnitario)
}
```

Implementado com duas queries separadas (OS + itens via `so_id = ANY($1)`), sem ORM join (padrão existente no projeto).

---

## 4. Frontend

### 4.1 Dependência

```
@react-pdf/renderer  (apps/frontend)
```

### 4.2 PDF da OS

**Componente:** `apps/frontend/src/components/OsPdf.tsx`

Componente puro `@react-pdf/renderer` — sem hooks, sem chamadas de API. Props:

```ts
interface OsPdfProps {
  so: ServiceOrderDetail;
  empresa: { nome: string };
}
```

**Layout do PDF:**

```
[Nome da Oficina]                    OS #[id_curto]
Data: [createdAt]

Cliente: [nome]          Veículo: [placa]
CPF/CNPJ: [...]          Modelo: [marca modelo]
                         Ano: [ano]

Checklist de Entrada
KM: [km_entrada]   Combustível: [combustivel]
Observações: [observacoes_entrada]

Serviços
Nome                              Valor
[nome_servico]                  R$ [valor]

Peças
Nome         Qtd   Val.Unit.    Subtotal
[nome_peca]  [q]   R$[vu]      R$[sub]

Total Serviços: R$ [x]
Total Peças:    R$ [y]
TOTAL GERAL:    R$ [total]

___________________________
Assinatura do Cliente
```

**Botão na `ServiceOrderDetailPage`:**

Botão "Baixar PDF" no header (ao lado dos chips de status). Ao clicar, gera blob e faz download:

```ts
const blob = await pdf(<OsPdf so={so} empresa={empresa} />).toBlob();
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = `OS-${so.id.slice(0, 8)}.pdf`;
a.click();
URL.revokeObjectURL(url);
```

O `empresa` é carregado via `companiesService.getMyCompany()` — endpoint já existente no backend. Adicionado ao `load()` da página.

### 4.3 Prontuário do Veículo

**Página:** `apps/frontend/src/pages/workshop/vehicles/VehicleHistoryPage.tsx`

**Rota:** `/workshop/vehicles/:id/history` (dentro do `PrivateRoute`, adicionada em `App.tsx`)

**Navegação:** botão "Histórico" na linha do veículo na `VehiclesPage`.

**Layout:** lista de cards ordenados por data DESC. Cada card exibe:
- Data de criação + chip de status
- KM de entrada
- Serviços realizados (nomes separados por vírgula)
- Peças utilizadas (nome x qtd)
- Total
- Botão "Ver OS →" que navega para `/workshop/service-orders/:id`

Estado vazio: "Nenhuma ordem de serviço registrada para este veículo."

**Serviço frontend:** método `getServiceOrders(vehicleId: string)` adicionado ao `vehiclesService` existente em `apps/frontend/src/services/vehicles.service.ts`.

---

## 5. Fora do Escopo (v2)

- PDF com logo da oficina (imagem)
- Envio do PDF por e-mail ou WhatsApp
- Assinatura digital
- Exportar prontuário completo como PDF
