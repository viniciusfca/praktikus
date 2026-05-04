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
| Novo módulo de domínio (backend) | `apps/backend/src/modules/workshop/<nome>/` (features de oficina) ou `apps/backend/src/modules/core/<nome>/` (auth, billing, infra) |
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
└── <nome>.entity.ts
```

### Regras obrigatórias

- **Lógica de negócio SEMPRE no service**, nunca no controller. O controller só recebe a requisição, delega ao service, e retorna a resposta.
- **DTOs com `class-validator`** para toda entrada de dados. Nunca confie em dados brutos da requisição.
- **Entities via TypeORM** com migrations geradas pelo script `migration:generate`. Nunca use `synchronize: true` fora do ambiente de testes.
- **Guards de autenticação/autorização nas rotas** (decorators no controller), não dentro dos services.
- **Testes unitários** em arquivos `*.spec.ts` dentro de `src/`. Testes de integração em `test/integration/`.
- **Injeção de dependência** sempre via construtor — nunca instancie services manualmente.
- **Multi-tenancy**: o controller extrai `tenantId` de `req.user.tenantId` (pós-guard JWT) e passa explicitamente para cada método do service. Nunca use `req.tenantId` do middleware diretamente nos services — ele não é verificado. Nunca encadeie `tenantId` de service para service sem extrair do controller.

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
- **Formulários com `react-hook-form` + `zod`**. Nunca use `useState` para gerenciar **valores de campos de formulário**. `useState` é permitido para estado de UI local (loading, listas carregadas assincronamente, erros de fetch).
- **Sem lógica de negócio em componentes**. Extraia para hooks customizados em `src/hooks/`.
- **Componentes de página** ficam em `src/pages/` e são responsáveis apenas por composição. Lógica vai em hooks, dados vêm do store ou de hooks.
- **Validação de schemas** sempre com `zod`. O schema pode ser importado de `@praktikus/shared` quando for compartilhado com o backend.

---

## Pacote Shared (`packages/shared/`)

Tudo que é usado tanto no backend quanto no frontend deve ficar aqui:
- Enums atualmente exportados: `Role` (roles de usuário) e `TenantStatus` (status do plano)
- Adicione aqui novos tipos, DTOs e enums que precisem ser compartilhados entre backend e frontend
- Schemas Zod de validação reutilizáveis

Importe sempre como `@praktikus/shared`:

```typescript
import { Role, TenantStatus } from '@praktikus/shared'
```

---

## Convenções de Nomenclatura

| O que | Convenção | Exemplo |
|-------|-----------|---------|
| Arquivos | kebab-case | `user-service.ts`, `create-user.dto.ts` |
| Classes | PascalCase | `UserService`, `CreateUserDto` |
| Variáveis e funções | camelCase | `userId`, `createUser()` |
| Constantes globais | SCREAMING_SNAKE_CASE | `MAX_RETRY_COUNT` |
| Enums | PascalCase (nome) + SCREAMING_SNAKE_CASE (valores) | `Role.OWNER`, `TenantStatus.ACTIVE` |
| Tabelas PostgreSQL | snake_case | `service_orders` |
| Colunas PostgreSQL | snake_case | `created_at`, `tenant_schema` |

---

## O que NÃO fazer

- ❌ **Não coloque lógica no controller** — apenas delegação ao service
- ❌ **Não use `synchronize: true` no TypeORM** fora de testes — sempre migrations
- ❌ **Não edite migrations já executadas** — crie uma nova
- ❌ **Não faça chamadas HTTP dentro de componentes React** — use services
- ❌ **Não use `useState` para valores de campos de formulário** — use react-hook-form. `useState` para estado de UI local (loading, erros, listas async) é permitido.
- ❌ **Não use React Context para estado global** — use Zustand
- ❌ **Não duplique tipos entre backend e frontend** — coloque em `@praktikus/shared`
- ❌ **Não instancie services manualmente** — use injeção de dependência do NestJS
- ❌ **Não use `req.tenantId` do middleware nos services** — sempre extraia `tenantId` de `req.user.tenantId` no controller (pós-guard) e passe explicitamente

---

## Qualidade de Código (Sonar)

Antes de qualquer `git push`:

1. SonarQube precisa estar de pé: `docker compose --profile sonar up -d`
2. Rodar `pnpm sonar:check` e aguardar quality gate verde
3. Issues new-code: corrigir todas, ou suprimir falsos positivos com `// NOSONAR(rule:S####) — justificativa em pt-BR`
4. Push só após gate verde

**Sem exceção em código novo.** O pre-push hook bloqueia automaticamente. `git push --no-verify` é reservado a hotfix urgente e deve ser justificado no commit message.

### Setup inicial (uma vez)

1. `docker compose --profile sonar up -d` — sobe SonarQube + Postgres dedicado
2. Aguardar ~60s até `curl http://localhost:9000/api/system/status` retornar `"status":"UP"`
3. `pnpm sonar:bootstrap` — cria projeto, quality gate "Praktikus" e token via API
4. Copiar a linha `SONAR_TOKEN=...` da saída para `apps/backend/.env` (não commitar)

### Quality gate (referência)

**Em new code (bloqueia push):**
- 0 bugs (qualquer severidade)
- 0 vulnerabilities (qualquer severidade)
- 100% security hotspots reviewed
- < 3% linhas duplicadas
- ≥ 80% coverage (frontend e shared excluídos do cálculo via `sonar.coverage.exclusions`)

**Em overall code (não bloqueia, só dashboard):**
- Dívida histórica visível, atacada gradualmente

Code smells em new code: warning, não bloqueia.

### Em planos de implementação

Todo plano gerado via `/superpowers:writing-plans` deve terminar com a task **"Quality Gate (Sonar)"**. Use o template em [`docs/superpowers/specs/_quality-gate-task-template.md`](docs/superpowers/specs/_quality-gate-task-template.md) — copie como última task do plano. **Sem exceção.**

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
