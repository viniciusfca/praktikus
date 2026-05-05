# Design — Cobrança self-service via Asaas

**Data:** 2026-05-04
**Status:** aprovado em brainstorming, aguardando revisão do spec antes do plano de implementação

---

## 1. Contexto e objetivo

O Praktikus já tem um módulo de billing funcional ([apps/backend/src/modules/core/billing/](../../apps/backend/src/modules/core/billing/)) que cria customer + subscription no Asaas durante o signup, processa webhooks e aplica reajuste anual via IPCA. Tudo roda hoje em modo `mock` (variável `ASAAS_API_KEY=mock`).

O design original ([2026-04-06-billing-completo-design.md](../../plans/2026-04-06-billing-completo-design.md)) deliberadamente **excluiu do escopo** a atualização do método de pagamento dentro da plataforma — Asaas mandaria boleto/PIX por email e o cliente pagaria fora do Praktikus.

Este spec **inverte essa decisão** e adiciona o que falta para começar a cobrar de verdade:

- O dono da oficina **cadastra cartão e/ou paga PIX dentro do Praktikus**, sem precisar abrir email ou acessar o painel do Asaas.
- O sistema gerencia o ciclo completo (trial → vencimento → atraso → suspensão → reativação) com bloqueio progressivo.
- A integração sai do modo `mock` e passa a operar em sandbox/produção real.

Frase-síntese: **"trial de 30 dias sem cartão, depois cliente paga PIX nativo ou cartão via popup do Asaas Checkout, com bloqueio progressivo OVERDUE→SUSPENDED em 5 dias, e self-service total numa aba Assinatura."**

---

## 2. Decisões aprovadas

| # | Tema | Decisão |
|---|------|---------|
| 1 | Modelo de cobrança | Trial 30 dias **sem cartão obrigatório**. Ao final, cliente escolhe PIX ou cartão. |
| 2 | PIX | **Manual mensal** (cliente paga cada fatura na aba Assinatura). Pix Automático fica como evolução futura. |
| 3 | Cartão | **Recorrente via Asaas Checkout (popup)**. Cliente nunca digita cartão dentro do Praktikus → sem PCI-DSS. |
| 4 | Bloqueio | **Estrito**: banner countdown a partir do dia 23 do trial; OVERDUE no dia 31; SUSPENDED após 5 dias em OVERDUE. |
| 5 | Plano | Único, **R$ 89,90/mês**. |
| 6 | Nota fiscal | **Sem NF no MVP**. NFS-e via Asaas fica como evolução futura. |
| 7 | Aba Assinatura | Completa: status, método atual, fatura aberta com QR PIX, histórico de 12 faturas, cancelamento. |
| 8 | Emails | **Híbrido**: Asaas manda transacionais (fatura, comprovante, atraso); Praktikus manda ciclo de vida (trial expira, suspensão, reativação) via Resend. |

---

## 3. Modelo de dados

### Tabela `tenants` (sem mudanças)

Já contém `status`, `trialEndsAt`, `billingAnchorDate`, `cnpj`. Reaproveitada inteiramente.

### Tabela `billings` (alterada)

Campos atuais: `id`, `tenantId`, `asaasCustomerId`, `asaasSubscriptionId`, `createdAt`, `updatedAt`.

Campos novos:

```typescript
billingType: 'PIX' | 'CREDIT_CARD' | null   // método ativo (null = ainda não escolheu)
cardLast4: string | null                     // últimos 4 dígitos
cardBrand: string | null                     // 'VISA', 'MASTERCARD', etc.
cardExpiry: string | null                    // 'MM/YY'
nextDueDate: Date | null                     // próximo vencimento (sync via webhook)
canceledAt: Date | null                      // null = ativa; preenchido = cancelada
```

### Tabela `billing_invoices` (nova)

Espelha as cobranças do Asaas localmente para histórico e exibição da fatura aberta sem bater na API toda hora.

