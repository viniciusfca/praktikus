# Design: Integração WhatsApp (Add-on cross-segmento)

**Data:** 2026-04-24
**Status:** Proposta

---

## Contexto

O Praktikus precisa de um módulo de atendimento via WhatsApp **comum a todos os segmentos** (oficina, reciclagem, futuros). Será vendido **separado** do plano base, como add-on mensal. Requisitos funcionais:

1. Inbox integrado ao Praktikus (enviar e receber mensagens sem sair do sistema).
2. Múltiplos atendentes por tenant, com **segregação por Setor** (ex: Fiscal não vê conversas do Financeiro).
3. Repasse do custo de conversas ao cliente final, com franquia mensal e excedente.
4. Ativação por tenant via feature flag, com assinatura separada no Asaas.

Como o módulo não é específico de um segmento, ele vive em `modules/core/whatsapp/`.

---

## 1. Escolha de Provedor

### Decisão: **WhatsApp Cloud API (Meta direto)**

| Opção | Prós | Contras | Decisão |
|---|---|---|---|
| Cloud API (Meta) | Oficial, sem markup de BSP, SLA da Meta, webhooks nativos | Onboarding manual (Business Manager, verificação do número) | **Escolhido** |
| BSP (Twilio/360Dialog/Gupshup) | Setup mais rápido, inbox de prateleira | Custo por mensagem 30-80% maior, depende de terceiro, menos margem | Descartado |
| Não-oficial (Baileys, wweb.js) | Zero custo Meta | Viola ToS, risco de ban do número do cliente, sem suporte | **Nunca** |

**Abstração:** `WhatsappProvider` interface no backend, implementação inicial `CloudApiProvider`. Permite trocar por BSP no futuro sem mexer em controller/entities.

---

## 2. Modelo de Dados

Todas as tabelas vivem no **schema do tenant** (seguindo o padrão multi-tenant existente).

### `whatsapp_accounts` (1 por tenant)

| Coluna | Tipo | Obs |
|---|---|---|
| `id` | uuid PK | |
| `phone_number_id` | varchar | ID do número na Cloud API |
| `waba_id` | varchar | WhatsApp Business Account ID |
| `display_phone` | varchar | Ex: `+55 11 99999-9999` |
| `access_token` | text | Token da System User (criptografado AES-256) |
| `webhook_verify_token` | varchar | Gerado por tenant, usado no handshake |
| `status` | enum | `PENDING`, `CONNECTED`, `DISCONNECTED` |
| `created_at`, `updated_at` | timestamptz | |

### `whatsapp_departments`

| Coluna | Tipo | Obs |
|---|---|---|
| `id` | uuid PK | |
| `name` | varchar | Ex: "Fiscal", "Financeiro" |
| `color` | varchar(7) | Hex, para UI |
| `business_hours` | jsonb | `{mon:{start:'08:00',end:'18:00'}, ...}` |
| `default_routing` | boolean | Um único default por tenant |

### `whatsapp_department_users` (N:N)

| Coluna | Tipo |
|---|---|
| `department_id` | uuid FK |
| `user_id` | uuid FK |
| `role_in_dept` | enum (`AGENT`, `SUPERVISOR`) |

### `whatsapp_conversations`

| Coluna | Tipo | Obs |
|---|---|---|
| `id` | uuid PK | |
| `contact_phone` | varchar | E.164 |
| `contact_name` | varchar | Nome do contato (vem do WhatsApp) |
| `department_id` | uuid FK nullable | Null enquanto não roteado |
| `assigned_user_id` | uuid FK nullable | Atendente atual |
| `status` | enum | `OPEN`, `PENDING`, `CLOSED` |
| `last_message_at` | timestamptz | |
| `window_expires_at` | timestamptz | Janela de 24h da Meta |
| `linked_customer_id` | uuid nullable | FK opcional para `customers` (oficina) ou `suppliers` (reciclagem) — resolvido por segmento |

### `whatsapp_messages`

| Coluna | Tipo | Obs |
|---|---|---|
| `id` | uuid PK | |
| `conversation_id` | uuid FK | |
| `wamid` | varchar UNIQUE | ID da Meta (dedupe de webhook) |
| `direction` | enum | `IN`, `OUT` |
| `type` | enum | `TEXT`, `IMAGE`, `AUDIO`, `DOCUMENT`, `TEMPLATE` |
| `body` | text | Para texto; para mídia, URL já baixada pro S3/local |
| `template_name` | varchar nullable | Quando `type=TEMPLATE` |
| `status` | enum | `SENT`, `DELIVERED`, `READ`, `FAILED` |
| `billable_category` | enum nullable | `SERVICE`, `UTILITY`, `MARKETING`, `AUTHENTICATION` — preenchido pelo webhook de `messages` |
| `sent_at`, `delivered_at`, `read_at` | timestamptz nullable | |

