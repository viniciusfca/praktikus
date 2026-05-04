# Sonar Quality Gate — Design

> **Versão:** 1.0 — 2026-04-28
> **Goal:** estabelecer um fluxo obrigatório de qualidade de código baseado em SonarQube Community Edition rodando local, executado antes de cada `git push`, com regras explícitas no `CLAUDE.md` e tasks dedicadas no fim de cada plano de implementação.

## 1. Contexto

O monorepo Praktikus tem hoje:
- ~37k linhas TS/TSX em backend (NestJS), frontend (React + Vitest) e shared.
- ESLint configurado por workspace, sem pre-commit/pre-push hooks.
- Coverage gerado em backend (Jest), não publicado em frontend.
- Único workflow GitHub Actions é deploy (Fly.io) — sem CI de PR.
- Nenhuma análise estática consolidada além de ESLint.

O usuário pediu:
- Rodar Sonar **local** antes de subir código pro repo.
- Critérios não-negociáveis em new code: **0 bugs**, **0 issues de segurança**, **<3% duplicação**.
- Regra explícita no `CLAUDE.md` para que o agente (Claude Code) **leia issues, corrija e só faça push depois do gate verde**.
- Toda nova `superpowers:writing-plans` deve incluir uma **task final dedicada** ao quality gate.

## 2. Decisões de design (resumo)

| Tema | Decisão |
|---|---|
| Infraestrutura | SonarQube Community Edition em Docker, perfil `sonar` no `docker-compose.yml`, com Postgres dedicado. |
| Estrutura no Sonar | 1 projeto unificado `praktikus` cobrindo backend, frontend e shared. |
| Quando rodar | Pre-push hook (husky). Sem CI de PR por agora (single dev). |
| Estratégia de baseline | Híbrido: bugs/vulns/hotspots desde o dia 1 (overall + new); duplicação e code smells **só em new code**. |
| Coverage no gate | ≥ 80% **só em backend** via `sonar.coverage.exclusions` para frontend/shared. Coverage de frontend/shared não fica no dashboard (aparece como "—"). |
| Hotspots | 100% reviewed em new code (sem exceção). |
| Code smells | Warning, não bloqueante. |
| Falsos positivos | `// NOSONAR(rule:S####) — justificativa em pt-BR` inline. |
| Política do agente | CLAUDE.md regra explícita + template de task em `docs/superpowers/specs/_quality-gate-task-template.md`. |

## 3. Arquitetura

### 3.1 Infraestrutura — docker-compose

Adiciona ao `docker-compose.yml` dois serviços sob `profiles: [sonar]` (não sobem com `docker compose up` normal):

- `sonarqube`: imagem `sonarqube:10-community`, porta `9000`, volumes nomeados pra dados/extensions/logs, depende de `sonar-postgres` saudável.
- `sonar-postgres`: imagem `postgres:15-alpine`, banco isolado (`sonar` / `sonar` / dev only), volume nomeado pra persistência. Não reutiliza o `praktikus_postgres` para evitar conflito de schemas.

Comando de subida: `docker compose --profile sonar up -d`. Dashboard: `http://localhost:9000`.

**Setup inicial (manual, único):**
1. Login `admin/admin` → trocar senha.
2. Criar projeto `praktikus`.
3. Gerar token de análise.
4. Salvar token em `apps/backend/.env` (e `.env.example`) como `SONAR_TOKEN=`.
5. Criar quality profile e quality gate customizados (ver 3.4).

### 3.2 sonar-project.properties (raiz)