```typescript
id (UUID, pk)
tenantId (UUID, FK tenants.id, indexed)
asaasPaymentId (varchar, UNIQUE)            // ID da cobrança no Asaas
value (decimal 10,2)
dueDate (date)
status: 'PENDING' | 'CONFIRMED' | 'OVERDUE' | 'REFUNDED' | 'DELETED'
paidAt (timestamptz, nullable)
billingType: 'PIX' | 'CREDIT_CARD' | 'BOLETO'   // BOLETO incluído só pra não quebrar se admin criar manualmente no painel Asaas
pixQrCode (text, nullable)                  // base64 da imagem (cache)
pixCopyPaste (text, nullable)               // string copia-e-cola (cache)
pixExpiresAt (timestamptz, nullable)        // quando regenerar
createdAt, updatedAt
```

Populada via webhook (`PAYMENT_CREATED` insere; demais eventos atualizam). QR Code do PIX é puxado on-demand na primeira vez que o cliente abre a aba Assinatura com fatura pendente, depois cacheado até `pixExpiresAt`.

### Migration

Uma migration única em [apps/backend/src/database/migrations/](../../apps/backend/src/database/migrations/) que: adiciona as 6 colunas na `billings` e cria a `billing_invoices` com seus índices.

---

## 4. Backend

### `BillingService` — métodos

**Existentes (com correções):**

- `setupTrial(tenantId, email, name, cnpj)` — passa a enviar `cpfCnpj` no payload do Asaas (obrigatório em produção). Subscription criada com `billingType: 'UNDEFINED'` (cliente escolhe ao pagar a primeira fatura) em vez de `CREDIT_CARD` hardcoded. Valor lido do env (`ASAAS_PLAN_VALUE=89.90`) tanto no `value` quanto no `description`. Já existe rollback de customer órfão quando subscription falha — mantém.
- `findTenantIdBySubscriptionId(subId)` — sem mudanças.
- `applyAnnualAdjustment()` — corrige o bug do filtro: hoje compara só `anchor.getDate() !== todayDay`; deve comparar também `anchor.getMonth() !== today.getMonth()` para rodar **uma vez por ano** no mês de aniversário do tenant, não todo mês.

**Novos:**

- `getCurrentBilling(tenantId)` — retorna dados da aba Assinatura: status, plano, valor, método ativo, próxima cobrança, dias restantes do trial.
- `getOpenInvoice(tenantId)` — retorna a fatura `PENDING` ou `OVERDUE` mais recente, com QR PIX gerado/cacheado se `billingType === 'PIX'`.
- `listPaidInvoices(tenantId, limit=12)` — histórico das últimas faturas com status `CONFIRMED`.
- `generatePixForInvoice(invoiceId)` — chama `GET /v3/payments/<paymentId>/pixQrCode` no Asaas, cacheia `encodedImage`/`payload`/`expirationDate` em `billing_invoices`.
- `createCheckoutSessionForCard(tenantId)` — chama `POST /v3/checkouts` em modo RECURRENT (ver seção 5), retorna `{ checkoutUrl, sessionId }` para o front abrir popup. Quando o tenant está em TRIAL, a `nextDueDate` da nova subscription é igual ao `trialEndsAt` original — **cadastrar cartão durante o trial não antecipa cobrança**, só garante que a primeira fatura será paga automaticamente no fim do trial.
- `createCheckoutSessionForInvoice(invoiceId)` — chama `POST /v3/payments/<id>/checkoutPayment` em modo SINGLE para liquidar uma fatura específica via cartão.
- `removeCard(tenantId)` — PATCH na subscription Asaas (`billingType: 'PIX'`); limpa `cardLast4/Brand/Expiry` no banco.
- `cancelSubscription(tenantId)` — `POST /v3/subscriptions/<id>/cancel`; preenche `canceledAt`. Tenant continua ACTIVE até o fim do ciclo pago, depois entra em SUSPENDED naturalmente (sem webhook OVERDUE porque não vai gerar próxima fatura).
- `reactivateSubscription(tenantId)` — se cliente cancelou e mudou de ideia antes do fim do ciclo, recria a subscription via Asaas.
- `syncInvoiceFromWebhook(payload)` — upsert em `billing_invoices` (ON CONFLICT em `asaasPaymentId`).
- `syncCardFromWebhook(payload)` — popula `cardLast4/Brand/Expiry` quando vem `CHECKOUT_PAID` ou `PAYMENT_CONFIRMED` com dados do cartão.

### `BillingController` — endpoints

