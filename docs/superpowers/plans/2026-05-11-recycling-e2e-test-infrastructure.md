# Recycling E2E Test Infrastructure — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar os 6 artefatos (script reset DB, gitignore, helper de dados, templates, playbook e doc de setup) que permitem ao Claude for Chrome executar o smoke E2E do segmento Recycling descrito no spec.

**Architecture:** Scripts TypeScript em `apps/backend/src/scripts/` seguindo o padrão de `seed-admin-dev.ts` (ts-node + AppDataSource). Docs em `docs/qa/`. Sem novas dependências runtime — reusa `ts-node`, `jest`, `@faker-js/faker/locale/pt_BR` (já instalado pelo seed). Cada artefato é independente; podem ser executados em qualquer ordem (mas o plano apresenta numa ordem lógica para reduzir context-switching).

**Tech Stack:** TypeScript + ts-node-register, jest (testes unitários dos geradores), markdown puro para docs/playbook.

**Não-objetivos:** este plano não cria código de produto. O segmento Recycling em si NÃO é tocado.

---

## File Structure

### Criar
- `scripts/.gitkeep` ← (apenas se a pasta `scripts/` ainda não existir; verificar antes)
- `docs/qa/runs/.gitkeep`
- `docs/qa/templates/relatorio-template.md`
- `docs/qa/templates/running-log-template.md`
- `docs/qa/playbook-recycling-e2e.md`
- `docs/qa/setup-claude-for-chrome.md`
- `apps/backend/src/scripts/reset-recycling-db.ts`
- `apps/backend/src/scripts/generate-test-data.ts`
- `apps/backend/src/scripts/generate-test-data.spec.ts`

### Modificar
- `.gitignore` (raiz) — adicionar exceção pra screenshots
- `apps/backend/package.json` — adicionar 2 npm scripts

---

## Task 1: Estrutura `docs/qa/` + `.gitignore`

**Files:**
- Create: `docs/qa/runs/.gitkeep` (vazio — placeholder pra estrutura)
- Modify: `.gitignore` (raiz)

- [ ] **Step 1: Criar a pasta com `.gitkeep`**

Run:
```bash
mkdir -p docs/qa/runs docs/qa/templates
touch docs/qa/runs/.gitkeep
```

Verificar com `ls docs/qa/`. Esperado:
```
runs/  templates/
```

- [ ] **Step 2: Atualizar `.gitignore` raiz**

Adicionar duas linhas ao final do `.gitignore`:

```
# QA E2E run artifacts: keep markdown reports, ignore heavy screenshots
docs/qa/runs/*/screenshots/
```

Validar:
```bash
grep -A1 "QA E2E" .gitignore
```
Esperado: as duas linhas acima aparecem.

- [ ] **Step 3: Commit**

```bash
git add docs/qa/runs/.gitkeep .gitignore
git commit -m "chore(qa): scaffold docs/qa/runs and ignore run screenshots"
```

---

## Task 2: Helper `generate-test-data.ts` (geradores CNPJ/CPF/etc) + tests TDD

**Files:**
- Create: `apps/backend/src/scripts/generate-test-data.ts`
- Create: `apps/backend/src/scripts/generate-test-data.spec.ts`
- Modify: `apps/backend/package.json` (adicionar npm script)

Os geradores também são úteis pra futuros seeds/E2E. Implementação TDD.

- [ ] **Step 1: Escrever os tests primeiro**

Criar `apps/backend/src/scripts/generate-test-data.spec.ts`:

```typescript
import {
  generateCnpj,
  generateCpf,
  isValidCnpj,
  isValidCpf,
  generateMailinatorEmail,
  generatePhoneBr,
  generatePersona,
} from './generate-test-data';

describe('generateCnpj', () => {
  it('returns 14-digit string', () => {
    const cnpj = generateCnpj();
    expect(cnpj).toMatch(/^\d{14}$/);
  });

  it('returns a CNPJ that passes the checksum algorithm', () => {
    for (let i = 0; i < 50; i++) {
      expect(isValidCnpj(generateCnpj())).toBe(true);
    }
  });

  it('rejects known invalid CNPJs', () => {
    expect(isValidCnpj('11111111111111')).toBe(false);
    expect(isValidCnpj('00000000000000')).toBe(false);
    expect(isValidCnpj('12345678901234')).toBe(false);
    expect(isValidCnpj('123')).toBe(false);
    expect(isValidCnpj('')).toBe(false);
  });

  it('accepts known valid CNPJs', () => {
    // famosos válidos para teste (não associados a empresas reais sensíveis)
    expect(isValidCnpj('11222333000181')).toBe(true);
  });
});

describe('generateCpf', () => {
  it('returns 11-digit string', () => {
    const cpf = generateCpf();
    expect(cpf).toMatch(/^\d{11}$/);
  });

  it('returns a CPF that passes the checksum algorithm', () => {
    for (let i = 0; i < 50; i++) {
      expect(isValidCpf(generateCpf())).toBe(true);
    }
  });

  it('rejects known invalid CPFs', () => {
    expect(isValidCpf('11111111111')).toBe(false);
    expect(isValidCpf('00000000000')).toBe(false);
    expect(isValidCpf('12345678900')).toBe(false);
    expect(isValidCpf('')).toBe(false);
  });
});

describe('generateMailinatorEmail', () => {
  it('returns email with @mailinator.com', () => {
    expect(generateMailinatorEmail('qa', 1)).toBe('praktikus-qa-qa-1@mailinator.com');
  });

  it('lowercases the label', () => {
    expect(generateMailinatorEmail('Phase1', 0)).toBe('praktikus-qa-phase1-0@mailinator.com');
  });
});

describe('generatePhoneBr', () => {
  it('returns 11-digit string starting with 9 in the 3rd position', () => {
    const phone = generatePhoneBr();
    expect(phone).toMatch(/^\d{2}9\d{8}$/);
  });
});

describe('generatePersona', () => {
  it('returns a complete persona for signup', () => {
    const persona = generatePersona({ phaseLabel: 'p1', seq: 0 });
    expect(persona).toEqual({
      razaoSocial: expect.any(String),
      nomeFantasia: expect.any(String),
      cnpj: expect.stringMatching(/^\d{14}$/),
      telefone: expect.stringMatching(/^\d{11}$/),
      cep: '01310100',
      ownerName: expect.any(String),
      ownerEmail: 'praktikus-qa-p1-0@mailinator.com',
      ownerCpf: expect.stringMatching(/^\d{11}$/),
      ownerPassword: 'Praktikus@2026',
    });
    expect(isValidCnpj(persona.cnpj)).toBe(true);
    expect(isValidCpf(persona.ownerCpf)).toBe(true);
  });
});
```

