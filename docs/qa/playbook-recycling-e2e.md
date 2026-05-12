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

1. Abra `http://localhost:8080/register`.
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

   **Fornecedor 2**:
   - Nome: `EcoMaterial Comércio`
   - CNPJ: novo válido
   - Telefone: `(11) 91234-5678`

3. **Checkpoint**: ambos aparecem na tabela.
4. **Screenshot ✓** (CP2).

### 3.3 Compradores

1. Navegue para `/recycling/buyers`.
2. Crie 2 compradores:

   **Comprador 1**:
   - Nome: `Indústria Verde Ltda`
   - CPF/CNPJ: gere CNPJ válido
   - Telefone: `(11) 99887-7665`

   **Comprador 2**:
   - Nome: `Fundição Sustentável`
   - CPF/CNPJ: gere CNPJ válido
   - Telefone: `(11) 92233-4455`

3. **Checkpoint**: ambos aparecem na tabela.
4. **Screenshot ✓** (CP3).

**Atualize o running-log.md.**

---

## Fase 4 — Abrir caixa

> **Regra de negócio**: o caixa físico só recebe transações de pagamento em **dinheiro (CASH)**. Compras PIX/CARD/ON_CREDIT NÃO tocam o caixa físico. Vendas (qualquer método) **nunca** geram transação automática no caixa — o caixa é controle independente do lojista.

1. Navegue para `/recycling/cash-register`.
2. **Checkpoint**: deve mostrar status "Caixa fechado" + botão "Abrir caixa".
3. **Screenshot ✓** (CP1).
4. Clique "Abrir caixa". A sessão abre com saldo inicial R$ 0,00 (puxado do fechamento anterior, ou zerado na primeira sessão).
5. **Checkpoint**: status muda para "Caixa aberto" + horário de abertura visível.
6. **Screenshot ✓** (CP2).

**Atualize o running-log.md.**

---

## Fase 5 — Compras

1. Navegue para `/recycling/purchases`.
2. **Checkpoint**: lista vazia + KPIs zerados.
3. **Screenshot ✓** (CP1).
4. Clique "Nova compra".
5. No formulário (página única, não wizard):
   - Selecione fornecedor `Cooperativa Reciclar`.
   - Adicione 2 itens:
     - `Papelão` × `50` kg × R$ `0,50` = R$ 25,00
     - `Alumínio` × `10` kg × R$ `8,00` = R$ 80,00
   - Total geral esperado: R$ 105,00.
   - Método de pagamento: `PIX`.
   - Observações: `Compra E2E teste`.
6. **Screenshot ✓** (CP2) — formulário preenchido com total visível.
7. Clique "Finalizar".
8. **Checkpoint**: redirect para `/recycling/purchases` (lista) com a nova compra na primeira linha.
9. **Screenshot ✓** (CP3) — listagem com a compra.
10. **Checkpoint extra (estoque)**: navegue para `/recycling/stock` e confirme:
    - Papelão: 50 kg
    - Alumínio: 10 kg
    - Ferro: 0 kg
11. **Screenshot ✓** (CP4) — estoque.
12. **Checkpoint extra (caixa)**: navegue para `/recycling/cash-register`. Confirme que **NÃO houve transação de saída** no histórico (compra foi PIX, não toca caixa físico). KPI "Saídas" = R$ 0,00.
13. **Screenshot ✓** (CP5) — caixa sem saídas.

**Bugs comuns a observar**: total não bate, estoque não atualiza, observações perdidas, compra PIX criando movimento no caixa (regressão do bug 🚨-01).

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
   - Hora: `10:00`
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
5. No formulário (página única):
   - Selecione comprador `Indústria Verde Ltda`.
   - Adicione `Papelão` × `30` kg × R$ `0,80` = R$ 24,00.
   - **Checkpoint UX**: o seletor de produto só deve mostrar produtos COM estoque > 0 (Papelão e Alumínio, NÃO Ferro).
   - Método de pagamento: `CASH` (Dinheiro).
   - Observações: `Venda E2E teste`.
