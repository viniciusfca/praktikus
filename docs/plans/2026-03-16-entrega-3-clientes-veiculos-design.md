# Entrega 3: Clientes e Veículos — Design Document
**Date:** 2026-03-16
**Status:** Approved

---

## 1. Objetivo

Implementar CRUD de clientes e veículos no contexto multi-tenant da Practicus. Clientes podem ser pessoa física (CPF) ou jurídica (CNPJ). Veículos são obrigatoriamente vinculados a um cliente.

---

## 2. Modelo de Dados (tenant schema)

Tabelas criadas via migration `CreateTenantSchema`, executada em `TenancyService.provisionSchema` a cada novo tenant. Tenants já existentes recebem as tabelas via `IF NOT EXISTS`.

```sql
-- tenant_<uuid>.customers
id          uuid        PK  DEFAULT gen_random_uuid()
nome        varchar     NOT NULL
cpf_cnpj    varchar(14) UNIQUE NOT NULL   -- 11 dígitos (CPF) ou 14 (CNPJ), somente números
whatsapp    varchar     NULLABLE
email       varchar     NULLABLE
created_at  timestamptz DEFAULT now()
updated_at  timestamptz DEFAULT now()

-- tenant_<uuid>.vehicles
id           uuid        PK  DEFAULT gen_random_uuid()
customer_id  uuid        NOT NULL FK → customers(id) ON DELETE RESTRICT
placa        varchar(7)  UNIQUE NOT NULL
marca        varchar     NOT NULL
modelo       varchar     NOT NULL
ano          integer     NOT NULL
km           integer     NOT NULL DEFAULT 0
created_at   timestamptz DEFAULT now()
updated_at   timestamptz DEFAULT now()
```

**Regra:** `ON DELETE RESTRICT` em vehicles → customers. Não é permitido deletar um cliente com veículos cadastrados — o usuário deve remover os veículos primeiro.

---

## 3. Approach: Tenant-Schema Migration

A migration `CreateTenantSchema` é um arquivo TypeScript em `apps/backend/src/database/tenant-migrations/`. O método `TenancyService.provisionSchema` executa esse SQL ao provisionar cada novo tenant, usando `CREATE TABLE IF NOT EXISTS` para idempotência.

Para adicionar entidades futuras (agendamentos, OS, etc.), basta adicionar tabelas ao mesmo arquivo ou criar um novo arquivo de migração de tenant.

---

## 4. Backend API

Todos os endpoints requerem `JwtAuthGuard`. O `tenantId` é lido de `req.user.tenantId` (JWT verificado). Deleção requer role `OWNER`.

### Customers — `/api/workshop/customers`

| Método | Rota   | Descrição                                      | Roles      |
|--------|--------|------------------------------------------------|------------|
| GET    | /      | Lista paginada. Query: `page`, `limit`, `search` | ALL       |
| GET    | /:id   | Detalhe + veículos do cliente                  | ALL        |
| POST   | /      | Criar cliente                                  | ALL        |
| PATCH  | /:id   | Editar cliente                                 | ALL        |
| DELETE | /:id   | Deletar (falha com 409 se tiver veículos)      | OWNER only |

Resposta de listagem: `{ data: CustomerEntity[], total: number, page: number, limit: number }`

### Vehicles — `/api/workshop/vehicles`

| Método | Rota   | Descrição                                      | Roles      |
|--------|--------|------------------------------------------------|------------|
| GET    | /      | Lista paginada. Query: `page`, `limit`, `search` | ALL       |
| GET    | /:id   | Detalhe do veículo                             | ALL        |
| POST   | /      | Criar veículo (body inclui `customerId`)       | ALL        |
| PATCH  | /:id   | Editar veículo                                 | ALL        |
| DELETE | /:id   | Deletar veículo                                | OWNER only |

---

## 5. Validações

| Campo        | Regra                                                                 |
|--------------|-----------------------------------------------------------------------|
| `cpf_cnpj`   | `/^\d{11}$\|^\d{14}$/` — sem dígito verificador no MVP               |
| `placa`      | `/^[A-Z]{3}\d{4}$\|^[A-Z]{3}\d[A-Z]\d{2}$/` — antigo e Mercosul    |
| `ano`        | Entre 1900 e `currentYear + 1`                                       |
| `km`         | Inteiro ≥ 0                                                           |
| `whatsapp`   | Opcional, sem validação de formato no MVP                             |
| `email`      | Opcional, formato de e-mail quando preenchido                         |

Search em customers: filtra por `nome` ILIKE ou `cpf_cnpj` ILIKE.
Search em vehicles: filtra por `placa`, `marca` ou `modelo` ILIKE.

---

## 6. Frontend

### Páginas

| Página               | Rota                              | Descrição                                      |
|----------------------|-----------------------------------|------------------------------------------------|
| `CustomersPage`      | `/workshop/customers`             | Tabela paginada + busca + botão "Novo Cliente" |
| `CustomerFormPage`   | `/workshop/customers/new`         | Formulário de criação                          |
| `CustomerFormPage`   | `/workshop/customers/:id/edit`    | Formulário de edição                           |
| `CustomerDetailPage` | `/workshop/customers/:id`         | Detalhe + veículos vinculados                  |
| `VehiclesPage`       | `/workshop/vehicles`              | Tabela paginada + busca + botão "Novo Veículo" |
| `VehicleFormPage`    | `/workshop/vehicles/new`          | Formulário de criação                          |
| `VehicleFormPage`    | `/workshop/vehicles/:id/edit`     | Formulário de edição                           |

### Tabelas

- **Customers:** colunas Nome, CPF/CNPJ, WhatsApp, Ações (ver / editar / deletar)
- **Vehicles:** colunas Placa, Marca, Modelo, Ano, KM, Cliente, Ações

### Serviços

- `apps/frontend/src/services/customers.service.ts` — métodos: `list`, `getById`, `create`, `update`, `delete`
- `apps/frontend/src/services/vehicles.service.ts` — métodos: `list`, `getById`, `create`, `update`, `delete`

### Integração com rotas existentes

Os links "Clientes" e "Veículos" já existem no sidebar (`AppLayout`). As novas rotas são adicionadas ao `App.tsx` dentro do bloco `PrivateRoute → AppLayout`.

---

## 7. Fora do Escopo (v2)

- Validação de dígito verificador de CPF/CNPJ
- Validação de formato de WhatsApp
- Upload de foto do cliente
- Histórico de veículo (Prontuário) — Entrega 7