- [ ] **Step 2: Rodar tests — devem falhar (módulo não existe)**

Run: `pnpm --filter backend test -- generate-test-data.spec`
Expected: FAIL — `Cannot find module './generate-test-data'`.

- [ ] **Step 3: Implementar o módulo**

Criar `apps/backend/src/scripts/generate-test-data.ts`:

```typescript
import 'reflect-metadata';
import { faker } from '@faker-js/faker/locale/pt_BR';

/**
 * Brazilian fiscal data validators + generators, plus persona helpers
 * for E2E test runs. NOT for production use — generates random valid
 * fiscal numbers without ownership claims.
 */

function randomDigits(n: number): string {
  let out = '';
  for (let i = 0; i < n; i++) out += Math.floor(Math.random() * 10);
  return out;
}

function allSameDigit(s: string): boolean {
  return /^(\d)\1+$/.test(s);
}

// ---------- CNPJ ----------

function cnpjCheckDigit(digits: string, weights: number[]): number {
  let sum = 0;
  for (let i = 0; i < weights.length; i++) {
    sum += parseInt(digits[i], 10) * weights[i];
  }
  const rest = sum % 11;
  return rest < 2 ? 0 : 11 - rest;
}

export function isValidCnpj(cnpj: string): boolean {
  if (!/^\d{14}$/.test(cnpj)) return false;
  if (allSameDigit(cnpj)) return false;
  const W1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const W2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const d13 = cnpjCheckDigit(cnpj.slice(0, 12), W1);
  if (d13 !== parseInt(cnpj[12], 10)) return false;
  const d14 = cnpjCheckDigit(cnpj.slice(0, 13), W2);
  return d14 === parseInt(cnpj[13], 10);
}

export function generateCnpj(): string {
  while (true) {
    const base = randomDigits(8) + '0001';
    const W1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const W2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const d13 = cnpjCheckDigit(base, W1);
    const d14 = cnpjCheckDigit(base + d13, W2);
    const cnpj = `${base}${d13}${d14}`;
    if (!allSameDigit(cnpj)) return cnpj;
  }
}

// ---------- CPF ----------

function cpfCheckDigit(digits: string, factor: number): number {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    sum += parseInt(digits[i], 10) * (factor - i);
  }
  const rest = (sum * 10) % 11;
  return rest === 10 ? 0 : rest;
}

export function isValidCpf(cpf: string): boolean {
  if (!/^\d{11}$/.test(cpf)) return false;
  if (allSameDigit(cpf)) return false;
  const d10 = cpfCheckDigit(cpf.slice(0, 9), 10);
  if (d10 !== parseInt(cpf[9], 10)) return false;
  const d11 = cpfCheckDigit(cpf.slice(0, 10), 11);
  return d11 === parseInt(cpf[10], 10);
}

export function generateCpf(): string {
  while (true) {
    const base = randomDigits(9);
    const d10 = cpfCheckDigit(base, 10);
    const d11 = cpfCheckDigit(`${base}${d10}`, 11);
    const cpf = `${base}${d10}${d11}`;
    if (!allSameDigit(cpf)) return cpf;
  }
}

// ---------- Email / Phone ----------

export function generateMailinatorEmail(phaseLabel: string, seq: number): string {
  return `praktikus-qa-${phaseLabel.toLowerCase()}-${seq}@mailinator.com`;
}

export function generatePhoneBr(): string {
  // formato 11 dígitos: DDD (2) + '9' + 8 dígitos
  const ddd = String(11 + Math.floor(Math.random() * 90)); // 11..100 — quase todos válidos
  return `${ddd.padStart(2, '0').slice(-2)}9${randomDigits(8)}`;
}

// ---------- Persona consolidada ----------

export interface Persona {
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  telefone: string;
  cep: string;
  ownerName: string;
  ownerEmail: string;
  ownerCpf: string;
  ownerPassword: string;
}

export function generatePersona({
  phaseLabel,
  seq,
}: {
  phaseLabel: string;
  seq: number;
}): Persona {
  return {
    razaoSocial: `${faker.company.name()} Reciclagem LTDA`,
    nomeFantasia: `${faker.company.buzzNoun()} Recicla`,
    cnpj: generateCnpj(),
    telefone: generatePhoneBr(),
    cep: '01310100', // Av. Paulista — bom para testar ViaCEP
    ownerName: faker.person.fullName(),
    ownerEmail: generateMailinatorEmail(phaseLabel, seq),
    ownerCpf: generateCpf(),
    ownerPassword: 'Praktikus@2026',
  };
}

// ---------- CLI: pre-generate batch for Claude ----------

if (require.main === module) {
  const count = parseInt(process.argv[2] ?? '1', 10);
  const out: Persona[] = [];
  for (let i = 0; i < count; i++) {
    out.push(generatePersona({ phaseLabel: 'cli', seq: i }));
  }
  process.stdout.write(JSON.stringify(out, null, 2) + '\n');
}
```

- [ ] **Step 4: Rodar tests — devem passar**

Run: `pnpm --filter backend test -- generate-test-data.spec`
Expected: PASS — ~15 testes verdes.

- [ ] **Step 5: Adicionar npm script no `apps/backend/package.json`**

Localizar a seção `"scripts": {` e adicionar (ao lado de `seed:admin-dev`):

```json
"qa:generate-data": "ts-node -r tsconfig-paths/register src/scripts/generate-test-data.ts",
```

Validar:
```bash
pnpm --filter backend qa:generate-data 1
```
Expected: imprime JSON com 1 persona, CNPJ/CPF passam pelo checksum (visualmente verificável).

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/scripts/generate-test-data.ts \
        apps/backend/src/scripts/generate-test-data.spec.ts \
        apps/backend/package.json
