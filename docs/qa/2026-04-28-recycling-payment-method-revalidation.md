# Re-validação E2E — Forma de Pagamento em Vendas (Reciclagem)

> **Versão:** 1.0 — 2026-04-28
> **Para uso com:** plugin do Claude no Chrome (Claude for Chrome)
> **Ambiente alvo:** https://praktikus.com.br/ (PRODUÇÃO)
> **Escopo:** validar **apenas** a entrega dos commits `b4e0f2c → 500b39e` referente ao GAP-01 reclassificado.
> **Roteiro completo (referência):** [`docs/superpowers/specs/2026-04-28-recycling-e2e-test-script-design.md`](../superpowers/specs/2026-04-28-recycling-e2e-test-script-design.md)

---

## 1. Briefing

Você (IA do Claude no Chrome) vai re-testar **um pedaço cirúrgico** do segmento de Reciclagem do Praktikus: a **adição do campo "Forma de pagamento"** no formulário de venda.

**Contexto histórico:** numa execução anterior do roteiro completo, a IA reportou que vendas não geravam entrada no Caixa e classificou isso como bug 🔴 alto (GAP-01). Após análise, esse comportamento foi confirmado como **decisão de produto**: caixa é fluxo independente, com lançamentos manuais. O gap retido foi apenas a **falta do select de forma de pagamento** no form. Isso foi implementado e está em produção. Agora você vai validar que está funcionando.

**O que você está validando:**
1. O form de nova venda (`/recycling/sales/new`) tem um select "Forma de pagamento" com 4 opções: Dinheiro, PIX, Cartão, A prazo.
2. O valor selecionado é persistido (visível no detalhe da venda ou em re-fetch da listagem).
3. Cada um dos 4 valores funciona ponta-a-ponta.
4. A validação do DTO rejeita payload sem o campo (teste via DevTools, opcional).
5. **NÃO se espera** que o Caixa ganhe entrada automática — confirmar que continua inalterado após cada venda.

---

## 2. Regras de execução

> Idênticas ao roteiro completo. Repetidas aqui pra você não precisar abrir o outro arquivo.

### 2.1 Idioma e localidade
- pt-BR. Datas `DD/MM/AAAA`, valores em `R$ 1.234,56`, CEP `00000-000`, telefone `(11) 99999-9999`.

### 2.2 Geração de dados
- **CNPJ e CPF válidos pelo algoritmo de DV** — se não conseguir gerar, abra o DevTools (F12) e use código JS no console.
- Use sufixo `Reval Claude {YYYYMMDD-HHMM}` em todos os recursos que criar.
- E-mail: `qa-reval-{YYYYMMDD-HHMM}@example.com`.
- Senha forte: `Teste@Praktikus#2026!`.

### 2.3 Idempotência
- **Crie um tenant novo pra esta re-validação.** Não reaproveite tenants antigos — isola erros.
- **Não toque em dados de outros tenants.**
- Se algum dado for rejeitado por duplicidade, regenere com novo timestamp.

### 2.4 Comportamento
- Antes de qualquer ação destrutiva: confirme que foi você que criou o registro nesta sessão.
- Em erro 500 ou tela quebrada: anote como gap + screenshot, tente outro ângulo, marque jornada como bloqueada se não der.

### 2.5 Anote durante a execução
Cada anomalia: `[Categoria] [Severidade] [Jornada/Passo] Descrição`. Categorias: 🐞 Bug · 🎨 UX/copy · 💡 Sugestão · 🔒 Segurança. Severidades: 🔴 Alta · 🟡 Média · 🟢 Baixa.

---

## 3. Jornadas

### 📍 Setup — Criar tenant + dados base

#### Passo S.1 — Signup recicladora
- 🎯 **Ação:** `https://praktikus.com.br/register` → Reciclagem → preencha CNPJ válido novo, razão social com sufixo, dados do responsável. Submeta.
- ✅ **Esperado:** redirect para `/recycling/dashboard` autenticado.
- 👁 **Observar:** apenas anote tenant_id (procure em `/recycling/settings` ou no JWT no DevTools).

> Esta jornada é só pra ter um tenant onde operar. Não é foco do teste — se algo quebrar aqui, anote, mas não é o que estamos validando.

#### Passo S.2 — Cadastros mínimos para conseguir registrar uma venda
Você precisa de **1 fornecedor**, **1 comprador**, **1 produto** e **estoque positivo** desse produto antes de chegar na tela de venda.

- 🎯 **Ação:**
  - Cadastre 1 **Fornecedor PJ** (CNPJ válido, nome `Fornecedor Reval Claude {ts}`).
  - Cadastre 1 **Comprador PJ** (CNPJ válido, nome `Comprador Reval Claude {ts}`).
  - Cadastre 1 **Produto**: nome `Alumínio Reval {ts}`, unidade `kg`, preço `R$ 8,00`.
  - Registre 1 **Compra** desse produto (quantidade `200 kg`, preço `R$ 8,00`) — só pra ter estoque.
  - Confirme em `/recycling/stock` que o produto tem `200 kg` disponíveis.
