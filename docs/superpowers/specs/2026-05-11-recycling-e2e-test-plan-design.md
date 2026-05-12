# Design — Plano de teste E2E do segmento Recycling via Claude for Chrome

**Data:** 2026-05-11
**Status:** aprovado em brainstorming, aguardando revisão do spec antes do plano de implementação

---

## 1. Contexto e objetivo

O segmento Recycling do Praktikus é o mais maduro do produto — tem 12 módulos backend (buyers, cash-register, coletas, employees, price-tables, products, purchases, reports, sales, stock, suppliers, units) com ~50 endpoints REST, e 18 páginas frontend cobrindo desde dashboard até relatórios. Nunca foi testado E2E ponta-a-ponta.

Esse spec descreve um **smoke test E2E** executado pelo **Claude for Chrome** (extensão de browser que automatiza testes manuais via interação visual). O objetivo é gerar um baseline inicial de bugs funcionais e melhorias de UX, validando o fluxo "desde cadastro no segmento até toda a operação".

Frase-síntese: **"smoke E2E completo do segmento Recycling em ambiente local + Asaas sandbox, executado pelo Claude for Chrome em 11 fases, gerando relatório markdown + screenshots no final."**

---

## 2. Decisões aprovadas

| # | Tema | Decisão |
|---|------|---------|
| 1 | Escopo | **Smoke E2E completo** — cobrir todos os fluxos uma vez (happy path). Estimativa 4-6h de execução. |
| 2 | Ambiente | **Local Docker stack** + **Asaas sandbox real** (cartão de teste documentado, webhooks reais). Resend continua dev mode. |
| 3 | Aspectos | **Funcional + UX óbvia**. Mobile responsivo, permissões EMPLOYEE e a11y ficam para runs separadas. |
| 4 | Output | **Markdown + screenshots** em `docs/qa/runs/YYYY-MM-DD/`. Screenshots gitignored, MDs commitados. |
| 5 | Setup | **Reset DB completo + signup novo** via `/register/segment`. Dados gerados (CNPJ/CPF válidos por algoritmo, emails Mailinator). |

---

## 3. Cronograma de execução

11 fases ordenadas cronologicamente. Cada fase tem **checkpoints validáveis** — Claude tira screenshot e registra resultado. A Fase 0 é setup humano; as Fases 1–11 são Claude.

| # | Fase | O que Claude faz | Tempo |
|---|------|------------------|-------|
| 0 | **Setup pré-teste** (humano) | Subir stack: `docker compose up -d postgres redis backend frontend`. Configurar `ASAAS_API_KEY` para sandbox real. Resetar DB via script (ver Seção 6). | 5 min |
| 1 | **Signup Recycling** | `/register/segment` → escolhe Recicladoras → wizard 2 passos com dados gerados → valida redirect para `/recycling/dashboard` vazio + banner trial "30 dias". | 15 min |
| 2 | **Configurações iniciais** | Aba **Empresa**: completar endereço via CEP, telefone, logo. Aba **Unidades de medida**: criar `kg`, `ton`, `unidade`. Aba **Minha Conta**: validar dados. Aba **Assinatura**: validar R$ 89,90/mês + status TRIAL + cards de billing (sem cadastrar cartão ainda — vai pra Fase 9). | 30 min |
| 3 | **Cadastros base** | 3 produtos com preços (Papelão R$0,50/kg, Alumínio R$8/kg, Ferro R$1,20/kg) — anotar se tabela de preço é criada automaticamente ou se requer UI explícita. 2 fornecedores (CNPJ válido por algoritmo). 2 compradores (CPF válido). | 30 min |
| 4 | **Abrir caixa** | `/recycling/cash-register` → abrir caixa com R$ 100 inicial → validar status ABERTO. | 5 min |
| 5 | **Compras** | `/recycling/purchases/new` → wizard completo: fornecedor → 2 itens (Papelão 50kg + Alumínio 10kg) → pagamento PIX → finalizar. Validar: aparece em listagem, KPIs do mês atualizam, estoque preenchido em `/recycling/stock`. | 30 min |
| 6 | **Coletas** | `/recycling/coletas` → calendário → nova coleta (próximos dias, fornecedor existente, observações). Adicionar comentário. Marcar como CONCLUÍDA. Validar transição visual + filtros (lista vs calendário). | 30 min |
| 7 | **Vendas** | `/recycling/sales/new` → wizard: comprador → 1 item do estoque → pagamento CASH → finalizar. Validar: aparece em listagem, estoque diminui, caixa atual recebe transação automática. | 30 min |
| 8 | **Relatórios** | `/recycling/dashboard` — validar KPIs preenchidos (compras R$, vendas R$, kg, top materiais). `/recycling/reports` — gráficos populados, ranking top materiais, filtros de período. | 20 min |
| 9 | **Billing self-service** ⭐ | `/recycling/settings` → Assinatura → "Cadastrar cartão". Asaas Checkout abre (popup real). Preenche cartão sandbox aprovado (`5162306219378829`, CVV 123, validade futura). Volta. Valida cartão exibido em `PaymentMethodCard`. Testa "Cancelar assinatura" → modal → confirma. Valida `canceledAt` set (tenant continua ACTIVE até fim do ciclo). | 40 min |
| 10 | **Fechar caixa** | `/recycling/cash-register` → fechar caixa. Validar reconciliação: saldo final = saldo inicial + vendas CASH − compras CASH. Histórico da sessão preservado em `cash_sessions`. | 10 min |
| 11 | **Logout + relogin** | Logout via dropdown do avatar. Login com mesma conta. Validar `display` da sessão = `8:00:00` (não mais `MM:SS`). Persistência: caixa fechado, produtos/compras/vendas todos visíveis. | 10 min |

