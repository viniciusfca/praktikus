# Entrega 6: Ordem de Serviço (OS completa) — Design Document
**Date:** 2026-03-23
**Status:** Approved

---

## 1. Objetivo

Implementar o módulo de Ordem de Serviço completo: máquina de estados, checklist de entrada, itens de serviço e peça, atribuição de mecânico, aprovação de orçamento via link público (72h) ou manual, e página pública de aprovação.

---

## 2. Modelo de Dados (tenant schema)

```sql
-- tenant_<uuid>.service_orders
id                  uuid          PK  DEFAULT gen_random_uuid()
appointment_id      uuid          NULLABLE  -- vínculo opcional com agendamento
cliente_id          uuid          NOT NULL  -- sem FK cross-schema
veiculo_id          uuid          NOT NULL  -- sem FK cross-schema
status              varchar       NOT NULL DEFAULT 'ORCAMENTO'
status_pagamento    varchar       NOT NULL DEFAULT 'PENDENTE'
km_entrada          varchar       NULLABLE  -- texto livre
combustivel         varchar       NULLABLE  -- texto livre
observacoes_entrada text          NULLABLE  -- avarias e observações
approval_token      uuid          NULLABLE  -- token para link público
approval_expires_at timestamptz   NULLABLE  -- now() + 72h
created_at          timestamptz   DEFAULT now()
updated_at          timestamptz   DEFAULT now()

-- tenant_<uuid>.so_items_services
id                  uuid    PK  DEFAULT gen_random_uuid()
so_id               uuid    NOT NULL REFERENCES service_orders(id) ON DELETE CASCADE
catalog_service_id  uuid    NOT NULL
nome_servico        varchar NOT NULL  -- snapshot no momento da criação
valor               numeric NOT NULL
mecanico_id         uuid    NULLABLE  -- user ID do mecânico atribuído
created_at          timestamptz DEFAULT now()

-- tenant_<uuid>.so_items_parts
id                  uuid    PK  DEFAULT gen_random_uuid()
so_id               uuid    NOT NULL REFERENCES service_orders(id) ON DELETE CASCADE
catalog_part_id     uuid    NOT NULL
nome_peca           varchar NOT NULL  -- snapshot no momento da criação
quantidade          int     NOT NULL DEFAULT 1
valor_unitario      numeric NOT NULL
created_at          timestamptz DEFAULT now()
```

**Máquina de estados:**
```
ORCAMENTO → APROVADO → EM_EXECUCAO ⇌ AGUARDANDO_PECA
                                    ↓
                                FINALIZADA → ENTREGUE
```

Transições válidas:
- `ORCAMENTO` → `APROVADO`
- `APROVADO` → `EM_EXECUCAO`
- `EM_EXECUCAO` → `AGUARDANDO_PECA`
- `EM_EXECUCAO` → `FINALIZADA`
- `AGUARDANDO_PECA` → `EM_EXECUCAO`
- `FINALIZADA` → `ENTREGUE`

`status_pagamento` é independente: `PENDENTE | PAGO`. Uma OS pode estar `ENTREGUE` e `PENDENTE` financeiramente.

---

## 3. Abordagem: ServiceOrdersModule único

Módulo `workshop/service-orders/` com controller principal, sub-resources de items, e controller público de aprovação. Segue o padrão `withSchema<T>(QueryRunner)` dos módulos anteriores.

---

## 4. Backend API

Todos os endpoints (exceto `/public/quotes`) requerem `JwtAuthGuard`. `tenantId` lido de `req.user.tenantId`.

### Ordens de Serviço — `/api/workshop/service-orders`

| Método | Rota | Descrição | Roles |
|--------|------|-----------|-------|
| GET | / | Lista. Query: `status`, `date_start`, `date_end` | ALL |
| GET | /:id | Detalhe com todos os itens | ALL |
| POST | / | Criar OS | ALL |
| PATCH | /:id | Editar checklist (km, combustível, observações) | ALL |
| PATCH | /:id/status | Transição de status (valida máquina de estados) | ALL¹ |
| PATCH | /:id/payment-status | Marcar PAGO/PENDENTE | OWNER |
| POST | /:id/approval-token | Gerar token UUID (72h) | ALL |
| DELETE | /:id | Deletar OS | OWNER |

¹ EMPLOYEE só pode transicionar se status atual `IN ('ORCAMENTO', 'EM_EXECUCAO')`.

### Itens de Serviço — `/api/workshop/service-orders/:id/items/services`

