# Design: Rename Practicus → Praktikus

**Data:** 2026-04-07
**Status:** Aprovado

---

## Objetivo

Renomear a marca do produto de "Practicus" para "Praktikus" em todo o código, configuração e documentação do monorepo.

---

## Estratégia

Find & replace global preservando capitalização, em um único commit:

- `Practicus` → `Praktikus`
- `practicus` → `praktikus`

---

## Escopo Completo

### UI (texto visível ao usuário)

| Arquivo | Conteúdo alterado |
|---|---|
| `apps/frontend/src/layouts/AppLayout.tsx` | Brand na sidebar |
| `apps/frontend/src/pages/auth/LoginPage.tsx` | Heading |
| `apps/frontend/src/pages/auth/RegisterPage.tsx` | Heading |
| `apps/frontend/src/pages/LandingPage.tsx` | Navbar brand |

### Backend

| Arquivo | Conteúdo alterado |
|---|---|
| `apps/backend/src/modules/core/billing/billing.service.ts` | Descrição do plano no Asaas |
| `apps/backend/src/database/data-source.ts` | Defaults de DB (`practicus` → `praktikus`, `practicus_dev` → `praktikus_dev`) |

### Package names (infra)

| Arquivo | Conteúdo alterado |
|---|---|
| `package.json` (raiz) | `"name": "practicus"` → `"name": "praktikus"` |
| `packages/shared/package.json` | `@practicus/shared` → `@praktikus/shared` |
| `apps/backend/package.json` | dependency `@practicus/shared` → `@praktikus/shared` |
| `apps/frontend/package.json` | dependency `@practicus/shared` → `@praktikus/shared` |
| `apps/backend/tsconfig.json` | path alias `@practicus/shared` → `@praktikus/shared` |

### Docker

| Arquivo | Conteúdo alterado |
|---|---|
| `docker-compose.yml` | Container names `practicus_*` → `praktikus_*` |

### Testes

| Arquivo | Conteúdo alterado |
|---|---|
| `apps/frontend/src/App.test.tsx` | Regex `/Practicus/i` → `/Praktikus/i` |
| `apps/backend/test/integration/database.module.spec.ts` | DB defaults `practicus` → `praktikus` |

### Documentação

- `docs/plans/*.md` — ~67 ocorrências históricas atualizadas para consistência

---

## Fora do Escopo

- Nome do repositório GitHub (gerenciado fora do código)
- Pasta do projeto no disco (`/Projetos/practicus`) — sem impacto no código
- Variáveis de ambiente reais em `.env` files (não versionadas)

---

## Verificação

Após o rename:
1. `pnpm build` no frontend — zero erros TypeScript
2. `npx jest` no backend — todos os testes passam
3. `pnpm test` no frontend — todos os testes passam
