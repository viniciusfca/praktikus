# Sonar Quality Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Estabelecer SonarQube Community Edition rodando local em Docker, com pre-push hook (husky) que bloqueia push se quality gate falhar, regra explícita em `CLAUDE.md`, e template de task obrigatório em todo plano gerado via `writing-plans`.

**Architecture:** SonarQube + Postgres dedicado sobem em perfil Compose `sonar` (não interferem com `docker compose up` normal). Script de bootstrap (`scripts/sonar-bootstrap.mjs`) cria projeto, quality gate "Praktikus" e token via API REST — zero passos manuais no UI. Pre-push hook (husky) roda coverage + scanner + polling do gate antes de liberar push.

**Tech Stack:** Docker Compose · SonarQube 10 Community · Husky · Node ESM scripts · Jest (backend coverage) · Vitest + @vitest/coverage-v8 (frontend/shared coverage).

**Spec:** [docs/superpowers/specs/2026-04-28-sonar-quality-gate-design.md](../specs/2026-04-28-sonar-quality-gate-design.md) (commit `5ca4fbf`)

---

## File Structure

**Criar:**
- `scripts/sonar-bootstrap.mjs` — cria projeto + gate + token via API
- `scripts/sonar-bootstrap.test.mjs` — testes unitários das funções pure
- `scripts/sonar-wait-gate.mjs` — faz polling do gate até OK ou ERROR
- `scripts/sonar-wait-gate.test.mjs` — testes unitários
- `sonar-project.properties` — config do scanner na raiz
- `.husky/pre-push` — hook bloqueante
- `docs/superpowers/specs/_quality-gate-task-template.md` — template a ser colado como última task de planos futuros
- `packages/shared/vitest.config.ts` — adicionar config de coverage (já existe, modificar)

**Modificar:**
- `docker-compose.yml` — adicionar serviços `sonarqube` + `sonar-postgres` em `profiles: [sonar]`
- `package.json` (raiz) — scripts `sonar:bootstrap`, `sonar:wait-gate`, `sonar:check`, `prepare`; devDep `husky`
- `apps/backend/.env.example` — adicionar `SONAR_TOKEN=`
- `apps/frontend/vite.config.ts` — adicionar config de coverage v8
- `apps/frontend/package.json` — script `test:cov`, devDep `@vitest/coverage-v8`
- `packages/shared/vitest.config.ts` — adicionar config de coverage
- `packages/shared/package.json` — script `test:cov`, devDep `@vitest/coverage-v8`
- `CLAUDE.md` — nova seção "Qualidade de Código (Sonar)"

---

## Convenções importantes

1. Commit por task com mensagem `tipo(escopo): descrição` (ex: `chore(sonar): add docker compose service`).
2. Branch atual: `redesign/praktikus-v2`. Não trocar.
3. Pre-push hook **não** deve usar `--no-verify` por padrão; reservado a hotfix.
4. Scripts ESM (`.mjs`) na pasta `scripts/` da raiz.
5. Node 18 local trava `typeorm` CLI mas Sonar roda via Docker — não é afetado.
6. Senha admin do SonarQube no setup local: `admin/Praktikus@2026!` (config no script de bootstrap; **não** é credencial de produção, é ambiente de dev pessoal).
7. **Última task (Task 11) é meta-task obrigatória** — usa o template criado na Task 10 pra validar o próprio trabalho.

---

## Task 1: Docker Compose — adicionar SonarQube + Postgres dedicado

**Files:**
- Modify: `docker-compose.yml`

- [ ] **Step 1: Adicionar serviços e volumes**

Substituir o bloco `volumes:` no fim do `docker-compose.yml` por:

```yaml
  sonar-postgres:
    image: postgres:15-alpine
    container_name: praktikus_sonar_postgres
    profiles: [sonar]
    environment:
      POSTGRES_USER: sonar
      POSTGRES_PASSWORD: sonar_dev
      POSTGRES_DB: sonar
    volumes:
      - sonar_postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U sonar -d sonar']
      interval: 10s
      timeout: 5s
      retries: 5

  sonarqube:
    image: sonarqube:10-community
    container_name: praktikus_sonarqube
    profiles: [sonar]
    depends_on:
      sonar-postgres:
        condition: service_healthy
    environment:
      SONAR_JDBC_URL: jdbc:postgresql://sonar-postgres:5432/sonar
      SONAR_JDBC_USERNAME: sonar
      SONAR_JDBC_PASSWORD: sonar_dev
    ports:
      - '9000:9000'
    volumes:
      - sonarqube_data:/opt/sonarqube/data
      - sonarqube_logs:/opt/sonarqube/logs
      - sonarqube_extensions:/opt/sonarqube/extensions
    ulimits:
      nofile:
        soft: 65536
        hard: 65536

volumes:
  postgres_data:
  redis_data:
  sonar_postgres_data:
  sonarqube_data:
  sonarqube_logs:
  sonarqube_extensions:
```