git commit -m "feat(qa): generate-test-data helper with CNPJ/CPF validators + tests"
```

---

## Task 3: Script `reset-recycling-db.ts`

**Files:**
- Create: `apps/backend/src/scripts/reset-recycling-db.ts`
- Modify: `apps/backend/package.json` (adicionar npm script `qa:reset-db`)

Drop e recria o schema `public` + roda todas migrations. Seed do admin de plataforma é opcional.

- [ ] **Step 1: Criar o script**

```typescript
// apps/backend/src/scripts/reset-recycling-db.ts
import 'reflect-metadata';
import * as dotenv from 'dotenv';
import { join } from 'node:path';

dotenv.config({ path: join(__dirname, '../../.env') });

import { AppDataSource } from '../database/data-source';

const NODE_ENV = process.env.NODE_ENV ?? 'development';
const DB_NAME = process.env.DB_NAME ?? 'praktikus';

async function listTenantSchemas(): Promise<string[]> {
  const rows: Array<{ schema_name: string }> = await AppDataSource.query(`
    SELECT schema_name FROM information_schema.schemata
    WHERE schema_name LIKE 'tenant_%'
  `);
  return rows.map((r) => r.schema_name);
}

async function main(): Promise<void> {
  if (NODE_ENV === 'production') {
    console.error('[reset-db] BLOCKED — refusing to reset DB in NODE_ENV=production.');
    process.exit(1);
  }

  console.log(`[reset-db] Resetting DB "${DB_NAME}" (NODE_ENV=${NODE_ENV})...`);

  // 1) Init connection
  await AppDataSource.initialize();
  console.log('[reset-db] DataSource initialized');

  // 2) Drop tenant schemas (per-tenant data)
  const tenantSchemas = await listTenantSchemas();
  for (const schema of tenantSchemas) {
    await AppDataSource.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    console.log(`[reset-db] Dropped tenant schema: ${schema}`);
  }

  // 3) Drop and recreate public schema (wipes all public.* tables incl. migrations)
  await AppDataSource.query('DROP SCHEMA IF EXISTS public CASCADE');
  await AppDataSource.query('CREATE SCHEMA public');
  console.log('[reset-db] Public schema dropped + recreated');

  // 4) Close and re-init so TypeORM picks up the empty schema
  await AppDataSource.destroy();
  await AppDataSource.initialize();

  // 5) Run all migrations
  const executed = await AppDataSource.runMigrations();
  console.log(`[reset-db] Ran ${executed.length} migrations`);

  await AppDataSource.destroy();
  console.log('[reset-db] Done. DB is empty + migrated. Ready for fresh signup.');
}

main().catch((err) => {
  console.error('[reset-db] FAILED:', err);
  process.exit(1);
});
```

- [ ] **Step 2: Adicionar npm script no `apps/backend/package.json`**

Adicionar (logo após `qa:generate-data`):

```json
"qa:reset-db": "ts-node -r tsconfig-paths/register src/scripts/reset-recycling-db.ts",
```

- [ ] **Step 3: Smoke test — rodar contra DB local**

Pré-requisito: Postgres rodando (`docker compose up -d postgres`).

Run: `pnpm --filter backend qa:reset-db`

Expected (saída):
```
[reset-db] Resetting DB "praktikus" (NODE_ENV=development)...
[reset-db] DataSource initialized
[reset-db] Dropped tenant schema: tenant_<uuid>   (ou nada se não houver)
[reset-db] Public schema dropped + recreated
[reset-db] Ran N migrations
[reset-db] Done. DB is empty + migrated. Ready for fresh signup.
```

Verificar com `psql`:
```bash
docker exec praktikus_postgres psql -U praktikus -d praktikus -c "\dt public.*"
```
Esperado: lista mostrando `migrations`, `tenants`, `billing`, `billing_invoices`, `users`, etc. — todas vazias.

- [ ] **Step 4: Smoke test — refuse em production**

Run:
```bash
NODE_ENV=production pnpm --filter backend qa:reset-db
```
Expected (stderr):
```
[reset-db] BLOCKED — refusing to reset DB in NODE_ENV=production.
```
Exit code: 1.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/scripts/reset-recycling-db.ts apps/backend/package.json
git commit -m "feat(qa): reset-recycling-db script for clean E2E runs"
```

---

## Task 4: Templates de relatório e running-log

**Files:**
- Create: `docs/qa/templates/relatorio-template.md`
- Create: `docs/qa/templates/running-log-template.md`

Templates Markdown que o Claude copia pra cada run.

- [ ] **Step 1: Criar `relatorio-template.md`**