Todos protegidos por JWT + role `OWNER` (só dono da oficina mexe em billing). `tenantId` extraído de `req.user.tenantId` no controller e passado explicitamente para o service (regra do [CLAUDE.md](../../../CLAUDE.md)).

```
GET    /billing                          → getCurrentBilling
GET    /billing/invoices                 → listPaidInvoices
GET    /billing/invoices/open            → getOpenInvoice
POST   /billing/invoices/:id/pix         → generatePixForInvoice (regenera se expirou)
POST   /billing/checkout-session         → createCheckoutSessionForCard
POST   /billing/invoices/:id/checkout    → createCheckoutSessionForInvoice
DELETE /billing/card                     → removeCard
POST   /billing/cancel                   → cancelSubscription
POST   /billing/reactivate               → reactivateSubscription
POST   /billing/webhook                  → existente, expandido (ver seção 6)
```

### `BillingStatusGuard` (novo, global)

Aplicado em **todos os controllers exceto `auth/*` e `billing/*`**. Lê `req.user.tenant_status` (claim do JWT):

- `ACTIVE`, `TRIAL` → passa
- `OVERDUE` → passa (banner avisa, não bloqueia uso)
- `SUSPENDED` → bloqueia com `403 { code: 'conta_suspensa' }` (frontend já tem interceptor para redirecionar a `/suspended`)

A lógica embrionária está no `AppLayout` do frontend; aqui ela é formalizada também no backend para evitar bypass por chamadas diretas à API.

### Cron jobs

```typescript
@Cron('0 9 * * *')   // todo dia 9h
async sendTrialReminders() {
  // tenants com trialEndsAt em 7 dias → email "Trial expira em 7 dias"
  // tenants com trialEndsAt em 1 dia  → email "Trial expira amanhã"
}

@Cron('0 10 * * *')  // todo dia 10h
async transitionOverdueToSuspended() {
  // tenants em OVERDUE há mais de PRAKTIKUS_GRACE_PERIOD_DAYS → SUSPENDED + email
}

@Cron('0 9 1 * *')   // dia 1 de cada mês, 9h (já existe; corrigir bug do filtro)
async applyAnnualAdjustment()
```

A transição `TRIAL → OVERDUE` no dia 31 é **disparada pelo webhook** (`PAYMENT_OVERDUE` da primeira fatura), não por cron — Asaas já cuida disso. O cron só age na transição `OVERDUE → SUSPENDED` (5 dias depois).

---

## 5. Integração Asaas Checkout

Asaas **não tem JS SDK de tokenização** (estilo Stripe Elements). As únicas alternativas para capturar cartão sem PCI-DSS são página hospedada (Checkout) ou redirect/popup. Optamos por popup do Asaas Checkout porque é a opção que mais se aproxima de "nativo" sem exigir certificação.

### Arquitetura de subscriptions

Asaas Checkout em modo `RECURRENT` cria uma **subscription nova** — não anexa cartão a uma subscription existente. Isso significa:

- A subscription criada no `setupTrial` (PIX, vence em 30 dias) é **provisória**.
- Quando o cliente cadastra cartão recorrente, cancelamos a subscription provisória e criamos uma nova via Checkout.
- Quando o cliente troca de cartão, mesma coisa: cancela a atual e cria outra.

É um padrão Asaas (uma subscription ativa por customer, ela carrega o cartão).

### Tipo 1 — Checkout RECURRENT (cadastro de cartão)

Usado em "Cadastrar cartão" / "Trocar cartão" / "Migrar de PIX para cartão".

```http
POST /v3/checkouts
Content-Type: application/json
access_token: <ASAAS_API_KEY>

{
  "billingTypes": ["CREDIT_CARD"],
  "chargeTypes": ["RECURRENT"],
  "minutesToExpire": 30,
  "callback": {
    "successUrl": "https://app.praktikus.com.br/settings/assinatura?checkout=success",
    "cancelUrl":  "https://app.praktikus.com.br/settings/assinatura?checkout=cancel",
    "expiredUrl": "https://app.praktikus.com.br/settings/assinatura?checkout=expired"
  },
  "items": [{ "name": "Plano Praktikus", "value": 89.90, "quantity": 1 }],
  "customerData": {
    "name": "<tenant.name>",
    "email": "<tenant.email>",
    "cpfCnpj": "<tenant.cnpj>"
  },
  "subscription": {
    "cycle": "MONTHLY",
    "nextDueDate": "<trialEndsAt se em trial; hoje+30 se já ACTIVE>"
  },
  "externalReference": "tenant_<uuid>"
}
```