- [ ] **Step 2: Subir o perfil sonar**

Run: `docker compose --profile sonar up -d sonarqube`
Expected: 2 containers up (sonar-postgres healthy, sonarqube starting). Pode demorar ~60s até o Sonar terminar de inicializar.

- [ ] **Step 3: Aguardar SonarQube ficar UP**

Run com timeout (Sonar leva ~30-60s pra subir):

```bash
for i in {1..60}; do
  STATUS=$(curl -sf http://localhost:9000/api/system/status 2>/dev/null | grep -o '"status":"[^"]*"' || echo "down")
  echo "Tentativa $i: $STATUS"
  if echo "$STATUS" | grep -q '"status":"UP"'; then echo "✅ Sonar UP"; break; fi
  sleep 3
done
```

Expected: ao final, `✅ Sonar UP`. Se timeout sem UP, ler logs com `docker logs praktikus_sonarqube` e reportar BLOCKED.

- [ ] **Step 4: Acessar dashboard**

Abrir `http://localhost:9000` no browser. Login: `admin/admin`. Apenas confirmar que carrega (não mexer ainda — bootstrap é via API na Task 2).

- [ ] **Step 5: Commit**

```bash
git add docker-compose.yml
git commit -m "chore(sonar): add sonarqube service to docker compose under 'sonar' profile"
```

---

## Task 2: Script de bootstrap — criar projeto, gate e token via API (TDD nas funções pure)

**Files:**
- Create: `scripts/sonar-bootstrap.mjs`
- Create: `scripts/sonar-bootstrap.test.mjs`

> **Estratégia de teste:** funções pure (parsers, builders) têm teste unitário. As chamadas à API são integration — validamos rodando o script de fato no fim da task.

- [ ] **Step 1: Criar pasta `scripts/` e teste falhando**

Run: `mkdir -p scripts`

Criar `scripts/sonar-bootstrap.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildBasicAuth,
  qualityGateConditions,
  isAlreadyExists,
} from './sonar-bootstrap.mjs';

test('buildBasicAuth produz header Basic com base64', () => {
  const h = buildBasicAuth('admin', 'admin');
  assert.equal(h, 'Basic ' + Buffer.from('admin:admin').toString('base64'));
});

test('buildBasicAuth com token usa empty password', () => {
  const h = buildBasicAuth('squ_xyz', '');
  assert.equal(h, 'Basic ' + Buffer.from('squ_xyz:').toString('base64'));
});

test('qualityGateConditions tem 5 condições alinhadas com a spec', () => {
  const conds = qualityGateConditions();
  assert.equal(conds.length, 5);
  const metrics = conds.map((c) => c.metric);
  assert.deepEqual(metrics.sort(), [
    'new_coverage',
    'new_duplicated_lines_density',
    'new_security_hotspots_reviewed',
    'new_security_rating',
    'new_reliability_rating',
  ].sort());
});

test('qualityGateConditions usa "new_" prefix em todas (gate só vale em new code)', () => {
  for (const c of qualityGateConditions()) {
    assert.ok(c.metric.startsWith('new_'), `${c.metric} deveria começar com new_`);
  }
});

test('isAlreadyExists detecta erro de duplicidade do Sonar', () => {
  assert.equal(isAlreadyExists({ errors: [{ msg: 'Project key already exists' }] }), true);
  assert.equal(isAlreadyExists({ errors: [{ msg: 'A project with key X already exists' }] }), true);
  assert.equal(isAlreadyExists({ errors: [{ msg: 'Other error' }] }), false);
  assert.equal(isAlreadyExists({}), false);
  assert.equal(isAlreadyExists(null), false);
});
```

- [ ] **Step 2: Rodar teste, esperar falha**

Run: `node --test scripts/sonar-bootstrap.test.mjs 2>&1 | tail -10`
Expected: erro de import (`Cannot find module './sonar-bootstrap.mjs'`).

- [ ] **Step 3: Implementar o script**

Criar `scripts/sonar-bootstrap.mjs`:

```js
#!/usr/bin/env node
/**
 * Bootstrap idempotente do SonarQube local pra Praktikus.
 * Cria: senha admin (se ainda for default), projeto, quality gate, token.
 * Pode rodar várias vezes sem efeito colateral.
 */

const HOST = process.env.SONAR_HOST ?? 'http://localhost:9000';
const PROJECT_KEY = 'praktikus';
const PROJECT_NAME = 'Praktikus';
const GATE_NAME = 'Praktikus';
const NEW_ADMIN_PASS = 'Praktikus@2026!';
const TOKEN_NAME = 'praktikus-local';

export function buildBasicAuth(user, pass) {
  return 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64');
}

export function qualityGateConditions() {
  // Cada condição: gate falha se a métrica em new code violar o limite.
  // op=GT (greater than), op=LT (less than). error é o threshold.
  return [
    // Reliability rating em new code: A=1, B=2, C=3, D=4, E=5. Bug = degrada o rating.
    // GT 1 = falha se houver QUALQUER bug em new code.
    { metric: 'new_reliability_rating', op: 'GT', error: '1' },
    // Security rating em new code: idem. Vuln = degrada rating.
    { metric: 'new_security_rating', op: 'GT', error: '1' },
    // % de hotspots novos revisados. LT 100 = falha se < 100% revisados.
    { metric: 'new_security_hotspots_reviewed', op: 'LT', error: '100' },
    // Duplicação em new code. GT 3 = falha se > 3%.
    { metric: 'new_duplicated_lines_density', op: 'GT', error: '3' },
    // Coverage em new code. LT 80 = falha se < 80%.
    { metric: 'new_coverage', op: 'LT', error: '80' },
  ];
}

export function isAlreadyExists(body) {
  if (!body || !Array.isArray(body.errors)) return false;
  return body.errors.some((e) => /already exists/i.test(e.msg ?? ''));
}

async function http(method, path, auth, body) {
  const url = `${HOST}${path}`;
  const headers = { Authorization: auth };
  let init = { method, headers };
  if (body) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    init.body = new URLSearchParams(body).toString();
  }
  const res = await fetch(url, init);
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* not json */ }
  return { status: res.status, body: json, raw: text };
}

async function login(user, pass) {
  const auth = buildBasicAuth(user, pass);
  const { status } = await http('GET', '/api/authentication/validate', auth);
  if (status === 200) return auth;
  throw new Error(`Login falhou para ${user}`);
}

async function changeAdminPasswordIfDefault() {
  // Tenta com nova senha primeiro
  try {
    return await login('admin', NEW_ADMIN_PASS);
  } catch { /* não é a nova ainda */ }

  const adminAuth = await login('admin', 'admin');
  const { status, body } = await http('POST', '/api/users/change_password', adminAuth, {
    login: 'admin',
    previousPassword: 'admin',
    password: NEW_ADMIN_PASS,
  });
  if (status !== 204 && status !== 200) {
    throw new Error(`Falha ao trocar senha admin: ${status} ${JSON.stringify(body)}`);
  }
  console.log('✅ Senha admin atualizada');
  return await login('admin', NEW_ADMIN_PASS);
}

async function ensureProject(auth) {
  const { status, body } = await http('POST', '/api/projects/create', auth, {
    project: PROJECT_KEY,
    name: PROJECT_NAME,
  });
  if (status === 200) {
    console.log('✅ Projeto criado:', PROJECT_KEY);
    return;
  }
  if (isAlreadyExists(body)) {
    console.log('ℹ️  Projeto já existe:', PROJECT_KEY);
    return;
  }
  throw new Error(`Falha ao criar projeto: ${status} ${JSON.stringify(body)}`);
}

async function ensureQualityGate(auth) {
  // Cria o gate (se já existe, ok)
  const { status, body } = await http('POST', '/api/qualitygates/create', auth, {
    name: GATE_NAME,
  });
  let gateId;
  if (status === 200) {
    gateId = body.id;
    console.log('✅ Quality gate criado:', GATE_NAME);
  } else if (isAlreadyExists(body)) {
    const list = await http('GET', '/api/qualitygates/list', auth);
    const found = list.body?.qualitygates?.find((g) => g.name === GATE_NAME);
    if (!found) throw new Error('Gate "Praktikus" alegadamente existe mas não foi encontrado.');
    gateId = found.id;
    console.log('ℹ️  Quality gate já existe:', GATE_NAME);
  } else {
    throw new Error(`Falha ao criar gate: ${status} ${JSON.stringify(body)}`);
  }

  // Garantir condições — primeiro busca as existentes
  const show = await http('GET', `/api/qualitygates/show?name=${encodeURIComponent(GATE_NAME)}`, auth);
  const existing = show.body?.conditions ?? [];

  for (const desired of qualityGateConditions()) {
    const match = existing.find((c) => c.metric === desired.metric);
    if (match && match.op === desired.op && String(match.error) === String(desired.error)) {
      continue; // Já correto
    }
    if (match) {
      // Atualiza
      await http('POST', '/api/qualitygates/update_condition', auth, {
        id: match.id,
        metric: desired.metric,
        op: desired.op,
        error: desired.error,
      });
      console.log(`  ✓ condição atualizada: ${desired.metric}`);
    } else {
      // Cria nova
      await http('POST', '/api/qualitygates/create_condition', auth, {
        gateName: GATE_NAME,
        metric: desired.metric,
        op: desired.op,
        error: desired.error,
      });
      console.log(`  ✓ condição criada: ${desired.metric} ${desired.op} ${desired.error}`);
    }
  }

  // Atribui o gate ao projeto
  await http('POST', '/api/qualitygates/select', auth, {
    gateName: GATE_NAME,
    projectKey: PROJECT_KEY,
  });
  console.log(`✅ Gate "${GATE_NAME}" atribuído ao projeto ${PROJECT_KEY}`);
}

async function ensureToken(auth) {
  // Revoga token antigo com mesmo nome (se houver) pra emitir novo
  await http('POST', '/api/user_tokens/revoke', auth, { name: TOKEN_NAME });

  const { status, body } = await http('POST', '/api/user_tokens/generate', auth, {
    name: TOKEN_NAME,
    type: 'PROJECT_ANALYSIS_TOKEN',
    projectKey: PROJECT_KEY,
  });
  if (status !== 200) {
    throw new Error(`Falha ao gerar token: ${status} ${JSON.stringify(body)}`);
  }
  return body.token;
}

async function main() {
  console.log('🚀 Bootstrap SonarQube em', HOST);

  // Aguarda Sonar UP
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`${HOST}/api/system/status`);
      const j = await r.json();
      if (j.status === 'UP') break;
      console.log(`  Sonar status: ${j.status} (tentativa ${i + 1}/60)`);
    } catch {
      console.log(`  Sonar inacessível (tentativa ${i + 1}/60)`);
    }
    await new Promise((r) => setTimeout(r, 3000));
  }

  const auth = await changeAdminPasswordIfDefault();
  await ensureProject(auth);
  await ensureQualityGate(auth);
  const token = await ensureToken(auth);

  console.log('\n────────────────────────────────────────');
  console.log('✅ Bootstrap concluído.');
  console.log('SONAR_TOKEN=' + token);
  console.log('────────────────────────────────────────');
  console.log('\nAdicione esta linha ao seu apps/backend/.env (não commite):');
  console.log(`  SONAR_TOKEN=${token}`);
}

// Só roda main se este arquivo for o entry point (não em import dos testes)
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error('❌', err.message);
    process.exit(1);
  });
}
```

