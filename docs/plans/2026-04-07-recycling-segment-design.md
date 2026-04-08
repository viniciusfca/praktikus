# Segmento Reciclagem — Design Document
**Date:** 2026-04-07
**Status:** Approved

---

## 1. Visão Geral

Novo segmento do Praktikus para **empresas de recicláveis** — compram materiais recicláveis (latinha, papelão, ferro, etc.) de fornecedores, controlam estoque e vendem para empresas compradoras.

O core da plataforma (auth, billing, tenancy, multi-tenancy por schema) é **100% compartilhado** com o segmento oficina. O novo módulo `recycling/` é paralelo ao `workshop/`, seguindo os mesmos padrões arquiteturais.

**Modelo de negócio:** mesmo fluxo de cadastro, trial e cobrança mensal da oficina mecânica.

---

## 2. Arquitetura Geral

### Abordagem: Módulo paralelo isolado

- `apps/backend/src/modules/recycling/` — paralelo a `workshop/`
- `apps/frontend/src/pages/recycling/` — paralelo a `workshop/`
- Único ponto de contato com código existente: campo `segment` na `TenantEntity`

### Campo `segment` no Tenant

```typescript
// packages/shared/src/index.ts
export enum TenantSegment {
  WORKSHOP = 'WORKSHOP',
  RECYCLING = 'RECYCLING',
}
```

```sql
-- public.tenants
ALTER TABLE tenants ADD COLUMN segment VARCHAR DEFAULT 'WORKSHOP';
```

Tenants existentes ficam com `WORKSHOP` por padrão — sem quebra de compatibilidade.

### Roteamento pós-login

```
segment === WORKSHOP  → /workshop/dashboard
segment === RECYCLING → /recycling/dashboard
```

Registro via `/register/recycling` — mesmo formulário atual com `segment = RECYCLING` no payload.

---

## 3. Estrutura de Módulos

### Backend

```
modules/recycling/
├── companies/         # configurações da empresa recicladora
├── employees/         # funcionários + permissões individuais
├── units/             # unidades de medida configuráveis (kg, litro, ton, unidade)
├── products/          # produtos recicláveis + preço por unidade
├── suppliers/         # fornecedores (pessoas que vendem material)
├── purchases/         # compras de material (entrada no estoque + saída no caixa)
├── stock/             # controle de estoque (movimentações + saldo atual)
├── buyers/            # empresas para quem vende o material
├── sales/             # vendas de material (baixa no estoque)
└── cash-register/     # caixa: sessões, entradas, saídas
```

### Frontend

```
pages/recycling/
├── dashboard/
├── cash-register/
├── purchases/
├── stock/
├── sales/
├── suppliers/
├── buyers/
├── products/
├── employees/
└── settings/
```

---

## 4. Banco de Dados (Schema por Tenant)

Todas as tabelas ficam no schema isolado do tenant.

### Unidades de Medida

```sql
units
  id uuid PK
  name varchar          -- "Quilograma"
  abbreviation varchar  -- "kg"
  created_at, updated_at
```

### Produtos

```sql
products
  id uuid PK
  name varchar
  unit_id uuid FK → units
  price_per_unit decimal(10,4)
  active boolean DEFAULT true
  created_at, updated_at
```

### Fornecedores

```sql
suppliers
  id uuid PK
  name varchar
  document varchar       -- CPF ou CNPJ
  document_type varchar  -- 'CPF' | 'CNPJ'
  phone varchar
  address jsonb          -- { street, number, complement, city, state, zip }
  created_at, updated_at
```

### Compradores

```sql
buyers
  id uuid PK
  name varchar
  cnpj varchar
  phone varchar
  contact_name varchar
  created_at, updated_at
```

### Caixa