**Total estimado**: 4h 15min. Claude tem buffer pra retry quando elemento demorar a carregar.

---

## 4. Como Claude opera

### Estilo de instrução

Linguagem natural com checkpoints explícitos. Claude for Chrome funciona melhor com "vá em X, faça Y, confirme que Z apareceu" do que com scripts robóticos. Exemplo concreto:

> "Na barra lateral, clique em **Fornecedores**. Clique no botão **Novo**. Preencha: nome `Cooperativa Reciclar`, CNPJ válido (gere via algoritmo brasileiro), telefone `(11) 98765-4321`, contato `Maria`. Salve. **Checkpoint**: a tabela deve listar o fornecedor recém-criado na primeira linha. Tire screenshot e prossiga."

### Geração de dados

- **CNPJ / CPF**: válidos via algoritmo de checksum brasileiro (Claude já conhece). Nunca usar `11111111111`/`00000000000`.
- **Emails**: padrão `praktikus-qa-<phase>-<seq>@mailinator.com`.
- **Telefones**: aleatórios, formato BR válido `(DD) 9XXXX-XXXX`.
- **Endereço**: CEP real para testar lookup ViaCEP (ex: `01310-100` Av. Paulista).
- **Datas**: sempre futuras pra coletas (amanhã, próxima semana).

### Screenshots

- **Diretório**: `docs/qa/runs/YYYY-MM-DD/screenshots/`
- **Naming**: `phaseN-checkpointM-descricao.png` (ex: `phase5-cp2-purchase-step2-itens.png`)
- **Captura sempre em**: (a) início de cada fase, (b) cada checkpoint validado, (c) cada bug encontrado, (d) cada toast/modal de erro inesperado.

### Running log durante a execução

- **Arquivo**: `docs/qa/runs/YYYY-MM-DD/running-log.md`
- A cada fase Claude anexa: status (✓/✗), tempo gasto, anomalias percebidas, screenshots referenciados.
- Esse log vira matéria-prima pra montar o relatório final na Fase 11.

### Política de retry

- Elemento não aparece em 10s → retry 1x → ainda não? Registra como **bug funcional**.
- Página em loop de loading → reload 1x → ainda? Registra como **bug crítico**.
- Toast de erro inesperado → captura screenshot + console log (se acessível) → registra → **continua** (não trava fase).

### Quando parar antes do final