Resposta esperada: `{ id, link }`. O `link` é a URL aberta no popup.

Quando o cliente conclui o cadastro, o webhook `CHECKOUT_PAID` chega no Praktikus → backend cancela a subscription antiga, salva o novo `asaasSubscriptionId`, popula `cardLast4/Brand/Expiry`.

### Tipo 2 — Checkout SINGLE (pagar fatura aberta com cartão)

Usado quando o cliente está em OVERDUE/PENDING e clica "Pagar com cartão" numa fatura específica. Não troca a subscription, só liquida aquela cobrança.

```http
POST /v3/payments/<paymentId>/checkoutPayment
```

Resposta: link de pagamento daquela cobrança específica. Fluxo de popup é idêntico ao Tipo 1; webhook recebido é `PAYMENT_CONFIRMED`.

### PIX — sem checkout, totalmente nativo

```http
GET /v3/payments/<paymentId>/pixQrCode
```

Resposta: `{ encodedImage, payload, expirationDate }`. Front exibe o QR (base64 inline) + botão "copiar código" com `payload` (string copia-e-cola). Cacheamos em `billing_invoices.pixQrCode`/`pixCopyPaste`/`pixExpiresAt` até `expirationDate`.

### Fluxo do popup no frontend

1. Cliente clica "Cadastrar cartão" / "Pagar com cartão".
2. Front chama o endpoint apropriado do Praktikus → backend cria sessão no Asaas → retorna `{ checkoutUrl, sessionId }`.
3. Front chama `window.open(checkoutUrl, 'asaas', 'width=480,height=720')` **sincronamente no `onClick`** (sem `await` antes — browsers bloqueiam popups que não são em resposta direta a clique).
4. Front inicia polling em `GET /billing` a cada 3s.
5. Cliente preenche cartão na página do Asaas → Asaas dispara webhook `CHECKOUT_PAID` → backend atualiza estado.
6. Próximo polling do front detecta a mudança → fecha popup (ou popup auto-fecha via `successUrl` com JS embarcado) → toast "Cartão cadastrado!".
7. Se cliente fechar o popup antes de pagar → polling expira em 5min → toast "Cadastro cancelado".

---

## 6. Webhook expandido

Já existente em [billing.controller.ts](../../apps/backend/src/modules/core/billing/billing.controller.ts), validação HMAC-SHA256 mantida. Hoje trata 4 eventos; vai para 8.

| Evento Asaas | Ação no Praktikus |
|--------------|-------------------|
| `PAYMENT_CREATED` | Insere fatura em `billing_invoices` (status PENDING). |
| `PAYMENT_CONFIRMED` / `PAYMENT_RECEIVED` | Update fatura → CONFIRMED + `paidAt`. Tenant SUSPENDED/OVERDUE → ACTIVE; envia email "conta reativada". |
| `PAYMENT_OVERDUE` | Update fatura → OVERDUE. Tenant ACTIVE → OVERDUE. |
| `PAYMENT_REFUNDED` | Update fatura → REFUNDED. Tenant volta para OVERDUE; envia email "houve um problema com seu pagamento". |
| `PAYMENT_DELETED` | Marca fatura como DELETED (soft-delete). |
| `CHECKOUT_PAID` | Cadastro de cartão concluído: cancela subscription antiga, salva nova subscription + cartão. |
| `CHECKOUT_EXPIRED` | Loga apenas; popup do front detecta via timeout. |
| `SUBSCRIPTION_INACTIVATED` | Marca billing como cancelado. |

### Idempotência

- `asaasPaymentId` é UNIQUE em `billing_invoices`; usar `INSERT ... ON CONFLICT DO UPDATE`.
- Transições de status do tenant são idempotentes (ACTIVE → ACTIVE = no-op).
- Cron de SUSPENDED checa o status atual antes de transicionar (evita race com webhook que está chegando).

---

## 7. Frontend

### Estrutura de arquivos

