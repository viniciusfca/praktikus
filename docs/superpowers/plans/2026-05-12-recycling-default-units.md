# Recycling Default Units Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pré-cadastrar Quilograma (kg) e Unidade (unid) automaticamente em tenants novos do segmento Recycling.

**Architecture:** Criar uma função `buildUnitsSeedSql(schemaName)` em um novo arquivo `units-seed.sql.ts`, seguindo o padrão já estabelecido por `price-tables.sql.ts → buildPriceTablesSeedSql`. Incluir o seed no array de SQLs retornado por `createTenantTablesSql()` quando `segment === RECYCLING`. Mudança roda na mesma transação do `provisionSchema()`, então atomicidade já é garantida.

**Tech Stack:** TypeScript + Jest, SQL bruto via TypeORM `queryRunner.query()`, sem mudanças em entities ou services.

---

## File Structure

### Criar
- `apps/backend/src/database/tenant-migrations/units-seed.sql.ts` — função `buildUnitsSeedSql(schemaName): string[]` retorna 2 INSERTs.
- `apps/backend/src/database/tenant-migrations/create-tenant-tables.spec.ts` — spec novo cobrindo o comportamento condicional por segment.

### Modificar
- `apps/backend/src/database/tenant-migrations/create-tenant-tables.ts` — importar `buildUnitsSeedSql` e incluir no return para Recycling.
- `docs/qa/playbook-recycling-e2e.md` — Fase 2.2 atualizada pra refletir que as unidades já vêm pré-cadastradas.

---

## Task 1: Spec de `createTenantTablesSql` (TDD)

**Files:**
- Create: `apps/backend/src/database/tenant-migrations/create-tenant-tables.spec.ts`

Escrever os tests antes da implementação. Cobre o comportamento condicional por segment e a ordem (INSERT depois do CREATE).

- [ ] **Step 1: Criar o spec**

```typescript
// apps/backend/src/database/tenant-migrations/create-tenant-tables.spec.ts
import { TenantSegment } from '@praktikus/shared';
import { createTenantTablesSql } from './create-tenant-tables';

const SCHEMA = 'tenant_test123';

describe('createTenantTablesSql', () => {
  describe('segment RECYCLING', () => {
    const sqls = createTenantTablesSql(SCHEMA, TenantSegment.RECYCLING);

    it('contains a CREATE TABLE statement for units', () => {
      const hasCreateUnits = sqls.some((sql) =>
        sql.includes(`CREATE TABLE IF NOT EXISTS "${SCHEMA}".units`),
      );
      expect(hasCreateUnits).toBe(true);
    });

    it('contains exactly 2 INSERT INTO units statements (Quilograma + Unidade)', () => {
      const inserts = sqls.filter((sql) =>
        sql.includes(`INSERT INTO "${SCHEMA}".units`),
      );
      expect(inserts).toHaveLength(2);
    });

    it('inserts Quilograma (kg) and Unidade (unid)', () => {
      const all = sqls.join('\n');
      expect(all).toMatch(/'Quilograma'\s*,\s*'kg'/);
      expect(all).toMatch(/'Unidade'\s*,\s*'unid'/);
    });

    it('runs INSERT INTO units AFTER the CREATE TABLE units', () => {
      const createIdx = sqls.findIndex((sql) =>
        sql.includes(`CREATE TABLE IF NOT EXISTS "${SCHEMA}".units`),
      );
      const firstInsertIdx = sqls.findIndex((sql) =>
        sql.includes(`INSERT INTO "${SCHEMA}".units`),
      );
      expect(createIdx).toBeGreaterThanOrEqual(0);
      expect(firstInsertIdx).toBeGreaterThan(createIdx);
    });
  });

  describe('segment WORKSHOP', () => {
    const sqls = createTenantTablesSql(SCHEMA, TenantSegment.WORKSHOP);

    it('does NOT create a units table (Workshop has no units concept)', () => {
      const hasCreateUnits = sqls.some((sql) =>
        sql.includes(`CREATE TABLE IF NOT EXISTS "${SCHEMA}".units`),
      );
      expect(hasCreateUnits).toBe(false);
    });

    it('does NOT contain any INSERT INTO units statements', () => {
      const hasUnitsInsert = sqls.some((sql) =>
        sql.includes(`INSERT INTO "${SCHEMA}".units`),
      );
      expect(hasUnitsInsert).toBe(false);
    });
  });
});
```

- [ ] **Step 2: Rodar o spec — devem falhar os tests do RECYCLING**

