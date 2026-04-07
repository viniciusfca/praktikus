# Rename Praktikus → Praktikus Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Renomear a marca do produto de "Praktikus" para "Praktikus" em todo o código, configuração e documentação do monorepo.

**Architecture:** Find & replace global preservando capitalização (`Praktikus` → `Praktikus`, `Praktikus` → `praktikus`). Sem mudanças de lógica — apenas texto. Três tarefas agrupadas por categoria, cada uma com seu commit.

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

```bash
# AppLayout — brand na sidebar
sed -i 's/Praktikus/Praktikus/g' apps/frontend/src/layouts/AppLayout.tsx

# LoginPage — heading
sed -i 's/Praktikus/Praktikus/g' apps/frontend/src/pages/auth/LoginPage.tsx

# RegisterPage — heading
sed -i 's/Praktikus/Praktikus/g' apps/frontend/src/pages/auth/RegisterPage.tsx

# LandingPage — navbar brand
sed -i 's/Praktikus/Praktikus/g' apps/frontend/src/pages/LandingPage.tsx

# App.test.tsx — regex de texto
sed -i 's/Praktikus/Praktikus/g' apps/frontend/src/App.test.tsx
```

**Step 2: Verificar as substituições**

```bash
grep -n "Praktikus\|Praktikus" apps/frontend/src/layouts/AppLayout.tsx \
  apps/frontend/src/pages/auth/LoginPage.tsx \
  apps/frontend/src/pages/auth/RegisterPage.tsx \
  apps/frontend/src/pages/LandingPage.tsx \
  apps/frontend/src/App.test.tsx
```
Expected: nenhuma linha com "Praktikus" ou "Praktikus"

**Step 3: Rodar testes frontend**

```bash
cd apps/frontend && pnpm test -- --watchAll=false 2>&1 | tail -8
```
Expected: todos os testes passam (incluindo App.test.tsx que agora busca "Praktikus")

**Step 4: Build frontend**

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
git commit -m "chore: rename Praktikus → Praktikus in frontend UI and tests"
```

---

## Task 2: Backend source

**Files:**
- Modify: `apps/backend/src/modules/core/billing/billing.service.ts:76`
- Modify: `apps/backend/src/database/data-source.ts:11-13`

**Step 1: Fazer as substituições**

```bash
# billing.service — descrição do plano no Asaas
sed -i 's/Plano Praktikus/Plano Praktikus/g' apps/backend/src/modules/core/billing/billing.service.ts

# data-source — defaults de conexão com o banco
sed -i "s/'Praktikus'/'praktikus'/g" apps/backend/src/database/data-source.ts
sed -i "s/'Praktikus_dev'/'praktikus_dev'/g" apps/backend/src/database/data-source.ts
```

**Step 2: Verificar**

```bash
grep -n "Praktikus\|Praktikus" apps/backend/src/modules/core/billing/billing.service.ts \
  apps/backend/src/database/data-source.ts
```
Expected: nenhuma linha com "Praktikus" ou "Praktikus"

Confirme que o resultado esperado de `data-source.ts` ficou assim:
```typescript
username: process.env.DB_USER ?? 'praktikus',
password: process.env.DB_PASS ?? 'praktikus_dev',
database: process.env.DB_NAME ?? 'praktikus',
```

**Step 3: Rodar testes backend**

```bash
cd apps/backend && npx jest 2>&1 | tail -6
```
Expected: todos os testes passam

**Step 4: Commit**

```bash
git add apps/backend/src/modules/core/billing/billing.service.ts \
        apps/backend/src/database/data-source.ts
git commit -m "chore: rename Praktikus → Praktikus in backend source"
```

---

## Task 3: Package configs + Docker + Docs

**Files:**
- Modify: `package.json`
- Modify: `packages/shared/package.json`
- Modify: `apps/backend/package.json`
- Modify: `apps/frontend/package.json`
- Modify: `docker-compose.yml`
- Modify: `docs/plans/*.md` (todos)

**Step 1: Renomear pacote compartilhado**

```bash
# Raiz do monorepo
sed -i 's/"name": "Praktikus"/"name": "praktikus"/g' package.json

# Shared package — nome do pacote
sed -i 's/"name": "@Praktikus\/shared"/"name": "@praktikus\/shared"/g' packages/shared/package.json

# Backend — dependency
sed -i 's/"@Praktikus\/shared"/"@praktikus\/shared"/g' apps/backend/package.json

# Frontend — dependency
sed -i 's/"@Praktikus\/shared"/"@praktikus\/shared"/g' apps/frontend/package.json
```

**Step 2: Renomear containers Docker**

```bash
sed -i 's/Praktikus_/praktikus_/g' docker-compose.yml
```

**Step 3: Verificar package.json files e docker-compose**

```bash
grep -n "Praktikus\|Praktikus" package.json packages/shared/package.json \
  apps/backend/package.json apps/frontend/package.json docker-compose.yml
```
Expected: nenhuma ocorrência

**Step 4: Atualizar docs**

```bash
# Substituir em todos os .md dentro de docs/plans
find docs/plans -name "*.md" -exec sed -i 's/Praktikus/Praktikus/g' {} \;
find docs/plans -name "*.md" -exec sed -i 's/Praktikus/praktikus/g' {} \;
```

**Step 5: Verificar docs**

```bash
grep -rn "Praktikus\|Praktikus" docs/plans --include="*.md" | grep -iv "praktikus" | head -5
```
Expected: nenhuma ocorrência

**Step 6: Reinstalar dependências (para atualizar lockfile)**

O rename do `@Praktikus/shared` → `@praktikus/shared` altera o `pnpm-lock.yaml`. Reinstalar para manter consistência:

```bash
pnpm install 2>&1 | tail -5
```
Expected: sem erros (o workspace resolve o pacote pelo novo nome)

**Step 7: Rodar testes completos**

```bash
cd apps/backend && npx jest 2>&1 | tail -6
cd apps/frontend && pnpm test -- --watchAll=false 2>&1 | tail -6
```
Expected: todos passam

**Step 8: Commit**

```bash
git add package.json packages/shared/package.json \
        apps/backend/package.json apps/frontend/package.json \
        docker-compose.yml docs/plans/ pnpm-lock.yaml
git commit -m "chore: rename Praktikus → praktikus in configs, docker and docs"
```

---

## Done

Após as 3 tarefas:
- UI exibe "Praktikus" em todos os pontos de contato com o usuário
- Descrição do plano no Asaas usa "Praktikus"
- Defaults de banco de dados usam `praktikus` / `praktikus_dev`
- Pacote compartilhado é `@praktikus/shared`
- Containers Docker são `praktikus_*`
- Documentação atualizada