- [ ] **Step 4: Rodar testes — espera-se passar**

Run: `node --test scripts/sonar-bootstrap.test.mjs 2>&1 | tail -10`
Expected: 5 testes passando.

- [ ] **Step 5: Rodar o bootstrap pra valer**

Run: `node scripts/sonar-bootstrap.mjs`
Expected: saída terminando com `✅ Bootstrap concluído.` e linha `SONAR_TOKEN=squ_...`.

Copiar o token. **NÃO** commitar.

- [ ] **Step 6: Commit**

```bash
git add scripts/sonar-bootstrap.mjs scripts/sonar-bootstrap.test.mjs
git commit -m "chore(sonar): add idempotent bootstrap script (project, gate, token via API)"
```

---

## Task 3: sonar-project.properties + atualizar .env.example

**Files:**
- Create: `sonar-project.properties`
- Modify: `apps/backend/.env.example`

- [ ] **Step 1: Criar sonar-project.properties na raiz**

```properties
sonar.projectKey=praktikus
sonar.projectName=Praktikus
sonar.host.url=http://localhost:9000
sonar.token=${env.SONAR_TOKEN}

sonar.sources=apps/backend/src,apps/frontend/src,packages/shared/src
sonar.tests=apps/backend/src,apps/frontend/src,packages/shared/src
sonar.test.inclusions=**/*.spec.ts,**/*.spec.tsx,**/*.test.ts,**/*.test.tsx
sonar.exclusions=**/node_modules/**,**/dist/**,**/coverage/**,**/*.spec.ts,**/*.spec.tsx,**/*.test.ts,apps/backend/src/database/migrations/**,apps/backend/src/database/tenant-migrations/**

sonar.javascript.lcov.reportPaths=apps/backend/coverage/lcov.info,apps/frontend/coverage/lcov.info,packages/shared/coverage/lcov.info
sonar.typescript.tsconfigPath=tsconfig.json

# Coverage threshold só vale pra backend.
# Excluir frontend e shared do cálculo agregado de coverage faz com que
# a métrica "Coverage on New Code" reflita só backend, sem precisar de
# condição por path no quality gate (não suportado em todas as edições).
sonar.coverage.exclusions=apps/frontend/**,packages/shared/**

sonar.sourceEncoding=UTF-8
```

- [ ] **Step 2: Atualizar apps/backend/.env.example**

Adicionar ao final do arquivo:

```bash

# Sonar (gerado pelo scripts/sonar-bootstrap.mjs após subir o serviço)
SONAR_TOKEN=
```

- [ ] **Step 3: Adicionar SONAR_TOKEN ao seu apps/backend/.env real**

Manualmente, edite `apps/backend/.env` e cole `SONAR_TOKEN=<token-da-task-2>`. **Não commite o .env.**