Run: `pnpm --filter backend test -- create-tenant-tables.spec`

Expected: 4 tests do segmento RECYCLING falham (`contains exactly 2 INSERT INTO units`, etc). Os 2 tests do segmento WORKSHOP passam (já é o comportamento atual).

Output mínimo esperado:
```
FAIL src/database/tenant-migrations/create-tenant-tables.spec.ts
  createTenantTablesSql > segment RECYCLING > contains exactly 2 INSERT INTO units statements
    Expected length: 2
    Received length: 0
  ...
```

- [ ] **Step 3: Commit (red)**

```bash
git add apps/backend/src/database/tenant-migrations/create-tenant-tables.spec.ts
git commit -m "test(tenant): spec do create-tenant-tables com units seed (red)"
```

---

## Task 2: Implementar `buildUnitsSeedSql` + integrar

**Files:**
- Create: `apps/backend/src/database/tenant-migrations/units-seed.sql.ts`
- Modify: `apps/backend/src/database/tenant-migrations/create-tenant-tables.ts:248-261`

Segue o padrão de `buildPriceTablesSeedSql` em `price-tables.sql.ts`.

- [ ] **Step 1: Criar `units-seed.sql.ts`**

```typescript
// apps/backend/src/database/tenant-migrations/units-seed.sql.ts

/**
 * Insere as 2 unidades de medida padrão no schema do tenant Recycling
 * recém-criado: Quilograma (kg) e Unidade (unid).
 *
 * Estes inserts rodam na mesma transação que CREATE TABLE units
 * (provisionSchema), então não há risco de ordem ou rollback parcial.
 * O usuário pode renomear/deletar as unidades como qualquer outra —
 * elas não têm flag de "default" no banco.
 */
export function buildUnitsSeedSql(schemaName: string): string[] {
  return [
    `INSERT INTO "${schemaName}".units (name, abbreviation)
       VALUES ('Quilograma', 'kg')`,
    `INSERT INTO "${schemaName}".units (name, abbreviation)
       VALUES ('Unidade', 'unid')`,
  ];
}
```

- [ ] **Step 2: Integrar no `create-tenant-tables.ts`**

Localize as linhas 248-261. Adicione o import no topo do arquivo (junto com os outros imports de `*.sql`) e inclua `buildUnitsSeedSql` no `return` do branch RECYCLING.

Antes (linhas atuais ~248-261):
```typescript
const whatsappTables = buildWhatsappTablesSql(schemaName);

if (segment === TenantSegment.RECYCLING) {
  const priceTables = buildPriceTablesSql(schemaName);
  const priceTablesSeed = buildPriceTablesSeedSql(schemaName);
  return [
    ...recyclingTables,
    ...priceTables,
    ...priceTablesSeed,
    ...buildPurchasesPriceTableSetupSql(schemaName),
    ...whatsappTables,
  ];
}
return [...workshopTables, ...whatsappTables];
```

Depois:
```typescript
const whatsappTables = buildWhatsappTablesSql(schemaName);

if (segment === TenantSegment.RECYCLING) {
  const priceTables = buildPriceTablesSql(schemaName);
  const priceTablesSeed = buildPriceTablesSeedSql(schemaName);
  const unitsSeed = buildUnitsSeedSql(schemaName);
  return [
    ...recyclingTables,
    ...unitsSeed,
    ...priceTables,
    ...priceTablesSeed,
    ...buildPurchasesPriceTableSetupSql(schemaName),
    ...whatsappTables,
  ];
}
return [...workshopTables, ...whatsappTables];
```

**Ordem importa**: `...recyclingTables` cria a tabela `units` (entre outras); `...unitsSeed` insere depois. Os spec tests asseguram essa ordem.

Adicione o import no topo. Localize o bloco de imports (perto dos outros `import ... from './price-tables.sql'`) e adicione:

```typescript
import { buildUnitsSeedSql } from './units-seed.sql';
```

- [ ] **Step 3: Rodar o spec — todos verdes**

Run: `pnpm --filter backend test -- create-tenant-tables.spec`

Expected: 6 tests passing (4 RECYCLING + 2 WORKSHOP).

- [ ] **Step 4: Build check**

Run: `pnpm --filter backend build`

Expected: build limpo (sem erros TS).

- [ ] **Step 5: Commit (green)**

