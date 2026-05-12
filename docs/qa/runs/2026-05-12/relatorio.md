# Smoke E2E Recycling — Relatório QA (2ª run)

**Data:** 2026-05-12
**Tester:** Claude for Chrome (Opus 4.7)
**Persona:** praktikus-qa-cli-0@mailinator.com (Antonella Xavier / Reis-Barros Reciclagem LTDA)
**Build sob teste:** http://localhost:8080 (commits `62dd9c7..af400ff`)
**Objetivo:** regression test dos 15 fixes da run anterior + fluxo bônus de permissões EMPLOYEE

## Resumo executivo

| Categoria | Quantidade |
|-----------|------------|
| Fixes validados | 13/15 ✅ |
| Bugs persistentes | 2 (⚠️-03, fechamento caixa) |
| 🚨 Críticos NOVOS | 2 (NEW-01, NEW-02 — segurança/privilege escalation) |
| ⚠️ Importantes NOVOS | 1 (NEW-03) |

## Validação dos fixes da run anterior

| Fix | Status |
|---|---|
| 🚨-01 (compra PIX → caixa) | ✅ RESOLVIDO |
| 🚨-04 ("Invalid Date" em /reports) | ✅ RESOLVIDO |
| ⚠️-01 (modal saldo inicial caixa) | ✅ RESOLVIDO |
| ⚠️-02 (banner trial 30 dias desde signup) | ✅ RESOLVIDO |
| ⚠️-04 (Nova Venda só lista produtos com estoque>0) | ✅ RESOLVIDO |
| ⚠️-05 (Dashboard "Vendas hoje") | ✅ RESOLVIDO |
| ⚠️-06 (Dashboard "Estoque agregado") | ✅ RESOLVIDO |
| ⚠️-07 (Dashboard "Próximas coletas") | ✅ RESOLVIDO (card existe; mostra vazio porque coleta foi CONCLUÍDA — validar com AGENDADA futura) |
| ⚠️-08 (/reports com 3 abas) | ✅ RESOLVIDO |
| ⚠️-09 (telefone com máscara) | ✅ listagens / ⚠️ persistente no drawer de coleta (`11912345678` sem máscara) |
| 💡-05 (Coletas com coluna Fornecedor) | ✅ RESOLVIDO |
| 💡-06 (Vendas com coluna Pagamento + filtros) | ✅ RESOLVIDO |
| 💡-07 (Asaas mock popup) | ✅ RESOLVIDO (silencioso — auto-success; cartão VISA •••• 1234 aparece) |

## Bugs persistentes da run anterior

- **⚠️-03** (Minha Conta sem dados do owner): aba ainda mostra só "Alterar senha", sem nome/email. *Nota: decisão de produto na sessão anterior foi manter assim — pode ser ignorado.*
- **Fechamento de caixa sem reconciliação**: clicar "Fechar caixa" fecha direto, sem modal de conferência (saldo inicial / entradas / saídas / saldo final esperado). Spec do playbook esperava modal.

## 🚨 Bugs novos — CRÍTICOS de segurança

### 🚨-NEW-01: Backend não aplica permissão `canRegisterSales`

**Severidade**: CRÍTICA (privilege escalation)

**Reprodução**:
1. OWNER cria EMPLOYEE.
2. OWNER acessa `/recycling/employees/:id/permissions` e DESLIGA "Registrar vendas".
3. Login como o EMPLOYEE.
4. `POST /api/recycling/sales` com payload válido.
5. **Esperado**: 403 Forbidden.
6. **Observado**: 201 Created — venda registrada com sucesso.

**Impacto**: bypass total do controle de acesso a vendas. Qualquer EMPLOYEE pode criar vendas independente das permissões granulares configuradas pelo OWNER.

### 🚨-NEW-02: Backend não aplica permissão `canViewReports`

**Severidade**: CRÍTICA (privilege escalation + vazamento de dados financeiros)

**Reprodução**:
1. OWNER cria EMPLOYEE (canViewReports default = false).
2. Login como EMPLOYEE.
3. Acessar `/recycling/reports` no browser OU chamar diretamente `GET /api/recycling/reports/dashboard-stats`, `/api/recycling/reports/purchases?startDate=...&endDate=...`, `/api/recycling/reports/top-materials-ranking`.
4. **Esperado**: 403 Forbidden em todos.
5. **Observado**: 200 OK em todos. Dados retornados (R$ 105,00 total compras, ranking de materiais, etc.).

**Impacto**: EMPLOYEE consegue ver KPIs financeiros, ranking de compras, e detalhes de transações que o OWNER explicitamente NÃO autorizou.

### ⚠️-NEW-03: Frontend não esconde rotas/itens de menu por permissão granular

**Severidade**: importante (UX + ergonomia)

**Reprodução**:
1. EMPLOYEE logado (sem `canRegisterSales`).
2. Sidebar mostra "Vendas" como item clicável.
3. Acessar a página dá tela normal.

**Esperado**: sidebar oculta itens cujas permissões granulares estão desligadas (mesma lógica que já oculta "Funcionários" e "Configurações" pra não-OWNER).

**Nota**: este é UX layer — a correção real é o fix dos backends (NEW-01/02). Mesmo com backend corrigido, vale também esconder na UI pra não confundir o usuário.

## Fluxos validados ✅

- [x] Signup recicladora com persona Antonella/Reis-Barros — banner trial 30 dias ✓
- [x] Configurações (Empresa CEP 01310-100, 3 Unidades de medida, Assinatura Trial R$ 89,90)
- [x] Cadastros (3 produtos com Tabela 1/2/3, 2 fornecedores, 2 compradores)
- [x] Caixa aberto via modal saldo inicial R$ 0,00 às 20:56:59
- [x] Compra PIX R$ 105,00 (Papelão 50kg + Alumínio 10kg) — caixa NÃO tocado ✓
- [x] Coleta EcoMaterial 12/05 10:00 — comentário adicionado, status CONCLUÍDA
- [x] Venda CASH R$ 24,00 (Papelão 30kg) — caixa NÃO tocado (regra respeitada) ✓
- [x] Dashboard com KPIs e Reports com 3 abas + sem Invalid Date
- [x] Billing mock — cartão VISA •••• 1234 cadastrado, assinatura cancelada (acesso preservado)
- [x] Fechamento de caixa direto (sem modal reconciliação — bug menor)
- [x] Logout + relogin como Owner — countdown 7:59:56 HH:MM:SS ✓, dados persistem
- [x] Bônus: criação EMPLOYEE + permissões granulares + login funcionou; backend NÃO aplica permissões (NEW-01/02)

## Recomendações de prioridade

1. **🚨-NEW-01/02** — fixar IMEDIATAMENTE. Esses são bugs de segurança. Aplicar `PermissionsGuard` nos endpoints `POST /sales`, `GET /reports/*` (e revisar TODOS os outros endpoints que dependem de permissões granulares — `canManageSuppliers`, `canManageBuyers`, `canManageProducts`, `canOpenCloseCash`, `canViewStock`, `canRegisterPurchases`, `canManageColetas`).
2. **⚠️-NEW-03** — esconder itens de sidebar baseado nas permissões granulares do JWT (provavelmente expor as flags no JWT ou fazer fetch no login).
3. **⚠️-09 drawer coleta** — aplicar `formatPhoneBr` no drawer/modal de detalhes da coleta.
4. **Fechamento de caixa sem modal** — adicionar modal de reconciliação ao fluxo.
