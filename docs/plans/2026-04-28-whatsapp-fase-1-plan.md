# WhatsApp — Fase 1: Schema + Feature Flag + Menu Oculto — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar o esqueleto de dados e ativação do módulo WhatsApp do Praktikus: schema completo (6 tabelas no schema do tenant + 4 colunas no `tenants` do schema public), feature flag `whatsappEnabled` propagada até o JWT, item de menu oculto que aparece quando o flag está ligado, e `WhatsappEnabledGuard` pronto para uso futuro nas rotas das fases 2+.

**Architecture:** Backend NestJS + TypeORM. Cada tenant vive num schema próprio (`tenant_<uuid_sem_hifens>`); migrations são geradas com `pnpm --filter backend migration:generate` e ficam em `apps/backend/src/database/migrations/`. As tabelas das fases 2+ vão precisar dos modelos definidos aqui. A coluna `whatsappEnabled` é lida no login → injetada no JWT → propagada ao frontend via Zustand → menu lateral filtra item condicionalmente.

**Tech Stack:** NestJS, TypeORM, PostgreSQL (schema-per-tenant), JWT (passport-jwt), React 19 + Zustand, CoreUI (menu lateral), `@praktikus/shared` para enums e tipos.

**Spec de referência:** [docs/plans/2026-04-24-whatsapp-integration-design.md](2026-04-24-whatsapp-integration-design.md) — seções 2 (Modelo de dados), 3 (Extensão de TenantEntity), 7.1 (Menu lateral), 10 (Fases).

---

## File Structure

**Shared (`packages/shared/`):**
- Create: `packages/shared/src/enums/whatsapp.enums.ts` — todos os enums do módulo
- Modify: `packages/shared/src/index.ts` — exportar os novos enums

**Backend — Entities & Module (`apps/backend/src/modules/core/whatsapp/`):**
- Create: `whatsapp.module.ts` — registra entities e exports do guard
- Create: `entities/whatsapp-account.entity.ts`
- Create: `entities/whatsapp-department.entity.ts`
- Create: `entities/whatsapp-department-user.entity.ts`
- Create: `entities/whatsapp-conversation.entity.ts`
- Create: `entities/whatsapp-message.entity.ts`
- Create: `entities/whatsapp-usage-counter.entity.ts`
- Create: `whatsapp-enabled.guard.ts`
- Create: `whatsapp-enabled.guard.spec.ts`

**Backend — Tenant & Auth (existing files):**
- Modify: `apps/backend/src/modules/core/tenancy/tenant.entity.ts` — +4 colunas
- Modify: `apps/backend/src/modules/core/auth/jwt.strategy.ts` — `JwtPayload` e `AuthUser` ganham `whatsappEnabled`
- Modify: `apps/backend/src/modules/core/auth/auth.service.ts` — `generateTokens()` carrega o tenant e inclui `whatsapp_enabled` no payload
- Modify: `apps/backend/src/app.module.ts` — registrar `WhatsappModule`

**Backend — Migrations:**
- Modify: `apps/backend/src/database/tenant-migrations/create-tenant-tables.ts` — adicionar SQL das 6 tabelas WhatsApp para novos tenants
- Create: `apps/backend/src/database/migrations/1748100000000-AddWhatsappSchema.ts` — adiciona 4 colunas em `tenants` + cria 6 tabelas em todos os schemas de tenants existentes

**Frontend (`apps/frontend/`):**
- Modify: `src/store/auth.store.ts` — `JwtUser` ganha `whatsapp_enabled`
- Modify: `src/layouts/AppLayout.tsx` — item de menu condicional (workshop)
- Modify: `src/layouts/RecyclingLayout.tsx` — item de menu condicional (recycling), se houver layout dedicado
- Create: `src/pages/whatsapp/WhatsappStubPage.tsx` — placeholder "Em construção"
- Modify: `src/App.tsx` — registrar rota `/whatsapp` protegida pelo PrivateRoute (sem feature gate na Fase 1; feature gate visual fica no menu)

---

## Task 1: Criar enums WhatsApp em `@praktikus/shared`

**Files:**
- Create: `packages/shared/src/enums/whatsapp.enums.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1.1: Criar arquivo de enums**

Cria o arquivo `packages/shared/src/enums/whatsapp.enums.ts` com o conteúdo:

```typescript
export enum WhatsappPlan {
  STARTER = 'STARTER',
  PRO = 'PRO',
  ENTERPRISE = 'ENTERPRISE',
}

export enum WhatsappAccountStatus {
  PENDING = 'PENDING',
  CONNECTED = 'CONNECTED',
  DISCONNECTED = 'DISCONNECTED',
}

export enum WhatsappConversationStatus {
  OPEN = 'OPEN',
  PENDING = 'PENDING',
  CLOSED = 'CLOSED',
}

export enum WhatsappMessageDirection {
  IN = 'IN',
  OUT = 'OUT',
}

export enum WhatsappMessageType {
  TEXT = 'TEXT',
  IMAGE = 'IMAGE',
  AUDIO = 'AUDIO',
  DOCUMENT = 'DOCUMENT',
  TEMPLATE = 'TEMPLATE',
}

export enum WhatsappMessageStatus {
  SENT = 'SENT',
  DELIVERED = 'DELIVERED',
  READ = 'READ',
  FAILED = 'FAILED',
}

export enum WhatsappBillableCategory {
  SERVICE = 'SERVICE',
  UTILITY = 'UTILITY',
  MARKETING = 'MARKETING',
  AUTHENTICATION = 'AUTHENTICATION',
}