```bash
git add apps/backend/src/database/tenant-migrations/units-seed.sql.ts \
        apps/backend/src/database/tenant-migrations/create-tenant-tables.ts
git commit -m "feat(recycling): pré-cadastra Quilograma e Unidade ao provisionar tenant"
```

---

## Task 3: Smoke local end-to-end

**Files:** N/A — validação manual no DB.

Garante que o seed funciona não só nos tests mas em runtime real.

- [ ] **Step 1: Resetar DB local**

Run: `pnpm --filter backend qa:reset-db`

Expected (parte relevante):
```
[reset-db] Public schema dropped + recreated
[reset-db] Ran N migrations
[reset-db] Done. DB is empty + migrated. Ready for fresh signup.
```

- [ ] **Step 2: Criar tenant Recycling de teste**

Subir backend (já deve estar rodando: `docker compose ps`) e fazer signup via curl ou pela UI.

Via curl (mais rápido pro smoke):

```bash
curl -X POST http://localhost:3000/api/auth/register/recycling \
  -H "Content-Type: application/json" \
  -d '{
    "cnpj": "11797206000100",
    "razaoSocial": "Smoke Test Reciclagem LTDA",
    "nomeFantasia": "Smoke Recicla",
    "telefone": "11912345678",
    "nomeResponsavel": "Smoke User",
    "email": "smoke-units@mailinator.com",
    "senha": "Praktikus@2026"
  }'
```

Expected: HTTP 200 + body `{ accessToken, refreshToken, ... }`.

- [ ] **Step 3: Inspecionar a tabela `units` do tenant recém-criado**

Pegar o schema do tenant:

```bash
docker exec praktikus_postgres psql -U praktikus -d praktikus -c \
  "SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 'tenant_%' LIMIT 1;"
```

Depois consultar as unidades:

```bash
docker exec praktikus_postgres psql -U praktikus -d praktikus -c \
  "SELECT name, abbreviation FROM tenant_XXXX.units ORDER BY name;"
```

Expected (substitua `tenant_XXXX` pelo schema retornado):
```
    name    | abbreviation
------------+--------------
 Quilograma | kg
 Unidade    | unid
(2 rows)
```

Se vier 0 linhas ou outro conteúdo, falhou — verificar logs do backend e voltar à Task 2.

- [ ] **Step 4: (Opcional) Validar via UI**

Abrir `http://localhost:8080`, fazer login com `smoke-units@mailinator.com` / `Praktikus@2026`, ir em **Configurações → Unidades de Medida**. Deve listar as 2 unidades.

- [ ] **Step 5: Sem commit**

Smoke é validação local, sem código novo. Pular este step.

---

## Task 4: Atualizar playbook E2E (Fase 2.2)

**Files:**
- Modify: `docs/qa/playbook-recycling-e2e.md` (Fase 2.2)

A fase 2.2 atualmente instrui o Claude for Chrome a criar 3 unidades manualmente. Após este fix, kg e unid já existem — só Tonelada precisa ser criada (opcionalmente).

- [ ] **Step 1: Localizar e substituir a Fase 2.2**

Procurar pela seção:

```markdown
### 2.2 Aba Unidades de Medida

1. Clique na aba "Unidades de Medida".
2. Crie 3 unidades em sequência:
   - Sigla: `kg`, Descrição: `Quilograma`
   - Sigla: `ton`, Descrição: `Tonelada`
   - Sigla: `un`, Descrição: `Unidade`
3. **Checkpoint**: cada unidade aparece na listagem após salvar.
4. **Screenshot ✓** (CP4) — 3 unidades listadas.
```

Substituir por:

```markdown
### 2.2 Aba Unidades de Medida

1. Clique na aba "Unidades de Medida".
2. **Checkpoint**: deve listar 2 unidades pré-cadastradas:
   - `Quilograma` / `kg`
   - `Unidade` / `unid`
   (Seed automático ao criar tenant Recycling — não é necessário criar manualmente.)
3. **Screenshot ✓** (CP4a) — listagem com as 2 unidades padrão.
4. (Opcional) Crie uma terceira unidade pra exercitar o fluxo de criação:
   - Nome: `Tonelada`, Sigla: `ton`.
5. **Checkpoint**: 3 unidades listadas.
6. **Screenshot ✓** (CP4b).
```

- [ ] **Step 2: Commit**

```bash
git add docs/qa/playbook-recycling-e2e.md
git commit -m "docs(qa): atualizar Fase 2.2 do playbook (units seed automático)"
```

---

## Task 5: Quality Gate (Sonar) — obrigatória, sempre última

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
