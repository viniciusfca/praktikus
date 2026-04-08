# Praktikus

Plataforma SaaS multi-tenant para prestadores de serviço. O primeiro segmento atendido são **oficinas mecânicas** (loja de pneus, estética veicular, auto elétrica, troca de óleo). Segmentos futuros planejados: clínicas médicas, odontológicas e barbearias.

**Modelo de negócio:** 30 dias de trial gratuito + R$69,90/mês, com reajuste anual configurável.

---

## Segmentos suportados

| Segmento | Status |
|----------|--------|
| Oficina mecânica | ✅ Disponível |
| Loja de pneus | ✅ Disponível |
| Estética veicular | ✅ Disponível |
| Auto elétrica | ✅ Disponível |
| Troca de óleo | ✅ Disponível |
| Clínica médica | 🔜 Planejado |
| Clínica odontológica | 🔜 Planejado |
| Barbearia | 🔜 Planejado |

---

## Stack tecnológico

| Camada | Tecnologia |
|--------|-----------|
| Backend | NestJS (Node.js + TypeScript) |
| Frontend | React 19 + CoreUI |
| Banco de dados | PostgreSQL (schema por tenant) |
| Cache | Redis |
| Billing | Asaas (PIX, cartão, recorrência, trial) |
| Infra local | Docker + Docker Compose |
| Monorepo | pnpm workspaces |
| Tipos compartilhados | `@praktikus/shared` |

---

## Arquitetura

```
praktikus/
├── apps/
│   ├── backend/          # API REST — NestJS
│   └── frontend/         # SPA — React + CoreUI
├── packages/
│   └── shared/           # Tipos TypeScript compartilhados (DTOs, enums)
├── docker-compose.yml    # Ambiente de desenvolvimento local
├── docker-compose.prod.yml
└── pnpm-workspace.yaml
```

### Módulos do backend (`apps/backend/src/modules/`)

```
core/
├── tenancy/        # Resolução do tenant e isolamento por schema PostgreSQL
├── auth/           # JWT, refresh token, roles (OWNER, EMPLOYEE), guards
└── billing/        # Integração Asaas, trial, webhooks, bloqueio por inadimplência

workshop/           # Módulo do segmento "oficina mecânica"
├── companies/      # Cadastro da oficina (CNPJ, logo, endereço)
├── customers/      # Clientes (CPF/CNPJ, WhatsApp, e-mail)
├── vehicles/       # Veículos (placa como chave única, marca, modelo, ano, KM)
├── catalog/        # Serviços (mão de obra) e peças
├── appointments/   # Agendamentos com calendário
├── service-orders/ # Ordem de serviço completa com máquina de estados
└── reports/        # Relatórios de faturamento e produtividade
```

---

## Pré-requisitos

- [Docker](https://docs.docker.com/get-docker/) e Docker Compose
- [Node.js](https://nodejs.org/) >= 20.0.0
- [pnpm](https://pnpm.io/installation) >= 8.0.0

---

## Setup local

### 1. Clone o repositório

```bash
git clone <url-do-repositório>
cd praktikus
```

### 2. Configure as variáveis de ambiente

```bash
cp .env.example .env
cp apps/backend/.env.example apps/backend/.env
cp apps/frontend/.env.example apps/frontend/.env
```

> As variáveis padrão já funcionam para desenvolvimento local com Docker. Não é necessário alterar nada para subir o projeto pela primeira vez.

### 3. Suba o ambiente

```bash
docker-compose up
```

Isso sobe os containers:
- **postgres** — PostgreSQL na porta `5432`
- **redis** — Redis na porta `6379`
- **backend** — API NestJS em `http://localhost:3000`
- **frontend** — React em `http://localhost:80` (ou simplesmente `http://localhost`)

### 4. Verifique que está funcionando

```bash
curl http://localhost:3000/health
# Esperado: { "status": "ok" }
```

---

## Scripts disponíveis

### Raiz (monorepo)

| Script | Descrição |
|--------|-----------|
| `pnpm dev` | Sobe todo o ambiente via Docker Compose |
| `pnpm build` | Build de todos os pacotes |
| `pnpm test` | Roda todos os testes |
| `pnpm lint` | Lint em todos os pacotes |

### Backend (`apps/backend/`)

| Script | Descrição |
|--------|-----------|
| `pnpm --filter backend start:dev` | Sobe o backend em modo watch |
| `pnpm --filter backend test` | Roda testes unitários |
| `pnpm --filter backend test:e2e` | Roda testes de integração |
| `pnpm --filter backend migration:generate` | Gera migration com base nas entities |
| `pnpm --filter backend migration:run` | Executa migrations pendentes |
| `pnpm --filter backend migration:revert` | Reverte última migration |

### Frontend (`apps/frontend/`)

| Script | Descrição |
|--------|-----------|
| `pnpm dev:frontend` | Sobe o frontend em modo watch |
| `pnpm --filter frontend test` | Roda testes com Vitest |
| `pnpm --filter frontend build` | Build de produção |

---

## Documentação

Planos de design e implementação estão em [`docs/plans/`](docs/plans/).