```
apps/frontend/src/
├── pages/
│   ├── settings/
│   │   └── BillingTab.tsx              ← novo (rota /settings/assinatura)
│   └── SuspendedPage.tsx               ← novo (rota /suspended)
├── components/billing/
│   ├── BillingStatusCard.tsx
│   ├── PaymentMethodCard.tsx
│   ├── OpenInvoiceCard.tsx
│   ├── InvoiceHistoryTable.tsx
│   ├── CancelSubscriptionDialog.tsx
│   └── AsaasCheckoutPopup.tsx
├── hooks/
│   ├── useBilling.ts                   ← React Query: getCurrentBilling
│   ├── useOpenInvoice.ts               ← React Query com polling quando popup aberto
│   └── useCheckoutSession.ts           ← cria sessão e abre popup
├── services/
│   └── billing.service.ts              ← chamadas axios
└── store/
    └── billing.store.ts                ← Zustand: estado UI (popup aberto, etc.)
```

### Acesso à aba

Item novo no menu lateral de **Configurações**, com label "Assinatura" e rota `/settings/assinatura`. Aparece sempre que o usuário tem role `OWNER` (mesma regra do guard de backend). Banners (countdown e OVERDUE) e o botão "Pagar agora" da SuspendedPage levam diretamente a esta rota.

### Aba `BillingTab` — layout vertical

1. **`BillingStatusCard`** — plano, valor, status, próxima cobrança ou "trial expira em X dias".
2. **`OpenInvoiceCard`** — só aparece se houver fatura PENDING/OVERDUE. Mostra valor, vencimento, **QR Code PIX grande + copia-e-cola**, botão "Pagar com cartão" (abre popup Tipo 2).
3. **`PaymentMethodCard`** — cartão atual (`Visa ••••1234, vence 12/29`) com botão "Trocar cartão"; se PIX, mostra "PIX a cada vencimento" + botão "Migrar para cartão"; se nada, CTA "Cadastrar forma de pagamento".
4. **`InvoiceHistoryTable`** — últimas 12 faturas pagas: data | valor | método | status. Sem download de comprovante (Asaas envia por email).
5. **`CancelSubscriptionDialog`** — link discreto no fim. Modal de confirmação ("vai perder acesso ao final do ciclo atual").

### Banner countdown (TRIAL, dias 23-30)

Renderizado em todas as páginas via `AppLayout`. Cor amarela.

> ⚠️ Seu trial termina em **X dias**. Cadastre uma forma de pagamento para não perder acesso → [Cadastrar agora]

Limite configurável via `PRAKTIKUS_TRIAL_WARNING_DAYS` no env.

### Banner OVERDUE (persistente)

Cor vermelha, em todas as páginas:

> 🚫 Sua assinatura está em atraso. Pague agora para evitar suspensão em **N dias**. → [Pagar agora]

### `SuspendedPage` (tela cheia)

Substitui o `AppLayout` inteiro. Header só com logo. Conteúdo:
- Título "Sua assinatura foi suspensa".
- Subtítulo "Pague a fatura em aberto para reativar imediatamente sua conta".
- Botão "Ver fatura e pagar" → leva para `/settings/assinatura` (única rota não-bloqueada além de `/suspended`).
- Links discretos "Sair" e "Falar com suporte".

Roteamento: o `App` decodifica o JWT; se `tenant_status === 'SUSPENDED'` E rota atual ∉ {`/settings/assinatura`, `/suspended`} → redireciona para `/suspended`.

### Estados visuais por `tenant_status`

| Status | Banner | Bloqueio | Aba Assinatura |
|--------|--------|----------|----------------|
| TRIAL (dias 1-22) | nenhum | livre | acessível |
| TRIAL (dias 23-30) | amarelo countdown | livre | acessível |
| ACTIVE | nenhum | livre | acessível |
| OVERDUE | vermelho persistente | livre | acessível, com fatura em destaque |
| SUSPENDED | (já está em SuspendedPage) | TUDO bloqueado | única rota acessível |

---

## 8. Emails (Resend)

Reaproveita o [MailService](../../apps/backend/src/modules/core/mail/mail.service.ts) existente, que já usa Resend (`from: 'Praktikus <no-reply@praktikus.com.br>'`) com template visual definido (cor `#348E91`, layout HTML pronto).

