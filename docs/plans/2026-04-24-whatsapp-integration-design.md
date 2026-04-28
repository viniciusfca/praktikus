# Design: Integração WhatsApp (Add-on cross-segmento)

**Data inicial:** 2026-04-24
**Última revisão:** 2026-04-28 (consolidação com design handoff `_design-reference/design_handoff_whatsapp_module/`)
**Status:** Proposta — pronta para virar plano de execução

---

## Contexto

O Praktikus precisa de um módulo de atendimento via WhatsApp **comum a todos os segmentos** (oficina, reciclagem, futuros). Vendido **separado** do plano base, como add-on mensal. Requisitos funcionais:

1. Inbox integrado ao Praktikus (enviar e receber mensagens sem sair do sistema).
2. Múltiplos atendentes por tenant, com **segregação por Setor** (ex: Fiscal não vê conversas do Financeiro).
3. Repasse do custo de conversas ao cliente final, com franquia mensal e excedente.
4. Ativação por tenant via feature flag, com assinatura separada no Asaas.

Como o módulo não é específico de um segmento, ele vive em `apps/backend/src/modules/core/whatsapp/`.

**Referências de design:**
- Spec original: este documento (versão 2026-04-24, agora atualizada).
- Design handoff visual: `_design-reference/design_handoff_whatsapp_module/` (mocks de alta fidelidade, tokens, copy em pt-BR finalizado).
- O frontend será desenvolvido usando a skill `/frontend-design` (instrução do usuário).

---

## 1. Escolha de Provedor

### Decisão: **WhatsApp Cloud API (Meta direto)**

| Opção | Prós | Contras | Decisão |
|---|---|---|---|
| Cloud API (Meta) | Oficial, sem markup de BSP, SLA da Meta, webhooks nativos | Onboarding manual (Business Manager, verificação do número) | **Escolhido** |
| BSP (Twilio/360Dialog/Gupshup) | Setup mais rápido, inbox de prateleira | Custo por mensagem 30-80% maior, depende de terceiro, menos margem | Descartado |
| Não-oficial (Baileys, wweb.js) | Zero custo Meta | Viola ToS, risco de ban do número do cliente, sem suporte | **Nunca** |

**Abstração:** `WhatsappProvider` interface no backend, implementação inicial `CloudApiProvider`. Permite trocar por BSP no futuro sem mexer em controller/entities.

**Observação operacional:** "atendente" é um conceito apenas do Praktikus (`whatsapp_department_users`). A Meta não tem esse conceito — para a Cloud API existe um WABA + um `phone_number_id` + um `access_token`, e quem manda mensagem é quem detém o token (no nosso caso, o backend). Os limites reais da Meta são tier do número, quantidade de phone numbers no WABA, e templates aprovados — nada depende de quantos usuários internos do Praktikus operam a inbox.

---

## 2. Modelo de Dados

Todas as tabelas de operação vivem no **schema do tenant** (seguindo o padrão multi-tenant existente). Apenas as colunas adicionadas a `tenants` ficam no schema `public`.

### `whatsapp_accounts` (1 por tenant)

| Coluna | Tipo | Obs |
|---|---|---|
| `id` | uuid PK | |
| `phone_number_id` | varchar | ID do número na Cloud API |
| `waba_id` | varchar | WhatsApp Business Account ID |
| `display_phone` | varchar | Ex: `+55 11 99999-9999` |
| `access_token` | text | Token da System User (criptografado AES-256 com `WHATSAPP_ENCRYPTION_KEY`) |
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
| `routing_keywords` | text[] nullable | Palavras-chave para roteamento (Fase 3) |

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
| `body` | text | Para texto; para mídia, URL no storage (Tigris/local) já baixada |
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

### Coluna nova em `tenants` (schema `public`)

Além de `whatsappEnabled`, `whatsappPlan`, `whatsappAsaasSubscriptionId` (já especificadas em §3):

| Coluna | Tipo | Obs |
|---|---|---|
| `whatsapp_agent_limit_override` | int nullable | Quando preenchida, sobrescreve o limite padrão do plano (10). Alterada manualmente por admin do Praktikus para clientes com necessidade negociada. |

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