```properties
sonar.projectKey=praktikus
sonar.projectName=Praktikus
sonar.host.url=http://localhost:9000
sonar.token=${SONAR_TOKEN}

sonar.sources=apps/backend/src,apps/frontend/src,packages/shared/src
sonar.tests=apps/backend/src,apps/frontend/src,packages/shared/src
sonar.test.inclusions=**/*.spec.ts,**/*.spec.tsx,**/*.test.ts,**/*.test.tsx
sonar.exclusions=**/node_modules/**,**/dist/**,**/coverage/**,**/*.spec.ts,**/*.spec.tsx,**/*.test.ts,apps/backend/src/database/migrations/**,apps/backend/src/database/tenant-migrations/**

sonar.javascript.lcov.reportPaths=apps/backend/coverage/lcov.info,apps/frontend/coverage/lcov.info,packages/shared/coverage/lcov.info
sonar.typescript.tsconfigPath=tsconfig.json

# Coverage threshold só vale pra backend.
# Excluir frontend e shared do cálculo de coverage faz com que a métrica
# "Coverage on New Code" no quality gate reflita apenas o backend, sem
# precisar de condições por path (não suportado em todas as edições).
sonar.coverage.exclusions=apps/frontend/**,packages/shared/**

sonar.sourceEncoding=UTF-8
```

**Justificativas:**
- Migrations e tenant-migrations excluídas: SQL gerado/idempotente, regras Sonar JS/TS não se aplicam.
- `.spec.*` reconhecidos como teste, não fonte: não pune duplicação/cobertura em testes.
- Coverage de 3 fontes (backend Jest, frontend Vitest, shared Vitest).

### 3.3 Coverage — habilitar em frontend e shared

**Backend:** já gera lcov via `pnpm --filter backend test:cov`. Sem mudança.

**Frontend:** instalar `@vitest/coverage-v8`, adicionar config em `apps/frontend/vite.config.ts`:

```ts
test: {
  coverage: {
    provider: 'v8',
    reporter: ['text', 'lcov'],
    reportsDirectory: './coverage',
    exclude: [
      '**/*.spec.tsx',
      '**/*.test.tsx',
      'src/main.tsx',
      'src/vite-env.d.ts',
      '**/dist/**',
    ],
  },
}
```

E novo script em `apps/frontend/package.json`:
```json
"test:cov": "vitest run --coverage"
```

**Shared:** mesmo padrão — instalar `@vitest/coverage-v8`, adicionar config equivalente em `packages/shared/vite.config.ts` (criar se não existir), e script `test:cov`.

**Script raiz:** `pnpm test:cov` (recursivo) já existe via pnpm workspaces — confirma que dispara em todos os workspaces.

### 3.4 Quality Gate "Praktikus"

Substitui o gate `Sonar way` default. Configurado via UI do SonarQube ou via API REST.

**Condições — em new code (bloqueia):**

| Métrica | Operador | Threshold |
|---|---|---|
| New Bugs | > | 0 |
| New Vulnerabilities | > | 0 |
| New Security Hotspots Reviewed | < | 100% |
| Duplicated Lines (%) on New Code | > | 3% |
| Coverage on New Code | < | 80% |

> **Sobre o threshold de coverage:** o cálculo é restrito ao backend via `sonar.coverage.exclusions=apps/frontend/**,packages/shared/**` em `sonar-project.properties`. Frontend e shared **não terão métrica de coverage** no dashboard (aparecem como "—"), mas continuam sendo analisados normalmente pra bugs, vulns, hotspots, code smells e duplicação. Caso o time queira métrica de coverage visível pra frontend/shared no futuro (sem usar como gate), basta remover essa exclusão e mover a restrição pro gate via condição por componente — o que pode exigir upgrade pra edição paga.

**Condições — em overall code (não bloqueia, só dashboard):**
- Bugs/Vulns existentes ficam visíveis como dívida.
- Duplicação histórica e code smells ficam visíveis.
- Coverage geral fica visível.

**Code smells em new code:** retornam como warning na saída do scanner, mas **não fazem o gate falhar**. Visíveis no dashboard pra atacar gradualmente.

**Falsos positivos:** marca-se inline com `// NOSONAR(rule:S####) — <justificativa em pt-BR>`. O comentário é auditável em code review.

### 3.5 Pre-push hook (husky)

**Setup (uma vez):**
- `pnpm add -Dw husky` na raiz.
- `pnpm exec husky init`.
- Atualizar `package.json` raiz com script `"prepare": "husky"`.

**Arquivo `.husky/pre-push`:**