```markdown
# Relatório de Teste E2E — Segmento Recycling

**Data**: {{YYYY-MM-DD}}
**Ambiente**: Local + Asaas sandbox
**Branch / SHA**: {{branch}} / {{sha}}
**Tempo total**: {{Hh MMmin}}
**Status**: COMPLETO | PARCIAL (bloqueado na Fase X)

---

## Resumo executivo

| Severidade | Quantidade |
|------------|-----------|
| 🚨 Críticos | {{X}} |
| ⚠️ Importantes | {{Y}} |
| 💡 Melhorias UX | {{Z}} |
| ✓ Fluxos validados | {{N}}/11 fases |

**Top 3 riscos**:
1. {{descrição do problema mais grave}}
2. {{segundo}}
3. {{terceiro}}

---

## 🚨 Bugs Críticos

### B-CRIT-001: {{Título descritivo}}

**Fase**: {{N — Nome da fase}}

**Como reproduzir**:
1. {{passo 1}}
2. {{passo 2}}
3. {{...}}

**Esperado**: {{comportamento esperado}}

**Observado**: {{comportamento real}}

**Screenshot**: [{{phaseN-cpM-descricao.png}}](screenshots/{{phaseN-cpM-descricao.png}})

**Notas**: {{erros de console, request 500, payload anômalo, etc.}}

---

## ⚠️ Bugs Importantes

### B-IMP-001: {{Título}}

(Mesmo formato de B-CRIT.)

---

## 💡 Melhorias UX

### UX-001: {{Título}}

**Fase**: {{N — Nome}}

**Contexto**: {{quando observado}}

**Sugestão**: {{melhoria proposta}}

**Screenshot**: [{{path}}](screenshots/{{path}})

---

## ✓ Fluxos validados

Marcar com `[x]` o que passou, `[ ]` o que bloqueou.

- [ ] Fase 1 — Signup Recycling
- [ ] Fase 2 — Configurações iniciais
- [ ] Fase 3 — Cadastros base (produtos, fornecedores, compradores)
- [ ] Fase 4 — Abrir caixa
- [ ] Fase 5 — Compras
- [ ] Fase 6 — Coletas
- [ ] Fase 7 — Vendas
- [ ] Fase 8 — Relatórios (dashboard + reports)
- [ ] Fase 9 — Billing self-service (Asaas Checkout)
- [ ] Fase 10 — Fechar caixa
- [ ] Fase 11 — Logout + relogin (validar TTL 8h)

---

## Apêndice

### Dados gerados durante o teste

- **Tenant**: CNPJ {{cnpj}}, Razão Social "{{razao}}"
- **OWNER user**: email `{{email}}`
- **Fornecedores criados**: {{lista}}
- **Compradores criados**: {{lista}}
- **Produtos**: {{lista}}

### Ambiente

- Node {{vX.Y.Z}} / pnpm {{vA.B.C}} / Docker stack
- Backend SHA: {{sha}}
- Asaas: sandbox.asaas.com ({{token nickname}})
- Resend: dev mode (console.log only)
- Webhook Asaas: {{ngrok URL ou "não configurado"}}

### Running log

Ver [running-log.md](running-log.md) para timeline detalhada com timestamps.
```

- [ ] **Step 2: Criar `running-log-template.md`**

```markdown
# Running Log — Recycling E2E {{YYYY-MM-DD}}

Cronologia da execução. Atualizado pelo Claude a cada checkpoint.

---

## Fase 0 — Setup (humano)

- **Início**: {{HH:MM}}
- **Stack subido**: docker compose ps mostra postgres, redis, backend, frontend UP
- **Asaas sandbox**: chave configurada em .env, webhook apontando para {{URL}}
- **DB resetado**: `pnpm --filter backend qa:reset-db` rodou sem erro
- **Persona gerada**: `pnpm --filter backend qa:generate-data 1` retornou {{CNPJ}}
- **Status**: PRONTO PARA CLAUDE
- **Fim**: {{HH:MM}} ({{X}}min)

---

## Fase 1 — Signup Recycling

- **Início**: {{HH:MM}}
- **Persona usada**: CNPJ {{cnpj}}, email {{email}}, senha "Praktikus@2026"
- **Checkpoints**:
  - [x/✗] CP1: Acessou /register/segment → screenshot phase1-cp1.png
  - [x/✗] CP2: Clicou em "Recicladoras" → redirect /register/recycling → screenshot phase1-cp2.png
  - [x/✗] CP3: Wizard passo 1 salvou OK → screenshot phase1-cp3.png
  - [x/✗] CP4: Wizard passo 2 + submit → redirect /recycling/dashboard → screenshot phase1-cp4.png
  - [x/✗] CP5: Banner trial "30 dias" visível → screenshot phase1-cp5.png
- **Anomalias**: {{descreva qualquer problema ou "nenhuma"}}
- **Bugs registrados**: {{lista de IDs ex: B-IMP-003}}
- **Fim**: {{HH:MM}} ({{X}}min)

---

## Fase 2 — Configurações iniciais

(Mesmo formato para cada uma das 11 fases.)

---

## Resumo final

- **Início absoluto**: {{HH:MM}}
- **Fim absoluto**: {{HH:MM}}
- **Tempo total**: {{Hh MMmin}}
- **Fases COMPLETAS**: {{N}}/11
- **Fases BLOCKED**: {{lista}}
- **Bugs encontrados**: {{contagem por severidade}}
- **Próximo passo**: relatorio.md está pronto em docs/qa/runs/{{YYYY-MM-DD}}/
```

- [ ] **Step 3: Commit**

```bash
git add docs/qa/templates/relatorio-template.md \
        docs/qa/templates/running-log-template.md
git commit -m "docs(qa): add relatorio + running-log templates for E2E runs"
```

---

## Task 5: Playbook executável das 11 fases

**Files:**
- Create: `docs/qa/playbook-recycling-e2e.md`

Esse é o **artefato principal** que o usuário cola na conversa com o Claude for Chrome. Linguagem natural, com pré-condições, checkpoints e validações explícitos.

- [ ] **Step 1: Criar o playbook**

```markdown
# Playbook — Smoke E2E Recycling (Claude for Chrome)

Versão executável das 11 fases descritas em [docs/superpowers/specs/2026-05-11-recycling-e2e-test-plan-design.md](../superpowers/specs/2026-05-11-recycling-e2e-test-plan-design.md).

## Como usar

1. **Faça a Fase 0 (humano)** — veja [setup-claude-for-chrome.md](setup-claude-for-chrome.md) primeiro.
2. **Crie um diretório `docs/qa/runs/YYYY-MM-DD/`** com hoje no nome.
3. **Copie os templates** em `docs/qa/templates/` para esse diretório, renomeando para `relatorio.md` e `running-log.md`.
4. **Cole todo este playbook** na conversa com o Claude for Chrome.
5. **Acompanhe a execução** — Claude vai pedir aprovação antes de cada fase nova; ele preenche o running-log em tempo real.

## Convenções globais

- **Captura screenshot** sempre que o playbook disser "screenshot ✓". Salve em `screenshots/phase{N}-cp{M}-{descricao}.png`.
- **Persona** (Razão Social, CNPJ, email, etc.) é gerada uma vez no início e reutilizada em todo o playbook. Gere com:
  ```bash
  pnpm --filter backend qa:generate-data 1
  ```
  Pegue o JSON e referencie campos pelo nome (`{{persona.cnpj}}`).
- Quando algo der errado, **registre o bug no relatorio.md** com severidade (🚨/⚠️/💡) e **continue** para a próxima fase se possível.
- **Janela**: Desktop apenas, viewport 1280×800 ou maior.

---

## Fase 1 — Signup Recycling

**Pré-condição**: DB resetado, stack rodando, persona gerada.

1. Abra `http://localhost:8080/register/segment`.
2. **Screenshot ✓** (CP1) — confirme que vê o grid de segmentos (Oficina Mecânica, Recicladoras, etc.).
3. Clique no card "Recicladoras".
4. **Checkpoint**: deve redirecionar para `/register/recycling` mostrando um wizard de 2 passos.
5. **Screenshot ✓** (CP2).
6. **Passo 1 do wizard — Dados da Empresa**:
   - CNPJ: `{{persona.cnpj}}` (formate como `XX.XXX.XXX/XXXX-XX` se o campo aceitar máscara)
   - Razão Social: `{{persona.razaoSocial}}`
   - Nome Fantasia: `{{persona.nomeFantasia}}`
   - Telefone: `{{persona.telefone}}` (formate `(XX) 9XXXX-XXXX`)
   - Clique "Próximo".