@Column({ name: 'whatsapp_agent_limit_override', type: 'int', nullable: true })
whatsappAgentLimitOverride: number | null;
```

### Tabela de planos

Limite de atendentes **igual em todos os planos**: 10. Acima disso, exige negociação manual (preencher `whatsappAgentLimitOverride`). O diferencial competitivo entre planos passa a ser **franquia × valor de excedente × preço**.

| Plano | Preço/mês | Franquia (utility+marketing) | Excedente | Atendentes |
|---|---|---|---|---|
| STARTER | R$ 79 | 100 conversas | R$ 0,40/conv. | 10 |
| PRO | R$ 199 | 500 conversas | R$ 0,30/conv. | 10 |
| ENTERPRISE | R$ 499 | 2000 conversas | R$ 0,20/conv. | 10 |

Service (iniciada pelo cliente final) é **sempre ilimitada** — custo zero da Meta.

**Hard limit de atendentes (Fase 5):**
- Ao tentar adicionar o N+1-ésimo `whatsapp_department_users` distinct user (onde N = `whatsappAgentLimitOverride ?? 10`), o backend retorna `422` com mensagem clara.
- Frontend desabilita o botão "Adicionar atendente" quando bater o limite e mostra CTA de upgrade/contato.
- Implementação: count distinct de `user_id` em `whatsapp_department_users` antes do INSERT.

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
| **POST** | **`/whatsapp/conversations`** | **Cria nova conversa partindo de telefone livre OU cadastro existente; exige template aprovado (UTILITY/MARKETING)** |
| GET | `/whatsapp/conversations/:id/messages` | Histórico paginado |
| POST | `/whatsapp/conversations/:id/messages` | Envia mensagem (texto ou template) |
| PATCH | `/whatsapp/conversations/:id` | Reatribuir setor/atendente, fechar conversa, vincular `customer_id`/`supplier_id` manualmente |
| GET | `/whatsapp/conversations/:id/link-suggestions` | Retorna sugestões de cliente/fornecedor com score 0–100 (para o modal de vínculo) |
| GET | `/whatsapp/templates` | Lista templates aprovados sincronizados da WABA |
| POST | `/whatsapp/templates/sync` | Re-sincroniza com `GET /v20.0/{waba_id}/message_templates` da Meta |
| GET | `/whatsapp/usage` | Consumo do mês corrente + histórico de 6 meses + plano atual + projeção |

**Multi-tenancy:** segue `CLAUDE.md` — controller extrai `tenantId` de `req.user.tenantId` e passa explícito ao service.

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
  5. se primeira mensagem do número (conversa criada agora) → roda match automático (ver 5.3)
  6. se conversation.department_id == null → roteia:
       - palavra-chave (configurável por setor)
       - senão → setor default
  7. emite evento via WebSocket (Socket.io) pro tenant/setor → inbox atualiza em tempo real
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

### 5.3 Vínculo automático na primeira mensagem

Quando o worker cria uma `whatsapp_conversations` nova (primeira mensagem de um `contact_phone` desconhecido):

1. Roda match automático contra o cadastro segmento-específico:
   - **Oficina:** `customers.phone` (e variações: com/sem DDI, com/sem máscara)
   - **Reciclagem:** `suppliers.phone` (mesmas variações)
2. Resultado:
   - **1 candidato com telefone idêntico** → vincula automaticamente (`linked_customer_id = candidate.id`)
   - **0 candidatos** → deixa `linked_customer_id = null`, conversa entra como "Sem vínculo" no inbox
   - **2+ candidatos com telefone idêntico** (colisão) → **não vincula automaticamente**. Conversa fica "Sem vínculo" e o modal de vínculo, quando aberto pelo atendente, mostra todos os candidatos com score 100% pra forçar decisão humana
3. **Match não roda novamente** depois — fica congelado até o atendente vincular manualmente.

### 5.4 Modal de vínculo manual

Endpoint `GET /whatsapp/conversations/:id/link-suggestions` retorna lista ordenada por score:

| Critério | Score |
|---|---|
| Telefone idêntico (E.164 normalizado) | 96–100 |
| Mesmo prefixo + nome similar (Levenshtein ≥ 0.7) | 35–55 |
| Apenas mesmo DDD + nome similar | 15–30 |

Modal mostra (conforme design handoff):
- Header: avatar + nome + telefone do contato WhatsApp
- Campo de busca livre em `customers`/`suppliers`
- Lista de sugestões com radio + nome + ID + detalhes + razão do match + barra de score
- Footer: **Cancelar** · **Criar novo cadastro** · **Vincular selecionado**

A ação "Criar novo cadastro" abre o formulário de cliente/fornecedor já preenchido com nome+telefone do contato e, ao salvar, vincula automaticamente.

### 5.5 Iniciar nova conversa (CTA "Nova conversa")

Endpoint `POST /whatsapp/conversations` (Fase 4):

Aceita payload com:
- **Destinatário:** `customerId` OU `supplierId` OU `phone` (telefone livre, formato E.164)
- **Template:** `templateName` aprovado (categoria UTILITY ou MARKETING)
- **Variáveis:** `variables: { "1": "...", "2": "..." }`

Backend:
1. Resolve telefone final (do cadastro ou direto do payload).
2. Verifica se já existe conversa com esse `contact_phone` no tenant — se sim, reusa (vira `POST /messages`).
3. Envia template via `CloudApiProvider.sendTemplate()`.
4. Cria conversa nova com `linked_customer_id` se foi telefone de cadastro; senão, mesma rotina de match automático (5.3).
5. Cria `whatsapp_messages` com `type=TEMPLATE`, `direction=OUT`, `billable_category=UTILITY|MARKETING`.
6. Conta como nova conversation window → incrementa `whatsapp_usage_counters`.

### Templates

- Cadastrados na Meta (fora do Praktikus, via Business Manager).
- Tela `/whatsapp/templates` lista templates aprovados da WABA via `GET /v20.0/{waba_id}/message_templates`.
- Cache local em tabela auxiliar `whatsapp_templates` (sync sob demanda + cron diário).
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
- Tela de uso no frontend mostra consumo corrente e projeção (ver §7.5)

### Reuso do webhook Asaas existente

O `BillingWebhookService` atual (ver `2026-04-06-billing-completo-design.md`) trata status do plano base. Adicionar handling para eventos cujo `subscription` seja `whatsappAsaasSubscriptionId`:

- `PAYMENT_OVERDUE` → `whatsappEnabled=false`, inbox mostra aviso
- `PAYMENT_CONFIRMED` → reativa
- Status do plano base **não é afetado** pelo status do WhatsApp

---

## 7. Frontend

Tokens de design, paleta de cores por setor, copy em pt-BR e estados visuais (hover, active, empty, error) estão finalizados em `_design-reference/design_handoff_whatsapp_module/`. **Não duplicar tokens** — consumir do design system do Praktikus, ajustando os nomes equivalentes.

**Implementação será conduzida com a skill `/frontend-design`.**

### 7.1 Menu lateral

Novo item **"WhatsApp"** em `AppLayout`, visível apenas se `tenant.whatsappEnabled === true` (claim JWT novo `whatsappEnabled`). Se tenant não assinou → item oculto; acesso a `/whatsapp` redireciona pra `/whatsapp/upsell`.

### 7.2 Rotas (separadas, não tabs em estado local)

| Rota | Página | Acesso |
|---|---|---|
| `/whatsapp` | `WhatsappInboxPage` — 3 colunas | Usuários com setor atribuído (ou OWNER/ADMIN) |
| `/whatsapp/departments` | `DepartmentsPage` | OWNER, ADMIN |
| `/whatsapp/connection` | `AccountConnectionPage` | OWNER |
| `/whatsapp/templates` | `TemplatesPage` | OWNER, ADMIN |
| `/whatsapp/usage` | `UsagePage` | OWNER, ADMIN |
| `/whatsapp/upsell` | `WhatsappUpsellPage` | Quando `whatsappEnabled=false` |

A **subnav horizontal** (Inbox · Setores · Conexão · Templates · Uso) é renderizada como faixa de `<NavLink>`s no topo do layout `/whatsapp/*`. Permite deep-link, gates por role limpos no router, e back/forward do navegador funcionam normalmente.

### 7.3 Página de cabeçalho (compartilhada por todas as sub-páginas)

Conforme design handoff:
- `<h1>WhatsApp</h1>` + `<Badge variant="success" dot>Conectado</Badge>` + `<Badge variant="outline">PRO · 500/mês</Badge>`
- Subtítulo descritivo
- Ações: `<Button variant="secondary" icon="settings">Configurações</Button>` + `<Button variant="primary" icon="plus">Nova conversa</Button>`

### 7.4 Inbox — 3 colunas

Layout:

| Coluna | Largura | Conteúdo |
|---|---|---|
| Lista de conversas | 320px | Busca + 4 filtros pill (Abertas/Minhas/Não atrib./Fechadas) + chips de setor (scroll horizontal) + lista |
| Chat | 1fr | Header + thread + composer |
| Detalhes do contato | 280px | Painel de cadastro vinculado |

**Itens da lista:** avatar, nome, horário, preview da última mensagem (com `✓` se OUT), badge de não-lidas, chip do setor com cor, atendente atual, ícone de janela expirada quando aplicável, tag "Sem vínculo".

**Header do chat:** avatar + nome + ID do cadastro, telefone (mono) + chip de setor + atendente, chip de janela 24h (verde "23h restantes" / vermelho "Janela expirada"), IconButtons (reatribuir setor, vincular, esconder painel direito, mais ações).

**Bolhas (estilo WhatsApp Web):**
- IN: cinza claro, alinhada à esquerda
- OUT: tom accent (teal soft), alinhada à direita, double-check (cinza = delivered, accent = read)
- Template: header tracejado mostrando `nome_do_template · UTILITY` antes do corpo
- Imagem: thumbnail + selo "imagem · 1.2 MB" + caption opcional
- Separador "Hoje" entre dias; separador vermelho "Janela expirou" no fim quando aplicável

**Composer:**
- Janela ativa: textarea + anexo + template + Enviar; hint "Mensagem livre — janela ativa, custo zero (SERVICE)"
- Janela expirada: faixa vermelha + ícone de cadeado + botão "Escolher template" → abre lista inline de templates UTILITY/MARKETING

**Painel direito (3ª coluna) — versão por fase:**

- **Fase 2 (básico):**
  - Quando vinculado: nome do cadastro + label do tipo + ID + botão "Abrir cadastro completo"
  - Quando "Sem vínculo": ícone de pendência + hint + CTA "Vincular cliente/fornecedor" → abre modal (Fase 3)
- **Fase 3 (enriquecido):**
  - Stats grid 2×1 (nº de movimentações + última visita/entrega/retirada)
  - "Cliente desde mar/2023"
  - Lista de movimentações recentes (OS/COMP/VEND) com nº, descrição, total, status pill
  - Ações rápidas (grid 2×2): Nova OS/compra/venda · Cobrança · Agendar · Enviar template
  - Modal de vínculo automático com sugestões e score (5.4)

### 7.5 Tela `/whatsapp/usage` (Fase 5)

Layout 2/3 + 1/3:
- **Card principal:** número grande "X/Y conversas faturáveis usadas", split por categoria (UTILITY/MARKETING/AUTH/SERVICE), barra de progresso, footer com restantes + valor de excedente + data de renovação. Abaixo: gráfico de barras (6 meses) com excedente em laranja por cima do azul.
- **Card lateral 1 (Plano atual):** preço grande, badge, lista de features, CTA upgrade (se aplicável).
- **Card lateral 2 (Cobrança):** mensalidade + excedente + total previsto.

### 7.6 Tela `/whatsapp/connection`

Layout 2/3 + 1/3:
- **Card principal:** status verde + key-value list (Número exibido, phone_number_id, WABA ID, webhook verify token, versão da API, limit tier). Footer com "Editar credenciais", "Abrir no Business Manager", "Desconectar" (danger).
- **Card lateral 1:** "Setup manual" — checklist numerada de 4 passos.
- **Card lateral 2:** Aviso "Embedded Signup em breve · Fase 7" com fundo `accent-soft`.

### 7.7 Tela `/whatsapp/departments`

Tabela com colunas: setor (chip colorido) · atendentes · horário · conversas no mês · roteamento (Padrão / Por palavra-chave) · ações.
CTA "Novo setor" no header. CRUD: nome, cor, business_hours (JSON), default_routing (boolean), routing_keywords (text[]).

### 7.8 Tela `/whatsapp/templates`

Tabela: nome (mono) · categoria (badge colorido por tipo) · idioma · preview truncado em 2 linhas · status (Aprovado/Em revisão/Rejeitado) · atualizado · ações.
Header: CTAs "Sincronizar" e "Abrir no Meta".

Cores por categoria:
- `UTILITY` → accent (teal)
- `MARKETING` → warning (laranja)
- `AUTHENTICATION` → neutral (cinza)
- `SERVICE` → success (verde)

### 7.9 Tela `/whatsapp/upsell`

Renderizada quando `tenant.whatsappEnabled === false`. Hero + 4 features em grid 2×2 + 3 cards de planos (PRO destacado em accent "Mais escolhido") + FAQ de cobrança.

### 7.10 Modal "Nova conversa" (Fase 4)

Aberto pelo CTA do header.

1. **Destinatário** — campo de busca em `customers`/`suppliers` por nome/telefone, com opção "Usar telefone livre" (digita E.164)
2. **Template** — seletor de templates UTILITY/MARKETING aprovados
3. **Variáveis** — campos dinâmicos baseados em `{{1}}, {{2}}` do template
4. **Preview** — mostra como a mensagem fica
5. **Enviar** — chama `POST /whatsapp/conversations`, navega pra inbox da conversa criada

### 7.11 Estado e realtime

- Store Zustand `useWhatsappStore`: `conversations[]`, `activeConversationId`, `messagesByConversation`, `unreadCount`.
- WebSocket (Socket.io client) conecta em `/whatsapp` namespace e escuta eventos do próprio setor/tenant → atualiza store.
- Chamadas HTTP via `apps/frontend/src/services/whatsapp.ts`.

### 7.12 Componentes reusáveis

- `ConversationListItem` (avatar, nome, preview, chip setor, badge unread)
- `MessageBubble` (in/out, tipos text/image/audio/document/template, status icons)
- `MessageComposer` (textarea + anexos + seletor de template, com modos ativo/travado)
- `DepartmentChip` (chip colorido com cor de `whatsapp_departments.color`)
- `WindowCountdownChip` (verde/vermelho conforme `window_expires_at`)
- `LinkContactModal` (modal de vínculo com sugestões e score)
- `NewConversationModal` (modal de nova conversa)
- `ContactDetailPanel` (painel direito do inbox)

---

## 8. Variáveis de Ambiente

```
META_APP_ID=
META_APP_SECRET=                  # validação de assinatura do webhook
META_API_VERSION=v20.0
META_SYSTEM_USER_TOKEN=           # token permanente para operações administrativas
WHATSAPP_ENCRYPTION_KEY=          # AES-256 para access_token por tenant

# Storage de mídia (Tigris S3-compatible no Fly.io em produção; local em dev)
WHATSAPP_MEDIA_STORAGE=s3         # "s3" | "local"
S3_ENDPOINT=https://fly.storage.tigris.dev
S3_BUCKET=praktikus-whatsapp-media
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
S3_REGION=auto
WHATSAPP_MEDIA_RETENTION_DAYS=90  # cron diário apaga mídia mais antiga
```

### 8.1 Storage de mídia

**Provider abstrato:** `MediaStorageProvider` no backend, com duas implementações:
- `LocalFsStorageProvider` — usado em dev (`WHATSAPP_MEDIA_STORAGE=local`), salva em `./media/<tenant>/<conversation>/<wamid>.<ext>`.
- `S3CompatibleStorageProvider` — usado em prod (`WHATSAPP_MEDIA_STORAGE=s3`), funciona com Tigris (escolhido) ou qualquer S3-compatible (R2, AWS S3) trocando apenas `S3_ENDPOINT`. Usa `@aws-sdk/client-s3`.

**Decisão de provider em produção:** [Tigris](https://fly.io/docs/reference/tigris/). Mesma plataforma do deploy (Fly.io), provisionamento via `fly storage create`, sem credenciais cross-cloud, sem egress entre Fly app ↔ Tigris. Pode migrar para R2 (mais barato + zero egress fee) trocando 3 env vars sem mudar código.

**Retenção:** 90 dias. Cron diário `@Cron('0 3 * * *')` apaga objetos com `LastModified < now - 90 days`. LGPD resolvida por construção. Tenants enterprise que precisarem de retenção maior viram caso para coluna nova `whatsapp_accounts.media_retention_days_override` (não no MVP).

---

## 9. Estratégia de Onboarding (decidida)

**Fase inicial: setup manual.** O cliente cria WABA no próprio Business Manager, gera `phone_number_id` + token de System User dele, e cola na tela `AccountConnectionPage` do Praktikus. Vantagens:

- Zero dependência de aprovação da Meta (Business Verification do Praktikus + App Review **não bloqueiam** o lançamento).
- Permite começar a vender o add-on enquanto os processos burocráticos da Meta correm em paralelo.
- Útil de forma permanente para clientes enterprise que já têm WABA pré-existente.

**Fase futura: Embedded Signup.** Migração planejada quando:
1. Business Verification do Praktikus aprovada;
2. App Review aprovado com `whatsapp_business_messaging` + `whatsapp_business_management`;
3. Volume de novos clientes justifique o esforço de redução de fricção (~5 min vs 30-60 min do manual).

**Mudanças necessárias na migração** (documentadas para referência futura):
- Backend: novo endpoint `POST /whatsapp/embedded-signup/callback` + `POST /whatsapp/data-deletion`; `CloudApiProvider` ganha `registerPhoneNumber()` e `subscribeWebhook()`.
- Frontend: substituir formulário manual por botão que dispara `FB.login` com `config_id`; carregar SDK do Facebook; ajustar CSP (`script-src` + `frame-src`).
- Variáveis novas: `META_CONFIGURATION_ID`, `VITE_META_APP_ID`, `VITE_META_CONFIGURATION_ID`.
- Operacional: Política de Privacidade e Termos atualizados; endpoint de Data Deletion funcional; domínio verificado no Business Manager; screencast para App Review.
- Manter o formulário manual como fallback escondido (admin-only) para casos enterprise.

**Recomendação operacional:** iniciar Business Verification e submeter App Review **assim que a Fase 2 estiver pronta** (já dá pra gerar screencast com fluxo manual funcionando). Os processos da Meta levam semanas e correm em paralelo ao desenvolvimento.

---

## 10. Fases de Entrega

| Fase | Escopo | Estimativa |
|---|---|---|
| 1 | Entities + migrations + ativação por feature flag + menu oculto + coluna `whatsapp_agent_limit_override` | 1 sprint |
| 2 | Setup manual de conta + envio/recebimento texto + **inbox 3 colunas (painel direito básico: nome, vínculo, "Abrir cadastro")** + cards laterais da tela Conexão | 1 sprint |
| 3 | Setores + roteamento por palavra-chave/default + segregação de visibilidade + **vínculo automático na 1ª mensagem (5.3)** + **modal de vínculo manual com score (5.4)** + **painel direito enriquecido** (stats, histórico, ações rápidas 2×2) | 1 sprint |
| 4 | Templates (sync da WABA) + mídia (provider Tigris/local + retenção 90d) + **CTA "Nova conversa" com modal completo (telefone livre + cadastro)** | 1 sprint |
| 5 | Billing: assinatura add-on + cobrança de excedente + **tela `/whatsapp/usage` completa** (números, gráfico 6 meses, plano, projeção) + **hard limit de 10 atendentes** (UI + backend) com suporte a override | 1 sprint |
| 6 | Tela de upsell para clientes sem o add-on | 1 sprint |
| 7 *(futura)* | Migração para Embedded Signup (após App Review aprovado) | 1 sprint |

**Critério de "pronto" demoável** por fase fica detalhado no plano de execução (próximo artefato — gerado pela skill `writing-plans` a partir deste spec).

---

## 11. Pontos em aberto pós-decisão

A maioria dos pontos do spec original foi resolvida. Restam apenas:

- **Notificação ao tenant quando atinge o limite de atendentes:** banner na tela de Setores é certo. Faz sentido também enviar e-mail ao OWNER? (Decisão na implementação da Fase 5.)
- **Cache de templates da WABA:** sync sob demanda + cron diário, ou apenas sob demanda (lazy)? Cron é mais previsível, lazy é mais barato. (Decisão na Fase 4.)
- **Política exata de retry do webhook quando processamento falha:** BullMQ default é 3 tentativas com backoff exponencial. Considerar DLQ para inspeção manual de jobs falhados. (Decisão na Fase 2.)

---

## 12. UX detalhada (estados e interações)

Esta seção documenta interações que não são óbvias da estrutura. Tokens, paleta e copy estão em `_design-reference/design_handoff_whatsapp_module/`.

### 12.1 Janela de 24h

- A cada mensagem **recebida**, recalcular `window_expires_at = now + 24h`.
- Frontend mostra contador no header do chat: "23h restantes" → "1h restantes" → "Janela expirada".
- Quando `window_expires_at <= now`, composer trava e exibe a faixa vermelha com CTA "Escolher template".
- Ao enviar template, **a janela não reabre sozinha** — só reabre quando o cliente final responde. (Comportamento da Meta.)

### 12.2 Estados do inbox

- **Vazio (tenant novo):** ilustração + "Aguardando primeira mensagem. Compartilhe seu número WhatsApp ou inicie uma conversa via 'Nova conversa'."
- **Sem vínculo (1+ conversas com `linked_customer_id = null`):** lista mostra tag "Sem vínculo" cinza ao lado do nome; painel direito traz CTA "Vincular cliente/fornecedor".
- **Janela expirada com mensagens não respondidas:** highlight visual sutil no item da lista (não-bloqueante; lembrete de prioridade).
- **Setor sem atendente atribuído (`assigned_user_id = null`):** mostra "Aguarda atribuição" em cinza no item da lista.

### 12.3 Segregação por setor — comportamento exato

`WhatsappConversationsService.list(tenantId, userId)`:
- Se user role é `OWNER` ou `ADMIN` → retorna todas as conversas do tenant.
- Senão: JOIN com `whatsapp_department_users WHERE user_id = :userId` → filtra `whatsapp_conversations.department_id IN (depts_do_user)`.
- Conversa com `department_id = NULL` (ainda não roteada): visível apenas para OWNER/ADMIN — mas como o roteamento é automático no worker, esse estado é transitório.

Mesmo critério no canal Socket.io: usuário só recebe eventos `tenant:{tenantId}:dept:{deptId}:new-message` para setores que faz parte; OWNER/ADMIN recebe broadcast de tenant.

### 12.4 Cores de setor

A paleta sugerida no design handoff (Fiscal `#348E91`, Financeiro `#D98A2B`, Oficina `#1C5052`, etc.) é apenas mock. **No produto, a cor é editável e armazenada em `whatsapp_departments.color`** (varchar(7)).

---

## 13. Mapeamento componente do design → componente do codebase

A ser produzido na primeira tarefa da Fase 2 (frontend), com a skill `/frontend-design`. Baseado em inspeção dos arquivos `_design-reference/design_handoff_whatsapp_module/design_files/page-whatsapp.jsx` e `ui.jsx`, identificando equivalentes no design system atual do Praktikus e marcando `[NOVO]` o que precisa ser criado do zero.

---

## 14. Próximos passos

1. **User review** deste spec (este documento).
2. Geração do **plano de execução detalhado** (fase a fase, com tarefas, arquivos, migrations, testes) via skill `writing-plans`.
3. Execução fase a fase via skill `executing-plans`, com revisão a cada fase.