- ✅ **Esperado:** todos cadastros salvos, estoque positivo.

> Se algum desses cadastros tiver bug, anote 🐞 média/baixa, mas tente seguir. Eles não são foco. Se o estoque de fato não puder ser positivo, marque a re-validação como **bloqueada** e reporte.

---

### 📍 Jornada R1 — Inspeção visual do form de venda

**Página:** `/recycling/sales/new`

#### Passo R1.1 — Abrir form
- 🎯 **Ação:** Acesse `/recycling/sales/new`.
- ✅ **Esperado:** formulário carrega com a estrutura habitual (Comprador, Itens, Resumo).
- 👁 **Observar:** primeira impressão da tela carregou ok?

#### Passo R1.2 — Confirmar presença do select "Forma de pagamento"
- 🎯 **Ação:** procure o campo **"Forma de pagamento"**. Deve estar dentro do card "Dados da venda", entre o select de Comprador e o textarea de Observações.
- ✅ **Esperado:**
  - Label: `Forma de pagamento *`.
  - Default selecionado: **Dinheiro**.
  - 4 opções no dropdown, exatamente nesta ordem: **Dinheiro · PIX · Cartão · A prazo**.
- 👁 **Observar:**
  - O label tem asterisco indicando obrigatoriedade?
  - O default é "Dinheiro" e não placeholder vazio?
  - Sem opções extras (nada como "Outro", "Convênio", etc.)?
  - Anote 🐞 alta se o select **não aparecer** — significa que a entrega não foi para produção corretamente.

#### Passo R1.3 — Tentar limpar o select
- 🎯 **Ação:** veja se é possível deixar o select sem valor (alguns selects HTML permitem deselecionar).
- ✅ **Esperado:** não dá pra deixar vazio (default sempre Dinheiro), ou se der, a validação `zod` vai bloquear.
- 👁 **Observar:** comportamento limpo? Anote 🎨 baixa se o usuário consegue chegar num estado vazio sem feedback.

---

### 📍 Jornada R2 — Persistência de cada forma de pagamento

> Para cada um dos 4 métodos, registre uma venda independente com 1 item de pequena quantidade. Vamos fazer 4 vendas no total. Quantidade total das vendas: 40 kg (10 kg cada). Resta `200 - 40 = 160 kg` no estoque ao final — válido.

#### Passo R2.1 — Venda em **Dinheiro**
- 🎯 **Ação:** `/recycling/sales/new` → Comprador = Comprador Reval Claude {ts} → adicione item: Alumínio Reval, quantidade `10 kg`, preço `R$ 9,00` → Forma de pagamento: **Dinheiro** → Submeter.
- ✅ **Esperado:** venda salva, modal/tela de confirmação aparece (provavelmente com prompt de impressão de comprovante).
- 👁 **Observar:** sucesso ou erro? Mensagem clara?

**Anote o ID/sequencial da venda.**

#### Passo R2.2 — Verificar persistência da venda em Dinheiro
- 🎯 **Ação:** Vá pra `/recycling/sales`, clique na venda recém-criada para abrir o detalhe.
- ✅ **Esperado:** detalhe mostra os dados, **incluindo a forma de pagamento como "Dinheiro"**.
- 👁 **Observar:**
  - O detalhe da venda mostra o campo "Forma de pagamento"? (Pode estar como label, ou ser preciso refrescar pra aparecer.)
  - Anote 🟡 média se o campo **for persistido mas não exibido** no detalhe — usuário registra e perde a referência.

> **Fallback se o detalhe não mostrar o campo:** abra DevTools → Network → recarregue a página → procure a request `GET /recycling/sales/<id>` e confira se o response JSON tem `paymentMethod: "CASH"`. Se sim: persistido (mas não exibido — anote como 🟡 UX). Se não: 🐞 alta — não está sendo persistido.

#### Passo R2.3 — Venda em **PIX**
- 🎯 **Ação:** repita R2.1 com forma de pagamento **PIX**, mesma quantidade (10 kg), preço (R$ 9,00).
- ✅ **Esperado:** salva.

#### Passo R2.4 — Verificar persistência da venda em PIX
- 🎯 **Ação:** mesmo procedimento de R2.2 (detalhe + fallback DevTools).
- ✅ **Esperado:** `paymentMethod: "PIX"` no JSON ou label "PIX" no detalhe.

#### Passo R2.5 — Venda em **Cartão**
- 🎯 **Ação:** repita com forma de pagamento **Cartão**.
- ✅ **Esperado:** salva.

#### Passo R2.6 — Verificar persistência em Cartão
- ✅ **Esperado:** `paymentMethod: "CARD"`.

