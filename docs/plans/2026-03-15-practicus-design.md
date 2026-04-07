# Praktikus — Design Document
**Date:** 2026-03-15
**Status:** Approved

---

## 1. Visão Geral

Praktikus é uma plataforma SaaS multi-tenant para prestadores de serviço. O primeiro segmento é **oficinas mecânicas** (incluindo subcategorias: loja de pneus, estética veicular, auto elétrica, troca de óleo). Futuros segmentos planejados: clínicas médicas, odontológicas, barbearias.

**Modelo de negócio:** 30 dias de trial gratuito + R$69,90/mês, com reajuste anual configurável.

---

## 2. Stack Tecnológico

| Camada | Tecnologia |
|--------|-----------|
| Backend | NestJS (Node.js + TypeScript) |
| Banco de dados | PostgreSQL (schema per tenant) |
| Cache / Filas | Redis |
| Frontend | React + MUI (Material UI) |
| Gerenciador de pacotes | pnpm workspaces (monorepo) |
| Cobrança | Asaas (recorrência, PIX, cartão, trial) |
| Containerização | Docker + Docker Compose (dev local) |
| Deploy futuro | Railway → Kubernetes |

---

## 3. Estrutura do Monorepo

```
Praktikus/
├── apps/
│   ├── backend/                  # NestJS
│   └── frontend/                 # React + MUI
├── packages/
│   └── shared/                   # tipos TypeScript compartilhados (DTOs, enums)
├── docker-compose.yml            # dev local (postgres, redis, backend, frontend)
├── docker-compose.prod.yml
└── package.json                  # root (pnpm workspaces)
```

### Backend — Módulos (`apps/backend/src/modules/`)

```
core/
├── tenancy/        # schema-per-tenant, middleware de resolução do tenant
├── auth/           # JWT, roles (OWNER, EMPLOYEE), guards
└── billing/        # integração Asaas, trial, webhooks, bloqueio por inadimplência

workshop/           # módulo do segmento "oficina mecânica"
├── companies/      # cadastro da oficina (CNPJ, logo, endereço)
├── customers/      # clientes (CPF/CNPJ, WhatsApp, e-mail)
├── vehicles/       # veículos (placa como chave única, marca, modelo, ano, KM)
├── catalog/        # serviços (mão de obra) e peças
├── appointments/   # agendamentos com calendário
├── service-orders/ # OS completa com máquina de estados
└── reports/        # relatórios de faturamento e produtividade
```

### Frontend — Estrutura (`apps/frontend/src/`)

```
pages/
├── landing/        # página inicial pública com cards de segmentos
├── auth/           # login, registro, onboarding da oficina
└── workshop/       # todas as telas do módulo oficina

components/         # componentes MUI reutilizáveis
hooks/
services/           # chamadas à API (axios)
store/              # estado global (Zustand)
```

---

## 4. Multi-tenancy — Schema por Tenant

### Estratégia

Cada oficina recebe um schema dedicado no PostgreSQL, garantindo isolamento total de dados.

```sql
-- Schema global (público)
public.tenants         -- id, slug, schema_name, plan, status, billing_anchor_date
public.users           -- id, tenant_id, role, email, password_hash
public.billing         -- id, tenant_id, asaas_customer_id, asaas_subscription_id, status

-- Schema por tenant (isolado)
tenant_abc123.customers
tenant_abc123.vehicles
tenant_abc123.catalog_services
tenant_abc123.catalog_parts
tenant_abc123.appointments
tenant_abc123.service_orders
tenant_abc123.so_items_services
tenant_abc123.so_items_parts
tenant_abc123.vehicle_checklist
```

### Fluxo de Resolução

1. Middleware lê `tenant_id` do JWT claim em cada request.
2. Executa `SET search_path TO tenant_abc123, public` antes de qualquer query.
3. Nenhuma query de negócio precisa de `WHERE tenant_id = ?` — o schema garante isolamento.
4. Migração para banco dedicado no futuro: exportar schema + atualizar `public.tenants`.

### Migrations

- Nível `public`: estrutura global (tenants, users, billing).
- Nível por tenant: executadas automaticamente no provisionamento de cada nova oficina.

---

## 5. Autenticação e Autorização

### JWT

- Login retorna `access_token` (15min) + `refresh_token` (30 dias).
- Payload: `{ user_id, tenant_id, role }`.
- Redis armazena blacklist de tokens revogados.

### Roles

| Recurso | OWNER | EMPLOYEE |
|---------|-------|---------|
| Cadastro da oficina | ✅ | ❌ |
| Clientes e Veículos | ✅ | ✅ |
| Agendamentos | ✅ | ✅ |
| Criar OS | ✅ | ✅ |
| Editar OS | ✅ | Apenas status `ORCAMENTO` e `EM_EXECUCAO` |
| Aprovar orçamento | ✅ | ✅ |
| Relatórios financeiros | ✅ | ❌ |
| Gestão de usuários | ✅ | ❌ |