export enum WhatsappRoleInDept {
  AGENT = 'AGENT',
  SUPERVISOR = 'SUPERVISOR',
}
```

- [ ] **Step 1.2: Exportar do índice de shared**

Edita `packages/shared/src/index.ts` adicionando ao final (mantendo os exports existentes):

```typescript
export * from './enums/whatsapp.enums';
```

Confirma que os exports existentes (`Role`, `TenantStatus`, `TenantSegment`, etc.) continuam intactos.

- [ ] **Step 1.3: Build do shared para que backend e frontend leiam**

Run: `pnpm --filter @praktikus/shared build` (ou o equivalente do projeto — verifique `packages/shared/package.json` se houver `build` script; se não, `tsc` direto).

Expected: build sem erros, `dist/` atualizado.

- [ ] **Step 1.4: Commit**

```bash
git add packages/shared/src/enums/whatsapp.enums.ts packages/shared/src/index.ts packages/shared/dist
git commit -m "feat(shared): add WhatsApp enums for backend and frontend"
```

---

## Task 2: Estender `TenantEntity` com 4 colunas WhatsApp

**Files:**
- Modify: `apps/backend/src/modules/core/tenancy/tenant.entity.ts`

- [ ] **Step 2.1: Adicionar import do enum WhatsappPlan**

No topo do arquivo `apps/backend/src/modules/core/tenancy/tenant.entity.ts`, ajusta o import de `@praktikus/shared`:

```typescript
import { TenantSegment, WhatsappPlan } from '@praktikus/shared';
```

- [ ] **Step 2.2: Adicionar 4 colunas no final do `class TenantEntity`**

Antes da última `}` do `class TenantEntity`, adicionar:

```typescript
  @Column({ name: 'whatsapp_enabled', type: 'boolean', default: false })
  whatsappEnabled: boolean;

  @Column({
    name: 'whatsapp_plan',
    type: 'enum',
    enum: WhatsappPlan,
    nullable: true,
  })
  whatsappPlan: WhatsappPlan | null;

  @Column({
    name: 'whatsapp_asaas_subscription_id',
    type: 'varchar',
    nullable: true,
  })
  whatsappAsaasSubscriptionId: string | null;

  @Column({
    name: 'whatsapp_agent_limit_override',
    type: 'int',
    nullable: true,
  })
  whatsappAgentLimitOverride: number | null;
```

- [ ] **Step 2.3: Build do backend para validar tipos**

Run: `pnpm --filter backend build`

Expected: build sem erros. Se reclamar de import de `WhatsappPlan`, voltar ao Step 1.3 e garantir que o `dist/` do shared está atualizado.

- [ ] **Step 2.4: Commit**

```bash
git add apps/backend/src/modules/core/tenancy/tenant.entity.ts
git commit -m "feat(tenancy): add WhatsApp columns to TenantEntity"
```

---

## Task 3: Criar entity `WhatsappAccountEntity`

**Files:**
- Create: `apps/backend/src/modules/core/whatsapp/entities/whatsapp-account.entity.ts`

- [ ] **Step 3.1: Criar entity**

Cria o arquivo com o conteúdo:

```typescript
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { WhatsappAccountStatus } from '@praktikus/shared';

@Entity({ name: 'whatsapp_accounts' })
export class WhatsappAccountEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'phone_number_id', type: 'varchar' })
  phoneNumberId: string;

  @Column({ name: 'waba_id', type: 'varchar' })
  wabaId: string;

  @Column({ name: 'display_phone', type: 'varchar' })
  displayPhone: string;

  @Column({ name: 'access_token', type: 'text' })
  accessToken: string;

  @Column({ name: 'webhook_verify_token', type: 'varchar' })
  webhookVerifyToken: string;

  @Column({
    type: 'enum',
    enum: WhatsappAccountStatus,
    default: WhatsappAccountStatus.PENDING,
  })
  status: WhatsappAccountStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
```

Nota: como entities de tenant não declaram `schema:` no `@Entity` (segue padrão de `SupplierEntity` em `apps/backend/src/modules/recycling/suppliers/supplier.entity.ts:1-44`), confiando no `SET search_path` feito pelos services em runtime — não adicione `schema:` aqui.

- [ ] **Step 3.2: Verificar compilação**

Run: `pnpm --filter backend build`
Expected: build sem erros.

---

## Task 4: Criar entity `WhatsappDepartmentEntity`

**Files:**
- Create: `apps/backend/src/modules/core/whatsapp/entities/whatsapp-department.entity.ts`

- [ ] **Step 4.1: Criar entity**

```typescript
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export interface BusinessHoursDay {
  start: string; // 'HH:MM'
  end: string;   // 'HH:MM'
}

export type BusinessHours = Partial<{
  mon: BusinessHoursDay;
  tue: BusinessHoursDay;
  wed: BusinessHoursDay;
  thu: BusinessHoursDay;
  fri: BusinessHoursDay;
  sat: BusinessHoursDay;
  sun: BusinessHoursDay;
}>;

@Entity({ name: 'whatsapp_departments' })
export class WhatsappDepartmentEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'varchar', length: 7 })
  color: string;

  @Column({ name: 'business_hours', type: 'jsonb', nullable: true })
  businessHours: BusinessHours | null;

  @Column({ name: 'default_routing', type: 'boolean', default: false })
  defaultRouting: boolean;

  @Column({ name: 'routing_keywords', type: 'text', array: true, nullable: true })
  routingKeywords: string[] | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
```

- [ ] **Step 4.2: Verificar compilação**

Run: `pnpm --filter backend build`
Expected: build sem erros.

---

## Task 5: Criar entity `WhatsappDepartmentUserEntity`

**Files:**
- Create: `apps/backend/src/modules/core/whatsapp/entities/whatsapp-department-user.entity.ts`

- [ ] **Step 5.1: Criar entity**

```typescript
import { Column, Entity, PrimaryGeneratedColumn, Index } from 'typeorm';
import { WhatsappRoleInDept } from '@praktikus/shared';

@Entity({ name: 'whatsapp_department_users' })
@Index('uq_dept_user', ['departmentId', 'userId'], { unique: true })
export class WhatsappDepartmentUserEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'department_id', type: 'uuid' })
  departmentId: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({
    name: 'role_in_dept',
    type: 'enum',
    enum: WhatsappRoleInDept,
    default: WhatsappRoleInDept.AGENT,
  })
  roleInDept: WhatsappRoleInDept;
}
```

A constraint UNIQUE composta evita o mesmo usuário duplicado no mesmo setor.

- [ ] **Step 5.2: Verificar compilação**

Run: `pnpm --filter backend build`
Expected: build sem erros.

---

## Task 6: Criar entity `WhatsappConversationEntity`

**Files:**
- Create: `apps/backend/src/modules/core/whatsapp/entities/whatsapp-conversation.entity.ts`

- [ ] **Step 6.1: Criar entity**

```typescript
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { WhatsappConversationStatus } from '@praktikus/shared';

@Entity({ name: 'whatsapp_conversations' })
@Index('idx_conversations_phone', ['contactPhone'])
@Index('idx_conversations_status', ['status'])
export class WhatsappConversationEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'contact_phone', type: 'varchar' })
  contactPhone: string;

  @Column({ name: 'contact_name', type: 'varchar', nullable: true })
  contactName: string | null;

  @Column({ name: 'department_id', type: 'uuid', nullable: true })
  departmentId: string | null;

  @Column({ name: 'assigned_user_id', type: 'uuid', nullable: true })
  assignedUserId: string | null;

  @Column({
    type: 'enum',
    enum: WhatsappConversationStatus,
    default: WhatsappConversationStatus.OPEN,
  })
  status: WhatsappConversationStatus;

  @Column({ name: 'last_message_at', type: 'timestamptz', nullable: true })
  lastMessageAt: Date | null;

  @Column({ name: 'window_expires_at', type: 'timestamptz', nullable: true })
  windowExpiresAt: Date | null;

  @Column({ name: 'linked_customer_id', type: 'uuid', nullable: true })
  linkedCustomerId: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