```bash
#!/usr/bin/env sh
set -e

if ! curl -sf http://localhost:9000/api/system/status | grep -q '"status":"UP"'; then
  echo "❌ SonarQube não está rodando."
  echo "   Suba com: docker compose --profile sonar up -d"
  exit 1
fi

echo "🧪 Rodando coverage..."
pnpm test:cov

echo "🔍 Rodando sonar-scanner..."
pnpm dlx sonar-scanner

echo "⏳ Aguardando quality gate..."
pnpm sonar:wait-gate

echo "✅ Quality gate verde. Push liberado."
```

**Script `pnpm sonar:wait-gate`** (novo, em `scripts/sonar-wait-gate.mjs` na raiz):

```js
#!/usr/bin/env node
const PROJECT = 'praktikus';
const TOKEN = process.env.SONAR_TOKEN;
const HOST = 'http://localhost:9000';
const TIMEOUT_MS = 60_000;
const POLL_MS = 2_000;

const start = Date.now();
const auth = 'Basic ' + Buffer.from(`${TOKEN}:`).toString('base64');

while (Date.now() - start < TIMEOUT_MS) {
  const res = await fetch(
    `${HOST}/api/qualitygates/project_status?projectKey=${PROJECT}`,
    { headers: { Authorization: auth } },
  );
  const body = await res.json();
  const status = body.projectStatus?.status;
  if (status === 'OK') process.exit(0);
  if (status === 'ERROR') {
    console.error('❌ Quality gate falhou:');
    for (const c of body.projectStatus.conditions) {
      if (c.status === 'ERROR') {
        console.error(`  - ${c.metricKey}: ${c.actualValue} (limite ${c.errorThreshold})`);
      }
    }
    console.error('\nLista de issues new-code:');
    console.error(`  curl -s -u ${PROJECT}: "${HOST}/api/issues/search?componentKeys=praktikus&resolved=false&inNewCodePeriod=true" | jq '.issues[] | {key, severity, message, component, line}'`);
    process.exit(1);
  }
  await new Promise((r) => setTimeout(r, POLL_MS));
}
console.error('❌ Timeout aguardando quality gate.');
process.exit(2);
```

**Script `pnpm sonar:check`** (alias atalho na raiz, equivalente ao que o pre-push faz, sem o git push):

```json
"sonar:check": "pnpm test:cov && pnpm dlx sonar-scanner && pnpm sonar:wait-gate",
"sonar:wait-gate": "node scripts/sonar-wait-gate.mjs"
```

**Bypass de emergência:** `git push --no-verify`. Reservado pra hotfix; uso esporádico, justificado no commit message.

**Tempo total esperado por push:** ~1–2 min (15–30s coverage + 30–90s scanner + ~10s polling).

### 3.6 Regras em CLAUDE.md

Adicionar nova seção `## Qualidade de Código (Sonar)` com:

```markdown
## Qualidade de Código (Sonar)

Antes de qualquer `git push`:

1. SonarQube precisa estar de pé: `docker compose --profile sonar up -d`
2. Rodar `pnpm sonar:check` e aguardar quality gate verde
3. Issues new-code: corrigir todas, ou suprimir falsos positivos com `// NOSONAR(rule:S####) — justificativa em pt-BR`
4. Push só após gate verde

**Sem exceção em código novo.** O pre-push hook bloqueia automaticamente. `git push --no-verify` é reservado a hotfix urgente e deve ser justificado no commit message.

### Quality gate (referência)

**Em new code (bloqueia push):**
- 0 bugs (qualquer severidade)
- 0 vulnerabilities (qualquer severidade)
- 100% security hotspots reviewed
- < 3% linhas duplicadas
- ≥ 80% coverage agregado, com frontend/shared excluídos do cálculo (`sonar.coverage.exclusions`)

**Em overall code (não bloqueia, só dashboard):**
- Dívida histórica visível, atacada gradualmente

Code smells em new code: warning, não bloqueia.

### Em planos de implementação

