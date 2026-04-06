# Design: Billing Completo (Entrega 9)

**Data:** 2026-04-06
**Status:** Aprovado

---

## Contexto

O módulo de billing já possui `BillingService.setupTrial()` que cria cliente + assinatura no Asaas. O `TenantEntity` tem `status` (TRIAL/ACTIVE/OVERDUE/SUSPENDED), `trialEndsAt` e `billingAnchorDate`. Falta: receber webhooks do Asaas, bloquear acesso por inadimplência, reajuste anual via IPCA e tela de assinatura no frontend.

---

## 1. Webhooks Asaas

**Endpoint:** `POST /billing/webhook` — público (sem JWT, sem tenant guard)

**Validação:** Header `asaas-signature` verificado via HMAC-SHA256 com `ASAAS_WEBHOOK_TOKEN` do `.env`. Assinatura inválida → 401.

**Mapeamento de eventos → status:**

| Evento Asaas | `tenants.status` |
|---|---|
| `PAYMENT_RECEIVED` / `PAYMENT_CONFIRMED` | `ACTIVE` |
| `PAYMENT_OVERDUE` | `OVERDUE` |
| `SUBSCRIPTION_INACTIVATED` | `SUSPENDED` |

Eventos desconhecidos → 200 (ignorados silenciosamente). Toda atualização de status é logada via `Logger`.

---

## 2. Bloqueio de Acesso

**Abordagem:** JWT claim + Guard no backend (sem query extra por request).

### Backend

- `tenant_status` adicionado ao payload JWT em `AuthService.generateTokens`
- Novo `TenantStatusGuard` aplicado globalmente (via `APP_GUARD`) — lança `ForbiddenException('conta_suspensa')` se `tenant_status === 'SUSPENDED'`
- `JwtUser` no frontend atualizado com campo `tenant_status`

### Frontend

- Interceptor axios 403 em `api.ts`: detecta código `'conta_suspensa'` → redireciona para `/suspended`
- Nova rota pública `/suspended` → `SuspendedPage` (sem AppLayout, sem auth guard)
  - Mensagem clara de suspensão
  - Botão "Regularizar" → abre `https://www.asaas.com/login` em nova aba
- `AppLayout`: banner `CAlert color="warning"` fixo para `tenant_status === 'OVERDUE'`

---

## 3. Reajuste Anual (IPCA)

**Mecanismo:** `@Cron('0 9 1 * *')` — executa dia 1 de cada mês às 9h.

**Lógica:**
1. Busca tenants com `billing_anchor_date` igual ao dia atual
2. Consulta IPCA acumulado 12 meses via API IBGE: `https://servicodados.ibge.gov.br/api/v3/agregados/6691/periodos/{periodo}/variaveis/63`
3. Para cada tenant, chama `PATCH /subscriptions/{asaasSubscriptionId}` no Asaas com novo valor
4. Se API IBGE falhar → loga erro, não aplica reajuste (retenta no próximo ciclo)

Nenhuma nova coluna necessária — `billingAnchorDate` já existe no `TenantEntity`.

---

## 4. Tela de Assinatura (Frontend)

**Localização:** Nova aba "Assinatura" na `SettingsPage` (OWNER only), ao lado de "Empresa" e "Minha Conta".

**Conteúdo:**
- Badge de status colorido: TRIAL=azul, ACTIVE=verde, OVERDUE=amarelo, SUSPENDED=vermelho
- Data de vencimento (trial) ou próxima cobrança (`billingAnchorDate`)
- Botão "Gerenciar assinatura" → `https://www.asaas.com/login` (nova aba)

**Dados:** `GET /workshop/company` já retorna `trialEndsAt` e `billingAnchorDate` — nenhum endpoint novo necessário.

---

## Variáveis de Ambiente Necessárias

```env
ASAAS_WEBHOOK_TOKEN=    # segredo para validação HMAC do webhook
```

---

## Fora do Escopo

- Histórico de faturas
- Atualização de método de pagamento dentro da plataforma
- Superadmin para configurar índice de reajuste (IPCA fixo via API IBGE)