```sql
cash_sessions
  id uuid PK
  operator_id uuid       -- user que ABRIU a sessão
  closed_by uuid         -- user que FECHOU (pode ser diferente)
  opened_at timestamptz
  closed_at timestamptz
  opening_balance decimal(12,2)
  closing_balance decimal(12,2)
  status varchar         -- 'OPEN' | 'CLOSED'

cash_transactions
  id uuid PK
  cash_session_id uuid FK → cash_sessions
  type varchar           -- 'IN' | 'OUT'
  payment_method varchar -- 'CASH' | 'PIX' | 'CARD'
  amount decimal(12,2)
  description varchar
  reference_id uuid      -- id da compra ou venda que gerou a transação
  reference_type varchar -- 'PURCHASE' | 'SALE' | 'MANUAL'
  created_at timestamptz
```

**Regra:** apenas `payment_method = CASH` impacta o saldo físico do caixa. PIX e cartão são registrados para relatório mas não entram no `closing_balance`.

### Compras

```sql
purchases
  id uuid PK
  supplier_id uuid FK → suppliers
  operator_id uuid       -- user que registrou
  cash_session_id uuid FK → cash_sessions
  payment_method varchar -- 'CASH' | 'PIX' | 'CARD'
  total_amount decimal(12,2)
  purchased_at timestamptz
  notes varchar

purchase_items
  id uuid PK
  purchase_id uuid FK → purchases
  product_id uuid FK → products
  quantity decimal(10,4)
  unit_price decimal(10,4)
  subtotal decimal(12,2)
```

### Vendas

```sql
sales
  id uuid PK
  buyer_id uuid FK → buyers
  operator_id uuid
  sold_at timestamptz
  notes varchar

sale_items
  id uuid PK
  sale_id uuid FK → sales
  product_id uuid FK → products
  quantity decimal(10,4)
  unit_price decimal(10,4)
  subtotal decimal(12,2)
```

### Estoque (Movimentações)

```sql
stock_movements
  id uuid PK
  product_id uuid FK → products
  type varchar           -- 'IN' | 'OUT'
  quantity decimal(10,4)
  reference_id uuid      -- id da compra ou venda
  reference_type varchar -- 'PURCHASE' | 'SALE' | 'MANUAL'
  moved_at timestamptz
```

O saldo atual de um produto é calculado via `SUM` das movimentações — sem campo `current_stock` desnormalizado.

### Permissões de Funcionário

```sql
employee_permissions
  user_id uuid PK        -- FK → public.users
  can_manage_suppliers   boolean DEFAULT true
  can_manage_buyers      boolean DEFAULT false
  can_manage_products    boolean DEFAULT false
  can_open_close_cash    boolean DEFAULT true
  can_view_stock         boolean DEFAULT true
  can_view_reports       boolean DEFAULT false
  can_register_purchases boolean DEFAULT true
  can_register_sales     boolean DEFAULT true
  updated_at timestamptz
```

---

## 5. Roles e Permissões

`OWNER` sempre tem acesso total — sem checagem de `employee_permissions`.
`EMPLOYEE` passa por `EmployeePermissionsGuard` que lê sua linha em `employee_permissions`.

Ao criar um funcionário, uma linha com os defaults acima é criada automaticamente.
O dono edita as permissões na tela de detalhe do funcionário.

---

## 6. Fluxos de Negócio

### Fluxo de Compra

```
POST /recycling/purchases
  1. Valida sessão de caixa OPEN
  2. Cria purchase + purchase_items
  3. Para cada item → cria stock_movement (IN)
  4. CASH → cria cash_transaction (OUT, CASH) — impacta saldo físico
     PIX/CARD → cria cash_transaction (OUT, PIX|CARD) — apenas registro
```

> Saída no caixa porque a empresa paga ao fornecedor — o dinheiro sai do caixa.

### Fluxo do Caixa

```
POST /recycling/cash-register/open
  - Busca closing_balance da última sessão fechada (ou 0 na primeira vez)
  - Cria cash_session com status OPEN
  - Registra operator_id de quem abriu

POST /recycling/cash-register/close
  - Calcula closing_balance = opening_balance + SUM(IN CASH) - SUM(OUT CASH)
  - Atualiza status CLOSED, registra closed_by

GET /recycling/cash-register/current
  - Retorna sessão OPEN ativa com saldo em tempo real
```

