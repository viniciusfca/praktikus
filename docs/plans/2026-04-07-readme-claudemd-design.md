# README e CLAUDE.md — Design Document
**Data:** 2026-04-07
**Status:** Aprovado

---

## 1. Contexto

O projeto Praktikus não possui um README informativo nem um CLAUDE.md com boas práticas. O objetivo é criar ambos para servir como referência permanente para desenvolvedores, stakeholders e para o próprio Claude Code em sessões futuras.

---

## 2. Decisões

| Decisão | Escolha |
|---------|---------|
| Público do README | Ambos: stakeholders (visão de produto) e devs (setup técnico) |
| Foco do CLAUDE.md | Arquitetura e padrões de código específicos do projeto |
| Setup local | Guia completo com pré-requisitos, comandos e scripts |
| Idioma | Português |
| Abordagem | Completo e referencial (Opção B) |

---

## 3. Estrutura do README.md

```
# Praktikus

## O que é o Praktikus
  - Visão de produto: SaaS multi-tenant para prestadores de serviço
  - Primeiro segmento: oficinas mecânicas
  - Modelo de negócio: trial 30 dias + R$69,90/mês com reajuste anual

## Segmentos suportados
  - Oficinas mecânicas (loja de pneus, estética veicular, auto elétrica, troca de óleo)
  - Futuros: clínicas médicas, odontológicas, barbearias

## Stack tecnológico
  - Tabela com todas as camadas

## Arquitetura
  - Diagrama textual do monorepo
  - Descrição dos módulos backend (core: tenancy/auth/billing + workshop: companies/customers/vehicles/catalog/appointments/service-orders/reports)

## Pré-requisitos
  - Docker, Docker Compose, Node.js ≥20, pnpm ≥8

## Setup local
  1. Clone o repositório
  2. Copie os arquivos .env.example
  3. docker-compose up
  4. Acesso aos serviços (portas)

## Scripts disponíveis
  - Tabela dos scripts raiz + backend + frontend

## Estrutura do monorepo
  - Árvore de diretórios comentada
```

---

## 4. Estrutura do CLAUDE.md

```
# CLAUDE.md

## Visão Geral do Projeto
  - Contexto: o que é Praktikus, stack, monorepo pnpm

## Estrutura do Monorepo
  - Onde fica cada coisa, regra de onde criar novos arquivos

## Padrões Backend (NestJS)
  - Módulos em apps/backend/src/modules/
  - Estrutura obrigatória por módulo: module / controller / service / dto / entity
  - Lógica de negócio SEMPRE no service, nunca no controller
  - DTOs com class-validator para toda entrada
  - Entities via TypeORM com migrations — nunca synchronize:true em prod
  - Guards de auth nas rotas, não dentro dos services
  - Testes unitários em *.spec.ts, integração em test/integration/

## Padrões Frontend (React)
  - Páginas em src/pages/, componentes reutilizáveis em src/components/
  - Estado global via Zustand (src/store/), não React Context para estado de app
  - Chamadas de API apenas em src/services/ com axios
  - Formulários com react-hook-form + zod, nunca estado local para forms
  - Sem lógica de negócio nos componentes — extrair para hooks em src/hooks/

## Pacote Shared
  - Tipos, DTOs e enums compartilhados em packages/shared/
  - Backend e frontend importam de @praktikus/shared

## Convenções de Nomenclatura
  - Arquivos: kebab-case (user-service.ts)
  - Classes: PascalCase | Variáveis/funções: camelCase
  - Migrations: geradas via script (migration:generate), não criadas manualmente

## O que NÃO fazer
  - Lista explícita de anti-padrões

## Comandos úteis
  - Referência rápida dos scripts mais usados
```

---

## 5. Arquivos a criar

| Arquivo | Descrição |
|---------|-----------|
| `/README.md` | Substituir o atual (está vazio/corrompido) |
| `/CLAUDE.md` | Criar novo — não existe ainda |
