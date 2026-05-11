# Smoke E2E Recycling — Relatório QA

**Data:** 2026-05-11
**Tester:** Claude for Chrome (Opus 4.7)
**Persona:** praktikus-qa-cli-0@mailinator.com
**Build sob teste:** http://localhost:8080 (commit local `eda1ee2`)

## Resumo executivo

| Categoria | Quantidade |
|-----------|------------|
| 🚨 Críticos | 4 |
| ⚠️ Importantes | 9 |
| 💡 UX/menores | 6 |
| Fases ✓ | 9 |
| Fases ⚠️ com bugs não bloqueantes | 2 (4, 8) |
| Fases 🚨 críticas | 1 (7) |
| Fases BLOCKED | 1 (10) |

## Fluxos validados

- [x] Signup tenant Recicladoras → tenant + owner criados + login automático
- [x] Configurações: ViaCEP, unidades de medida, dados da empresa salvos
- [x] CRUD de Produtos com tabelas de preço (1/2/3, herança da Tabela 1)
- [x] CRUD de Fornecedores com CNPJ válido
- [x] CRUD de Compradores com CNPJ válido
- [x] Abertura de caixa (mas com bug — ver 🚨-04)
- [x] Compra com múltiplos itens + atualização de estoque
- [x] Coleta: agendamento, comentário, conclusão, alternar calendário/lista
- [x] Venda com baixa correta de estoque
- [ ] Integração Vendas/Compras ↔ Caixa (quebrada — 🚨-01/02/03)
- [x] Dashboard KPIs (parcial — vendas e coletas não aparecem)
- [x] Relatório de Compras com filtro de período (mas com dados "Invalid Date")
- [x] Cadastro de forma de pagamento via mock checkout
- [x] Cancelamento de assinatura (acesso preservado até fim do ciclo)
- [ ] Fechamento de caixa com reconciliação (BLOCKED por estado inconsistente)
- [x] Logout + relogin com persistência de dados
- [x] Countdown de sessão em formato HH:MM:SS

## Bugs encontrados

### 🚨 Críticos

**🚨-01 — Compra PIX gera transação de saída no Caixa físico**
- Fase 7 / CP6
- Após compra de R$ 105 com forma de pagamento PIX, o caixa registrou "Saída PIX R$ 105,00 — Compra de materiais"
- PIX não deveria afetar caixa físico (Dinheiro); só CASH deveria
- Impacto: contabilidade incorreta, fechamento de caixa impossível de validar

**🚨-02 — Venda CASH NÃO gera transação de entrada no Caixa**
- Fase 7 / CP6
- Venda de R$ 24,00 (Forma de pagamento = Dinheiro) não apareceu no histórico do caixa
- Playbook esperava "transação automática de R$ 24,00 (entrada CASH)"
- Impacto: caixa não reflete realidade financeira

**🚨-03 — Saldo atual do Caixa inconsistente com soma de transações**
- Fase 7 / CP6
- KPIs mostrados: ABERTURA R$ 0,00 / ENTRADAS R$ 0,00 / SAÍDAS R$ 105,00 / SALDO ATUAL **R$ 0,00**
- Matemática esperada: 0 + 0 − 105 = −105 (ou 0 se negativo for clampado)
- Impacto: usuário vê saldo R$ 0 enquanto sistema descontou R$ 105

**🚨-04 — Gráfico e tabela de Relatórios mostram "Invalid Date"**
- Fase 8 / CP2
- /recycling/reports → "Compras por dia" → eixo X tem 1 barra com label "Invalid Date"; tabela "Detalhe diário" linha "Invalid Date — R$ 105,00 — 1"
- Backend ou frontend está retornando/parseando data malformada
- Impacto: relatório inutilizável para análise temporal

### ⚠️ Importantes

**⚠️-01 — Caixa abre com R$ 0,00 sem pedir saldo inicial**
- Fase 4 / CP2
- Clicar "Abrir caixa" abre sessão direto sem modal; texto da UI diz "saldo é puxado do fechamento anterior" (mas é a primeira sessão)
- Impacto: usuário não consegue iniciar com troco

**⚠️-02 — Banner amarelo de trial ausente no header**
- Fase 1 / CP5
- Playbook esperava banner amarelo "trial termina em 30 dias" no topo do layout
- Trial só aparece dentro de Configurações > Assinatura

**⚠️-03 — Aba "Minha conta" não exibe email/nome do owner**
- Fase 2 / CP5
- Aba contém apenas form de Alterar senha; dados do usuário só aparecem no dropdown do avatar

**⚠️-04 — Dropdown de produtos em Venda inclui itens sem estoque**
- Fase 7 / CP3
- Ferro (0 kg) aparece selecionável; após seleção mostra "Estoque: 0 kg" mas não impede registro

**⚠️-05 — Dashboard: "Vendas (hoje)" mostra placeholder "Métrica em breve"**
- Fase 8 / CP1
- Card existe mas não exibe valor real (esperado R$ 24,00)