---

## 6. Cobrança — Asaas

- Cadastro da oficina → cria cliente + assinatura no Asaas com **30 dias de trial**.
- Após trial → cobrança recorrente de **R$69,90/mês** (cartão ou PIX).
- **Reajuste anual:** campo `billing_anchor_date` no tenant + `@Cron` job que aplica índice configurável pelo superadmin da plataforma.
- Webhooks do Asaas atualizam `public.tenants.status`:
  - `ACTIVE` → acesso normal
  - `OVERDUE` → aviso na UI
  - `SUSPENDED` → acesso bloqueado com mensagem clara

---

## 7. Fluxo Operacional

### Máquina de Estados da OS

```
ORCAMENTO → APROVADO → EM_EXECUCAO → AGUARDANDO_PECA → FINALIZADA → ENTREGUE
```

- Transições inválidas bloqueadas no backend.
- `status_pagamento` independente: `PENDENTE` | `PAGO` (uma OS pode estar `ENTREGUE` e `PENDENTE` financeiramente).

### Composição da OS

```
service_order
├── checklist_entrada   (avarias, KM, nível de combustível)
├── so_items_servicos   (serviço + mecânico atribuído + valor)
└── so_items_pecas      (peça + quantidade + valor unitário)
```

### Aprovação de Orçamento — Híbrida

- **Via link:** token UUID gerado na OS, expira em 72h. Rota pública `GET /public/quotes/:token` sem autenticação. Cliente aprova ou recusa pelo celular.
- **Manual:** OWNER ou EMPLOYEE aprovam diretamente na tela da OS.

### Agendamentos

- Múltiplos agendamentos no mesmo dia/horário são **permitidos**.
- Backend retorna **alerta** (não bloqueio) quando já existe agendamento no mesmo slot.
- Status: `PENDENTE` → `CONFIRMADO` → `CONCLUIDO` | `CANCELADO`.
- Um agendamento confirmado pode gerar uma OS diretamente.

### Geração de PDF

- Biblioteca `pdfmake` ou Puppeteer no backend.
- Template com logo da oficina, dados do cliente/veículo, itens e totais.
- Disponibilizado como download ou link temporário.

### Prontuário do Veículo

- `GET /vehicles/:plate/history` — timeline de todas as OS da placa, ordenadas por data.

---

## 8. Redis

Usado para:
- Blacklist de tokens JWT revogados.
- Rate limiting nas rotas públicas (link de orçamento).
- Fila de notificações futuras (v2).

---

## 9. Frontend — UX e Tema

### Landing Page

- Dark theme como padrão.
- Seções: Header com CTA, Hero com headline + subtítulo, Cards de segmentos, Pricing, Footer.
- Cards de segmentos: **Oficina Mecânica** (ativo) | **Clínica Médica** (em breve) | **Odontologia** (em breve).

### Tema MUI

- Dark theme padrão com toggle para light, salvo em `localStorage`.
- Paleta: fundo `#0F1117` / `#1A1D27` + acento `#4F6EF7` (azul elétrico).
- Responsive — compatível com tablets (uso na oficina).

### Painel Interno

- Sidebar fixa: Dashboard, Agendamentos, Ordens de Serviço, Clientes, Veículos, Catálogo, Relatórios, Configurações.
- Dashboard: cards de resumo (OS abertas, agendamentos do dia, faturamento do mês).

---

## 10. Roadmap de Entregas (MVP)

Cada entrega é testada localmente via `docker-compose up` antes de avançar.

| # | Entrega | Escopo |
|---|---------|--------|
| 1 | **Setup do Monorepo** | NestJS + PostgreSQL + Redis + Docker Compose + React + MUI + dark theme + roteamento base |
| 2 | **Cadastro da Oficina + Auth** | Multi-tenancy, JWT, roles, Asaas trial, landing page, registro/login, onboarding |
| 3 | **Clientes e Veículos** | CRUD clientes + veículos, validação CPF/CNPJ/placa, telas de listagem e detalhe |
| 4 | **Catálogo** | CRUD serviços e peças, telas de catálogo |
| 5 | **Agendamentos** | CRUD agendamentos, alerta de conflito, calendário visual |
| 6 | **Ordem de Serviço** | Máquina de estados, checklist, itens, atribuição, aprovação via link e manual |
| 7 | **PDF e Prontuário** | Geração de PDF da OS, timeline do histórico do veículo |
| 8 | **Relatórios** | Faturamento por período, produtividade por funcionário (somente OWNER) |
| 9 | **Billing completo** | Webhooks Asaas, bloqueio por inadimplência, reajuste anual, tela de assinatura |

---

## 11. Fora do Escopo (v2)

- Gestão de estoque completa (curva ABC, preço de custo vs. venda)
- Módulo financeiro avançado (fluxo de caixa, contas a pagar)
- Integração NF-e/NFS-e
- CRM e fidelização (WhatsApp automático)
- Aplicativo do cliente