- **Bloqueador crítico** (signup falha, login falha, dashboard 500) → Claude pula direto pra "escrever relatório parcial". Status: `PARCIAL`.
- **Bloqueador de fase** → marca a fase como `BLOCKED`, captura tudo, tenta a próxima fase com setup mínimo (ex: pula Compras se Caixa não abriu, mas tenta Compradores independente).
- **Tudo OK** → roda até Fase 11 + relatório completo. Status: `COMPLETO`.

### Severidade que Claude atribui

- 🚨 **Crítico**: feature core não funciona, dataloss, erro 500, signup/login quebrado, cálculo financeiro errado.
- ⚠️ **Importante**: feature funciona mas com comportamento incorreto em edge cases visíveis, validação ausente, dado salvo errado.
- 💡 **UX**: funciona mas é confuso, feio, requer mais cliques que o necessário, label ruim.
- ✓ **OK**: fluxo validado sem problemas (também vai pro relatório como evidência de cobertura).

---

## 5. Estrutura do relatório final

Salvo em `docs/qa/runs/YYYY-MM-DD/relatorio.md`. Template fixo:

```markdown
# Relatório de Teste E2E — Segmento Recycling

**Data**: YYYY-MM-DD
**Ambiente**: Local + Asaas sandbox
**Branch / SHA**: <branch> / <sha>
**Tempo total**: Hh MMmin
**Status**: COMPLETO | PARCIAL (bloqueado na Fase X)

## Resumo executivo

| Severidade | Quantidade |
|------------|-----------|
| 🚨 Críticos | X |
| ⚠️ Importantes | Y |
| 💡 Melhorias UX | Z |
| ✓ Fluxos validados | N/11 fases |

**Top 3 riscos**:
1. <problema mais grave>
2. <segundo>
3. <terceiro>

## 🚨 Bugs Críticos
### B-CRIT-NNN: Título
**Fase**: N — Nome
**Como reproduzir**: 1. ... 2. ...
**Esperado** vs **Observado**
**Screenshot**: [path](screenshots/phaseN-cpM.png)
**Notas**: console errors, requests falhando, etc.

## ⚠️ Bugs Importantes
(mesmo formato — B-IMP-NNN)

## 💡 Melhorias UX
(mesmo formato — UX-NNN; inclui Sugestão)

## ✓ Fluxos validados
- [x/✗] Fase N — Nome

## Apêndice
- Dados gerados (CNPJ tenant, emails, fornecedores criados)
- Ambiente (Node, pnpm, SHAs, Asaas mode, Resend mode)
- Link para running-log.md
```

### Critérios de qualidade do relatório (Claude valida antes de finalizar)

- Cada bug tem reprodução numerada + screenshot + esperado vs observado.
- Severidade está claramente atribuída.
- Resumo executivo bate com a soma das seções abaixo.
- Sem placeholders (TODO/TBD).
- Caminhos de screenshots existem em disco.

---

## 6. Setup pré-teste (Fase 0 — humano)

### Stack local

```bash
docker compose up -d postgres redis backend frontend
```

Aguardar `praktikus_backend: Up (healthy)` e `praktikus_frontend: Up`.

### Reset do DB

Script TS dedicado (a ser implementado no plano) que:

1. Faz `DROP SCHEMA public CASCADE; CREATE SCHEMA public;` no DB principal.
2. Roda todas as migrations (`pnpm --filter backend migration:run`).
3. (Opcional) Seed admin de plataforma (`pnpm --filter backend seed:admin-dev`).
4. Loga: "DB resetado. Pronto para signup novo."

### Configurar Asaas sandbox

No `.env`:

```bash
ASAAS_API_KEY=<chave do sandbox real, não 'mock'>
ASAAS_API_URL=https://sandbox.asaas.com/api/v3
ASAAS_WEBHOOK_TOKEN=<token configurado no painel sandbox>
```

Restart backend (`docker restart praktikus_backend`).

No painel Asaas sandbox, garantir que webhook está apontando para `http://localhost:3000/api/billing/webhook` (provavelmente vai precisar de ngrok ou cloudflared porque o Asaas precisa acessar o webhook de fora). Se ngrok não estiver disponível, o teste da Fase 9 valida o popup mas o webhook não chega — registrar como limitação esperada.