7. **Screenshot ✓** (CP3) — passo 1 preenchido + botão de avançar.
8. **Passo 2 do wizard — Dados do Responsável**:
   - Nome: `{{persona.ownerName}}`
   - Email: `{{persona.ownerEmail}}`
   - Senha: `Praktikus@2026`
   - Confirmar Senha: `Praktikus@2026`
   - Clique "Criar conta".
9. **Checkpoint**: deve redirecionar para `/recycling/dashboard`.
10. **Screenshot ✓** (CP4) — dashboard vazio.
11. **Checkpoint**: banner amarelo no topo do layout mencionando "trial termina em 30 dias" (ou similar).
12. **Screenshot ✓** (CP5) — banner.
13. **Atualize o running-log.md** com status da Fase 1.

**Bugs comuns a observar**:
- Validações de senha falhando silenciosamente.
- CNPJ aceito sem máscara mas rejeitado com máscara (ou vice-versa).
- Redirect quebrado.
- Banner trial ausente / cor inconsistente.

---

## Fase 2 — Configurações iniciais

**Pré-condição**: Fase 1 OK. Você está logado no `/recycling/dashboard`.

### 2.1 Aba Empresa

1. Vá em `/recycling/settings`.
2. Aba "Empresa" deve estar selecionada por padrão.
3. **Screenshot ✓** (CP1).
4. Preencha o campo CEP com `01310-100` (Av. Paulista).
5. **Checkpoint**: lookup ViaCEP deve preencher Logradouro, Bairro, Cidade, Estado automaticamente.
6. **Screenshot ✓** (CP2) — endereço preenchido.
7. Adicione número `1000` e complemento `Sala 200`.
8. Clique "Salvar". Confirme toast de sucesso.
9. **Screenshot ✓** (CP3).

### 2.2 Aba Unidades de Medida

1. Clique na aba "Unidades de Medida".
2. Crie 3 unidades em sequência:
   - Sigla: `kg`, Descrição: `Quilograma`
   - Sigla: `ton`, Descrição: `Tonelada`
   - Sigla: `un`, Descrição: `Unidade`
3. **Checkpoint**: cada unidade aparece na listagem após salvar.
4. **Screenshot ✓** (CP4) — 3 unidades listadas.

### 2.3 Aba Minha Conta

1. Clique na aba "Minha Conta".
2. Valide que email/nome do OWNER aparecem.
3. **Screenshot ✓** (CP5).
4. **NÃO** altere senha aqui — fica pra teste separado.

### 2.4 Aba Assinatura

1. Clique na aba "Assinatura".
2. **Checkpoint**: deve mostrar "Plano Praktikus R$ 89,90/mês" e status "Trial".
3. **Checkpoint**: "Trial termina em 30 dias" (ou número exato).
4. **Checkpoint**: card "Forma de pagamento" mostra "Nenhuma forma de pagamento cadastrada" + botão "Cadastrar forma de pagamento".
5. **Checkpoint**: histórico de faturas vazio.
6. **Checkpoint**: link "Cancelar assinatura" no rodapé.
7. **NÃO** clique em "Cadastrar forma de pagamento" agora — vai pra Fase 9.
8. **Screenshot ✓** (CP6) — aba inteira.

**Atualize o running-log.md.**

---

## Fase 3 — Cadastros base

### 3.1 Produtos

1. Navegue para `/recycling/products`.
2. Crie 3 produtos clicando "Novo Produto" em cada:

   **Produto 1**:
   - Nome: `Papelão`
   - Unidade: `kg`
   - Preço base: `0,50` (R$/kg)
   - Status: Ativo

   **Produto 2**:
   - Nome: `Alumínio`
   - Unidade: `kg`
   - Preço base: `8,00`
   - Status: Ativo

   **Produto 3**:
   - Nome: `Ferro`
   - Unidade: `kg`
   - Preço base: `1,20`
   - Status: Ativo

3. **Checkpoint**: tabela mostra os 3 produtos.
4. **Screenshot ✓** (CP1) — tabela com produtos.
5. **Investigação**: olhe se existe alguma menção a "Tabela de preço" na UI. Se sim, explore (essa é uma feature que pode ou não ter UI completa). Anote no running-log.

### 3.2 Fornecedores

1. Navegue para `/recycling/suppliers`.
2. Crie 2 fornecedores:

   **Fornecedor 1**:
   - Nome: `Cooperativa Reciclar`
   - CNPJ: gere via `qa:generate-data` (cada execução dá um novo CNPJ válido)
   - Telefone: `(11) 98765-4321`
   - Contato: `Maria Silva`

   **Fornecedor 2**:
   - Nome: `EcoMaterial Comércio`
   - CNPJ: novo válido
   - Telefone: `(11) 91234-5678`
   - Contato: `João Pereira`

3. **Checkpoint**: ambos aparecem na tabela.
4. **Screenshot ✓** (CP2).

### 3.3 Compradores

1. Navegue para `/recycling/buyers`.
2. Crie 2 compradores:

   **Comprador 1**:
   - Nome: `Indústria Verde Ltda`
   - CPF/CNPJ: gere CNPJ válido
   - Telefone: `(11) 99887-7665`
   - Contato: `Ana Costa`

   **Comprador 2**:
   - Nome: `Fundição Sustentável`
   - CPF/CNPJ: gere CNPJ válido
   - Telefone: `(11) 92233-4455`
   - Contato: `Carlos Mendes`