Múltiplas sessões por dia são permitidas (suporte a troca de turno).

### Fluxo de Venda

```
POST /recycling/sales
  1. Cria sale + sale_items
  2. Valida estoque suficiente para cada item
  3. Cria stock_movement (OUT) para cada item
  4. Não impacta caixa (v1)
```

---

## 7. Frontend — Navegação

### Sidebar

```
Dashboard
Caixa
Compras
Estoque
Vendas
─────────────
Fornecedores
Compradores
Produtos
─────────────
Funcionários
Configurações  (apenas OWNER)
```

### Telas

| Módulo | Telas |
|---|---|
| Dashboard | Cards: sessão de caixa atual, total comprado hoje, estoque resumido |
| Caixa | Status da sessão + botão abrir/fechar + listagem de transações do dia |
| Compras | Listagem + formulário (fornecedor → itens → pagamento) |
| Estoque | Saldo por produto + histórico de movimentações |
| Vendas | Listagem + formulário (comprador → itens) com baixa no estoque |
| Fornecedores | CRUD (nome, CPF/CNPJ, telefone, endereço) |
| Compradores | CRUD (razão social, CNPJ, telefone, contato) |
| Produtos | CRUD (nome, unidade, preço por unidade) |
| Funcionários | Listagem + criação + tela de edição de permissões individuais |
| Configurações | Dados da empresa + unidades de medida |

---

## 8. Ordem de Implementação (v1)

| # | Entrega | Escopo |
|---|---|---|
| 1 | **Segment + Registro** | Campo `segment` no tenant, rota `/register/recycling`, redirect pós-login, sidebar |
| 2 | **Funcionários + Permissões** | CRUD funcionários, `employee_permissions`, guard, tela de permissões |
| 3 | **Unidades de Medida + Produtos** | CRUD unidades configuráveis, CRUD produtos |
| 4 | **Fornecedores** | CRUD com validação CPF/CNPJ |
| 5 | **Caixa** | Sessões, transações, cálculo de saldo físico, tela de status |
| 6 | **Compras** | Formulário vinculado ao fornecedor, `stock_movements` e `cash_transactions` |
| 7 | **Estoque** | Tela de saldos + histórico de movimentações |
| 8 | **Compradores + Vendas** | CRUD compradores, formulário de venda com baixa no estoque |
| 9 | **Dashboard + Relatórios básicos** | Cards do dashboard, total comprado por dia/período |

---

## 9. Estratégia de Testes

- **Backend:** testes unitários (`.spec.ts`) cobrindo regras críticas — cálculo de saldo do caixa, validação de estoque na venda, atomicidade da compra (compra + movimentações + transação de caixa).
- **Frontend:** testes de componente (React Testing Library) nas páginas de compra e caixa.

---

## 10. Implementações Futuras (pós-validação da v1)

A serem iniciadas após a v1 estar estável e validada em uso real:

| Feature | Descrição |
|---|---|
| Comprovante de compra em PDF | Fundação já pronta com `purchase` vinculado ao fornecedor |
| Contas a receber | Vendas geram títulos a receber; pagamento é lançado no caixa |
| Ajuste manual de estoque | Correções de inventário com justificativa |
| Histórico de preços por produto | Preço do reciclável muda com o mercado; rastrear variações |
| Relatórios avançados | Curva ABC de produtos, produtividade por operador, comparativo por período |
| Impressão de etiqueta de pesagem | Integração com balança para lançamento automático de quantidade |

---

## 11. Fora do Escopo (v1)

- Integração NF-e / NFS-e
- Aplicativo mobile para pesagem
- CRM de fornecedores (histórico de negociações, fidelização)
- Integração bancária para conciliação de PIX/cartão