### `whatsapp_usage_counters` (agregado mensal, para billing)

| Coluna | Tipo |
|---|---|
| `year_month` | char(7) PK part. (`2026-04`) |
| `service_conversations` | int |
| `utility_conversations` | int |
| `marketing_conversations` | int |
| `authentication_conversations` | int |

Incrementado pelo webhook `messages` quando uma nova **conversation window** é criada (Meta já devolve isso no payload).

---

## 3. Extensão de `TenantEntity`

Schema **public** (já existe):

```ts
@Column({ default: false })
whatsappEnabled: boolean;

@Column({ nullable: true })
whatsappPlan: 'STARTER' | 'PRO' | 'ENTERPRISE' | null;

@Column({ nullable: true })
whatsappAsaasSubscriptionId: string | null;
```

Planos sugeridos (preços exemplificativos, ajustar com base no custo real da Meta):

| Plano | Preço/mês | Franquia (utility+marketing) | Excedente | Atendentes |
|---|---|---|---|---|
| STARTER | R$ 79 | 100 conversas | R$ 0,40/conv. | 2 |
| PRO | R$ 199 | 500 conversas | R$ 0,30/conv. | 10 |
| ENTERPRISE | R$ 499 | 2000 conversas | R$ 0,20/conv. | Ilimitado |

Service (iniciada pelo cliente final) é **sempre ilimitada** — custo zero da Meta.

---

## 4. Endpoints (Backend)

### Públicos (sem JWT)

- `GET /whatsapp/webhook/:tenantId` — handshake da Meta (query `hub.verify_token` vs `whatsapp_accounts.webhook_verify_token`).
- `POST /whatsapp/webhook/:tenantId` — recebe eventos (`messages`, `statuses`). Valida assinatura `x-hub-signature-256` HMAC-SHA256 com app secret da Meta. Enfileira em BullMQ para processamento assíncrono.

### Autenticados (JWT + TenantStatusGuard + novo `WhatsappEnabledGuard`)

| Método | Rota | Descrição |
|---|---|---|
| POST | `/whatsapp/account/connect` | Inicia setup (retorna URL do Embedded Signup da Meta ou instruções manuais) |
| GET | `/whatsapp/account` | Status da conexão |
| GET | `/whatsapp/departments` | Lista setores do tenant |
| POST | `/whatsapp/departments` | Cria setor (OWNER/ADMIN) |
| PATCH | `/whatsapp/departments/:id` | Edita |
| DELETE | `/whatsapp/departments/:id` | Remove (não permite se for default) |
| GET | `/whatsapp/conversations` | Lista conversas — filtradas por departamentos do `req.user.id` |
| GET | `/whatsapp/conversations/:id/messages` | Histórico paginado |
| POST | `/whatsapp/conversations/:id/messages` | Envia mensagem |
| PATCH | `/whatsapp/conversations/:id` | Reatribuir setor/atendente, fechar conversa |
| GET | `/whatsapp/usage` | Consumo do mês corrente (para tela de assinatura) |

**Multi-tenancy:** segue CLAUDE.md — controller extrai `tenantId` de `req.user.tenantId` e passa explícito ao service.

**Segregação por setor:** `WhatsappConversationsService.list(tenantId, userId)` faz JOIN com `whatsapp_department_users` para filtrar apenas setores do usuário. Usuários com role `OWNER` ou `ADMIN` veem todas as conversas.

---

## 5. Fluxo de Mensagens

### Entrada (cliente final → Praktikus)

```
Meta → POST /whatsapp/webhook/:tenantId
  → valida assinatura
  → enfileira job em BullMQ (queue: whatsapp-inbound)
  → retorna 200 imediato

Worker (WhatsappInboundProcessor):
  1. dedupe por wamid
  2. resolve/cria whatsapp_conversations (por contact_phone)
  3. insere whatsapp_messages
  4. se nova conversation window → incrementa whatsapp_usage_counters
  5. se conversation.department_id == null → roteia:
       - palavra-chave (configurável por setor)
       - senão → setor default
  6. emite evento via WebSocket (Socket.io) pro tenant/setor → inbox atualiza em tempo real
```

### Saída (atendente → cliente final)

```
POST /whatsapp/conversations/:id/messages
  → service verifica: janela de 24h ainda aberta?
      - SIM → envia como texto livre (categoria SERVICE, grátis)
      - NÃO → exige template aprovado (categoria UTILITY/MARKETING)
  → chama CloudApiProvider.sendMessage()
  → persiste whatsapp_messages com status=SENT, wamid retornado
  → webhook statuses atualiza para DELIVERED/READ depois
```

### Templates

- Cadastrados na Meta (fora do Praktikus inicialmente).
- Tela `/whatsapp/templates` lista templates aprovados da WABA via `GET /v20.0/{waba_id}/message_templates`.
- Variáveis do template preenchidas em modal antes do envio.

