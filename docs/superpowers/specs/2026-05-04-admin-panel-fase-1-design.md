# Admin Panel (Console do Dono) — Fase 1 — Design

**Data:** 2026-05-04
**Status:** aprovado para escrever plano
**Branch base:** `redesign/praktikus-v2`
**Design de referência:** `_design-reference/design_handoff_admin_panel/` (mock JSX/CSS — NÃO copiar; recriar)

---

## 1. Contexto e objetivo

O **dono da Praktikus** precisa de um console administrativo separado do app multi-tenant onde acompanha:

- Quantos clientes (tenants) existem, em que status (ativo, trial, atrasado, suspenso)
- Distribuição por segmento (Workshop, Recycling) e por UF (mapa do Brasil)
- Adesão ao add-on WhatsApp
- Trials prestes a expirar
- Visão "vitrine" de Financeiro (com placeholders) preparada pra Fase 1.5

Este console é uma **fronteira completamente isolada** do app cliente: nem usuários de tenant entram no admin, nem usuários de plataforma entram nas rotas dos tenants. Visualmente também é distinto — sidebar escura, paleta teal (`--brand-500: #348E91`), tipografia/proporções próprias — pra deixar claro pro próprio dono que ele está num lugar diferente.

A Fase 1 é proposital sobre o que **não** entra: chat de suporte, MRR, health score, configurações, RBAC granular. Detalhes em [§9 Out of scope](#9-out-of-scope).

---

## 2. Decisões consolidadas (log do brainstorm)

| # | Pergunta | Decisão |
|---|----------|---------|
| 1 | Escopo / decomposição | **Fase 1** = Dashboard + Clientes + Segmentos + WhatsApp + Financeiro. Suporte = Fase 2. Configurações = Fase 3. |
| 2 | Stack visual | **Design system dedicado ao admin** (CSS vars + primitivos próprios em `pages/admin/components/`). Sem Tailwind/shadcn. CoreUI fica disponível mas o look distinto vem do DS admin. |
| 3 | Backend scope | **Full-stack** — módulo `core/admin/` com endpoints reais já na Fase 1. |
| 4 | Auth de plataforma | **Tabela `platform_users`** no schema `public`, role único `PLATFORM_OWNER`. RBAC granular fica pra depois. |
| 5 | URL / isolamento | **Rota `/admin/*` no mesmo SPA**. JWT diferenciado por claim `isPlatformUser: true`. Subdomínio fica como evolução futura. |
| 6 | Dados ausentes (MRR, health, plano, last seen) | **Escopo reduzido** — Fase 1 não calcula nada do Asaas/cross-schema. Frontend mostra `—` com tooltip "Disponível na Fase 1.5". |
| 7 | Página Financeiro | **Mantém na Fase 1 com placeholders** — KPIs/tabela como `—`/`EmptyState`. Único bloco real é "Distribuição financeira (visão básica)" com counts por status. |

---

## 3. Arquitetura geral

### 3.1 Limites de responsabilidade

- **Frontend** — `apps/frontend/src/pages/admin/` é uma árvore isolada com seu próprio DS. Nenhum componente fora dela importa de dentro (e vice-versa), exceto:
  - `App.tsx` registra a rota `/admin/*` com lazy-load
  - `services/admin.api.ts` — cliente axios dedicado, interceptor injeta token de plataforma
  - `store/platform-auth.store.ts` — Zustand store separado de `auth.store.ts`
- **Backend** — `apps/backend/src/modules/core/admin/` é a única fronteira que o frontend admin consome. Nenhum controller de tenant é exposto ao admin.
- **Auth** — guards mutuamente excludentes:
  - `JwtAuthGuard` (existente, tenant) exige `tenantId` no payload → rejeita JWT de plataforma
  - `PlatformAuthGuard` (novo) exige `isPlatformUser: true` → rejeita JWT de tenant
- **Dados** — todas as queries de Fase 1 batem **só no schema `public`** (`tenants`, `billing`, `platform_users`). Nenhum cross-schema agora.

### 3.2 Diagrama mental

```
┌─────────────────────────────────────────────────┐
│  apps/frontend                                   │
│  ┌───────────────┐    ┌──────────────────────┐  │
│  │  pages/       │    │  pages/admin/        │  │
│  │  workshop/    │    │  ┌────────────────┐  │  │
│  │  recycling/   │    │  │ admin DS       │  │  │
│  │  (CoreUI)     │    │  │ (CSS vars)     │  │  │
│  └───────────────┘    │  └────────────────┘  │  │
│                        └──────────────────────┘  │
└─────────────────────────────────────────────────┘
        ↓ /api/*                    ↓ /api/admin/*
┌─────────────────────────────────────────────────┐
│  apps/backend                                    │
│  ┌────────────────┐  ┌────────────────────────┐ │
│  │ workshop/      │  │ core/admin/            │ │
│  │ recycling/     │  │ ├─ admin-auth/         │ │
│  │ tenancy/...    │  │ ├─ admin-overview/     │ │
│  │ (tenant guards)│  │ ├─ admin-tenants/      │ │
│  └────────────────┘  │ ├─ admin-segments/     │ │
│                       │ ├─ admin-whatsapp/     │ │
│                       │ ├─ admin-financial/    │ │
│                       │ └─ platform-user.ent.  │ │
│                       └────────────────────────┘ │
│         ↓                          ↓             │
│  schemas/<tenant>             schema public      │
│                               (tenants, billing, │
│                                platform_users)   │
└─────────────────────────────────────────────────┘
```

**Princípio fronteiriço:** se um arquivo de `pages/admin/*` importar de `pages/workshop/*` (ou vice-versa), é erro de design.

---

## 4. Backend

### 4.1 Autenticação de plataforma

**Entidade nova** — `apps/backend/src/modules/core/admin/admin-auth/platform-user.entity.ts`:

```ts
@Entity({ name: 'platform_users', schema: 'public' })
export class PlatformUserEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ unique: true }) email: string;
  @Column({ name: 'password_hash' }) passwordHash: string;
  @Column() name: string;
  @Column({ default: 'PLATFORM_OWNER' }) role: string;
  @Column({ name: 'last_login_at', type: 'timestamptz', nullable: true }) lastLoginAt: Date | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
}
```

Migration cria a tabela. Seed (`§7.1`) cria/atualiza o registro único do owner via `.env`.

**Refresh token** — tabela própria `platform_refresh_tokens` (não mistura com `refresh_tokens` de tenant — conceitos distintos, segredos distintos).

**Endpoints:**

| Método | Rota | Body / Query | Response |
|--------|------|--------------|----------|
| POST | `/api/admin/auth/login` | `{ email, password }` | `{ accessToken, refreshToken, user: { id, email, name } }` |
| POST | `/api/admin/auth/refresh` | `{ refreshToken }` | `{ accessToken, refreshToken }` |
| POST | `/api/admin/auth/logout` | `{ refreshToken }` | `204` |

**JWT claims** (todos os endpoints `/admin/*`):

```json
{ "sub": "<id>", "email": "...", "name": "...", "isPlatformUser": true }
```

**Observação importante:** `isPlatformUser` substitui `tenantId`. Não coexistem.

**Hardening:**

- bcrypt cost **12** pra `password_hash`
- Rate limit no `POST /admin/auth/login` — **10 tentativas / 15 min por IP** (via `@nestjs/throttler` — adicionar como dep se ainda não estiver)
- **Chave JWT separada** da chave de tenant (`PLATFORM_JWT_SECRET` ≠ `JWT_SECRET`). Vazamento de uma não compromete a outra.
- Logs estruturados pra eventos `platform_login_success`, `platform_login_failure`, `platform_logout` (audit log persistido em DB fica pra Fase 1.5).

**Decorators / guards novos:**

```ts
// admin-auth/platform-auth.guard.ts — valida JWT, exige isPlatformUser, popula req.platformUser
// admin-auth/platform-jwt.strategy.ts — Passport strategy com PLATFORM_JWT_SECRET
// admin-auth/platform.decorator.ts — @PlatformOnly() metadata, aplicado em controllers /admin/*
```

### 4.2 Módulo `core/admin/` — endpoints

Todos os endpoints abaixo estão protegidos por `PlatformAuthGuard` + `@PlatformOnly()`. Lógica de negócio nos services; controllers só delegam.

| Endpoint | Retorna | Páginas que consomem |
|----------|---------|----------------------|
| `GET /api/admin/overview` | KPIs agregados: counts por status, em trial, com WhatsApp; distribuição por UF; lista de trials expirando próximos 7 dias; sparklines (novos clientes / mês últimos 6 meses) | Overview, Mapa do Brasil |
| `GET /api/admin/tenants?status=&segment=&wpp=&q=&page=&pageSize=` | Lista paginada com filtros + 4 contadores topo (ACTIVE / TRIAL / OVERDUE / SUSPENDED) | Clientes |
| `GET /api/admin/segments` | Por segmento: total, breakdown por status, com WhatsApp, criados últimos 30d | Segmentos |
| `GET /api/admin/whatsapp` | KPIs adesão (% adesão geral, por plano BASIC/PRO, por segmento), lista "quem usa", lista "não usam" | WhatsApp |
| `GET /api/admin/financial` | Counts da DB (active, overdue, suspended, churned-30d). MRR/ARR/ticket/churn → `null`. | Financeiro (placeholders) |

### 4.3 Mapeamento de status mock → real (single source of truth)

| Mock | Real (`TenantStatus`) | Label PT |
|------|-----------------------|----------|
| paying | `ACTIVE` | Ativo |
| trial | `TRIAL` | Trial |
| past_due | `OVERDUE` | Em atraso |
| churned | `SUSPENDED` | Suspenso |

Frontend só conhece os labels reais. Mock é referência visual.

### 4.4 Campos sem dado real em Fase 1

Endpoints retornam `null` propositalmente para:

- `mrr`, `planName` — vêm do Asaas (Fase 1.5)
- `healthScore`, `lastSeenAt` — Fase 1.5 (job de cálculo / cross-schema)
- `userCount` — Fase 1.5 (cross-schema)
- `activityFeed` — Fase 1.5 (precisa event log)

`trialDaysLeft` é computado on-the-fly a partir de `trialEndsAt`.

### 4.5 Performance e índices

Migration adiciona:

- `idx_tenants_status` em `tenants(status)`
- `idx_tenants_segment_status` em `tenants(segment, status)`
- `idx_tenants_trial_ends_at` em `tenants(trial_ends_at) WHERE status = 'TRIAL'` (parcial)
- Índice expression em `(endereco->>'state')` pra mapa do Brasil

Sem cache em Fase 1. Com até alguns milhares de tenants, agregações respondem <100ms. Cache (Redis) entra quando virar problema.

### 4.6 Estrutura do módulo

```
apps/backend/src/modules/core/admin/
├── admin.module.ts
├── admin-auth/
│   ├── platform-user.entity.ts
│   ├── platform-refresh-token.entity.ts
│   ├── platform-auth.controller.ts
│   ├── platform-auth.service.ts
│   ├── platform-auth.guard.ts
│   ├── platform-jwt.strategy.ts
│   ├── platform.decorator.ts
│   └── dto/login.dto.ts
├── admin-overview/
│   ├── admin-overview.controller.ts
│   ├── admin-overview.service.ts
│   └── dto/overview-response.dto.ts
├── admin-tenants/
│   ├── admin-tenants.controller.ts
│   ├── admin-tenants.service.ts
│   └── dto/list-tenants-query.dto.ts
├── admin-segments/
│   ├── admin-segments.controller.ts
│   └── admin-segments.service.ts
├── admin-whatsapp/
│   ├── admin-whatsapp.controller.ts
│   └── admin-whatsapp.service.ts
└── admin-financial/
    ├── admin-financial.controller.ts
    └── admin-financial.service.ts
```

---

## 5. Frontend — Design System do admin

### 5.1 Estrutura

```
apps/frontend/src/pages/admin/
├── _layout/
│   ├── AdminLayout.tsx           # Sidebar + Topbar + <Outlet/>
│   ├── AdminSidebar.tsx          # navegação fixa dark (--brand-950)
│   ├── AdminTopbar.tsx           # título + busca pill + avatar/tema toggle
│   └── PlatformOnlyRoute.tsx     # guard de rota
├── components/                   # primitivos do admin DS
│   ├── Card.tsx
│   ├── Badge.tsx
│   ├── Button.tsx
│   ├── Avatar.tsx                # iniciais auto-geradas
│   ├── Chip.tsx
│   ├── KpiCard.tsx               # com sparkline SVG inline; suporta value=null
│   ├── FilterBar.tsx
│   ├── DataTable.tsx             # wrapper enxuto sobre <table>
│   ├── HealthBar.tsx             # barra colorida 0-100; null → cinza "Sem dado"
│   ├── EmptyState.tsx
│   ├── Skeleton.tsx
│   └── charts/
│       ├── DonutChart.tsx        # Chart.js wrapper
│       ├── StackedBar.tsx        # Chart.js wrapper
│       ├── SparklineSvg.tsx      # SVG inline (mock parity)
│       └── BrazilTilemap.tsx     # SVG hand-rolled (porta direta do mock)
├── styles/
│   ├── admin-tokens.css          # CSS vars escopadas em .adm-root
│   └── admin-components.css      # estilos .adm-*
├── hooks/
│   ├── usePlatformAuth.ts
│   ├── useAdminOverview.ts
│   ├── useAdminTenants.ts        # com debounced search (use-debounce já no projeto)
│   ├── useAdminSegments.ts
│   ├── useAdminWhatsapp.ts
│   └── useAdminFinancial.ts
├── pages/
│   ├── LoginPage.tsx
│   ├── OverviewPage.tsx
│   ├── TenantsPage.tsx
│   ├── SegmentsPage.tsx
│   ├── WhatsappPage.tsx
│   └── FinancialPage.tsx
└── lib/
    ├── format.ts                 # formatBRL, formatRelativeTime, formatPercent
    ├── status-labels.ts          # TenantStatus → label PT + cor semântica
    └── segment-colors.ts         # TenantSegment → cor (paleta do mock)
```

### 5.2 Tokens

`admin-tokens.css` aplica as CSS vars **no wrapper `.adm-root`** (não em `:root`) — isso isola o admin do tema do app cliente.

```css
.adm-root {
  --brand-100: #DCE6E6;
  --brand-300: #ACBFC0;
  --brand-500: #348E91;   /* primary */
  --brand-700: #1C5052;
  --brand-950: #0A0C0D;
  --accent: var(--brand-500);
  --success: #3BA776;
  --warning: #D98A2B;
  --danger:  #D95B5B;
  --surface: #FFFFFF;
  --bg-subtle: #F4F6F6;
  /* tipografia (Inter / Instrument Serif / JetBrains Mono),
     radius (4/6/10/14/20/28), sombras (xs/sm/md/lg), density */
}
.adm-root[data-theme="dark"] { /* overrides */ }
```

Tema dark: toggle no avatar do topbar, persiste em `localStorage['pk_admin_theme']`. Não herda do tema do app cliente.

### 5.3 Sem dependência nova

- **Charts** — `chart.js` + `react-chartjs-2` (já no projeto)
- **Mapa** — SVG inline (cartograma 7×8, ~150 linhas; constante `UF_COORDS` portada do mock)
- **Ícones** — `@coreui/icons-react` (já no projeto) com tamanhos/cores admin OU SVG inline pequeno; não trazer Lucide
- **Avatares** — iniciais auto-geradas

### 5.4 Persistência cliente (localStorage)

| Chave | Usado pra |
|-------|-----------|
| `pk_admin_page` | Última página acessada (redireciona após login) |
| `pk_admin_theme` | Tema dark/light |
| `pk_admin_filters_clientes` | Filtros da tabela de Clientes (UX) |
| `pk_admin_access_token` | JWT de plataforma (separado do token de tenant) |
| `pk_admin_refresh_token` | Refresh token de plataforma |

### 5.5 Padrões UI

- **Loading** — `Skeleton` enquanto hook está em loading
- **Empty** — `EmptyState` com mensagem amigável + CTA de retry
- **Erro** — toast simples (sem boundary global por enquanto; hook resolve o próprio)
- **Fields nulos:**
  - Numérico `null` → render `—`
  - `KpiCard` com `value=null` → número grande `—`, sparkline vira skeleton box
  - `HealthBar` com `score=null` → barra cinza neutra com label "Sem dado"
  - Tooltip no hover desses placeholders explica "Disponível na Fase 1.5"

---

## 6. Páginas

### 6.1 `/admin/login` — `LoginPage`

- Tela isolada (sem sidebar/topbar). Card centralizado com paleta admin.
- Campos: email + senha. `react-hook-form` + `zod`.
- Erros de credencial inline. Botão "esqueci senha" `disabled` com tooltip "Em breve" (reset via script em Fase 1).
- Após login: redireciona pra `localStorage['pk_admin_page']` ou `/admin`.
- Tema light fixo nessa tela.

### 6.2 `/admin` — `OverviewPage` (Dashboard)

| Bloco | Real Fase 1 | Placeholder |
|-------|-------------|-------------|
| KPI Clientes ativos | `count(status=ACTIVE)` + delta mês ant + sparkline novos clientes / mês (6 meses) | — |
| KPI Em trial | `count(status=TRIAL)` + delta + sparkline | — |
| KPI Usam WhatsApp | `count(whatsappEnabled=true)` + % adesão | — |
| KPI MRR | — | `—` + tooltip "Fase 1.5" |
| Status distribution (donut) | 4 segmentos: ACTIVE/TRIAL/OVERDUE/SUSPENDED | — |
| Distribuição por segmento (stacked bar 100%) | 2 segmentos hoje (Workshop / Recycling), cores definidas | — |
| Mapa do Brasil (cartograma) | Tiles coloridos por densidade de tenants por UF; tooltip mostra UF, total, % da base. **Sem "segmento principal"** (Fase 1.5+) | — |
| Trials expirando (lista) | `WHERE status=TRIAL AND trial_ends_at BETWEEN NOW() AND NOW()+7d`, ordem `ASC`. Mostra nome, dias restantes, segmento. | — |
| MRR chart (bar+line) | — | Skeleton + badge "Fase 1.5" |
| Activity feed | — | `EmptyState`: "Eventos vão aparecer aqui quando o log de atividades estiver disponível" |

### 6.3 `/admin/clientes` — `TenantsPage`

- **4 cards stats no topo** — counts por status. **Clicáveis** — clique aplica filtro `status=` e cartão fica visualmente selecionado. Voltar pra "Todos" desmarca.
- **Filter bar** — busca debounced (300ms via `use-debounce`) + chips de segmento (Todos / Workshop / Recycling) + chips WhatsApp (Todos / Usa / Não usa). Combinatórios (AND).
- **Tabela** — colunas:
  - Cliente (avatar + nome fantasia + email do owner + cidade)
  - Segmento (badge colorido)
  - Status (badge)
  - Plano (`—`)
  - WhatsApp (badge On/Off)
  - Saúde (`HealthBar` com `score=null` → cinza "Sem dado")
  - MRR (`—`)
  - Última atividade (`—`)
  - Ações (sem ações em Fase 1 — coluna existe mas botões `disabled`)
- **Paginação** server-side, page=1, pageSize=25. Prev/next + "x de y".
- **Empty state** — "Nenhum cliente encontrado com esses filtros" + botão "Limpar filtros".
- **Filtros persistem** em `localStorage['pk_admin_filters_clientes']`.

### 6.4 `/admin/segmentos` — `SegmentsPage`

- Stacked bar 100% no topo: % de cada segmento na base (2 segmentos em Fase 1).
- Grid responsivo de cards (auto-fill, min 320px). 1 card por segmento ativo:
  - Nome + cor do segmento
  - 4 mini-stats: Ativos, Trial, WhatsApp, MRR (`—`)
  - Barra horizontal: composição interna de status

### 6.5 `/admin/whatsapp` — `WhatsappPage`

| Bloco | Real Fase 1 |
|-------|-------------|
| KPI % adesão | `count(wpp=true) / count(active+trial)` |
| KPI MRR add-on | `—` |
| KPI Plano STARTER | `count(whatsappPlan='STARTER')` |
| KPI Plano PRO + ENTERPRISE | `count(whatsappPlan IN ('PRO', 'ENTERPRISE'))` |
| Tabela "Quem usa" | `WHERE whatsappEnabled=true` — colunas: cliente, segmento, plano, ativado em (usa `updated_at` por enquanto; `whatsapp_enabled_at` entra em Fase 1.5). Volume mensal: `—`. |
| Tabela "Não usam" | `WHERE whatsappEnabled=false AND status IN (ACTIVE, TRIAL)` — colunas: cliente, segmento, status, CTA "Oferecer" `disabled` (Fase 2). |
| Adesão por segmento | Barras horizontais — % WhatsApp dentro de cada segmento |

### 6.6 `/admin/financeiro` — `FinancialPage`

Página existe e é navegável, funciona como **vitrine de placeholders** (decisão #7 = B):

- 4 KPI cards: MRR / ARR / Ticket médio / Churn 30d — todos `—` com tooltip "Fase 1.5".
- Tabela "Cobranças recentes" — `EmptyState`.
- Único bloco real: **"Distribuição financeira (visão básica)"** com counts `count(ACTIVE)`, `count(OVERDUE)`, `count(SUSPENDED)`, `count(SUSPENDED nos últimos 30d)` — esse vem de `/api/admin/financial`.

### 6.7 Sidebar — itens em Fase 1

```
Visão geral        /admin               (ativa)
Clientes           /admin/clientes      (ativa)
Segmentos          /admin/segmentos     (ativa)
WhatsApp           /admin/whatsapp      (ativa)
Financeiro         /admin/financeiro    (ativa)
─────
Suporte            -                    (visível, badge "Em breve", item disabled)
Configurações      -                    (visível, badge "Em breve", item disabled)
─────
Voltar pro app     /workshop ou /recycling  (esconde se user só é platform)
Sair               logout do platform-auth
```

Footer da sidebar: avatar + nome + role ("Platform Owner").

---

## 7. Seed, segurança e testes

### 7.1 Seed de desenvolvimento

Script `apps/backend/src/scripts/seed-admin-dev.ts`, executável via `pnpm --filter backend seed:admin-dev`:

1. Cria/atualiza `platform_user` único a partir de `PLATFORM_OWNER_EMAIL` e `PLATFORM_OWNER_PASSWORD` do `.env` (idempotente).
2. Se `tenants` tem menos de 20 registros, popula ~80 tenants fake (Faker.js como `devDependency`):
   - Status: maioria ACTIVE; alguns TRIAL com `trialEndsAt` espalhados (alguns expirando nos próximos 7 dias); alguns OVERDUE; alguns SUSPENDED
   - Segmento: ~70% Workshop, ~30% Recycling
   - Endereço: cidades reais espalhadas em ~15 UFs (pra mapa do Brasil colorir)
   - WhatsApp: ~40% com `whatsappEnabled=true`, divididos entre BASIC/PRO
3. **Guard contra produção:** `if (process.env.NODE_ENV === 'production') throw`.

### 7.2 Variáveis de ambiente novas

Adicionar em `.env.example` e documentar:

```
PLATFORM_OWNER_EMAIL=vinny.fca@gmail.com
PLATFORM_OWNER_PASSWORD=<gerar forte; trocar após primeiro login>
PLATFORM_JWT_SECRET=<separado de JWT_SECRET>
PLATFORM_JWT_EXPIRES_IN=8h
PLATFORM_REFRESH_EXPIRES_IN=30d
```

### 7.3 Hardening Fase 1

- bcrypt cost **12** pra `password_hash`
- Rate limit no `/admin/auth/login` — **10 tentativas / 15 min por IP** (`@nestjs/throttler`)
- **Chave JWT separada** da chave de tenant
- CORS: endpoints `/admin/*` aceitam só a origin do frontend admin (mesma origin do app por enquanto, mas explicitamente declarada)
- Logs estruturados (`platform_login_success`, `platform_login_failure`, `platform_logout`). Audit log persistido = Fase 1.5.
- Endpoints `/admin/*` **nunca** retornam dados internos de tenant (clientes do tenant, OS, etc.). Apenas metadados de tenant (nome, segmento, status, endereço, contato do owner).

### 7.4 Plano de testes

**Backend** (`apps/backend/src/`):

- Unitários (`*.spec.ts`) — todo service ≥80% cobertura. Foco:
  - Queries retornam shape esperado
  - Filtros combinatórios (Clientes)
  - Paginação correta (offset/limit, count total)
  - Mapeamento status → label
  - Edge cases: `endereco=null`, lista vazia de trials, filtros sem match
- Guards:
  - `PlatformAuthGuard` aceita JWT de plataforma, rejeita JWT de tenant
  - `JwtAuthGuard` rejeita JWT de plataforma
- Integração (`apps/backend/test/integration/admin/`) com Postgres real:
  - Login → token → chamar cada endpoint `/admin/*`
  - Tentar `/admin/*` com token de tenant → 401/403
  - Tentar `/api/workshop/*` com token de plataforma → 401/403

**Frontend** (`apps/frontend/src/`):

- Componentes (`*.spec.tsx`) — primitivos do admin DS:
  - `KpiCard` com `value=null` mostra `—` e oculta sparkline
  - `HealthBar` com `score=null` mostra cinza
  - `FilterBar` aplica filtros combinatórios e dispara callback
- Hooks:
  - `useAdminTenants` aplica filtros, debounced search dispara 1 req
  - `usePlatformAuth` lê/grava token corretamente
- `PlatformOnlyRoute` redireciona pra `/admin/login` quando não autenticado
- Páginas — smoke tests (renderiza sem crash com mock de hook)

E2E (Playwright/Cypress se já configurado, senão fica como nota): login → dashboard → clientes → filtrar → tabela atualiza.

---

## 8. Riscos e mitigações

| Risco | Mitigação |
|-------|-----------|
| Chave `PLATFORM_JWT_SECRET` ausente em produção | Validar no bootstrap do app — `throw` se faltar quando `NODE_ENV=production` |
| Seed roda em produção por engano | Guard explícito `if (NODE_ENV === 'production') throw` |
| Bundle do `pages/admin/` carregado pra todo usuário | Lazy-load via `React.lazy` na rota `/admin/*` no `App.tsx` |
| Tema dark do admin "vaza" pro app cliente | Tokens escopadas em `.adm-root`, não em `:root` |
| Mapa do Brasil sem dados (`endereco=null` em vários tenants) | Render mostra UFs sem dados em `--bg-subtle`; legenda explica |
| Novos segmentos forem adicionados (PetShop etc.) | Página Segmentos é genérica — itera sobre os valores do enum, sem hardcode dos 2 atuais |

---

## 9. Out of scope

❌ **Não inclui na Fase 1:**

- MRR / ARR / ticket / churn / cobranças (precisa sync Asaas → Fase 1.5)
- Health score (precisa job de cálculo cross-schema → Fase 1.5)
- `lastSeenAt` por tenant (precisa job ou trigger → Fase 1.5)
- `userCount` (cross-schema → Fase 1.5)
- Activity feed (precisa event log → Fase 1.5)
- Página Suporte (chat ao vivo → Fase 2 inteira)
- Página Configurações (gestão de staff → Fase 3)
- RBAC granular (`STAFF_SUPPORT`, `STAFF_FINANCE`, `STAFF_GROWTH` → Fase 3)
- 2FA (backlog)
- Audit log persistido em DB (Fase 1.5)
- Reset de senha self-service (Fase 1.5; em Fase 1 é via script)
- Subdomínio admin (`admin.praktikus.com` — evolução futura)
- Ações de mutação no admin (cancelar conta, aplicar desconto, ativar add-on trial → Fase 2/3)

---

## 10. Quality Gate

O plano de implementação derivado deste design **deve terminar** com a task **"Quality Gate (Sonar)"** — template em [`docs/superpowers/specs/_quality-gate-task-template.md`](_quality-gate-task-template.md). Sem exceção (regra do CLAUDE.md).