Todo plano gerado via `/superpowers:writing-plans` deve terminar com a task **"Quality Gate (Sonar)"**. Use o template em [`docs/superpowers/specs/_quality-gate-task-template.md`](docs/superpowers/specs/_quality-gate-task-template.md) — copie como última task do plano.
```

### 3.7 Template de task pro writing-plans

Cria `docs/superpowers/specs/_quality-gate-task-template.md` (prefixo `_` pra ficar no topo do dir e indicar template):

```markdown
# Quality Gate (Sonar) — Template de task obrigatória

> **Como usar:** copie a seção `## Task N` abaixo como **última task** de qualquer plano gerado via `/superpowers:writing-plans`. Substitua `N` pelo número correto. Esta task é **não-negociável** — sem ela, o push estará violando a política do CLAUDE.md.

## Task N: Quality Gate (Sonar)

**Files:** N/A — esta task valida o trabalho das tasks anteriores.

- [ ] **Step 1: Garantir SonarQube de pé**

Run: `docker compose --profile sonar up -d`

Verificar: `curl -sf http://localhost:9000/api/system/status | grep '"status":"UP"'`
Expected: `"status":"UP"`

- [ ] **Step 2: Rodar coverage + scanner**

Run: `pnpm sonar:check`
Expected: gate verde com mensagem `✅ Quality gate verde. Push liberado.`

- [ ] **Step 3: Se gate falhou, listar e corrigir issues new-code**

Run: `curl -s -u $SONAR_TOKEN: "http://localhost:9000/api/issues/search?componentKeys=praktikus&resolved=false&inNewCodePeriod=true" | jq '.issues[] | {key, rule, severity, message, component, line}'`

Para cada issue:
- **Bug/vuln/duplicação real:** corrigir o código.
- **Falso positivo legítimo:** suprimir inline com `// NOSONAR(rule:S####) — <razão em pt-BR>`.

Re-rodar Step 2 até gate verde.

- [ ] **Step 4: Push autorizado**

Run: `git push`
Expected: pre-push hook valida silenciosamente e libera.
```

## 4. Custos e tradeoffs

**Custos:**
- ~2 GB RAM rodando o SonarQube + Postgres em background (impacto pequeno em máquina de dev moderna).
- ~1–2 min adicional por push.
- Setup inicial manual (1 vez): subir Sonar, criar projeto, configurar gate, gerar token.

**Tradeoffs aceitos:**
- Sem CI de PR no GitHub Actions: o gate é só local. Se outras pessoas vierem a contribuir, vai precisar virar SonarCloud ou hospedar SonarQube acessível. Tracker pra revisitar quando a equipe crescer.
- 80% coverage só em backend: frontend pode ter componentes sem teste; aceito porque UI é mais difícil de testar e a lógica de negócio crítica está no backend.
- Falsos positivos exigem comentário inline: pequena fricção, mas auditável.
- Code smells não bloqueiam: prioriza disciplina em bugs/vulns/duplicação; smells são atacados gradualmente como melhoria contínua.

## 5. Out of scope (follow-ups potenciais)

- SonarCloud quando a equipe crescer.
- CI de PR no GitHub Actions (precisa Sonar acessível externamente).
- Quality gate condições adicionais (ex: complexidade ciclomática, cognitive complexity).
- Bloqueio de merge no GitHub baseado no gate.

## 6. Critérios de sucesso

- [ ] `docker compose --profile sonar up -d` sobe Sonar saudável.
- [ ] Dashboard `localhost:9000` acessível com projeto Praktikus visível.
- [ ] Quality gate `Praktikus` configurado e selecionado pro projeto.
- [ ] `pnpm sonar:check` na master atual produz um relatório (mesmo que com dívida histórica).
- [ ] Pre-push hook bloqueia push se gate falhar em new code.
- [ ] Tentar push após introduzir bug intencional em new code: bloqueia.
- [ ] Tentar push após corrigir o bug: passa.
- [ ] CLAUDE.md atualizado com a regra.
- [ ] Template `_quality-gate-task-template.md` em `docs/superpowers/specs/`.

---

**Spec aprovada para implementação.** Próximo passo: invocar `/superpowers:writing-plans` para detalhar tasks bite-sized de implementação.
