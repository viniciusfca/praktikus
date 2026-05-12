# Design — Unidades de medida padrão no segmento Recycling

**Data:** 2026-05-12
**Status:** aprovado em brainstorming, aguardando revisão do spec antes do plano de implementação

---

## 1. Contexto e objetivo

Hoje, quando um novo tenant Recycling é criado, a tabela `units` (no schema do tenant) é provisionada vazia. O usuário precisa entrar em **Configurações → Unidades de Medida** e criar manualmente as unidades antes de cadastrar o primeiro produto (Quilograma, Unidade, etc.) — passo redundante já que praticamente todo cliente do segmento usa kg e/ou unidade.

Este spec adiciona um pequeno seed automático: ao provisionar um novo tenant Recycling, duas unidades já vêm pré-cadastradas no schema dele:

| name | abbreviation |
|------|--------------|
| `Quilograma` | `kg` |
| `Unidade` | `unid` |

---

## 2. Decisões aprovadas

| # | Tema | Decisão |
|---|------|---------|
| 1 | Escopo | **Apenas tenants novos** (sem backfill em tenants existentes). Decisão tomada porque o produto ainda está em dev, sem clientes reais; reset do DB é frequente. Se eventualmente houver tenants reais sem essas unidades, fazemos backfill por migration. |
| 2 | Comportamento | **Unidades comuns, deletáveis** (sem flag `is_default`). Cliente pode renomear/deletar como qualquer unidade criada manualmente. Bloqueio só vale a pena se houver casos reais de cliente apagando sem querer. |
| 3 | Apenas Recycling | Workshop não tem o conceito de `units` (já é assim). Seed exclusivo do array `recyclingTables`. |
| 4 | Quantidade | **Apenas 2 unidades** (kg + unid). Outras (ton, L, m, dúzia) ficam fora do escopo — clientes que precisarem criam manualmente. |

---

## 3. Mudança de código

### 3.1 Arquivo único: `apps/backend/src/database/tenant-migrations/create-tenant-tables.ts`

Hoje o array `recyclingTables` retorna apenas os `CREATE TABLE`. Adicionar **duas linhas com `INSERT INTO`** ao final do array, antes do return:

```sql
INSERT INTO "<schemaName>".units (name, abbreviation) VALUES ('Quilograma', 'kg')
INSERT INTO "<schemaName>".units (name, abbreviation) VALUES ('Unidade', 'unid')
```

Os comandos são executados na mesma transação que cria as tabelas (já garantido pelo `provisionSchema()` em `apps/backend/src/modules/core/tenancy/tenancy.service.ts:107-124`).

### 3.2 Sem mudança na entity ou no service

`UnitEntity` não ganha novos campos. `UnitsService` não muda. As 2 unidades inseridas são linhas normais — o `GET /recycling/units` continua retornando todas (já vai mostrar as 2 desde o início).

### 3.3 Sem migration adicional

Como a decisão é "apenas tenants novos", não há migration de backfill. Cada tenant criado a partir do merge desse fix já vem com as 2 unidades.

---

## 4. Testes

### 4.1 Unit test em `create-tenant-tables.spec.ts` (criar se não existir)

Cobertura mínima:

- Quando `segment=RECYCLING`, o array retornado contém **2 statements `INSERT INTO units`** após os `CREATE TABLE`.
- Os statements de INSERT são executados após o CREATE TABLE de units (ordem importa — não pode insert antes de criar).
- Quando `segment=WORKSHOP`, o array NÃO contém nenhum INSERT em units (workshop não tem tabela units).
- Os literais `'Quilograma'`, `'kg'`, `'Unidade'`, `'unid'` aparecem no SQL.

Se já existir spec do `create-tenant-tables.ts`, estender. Se não existir, criar.

### 4.2 Integração: `tenancy.service.spec.ts`

Não precisa mudar. O spec atual mocka `dataSource` e não valida o SQL gerado — o seed fica naturalmente coberto pelo teste unitário do array.

### 4.3 Atualizar playbook E2E

Editar `docs/qa/playbook-recycling-e2e.md` Fase 2.2 (Unidades de Medida):

**Antes**: "Crie 3 unidades em sequência: kg / ton / un"

**Depois**: "Validar que aba já lista **Quilograma (kg)** e **Unidade (unid)** pré-cadastradas. Opcionalmente criar `Tonelada (ton)` para exercitar o fluxo de criação."

---

## 5. Riscos

1. **Erro de SQL em produção quebra signup**: se o INSERT falhar (ex: constraint inesperada), o `provisionSchema` inteiro falha e o tenant não é criado. Mitigação: validar localmente via reset-db; o INSERT é trivial (sem joins, sem dependências) — risco mínimo.

2. **Cliente espera ver lista limpa**: pequeno risco UX — alguns clientes podem estranhar ver "Unidade" como item pré-existente. Mitigação: é exatamente o que ele faria manualmente; nome curto e familiar.

3. **Migração futura para backfill**: se decidirmos backfill depois, será uma migration TypeORM iterando `tenant_*` schemas com `INSERT ... ON CONFLICT DO NOTHING`. Plano de implementação inclui essa observação como follow-up.

---

## 6. Fora do escopo

| Item | Por quê |
|------|---------|
| Backfill em tenants existentes | Decisão Q1: prematuro no estado atual |
| Flag `is_default` ou bloqueio de delete | Decisão Q2: sem casos reais que justifiquem |
| Outras unidades (ton, L, m, dúzia, caixa) | Decisão Q4: clientes criam se precisarem |
| Seed configurável por config/env | YAGNI |
| Aplicação no segmento Workshop | Workshop não tem units |

---

## 7. Próximos passos

Spec aprovado → `superpowers:writing-plans` cria plano com tasks:

1. Test primeiro: criar/estender `create-tenant-tables.spec.ts`.
2. Adicionar os 2 INSERT no array `recyclingTables`.
3. Validar que tests passam.
4. Atualizar playbook E2E (Fase 2.2).
5. Smoke local: `qa:reset-db` + signup + verificar lista de unidades.
6. Quality Gate Sonar (template padrão).