| Método | Rota | Descrição | Roles |
|--------|------|-----------|-------|
| POST | / | Adicionar item de serviço | ALL |
| DELETE | /:itemId | Remover item | ALL |

### Itens de Peça — `/api/workshop/service-orders/:id/items/parts`

| Método | Rota | Descrição | Roles |
|--------|------|-----------|-------|
| POST | / | Adicionar item de peça | ALL |
| DELETE | /:itemId | Remover item | ALL |

### Aprovação Pública — `/api/public/quotes/:token`

Sem autenticação. Rate-limited via Redis.

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | / | Retorna resumo da OS (cliente, veículo, itens, total) |
| POST | /approve | Aprova orçamento → status `APROVADO`, token invalidado |
| POST | /reject | Recusa → token invalidado, status permanece `ORCAMENTO` |

Erros:
- Token expirado → `410 Gone`
- Token já usado → `409 Conflict`
- Token inválido → `404 Not Found`

---

## 5. Validações

| Campo | Regra |
|-------|-------|
| `cliente_id` | `@IsUUID()` — obrigatório |
| `veiculo_id` | `@IsUUID()` — obrigatório |
| `appointment_id` | `@IsUUID()` `@IsOptional()` |
| `status` (PATCH /status) | `@IsIn([...estados válidos])` |
| `status_pagamento` | `@IsIn(['PENDENTE', 'PAGO'])` |
| `catalog_service_id` | `@IsUUID()` — obrigatório no item serviço |
| `nome_servico` | `@IsString()` `@MinLength(1)` |
| `valor` | `@IsNumber()` `@Min(0)` |
| `mecanico_id` | `@IsUUID()` `@IsOptional()` |
| `catalog_part_id` | `@IsUUID()` — obrigatório no item peça |
| `nome_peca` | `@IsString()` `@MinLength(1)` |
| `quantidade` | `@IsInt()` `@Min(1)` |
| `valor_unitario` | `@IsNumber()` `@Min(0)` |

---

## 6. Frontend

### Páginas

| Componente | Rota | Descrição |
|------------|------|-----------|
| `ServiceOrdersPage` | `/workshop/service-orders` | Lista paginada com filtros |
| `ServiceOrderDetailPage` | `/workshop/service-orders/:id` | Página de detalhe completa |
| `QuoteApprovalPage` | `/quotes/:token` | Aprovação pública (sem auth) |

### Página de Lista

- Filtro por status (chips toggleáveis) + intervalo de datas
- Tabela: Data, Cliente, Veículo, Status, Status Pagamento, Ações (ver, deletar OWNER)
- Botão "Nova OS" → dialog de criação:
  - Cliente (autocomplete)
  - Veículo (autocomplete cascading pelo cliente)
  - Agendamento (autocomplete opcional, filtra pelo cliente selecionado)
  - Checklist: KM entrada, Combustível, Observações

### Página de Detalhe

- **Header**: chips status + status_pagamento + botões de transição disponíveis + "Gerar link de aprovação" (só em ORCAMENTO)
- **Card Dados**: cliente, veículo, agendamento (se vinculado), data de criação
- **Card Checklist**: KM, combustível, observações (editável inline enquanto não ENTREGUE)
- **Card Serviços**: tabela nome/mecânico/valor + botão "Adicionar Serviço" (dialog)
- **Card Peças**: tabela nome/qtd/valor unit/subtotal + botão "Adicionar Peça" (dialog)
- **Card Total**: soma de todos os itens (serviços + peças)
- **Card Aprovação** (só visível em ORCAMENTO com token gerado): link copiável + status + expiração

### Página Pública de Aprovação

- Fora do guard de autenticação (rota pública no React Router)
- Sem sidebar
- Logo/nome da oficina, cliente + veículo, lista de itens, total
- Botões: "Aprovar Orçamento" (verde) / "Recusar" (cinza)
- Estados: token expirado → mensagem de expiração; token já usado → mensagem de status atual

### Serviços Frontend

`apps/frontend/src/services/service-orders.service.ts`
- `serviceOrdersApi`: `list`, `getById`, `create`, `update`, `patchStatus`, `patchPaymentStatus`, `generateApprovalToken`, `delete`
- `soItemsServicesApi`: `create`, `delete`
- `soItemsPartsApi`: `create`, `delete`
- `publicQuotesApi`: `get`, `approve`, `reject`

---

## 7. Fora do Escopo (v2)

- Cancelamento de OS
- Histórico de transições de status (audit log)
- Notificação automática ao cliente (WhatsApp/email) ao gerar link
- Edição de itens existentes (apenas add/remove nesta versão)
- Integração direta com estoque