```

- [ ] **Step 6.2: Verificar compilação**

Run: `pnpm --filter backend build`
Expected: build sem erros.

---

## Task 7: Criar entity `WhatsappMessageEntity`

**Files:**
- Create: `apps/backend/src/modules/core/whatsapp/entities/whatsapp-message.entity.ts`

- [ ] **Step 7.1: Criar entity**

```typescript
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import {
  WhatsappBillableCategory,
  WhatsappMessageDirection,
  WhatsappMessageStatus,
  WhatsappMessageType,
} from '@praktikus/shared';

@Entity({ name: 'whatsapp_messages' })
@Index('uq_messages_wamid', ['wamid'], { unique: true })
@Index('idx_messages_conversation', ['conversationId'])
export class WhatsappMessageEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'conversation_id', type: 'uuid' })
  conversationId: string;

  @Column({ type: 'varchar' })
  wamid: string;

  @Column({
    type: 'enum',
    enum: WhatsappMessageDirection,
  })
  direction: WhatsappMessageDirection;

  @Column({
    type: 'enum',
    enum: WhatsappMessageType,
  })
  type: WhatsappMessageType;

  @Column({ type: 'text', nullable: true })
  body: string | null;

  @Column({ name: 'template_name', type: 'varchar', nullable: true })
  templateName: string | null;

  @Column({
    type: 'enum',
    enum: WhatsappMessageStatus,
    default: WhatsappMessageStatus.SENT,
  })
  status: WhatsappMessageStatus;

  @Column({
    name: 'billable_category',
    type: 'enum',
    enum: WhatsappBillableCategory,
    nullable: true,
  })
  billableCategory: WhatsappBillableCategory | null;

  @Column({ name: 'sent_at', type: 'timestamptz', nullable: true })
  sentAt: Date | null;

  @Column({ name: 'delivered_at', type: 'timestamptz', nullable: true })
  deliveredAt: Date | null;

  @Column({ name: 'read_at', type: 'timestamptz', nullable: true })
  readAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
```

- [ ] **Step 7.2: Verificar compilação**

Run: `pnpm --filter backend build`
Expected: build sem erros.

---

## Task 8: Criar entity `WhatsappUsageCounterEntity`

**Files:**
- Create: `apps/backend/src/modules/core/whatsapp/entities/whatsapp-usage-counter.entity.ts`

- [ ] **Step 8.1: Criar entity**

```typescript
import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'whatsapp_usage_counters' })
export class WhatsappUsageCounterEntity {
  @PrimaryColumn({ name: 'year_month', type: 'char', length: 7 })
  yearMonth: string;

  @Column({ name: 'service_conversations', type: 'int', default: 0 })
  serviceConversations: number;

  @Column({ name: 'utility_conversations', type: 'int', default: 0 })
  utilityConversations: number;

  @Column({ name: 'marketing_conversations', type: 'int', default: 0 })
  marketingConversations: number;

