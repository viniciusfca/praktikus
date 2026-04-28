# Praktikus — Relatório E2E Reciclagem + Plano de Ação para Claude Code

**Versão:** 1.0
**Data do teste:** 28/04/2026 — 10:35 BRT
**Ambiente:** Produção — https://praktikus.com.br/
**Segmento testado:** Reciclagem
**Executor:** Claude (Chrome plugin) — sessão autônoma
**Cobertura:** 18 jornadas (J1–J18) · golden path · validações críticas · cross-checks numéricos
**Resultado global:** Operável, porém com 5 bugs Alta que comprometem fluxo de caixa, precificação e relatórios.

> **Roteiro fonte:** [docs/superpowers/specs/2026-04-28-recycling-e2e-test-script-design.md](../../superpowers/specs/2026-04-28-recycling-e2e-test-script-design.md)

---

## Validação técnica dos 5 Altas (cross-check no código)

Após o teste, os 5 gaps de alta severidade foram validados contra o código-fonte:

| Gap | Status | Evidência no código |
|-----|--------|---------------------|
| GAP-01 (Vendas → Caixa) | **Confirmado** | [`sales.service.ts:154`](../../../apps/backend/src/modules/recycling/sales/sales.service.ts#L154) — comentário explícito `// 3. Create sale_items + stock_movements (OUT) — NO cash_transaction` |
| GAP-02 (Preço único) | **Confirmado** | [`product.entity.ts:15`](../../../apps/backend/src/modules/recycling/products/product.entity.ts#L15) — apenas `pricePerUnit` (sem `purchase_price`/`sale_price`). Nuance: o cálculo R$ 300 vs R$ 392 reportado pela IA pode ser inferido — `unitPrice` vem do DTO ([sales.service.ts:156](../../../apps/backend/src/modules/recycling/sales/sales.service.ts#L156)) |
| GAP-03 (Invalid Date) | **Confirmado** | [`ReportsPage.tsx:53`](../../../apps/frontend/src/pages/recycling/reports/ReportsPage.tsx#L53) — `new Date(iso + 'T00:00:00')` sem guard contra `null`/`undefined` |
| GAP-04 (Sem seed de unidades) | **Plausível** | Módulo `units` existe; não foi encontrado seed automático no fluxo de signup |
| GAP-05 (UUID em erro) | **Confirmado** | [`sales.service.ts:140`](../../../apps/backend/src/modules/recycling/sales/sales.service.ts#L140) — `Estoque insuficiente para o produto ${item.productId}` |

---

## Sumário

1. [Contexto e Setup](#1-contexto-e-setup)
2. [Resumo Executivo](#2-resumo-executivo)
3. [Cross-checks Numéricos](#3-cross-checks-numéricos)
4. [Catálogo de Gaps (30)](#4-catálogo-de-gaps-30)
5. [Cleanup / Dados criados](#5-cleanup--dados-criados)
6. [Plano de Ação para Claude Code](#6-plano-de-ação-para-claude-code)
7. [Anexos / Próximos passos de teste](#7-anexos--próximos-passos-de-teste)

---

## 1. Contexto e Setup

| Item | Valor |
|------|-------|
| Tenant ID | `2d285800-0c71-4773-80a6-98910ded632f` |
| Owner email | `qa-claude-20260428-1035@example.com` |
| Senha | `Teste@Praktikus#2026!` |
| CNPJ tenant | `76.217.024/0001-69` |
| Locale | pt-BR · DD/MM/AAAA · R$ 1.234,56 |
| CNPJs/CPFs | Gerados via algoritmo de dígito verificador (JS no console) |
| Sufixo de recursos | `Teste Claude 20260428-1035` |

### Jornadas executadas
J1 → J18, **18/18 completas**. J8.3 (sub-login funcionário) marcada opcional no roteiro — pulada.

---

## 2. Resumo Executivo

- **Cadastro / onboarding funcionam** ponta-a-ponta com CNPJ válido e segmento corretamente segregado.
- **Guardas de cross-segment OK** — `/workshop/*` redireciona silenciosamente para `/recycling/*`.
- **Anti-enumeration no "Esqueci senha"** retorna mensagem genérica (bom).
- **Estoque pós-compra bate** com a compra registrada (Al 100kg, Cu 30kg).
- **Vendas não geram entrada no Caixa** — fluxo financeiro quebrado em produção.
- **Produto tem um único preço** (sem distinção compra/venda) — modelo de dados incorreto para reciclagem.
- **Relatório detalhado mostra `Invalid Date`** — quebra confiança em dados financeiros.
- **Onboarding não pré-cria unidades de medida** — usuário fica preso ao criar 1º produto.
- **UUID exposto em mensagens de erro** — vazamento de PII/dados internos.

### Distribuição dos 30 gaps

| Severidade | Qtd |
|------------|-----|
| 🔴 Alta | 5 |
| 🟡 Média | 14 |
| 🟢 Baixa | 11 |

| Categoria | Qtd |
|-----------|-----|
| 🐞 Bug | 13 |
| 🎨 UX/copy | 11 |
| 💡 Sugestão | 4 |
| 🔒 Segurança | 2 |

---

## 3. Cross-checks Numéricos

### 3.1 Estoque pós-compra + coleta (J11)

| Produto | Compra | Coleta | Estoque esperado | Estoque exibido | OK? |
|---------|-------:|-------:|-----------------:|----------------:|:---:|
| Alumínio | 100 kg | — | 100 kg | 100 kg | ✅ |
| Cobre | 30 kg | — | 30 kg | 30 kg | ✅ |
| Papelão | — | 200 kg* | 200 kg | **0 kg** | ❌ |

> *Coleta foi registrada com sucesso na agenda, mas **não incrementou estoque**. Ver GAP-07.

### 3.2 Estoque pós-venda (J13)

| Produto | Antes | Venda | Esperado | Exibido | OK? |
|---------|------:|------:|---------:|--------:|:---:|
| Alumínio | 100 kg | 40 kg | 60 kg | 60 kg | ✅ |
| Cobre | 30 kg | 0 (bloqueada 50kg) | 30 kg | 30 kg | ✅ |

### 3.3 Caixa (J14)

| Movimento | Esperado | Exibido | OK? |
|-----------|---------:|--------:|:---:|
| Saída (compra Al+Cu) | R$ 1.410,00 | R$ 1.410,00 | ✅ |
| Entrada (venda 40kg Al @ R$ 9,80) | R$ 392,00 | **R$ 0,00** | ❌ |
| Saldo | -R$ 1.018,00 | **-R$ 1.410,00** | ❌ |

> Vendas **não criam movimento de caixa**. Ver GAP-01 e GAP-02.

---

## 4. Catálogo de Gaps (30)

### 🔴 Alta (5)

#### GAP-01 · 🐞 · J12/J14 · Vendas não geram entrada no Caixa
- **Sintoma:** Após registrar venda de 40kg Al = R$ 300, o caixa segue com saldo `-R$ 1.410,00` (apenas a saída da compra).
- **Causa provável:** Form `/recycling/sales/new` **não tem campo "Forma de pagamento"**, e o handler de venda não dispara `cash_register_entries.insert`.
- **Impacto:** Operadora real não consegue conciliar caixa. Bloqueador de produção.
- **Fix sugerido:** (a) adicionar campo `payment_method` no form de venda; (b) no service `SalesService.create`, após persistir venda, criar registro em `CashRegisterEntries` (type=`income`, ref_id=sale.id, amount=sale.total). Tratar transação para rollback.

#### GAP-02 · 🐞 · J7/J12 · Produto tem um único preço (sem compra vs venda)
- **Sintoma:** Cadastro de produto aceita apenas um campo "Preço". Roteiro pedia 7,50/9,80 (compra/venda); só foi possível salvar um.
- **Consequência:** Venda de Al 40kg saiu R$ 300 (preço de compra 7,50) ao invés de R$ 392 (preço de venda 9,80).
- **Fix sugerido:** Migrar `products.price` → `products.purchase_price` + `products.sale_price` (NUMERIC). UI: dois inputs lado a lado com labels claros. Backfill: `purchase_price = price`, `sale_price = price`.

#### GAP-03 · 🐞 · J16 · `Invalid Date` em /recycling/reports
- **Sintoma:** Card de detalhe do relatório exibe literal "Invalid Date" no campo de período.
- **Causa provável:** `new Date(undefined)` ou parse de string ISO vazia no front (provável `date-fns format` sem guard).
- **Fix sugerido:** Adicionar guard `if (!d || isNaN(d)) return '—'`. Verificar endpoint `/api/reports/:id` se está retornando `created_at` em todos os casos.

#### GAP-04 · 🐞 · J7 · Onboarding não pré-cria unidades de medida
- **Sintoma:** Ao criar 1º produto, dropdown "Unidade" está vazio com mensagem "Nenhuma unidade cadastrada". Usuário precisa abandonar fluxo, ir em Settings → criar "Quilograma/kg", voltar.
- **Fix sugerido:** No signup do tenant Reciclagem, seed automático: `kg`, `t`, `un`, `m³`, `L`. Migrar tenants existentes com job idempotente.

#### GAP-05 · 🔒 · J12 · UUID vazado em mensagem de erro
- **Sintoma:** Tentativa de venda de 50kg Cu (estoque 30kg) retorna: "Estoque insuficiente para o produto `b3a1...uuid`".
- **Risco:** Vazamento de IDs internos; quebra de UX (usuário não sabe qual produto).
- **Fix sugerido:** Resolver `product.name` na camada de service antes de lançar exceção. Padrão: nunca expor UUID em mensagem voltada ao usuário.

---

### 🟡 Média (14)

| ID | Cat | Jornada | Descrição |
|----|----|---------|-----------|
| GAP-06 | 🐞 | J9 | Form de compra **perde dados** ao redirecionar para abrir caixa e voltar. |
| GAP-07 | 🐞 | J10 | Coleta criada não incrementa estoque (Papelão 200kg ficou 0). |
| GAP-08 | 🎨 | J9 | Mensagem "Abra o caixa antes de registrar" deveria ter botão "Abrir caixa agora" inline. |
| GAP-09 | 🐞 | J4 | Edição de telefone em Settings não mostra toast de sucesso (salva, mas sem feedback). |
| GAP-10 | 🎨 | J7 | Faltam máscaras pt-BR consistentes em campos de preço (alguns aceitam `.`, outros só `,`). |
| GAP-11 | 🐞 | J8 | Tela de permissões de funcionário tem toggles, mas sem `Salvar` visível (precisa rolar). |
| GAP-12 | 🎨 | J2 | Validação de senha fraca não lista regras (só diz "senha fraca"). |
| GAP-13 | 🐞 | J5 | Cadastro de fornecedor PJ não valida CNPJ duplicado dentro do mesmo tenant. |
| GAP-14 | 🎨 | J3 | Dashboard vazio sem CTA para "registre sua primeira compra" / onboarding guiado. |
| GAP-15 | 🐞 | J15 | PDF de lista de preços sai sem cabeçalho (logo + razão social). |
| GAP-16 | 🎨 | J11 | Estoque mostra todos os produtos mesmo com saldo 0 — falta filtro "somente com saldo". |
| GAP-17 | 🐞 | J14 | Caixa não exibe histórico paginado — depois de N entradas, performance degrada. |
| GAP-18 | 🔒 | J18 | Após logout, botão back do navegador renderiza dashboard cacheado por ~1s antes de redirect. |
| GAP-19 | 🐞 | J12 | Mensagem de overdraft aparece como toast vermelho mas form fica habilitado para reenviar idêntico. |

---

### 🟢 Baixa (11)

| ID | Cat | Jornada | Descrição |
|----|----|---------|-----------|
| GAP-20 | 🎨 | J1 | Card "Recicladoras" não tem hover state acessível (sem outline). |
| GAP-21 | 🎨 | J2 | Erros de validação aparecem só após submit, não onBlur. |
| GAP-22 | 💡 | J7 | Sugerir tabela de preços por categoria de material (não por SKU isolado). |
| GAP-23 | 🎨 | J6 | "Comprador" e "Cliente" usados intercambiadamente em copies. |
| GAP-24 | 🎨 | J9 | Total da compra não é exibido em destaque antes do submit. |
| GAP-25 | 💡 | J10 | Coleta poderia oferecer "converter em compra" em 1 clique. |
| GAP-26 | 🎨 | J16 | Filtros de relatório não persistem ao navegar para detalhe e voltar. |
| GAP-27 | 🎨 | J4 | Aba "Assinatura" não indica plano atual claramente. |
| GAP-28 | 💡 | J8 | Permissões deveriam ter presets (Operador, Gerente, Visualizador). |
| GAP-29 | 🎨 | J17 | Redirect cross-segment é silencioso — informar usuário com toast. |
| GAP-30 | 💡 | J14 | Caixa poderia exportar fechamento diário em PDF. |

---

## 5. Cleanup / Dados criados

> ⚠️ **Não deletar via Claude.** Time interno deve limpar manualmente ou via script de seed.

| Recurso | Identificador |
|---------|---------------|
| Tenant | `2d285800-0c71-4773-80a6-98910ded632f` |
| Owner | `qa-claude-20260428-1035@example.com` |
| Razão social | `Recicladora Teste Claude 20260428-1035 LTDA` |
| CNPJ tenant | `76.217.024/0001-69` |
| Fornecedor PJ | CNPJ `28.821.124/0001-57` |
| Comprador PJ | CNPJ `32.961.991/0001-65` |
| Funcionário | criado com email derivado, sem login executado |
| Produtos | Alumínio, Cobre, Papelão (todos com sufixo `Teste Claude 20260428-1035`) |
| Compra | R$ 1.410,00 (Dinheiro) |
| Coleta | 28/04/2026 14:00 |
| Venda | 40 kg Alumínio = R$ 300,00 |

---

## 6. Plano de Ação para Claude Code

### 6.1 Sprint 1 — Bloqueadores 🔴 (estimativa: 3–5 dias)

#### Tarefa 1.1 — GAP-01: Vendas → Caixa
- **Arquivos prováveis a investigar:**
  - `apps/backend/src/modules/recycling/sales/sales.service.ts`
  - `apps/backend/src/modules/recycling/cash-register/cash-register.service.ts`
  - `apps/frontend/src/pages/recycling/sales/`
- **Passos:**
  1. Adicionar `payment_method` no schema do form de venda (Dinheiro, Pix, Cartão, Boleto).
  2. Criar entrada em `CashTransactions` dentro da mesma transação de `SalesService.create`.
  3. Testes: cobrir (a) caixa fechado → erro, (b) caixa aberto → entry criada com amount=sale.total, (c) rollback se cash entry falhar.

#### Tarefa 1.2 — GAP-02: Preço compra vs preço venda
- **Migration:** adicionar `purchase_price NUMERIC NOT NULL DEFAULT 0`, `sale_price NUMERIC NOT NULL DEFAULT 0` em `products`. Backfill `= price_per_unit`.
- **UI:** quebrar input em dois com tooltip explicando.
- **Service:** Compras usam `purchase_price`, Vendas usam `sale_price`.

#### Tarefa 1.3 — GAP-03: Invalid Date em relatórios
- Substituir `new Date(iso + 'T00:00:00')` por util `safeFormatDate(d, fallback='—')`.
- Adicionar teste de snapshot do componente.

#### Tarefa 1.4 — GAP-04: Seed de unidades no signup
- **Backend:** hook `after_create` no fluxo de criação do schema do tenant (segmento=recycling) → seed unidades.
- **Migration de catch-up:** rodar para tenants existentes sem unidades.

#### Tarefa 1.5 — GAP-05: UUID em erro de estoque
- Localizar exception em `sales.service.ts:140`.
- Resolver `product.name` antes do raise.
- Verificar i18n: pt-BR string deve usar `{produto}` placeholder.

### 6.2 Sprint 2 — Médias 🟡 (priorizar GAP-06, 07, 11, 13)

Sugestão de agrupamento por área:
- **Caixa/Compras:** GAP-06, GAP-08, GAP-17
- **Coletas/Estoque:** GAP-07, GAP-16
- **Funcionários/Auth:** GAP-11, GAP-18
- **Cadastros/Validação:** GAP-09, GAP-10, GAP-12, GAP-13
- **Onboarding/UX:** GAP-14, GAP-15, GAP-19

### 6.3 Sprint 3 — Polimento 🟢

Tratar como "good first issue" / contribuições incrementais. Recomendado bundlear GAP-20 a GAP-30 em uma issue épica de UX consistency.

### 6.4 Definição de Pronto (DoD) por gap

- [ ] Reprodução automatizada (teste e2e Playwright/Cypress).
- [ ] Fix com testes unitários cobrindo regressão.
- [ ] Changelog atualizado.
- [ ] Validado em staging com mesmo roteiro (J9–J14 para gaps de caixa).
- [ ] Verificação de cross-check numérico passa (tabela 3.3).

---

## 7. Anexos / Próximos passos de teste

### 7.1 Re-teste recomendado após Sprint 1
Rodar **somente J9 → J14** (compra → coleta → estoque → venda → caixa) com novo tenant. Validar:
- Saldo final do caixa = `-R$ 1.410 + R$ 392 = -R$ 1.018,00`.
- Estoque Al = 60kg; Cu = 30kg; Papelão = 200kg.
- Detalhe de relatório sem `Invalid Date`.

### 7.2 Fora de escopo (sugestão para próximo ciclo)
- J8.3: login como funcionário com permissões restritas.
- Multi-tenant isolation (criar 2 tenants reciclagem e tentar cross-access).
- Performance: caixa com >1.000 entries.
- Mobile: signup e venda em viewport 375×667.
- Acessibilidade: axe-core em todas as telas críticas.

### 7.3 Observações finais
- JWT expirou em ~1h durante execução; sessão renovou via re-login. Considerar refresh-token transparente.
- Todas as ações destrutivas do roteiro foram respeitadas (nada fora do escopo deletado).
- Nenhum dado de outros tenants foi acessado.

---

**Fim do relatório.**
Gerado por Claude (Chrome plugin) · sessão `qa-claude-20260428-1035` · 28/04/2026 10:35–12:10 BRT.