3. **Checkpoint**: ambos aparecem na tabela.
4. **Screenshot ✓** (CP3).

**Atualize o running-log.md.**

---

## Fase 4 — Abrir caixa

1. Navegue para `/recycling/cash-register`.
2. **Checkpoint**: deve mostrar status "Caixa fechado" + botão "Abrir caixa".
3. **Screenshot ✓** (CP1).
4. Clique "Abrir caixa".
5. Saldo inicial: `100,00`.
6. Confirme.
7. **Checkpoint**: status muda para "Caixa aberto" + horário de abertura visível.
8. **Screenshot ✓** (CP2).

**Atualize o running-log.md.**

---

## Fase 5 — Compras

1. Navegue para `/recycling/purchases`.
2. **Checkpoint**: lista vazia + KPIs zerados.
3. **Screenshot ✓** (CP1).
4. Clique "Nova compra".
5. **Passo 1**: selecione fornecedor `Cooperativa Reciclar`.
6. **Screenshot ✓** (CP2) — passo 1.
7. **Passo 2 — Itens**:
   - Adicione `Papelão` × `50` kg × R$ `0,50` = R$ 25,00
   - Adicione `Alumínio` × `10` kg × R$ `8,00` = R$ 80,00
   - Total geral: R$ 105,00
8. **Screenshot ✓** (CP3) — passo 2.
9. **Passo 3 — Pagamento**: Método `PIX`, observações `Compra E2E teste`.
10. **Screenshot ✓** (CP4) — passo 3.
11. Clique "Finalizar".
12. **Checkpoint**: redirect para `/recycling/purchases` (lista) com a nova compra na primeira linha.
13. **Screenshot ✓** (CP5) — listagem com a compra.
14. **Checkpoint extra**: navegue para `/recycling/stock` e confirme:
    - Papelão: 50 kg
    - Alumínio: 10 kg
    - Ferro: 0 kg
15. **Screenshot ✓** (CP6) — estoque.

**Bugs comuns a observar**: total não bate, estoque não atualiza, observações perdidas.

**Atualize o running-log.md.**

---

## Fase 6 — Coletas

1. Navegue para `/recycling/coletas`.
2. **Checkpoint**: calendário semanal vazio.
3. **Screenshot ✓** (CP1).
4. Clique em um horário do calendário (ex: amanhã às 10:00) OU em "Nova coleta" se houver botão.
5. **Passo do form**:
   - Fornecedor: `EcoMaterial Comércio`
   - Data: amanhã
   - Hora início: `10:00`
   - Hora fim: `12:00`
   - Observações: `Coleta de teste`
6. Salve. **Checkpoint**: coleta aparece no calendário com status "AGENDADA".
7. **Screenshot ✓** (CP2).
8. Clique na coleta criada.
9. **Checkpoint**: drawer/modal lateral abre com detalhes.
10. Adicione um comentário: `Lembrar caminhão pequeno`.
11. **Screenshot ✓** (CP3).
12. Procure botão "Marcar como concluída" ou similar. Clique.
13. **Checkpoint**: status muda para "CONCLUÍDA" visualmente (cor diferente).
14. **Screenshot ✓** (CP4).
15. Alternar para visualização em lista (se houver toggle). **Screenshot ✓** (CP5).

**Atualize o running-log.md.**

---

## Fase 7 — Vendas

1. Navegue para `/recycling/sales`.
2. **Checkpoint**: lista vazia + KPIs zerados.
3. **Screenshot ✓** (CP1).
4. Clique "Nova venda".
5. **Passo 1**: selecione comprador `Indústria Verde Ltda`.
6. **Screenshot ✓** (CP2).
7. **Passo 2 — Itens**:
   - Adicione `Papelão` × `30` kg × R$ `0,80` = R$ 24,00
   - **Checkpoint**: o seletor de produto só deve mostrar produtos COM estoque > 0 (Papelão e Alumínio, NÃO Ferro).
   - **Screenshot ✓** (CP3) — dropdown de produtos disponíveis.
8. **Passo 3 — Pagamento**: Método `CASH` (Dinheiro), observações `Venda E2E teste`.
9. Finalize.
10. **Checkpoint**: redirect para lista, venda na primeira linha.
11. **Screenshot ✓** (CP4).
12. Navegue para `/recycling/stock`. **Checkpoint**: Papelão agora 20 kg (50 − 30).
13. **Screenshot ✓** (CP5).
14. Navegue para `/recycling/cash-register`. **Checkpoint**: transação automática de R$ 24,00 (entrada CASH) aparece no histórico.
15. **Screenshot ✓** (CP6).

**Atualize o running-log.md.**

---

## Fase 8 — Relatórios

### 8.1 Dashboard

1. Navegue para `/recycling/dashboard`.
2. **Checkpoint**: KPIs preenchidos:
   - Compras do mês: R$ 105,00
   - Vendas do mês: R$ 24,00
   - kg comprados: 60 kg
   - Receita líquida: R$ −81,00 (ou similar)
3. **Checkpoint**: gráfico de linha mostrando atividade.
4. **Checkpoint**: card "Próximas coletas" com a coleta agendada (se ainda futura).
5. **Checkpoint**: card "Top 5 materiais" com Papelão/Alumínio.
6. **Screenshot ✓** (CP1).

### 8.2 Reports

1. Navegue para `/recycling/reports`.
2. Explore as abas (Compras, Vendas, Top Materiais).
3. **Screenshot ✓** (CP2, CP3, CP4) — uma por aba.
4. Tente um filtro de período (últimos 7/30/90 dias). **Screenshot ✓** (CP5).

**Atualize o running-log.md.**

---

## Fase 9 — Billing self-service ⭐

**Pré-condição CRÍTICA**: `ASAAS_API_KEY` no `.env` aponta para sandbox real, NÃO `mock`. Se for `mock`, pule esta fase com `BLOCKED` e registre como nota.