  @Column({ name: 'authentication_conversations', type: 'int', default: 0 })
  authenticationConversations: number;
}
```

- [ ] **Step 8.2: Verificar compilação**

Run: `pnpm --filter backend build`
Expected: build sem erros.

- [ ] **Step 8.3: Commit das 6 entities**

```bash
git add apps/backend/src/modules/core/whatsapp/entities/
git commit -m "feat(whatsapp): add 6 tenant-schema entities (account, department, conversation, message, usage)"
```

---

## Task 9: Atualizar `create-tenant-tables.ts` para incluir SQL WhatsApp

**Files:**
- Modify: `apps/backend/src/database/tenant-migrations/create-tenant-tables.ts`

Tenants criados a partir desta fase devem nascer com as 6 tabelas WhatsApp prontas.

- [ ] **Step 9.1: Adicionar bloco WhatsApp ao final do array de SQL**

Em `apps/backend/src/database/tenant-migrations/create-tenant-tables.ts`, antes do `return [...workshopTables, ...recyclingTables, ...sharedTables]` (ou o equivalente atual no arquivo — primeiro leia o arquivo completo para entender a estrutura), adicione um array novo `whatsappTables`:

```typescript
const whatsappTables = [
  `CREATE TABLE IF NOT EXISTS "${schemaName}".whatsapp_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_number_id VARCHAR NOT NULL,
    waba_id VARCHAR NOT NULL,
    display_phone VARCHAR NOT NULL,
    access_token TEXT NOT NULL,
    webhook_verify_token VARCHAR NOT NULL,
    status VARCHAR NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS "${schemaName}".whatsapp_departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR NOT NULL,
    color VARCHAR(7) NOT NULL,
    business_hours JSONB,
    default_routing BOOLEAN NOT NULL DEFAULT false,
    routing_keywords TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS "${schemaName}".whatsapp_department_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    department_id UUID NOT NULL REFERENCES "${schemaName}".whatsapp_departments(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    role_in_dept VARCHAR NOT NULL DEFAULT 'AGENT',
    CONSTRAINT uq_dept_user UNIQUE (department_id, user_id)
  )`,
  `CREATE TABLE IF NOT EXISTS "${schemaName}".whatsapp_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_phone VARCHAR NOT NULL,
    contact_name VARCHAR,
    department_id UUID REFERENCES "${schemaName}".whatsapp_departments(id) ON DELETE SET NULL,
    assigned_user_id UUID,
    status VARCHAR NOT NULL DEFAULT 'OPEN',
    last_message_at TIMESTAMPTZ,
    window_expires_at TIMESTAMPTZ,
    linked_customer_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_conversations_phone ON "${schemaName}".whatsapp_conversations(contact_phone)`,
  `CREATE INDEX IF NOT EXISTS idx_conversations_status ON "${schemaName}".whatsapp_conversations(status)`,
  `CREATE TABLE IF NOT EXISTS "${schemaName}".whatsapp_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES "${schemaName}".whatsapp_conversations(id) ON DELETE CASCADE,
    wamid VARCHAR NOT NULL,
    direction VARCHAR NOT NULL,
    type VARCHAR NOT NULL,
    body TEXT,
    template_name VARCHAR,
    status VARCHAR NOT NULL DEFAULT 'SENT',
    billable_category VARCHAR,
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_messages_wamid UNIQUE (wamid)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_messages_conversation ON "${schemaName}".whatsapp_messages(conversation_id)`,
  `CREATE TABLE IF NOT EXISTS "${schemaName}".whatsapp_usage_counters (
    year_month CHAR(7) PRIMARY KEY,
    service_conversations INT NOT NULL DEFAULT 0,
    utility_conversations INT NOT NULL DEFAULT 0,
    marketing_conversations INT NOT NULL DEFAULT 0,
    authentication_conversations INT NOT NULL DEFAULT 0
  )`,
];
```

E inclua `whatsappTables` no `return` da função (anexar ao array final retornado).

- [ ] **Step 9.2: Verificar compilação**

Run: `pnpm --filter backend build`
Expected: build sem erros.

- [ ] **Step 9.3: Commit**

```bash
git add apps/backend/src/database/tenant-migrations/create-tenant-tables.ts
git commit -m "feat(tenancy): provision WhatsApp tables for new tenants"
```

---

## Task 10: Criar migration `AddWhatsappSchema`

**Files:**
- Create: `apps/backend/src/database/migrations/1748100000000-AddWhatsappSchema.ts`

Esta migration faz duas coisas:
1. Adiciona as 4 colunas WhatsApp em `public.tenants` (existing schema).
2. Itera todos os tenants existentes e cria as 6 tabelas WhatsApp em cada schema.

Usa o mesmo padrão de `1746000000000-AddColetasToRecyclingTenants.ts` (loop de tenants).

- [ ] **Step 10.1: Criar arquivo de migration**

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWhatsappSchema1748100000000 implements MigrationInterface {
  name = 'AddWhatsappSchema1748100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1) Public schema — colunas em tenants
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_type WHERE typname = 'tenants_whatsapp_plan_enum'
        ) THEN
          CREATE TYPE "public"."tenants_whatsapp_plan_enum" AS ENUM ('STARTER', 'PRO', 'ENTERPRISE');
        END IF;
      END$$;
    `);

    await queryRunner.query(`
      ALTER TABLE "public"."tenants"
        ADD COLUMN IF NOT EXISTS "whatsapp_enabled" BOOLEAN NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "whatsapp_plan" "public"."tenants_whatsapp_plan_enum",
        ADD COLUMN IF NOT EXISTS "whatsapp_asaas_subscription_id" VARCHAR,
        ADD COLUMN IF NOT EXISTS "whatsapp_agent_limit_override" INTEGER
    `);

    // 2) Tenant schemas — 6 tabelas em cada um
    const tenants: Array<{ id: string }> = await queryRunner.query(
      `SELECT id FROM "public"."tenants"`,
    );

    for (const tenant of tenants) {
      const schema = `tenant_${tenant.id.replace(/-/g, '')}`;

      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS "${schema}".whatsapp_accounts (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          phone_number_id VARCHAR NOT NULL,
          waba_id VARCHAR NOT NULL,
          display_phone VARCHAR NOT NULL,
          access_token TEXT NOT NULL,
          webhook_verify_token VARCHAR NOT NULL,
          status VARCHAR NOT NULL DEFAULT 'PENDING',
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);

      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS "${schema}".whatsapp_departments (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name VARCHAR NOT NULL,
          color VARCHAR(7) NOT NULL,
          business_hours JSONB,
          default_routing BOOLEAN NOT NULL DEFAULT false,
          routing_keywords TEXT[],
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);

      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS "${schema}".whatsapp_department_users (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          department_id UUID NOT NULL REFERENCES "${schema}".whatsapp_departments(id) ON DELETE CASCADE,
          user_id UUID NOT NULL,
          role_in_dept VARCHAR NOT NULL DEFAULT 'AGENT',
          CONSTRAINT uq_dept_user UNIQUE (department_id, user_id)
        )
      `);

      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS "${schema}".whatsapp_conversations (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          contact_phone VARCHAR NOT NULL,
          contact_name VARCHAR,
          department_id UUID REFERENCES "${schema}".whatsapp_departments(id) ON DELETE SET NULL,
          assigned_user_id UUID,
          status VARCHAR NOT NULL DEFAULT 'OPEN',
          last_message_at TIMESTAMPTZ,
          window_expires_at TIMESTAMPTZ,
          linked_customer_id UUID,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);
      await queryRunner.query(
        `CREATE INDEX IF NOT EXISTS idx_conversations_phone ON "${schema}".whatsapp_conversations(contact_phone)`,
      );
      await queryRunner.query(
        `CREATE INDEX IF NOT EXISTS idx_conversations_status ON "${schema}".whatsapp_conversations(status)`,
      );

      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS "${schema}".whatsapp_messages (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          conversation_id UUID NOT NULL REFERENCES "${schema}".whatsapp_conversations(id) ON DELETE CASCADE,
          wamid VARCHAR NOT NULL,
          direction VARCHAR NOT NULL,
          type VARCHAR NOT NULL,
          body TEXT,
          template_name VARCHAR,
          status VARCHAR NOT NULL DEFAULT 'SENT',
          billable_category VARCHAR,
          sent_at TIMESTAMPTZ,
          delivered_at TIMESTAMPTZ,
          read_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          CONSTRAINT uq_messages_wamid UNIQUE (wamid)
        )
      `);
      await queryRunner.query(
        `CREATE INDEX IF NOT EXISTS idx_messages_conversation ON "${schema}".whatsapp_messages(conversation_id)`,
      );

      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS "${schema}".whatsapp_usage_counters (
          year_month CHAR(7) PRIMARY KEY,
          service_conversations INT NOT NULL DEFAULT 0,
          utility_conversations INT NOT NULL DEFAULT 0,
          marketing_conversations INT NOT NULL DEFAULT 0,
          authentication_conversations INT NOT NULL DEFAULT 0
        )
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const tenants: Array<{ id: string }> = await queryRunner.query(
      `SELECT id FROM "public"."tenants"`,
    );

    for (const tenant of tenants) {
      const schema = `tenant_${tenant.id.replace(/-/g, '')}`;
      await queryRunner.query(`DROP TABLE IF EXISTS "${schema}".whatsapp_messages CASCADE`);
      await queryRunner.query(`DROP TABLE IF EXISTS "${schema}".whatsapp_conversations CASCADE`);
      await queryRunner.query(`DROP TABLE IF EXISTS "${schema}".whatsapp_department_users CASCADE`);
      await queryRunner.query(`DROP TABLE IF EXISTS "${schema}".whatsapp_departments CASCADE`);
      await queryRunner.query(`DROP TABLE IF EXISTS "${schema}".whatsapp_accounts CASCADE`);
      await queryRunner.query(`DROP TABLE IF EXISTS "${schema}".whatsapp_usage_counters CASCADE`);
    }

    await queryRunner.query(`
      ALTER TABLE "public"."tenants"
        DROP COLUMN IF EXISTS "whatsapp_agent_limit_override",
        DROP COLUMN IF EXISTS "whatsapp_asaas_subscription_id",
        DROP COLUMN IF EXISTS "whatsapp_plan",
        DROP COLUMN IF EXISTS "whatsapp_enabled"
    `);

    await queryRunner.query(`DROP TYPE IF EXISTS "public"."tenants_whatsapp_plan_enum"`);
  }
}
```

- [ ] **Step 10.2: Subir o ambiente de dev**

Run: `docker-compose up -d` (se ainda não estiver rodando — verifica com `docker ps`).
Expected: PostgreSQL e Redis subindo.

- [ ] **Step 10.3: Executar a migration**

Run: `pnpm --filter backend migration:run`
Expected: log com `query: ...AddWhatsappSchema...` + `Migration AddWhatsappSchema1748100000000 has been executed successfully.`

- [ ] **Step 10.4: Verificar manualmente que as colunas e tabelas foram criadas**

Run em outro terminal:
```bash
docker exec -it $(docker ps --filter name=postgres --format '{{.Names}}') psql -U praktikus -d praktikus -c "\d public.tenants" | grep whatsapp
```
Expected: lista as 4 colunas (`whatsapp_enabled`, `whatsapp_plan`, `whatsapp_asaas_subscription_id`, `whatsapp_agent_limit_override`).

Verifica também um schema de tenant existente (substitua `<TENANT_ID_SEM_HIFENS>` por um ID real do `SELECT id FROM tenants LIMIT 1`):
```bash
docker exec -it $(docker ps --filter name=postgres --format '{{.Names}}') psql -U praktikus -d praktikus -c "\dt tenant_<TENANT_ID_SEM_HIFENS>.whatsapp_*"
```
Expected: lista 6 tabelas: `whatsapp_accounts`, `whatsapp_conversations`, `whatsapp_department_users`, `whatsapp_departments`, `whatsapp_messages`, `whatsapp_usage_counters`.

- [ ] **Step 10.5: Testar idempotência (re-run safety) com revert + run**

Run: `pnpm --filter backend migration:revert`
Expected: down rodado sem erro; tabelas WhatsApp removidas dos schemas.

Run: `pnpm --filter backend migration:run`
Expected: up roda novamente sem erro; tabelas reaparecem.

- [ ] **Step 10.6: Commit**

```bash
git add apps/backend/src/database/migrations/1748100000000-AddWhatsappSchema.ts
git commit -m "feat(whatsapp): migration adds tenants columns + tenant-schema tables"
```

---

## Task 11: Criar `WhatsappModule`

**Files:**
- Create: `apps/backend/src/modules/core/whatsapp/whatsapp.module.ts`
- Modify: `apps/backend/src/app.module.ts`

- [ ] **Step 11.1: Criar `whatsapp.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantEntity } from '../tenancy/tenant.entity';
import { WhatsappAccountEntity } from './entities/whatsapp-account.entity';
import { WhatsappDepartmentEntity } from './entities/whatsapp-department.entity';
import { WhatsappDepartmentUserEntity } from './entities/whatsapp-department-user.entity';
import { WhatsappConversationEntity } from './entities/whatsapp-conversation.entity';
import { WhatsappMessageEntity } from './entities/whatsapp-message.entity';
import { WhatsappUsageCounterEntity } from './entities/whatsapp-usage-counter.entity';
import { WhatsappEnabledGuard } from './whatsapp-enabled.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TenantEntity,
      WhatsappAccountEntity,
      WhatsappDepartmentEntity,
      WhatsappDepartmentUserEntity,
      WhatsappConversationEntity,
      WhatsappMessageEntity,
      WhatsappUsageCounterEntity,
    ]),
  ],
  providers: [WhatsappEnabledGuard],
  exports: [WhatsappEnabledGuard, TypeOrmModule],
})
export class WhatsappModule {}
```

(O `WhatsappEnabledGuard` será criado na Task 13 — vamos criar o módulo apontando para ele primeiro porque o Nest valida na compilação. Se a Task 13 ainda não rodou, deixe o import de Guard comentado e os campos `providers`/`exports` vazios; volte aqui após a Task 13. Se você está executando este plano linearmente, **pule este step e volte após a Task 13** OU implemente a Task 13 antes.)

**Recomendação:** **inverta a ordem aqui**. Faça primeiro a Task 13 (guard) e depois volte para o Step 11.1. Se preferir manter a ordem do plano, comece com o módulo sem o guard:

```typescript
@Module({
  imports: [
    TypeOrmModule.forFeature([
      TenantEntity,
      WhatsappAccountEntity,
      WhatsappDepartmentEntity,
      WhatsappDepartmentUserEntity,
      WhatsappConversationEntity,
      WhatsappMessageEntity,
      WhatsappUsageCounterEntity,
    ]),
  ],
  providers: [],
  exports: [TypeOrmModule],
})
export class WhatsappModule {}
```

E depois, na Task 13, edita o módulo adicionando o guard.

- [ ] **Step 11.2: Registrar `WhatsappModule` em `app.module.ts`**

Edita `apps/backend/src/app.module.ts`:

1. Adiciona o import no topo (junto dos outros module imports):
```typescript
import { WhatsappModule } from './modules/core/whatsapp/whatsapp.module';
```
2. Inclui `WhatsappModule` no array `imports` do `@Module`.

- [ ] **Step 11.3: Verificar boot da aplicação**

Run: `pnpm --filter backend start:dev`
Expected: app sobe sem erro de DI; logs mostram `WhatsappModule dependencies initialized` ou similar.
Pare a aplicação (`Ctrl+C`).

- [ ] **Step 11.4: Commit**

```bash
git add apps/backend/src/modules/core/whatsapp/whatsapp.module.ts apps/backend/src/app.module.ts
git commit -m "feat(whatsapp): register WhatsappModule with entities"
```

---

## Task 12: Adicionar `whatsapp_enabled` no JWT payload

**Files:**
- Modify: `apps/backend/src/modules/core/auth/jwt.strategy.ts`
- Modify: `apps/backend/src/modules/core/auth/auth.service.ts`

- [ ] **Step 12.1: Atualizar interfaces `JwtPayload` e `AuthUser`**

Edita `apps/backend/src/modules/core/auth/jwt.strategy.ts:11-30`. Adiciona o campo `whatsapp_enabled` em `JwtPayload` e `whatsappEnabled` em `AuthUser`:

```typescript
export interface JwtPayload {
  sub: string;
  tenant_id: string;
  role: string;
  name?: string;
  email?: string;
  tenant_status?: string;
  tenant_segment?: TenantSegment;
  whatsapp_enabled?: boolean;  // ← novo
  iat?: number;
  exp?: number;
}

