# Entrega 4: Catálogo (Serviços e Peças) — Design Document
**Date:** 2026-03-17
**Status:** Approved

---

## 1. Objetivo

Implementar CRUD de serviços (mão de obra) e peças no catálogo da oficina. Ambos são itens de referência usados futuramente na Ordem de Serviço (Entrega 6). Sem controle de estoque no MVP.

---

## 2. Modelo de Dados (tenant schema)

```sql
-- tenant_<uuid>.catalog_services
id           uuid          PK  DEFAULT gen_random_uuid()
nome         varchar       NOT NULL
descricao    varchar       NULLABLE
preco_padrao numeric(10,2) NOT NULL DEFAULT 0
created_at   timestamptz   DEFAULT now()
updated_at   timestamptz   DEFAULT now()

-- tenant_<uuid>.catalog_parts
id             uuid          PK  DEFAULT gen_random_uuid()
nome           varchar       NOT NULL
codigo         varchar       NULLABLE  -- referência/SKU
preco_unitario numeric(10,2) NOT NULL DEFAULT 0
created_at     timestamptz   DEFAULT now()
updated_at     timestamptz   DEFAULT now()
```

Sem `ON DELETE RESTRICT` — relação com OS será implementada na Entrega 6.

---

## 3. Approach: CatalogModule único (Opção A)

Um módulo `workshop/catalog/` com dois controllers, dois services e duas entidades. Segue o mesmo padrão de `customers` e `vehicles`.

---

## 4. Backend API

Todos os endpoints requerem `JwtAuthGuard`. O `tenantId` é lido de `req.user.tenantId`. Deleção requer role `OWNER`.

### Serviços — `/api/workshop/catalog/services`

| Método | Rota  | Descrição                                        | Roles      |
|--------|-------|--------------------------------------------------|------------|
| GET    | /     | Lista paginada. Query: `page`, `limit`, `search` | ALL        |
| GET    | /:id  | Detalhe do serviço                               | ALL        |
| POST   | /     | Criar serviço                                    | ALL        |
| PATCH  | /:id  | Editar serviço                                   | ALL        |
| DELETE | /:id  | Deletar serviço                                  | OWNER only |

### Peças — `/api/workshop/catalog/parts`

| Método | Rota  | Descrição                                        | Roles      |
|--------|-------|--------------------------------------------------|------------|
| GET    | /     | Lista paginada. Query: `page`, `limit`, `search` | ALL        |
| GET    | /:id  | Detalhe da peça                                  | ALL        |
| POST   | /     | Criar peça                                       | ALL        |
| PATCH  | /:id  | Editar peça                                      | ALL        |
| DELETE | /:id  | Deletar peça                                     | OWNER only |

Resposta de listagem: `{ data: T[], total: number, page: number, limit: number }`

---

## 5. Validações

| Campo           | Regra                          |
|-----------------|--------------------------------|
| `nome`          | `@MinLength(2)` — obrigatório  |
| `preco_padrao`  | `@IsNumber()` `@Min(0)`        |
| `preco_unitario`| `@IsNumber()` `@Min(0)`        |
| `descricao`     | Opcional, sem validação        |
| `codigo`        | Opcional, sem validação        |

Search em services: ILIKE em `nome`.
Search em parts: ILIKE em `nome` ou `codigo`.

---

## 6. Frontend

### Página

| Componente   | Rota                  | Descrição                                      |
|--------------|-----------------------|------------------------------------------------|
| `CatalogPage`| `/workshop/catalog`   | Página unificada com abas Serviços / Peças     |

### Abas

- **Serviços:** tabela paginada + busca + botão "Novo Serviço" → formulário em modal
  - Colunas: Nome, Descrição, Preço Padrão, Ações (editar / deletar)
- **Peças:** tabela paginada + busca + botão "Nova Peça" → formulário em modal
  - Colunas: Nome, Código, Preço Unitário, Ações (editar / deletar)

Formulários em **modal MUI Dialog** — poucos campos, não justifica página separada.

### Serviço

- `apps/frontend/src/services/catalog.service.ts`
  - `catalogServicesApi`: `list`, `getById`, `create`, `update`, `delete`
  - `catalogPartsApi`: `list`, `getById`, `create`, `update`, `delete`

---

## 7. Fora do Escopo (v2)

- Controle de estoque (quantidade em estoque)
- Categorias / agrupamentos
- Importação em lote (CSV)
- Histórico de preços