1. Navegue para `/recycling/settings` → aba "Assinatura".
2. Clique "Cadastrar forma de pagamento".
3. **Checkpoint**: popup do Asaas Checkout abre (janela separada, origem `sandbox.asaas.com`).
4. **Screenshot ✓** (CP1) — popup aberto.
5. **Limitação esperada**: Claude for Chrome pode não conseguir interagir com a janela popup cross-origin. Tente, mas se travar, registre nota e prossiga.
6. Se for possível interagir, preencha cartão de teste:
   - Número: `5162306219378829` (Mastercard sandbox, sempre aprova)
   - Nome no cartão: `TESTE QA`
   - CVV: `123`
   - Validade: `12/29` (ou qualquer futura)
   - Submeta.
7. **Checkpoint**: popup fecha automaticamente OU mostra "pagamento aprovado".
8. Volte para `/recycling/settings` → Assinatura.
9. **Checkpoint** (com webhook funcionando — ngrok configurado):
   - Card "Forma de pagamento" agora mostra `MASTERCARD •••• 8829, vence 12/29`.
   - Botões "Trocar cartão" e "Remover".
10. **Screenshot ✓** (CP2) — cartão exibido.
11. Teste **Cancelar assinatura**:
    - Clique "Cancelar assinatura" no rodapé.
    - Confirme no modal.
    - **Checkpoint**: tela mostra `canceledAt` preenchido. Tenant continua com acesso (status ainda ACTIVE).
12. **Screenshot ✓** (CP3).

**Bugs comuns a observar**:
- Popup bloqueado (browser blocker).
- Webhook não chega → cartão não aparece após retorno.
- ConflictException ao tentar "Cadastrar cartão" depois de cancelar.

**Atualize o running-log.md.**

---

## Fase 10 — Fechar caixa

1. Navegue para `/recycling/cash-register`.
2. **Checkpoint**: status "Aberto" desde a Fase 4. Histórico mostra a transação CASH de R$ 24 (venda).
3. **Screenshot ✓** (CP1).
4. Clique "Fechar caixa".
5. Sistema deve apresentar reconciliação:
   - Saldo inicial: R$ 100,00
   - Vendas CASH: R$ +24,00
   - Compras CASH: R$ 0,00 (compra foi PIX)
   - Saldo final esperado: R$ 124,00
6. **Checkpoint**: confirme R$ 124,00 (com dinheiro físico hipotético).
7. **Screenshot ✓** (CP2) — tela de reconciliação.
8. Confirme fechamento.
9. **Checkpoint**: status volta para "Caixa fechado". Histórico da sessão preservado.
10. **Screenshot ✓** (CP3).

**Atualize o running-log.md.**

---

## Fase 11 — Logout + relogin

1. Abra o dropdown do avatar (canto superior direito).
2. Clique "Sair".
3. **Checkpoint**: redirect para `/login` (ou similar).
4. **Screenshot ✓** (CP1).
5. Faça login com `{{persona.ownerEmail}}` + `Praktikus@2026`.
6. **Checkpoint**: redirect para `/recycling/dashboard`.
7. **Checkpoint CRÍTICO**: countdown da sessão no header deve mostrar `8:00:00` (HH:MM:SS) ou um valor próximo disso. Se mostrar `MM:SS` apenas (ex: `480:00`), é bug.
8. **Screenshot ✓** (CP2) — countdown visível.
9. Navegue rapidamente por:
   - `/recycling/products` — 3 produtos lá.
   - `/recycling/purchases` — compra do P5 lá.
   - `/recycling/sales` — venda do P7 lá.
   - `/recycling/cash-register` — caixa fechado.
10. **Screenshot ✓** (CP3-CP6) — uma página por navegação.

**Atualize o running-log.md com tempo final + resumo.**

---

## Pós-execução

1. Compile o `relatorio.md` a partir do running-log + bugs encontrados.
2. Confira o checklist da Seção "Fluxos validados" do relatório.
3. Confirme que cada bug tem screenshot referenciado.
4. Faça commit do diretório `docs/qa/runs/{{YYYY-MM-DD}}/` (sem os screenshots — eles estão gitignored).

Comando final:
```bash
git add docs/qa/runs/{{YYYY-MM-DD}}/relatorio.md \
        docs/qa/runs/{{YYYY-MM-DD}}/running-log.md
git commit -m "docs(qa): smoke E2E run YYYY-MM-DD — {{N críticos / N importantes / N UX}}"
```

**Fim do playbook.**
```

- [ ] **Step 2: Commit**

```bash
git add docs/qa/playbook-recycling-e2e.md
git commit -m "docs(qa): playbook executável das 11 fases para Claude for Chrome"
```

---

## Task 6: Doc de setup do Claude for Chrome

**Files:**
- Create: `docs/qa/setup-claude-for-chrome.md`

Guia da Fase 0 — o que o humano faz antes de chamar o Claude.

- [ ] **Step 1: Criar o doc**

```markdown
# Setup — Claude for Chrome para Smoke E2E Recycling

Este doc cobre a **Fase 0** do [playbook](playbook-recycling-e2e.md). Faça esses passos no terminal antes de iniciar a conversa com o Claude for Chrome.

## Pré-requisitos no seu computador

- [x] Docker + Docker Compose
- [x] Node 18+ e pnpm 8+
- [x] Chrome com a extensão **Claude for Chrome** instalada e configurada com API key
- [x] (Opcional mas recomendado) **ngrok** ou **cloudflared** para expor o webhook do backend ao Asaas sandbox

## Passo 1: Subir a stack

```bash
docker compose up -d postgres redis backend frontend
```

Aguarde até `docker compose ps` mostrar tudo `healthy` ou `Up`. Tipicamente 30s.

Validar:
```bash
curl -sf http://localhost:3000/api/health || echo "backend não respondeu"
curl -sf http://localhost:8080 -o /dev/null && echo "frontend OK"
```

## Passo 2: Configurar Asaas sandbox

1. Crie/abra sua conta em `https://sandbox.asaas.com`.
2. **Integrações → Chave de API** → copie a chave.
3. Edite `apps/backend/.env` (e/ou `.env` raiz, dependendo de como o docker-compose injeta):

   ```bash
   ASAAS_API_KEY=<chave-do-sandbox>
   ASAAS_API_URL=https://sandbox.asaas.com/api/v3
   ASAAS_WEBHOOK_TOKEN=<token aleatório que você define>
   ```