**⚠️-06 — Dashboard: card "Estoque" não exibe valor**
- Fase 8 / CP1
- Mostra "Veja em Estoque" em vez de valor agregado

**⚠️-07 — Dashboard: "Próximas coletas" não mostra coleta agendada**
- Fase 8 / CP1
- Existe coleta para 12/mai (amanhã) com status concluída, mas card mostra "Nenhuma coleta agendada"

**⚠️-08 — Reports sem abas de Vendas e Top Materiais**
- Fase 8 / CP2
- Playbook esperava 3 abas (Compras, Vendas, Top Materiais); só há relatório de Compras

**⚠️-09 — Telefone exibido sem máscara após salvar**
- Fases 2, 3
- Em Configurações > Empresa e nas listagens de fornecedor/comprador, telefone aparece como "51955873402" em vez de "(51) 95587-3402"

### 💡 UX / menores

**💡-01 — Rota `/register/segment` não existe**
- Fase 1 / CP1
- Console: `No routes matched location "/register/segment"`. Rota real é `/register`. Playbook precisa atualizar.

**💡-02 — Modal de fornecedor/comprador sem campo "Contato"**
- Fase 3
- Playbook pediu "Contato: Maria Silva" etc., mas modal não tem essa coluna

**💡-03 — Wizard de Compra/Venda é single-page, não 3 passos**
- Fases 5 e 7
- UI exibe todos os campos numa única view (mais eficiente); playbook descreve 3 passos sequenciais

**💡-04 — Modal Nova coleta tem só "Hora" (não início+fim)**
- Fase 6
- Playbook esperou Hora início e Hora fim (10:00–12:00)

**💡-05 — List view de Coletas não mostra fornecedor**
- Fase 6 / CP5
- Colunas: Data/Hora, Observações, Status. Sem coluna Fornecedor.

**💡-06 — Lista de Vendas sem coluna "Pagamento"**
- Fase 7 / CP4
- Inconsistente com lista de Compras (que tem coluna Pagamento + filtros Dinheiro/PIX/Cartão)

**💡-07 — Mock checkout do Asaas é "silencioso"**
- Fase 9 / CP1
- Não abre popup visível; faz chamada `POST /api/billing/checkout-session` e cadastra o cartão direto via webhook. Funcional, mas diferente do playbook que esperava popup com "Simular sucesso".

## Recomendações de prioridade

1. **Investigar 🚨-01/02/03** — a integração caixa ↔ compras/vendas precisa ser revista por completo. Provavelmente um único bug com efeitos cascata: ou o registrador de transação está mapeando o método de pagamento errado, ou está pegando o tipo (entrada/saída) invertido, ou ambos.
2. **🚨-04** — checar serialização de data no endpoint do relatório (provavelmente um `null` ou string ISO inválida).
3. **⚠️-01** — decidir produto: ou pede saldo no abertura da primeira sessão, ou explicita que sempre começa em R$ 0,00 (e tira o texto enganoso da UI).
4. **⚠️-04** — adicionar validação de estoque (server + client) ao selecionar produto em venda.
5. **💡-01** — atualizar playbook e specs para usar `/register` em vez de `/register/segment`.

## Persona e dados gerados (para referência)

- Tenant: Santos EIRELI Reciclagem LTDA / channels Recicla
- CNPJ: 17.098.657/0001-36
- Owner: Alexandre Franco Jr. / praktikus-qa-cli-0@mailinator.com / Praktikus@2026
- Endereço: Av. Paulista, 1000, Sala 200, Bela Vista, São Paulo/SP, CEP 01310-100
- Unidades: Quilograma (kg), Tonelada (ton), Unidade (un)
- Produtos: Papelão (kg, R$0,50), Alumínio (kg, R$8,00), Ferro (kg, R$1,20)
- Fornecedores: Cooperativa Reciclar (CNPJ 11.222.333/0001-81), EcoMaterial Comércio (CNPJ 19.131.243/0001-97)
- Compradores: Indústria Verde Ltda (27.865.757/0001-02), Fundição Sustentável (33.014.556/0001-96)
- Compra: #D2CFBB78 — Papelão 50kg + Alumínio 10kg = R$ 105,00 PIX (Cooperativa Reciclar)
- Coleta: 12/05/2026 10:00 EcoMaterial — Concluída
- Venda: #E6638488 — Papelão 30kg × R$0,80 = R$ 24,00 CASH (Indústria Verde)
- Estoque final: Papelão 20kg / Alumínio 10kg / Ferro 0kg
- Caixa: Aberto desde 11/05/2026 16:12, NÃO fechado (BLOCKED na Fase 10)
- Forma de pagamento: VISA •••• 1234 (mock) — Assinatura cancelada em 11/05/2026

## Screenshots

Executado via Claude for Chrome sem acesso ao filesystem local — screenshots ficaram inline na conversa do Chrome. IDs (ss_xxxxx) registrados para cada checkpoint; podem ser re-capturados sob demanda.