Novos métodos seguindo o mesmo padrão:

- `sendTrialExpiringWarning(email, name, daysLeft, paymentUrl)` — disparado pelo cron 7 dias antes.
- `sendTrialExpiringTomorrow(email, name, paymentUrl)` — 1 dia antes.
- `sendAccountSuspended(email, name, paymentUrl)` — quando entra em SUSPENDED.
- `sendAccountReactivated(email, name)` — quando volta para ACTIVE.
- `sendPaymentRefundIssue(email, name, paymentUrl)` — quando webhook `PAYMENT_REFUNDED` chega.

Os transacionais "burocráticos" (fatura disponível, comprovante, lembrete de vencimento) ficam por conta do Asaas — ele já manda automaticamente.

---

## 9. Cadastros operacionais e env vars

### No painel do Asaas (uma vez por ambiente)

**Sandbox (https://sandbox.asaas.com):**
1. Criar conta gratuita.
2. Integrações → Chave de API → gerar e guardar.
3. Integrações → Webhooks → URL `https://staging.app.praktikus.com.br/billing/webhook`, gerar token aleatório, marcar todos os 8 eventos da seção 6, tipo "API v3".
4. Configurações → Cobrança → habilitar PIX, ajustar retry de cartão (3 tentativas em 7 dias).
5. Configurações → Personalização → subir logo do Praktikus para suavizar o branding na página de Checkout.
6. Solicitar ao gerente de conta a permissão `CHECKOUT:WRITE` (em sandbox vem por padrão; em produção exige análise).

**Produção (https://www.asaas.com):**
- Mesmos passos no painel principal.
- KYC: enviar CNPJ Praktikus, contrato social, dados bancários para repasse. Leva ~3-10 dias úteis. **Iniciar em paralelo com o desenvolvimento.**

### Env vars em [`apps/backend/.env.example`](../../apps/backend/.env.example)

```bash
# Já existentes — ajustar:
ASAAS_API_KEY=mock                              # mock | <chave sandbox> | <chave produção>
ASAAS_API_URL=https://sandbox.asaas.com/api/v3
ASAAS_PLAN_VALUE=89.90                          # corrigido de 69.90

# Novas:
ASAAS_WEBHOOK_TOKEN=<32+ chars aleatórios>      # mesmo valor cadastrado no painel
ASAAS_CHECKOUT_SUCCESS_URL=https://app.praktikus.com.br/settings/assinatura?checkout=success
ASAAS_CHECKOUT_CANCEL_URL=https://app.praktikus.com.br/settings/assinatura?checkout=cancel
ASAAS_CHECKOUT_EXPIRED_URL=https://app.praktikus.com.br/settings/assinatura?checkout=expired
ASAAS_CHECKOUT_EXPIRE_MINUTES=30
PRAKTIKUS_GRACE_PERIOD_DAYS=5                   # OVERDUE → SUSPENDED
PRAKTIKUS_TRIAL_WARNING_DAYS=7                  # quando começa o banner countdown
BILLING_PRODUCTION_ENABLED=false                # flag de rollout (ver seção 10)
```

### Modo `mock` continua existindo

Em desenvolvimento local sem Asaas, `ASAAS_API_KEY=mock` mantém comportamento atual: cria IDs fake, não bate em nada externo. **O mock será expandido** para também simular o fluxo de Checkout (retorna URL fake; um botão dev no front simula o webhook `CHECKOUT_PAID` para destravar testes E2E).

### Cartões de teste (sandbox)

- `5162306219378829` (Mastercard) → aprovado.
- `4000000000000002` (Visa) → recusado por fundos insuficientes.
- `4000000000000010` (Visa) → recusado genérico.
- CVV: 3 dígitos quaisquer; validade futura qualquer; nome qualquer.

PIX em sandbox: o painel admin tem botão "Confirmar pagamento" que dispara o webhook `PAYMENT_RECEIVED`.

---

## 10. Estratégia de rollout

1. **Fase 1 — sandbox**: implementa tudo, testa fluxos E2E manualmente e automatizado, valida webhook. Sem clientes reais.
2. **Fase 2 — produção com flag**: deploy em produção com `BILLING_PRODUCTION_ENABLED=false`. Apenas tenants em allowlist (ou novos signups específicos) passam pelo fluxo Asaas real; resto continua no `mock`. Permite validar com 1-2 oficinas reais sem expor toda a base.
3. **Fase 3 — geral**: muda a flag para `true`; todos os tenants passam pelo fluxo Asaas real.

A flag é apenas uma checagem no `BillingService` (`if (this.config.get('BILLING_PRODUCTION_ENABLED') === 'true' && tenant em allowlist)`). Sem necessidade de plataforma de feature flags.

---

## 11. Fora do escopo (explicitamente excluído do MVP)

| Feature | Motivo |
|---------|--------|
| NF-e/NFS-e da mensalidade | Decidido: agregar NFS-e Asaas em fase posterior |
| Pix Automático (débito recorrente em PIX) | PIX manual mensal no MVP |
| Múltiplos planos (Basic/Pro/Premium) | Plano único — toda a UI assume isso |
| Cupons de desconto | Sem código de promoção, sem trial estendido |
| Mudança de plano (upgrade/downgrade) | Não existe outro plano para mudar |
| Pausa temporária de assinatura | Cliente cancela ou não cancela |
| Cobrança por seats/usuários | Plano flat |
| Tela admin de billing (superadmin) | Sem painel de inadimplentes — usar painel Asaas direto |
| Boleto bancário | Só PIX e cartão |
| Cobrança no signup ("freemium reverso") | Trial é de graça, sem cartão obrigatório |
| Refund/estorno via UI | Operação manual no painel Asaas |
| Histórico de mudanças de método | Mostra só o cartão atual |

---

## 12. Riscos e mitigações

### Técnicos

1. **Inconsistência entre subscription antiga e nova** — quando cliente cadastra cartão, cancelamos a subscription provisória e criamos nova via Checkout. Mitigação: webhook `CHECKOUT_PAID` é o ponto de commit; só cancela a antiga depois que `CHECKOUT_PAID` chega. Idempotência forte no service.

2. **Race entre cron de SUSPENDED e pagamento de última hora** — cron roda 10h; se cliente paga 9:59 e webhook chega 10:01, cron pode marcar SUSPENDED antes do webhook reativar. Mitigação: cron checa status atual antes de transicionar; webhook é idempotente. Worst case: tenant fica SUSPENDED por minutos — aceitável.

3. **Popup bloqueado pelo browser** — `window.open` é bloqueado se não for em resposta direta a clique do usuário. Mitigação: chamar `window.open` **sincronamente** no `onClick` (sem `await` antes). Fallback: toast "Permita popups e tente novamente" + opção de abrir em nova aba.

4. **Webhook duplicado pelo retry do Asaas** — Mitigação: `asaasPaymentId` UNIQUE com `INSERT ... ON CONFLICT DO UPDATE`; estado do tenant idempotente.

5. **Tenant com CNPJ inválido falha no Asaas** — signup atual aceita qualquer string de 14 dígitos. Mitigação: garantir que o `CNPJValidator` (já existe em [validation/](../../apps/backend/src/modules/core/validation/)) está aplicado no `register.dto.ts`.

6. **`setupTrial` falha durante signup** — se Asaas estiver fora ou recusar, signup quebra. Mitigação: signup salva o tenant primeiro; `setupTrial` em try/catch separado; se falhar, tenant existe sem entry em `billings` e cron de retry tenta a cada 1h. Cliente vê banner "configurando assinatura".

### Operacionais

7. **KYC do Asaas demora pra aprovar produção** — 5-10 dias úteis. Mitigação: iniciar KYC em paralelo com o desenvolvimento (não bloqueia sandbox).

8. **Cliente paga PIX em chave errada** — Mitigação: nada a fazer no Praktikus. UI deixa claro "use exatamente este código".

9. **Chargeback** — webhook `PAYMENT_REFUNDED` dispara. Tratamento: tenant volta a OVERDUE, email notifica cliente.

---

## 13. Próximos passos

Spec aprovado → `superpowers:writing-plans` cria o plano de implementação detalhado, com tasks ordenadas, TDD onde cabível, e a task final obrigatória de **Quality Gate (Sonar)** conforme [_quality-gate-task-template.md](_quality-gate-task-template.md).