export interface AuthUser {
  userId: string;
  tenantId: string;
  role: string;
  name?: string;
  email?: string;
  tenantStatus?: string;
  tenantSegment?: TenantSegment;
  whatsappEnabled?: boolean;  // ← novo
}
```

E no método `validate()` (linhas ~46-60), inclui a propriedade:

```typescript
return {
  userId: payload.sub,
  tenantId: payload.tenant_id,
  role: payload.role,
  name: payload.name,
  email: payload.email,
  tenantStatus: payload.tenant_status,
  tenantSegment: payload.tenant_segment,
  whatsappEnabled: payload.whatsapp_enabled ?? false,  // ← novo
};
```

- [ ] **Step 12.2: Carregar `whatsappEnabled` em `generateTokens()`**

Edita `apps/backend/src/modules/core/auth/auth.service.ts:238-276`. O método `generateTokens` recebe `user: UserEntity` e os campos do tenant. Acrescenta um novo parâmetro `whatsappEnabled: boolean`:

```typescript
private async generateTokens(
  user: UserEntity,
  tenantStatus: string,
  tenantSegment?: TenantSegment,
  whatsappEnabled?: boolean,
): Promise<AuthTokens> {
  const payload = {
    sub: user.id,
    tenant_id: user.tenantId,
    role: user.role,
    name: user.name,
    email: user.email,
    tenant_status: tenantStatus,
    tenant_segment: tenantSegment ?? TenantSegment.WORKSHOP,
    whatsapp_enabled: whatsappEnabled ?? false,
  };
  // ... resto inalterado
}
```

- [ ] **Step 12.3: Passar `whatsappEnabled` nos call sites de `generateTokens`**

Procure por `generateTokens(` no arquivo `auth.service.ts` (provavelmente em `login()`, `register()` e `refreshTokens()`). Em cada chamada onde já existe acesso ao `tenant` (provavelmente carregado via `tenantRepo.findOne` ou similar), passe `tenant.whatsappEnabled`.

Run: `grep -n "generateTokens(" apps/backend/src/modules/core/auth/auth.service.ts`
Para cada match, garanta que:
- Se já carrega `tenant`, passar `tenant.whatsappEnabled`.
- Se não carrega, adicionar o `findOne` e passar `tenant.whatsappEnabled` (ou usar o relacionamento que já existe entre `UserEntity` e `TenantEntity`).

- [ ] **Step 12.4: Build + lint**

Run: `pnpm --filter backend build && pnpm --filter backend lint`
Expected: ambos sem erros.

- [ ] **Step 12.5: Smoke test manual do JWT**

Run: `pnpm --filter backend start:dev`

Em outro terminal, login com um usuário existente (ajuste credenciais para um tenant real do seu dev DB):
```bash
curl -s -X POST http://localhost:3000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"<email>","password":"<senha>"}' | jq -r '.access_token' \
  | awk -F. '{print $2}' | base64 -d 2>/dev/null | jq .
```
Expected: payload mostra `"whatsapp_enabled": false` (default; para qualquer tenant antes da Fase 5).

Para validar o `true`, marque manualmente um tenant como habilitado no DB:
```bash
docker exec -it $(docker ps --filter name=postgres --format '{{.Names}}') \
  psql -U praktikus -d praktikus \
  -c "UPDATE tenants SET whatsapp_enabled = true WHERE id = '<TENANT_ID>'"
```
E refaça o login. Expected: `"whatsapp_enabled": true`.

Pare o backend após validação. Reverta o UPDATE se quiser:
```bash
docker exec -it $(docker ps --filter name=postgres --format '{{.Names}}') \
  psql -U praktikus -d praktikus \
  -c "UPDATE tenants SET whatsapp_enabled = false WHERE id = '<TENANT_ID>'"
```

- [ ] **Step 12.6: Commit**

```bash
git add apps/backend/src/modules/core/auth/jwt.strategy.ts apps/backend/src/modules/core/auth/auth.service.ts
git commit -m "feat(auth): include whatsapp_enabled in JWT payload"
```

---

## Task 13: Criar `WhatsappEnabledGuard` (TDD)

**Files:**
- Create: `apps/backend/src/modules/core/whatsapp/whatsapp-enabled.guard.spec.ts`
- Create: `apps/backend/src/modules/core/whatsapp/whatsapp-enabled.guard.ts`
- Modify: `apps/backend/src/modules/core/whatsapp/whatsapp.module.ts` — registrar o guard

- [ ] **Step 13.1: Escrever o teste falhando**

Cria `apps/backend/src/modules/core/whatsapp/whatsapp-enabled.guard.spec.ts`:

```typescript
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { WhatsappEnabledGuard } from './whatsapp-enabled.guard';

function ctxMock(user: unknown): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as unknown as ExecutionContext;
}