### Iniciar Claude for Chrome

1. Abrir Chrome com a extensão instalada.
2. Configurar API key.
3. Abrir `http://localhost:8080/`.
4. Passar o cronograma da Seção 3 como instrução inicial.

---

## 7. Fora do escopo (explicitamente excluído)

| Item | Por quê |
|------|---------|
| Mobile responsivo | Decisão Q3: run separada |
| Permissões EMPLOYEE (canManage*, canView*) | Decisão Q3: run "regressão de permissões" separada |
| Módulo WhatsApp | Add-on, não é Recycling core |
| Segmento Workshop | Foco é Recycling apenas |
| Console admin (`/admin`) | Plataforma do dono, não cliente final |
| Performance / a11y / segurança | Smoke E2E não é a ferramenta certa |
| Cenários OVERDUE / SUSPENDED do tenant | Trial expira em 30 dias — manipulação de DB exigida; vai para run dedicada de billing |
| Múltiplos tenants (isolation) | Single-tenant apenas |
| I18n | Pt-BR fixo |

---

## 8. Riscos

### Técnicos / operacionais

1. **Claude for Chrome em popup cross-origin (Asaas Checkout)**: popup do Asaas é janela com origem `sandbox.asaas.com`. Claude pode não conseguir interagir. Mitigação: se travar, captura print, registra como **B-IMP** "popup do Asaas não automatizável — humano preenche cartão manualmente", continua.

2. **Asaas sandbox instável**: latência, erros 500 esporádicos. Mitigação: retry 1x; se persistir, marca Fase 9 como `BLOCKED — depend Asaas`.

3. **Webhook Asaas não chega no localhost**: sandbox Asaas precisa de URL pública. Mitigação: ou usar ngrok/cloudflared (humano configura na Fase 0), ou aceitar que webhook não dispara — UI ainda valida o popup, mas o backend não recebe `CHECKOUT_PAID`.

4. **ViaCEP fora do ar**: Fase 2 lookup. Mitigação: preencher endereço manual, registra **B-IMP** "CEP lookup sem fallback claro pro usuário".

5. **Screenshots pesados**: 200+ screenshots por run = ~50-100 MB. Mitigação: `.gitignore` em `docs/qa/runs/*/screenshots/*.png`; manter só MDs no git.

6. **Dados de teste colidindo**: CNPJ aleatório pode bater com tenant existente (raro). Mitigação: regenera se signup falhar com "CNPJ já existe".

7. **Claude perde contexto após 4h**: sessão longa. Mitigação: running log permite retomar de outro ponto; fases são independentes.

8. **Resend em dev mode oculta bugs de email**: templates podem estar quebrados. Mitigação: registrar **B-IMP** follow-up "validar templates Resend com chave real em run dedicada".

### De produto (não bloqueiam o teste, mas vão informar próximos passos)

9. **Provável: features incompletas que ainda não tinha como saber**: ex: tabela de preços via UI pode não existir; relatórios podem ter filtros incompletos; permissões granulares podem ter bugs latentes. Esses são justamente os tipos de bug que o smoke vai expor.

---

## 9. Próximos passos

Spec aprovado → `superpowers:writing-plans` cria o plano de implementação com tasks ordenadas:

1. Criar script `scripts/reset-recycling-db.ts` (drop+recreate+migrations).
2. Criar estrutura `docs/qa/runs/.gitkeep` + atualizar `.gitignore` (excluir screenshots).
3. Criar `docs/qa/playbook-recycling-e2e.md` — versão executável do cronograma da Seção 3, pronto pra colar no Claude for Chrome.
4. Criar template `docs/qa/templates/relatorio-template.md` + `running-log-template.md`.
5. Documentar setup do Claude for Chrome em `docs/qa/setup-claude-for-chrome.md`.
6. (Opcional) Helper `scripts/generate-test-data.ts` que pré-gera CNPJ/CPF válidos pra Claude consumir.