---

## 6. Billing & Repasse

### Ativação

1. OWNER acessa `Configurações → WhatsApp → Assinar`
2. Escolhe plano → backend cria **segunda assinatura** no Asaas (`asaas.subscriptions.create` com valor do plano WhatsApp)
3. `tenant.whatsappEnabled = true` após `PAYMENT_CONFIRMED` do webhook Asaas
4. Libera acesso ao menu e ao setup de conexão

### Excedente (cobrança variável)

- `@Cron('0 2 1 * *')` — dia 1 de cada mês às 2h
- Para cada tenant com `whatsappEnabled=true`:
  - Lê `whatsapp_usage_counters` do mês anterior
  - Calcula: `excedente = max(0, utility+marketing - franquia) * valor_excedente`
  - Se `excedente > 0` → cria **cobrança avulsa** no Asaas (`asaas.payments.create`, não assinatura)
- Tela de uso no frontend mostra consumo corrente e projeção

### Reuso do webhook Asaas existente

O `BillingWebhookService` atual (ver `2026-04-06-billing-completo-design.md`) trata status do plano base. Adicionar handling para eventos cujo `subscription` seja `whatsappAsaasSubscriptionId`:

- `PAYMENT_OVERDUE` → `whatsappEnabled=false`, inbox mostra aviso
- `PAYMENT_CONFIRMED` → reativa
- Status do plano base **não é afetado** pelo status do WhatsApp

---

## 7. Frontend

### Menu lateral

Novo item **"WhatsApp"** em `AppLayout`, visível apenas se `user.whatsappEnabled === true` (claim JWT novo). Se tenant não assinou → item oculto; acesso a `/whatsapp` redireciona pra tela de upsell.

### Rotas

| Rota | Página | Acesso |
|---|---|---|
| `/whatsapp` | `WhatsappInboxPage` — lista de conversas + painel de chat | Todos com setor atribuído |
| `/whatsapp/settings/departments` | `DepartmentsPage` | OWNER, ADMIN |
| `/whatsapp/settings/account` | `AccountConnectionPage` | OWNER |
| `/whatsapp/settings/templates` | `TemplatesPage` | OWNER, ADMIN |
| `/whatsapp/upsell` | `WhatsappUpsellPage` — vitrine dos planos | Quando `whatsappEnabled=false` |

### Estado

- Store Zustand `useWhatsappStore` com lista de conversas, conversa aberta, mensagens.
- WebSocket (Socket.io client) conecta em `/whatsapp` e escuta eventos do próprio setor → atualiza store.
- Chamadas HTTP via `src/services/whatsapp.ts`.

### Componentes reusáveis

- `ConversationList` (lista lateral com filtro por setor e status)
- `MessageBubble` (in/out, status icons tipo WhatsApp Web)
- `MessageComposer` (textarea + anexos + seletor de template quando janela expirada)
- `DepartmentBadge` (chip colorido)

---

## 8. Variáveis de Ambiente

```
META_APP_ID=
META_APP_SECRET=           # validação de assinatura do webhook
META_API_VERSION=v20.0
META_SYSTEM_USER_TOKEN=    # token permanente para operações administrativas
WHATSAPP_ENCRYPTION_KEY=   # AES-256 para access_token por tenant
WHATSAPP_MEDIA_STORAGE=s3  # ou 'local' em dev
```

---

## 9. Fases de Entrega

| Fase | Escopo | Estimativa |
|---|---|---|
| 1 | Entities + migrations + ativação por feature flag + menu oculto | 1 sprint |
| 2 | Setup manual de conta (sem Embedded Signup) + envio/recebimento texto | 1 sprint |
| 3 | Setores + roteamento + segregação de visibilidade | 1 sprint |
| 4 | Templates + mídia (imagem/áudio/doc) | 1 sprint |
| 5 | Billing: assinatura add-on + cobrança de excedente | 1 sprint |
| 6 | Tela de upsell + onboarding guiado (Embedded Signup) | 1 sprint |

---

## 10. Pontos em Aberto

- **Embedded Signup vs manual:** começar manual (cliente cria WABA, fornece `phone_number_id` e token) reduz complexidade da fase 1. Embedded Signup (fase 6) melhora conversão mas exige revisão da Meta do nosso App.
- **Limite de atendentes por plano:** implementar via contagem de `whatsapp_department_users` distintos no momento de adicionar — ou deixar soft limit (só alertar) na primeira versão.
- **Integração com clientes/fornecedores existentes:** resolver `linked_customer_id` por segmento — workshop usa `customers`, recycling usa `suppliers`. Proposta: match automático por telefone na primeira mensagem de um número.
- **Retenção de mídia:** Meta expira URLs em ~5min. Worker precisa baixar e armazenar. Definir política de retenção (90 dias? infinito?) em função de custo de storage.