6. **Screenshot ✓** (CP2) — formulário preenchido.
7. Finalize.
8. **Checkpoint**: redirect para lista, venda na primeira linha.
9. **Screenshot ✓** (CP3).
10. Navegue para `/recycling/stock`. **Checkpoint**: Papelão agora 20 kg (50 − 30).
11. **Screenshot ✓** (CP4).
12. Navegue para `/recycling/cash-register`. **Checkpoint**: vendas **NÃO** geram transação automática no caixa (regra de negócio). Histórico segue sem entradas; KPI "Entradas" = R$ 0,00.
13. **Screenshot ✓** (CP5) — caixa sem entradas automáticas de vendas.

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

**Pré-condição**: `ASAAS_API_KEY` no `.env` pode estar como `mock` (modo dev) **ou** apontar para sandbox real.

### 9.A — Modo mock (default em dev)

Quando `ASAAS_API_KEY=mock`, o backend retorna a URL `/dev/mock-checkout?tenantId=...&type=card`. O frontend abre essa página em popup local; ela tem botões "Simular sucesso" e "Simular falha". Sucesso → chama o endpoint dev `POST /api/billing/dev/simulate-card-checkout` que injeta um webhook fake `CHECKOUT_PAID`.

1. Navegue para `/recycling/settings` → aba "Assinatura".
2. Clique "Cadastrar forma de pagamento".
3. **Checkpoint**: popup local abre em `/dev/mock-checkout`.
4. **Screenshot ✓** (CP1) — popup aberto com botões.
5. Clique "Simular sucesso".
6. **Checkpoint**: popup fecha sozinho após ~1,5s.
7. **Checkpoint**: aba Assinatura mostra `VISA •••• 1234, vence 12/29` no card "Forma de pagamento".
8. **Screenshot ✓** (CP2) — cartão exibido.

### 9.B — Modo sandbox real (opcional, se configurado)

Mesma sequência, mas o popup abre a página real do Asaas (origem `sandbox.asaas.com`). Use cartão de teste `5162306219378829` / CVV `123` / validade `12/29` / nome `TESTE QA`. Webhook precisa de ngrok pra chegar no backend local.

### 9.C — Cancelar assinatura

1. Clique "Cancelar assinatura" no rodapé.
2. Confirme no modal.
3. **Checkpoint**: tela mostra `canceledAt` preenchido. Tenant continua com acesso (status ainda ACTIVE até fim do ciclo).
4. **Screenshot ✓** (CP3).

**Bugs comuns a observar**:
- Popup bloqueado (browser popup blocker).
- Webhook não chega → cartão não aparece após retorno.
- ConflictException ao tentar "Cadastrar cartão" depois de cancelar.

**Atualize o running-log.md.**

---

## Fase 10 — Fechar caixa

1. Navegue para `/recycling/cash-register`.
2. **Checkpoint**: status "Aberto" desde a Fase 4. Como a compra foi PIX e venda nunca toca caixa, o histórico está vazio. KPI Entradas/Saídas = R$ 0,00 / R$ 0,00.
3. **Screenshot ✓** (CP1).
4. Clique "Fechar caixa".
5. Sistema deve apresentar reconciliação:
   - Saldo inicial: R$ 0,00
   - Entradas CASH: R$ 0,00
   - Saídas CASH: R$ 0,00
   - Saldo final esperado: R$ 0,00
6. **Checkpoint**: confirme R$ 0,00 (sem dinheiro físico movimentado nesta sessão).
7. **Screenshot ✓** (CP2) — tela de reconciliação.
8. Confirme fechamento.
9. **Checkpoint**: status volta para "Caixa fechado". Histórico da sessão preservado.
10. **Screenshot ✓** (CP3).

> **Nota**: pra exercitar o fluxo de reconciliação com valores, faça um lançamento manual antes de fechar — clique "Nova transação", selecione `Entrada / CASH / R$ 50,00 / Suprimento de caixa`. Aí o saldo final esperado vira R$ 50,00.

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