describe('WhatsappEnabledGuard', () => {
  let guard: WhatsappEnabledGuard;

  beforeEach(() => {
    guard = new WhatsappEnabledGuard();
  });

  it('permits when user.whatsappEnabled is true', () => {
    const ctx = ctxMock({ tenantId: 't1', whatsappEnabled: true });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('throws ForbiddenException when whatsappEnabled is false', () => {
    const ctx = ctxMock({ tenantId: 't1', whatsappEnabled: false });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    expect(() => guard.canActivate(ctx)).toThrow('whatsapp_not_enabled');
  });

  it('throws ForbiddenException when whatsappEnabled is undefined', () => {
    const ctx = ctxMock({ tenantId: 't1' });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('returns true when user is undefined (public route — JwtStrategy not applied)', () => {
    const ctx = ctxMock(undefined);
    expect(guard.canActivate(ctx)).toBe(true);
  });
});
```

- [ ] **Step 13.2: Rodar o teste para verificar que falha**

Run: `pnpm --filter backend test -- whatsapp-enabled.guard.spec`
Expected: FAIL com `Cannot find module './whatsapp-enabled.guard'`.

- [ ] **Step 13.3: Implementar o guard**

Cria `apps/backend/src/modules/core/whatsapp/whatsapp-enabled.guard.ts`:

```typescript
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { AuthUser } from '../auth/jwt.strategy';

@Injectable()
export class WhatsappEnabledGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthUser | undefined;

    if (!user) {
      // Rota pública (sem JwtAuthGuard antes) — não bloqueia.
      return true;
    }

    if (!user.whatsappEnabled) {
      throw new ForbiddenException('whatsapp_not_enabled');
    }

    return true;
  }
}
```

- [ ] **Step 13.4: Rodar o teste e verificar que passa**

Run: `pnpm --filter backend test -- whatsapp-enabled.guard.spec`
Expected: PASS — 4 testes verdes.

- [ ] **Step 13.5: Registrar o guard no `WhatsappModule`**

Edita `apps/backend/src/modules/core/whatsapp/whatsapp.module.ts` adicionando:

```typescript
import { WhatsappEnabledGuard } from './whatsapp-enabled.guard';
```

E ajustando providers/exports:

```typescript
providers: [WhatsappEnabledGuard],
exports: [WhatsappEnabledGuard, TypeOrmModule],
```

- [ ] **Step 13.6: Build + lint**

Run: `pnpm --filter backend build && pnpm --filter backend lint`
Expected: sem erros.

- [ ] **Step 13.7: Commit**

```bash
git add apps/backend/src/modules/core/whatsapp/whatsapp-enabled.guard.ts \
        apps/backend/src/modules/core/whatsapp/whatsapp-enabled.guard.spec.ts \
        apps/backend/src/modules/core/whatsapp/whatsapp.module.ts
git commit -m "feat(whatsapp): add WhatsappEnabledGuard with unit tests"
```

---

## Task 14: Atualizar `JwtUser` no frontend

**Files:**
- Modify: `apps/frontend/src/store/auth.store.ts`

- [ ] **Step 14.1: Adicionar `whatsapp_enabled` à interface `JwtUser`**

Edita `apps/frontend/src/store/auth.store.ts:8-17`:

```typescript
export interface JwtUser {
  sub: string;
  tenant_id: string;
  role: 'OWNER' | 'EMPLOYEE';
  name: string;
  email: string;
  exp: number;
  tenant_status: 'TRIAL' | 'ACTIVE' | 'OVERDUE' | 'SUSPENDED';
  tenant_segment: 'WORKSHOP' | 'RECYCLING';
  whatsapp_enabled?: boolean;  // ← novo
}
```

- [ ] **Step 14.2: Verificar TypeScript**

Run: `pnpm --filter frontend typecheck` (ou `pnpm --filter frontend build` se não houver script `typecheck`).
Expected: sem erros.

- [ ] **Step 14.3: Commit**

```bash
git add apps/frontend/src/store/auth.store.ts
git commit -m "feat(frontend): add whatsapp_enabled to JwtUser"
```

---

## Task 15: Adicionar item de menu "WhatsApp" oculto no `AppLayout`

**Files:**
- Modify: `apps/frontend/src/layouts/AppLayout.tsx`

- [ ] **Step 15.1: Adicionar campo `requiredFeature` à interface `navItems` e item WhatsApp**

Edita `apps/frontend/src/layouts/AppLayout.tsx:45-54`. Atualiza a interface `navItems` para suportar feature gating e adiciona o item WhatsApp:

```typescript
const navItems: Array<{
  label: string;
  icon: any;
  path: string;
  ownerOnly: boolean;
  requiredFeature?: 'whatsapp';  // ← novo
}> = [
  { label: 'Dashboard', icon: cilSpeedometer, path: '/workshop/dashboard', ownerOnly: false },
  // ... outros itens existentes ...
  { label: 'WhatsApp', icon: cilSpeech, path: '/whatsapp', ownerOnly: false, requiredFeature: 'whatsapp' },
  { label: 'Configurações', icon: cilSettings, path: '/workshop/settings', ownerOnly: true },
];
```

Use o ícone `cilSpeech` do CoreUI (importe-o no topo: `import { cilSpeech, ... } from '@coreui/icons'`). Se preferir outro ícone, escolha um equivalente que já exista nos imports do CoreUI Icons.

- [ ] **Step 15.2: Atualizar o filtro do `sidebarNav` para considerar `requiredFeature`**

Edita o `useMemo` do `sidebarNav` (linhas ~110-146):

```typescript
const sidebarNav = useMemo(
  () =>
    navItems
      .filter((item) => {
        if (item.ownerOnly && user?.role !== 'OWNER') return false;
        if (item.requiredFeature === 'whatsapp' && !user?.whatsapp_enabled) return false;
        return true;
      })
      .map((item) => {
        // ... renderização existente, sem mudança
      }),
  [location.pathname, sidebarOpen, isMobile, user?.role, user?.whatsapp_enabled],
);
```

Atenção à dependência adicionada `user?.whatsapp_enabled` no `useMemo`.

- [ ] **Step 15.3: Build + verificação visual**

Run: `pnpm --filter frontend build`
Expected: sem erros.

Run: `pnpm --filter frontend dev` em terminal separado.
- Loga com um usuário cujo tenant tem `whatsapp_enabled = false` → menu **NÃO** mostra WhatsApp.
- Atualiza o tenant para `whatsapp_enabled = true` no DB, faz logout/login → menu **mostra** WhatsApp (com ícone).
- Clica → navega para `/whatsapp` (página ainda não existe; vai dar 404 ou redirecionar pro fallback do router; isso é normal nesta task — corrigido na Task 17).

Pare o dev server.

- [ ] **Step 15.4: Commit**

```bash
git add apps/frontend/src/layouts/AppLayout.tsx
git commit -m "feat(layout): add hidden WhatsApp menu item gated by whatsapp_enabled"
```

---

## Task 16: Adicionar item de menu no `RecyclingLayout` (se existir)

**Files:**
- Modify: `apps/frontend/src/layouts/RecyclingLayout.tsx` (se existir)

- [ ] **Step 16.1: Verificar se existe layout dedicado de Recycling**

Run: `ls apps/frontend/src/layouts/`
Esperado: lista os layouts existentes.

Se houver `RecyclingLayout.tsx`:
- Aplique a mesma mudança da Task 15 (campos `requiredFeature`, item `WhatsApp` apontando para `/whatsapp`, filtro no `sidebarNav`).

Se NÃO houver layout separado de recycling (todo segmento usa `AppLayout`), pule esta task. Confirme com `grep -rn "RecyclingLayout" apps/frontend/src` — se não retornar referências de uso, não há trabalho aqui.

- [ ] **Step 16.2: Build (se aplicável)**

Run: `pnpm --filter frontend build`
Expected: sem erros.

- [ ] **Step 16.3: Commit (se aplicável)**

```bash
git add apps/frontend/src/layouts/RecyclingLayout.tsx
git commit -m "feat(layout): add hidden WhatsApp menu item to recycling layout"
```

---

## Task 17: Criar página stub e rota `/whatsapp`

**Files:**
- Create: `apps/frontend/src/pages/whatsapp/WhatsappStubPage.tsx`
- Modify: `apps/frontend/src/App.tsx`

- [ ] **Step 17.1: Criar a página stub**

Cria `apps/frontend/src/pages/whatsapp/WhatsappStubPage.tsx`:

```typescript
import { CCard, CCardBody, CCardTitle, CCardText } from '@coreui/react';

export function WhatsappStubPage() {
  return (
    <CCard>
      <CCardBody>
        <CCardTitle>WhatsApp</CCardTitle>
        <CCardText>
          Módulo em construção. As funcionalidades de inbox, setores e templates
          serão lançadas nas próximas fases.
        </CCardText>
      </CCardBody>
    </CCard>
  );
}

export default WhatsappStubPage;
```

- [ ] **Step 17.2: Registrar rota `/whatsapp` em `App.tsx`**

Edita `apps/frontend/src/App.tsx`. Adiciona o import:

```typescript
import { WhatsappStubPage } from './pages/whatsapp/WhatsappStubPage';
```

E adiciona a rota dentro da árvore de rotas autenticadas (próximo às rotas `/workshop/*`, mas no nível **raiz da rota autenticada** já que o spec define `/whatsapp` como cross-segment):

```tsx
<Route
  path="/whatsapp"
  element={
    <PrivateRoute>
      <AppLayout>
        <WhatsappStubPage />
      </AppLayout>
    </PrivateRoute>
  }
/>
```

Se o `PrivateRoute` requer um `requiredSegment`, deixe sem (`/whatsapp` é cross-segment). Se o `AppLayout` espera uma role específica, ajuste para aceitar tanto `WORKSHOP` quanto `RECYCLING` ou crie um wrapper simples sem segment guard.

**Nota:** na Fase 1 não há proteção por feature flag a nível de rota — apenas o menu esconde o item. Se um usuário entrar manualmente em `/whatsapp` sem ter `whatsapp_enabled`, vai cair no stub. Esse comportamento muda na Fase 6 (upsell).

- [ ] **Step 17.3: Verificação manual**

Run: `pnpm --filter frontend dev`
- Loga, navega para `/whatsapp` na URL → vê a página "Em construção" dentro do `AppLayout`.
- Pare o dev server.

- [ ] **Step 17.4: Build final + lint**

Run: `pnpm --filter frontend build && pnpm --filter frontend lint`
Expected: sem erros.

- [ ] **Step 17.5: Commit**

```bash
git add apps/frontend/src/pages/whatsapp/WhatsappStubPage.tsx apps/frontend/src/App.tsx
git commit -m "feat(whatsapp): add stub page and /whatsapp route"
```

---

## Task 18: Verificação final + testes do projeto

**Files:** todos os modificados acima.

- [ ] **Step 18.1: Rodar testes do backend**

Run: `pnpm --filter backend test`
Expected: todos os testes verdes, incluindo o novo `whatsapp-enabled.guard.spec.ts`.

- [ ] **Step 18.2: Rodar lint do monorepo**

Run: `pnpm lint`
Expected: sem erros.

- [ ] **Step 18.3: Build completo do monorepo**

Run: `pnpm --filter @praktikus/shared build && pnpm --filter backend build && pnpm --filter frontend build`
Expected: tudo verde.

- [ ] **Step 18.4: Smoke test E2E manual (entrega demoável)**

Cenário 1 — Tenant **sem** WhatsApp:
1. `pnpm --filter backend start:dev` + `pnpm --filter frontend dev`
2. Loga com um tenant onde `whatsapp_enabled = false`.
3. Confere: menu lateral **não** mostra "WhatsApp".

Cenário 2 — Tenant **com** WhatsApp:
1. Atualiza no DB: `UPDATE tenants SET whatsapp_enabled = true WHERE id = '<id>'`.
2. Logout + login.
3. Confere: menu lateral **mostra** "WhatsApp".
4. Clica → carrega `/whatsapp` com a página stub "Em construção".

Cenário 3 — Schema do tenant:
1. Em outro terminal:
```bash
docker exec -it $(docker ps --filter name=postgres --format '{{.Names}}') \
  psql -U praktikus -d praktikus -c "\dt tenant_<TENANT_ID_SEM_HIFENS>.whatsapp_*"
```
Expected: lista 6 tabelas WhatsApp.

- [ ] **Step 18.5: Commit do PR final (caso tenha algo solto)**

Run: `git status`
Expected: working tree limpa. Se houver dist/build não commitado, adicione conforme política do projeto e commite.

---

## Critério de "pronto" demoável (Fase 1)

- [ ] PostgreSQL: 4 colunas WhatsApp na `public.tenants` + 6 tabelas WhatsApp em todos os schemas de tenants (existentes e novos).
- [ ] JWT: campo `whatsapp_enabled` propaga corretamente do DB ao token.
- [ ] Frontend: item "WhatsApp" no menu aparece **somente** quando `tenant.whatsapp_enabled = true`.
- [ ] Rota `/whatsapp` existe e renderiza placeholder dentro do layout autenticado.
- [ ] `WhatsappEnabledGuard` existe, exportado pelo módulo, com testes unitários verdes (4 cases).
- [ ] `migration:revert` + `migration:run` funcionam (idempotência verificada).
- [ ] `pnpm test` e `pnpm lint` verdes.

---

## Self-Review (verificar antes de iniciar implementação)

**Cobertura do spec:**
- §2 Modelo de dados (6 tabelas + colunas em tenants) → Tasks 3–10 ✓
- §3 Extensão de TenantEntity (4 colunas) → Task 2 + Task 10 ✓
- §7.1 Menu lateral condicional (`whatsapp_enabled`) → Tasks 14–17 ✓
- §10 Fase 1 critério "pronto" → Task 18 ✓
- §1 `WhatsappProvider` interface → **NÃO** entra na Fase 1 (é Fase 2). OK.
- §4 Endpoints → **NÃO** entram na Fase 1. OK.

**Placeholder scan:** Sem TBD/TODO. Todo step tem código completo.

**Type consistency:** `WhatsappPlan`, `WhatsappAccountStatus`, `WhatsappConversationStatus`, etc. usados consistentemente entre Task 1 (definição) e Tasks 3–8 (uso em entities). `whatsapp_enabled` (snake_case JWT) vs `whatsappEnabled` (camelCase TS) seguem o padrão já estabelecido nos campos do JWT existente (`tenant_status` vs `tenantStatus`).