- [ ] **Step 4: Commit**

```bash
git add sonar-project.properties apps/backend/.env.example
git commit -m "chore(sonar): add sonar-project.properties and SONAR_TOKEN env var"
```

---

## Task 4: Coverage do frontend (vitest + @vitest/coverage-v8)

**Files:**
- Modify: `apps/frontend/vite.config.ts`
- Modify: `apps/frontend/package.json`

- [ ] **Step 1: Instalar @vitest/coverage-v8**

Run: `pnpm --filter frontend add -D @vitest/coverage-v8`
Expected: dep adicionada em `apps/frontend/package.json`.

- [ ] **Step 2: Atualizar vite.config.ts**

Substituir o conteúdo atual de `apps/frontend/vite.config.ts` por:

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      reportsDirectory: './coverage',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        '**/*.spec.tsx',
        '**/*.test.tsx',
        '**/*.spec.ts',
        '**/*.test.ts',
        'src/main.tsx',
        'src/vite-env.d.ts',
        'src/test/**',
        '**/dist/**',
      ],
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
```

- [ ] **Step 3: Adicionar script test:cov**

No `apps/frontend/package.json`, na seção `scripts`, adicionar:

```json
"test:cov": "vitest run --coverage"
```

- [ ] **Step 4: Rodar e verificar lcov gerado**

Run: `pnpm --filter frontend test:cov 2>&1 | tail -10`
Expected: testes rodam, `apps/frontend/coverage/lcov.info` é gerado.

Verificar: `test -f apps/frontend/coverage/lcov.info && echo "✅ lcov.info gerado" || echo "❌ não gerado"`

- [ ] **Step 5: Garantir que coverage/ está no .gitignore**

Run: `grep -E "^coverage|/coverage" .gitignore || echo "coverage/" >> .gitignore`

Verificar: `grep coverage .gitignore`

- [ ] **Step 6: Commit**

```bash
git add apps/frontend/vite.config.ts apps/frontend/package.json pnpm-lock.yaml .gitignore
git commit -m "chore(frontend): enable vitest coverage with lcov reporter"
```

---

## Task 5: Coverage do shared (mesmo padrão)

**Files:**
- Modify: `packages/shared/vitest.config.ts`
- Modify: `packages/shared/package.json`

- [ ] **Step 1: Instalar @vitest/coverage-v8**

Run: `pnpm --filter @praktikus/shared add -D @vitest/coverage-v8`

- [ ] **Step 2: Atualizar vitest.config.ts**

Substituir o conteúdo de `packages/shared/vitest.config.ts` por:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.spec.ts'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      reportsDirectory: './coverage',
      include: ['src/**/*.ts'],
      exclude: [
        '**/*.spec.ts',
        '**/*.test.ts',
        'src/index.ts',
        '**/dist/**',
      ],
    },
  },
});
```

- [ ] **Step 3: Adicionar script test:cov no package.json**

Em `packages/shared/package.json`, na seção `scripts`, adicionar:

```json
"test:cov": "vitest run --coverage"
```

- [ ] **Step 4: Rodar e verificar lcov**

Run: `pnpm --filter @praktikus/shared test:cov 2>&1 | tail -10`
Expected: testes rodam, `packages/shared/coverage/lcov.info` é gerado.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/vitest.config.ts packages/shared/package.json pnpm-lock.yaml
git commit -m "chore(shared): enable vitest coverage with lcov reporter"
```

---

## Task 6: scripts/sonar-wait-gate.mjs (TDD nas funções pure)

**Files:**
- Create: `scripts/sonar-wait-gate.mjs`
- Create: `scripts/sonar-wait-gate.test.mjs`

- [ ] **Step 1: Escrever teste falhando**

Criar `scripts/sonar-wait-gate.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatFailure, parseGateStatus } from './sonar-wait-gate.mjs';

test('parseGateStatus extrai status OK', () => {
  const body = { projectStatus: { status: 'OK', conditions: [] } };
  assert.equal(parseGateStatus(body), 'OK');
});

test('parseGateStatus extrai status ERROR', () => {
  const body = { projectStatus: { status: 'ERROR', conditions: [] } };
  assert.equal(parseGateStatus(body), 'ERROR');
});

test('parseGateStatus retorna PENDING quando body é vazio ou inválido', () => {
  assert.equal(parseGateStatus(null), 'PENDING');
  assert.equal(parseGateStatus({}), 'PENDING');
  assert.equal(parseGateStatus({ projectStatus: {} }), 'PENDING');
});