#### Passo R2.7 — Venda em **A prazo**
- 🎯 **Ação:** repita com forma de pagamento **A prazo**.
- ✅ **Esperado:** salva — **não há erro de "caixa fechado"** (esse fluxo não existe; a prazo passa normal mesmo sem caixa).

#### Passo R2.8 — Verificar persistência em A prazo
- ✅ **Esperado:** `paymentMethod: "ON_CREDIT"`.

---

### 📍 Jornada R3 — Cross-check: Caixa **não** se mexeu sozinho

**Página:** `/recycling/cash-register`

#### Passo R3.1 — Conferir lançamentos
- 🎯 **Ação:** abra o Caixa. Olhe os lançamentos do dia.
- ✅ **Esperado:**
  - **NÃO há entradas automáticas** referentes às 4 vendas que você acabou de registrar.
  - Se você abriu/movimentou o caixa manualmente em algum momento, esses lançamentos aparecem normalmente.
  - Esta é a expectativa **correta** — caixa é fluxo independente.
- 👁 **Observar:**
  - Se você ver entradas automáticas com `referenceType: SALE` ou descrição mencionando as vendas: anote 🔴 **alta** — significa que apareceu automação não documentada (algo estranho aconteceu).
  - Se o caixa estiver totalmente intacto desde antes da Jornada R2: ✅ comportamento esperado, anote como **confirmação de regressão zero**.

---

### 📍 Jornada R4 — Validação do payload (opcional, via DevTools)

> Esta jornada é opcional, mas valida que a regra de validação do DTO está em produção. Se você se sentir confortável usando DevTools, faça. Se não, pule.

#### Passo R4.1 — Tentar payload sem paymentMethod
- 🎯 **Ação:** no DevTools (Network), pegue o cURL da última venda criada. Edite o JSON pra remover o campo `paymentMethod`. Re-envie via fetch no console:

```js
fetch('/recycling/sales', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer <token>' },
  body: JSON.stringify({
    buyerId: '<um-buyer-id-valido>',
    items: [{ productId: '<um-product-id-valido>', quantity: 1, unitPrice: 1 }]
    // sem paymentMethod intencionalmente
  })
}).then(r => r.json()).then(console.log);
```

- ✅ **Esperado:** resposta com status 400 e `message` mencionando `paymentMethod`.
- 👁 **Observar:**
  - Sucesso (201)? 🐞 **alta** — validação do DTO falhou em produção.
  - 400 mas sem mencionar paymentMethod especificamente? 🎨 média — copy poderia ser mais clara.

#### Passo R4.2 — Tentar payload com paymentMethod inválido
- 🎯 **Ação:** mesmo procedimento, mas enviando `"paymentMethod": "BITCOIN"`.
- ✅ **Esperado:** status 400 com mensagem mencionando que o valor não está no enum.

---

## 4. Template do relatório de re-validação

Ao terminar, gere um arquivo Markdown chamado `praktikus-payment-method-revalidation-{YYYYMMDD-HHMM}.md` com a estrutura abaixo.

````markdown
# Re-validação — Forma de Pagamento em Vendas

**Data:** {YYYY-MM-DD HH:MM}
**Tenant criado:** {tenant_id} · {email do responsável} · {CNPJ}
**Duração:** {tempo}

## 1. Veredicto

- **Select "Forma de pagamento" aparece no form?** ✅/❌
- **As 4 opções estão corretas e na ordem certa?** ✅/❌
- **Cada um dos 4 valores é persistido?** ✅/❌ (CASH/PIX/CARD/ON_CREDIT)
- **Caixa permaneceu sem alteração automática?** ✅/❌
- **Validação do DTO rejeita payload sem paymentMethod?** ✅/❌/(pulado)

**Conclusão:** GAP-01 (forma de pagamento) está {resolvido / parcialmente resolvido / não resolvido}.

## 2. Anomalias observadas

### 🔴 Alta
- ...

### 🟡 Média
- ...

### 🟢 Baixa
- ...

## 3. Cleanup

- Tenant: `{id}`
- Email: `{...}`
- 4 vendas criadas com IDs: `{...}`
- 1 compra de 200 kg
- 1 fornecedor, 1 comprador, 1 produto

## 4. Notas livres

{Surpresas, observações de UX que não couberam nas categorias.}
````

---

## 5. Checklist final antes do relatório

- [ ] Setup completo (tenant + cadastros mínimos)
- [ ] Jornada R1: visual do select confirmada
- [ ] Jornada R2: 4 vendas criadas e persistência verificada
- [ ] Jornada R3: cross-check do caixa feito
- [ ] Jornada R4: testada (ou explicitamente pulada)
- [ ] Veredicto preenchido
- [ ] Cleanup completo

**Boa re-validação. Foco no que foi corrigido — se algo pior aparecer no caminho, anote, mas não desvie do escopo.**