4. **No painel Asaas sandbox**, **Integrações → Webhooks**:
   - URL: `https://<seu-túnel-ngrok>.ngrok-free.app/api/billing/webhook`
   - Token: mesmo valor de `ASAAS_WEBHOOK_TOKEN`
   - Eventos: marcar `PAYMENT_*`, `CHECKOUT_*`, `SUBSCRIPTION_INACTIVATED`
5. Restart backend pra pegar as envs:

   ```bash
   docker restart praktikus_backend
   ```

### Túnel para webhook (ngrok / cloudflared)

Se você não tiver ngrok/cloudflared, **pule esta etapa**. O popup do Asaas Checkout ainda abre (Fase 9), mas o webhook `CHECKOUT_PAID` não chega no backend local → cartão não aparece automaticamente em `PaymentMethodCard`. Você ainda valida o fluxo visual; só não valida a integração ponta-a-ponta.

Se tiver ngrok:
```bash
ngrok http 3000
```
Use a URL `https://xxx.ngrok-free.app/api/billing/webhook` no painel Asaas.

## Passo 3: Resetar o banco

```bash
pnpm --filter backend qa:reset-db
```

Esperado:
```
[reset-db] Resetting DB "praktikus" (NODE_ENV=development)...
[reset-db] DataSource initialized
[reset-db] Public schema dropped + recreated
[reset-db] Ran N migrations
[reset-db] Done. DB is empty + migrated. Ready for fresh signup.
```

**O script recusa rodar com `NODE_ENV=production`** — é seguro chamar localmente.

## Passo 4: Gerar persona

```bash
pnpm --filter backend qa:generate-data 1
```

Esperado: um JSON com 1 persona (CNPJ/CPF/email/etc.). Copie esse JSON para um arquivo temporário ou cole direto na conversa com o Claude na hora de iniciar a Fase 1.

Exemplo de saída:
```json
[
  {
    "razaoSocial": "EcoCompany Reciclagem LTDA",
    "nomeFantasia": "Sustentável Recicla",
    "cnpj": "12345678000195",
    "telefone": "11912345678",
    "cep": "01310100",
    "ownerName": "Maria Silva",
    "ownerEmail": "praktikus-qa-cli-0@mailinator.com",
    "ownerCpf": "12345678909",
    "ownerPassword": "Praktikus@2026"
  }
]
```

## Passo 5: Preparar o diretório da run

```bash
RUN_DATE=$(date +%Y-%m-%d)
mkdir -p docs/qa/runs/$RUN_DATE/screenshots
cp docs/qa/templates/relatorio-template.md docs/qa/runs/$RUN_DATE/relatorio.md
cp docs/qa/templates/running-log-template.md docs/qa/runs/$RUN_DATE/running-log.md
echo "Run dir: docs/qa/runs/$RUN_DATE/"
```

## Passo 6: Iniciar Claude for Chrome

1. Abra o Chrome com a extensão ativada e API key configurada.
2. Abra uma nova aba em `http://localhost:8080/register/segment` (a tela de escolha de segmento — começa do zero).
3. Abra a extensão Claude for Chrome.
4. **Cole na conversa, nesta ordem**:
   - Conteúdo de `docs/qa/playbook-recycling-e2e.md`.
   - O JSON da persona gerada no Passo 4 (rotulando como "`Persona para o teste`").
   - Uma linha final: "**Execute o playbook na ordem. Pause entre fases para meu OK.**" (ou "Execute tudo direto" se quiser autônomo).
5. Acompanhe a execução. Faça screenshots adicionais manualmente se algo curioso aparecer fora dos checkpoints.

## Após a execução

Veja a Seção "Pós-execução" do playbook.

## Solução de problemas

### Backend mostra 500 em `/api/billing/webhook`
- Verifique se o `ASAAS_WEBHOOK_TOKEN` bate entre `.env` e painel Asaas.
- Verifique logs: `docker logs praktikus_backend | tail -50`.

### Stack sobe mas frontend mostra "conexão recusada"
- Verifique se o frontend está apontando para `localhost:3000` (ver `apps/frontend/.env` ou variável `VITE_API_URL`).

### `qa:reset-db` falha com "permission denied"
- Confirme `DB_USER` e `DB_PASS` no `.env`. O usuário padrão é `praktikus`/`praktikus_dev` em dev.

### Claude for Chrome não interage com o popup Asaas
- É limitação esperada (cross-origin). Registre como nota no relatório e continue.
```

- [ ] **Step 2: Commit**

```bash
git add docs/qa/setup-claude-for-chrome.md
git commit -m "docs(qa): setup guide for Claude for Chrome (Phase 0 of E2E playbook)"
```

---

## Self-Review

**Spec coverage:**
- Seção 1-2 (contexto + decisões): cobertas implicitamente pelo playbook (Task 5) e setup doc (Task 6).
- Seção 3 (cronograma 11 fases): coberta integralmente em Task 5.
- Seção 4 (como Claude opera): coberta em Task 5 (convenções globais) e Task 6 (passo 6).
- Seção 5 (estrutura relatório): coberta em Task 4 (template).
- Seção 6 (setup pré-teste Fase 0): coberta em Task 6.
- Seção 7 (fora do escopo): mencionada no playbook implicitamente (não há instrução pra mobile/permissões).
- Seção 8 (riscos): cobertos em Task 5 (Fase 9 limitação cross-origin) e Task 6 (troubleshooting).
- Seção 9 (próximos passos): TODOS os 6 deliverables têm task dedicada (Tasks 1-6).

**Placeholder scan:** o playbook (Task 5) usa `{{persona.X}}` — esses NÃO são placeholders no sentido de "TBD", são variáveis de substituição runtime. O Claude vai substituir pelos valores do JSON gerado. OK.

**Type consistency:** `generateCnpj`/`generateCpf`/`generatePersona` signatures consistentes em Task 2 (definição) e Task 6 (uso CLI). OK.

Plano completo.