test('formatFailure lista apenas condições em ERROR com metric e thresholds', () => {
  const body = {
    projectStatus: {
      status: 'ERROR',
      conditions: [
        { status: 'OK', metricKey: 'new_coverage', actualValue: '95', errorThreshold: '80' },
        { status: 'ERROR', metricKey: 'new_duplicated_lines_density', actualValue: '5.2', errorThreshold: '3' },
        { status: 'ERROR', metricKey: 'new_security_rating', actualValue: '3', errorThreshold: '1' },
      ],
    },
  };
  const out = formatFailure(body);
  assert.match(out, /new_duplicated_lines_density.*5\.2.*3/);
  assert.match(out, /new_security_rating.*3.*1/);
  assert.doesNotMatch(out, /new_coverage/);
});

test('formatFailure retorna mensagem padrão se sem condições', () => {
  assert.match(formatFailure({}), /sem detalhes/i);
});
```

- [ ] **Step 2: Rodar — espera-se erro de import**

Run: `node --test scripts/sonar-wait-gate.test.mjs 2>&1 | tail -5`
Expected: erro de módulo não encontrado.

- [ ] **Step 3: Implementar o script**

Criar `scripts/sonar-wait-gate.mjs`:

```js
#!/usr/bin/env node
/**
 * Faz polling no quality gate do projeto Praktikus até OK ou ERROR.
 * Sai 0 em sucesso, 1 em falha de gate, 2 em timeout.
 */

const HOST = process.env.SONAR_HOST ?? 'http://localhost:9000';
const PROJECT = 'praktikus';
const TOKEN = process.env.SONAR_TOKEN ?? '';
const TIMEOUT_MS = Number(process.env.SONAR_GATE_TIMEOUT_MS ?? 120_000);
const POLL_MS = 2_000;

export function parseGateStatus(body) {
  return body?.projectStatus?.status ?? 'PENDING';
}

export function formatFailure(body) {
  const conds = body?.projectStatus?.conditions ?? [];
  const failed = conds.filter((c) => c.status === 'ERROR');
  if (failed.length === 0) return 'Quality gate falhou (sem detalhes).';
  const lines = failed.map(
    (c) => `  - ${c.metricKey}: atual=${c.actualValue}, limite=${c.errorThreshold}`,
  );
  return ['❌ Quality gate falhou:', ...lines].join('\n');
}

