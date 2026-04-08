# CLAUDE.md — Guia de Desenvolvimento Praktikus

Este arquivo é lido pelo Claude Code a cada sessão. Siga estas regras para manter consistência no projeto.

---

## Visão Geral

**Praktikus** é um SaaS multi-tenant para prestadores de serviço (primeiro segmento: oficinas mecânicas). Monorepo pnpm com:
- `apps/backend` — API REST em NestJS + TypeScript
- `apps/frontend` — SPA em React 19 + CoreUI
- `packages/shared` — tipos TypeScript compartilhados (`@praktikus/shared`)

Banco: PostgreSQL com isolamento por **schema por tenant**. Cache: Redis. Billing: Asaas.

---

## Estrutura do Monorepo

| O que criar | Onde criar |
|-------------|-----------|
| Novo módulo de domínio (backend) | `apps/backend/src/modules/<nome>/` |
| Componente reutilizável (frontend) | `apps/frontend/src/components/` |
| Nova página (frontend) | `apps/frontend/src/pages/` |
| Hook customizado (frontend) | `apps/frontend/src/hooks/` |
| Chamada de API (frontend) | `apps/frontend/src/services/` |
| Store Zustand (frontend) | `apps/frontend/src/store/` |
| Tipo ou DTO compartilhado | `packages/shared/src/` |

---

## Padrões Backend (NestJS)

### Estrutura de módulo

Todo módulo deve ter esta estrutura:

```
modules/<nome>/
├── <nome>.module.ts
├── <nome>.controller.ts
├── <nome>.service.ts
├── dto/
│   ├── create-<nome>.dto.ts
│   └── update-<nome>.dto.ts
└── entities/
    └── <nome>.entity.ts
```

### Regras obrigatórias

- **Lógica de negócio SEMPRE no service**, nunca no controller. O controller só recebe a requisição, delega ao service, e retorna a resposta.
- **DTOs com `class-validator`** para toda entrada de dados. Nunca confie em dados brutos da requisição.
- **Entities via TypeORM** com migrations geradas pelo script `migration:generate`. Nunca use `synchronize: true` fora do ambiente de testes.
- **Guards de autenticação/autorização nas rotas** (decorators no controller), não dentro dos services.
- **Testes unitários** em arquivos `*.spec.ts` dentro de `src/`. Testes de integração em `test/integration/`.
- **Injeção de dependência** sempre via construtor — nunca instancie services manualmente.
- **Multi-tenancy**: o contexto do tenant é resolvido pelo `TenancyMiddleware` e disponibilizado via `REQUEST`. Nunca passe `tenantId` como parâmetro de método entre services internos — use o contexto.

### Migrations

```bash
# Gerar migration após alterar uma entity
pnpm --filter backend migration:generate

# Executar migrations pendentes
pnpm --filter backend migration:run

# Reverter última migration
pnpm --filter backend migration:revert
```

Migrations ficam em `apps/backend/src/database/migrations/`. **Nunca edite uma migration já executada em produção.**

---

## Padrões Frontend (React)

### Regras obrigatórias

- **Estado global via Zustand** (`src/store/`). Não use React Context para estado de aplicação — use apenas para injeção de dependência leve (ex: tema, i18n).
- **Chamadas de API apenas em `src/services/`** com axios. Nunca faça chamadas HTTP diretamente dentro de componentes.
- **Formulários com `react-hook-form` + `zod`**. Nunca use `useState` para gerenciar campos de formulário.
- **Sem lógica de negócio em componentes**. Extraia para hooks customizados em `src/hooks/`.
- **Componentes de página** ficam em `src/pages/` e são responsáveis apenas por composição. Lógica vai em hooks, dados vêm do store ou de hooks.
- **Validação de schemas** sempre com `zod`. O schema pode ser importado de `@praktikus/shared` quando for compartilhado com o backend.

---

## Pacote Shared (`packages/shared/`)

Tudo que é usado tanto no backend quanto no frontend deve ficar aqui:
- Tipos de entidades (ex: `User`, `Vehicle`, `ServiceOrder`)
- Enums (ex: `ServiceOrderStatus`, `UserRole`)
- Schemas Zod de validação reutilizáveis

Importe sempre como `@praktikus/shared`:

```typescript
import { ServiceOrderStatus, UserRole } from '@praktikus/shared'
```

---

## Convenções de Nomenclatura

| O que | Convenção | Exemplo |
|-------|-----------|---------|
| Arquivos | kebab-case | `user-service.ts`, `create-user.dto.ts` |
| Classes | PascalCase | `UserService`, `CreateUserDto` |
| Variáveis e funções | camelCase | `userId`, `createUser()` |
| Constantes globais | SCREAMING_SNAKE_CASE | `MAX_RETRY_COUNT` |
| Enums | PascalCase (nome) + SCREAMING_SNAKE_CASE (valores) | `UserRole.OWNER` |
| Tabelas PostgreSQL | snake_case | `service_orders` |
| Colunas PostgreSQL | snake_case | `created_at`, `tenant_schema` |

---

## O que NÃO fazer

- ❌ **Não coloque lógica no controller** — apenas delegação ao service
- ❌ **Não use `synchronize: true` no TypeORM** fora de testes — sempre migrations
- ❌ **Não edite migrations já executadas** — crie uma nova
- ❌ **Não faça chamadas HTTP dentro de componentes React** — use services
- ❌ **Não use `useState` para formulários** — use react-hook-form
- ❌ **Não use React Context para estado global** — use Zustand
- ❌ **Não duplique tipos entre backend e frontend** — coloque em `@praktikus/shared`
- ❌ **Não instancie services manualmente** — use injeção de dependência do NestJS
- ❌ **Não passe `tenantId` como parâmetro entre services** — use o contexto de tenant

---

## Comandos úteis

```bash
# Subir ambiente completo
docker-compose up

# Rodar testes (todos)
pnpm test

# Rodar testes do backend
pnpm --filter backend test

# Rodar testes de integração
pnpm --filter backend test:e2e

# Rodar testes do frontend
pnpm --filter frontend test

# Lint em tudo
pnpm lint

# Gerar e executar migrations
pnpm --filter backend migration:generate
pnpm --filter backend migration:run
```

---

## Fluxo de desenvolvimento

1. Leia o design doc relevante em `docs/plans/` antes de implementar
2. Escreva o teste antes da implementação (TDD quando aplicável)
3. Implemente o mínimo para o teste passar
4. Faça commits frequentes e atômicos
5. Use mensagens de commit no formato: `tipo(escopo): descrição` (ex: `feat(vehicles): add plate validation`)
