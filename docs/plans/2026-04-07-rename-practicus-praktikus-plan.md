# Rename praktikus → Praktikus Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Renomear a marca do produto de "praktikus" para "Praktikus" em todo o código, configuração e documentação do monorepo.

**Architecture:** Find & replace global preservando capitalização (`praktikus` → `Praktikus`, `praktikus` → `praktikus`). Sem mudanças de lógica — apenas texto. Três tarefas agrupadas por categoria, cada uma com seu commit.

**Tech Stack:** PowerShell (sed equivalente no Windows), NestJS, React, pnpm workspaces.

---

## Task 1: Frontend source + testes

**Files:**
- Modify: `apps/frontend/src/layouts/AppLayout.tsx:164`
- Modify: `apps/frontend/src/pages/auth/LoginPage.tsx:61`
- Modify: `apps/frontend/src/pages/auth/RegisterPage.tsx:84`
- Modify: `apps/frontend/src/pages/LandingPage.tsx:29`
- Modify: `apps/frontend/src/App.test.tsx:13`

**Step 1: Fazer as substituições**

Em cada arquivo, substituir `praktikus` por `Praktikus`.

**Step 2: Verificar as substituições**

```bash
grep -n "praktikus\|praktikus" apps/frontend/src/layouts/AppLayout.tsx \
  apps/frontend/src/pages/auth/LoginPage.tsx \
  apps/frontend/src/pages/auth/RegisterPage.tsx \
  apps/frontend/src/pages/LandingPage.tsx \
  apps/frontend/src/App.test.tsx
```
Expected: nenhuma linha com "praktikus" ou "praktikus"

**Step 3: Rodar testes frontend**

```bash
cd apps/frontend && pnpm test -- --watchAll=false 2>&1 | tail -8
```
Expected: todos os testes passam

**Step 4: Build**

```bash
cd apps/frontend && pnpm build 2>&1 | grep -i "error" | head -5
```
Expected: sem erros

**Step 5: Commit**

```bash
git add apps/frontend/src/layouts/AppLayout.tsx \
        apps/frontend/src/pages/auth/LoginPage.tsx \
        apps/frontend/src/pages/auth/RegisterPage.tsx \
        apps/frontend/src/pages/LandingPage.tsx \
        apps/frontend/src/App.test.tsx
git commit -m "chore: rename praktikus → Praktikus in frontend UI and tests"
```

---

## Task 2: Backend source

**Files:**
- Modify: `apps/backend/src/modules/core/billing/billing.service.ts:76`
- Modify: `apps/backend/src/database/data-source.ts:11-13`

**Step 1: Fazer as substituições**

Em `billing.service.ts`, substituir `Plano praktikus` por `Plano Praktikus`.
Em `data-source.ts`, substituir os defaults: `praktikus` → `praktikus`, `praktikus_dev` → `praktikus_dev`.

**Step 2: Verificar**

```bash
grep -n "praktikus\|praktikus" apps/backend/src/modules/core/billing/billing.service.ts \
  apps/backend/src/database/data-source.ts
```
Expected: nenhuma linha

**Step 3: Rodar testes**

```bash
cd apps/backend && npx jest 2>&1 | tail -6
```
Expected: todos os testes passam

**Step 4: Commit**

```bash
git add apps/backend/src/modules/core/billing/billing.service.ts \
        apps/backend/src/database/data-source.ts
git commit -m "chore: rename praktikus → Praktikus in backend source"
```

---

## Task 3: Package configs + Docker + Docs

**Files:**
- Modify: `package.json`
- Modify: `packages/shared/package.json`
- Modify: `apps/backend/package.json`
- Modify: `apps/frontend/package.json`
- Modify: `apps/backend/tsconfig.json`
- Modify: `apps/backend/test/integration/database.module.spec.ts`
- Modify: `docker-compose.yml`
- Modify: `docs/plans/*.md` (todos, exceto os dois docs de rename)

**Step 1: Renomear pacote compartilhado e path alias**

Substituir `@praktikus/shared` → `@praktikus/shared` em:
- `packages/shared/package.json`
- `apps/backend/package.json`
- `apps/frontend/package.json`
- `apps/backend/tsconfig.json`

Substituir `"name": "praktikus"` → `"name": "praktikus"` em `package.json`.

**Step 2: Renomear containers Docker**

Substituir `praktikus_` → `praktikus_` em `docker-compose.yml`.

**Step 3: Atualizar integration test defaults**

Em `apps/backend/test/integration/database.module.spec.ts`, substituir defaults: `praktikus` → `praktikus`, `praktikus_dev` → `praktikus_dev`.

**Step 4: Atualizar docs (exceto docs de rename)**

Substituir `praktikus` → `Praktikus` e `praktikus` → `praktikus` em todos os `.md` de `docs/plans/`, exceto os dois documentos de rename.

**Step 5: Reinstalar dependências**

```bash
pnpm install 2>&1 | tail -5
```

**Step 6: Rodar testes completos**

```bash
cd apps/backend && npx jest 2>&1 | tail -6
cd apps/frontend && pnpm test -- --watchAll=false 2>&1 | tail -6
```

**Step 7: Commit**

```bash
git add package.json packages/shared/package.json \
        apps/backend/package.json apps/frontend/package.json \
        apps/backend/tsconfig.json \
        apps/backend/test/integration/database.module.spec.ts \
        docker-compose.yml docs/plans/ pnpm-lock.yaml
git commit -m "chore: rename praktikus → praktikus in configs, docker and docs"
```

---

## Done

Após as 3 tarefas:
- UI exibe "Praktikus" em todos os pontos de contato com o usuário
- Descrição do plano no Asaas usa "Praktikus"
- Defaults de banco de dados usam `praktikus` / `praktikus_dev`
- Pacote compartilhado é `@praktikus/shared`
- Path alias TypeScript atualizado
- Containers Docker são `praktikus_*`
- Documentação atualizada