async function fetchStatus() {
  const auth = 'Basic ' + Buffer.from(`${TOKEN}:`).toString('base64');
  const res = await fetch(
    `${HOST}/api/qualitygates/project_status?projectKey=${PROJECT}`,
    { headers: { Authorization: auth } },
  );
  if (!res.ok) {
    throw new Error(`Sonar API ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

async function main() {
  if (!TOKEN) {
    console.error('❌ SONAR_TOKEN não definido. Adicione ao apps/backend/.env e re-rode.');
    process.exit(1);
  }

  const start = Date.now();
  while (Date.now() - start < TIMEOUT_MS) {
    try {
      const body = await fetchStatus();
      const status = parseGateStatus(body);
      if (status === 'OK') {
        console.log('✅ Quality gate verde.');
        process.exit(0);
      }
      if (status === 'ERROR') {
        console.error(formatFailure(body));
        console.error(
          `\nLista detalhada de issues new-code:\n  curl -s -u "$SONAR_TOKEN:" "${HOST}/api/issues/search?componentKeys=praktikus&resolved=false&inNewCodePeriod=true" | jq '.issues[] | {key, rule, severity, message, component, line}'`,
        );
        process.exit(1);
      }
    } catch (err) {
      console.error('Aguardando análise:', err.message);
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
  console.error('❌ Timeout aguardando quality gate.');
  process.exit(2);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
```

- [ ] **Step 4: Rodar testes — espera-se passar**

Run: `node --test scripts/sonar-wait-gate.test.mjs 2>&1 | tail -5`
Expected: 5 testes passando.

- [ ] **Step 5: Commit**

```bash
git add scripts/sonar-wait-gate.mjs scripts/sonar-wait-gate.test.mjs
git commit -m "chore(sonar): add wait-gate polling script with unit tests"
```

---

## Task 7: package.json raiz — scripts e devDep husky

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Instalar husky**

Run: `pnpm add -Dw husky`
Expected: `husky` adicionado em `devDependencies` do `package.json` raiz.

- [ ] **Step 2: Adicionar scripts**

No `package.json` raiz, substituir a seção `scripts` por:

```json
"scripts": {
  "dev": "docker-compose up",
  "dev:backend": "pnpm --filter backend start:dev",
  "dev:frontend": "pnpm --filter frontend dev",
  "build": "pnpm -r build",
  "test": "pnpm -r test",
  "test:cov": "pnpm -r test:cov",
  "lint": "pnpm -r lint",
  "sonar:bootstrap": "node scripts/sonar-bootstrap.mjs",
  "sonar:wait-gate": "node scripts/sonar-wait-gate.mjs",
  "sonar:scan": "pnpm dlx sonar-scanner",
  "sonar:check": "pnpm test:cov && pnpm sonar:scan && pnpm sonar:wait-gate",
  "prepare": "husky"
}
```

- [ ] **Step 3: Verificar ordem dos scripts (sanity check)**

Run: `node -e "console.log(Object.keys(require('./package.json').scripts).join('\n'))"`
Expected: lista 11 scripts, todos os 4 `sonar:*` presentes.

- [ ] **Step 4: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore(repo): add husky devDep and sonar:* scripts to root package.json"
```

---

## Task 8: Husky pre-push hook

**Files:**
- Create: `.husky/pre-push`

- [ ] **Step 1: Inicializar husky**

Run: `pnpm exec husky init`
Expected: cria `.husky/pre-commit` com um exemplo. Vamos sobrescrever e usar pre-push.

- [ ] **Step 2: Remover o pre-commit default**

Run: `rm -f .husky/pre-commit`

- [ ] **Step 3: Criar .husky/pre-push**

```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh" 2>/dev/null || true
set -e

# Carrega SONAR_TOKEN do apps/backend/.env, se existir
if [ -f apps/backend/.env ]; then
  export $(grep -E '^SONAR_TOKEN=' apps/backend/.env | xargs) 2>/dev/null || true
fi

if [ -z "$SONAR_TOKEN" ]; then
  echo "❌ SONAR_TOKEN não definido. Rode: pnpm sonar:bootstrap e copie o token pra apps/backend/.env"
  exit 1
fi

if ! curl -sf http://localhost:9000/api/system/status | grep -q '"status":"UP"'; then
  echo "❌ SonarQube não está rodando. Suba com: docker compose --profile sonar up -d"
  exit 1
fi

echo "🧪 Rodando coverage (backend + frontend + shared)..."
pnpm test:cov

echo "🔍 Rodando sonar-scanner..."
pnpm sonar:scan

echo "⏳ Aguardando quality gate..."
pnpm sonar:wait-gate

echo "✅ Quality gate verde. Push liberado."
```

- [ ] **Step 4: Tornar executável**

Run: `chmod +x .husky/pre-push`

- [ ] **Step 5: Verificar instalação do hook**

Run: `git config --get core.hooksPath`
Expected: `.husky/_` ou similar (instalado pelo husky init).

- [ ] **Step 6: Smoke test (sem realmente pushar)**

Run: `bash .husky/pre-push 2>&1 | head -20` ou `pnpm sonar:check 2>&1 | tail -10`
Expected: ou rodou tudo até o gate (verde ou vermelho), ou para no primeiro check (Sonar não-up). Apenas confirmar que o script EXECUTA, não importa se passa.

> ⚠️ Se `pnpm sonar:check` falhar nesta task por dívida histórica (overall code com bugs/vulns), isso é esperado — vamos lidar na Task 11. Esta task só valida que o hook está cabeado.

- [ ] **Step 7: Commit**

```bash
git add .husky/pre-push
git commit -m "chore(repo): add pre-push hook running sonar:check"
```

---

## Task 9: CLAUDE.md — nova seção "Qualidade de Código (Sonar)"

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Adicionar seção**

Localizar no `CLAUDE.md` o cabeçalho `## Comandos úteis` (ou equivalente perto do fim). **Antes** dele, inserir:

```markdown
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
```

- [ ] **Step 2: Verificar que o ancore está ok**

Run: `grep -A 2 "Qualidade de Código (Sonar)" CLAUDE.md | head -5`
Expected: a seção aparece.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(claude): add Sonar quality code policy and setup section"
```

---

## Task 10: Template de task pra writing-plans

**Files:**
- Create: `docs/superpowers/specs/_quality-gate-task-template.md`

- [ ] **Step 1: Criar o template**

```markdown
# Quality Gate (Sonar) — Template de task obrigatória

> **Como usar:** copie a seção `## Task N` abaixo como **última task** de qualquer plano gerado via `/superpowers:writing-plans`. Substitua `N` pelo número correto. Esta task é **não-negociável** — sem ela, o push estará violando a política do CLAUDE.md.

---

## Task N: Quality Gate (Sonar) — obrigatória, sempre última

**Files:** N/A — esta task valida o trabalho das tasks anteriores.

- [ ] **Step 1: Garantir SonarQube de pé**

Run: `docker compose --profile sonar up -d`
Verificar: `curl -sf http://localhost:9000/api/system/status | grep '"status":"UP"'`
Expected: `"status":"UP"`. Se demorar, aguardar até 60s.

- [ ] **Step 2: Rodar coverage + scanner + aguardar gate**

Run: `pnpm sonar:check`
Expected: gate verde com mensagem `✅ Quality gate verde.`

- [ ] **Step 3: Se gate falhou, listar issues new-code**

Run: `curl -s -u "$SONAR_TOKEN:" "http://localhost:9000/api/issues/search?componentKeys=praktikus&resolved=false&inNewCodePeriod=true&ps=500" | jq '.issues[] | {key, rule, severity, message, component, line}'`

- [ ] **Step 4: Para cada issue, corrigir ou suprimir com justificativa**

- **Bug/vuln/duplicação real:** corrigir o código.
- **Falso positivo legítimo:** suprimir inline com `// NOSONAR(rule:S####) — <razão em pt-BR>`.

Re-rodar Step 2 até gate verde.

- [ ] **Step 5: Push autorizado**

Run: `git push`
Expected: pre-push hook valida silenciosamente e libera.
```

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/specs/_quality-gate-task-template.md
git commit -m "docs(specs): add quality gate task template for writing-plans"
```

---

## Task 11: Quality Gate (Sonar) — meta-task obrigatória, sempre última

> Esta é a aplicação do template criado na Task 10 sobre o próprio plano. Valida que o trabalho de Tasks 1-10 está limpo do ponto de vista do Sonar.

**Files:** N/A — valida o trabalho das tasks anteriores.

- [ ] **Step 1: Garantir SonarQube de pé**

Run: `docker compose --profile sonar up -d`
Verificar: `curl -sf http://localhost:9000/api/system/status | grep '"status":"UP"'`
Expected: `"status":"UP"`.

- [ ] **Step 2: Rodar primeira análise full**

Run: `pnpm sonar:check`

Esperado **na primeira execução do projeto**: pode ter dívida histórica (overall code com bugs/vulns) que não bloqueia o gate (gate só vale em new code), mas **issues em new code** podem aparecer porque toda a baseline atual está sendo introduzida agora.

> ⚠️ **Caso de borda esperado:** quando o projeto é analisado pela primeira vez, **TUDO** é considerado "new code" até a primeira análise consolidar. Isso significa que esta primeira execução pode reportar muitas issues. Ações:
> 1. Verificar no dashboard `http://localhost:9000/dashboard?id=praktikus` o **New Code Period**.
> 2. Em "Project Settings → New Code", configurar como `Previous version` ou `Specific date` (data anterior ao trabalho atual) **manualmente** uma vez. Isso desloca o "new code" pra o que foi tocado depois desta data, congelando a baseline existente como dívida histórica.
> 3. Após ajustar, **re-rodar** `pnpm sonar:check`.

- [ ] **Step 3: Listar issues new-code (após ajuste de baseline)**

Run:
```bash
curl -s -u "$SONAR_TOKEN:" "http://localhost:9000/api/issues/search?componentKeys=praktikus&resolved=false&inNewCodePeriod=true&ps=500" | jq '.issues[] | {key, rule, severity, message, component, line}'
```

- [ ] **Step 4: Corrigir ou suprimir cada issue**

- **Bug/vuln/duplicação real:** corrigir.
- **Falso positivo:** `// NOSONAR(rule:S####) — <razão em pt-BR>`.

Re-rodar Step 2 até gate verde.

- [ ] **Step 5: Push final autorizado**

Run: `git push origin redesign/praktikus-v2`
Expected: pre-push hook bate todos os passos e libera.

---

## Self-Review Checklist (autor do plano)

- [x] **Spec coverage:**
  - 3.1 Infra docker-compose → Task 1 ✅
  - 3.2 sonar-project.properties → Task 3 ✅
  - 3.3 Coverage frontend/shared → Tasks 4 e 5 ✅
  - 3.4 Quality gate "Praktikus" via API → Task 2 (bootstrap) ✅
  - 3.5 Pre-push hook + scripts → Tasks 6, 7, 8 ✅
  - 3.6 CLAUDE.md regra → Task 9 ✅
  - 3.7 Template task → Task 10 ✅
  - Meta-task de validação → Task 11 ✅
- [x] **Sem placeholders:** todo bloco de código completo, sem TBD/TODO.
- [x] **Type/nome consistency:**
  - `SONAR_TOKEN` consistente em .env, hook, e wait-gate
  - `PROJECT_KEY=praktikus` consistente em bootstrap, sonar-project.properties, wait-gate, hook
  - `GATE_NAME=Praktikus` consistente em bootstrap (cria) e sonar-project.properties (referencia indiretamente)
  - Métricas do gate (`new_*`) consistentes entre bootstrap e formatFailure
- [x] **Frequent commits:** 11 commits ao longo do plano, 1 por task funcional.
- [x] **TDD:** Tasks 2 e 6 escrevem teste falhando antes da implementação.
- [x] **CLAUDE.md compliance:**
  - Commits formato `tipo(escopo): descrição` ✅
  - Sem `--no-verify` por default ✅
  - Scripts em `scripts/` na raiz ✅
  - Branch redesign/praktikus-v2 ✅
  - Última task = Quality Gate ✅

---

**Plano salvo em `docs/superpowers/plans/2026-04-28-sonar-quality-gate.md`.**
