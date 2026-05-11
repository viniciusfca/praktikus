# Cobrança self-service via Asaas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que o dono da oficina cadastre cartão e/ou pague PIX dentro do Praktikus, sem nunca acessar o painel do Asaas, gerenciando o ciclo completo trial → ACTIVE → OVERDUE → SUSPENDED com bloqueio progressivo e self-service total numa aba "Assinatura".

**Architecture:** Backend NestJS estende o módulo `billing` existente com 11 métodos novos no service, 9 endpoints REST, 2 cron jobs e webhook expandido (8 eventos Asaas). Frontend React adiciona componentes em `components/billing/`, hooks customizados, e refatora `SubscriptionTab` + `SuspendedPage` para usar a nova API. Cartão é cadastrado via popup do Asaas Checkout (sem PCI-DSS); PIX é gerado on-demand via API e exibido nativamente. Subscription provisória criada no signup é cancelada e recriada quando cliente cadastra cartão.

**Tech Stack:** NestJS + TypeORM + Postgres (multi-tenant por schema), Resend (emails transacionais via `MailService`), React 19 + CoreUI + Zustand + Axios (sem react-query — segue padrão do projeto), Asaas API v3 (sandbox + produção via env). Spec: [`docs/superpowers/specs/2026-05-04-billing-self-service-asaas-design.md`](../specs/2026-05-04-billing-self-service-asaas-design.md).

---

## File Structure

### Backend — criar
- `apps/backend/src/modules/core/billing/billing-invoice.entity.ts` — entidade `billing_invoices`
- `apps/backend/src/modules/core/billing/asaas.client.ts` — wrapper sobre `fetch` (auth headers + mock mode + erros padronizados)
- `apps/backend/src/modules/core/billing/asaas.client.spec.ts`
- `apps/backend/src/modules/core/billing/dto/billing-summary.dto.ts`
- `apps/backend/src/modules/core/billing/dto/open-invoice.dto.ts`
- `apps/backend/src/modules/core/billing/dto/checkout-session.dto.ts`
- `apps/backend/src/database/migrations/1750000000000-AddBillingSelfServiceFields.ts`

### Backend — modificar
- `apps/backend/src/modules/core/billing/billing.entity.ts` — 6 colunas novas
- `apps/backend/src/modules/core/billing/billing.service.ts` — 11 métodos novos + 2 fixes
- `apps/backend/src/modules/core/billing/billing.service.spec.ts` — testes dos métodos novos
- `apps/backend/src/modules/core/billing/billing.controller.ts` — 9 endpoints REST + webhook expandido
- `apps/backend/src/modules/core/billing/billing.controller.spec.ts` — testes dos novos endpoints e eventos
- `apps/backend/src/modules/core/billing/billing.module.ts` — registrar entidade nova, schedulers
- `apps/backend/src/modules/core/auth/tenant-status.guard.ts` — whitelist `/billing/*`
- `apps/backend/src/modules/core/mail/mail.service.ts` — 5 templates novos
- `apps/backend/src/modules/core/mail/mail.service.spec.ts`
- `apps/backend/.env.example` — novas envs

### Frontend — criar
- `apps/frontend/src/services/billing.service.ts`
- `apps/frontend/src/store/billing.store.ts`
- `apps/frontend/src/components/billing/AsaasCheckoutPopup.tsx`
- `apps/frontend/src/components/billing/BillingStatusCard.tsx`
- `apps/frontend/src/components/billing/PaymentMethodCard.tsx`
- `apps/frontend/src/components/billing/OpenInvoiceCard.tsx`
- `apps/frontend/src/components/billing/InvoiceHistoryTable.tsx`
- `apps/frontend/src/components/billing/CancelSubscriptionDialog.tsx`

### Frontend — modificar
- `apps/frontend/src/components/settings/SubscriptionTab.tsx` — reescrita para compor os novos componentes
- `apps/frontend/src/pages/public/SuspendedPage.tsx` — apontar pra rota interna em vez de asaas.com
- `apps/frontend/src/layouts/AppLayout.tsx` — banner countdown amarelo + OVERDUE vermelho
- `apps/frontend/src/layouts/RecyclingLayout.tsx` — mesmos banners (mesmo segmento de billing)

### Shared
- `packages/shared/src/enums/billing-type.enum.ts` — novo
- `packages/shared/src/index.ts` — exportar

---

## Task 1: BillingType enum em packages/shared

**Files:**
- Create: `packages/shared/src/enums/billing-type.enum.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Criar enum**

```typescript
// packages/shared/src/enums/billing-type.enum.ts
export enum BillingType {
  PIX = 'PIX',
  CREDIT_CARD = 'CREDIT_CARD',
  BOLETO = 'BOLETO',
  UNDEFINED = 'UNDEFINED',
}

export enum InvoiceStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  OVERDUE = 'OVERDUE',
  REFUNDED = 'REFUNDED',
  DELETED = 'DELETED',
}
```

- [ ] **Step 2: Exportar**

Adicionar ao final de `packages/shared/src/index.ts`:

```typescript
export * from './enums/billing-type.enum';
```

- [ ] **Step 3: Build**

Run: `pnpm --filter @praktikus/shared build`
Expected: dist atualizado sem erros.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/enums/billing-type.enum.ts packages/shared/src/index.ts
git commit -m "feat(shared): add BillingType and InvoiceStatus enums"
```

---

## Task 2: Migration — campos novos em billings + tabela billing_invoices

**Files:**
- Create: `apps/backend/src/database/migrations/1750000000000-AddBillingSelfServiceFields.ts`

- [ ] **Step 1: Escrever a migration**

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBillingSelfServiceFields1750000000000 implements MigrationInterface {
  name = 'AddBillingSelfServiceFields1750000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1) public.billing — 6 colunas novas
    await queryRunner.query(`
      ALTER TABLE "public"."billing"
        ADD COLUMN IF NOT EXISTS "billing_type" VARCHAR(20),
        ADD COLUMN IF NOT EXISTS "card_last4" VARCHAR(4),
        ADD COLUMN IF NOT EXISTS "card_brand" VARCHAR(20),
        ADD COLUMN IF NOT EXISTS "card_expiry" VARCHAR(5),
        ADD COLUMN IF NOT EXISTS "next_due_date" DATE,
        ADD COLUMN IF NOT EXISTS "canceled_at" TIMESTAMPTZ
    `);

    // 2) public.billing_invoices — nova tabela
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "public"."billing_invoices" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id" UUID NOT NULL,
        "asaas_payment_id" VARCHAR(64) NOT NULL UNIQUE,
        "value" NUMERIC(10,2) NOT NULL,
        "due_date" DATE NOT NULL,
        "status" VARCHAR(20) NOT NULL,
        "paid_at" TIMESTAMPTZ,
        "billing_type" VARCHAR(20) NOT NULL,
        "pix_qr_code" TEXT,
        "pix_copy_paste" TEXT,
        "pix_expires_at" TIMESTAMPTZ,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT "fk_billing_invoices_tenant"
          FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_billing_invoices_tenant_status"
        ON "public"."billing_invoices" ("tenant_id", "status")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "public"."billing_invoices" CASCADE`);
    await queryRunner.query(`
      ALTER TABLE "public"."billing"
        DROP COLUMN IF EXISTS "canceled_at",
        DROP COLUMN IF EXISTS "next_due_date",
        DROP COLUMN IF EXISTS "card_expiry",
        DROP COLUMN IF EXISTS "card_brand",
        DROP COLUMN IF EXISTS "card_last4",
        DROP COLUMN IF EXISTS "billing_type"
    `);
  }
}
```

- [ ] **Step 2: Rodar migration localmente**

Run: `pnpm --filter backend migration:run`
Expected: log `AddBillingSelfServiceFields1750000000000 has been executed successfully`. Confirmar com `psql` que `\d public.billing` mostra as 6 colunas novas e que `\d public.billing_invoices` existe.

- [ ] **Step 3: Validar revert**

Run: `pnpm --filter backend migration:revert`
Expected: tabela `billing_invoices` removida, colunas removidas. Em seguida, rodar `migration:run` de novo para deixar aplicado antes do próximo task.

- [ ] **Step 4: Commit**

```bash
git add apps/backend/src/database/migrations/1750000000000-AddBillingSelfServiceFields.ts
git commit -m "feat(db): add billing self-service columns and billing_invoices table"
```

---

## Task 3: BillingEntity (novas colunas) + BillingInvoiceEntity

**Files:**
- Modify: `apps/backend/src/modules/core/billing/billing.entity.ts`
- Create: `apps/backend/src/modules/core/billing/billing-invoice.entity.ts`

- [ ] **Step 1: Estender BillingEntity**

Substituir o conteúdo de `billing.entity.ts` por:

```typescript
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'billing', schema: 'public' })
export class BillingEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', unique: true, type: 'uuid' })
  tenantId: string;

  @Column({ name: 'asaas_customer_id', type: 'varchar', nullable: true })
  asaasCustomerId: string | null;

  @Column({ name: 'asaas_subscription_id', type: 'varchar', nullable: true })
  asaasSubscriptionId: string | null;

  @Column({ name: 'billing_type', type: 'varchar', length: 20, nullable: true })
  billingType: 'PIX' | 'CREDIT_CARD' | null;

  @Column({ name: 'card_last4', type: 'varchar', length: 4, nullable: true })
  cardLast4: string | null;

  @Column({ name: 'card_brand', type: 'varchar', length: 20, nullable: true })
  cardBrand: string | null;

  @Column({ name: 'card_expiry', type: 'varchar', length: 5, nullable: true })
  cardExpiry: string | null;

  @Column({ name: 'next_due_date', type: 'date', nullable: true })
  nextDueDate: Date | null;

  @Column({ name: 'canceled_at', type: 'timestamptz', nullable: true })
  canceledAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
```

- [ ] **Step 2: Criar BillingInvoiceEntity**

```typescript
// apps/backend/src/modules/core/billing/billing-invoice.entity.ts
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { InvoiceStatus, BillingType } from '@praktikus/shared';

@Entity({ name: 'billing_invoices', schema: 'public' })
@Index(['tenantId', 'status'])
export class BillingInvoiceEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'asaas_payment_id', type: 'varchar', length: 64, unique: true })
  asaasPaymentId: string;

  @Column({ type: 'numeric', precision: 10, scale: 2 })
  value: string;

  @Column({ name: 'due_date', type: 'date' })
  dueDate: Date;

  @Column({ type: 'varchar', length: 20 })
  status: InvoiceStatus;

  @Column({ name: 'paid_at', type: 'timestamptz', nullable: true })
  paidAt: Date | null;

  @Column({ name: 'billing_type', type: 'varchar', length: 20 })
  billingType: BillingType;

  @Column({ name: 'pix_qr_code', type: 'text', nullable: true })
  pixQrCode: string | null;

  @Column({ name: 'pix_copy_paste', type: 'text', nullable: true })
  pixCopyPaste: string | null;

  @Column({ name: 'pix_expires_at', type: 'timestamptz', nullable: true })
  pixExpiresAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
```

- [ ] **Step 3: Registrar no module**

Editar `apps/backend/src/modules/core/billing/billing.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BillingEntity } from './billing.entity';
import { BillingInvoiceEntity } from './billing-invoice.entity';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { AsaasClient } from './asaas.client';
import { TenancyModule } from '../tenancy/tenancy.module';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([BillingEntity, BillingInvoiceEntity]),
    TenancyModule,
    MailModule,
  ],
  controllers: [BillingController],
  providers: [BillingService, AsaasClient],
  exports: [BillingService],
})
export class BillingModule {}
```

(Nota: `MailModule` e `AsaasClient` serão criados nas tasks 4 e 12 — se você está executando em ordem, comente as duas linhas correspondentes neste passo e descomente quando criar.)

- [ ] **Step 4: Build verifica que entities batem com migration**

Run: `pnpm --filter backend build`
Expected: build OK. Sem erros TypeORM/TS.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/core/billing/
git commit -m "feat(billing): extend BillingEntity and add BillingInvoiceEntity"
```

---

## Task 4: AsaasClient — wrapper HTTP com mock mode

**Files:**
- Create: `apps/backend/src/modules/core/billing/asaas.client.ts`
- Create: `apps/backend/src/modules/core/billing/asaas.client.spec.ts`

- [ ] **Step 1: Escrever testes primeiro**

```typescript
// apps/backend/src/modules/core/billing/asaas.client.spec.ts
import { ConfigService } from '@nestjs/config';
import { AsaasClient } from './asaas.client';

const mockConfig = (overrides: Record<string, string> = {}) =>
  ({
    get: jest.fn((key: string, fallback?: string) => {
      const map: Record<string, string> = {
        ASAAS_API_KEY: 'real_key',
        ASAAS_API_URL: 'https://sandbox.asaas.com/api/v3',
        ...overrides,
      };
      return map[key] ?? fallback;
    }),
  }) as unknown as ConfigService;

describe('AsaasClient', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => jest.restoreAllMocks());

  it('detects mock mode when ASAAS_API_KEY=mock', () => {
    const client = new AsaasClient(mockConfig({ ASAAS_API_KEY: 'mock' }));
    expect(client.isMock).toBe(true);
  });

  it('detects mock mode when ASAAS_API_KEY is empty', () => {
    const client = new AsaasClient(mockConfig({ ASAAS_API_KEY: '' }));
    expect(client.isMock).toBe(true);
  });

  it('sends access_token header on real calls', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'cus_123' }),
    });
    const client = new AsaasClient(mockConfig());
    await client.post('/customers', { name: 'foo' });
    expect(global.fetch).toHaveBeenCalledWith(
      'https://sandbox.asaas.com/api/v3/customers',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          access_token: 'real_key',
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({ name: 'foo' }),
      }),
    );
  });

  it('throws AsaasError on non-2xx with status and body', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: async () => '{"errors":[{"description":"invalid cnpj"}]}',
    });
    const client = new AsaasClient(mockConfig());
    await expect(client.post('/customers', {})).rejects.toThrow(
      /Asaas POST \/customers failed: 400/,
    );
  });

  it('throws on network error with descriptive message', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('ECONNREFUSED'));
    const client = new AsaasClient(mockConfig());
    await expect(client.post('/customers', {})).rejects.toThrow(
      /Asaas network error.*ECONNREFUSED/,
    );
  });

  it('supports GET, PATCH, DELETE methods', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({}) });
    const client = new AsaasClient(mockConfig());
    await client.get('/foo');
    await client.patch('/foo', { x: 1 });
    await client.delete('/foo');
    const calls = (global.fetch as jest.Mock).mock.calls;
    expect(calls[0][1].method).toBe('GET');
    expect(calls[1][1].method).toBe('PATCH');
    expect(calls[2][1].method).toBe('DELETE');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter backend test -- asaas.client.spec`
Expected: FAIL — `Cannot find module './asaas.client'`.

- [ ] **Step 3: Implementar AsaasClient**

```typescript
// apps/backend/src/modules/core/billing/asaas.client.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export class AsaasError extends Error {
  constructor(
    public readonly method: string,
    public readonly path: string,
    public readonly status: number,
    public readonly body: string,
  ) {
    super(`Asaas ${method} ${path} failed: ${status} ${body}`);
  }
}

@Injectable()
export class AsaasClient {
  private readonly logger = new Logger(AsaasClient.name);
  readonly isMock: boolean;
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(private readonly config: ConfigService) {
    const key = this.config.get<string>('ASAAS_API_KEY') ?? '';
    this.isMock = !key || key === 'mock';
    this.apiKey = key;
    this.baseUrl = this.config.get<string>(
      'ASAAS_API_URL',
      'https://sandbox.asaas.com/api/v3',
    );
    if (this.isMock) {
      this.logger.warn('AsaasClient em modo MOCK — chamadas externas desabilitadas.');
    }
  }

  async post<T = unknown>(path: string, body: unknown): Promise<T> {
    return this.request<T>('POST', path, body);
  }

  async get<T = unknown>(path: string): Promise<T> {
    return this.request<T>('GET', path);
  }

  async patch<T = unknown>(path: string, body: unknown): Promise<T> {
    return this.request<T>('PATCH', path, body);
  }

  async delete<T = unknown>(path: string): Promise<T> {
    return this.request<T>('DELETE', path);
  }

  private async request<T>(
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    path: string,
    body?: unknown,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const init: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        access_token: this.apiKey,
      },
    };
    if (body !== undefined) init.body = JSON.stringify(body);

    let res: Response;
    try {
      res = await fetch(url, init);
    } catch (err) {
      throw new Error(
        `Asaas network error on ${method} ${path}: ${(err as Error).message}`,
      );
    }
    if (!res.ok) {
      const text = await res.text();
      throw new AsaasError(method, path, res.status, text);
    }
    return (await res.json()) as T;
  }
}
```

- [ ] **Step 4: Rodar testes — todos verdes**

Run: `pnpm --filter backend test -- asaas.client.spec`
Expected: PASS — 6 testes verdes.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/core/billing/asaas.client.ts apps/backend/src/modules/core/billing/asaas.client.spec.ts
git commit -m "feat(billing): add AsaasClient HTTP wrapper with mock mode"
```

---

## Task 5: setupTrial refactor + reajuste anual fix

**Files:**
- Modify: `apps/backend/src/modules/core/billing/billing.service.ts`
- Modify: `apps/backend/src/modules/core/billing/billing.service.spec.ts`
- Modify: `apps/backend/src/modules/core/auth/auth.service.ts` (passa `cnpj` ao chamar `setupTrial`)

- [ ] **Step 1: Atualizar testes de setupTrial e reajuste**

Em `billing.service.spec.ts`, no bloco `describe('setupTrial')`, substituir os testes existentes por:

```typescript
describe('setupTrial', () => {
  beforeEach(() => {
    mockBillingRepo.create.mockImplementation((x: any) => x);
    mockBillingRepo.save.mockResolvedValue({});
  });

  it('passes cpfCnpj to Asaas customer creation', async () => {
    mockConfig.get.mockImplementation((k: string, d?: string) => {
      const map: Record<string, string> = {
        ASAAS_API_KEY: 'real',
        ASAAS_API_URL: 'https://sandbox.asaas.com/api/v3',
        ASAAS_PLAN_VALUE: '89.90',
      };
      return map[k] ?? d;
    });
    const postSpy = jest.spyOn(asaasClient, 'post')
      .mockResolvedValueOnce({ id: 'cus_1' })
      .mockResolvedValueOnce({ id: 'sub_1' });

    await service.setupTrial('tenant-1', 'a@b.com', 'Foo Ltda', '12345678901234');

    expect(postSpy).toHaveBeenNthCalledWith(1, '/customers', {
      name: 'Foo Ltda',
      email: 'a@b.com',
      cpfCnpj: '12345678901234',
    });
  });

  it('creates subscription with billingType UNDEFINED and value from env', async () => {
    mockConfig.get.mockImplementation((k: string, d?: string) => {
      const map: Record<string, string> = {
        ASAAS_API_KEY: 'real',
        ASAAS_API_URL: 'https://sandbox.asaas.com/api/v3',
        ASAAS_PLAN_VALUE: '89.90',
      };
      return map[k] ?? d;
    });
    const postSpy = jest.spyOn(asaasClient, 'post')
      .mockResolvedValueOnce({ id: 'cus_1' })
      .mockResolvedValueOnce({ id: 'sub_1' });

    await service.setupTrial('tenant-1', 'a@b.com', 'Foo Ltda', '12345678901234');

    expect(postSpy).toHaveBeenNthCalledWith(2, '/subscriptions', expect.objectContaining({
      customer: 'cus_1',
      billingType: 'UNDEFINED',
      value: 89.90,
      cycle: 'MONTHLY',
      description: 'Plano Praktikus — R$89,90/mês',
      trialPeriodDays: 30,
    }));
  });

  it('uses mock IDs when ASAAS_API_KEY=mock', async () => {
    mockConfig.get.mockImplementation((k: string) => k === 'ASAAS_API_KEY' ? 'mock' : '');
    // re-instanciar service com mock client
    // (setup específico no beforeEach do describe principal)
    await service.setupTrial('tenant-1', 'a@b.com', 'Foo Ltda', '12345678901234');
    expect(mockBillingRepo.save).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: 'tenant-1',
      asaasCustomerId: 'mock_customer_tenant-1',
      asaasSubscriptionId: 'mock_subscription_tenant-1',
    }));
  });
});
```

E em `describe('applyAnnualAdjustment')`, adicionar:

```typescript
it('skips tenant whose anchor month does not match current month', async () => {
  // hoje = jan; anchor = 15-mar → não deve aplicar
  const realDateNow = Date.now;
  Date.now = () => new Date('2026-01-15T09:00:00Z').getTime();

  mockBillingRepo.find.mockResolvedValue([{
    tenantId: 't1', asaasSubscriptionId: 'sub_1',
  }]);
  mockTenancyService.findById.mockResolvedValue({
    billingAnchorDate: new Date('2025-03-15'),
  });
  const patchSpy = jest.spyOn(asaasClient, 'patch');

  await service.applyAnnualAdjustment();

  expect(patchSpy).not.toHaveBeenCalled();
  Date.now = realDateNow;
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter backend test -- billing.service.spec`
Expected: testes novos falham (cpfCnpj não passado, billingType ainda CREDIT_CARD, filtro de mês ausente).

- [ ] **Step 3: Refatorar setupTrial e applyAnnualAdjustment**

Em `billing.service.ts`:

a) Atualizar construtor:

```typescript
constructor(
  @InjectRepository(BillingEntity)
  private readonly billingRepo: Repository<BillingEntity>,
  @InjectRepository(BillingInvoiceEntity)
  private readonly invoiceRepo: Repository<BillingInvoiceEntity>,
  private readonly config: ConfigService,
  private readonly tenancyService: TenancyService,
  private readonly asaas: AsaasClient,
  private readonly mailService: MailService,
) {
  this.isMock = this.asaas.isMock;
}
```

(Remova o cálculo direto de `apiKey`/`isMock` — delega ao `AsaasClient`.)

b) Reescrever `setupTrial`:

```typescript
async setupTrial(
  tenantId: string,
  email: string,
  name: string,
  cnpj: string,
): Promise<void> {
  let asaasCustomerId: string;
  let asaasSubscriptionId: string;

  if (this.isMock) {
    asaasCustomerId = `mock_customer_${tenantId}`;
    asaasSubscriptionId = `mock_subscription_${tenantId}`;
  } else {
    const planValue = parseFloat(this.config.get<string>('ASAAS_PLAN_VALUE', '89.90'));

    const customer = await this.asaas.post<{ id: string }>('/customers', {
      name,
      email,
      cpfCnpj: cnpj,
    });
    asaasCustomerId = customer.id;

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);
    const dueDateStr = dueDate.toISOString().split('T')[0];

    try {
      const sub = await this.asaas.post<{ id: string }>('/subscriptions', {
        customer: asaasCustomerId,
        billingType: 'UNDEFINED',
        value: planValue,
        nextDueDate: dueDateStr,
        cycle: 'MONTHLY',
        description: `Plano Praktikus — R$${planValue.toFixed(2).replace('.', ',')}/mês`,
        trialPeriodDays: 30,
      });
      asaasSubscriptionId = sub.id;
    } catch (err) {
      this.logger.error(
        `Asaas createSubscription failed. Orphaned customerId: ${asaasCustomerId}. Error: ${(err as Error).message}`,
      );
      throw err;
    }
  }

  await this.billingRepo.save(
    this.billingRepo.create({
      tenantId,
      asaasCustomerId,
      asaasSubscriptionId,
      billingType: null,
    }),
  );
}
```

c) Em `applyAnnualAdjustment`, ajustar filtro de mês:

```typescript
const anchor = new Date(tenant.billingAnchorDate);
if (anchor.getDate() !== todayDay) continue;
if (anchor.getMonth() + 1 !== todayMonth) continue;   // ← novo
```

Substituir o `fetch` direto pelo `asaas.patch(...)`:

```typescript
try {
  await this.asaas.patch(`/subscriptions/${billing.asaasSubscriptionId}`, {
    value: newValue,
  });
  this.logger.log(
    `Reajuste anual aplicado tenant ${billing.tenantId}: R$${currentValue} → R$${newValue}`,
  );
} catch (err) {
  this.logger.error(
    `Asaas PATCH subscription failed for tenant ${billing.tenantId}: ${(err as Error).message}`,
  );
}
```

- [ ] **Step 4: Atualizar caller no AuthService**

Em `apps/backend/src/modules/core/auth/auth.service.ts:93-97`, mudar a chamada para passar `cnpj`:

```typescript
await this.billingService.setupTrial(
  tenant.id,
  dto.email,
  dto.nomeFantasia,
  dto.cnpj,
);
```

- [ ] **Step 5: Rodar testes**

Run: `pnpm --filter backend test -- "billing.service.spec|auth.service.spec"`
Expected: todos os testes verdes (existentes + novos).

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/modules/core/billing/billing.service.ts apps/backend/src/modules/core/billing/billing.service.spec.ts apps/backend/src/modules/core/auth/auth.service.ts
git commit -m "fix(billing): add cpfCnpj to setupTrial, fix annual adjustment month filter"
```

---

## Task 6: Read services — getCurrentBilling, getOpenInvoice, listPaidInvoices, generatePixForInvoice

**Files:**
- Modify: `apps/backend/src/modules/core/billing/billing.service.ts`
- Modify: `apps/backend/src/modules/core/billing/billing.service.spec.ts`
- Create: `apps/backend/src/modules/core/billing/dto/billing-summary.dto.ts`
- Create: `apps/backend/src/modules/core/billing/dto/open-invoice.dto.ts`

- [ ] **Step 1: Criar DTOs de retorno**

```typescript
// apps/backend/src/modules/core/billing/dto/billing-summary.dto.ts
import { TenantStatus } from '../../tenancy/tenant.entity';

export interface BillingSummaryDto {
  status: TenantStatus;
  planName: string;
  planValue: number;
  billingType: 'PIX' | 'CREDIT_CARD' | null;
  card: { last4: string; brand: string; expiry: string } | null;
  nextDueDate: string | null;       // ISO
  trialEndsAt: string | null;       // ISO
  daysUntilTrialEnds: number | null;
  canceledAt: string | null;
}
```

```typescript
// apps/backend/src/modules/core/billing/dto/open-invoice.dto.ts
import { InvoiceStatus, BillingType } from '@praktikus/shared';

export interface OpenInvoiceDto {
  id: string;
  asaasPaymentId: string;
  value: number;
  dueDate: string;
  status: InvoiceStatus;
  billingType: BillingType;
  pix: { qrCodeBase64: string; copyPaste: string } | null;
}
```

- [ ] **Step 2: Escrever testes**

Em `billing.service.spec.ts`, adicionar:

```typescript
describe('getCurrentBilling', () => {
  it('returns trial summary with daysUntilTrialEnds when status TRIAL', async () => {
    const trialEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    mockTenancyService.findById.mockResolvedValue({
      id: 't1', status: 'TRIAL', trialEndsAt: trialEnd, billingAnchorDate: null,
    });
    mockBillingRepo.findOne.mockResolvedValue({
      tenantId: 't1', billingType: null, cardLast4: null, cardBrand: null,
      cardExpiry: null, nextDueDate: null, canceledAt: null,
    });
    mockConfig.get.mockImplementation((k: string, d?: string) =>
      k === 'ASAAS_PLAN_VALUE' ? '89.90' : d);

    const summary = await service.getCurrentBilling('t1');

    expect(summary.status).toBe('TRIAL');
    expect(summary.planValue).toBe(89.90);
    expect(summary.daysUntilTrialEnds).toBe(7);
    expect(summary.card).toBeNull();
  });

  it('returns card info when billingType is CREDIT_CARD', async () => {
    mockTenancyService.findById.mockResolvedValue({
      id: 't1', status: 'ACTIVE', trialEndsAt: null, billingAnchorDate: new Date(),
    });
    mockBillingRepo.findOne.mockResolvedValue({
      tenantId: 't1', billingType: 'CREDIT_CARD',
      cardLast4: '1234', cardBrand: 'VISA', cardExpiry: '12/29',
      nextDueDate: new Date('2026-06-15'), canceledAt: null,
    });
    mockConfig.get.mockImplementation((k: string, d?: string) =>
      k === 'ASAAS_PLAN_VALUE' ? '89.90' : d);

    const summary = await service.getCurrentBilling('t1');

    expect(summary.card).toEqual({ last4: '1234', brand: 'VISA', expiry: '12/29' });
  });
});

describe('getOpenInvoice', () => {
  it('returns null when no PENDING/OVERDUE invoice exists', async () => {
    mockInvoiceRepo.findOne.mockResolvedValue(null);
    expect(await service.getOpenInvoice('t1')).toBeNull();
  });

  it('returns invoice with cached PIX when valid', async () => {
    mockInvoiceRepo.findOne.mockResolvedValue({
      id: 'inv1', asaasPaymentId: 'pay_1', value: '89.90', dueDate: new Date(),
      status: 'PENDING', billingType: 'PIX',
      pixQrCode: 'BASE64', pixCopyPaste: '00020126', pixExpiresAt: new Date(Date.now() + 3600000),
    });
    const result = await service.getOpenInvoice('t1');
    expect(result?.pix).toEqual({ qrCodeBase64: 'BASE64', copyPaste: '00020126' });
  });

  it('regenerates PIX when cache expired', async () => {
    mockInvoiceRepo.findOne.mockResolvedValue({
      id: 'inv1', asaasPaymentId: 'pay_1', value: '89.90', dueDate: new Date(),
      status: 'PENDING', billingType: 'PIX',
      pixQrCode: 'OLD', pixCopyPaste: 'OLD', pixExpiresAt: new Date(Date.now() - 1000),
    });
    jest.spyOn(asaasClient, 'get').mockResolvedValue({
      encodedImage: 'NEW64', payload: '00020NEW',
      expirationDate: new Date(Date.now() + 86400000).toISOString(),
    });
    mockInvoiceRepo.save.mockImplementation((x: any) => x);

    const result = await service.getOpenInvoice('t1');
    expect(result?.pix?.qrCodeBase64).toBe('NEW64');
  });
});

describe('listPaidInvoices', () => {
  it('returns last 12 CONFIRMED invoices ordered by paidAt DESC', async () => {
    mockInvoiceRepo.find.mockResolvedValue([
      { id: 'a', value: '89.90', paidAt: new Date('2026-04-01'), billingType: 'PIX', status: 'CONFIRMED', asaasPaymentId: 'p1', dueDate: new Date() },
    ]);
    const list = await service.listPaidInvoices('t1', 12);
    expect(mockInvoiceRepo.find).toHaveBeenCalledWith({
      where: { tenantId: 't1', status: 'CONFIRMED' },
      order: { paidAt: 'DESC' },
      take: 12,
    });
    expect(list).toHaveLength(1);
  });
});
```

(Adicionar `mockInvoiceRepo` no setup principal do describe e injetar como provider de `getRepositoryToken(BillingInvoiceEntity)`.)

- [ ] **Step 3: Rodar e ver falhar**

Run: `pnpm --filter backend test -- billing.service.spec`
Expected: 5 testes novos falham — métodos não existem ainda.

- [ ] **Step 4: Implementar os 4 métodos**

Adicionar em `billing.service.ts`:

```typescript
async getCurrentBilling(tenantId: string): Promise<BillingSummaryDto> {
  const tenant = await this.tenancyService.findById(tenantId);
  if (!tenant) throw new NotFoundException('Tenant not found');
  const billing = await this.billingRepo.findOne({ where: { tenantId } });

  const planValue = parseFloat(this.config.get<string>('ASAAS_PLAN_VALUE', '89.90'));
  let daysUntilTrialEnds: number | null = null;
  if (tenant.status === 'TRIAL' && tenant.trialEndsAt) {
    const diff = new Date(tenant.trialEndsAt).getTime() - Date.now();
    daysUntilTrialEnds = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }

  return {
    status: tenant.status,
    planName: 'Plano Praktikus',
    planValue,
    billingType: billing?.billingType ?? null,
    card: billing?.cardLast4
      ? { last4: billing.cardLast4, brand: billing.cardBrand!, expiry: billing.cardExpiry! }
      : null,
    nextDueDate: billing?.nextDueDate?.toISOString() ?? null,
    trialEndsAt: tenant.trialEndsAt?.toISOString() ?? null,
    daysUntilTrialEnds,
    canceledAt: billing?.canceledAt?.toISOString() ?? null,
  };
}

async getOpenInvoice(tenantId: string): Promise<OpenInvoiceDto | null> {
  const invoice = await this.invoiceRepo.findOne({
    where: [
      { tenantId, status: InvoiceStatus.PENDING },
      { tenantId, status: InvoiceStatus.OVERDUE },
    ],
    order: { dueDate: 'DESC' },
  });
  if (!invoice) return null;

  let pix: { qrCodeBase64: string; copyPaste: string } | null = null;
  if (invoice.billingType === BillingType.PIX) {
    const expired = !invoice.pixExpiresAt || invoice.pixExpiresAt.getTime() < Date.now();
    if (expired || !invoice.pixQrCode) {
      pix = await this.generatePixForInvoice(invoice.id);
    } else {
      pix = { qrCodeBase64: invoice.pixQrCode, copyPaste: invoice.pixCopyPaste! };
    }
  }

  return {
    id: invoice.id,
    asaasPaymentId: invoice.asaasPaymentId,
    value: parseFloat(invoice.value),
    dueDate: invoice.dueDate.toISOString().split('T')[0],
    status: invoice.status,
    billingType: invoice.billingType,
    pix,
  };
}

async generatePixForInvoice(
  invoiceId: string,
  tenantId?: string,
): Promise<{ qrCodeBase64: string; copyPaste: string }> {
  const invoice = await this.invoiceRepo.findOne({ where: { id: invoiceId } });
  if (!invoice) throw new NotFoundException('Invoice not found');
  if (tenantId && invoice.tenantId !== tenantId) {
    throw new NotFoundException('Invoice not found');
  }

  if (this.isMock) {
    return { qrCodeBase64: 'MOCK_BASE64', copyPaste: 'MOCK_COPYPASTE' };
  }

  const res = await this.asaas.get<{
    encodedImage: string; payload: string; expirationDate: string;
  }>(`/payments/${invoice.asaasPaymentId}/pixQrCode`);

  invoice.pixQrCode = res.encodedImage;
  invoice.pixCopyPaste = res.payload;
  invoice.pixExpiresAt = new Date(res.expirationDate);
  await this.invoiceRepo.save(invoice);

  return { qrCodeBase64: res.encodedImage, copyPaste: res.payload };
}

async listPaidInvoices(tenantId: string, limit = 12): Promise<OpenInvoiceDto[]> {
  const invoices = await this.invoiceRepo.find({
    where: { tenantId, status: InvoiceStatus.CONFIRMED },
    order: { paidAt: 'DESC' },
    take: limit,
  });
  return invoices.map((i) => ({
    id: i.id,
    asaasPaymentId: i.asaasPaymentId,
    value: parseFloat(i.value),
    dueDate: i.dueDate.toISOString().split('T')[0],
    status: i.status,
    billingType: i.billingType,
    pix: null,
  }));
}
```

(Imports a adicionar no topo: `NotFoundException` de `@nestjs/common`, `BillingInvoiceEntity`, `InvoiceStatus`, `BillingType`, `BillingSummaryDto`, `OpenInvoiceDto`.)

- [ ] **Step 5: Rodar testes**

Run: `pnpm --filter backend test -- billing.service.spec`
Expected: PASS — todos os testes (existentes + 5 novos).

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/modules/core/billing/
git commit -m "feat(billing): add read methods (summary, open invoice, paid history, pix)"
```

---

## Task 7: Checkout services — createCheckoutSessionForCard, createCheckoutSessionForInvoice

**Files:**
- Modify: `apps/backend/src/modules/core/billing/billing.service.ts`
- Modify: `apps/backend/src/modules/core/billing/billing.service.spec.ts`
- Create: `apps/backend/src/modules/core/billing/dto/checkout-session.dto.ts`

- [ ] **Step 1: DTO de retorno**

```typescript
// apps/backend/src/modules/core/billing/dto/checkout-session.dto.ts
export interface CheckoutSessionDto {
  checkoutUrl: string;
  sessionId: string;
}
```

- [ ] **Step 2: Testes**

```typescript
describe('createCheckoutSessionForCard', () => {
  beforeEach(() => {
    mockConfig.get.mockImplementation((k: string, d?: string) => {
      const map: Record<string, string> = {
        ASAAS_API_KEY: 'real',
        ASAAS_PLAN_VALUE: '89.90',
        ASAAS_CHECKOUT_SUCCESS_URL: 'https://app/success',
        ASAAS_CHECKOUT_CANCEL_URL: 'https://app/cancel',
        ASAAS_CHECKOUT_EXPIRED_URL: 'https://app/expired',
        ASAAS_CHECKOUT_EXPIRE_MINUTES: '30',
      };
      return map[k] ?? d;
    });
  });

  it('uses trialEndsAt as nextDueDate when tenant in TRIAL', async () => {
    const trialEnd = new Date('2026-06-04');
    mockTenancyService.findById.mockResolvedValue({
      id: 't1', status: 'TRIAL', trialEndsAt: trialEnd, cnpj: '12345678901234',
      nomeFantasia: 'Foo', razaoSocial: 'Foo Ltda',
    });
    const userMail = 'a@b.com';
    mockBillingRepo.findOne.mockResolvedValue({ asaasCustomerId: 'cus_1' });
    const postSpy = jest.spyOn(asaasClient, 'post')
      .mockResolvedValue({ id: 'chk_1', link: 'https://asaas/checkout/1' });

    await service.createCheckoutSessionForCard('t1', userMail);

    expect(postSpy).toHaveBeenCalledWith('/checkouts', expect.objectContaining({
      billingTypes: ['CREDIT_CARD'],
      chargeTypes: ['RECURRENT'],
      subscription: expect.objectContaining({ nextDueDate: '2026-06-04' }),
      externalReference: 'tenant_t1',
    }));
  });

  it('uses today+30 as nextDueDate when tenant ACTIVE', async () => {
    mockTenancyService.findById.mockResolvedValue({
      id: 't1', status: 'ACTIVE', trialEndsAt: null, cnpj: '12345678901234',
      nomeFantasia: 'Foo', razaoSocial: 'Foo Ltda',
    });
    mockBillingRepo.findOne.mockResolvedValue({ asaasCustomerId: 'cus_1' });
    const postSpy = jest.spyOn(asaasClient, 'post')
      .mockResolvedValue({ id: 'chk_1', link: 'https://asaas/2' });

    await service.createCheckoutSessionForCard('t1', 'a@b.com');

    const call = postSpy.mock.calls[0][1] as any;
    const expected = new Date();
    expected.setDate(expected.getDate() + 30);
    expect(call.subscription.nextDueDate).toBe(expected.toISOString().split('T')[0]);
  });

  it('returns mock URL in mock mode', async () => {
    mockConfig.get.mockImplementation((k: string) => k === 'ASAAS_API_KEY' ? 'mock' : '');
    // re-instanciar service em modo mock
    mockTenancyService.findById.mockResolvedValue({
      id: 't1', status: 'TRIAL', trialEndsAt: new Date(), cnpj: '12345678901234',
      nomeFantasia: 'Foo', razaoSocial: 'Foo Ltda',
    });

    const result = await service.createCheckoutSessionForCard('t1', 'a@b.com');
    expect(result.checkoutUrl).toMatch(/mock-checkout/);
    expect(result.sessionId).toMatch(/^mock_chk_/);
  });
});

describe('createCheckoutSessionForInvoice', () => {
  it('calls checkoutPayment endpoint for given invoice', async () => {
    mockInvoiceRepo.findOne.mockResolvedValue({
      id: 'inv1', asaasPaymentId: 'pay_1', tenantId: 't1',
    });
    const postSpy = jest.spyOn(asaasClient, 'post')
      .mockResolvedValue({ link: 'https://asaas/inv-pay/1' });

    const result = await service.createCheckoutSessionForInvoice('t1', 'inv1');

    expect(postSpy).toHaveBeenCalledWith('/payments/pay_1/checkoutPayment', {});
    expect(result.checkoutUrl).toBe('https://asaas/inv-pay/1');
  });

  it('throws if invoice belongs to another tenant', async () => {
    mockInvoiceRepo.findOne.mockResolvedValue({
      id: 'inv1', asaasPaymentId: 'pay_1', tenantId: 'OTHER',
    });
    await expect(service.createCheckoutSessionForInvoice('t1', 'inv1'))
      .rejects.toThrow(/not found/i);
  });
});
```

- [ ] **Step 3: Falhar**

Run: `pnpm --filter backend test -- billing.service.spec`
Expected: 5 testes novos falham.

- [ ] **Step 4: Implementar**

Adicionar em `billing.service.ts`:

```typescript
async createCheckoutSessionForCard(
  tenantId: string,
  email: string,
): Promise<CheckoutSessionDto> {
  const tenant = await this.tenancyService.findById(tenantId);
  if (!tenant) throw new NotFoundException('Tenant not found');
  const billing = await this.billingRepo.findOne({ where: { tenantId } });
  if (!billing?.asaasCustomerId) {
    throw new BadRequestException('Tenant has no Asaas customer');
  }

  if (this.isMock) {
    return {
      checkoutUrl: `https://mock-checkout.local/${tenantId}`,
      sessionId: `mock_chk_${tenantId}_${Date.now()}`,
    };
  }

  const planValue = parseFloat(this.config.get<string>('ASAAS_PLAN_VALUE', '89.90'));
  const expireMinutes = parseInt(
    this.config.get<string>('ASAAS_CHECKOUT_EXPIRE_MINUTES', '30'),
    10,
  );

  let nextDueDate: string;
  if (tenant.status === TenantStatus.TRIAL && tenant.trialEndsAt) {
    nextDueDate = tenant.trialEndsAt.toISOString().split('T')[0];
  } else {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    nextDueDate = d.toISOString().split('T')[0];
  }

  const res = await this.asaas.post<{ id: string; link: string }>('/checkouts', {
    billingTypes: ['CREDIT_CARD'],
    chargeTypes: ['RECURRENT'],
    minutesToExpire: expireMinutes,
    callback: {
      successUrl: this.config.get<string>('ASAAS_CHECKOUT_SUCCESS_URL'),
      cancelUrl: this.config.get<string>('ASAAS_CHECKOUT_CANCEL_URL'),
      expiredUrl: this.config.get<string>('ASAAS_CHECKOUT_EXPIRED_URL'),
    },
    items: [{ name: 'Plano Praktikus', value: planValue, quantity: 1 }],
    customerData: {
      name: tenant.nomeFantasia,
      email,
      cpfCnpj: tenant.cnpj,
    },
    subscription: {
      cycle: 'MONTHLY',
      nextDueDate,
    },
    externalReference: `tenant_${tenantId}`,
  });

  return { checkoutUrl: res.link, sessionId: res.id };
}

async createCheckoutSessionForInvoice(
  tenantId: string,
  invoiceId: string,
): Promise<CheckoutSessionDto> {
  const invoice = await this.invoiceRepo.findOne({ where: { id: invoiceId } });
  if (!invoice || invoice.tenantId !== tenantId) {
    throw new NotFoundException('Invoice not found');
  }

  if (this.isMock) {
    return {
      checkoutUrl: `https://mock-checkout.local/inv/${invoiceId}`,
      sessionId: `mock_chk_inv_${invoiceId}`,
    };
  }

  const res = await this.asaas.post<{ link: string }>(
    `/payments/${invoice.asaasPaymentId}/checkoutPayment`,
    {},
  );
  return { checkoutUrl: res.link, sessionId: invoice.asaasPaymentId };
}
```

(Imports adicionais: `BadRequestException` de `@nestjs/common`, `TenantStatus` de `tenant.entity`, `CheckoutSessionDto`.)

- [ ] **Step 5: Rodar testes**

Run: `pnpm --filter backend test -- billing.service.spec`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/modules/core/billing/
git commit -m "feat(billing): add Asaas Checkout session creation (recurring card + single invoice)"
```

---

## Task 8: Mutations — removeCard, cancelSubscription, reactivateSubscription, sync helpers

**Files:**
- Modify: `apps/backend/src/modules/core/billing/billing.service.ts`
- Modify: `apps/backend/src/modules/core/billing/billing.service.spec.ts`

- [ ] **Step 1: Testes**

```typescript
describe('removeCard', () => {
  it('PATCHes Asaas subscription to PIX and clears card fields', async () => {
    mockBillingRepo.findOne.mockResolvedValue({
      tenantId: 't1', asaasSubscriptionId: 'sub_1',
      cardLast4: '1234', cardBrand: 'VISA', cardExpiry: '12/29',
      billingType: 'CREDIT_CARD',
    });
    const patchSpy = jest.spyOn(asaasClient, 'patch').mockResolvedValue({});
    mockBillingRepo.save.mockImplementation((x: any) => x);

    await service.removeCard('t1');

    expect(patchSpy).toHaveBeenCalledWith('/subscriptions/sub_1', { billingType: 'UNDEFINED' });
    expect(mockBillingRepo.save).toHaveBeenCalledWith(expect.objectContaining({
      cardLast4: null, cardBrand: null, cardExpiry: null,
      billingType: 'PIX',
    }));
  });
});

describe('cancelSubscription', () => {
  it('POSTs cancel and sets canceledAt', async () => {
    mockBillingRepo.findOne.mockResolvedValue({
      tenantId: 't1', asaasSubscriptionId: 'sub_1', canceledAt: null,
    });
    const postSpy = jest.spyOn(asaasClient, 'post').mockResolvedValue({});
    mockBillingRepo.save.mockImplementation((x: any) => x);

    await service.cancelSubscription('t1');

    expect(postSpy).toHaveBeenCalledWith('/subscriptions/sub_1/cancel', {});
    expect(mockBillingRepo.save).toHaveBeenCalledWith(expect.objectContaining({
      canceledAt: expect.any(Date),
    }));
  });

  it('throws if already canceled', async () => {
    mockBillingRepo.findOne.mockResolvedValue({
      tenantId: 't1', canceledAt: new Date(),
    });
    await expect(service.cancelSubscription('t1')).rejects.toThrow(/already canceled/i);
  });
});

describe('syncInvoiceFromWebhook', () => {
  it('upserts invoice on PAYMENT_CREATED', async () => {
    mockInvoiceRepo.findOne.mockResolvedValue(null);
    mockInvoiceRepo.create.mockImplementation((x: any) => x);
    mockInvoiceRepo.save.mockImplementation((x: any) => x);

    await service.syncInvoiceFromWebhook({
      event: 'PAYMENT_CREATED',
      payment: {
        id: 'pay_1', subscription: 'sub_1', value: 89.90,
        dueDate: '2026-06-15', status: 'PENDING', billingType: 'PIX',
      },
    });

    expect(mockInvoiceRepo.save).toHaveBeenCalledWith(expect.objectContaining({
      asaasPaymentId: 'pay_1',
      value: '89.90',
      status: 'PENDING',
      billingType: 'PIX',
    }));
  });

  it('updates existing invoice on PAYMENT_CONFIRMED', async () => {
    const existing = {
      id: 'inv1', asaasPaymentId: 'pay_1', status: 'PENDING',
      tenantId: 't1', value: '89.90', dueDate: new Date(),
      billingType: 'PIX',
    };
    mockInvoiceRepo.findOne.mockResolvedValue(existing);
    mockInvoiceRepo.save.mockImplementation((x: any) => x);

    await service.syncInvoiceFromWebhook({
      event: 'PAYMENT_CONFIRMED',
      payment: { id: 'pay_1', status: 'CONFIRMED', confirmedDate: '2026-06-15' },
    });

    expect(mockInvoiceRepo.save).toHaveBeenCalledWith(expect.objectContaining({
      status: 'CONFIRMED',
      paidAt: expect.any(Date),
    }));
  });
});

describe('syncCardFromWebhook', () => {
  it('persists card details when CHECKOUT_PAID with creditCard', async () => {
    mockBillingRepo.findOne.mockResolvedValue({ tenantId: 't1', asaasSubscriptionId: 'old_sub' });
    mockBillingRepo.save.mockImplementation((x: any) => x);
    jest.spyOn(asaasClient, 'post').mockResolvedValue({}); // cancel old sub

    await service.syncCardFromWebhook({
      event: 'CHECKOUT_PAID',
      checkout: {
        externalReference: 'tenant_t1',
        subscription: { id: 'new_sub' },
        creditCard: {
          creditCardNumber: '1234', creditCardBrand: 'VISA',
          expirationDate: '12/29',
        },
      },
    });

    expect(mockBillingRepo.save).toHaveBeenCalledWith(expect.objectContaining({
      asaasSubscriptionId: 'new_sub',
      cardLast4: '1234', cardBrand: 'VISA', cardExpiry: '12/29',
      billingType: 'CREDIT_CARD',
    }));
  });
});
```

- [ ] **Step 2: Falhar**

Run: `pnpm --filter backend test -- billing.service.spec`
Expected: testes falham.

- [ ] **Step 3: Implementar**

Adicionar em `billing.service.ts`:

```typescript
async removeCard(tenantId: string): Promise<void> {
  const billing = await this.billingRepo.findOne({ where: { tenantId } });
  if (!billing?.asaasSubscriptionId) {
    throw new NotFoundException('Billing not found');
  }
  if (!this.isMock) {
    await this.asaas.patch(`/subscriptions/${billing.asaasSubscriptionId}`, {
      billingType: 'PIX',
    });
  }
  billing.cardLast4 = null;
  billing.cardBrand = null;
  billing.cardExpiry = null;
  billing.billingType = 'PIX';
  await this.billingRepo.save(billing);
}

async cancelSubscription(tenantId: string): Promise<void> {
  const billing = await this.billingRepo.findOne({ where: { tenantId } });
  if (!billing) throw new NotFoundException('Billing not found');
  if (billing.canceledAt) {
    throw new BadRequestException('Subscription already canceled');
  }
  if (!this.isMock && billing.asaasSubscriptionId) {
    await this.asaas.post(`/subscriptions/${billing.asaasSubscriptionId}/cancel`, {});
  }
  billing.canceledAt = new Date();
  await this.billingRepo.save(billing);
}

async reactivateSubscription(tenantId: string, email: string): Promise<CheckoutSessionDto> {
  const billing = await this.billingRepo.findOne({ where: { tenantId } });
  if (!billing) throw new NotFoundException('Billing not found');
  if (!billing.canceledAt) {
    throw new BadRequestException('Subscription not canceled');
  }
  // Cliente cria nova subscription via Checkout (mesmo fluxo do cadastro de cartão).
  billing.canceledAt = null;
  await this.billingRepo.save(billing);
  return this.createCheckoutSessionForCard(tenantId, email);
}

async syncInvoiceFromWebhook(payload: any): Promise<void> {
  const event = payload.event as string;
  const payment = payload.payment;
  if (!payment?.id) return;

  const subscriptionId =
    payment.subscription ?? payload.subscription?.id ?? null;

  let tenantId: string | null = null;
  if (subscriptionId) {
    tenantId = await this.findTenantIdBySubscriptionId(subscriptionId);
  }
  if (!tenantId) {
    this.logger.warn(`Webhook ${event} for payment ${payment.id} without resolvable tenant`);
    return;
  }

  let invoice = await this.invoiceRepo.findOne({
    where: { asaasPaymentId: payment.id },
  });

  const newStatus = this.mapPaymentStatus(event, payment.status);

  if (!invoice) {
    invoice = this.invoiceRepo.create({
      tenantId,
      asaasPaymentId: payment.id,
      value: String(payment.value ?? 0),
      dueDate: new Date(payment.dueDate),
      status: newStatus,
      billingType: (payment.billingType ?? 'UNDEFINED') as BillingType,
    });
  } else {
    invoice.status = newStatus;
  }

  if (event === 'PAYMENT_CONFIRMED' || event === 'PAYMENT_RECEIVED') {
    invoice.paidAt = payment.confirmedDate
      ? new Date(payment.confirmedDate)
      : new Date();
  }

  await this.invoiceRepo.save(invoice);
}

async syncCardFromWebhook(payload: any): Promise<void> {
  const externalRef: string | undefined =
    payload.checkout?.externalReference ?? payload.payment?.externalReference;
  const tenantId = externalRef?.replace(/^tenant_/, '');
  if (!tenantId) {
    this.logger.warn('CHECKOUT_PAID without externalReference; ignoring');
    return;
  }
  const billing = await this.billingRepo.findOne({ where: { tenantId } });
  if (!billing) return;

  const newSubId = payload.checkout?.subscription?.id;
  const card = payload.checkout?.creditCard ?? payload.payment?.creditCard;

  if (newSubId && billing.asaasSubscriptionId && newSubId !== billing.asaasSubscriptionId) {
    if (!this.isMock) {
      try {
        await this.asaas.post(`/subscriptions/${billing.asaasSubscriptionId}/cancel`, {});
      } catch (err) {
        this.logger.error(`Failed to cancel old sub ${billing.asaasSubscriptionId}: ${(err as Error).message}`);
      }
    }
    billing.asaasSubscriptionId = newSubId;
  }

  if (card) {
    billing.cardLast4 = card.creditCardNumber ?? null;
    billing.cardBrand = card.creditCardBrand ?? null;
    billing.cardExpiry = card.expirationDate ?? null;
    billing.billingType = 'CREDIT_CARD';
  }

  await this.billingRepo.save(billing);
}

private mapPaymentStatus(event: string, _paymentStatus?: string): InvoiceStatus {
  switch (event) {
    case 'PAYMENT_CONFIRMED':
    case 'PAYMENT_RECEIVED':
      return InvoiceStatus.CONFIRMED;
    case 'PAYMENT_OVERDUE':
      return InvoiceStatus.OVERDUE;
    case 'PAYMENT_REFUNDED':
      return InvoiceStatus.REFUNDED;
    case 'PAYMENT_DELETED':
      return InvoiceStatus.DELETED;
    case 'PAYMENT_CREATED':
    default:
      return InvoiceStatus.PENDING;
  }
}
```

- [ ] **Step 4: Rodar testes**

Run: `pnpm --filter backend test -- billing.service.spec`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/core/billing/
git commit -m "feat(billing): add removeCard/cancel/reactivate + webhook sync helpers"
```

---

## Task 9: Webhook expandido (8 eventos) + endpoints REST

**Files:**
- Modify: `apps/backend/src/modules/core/billing/billing.controller.ts`
- Modify: `apps/backend/src/modules/core/billing/billing.controller.spec.ts`

- [ ] **Step 1: Atualizar webhook handler — testes**

Em `billing.controller.spec.ts`, adicionar testes para os 4 novos eventos:

```typescript
it('handles PAYMENT_CREATED — calls syncInvoiceFromWebhook and not updateStatus', async () => {
  const body = {
    event: 'PAYMENT_CREATED',
    payment: { id: 'pay_1', subscription: 'sub_1', value: 89.90, dueDate: '2026-06-15', status: 'PENDING', billingType: 'PIX' },
  };
  const raw = JSON.stringify(body);
  await controller.webhook(makeSignature(raw, 'WEBHOOK_TOKEN'), body, makeRawReq(raw));
  expect(mockBillingService.syncInvoiceFromWebhook).toHaveBeenCalledWith(body);
  expect(mockTenancyService.updateStatus).not.toHaveBeenCalled();
});

it('handles PAYMENT_REFUNDED — invoice synced and tenant goes OVERDUE', async () => {
  mockBillingService.findTenantIdBySubscriptionId.mockResolvedValue('t1');
  const body = {
    event: 'PAYMENT_REFUNDED',
    payment: { id: 'pay_1', subscription: 'sub_1', status: 'REFUNDED' },
  };
  const raw = JSON.stringify(body);
  await controller.webhook(makeSignature(raw, 'WEBHOOK_TOKEN'), body, makeRawReq(raw));
  expect(mockBillingService.syncInvoiceFromWebhook).toHaveBeenCalled();
  expect(mockTenancyService.updateStatus).toHaveBeenCalledWith('t1', 'OVERDUE');
});

it('handles CHECKOUT_PAID — syncs card', async () => {
  const body = {
    event: 'CHECKOUT_PAID',
    checkout: {
      externalReference: 'tenant_t1',
      subscription: { id: 'sub_new' },
      creditCard: { creditCardNumber: '1234', creditCardBrand: 'VISA', expirationDate: '12/29' },
    },
  };
  const raw = JSON.stringify(body);
  await controller.webhook(makeSignature(raw, 'WEBHOOK_TOKEN'), body, makeRawReq(raw));
  expect(mockBillingService.syncCardFromWebhook).toHaveBeenCalledWith(body);
});

it('handles CHECKOUT_EXPIRED — only logs, no state change', async () => {
  const body = { event: 'CHECKOUT_EXPIRED', checkout: { id: 'chk_1' } };
  const raw = JSON.stringify(body);
  await controller.webhook(makeSignature(raw, 'WEBHOOK_TOKEN'), body, makeRawReq(raw));
  expect(mockBillingService.syncInvoiceFromWebhook).not.toHaveBeenCalled();
  expect(mockTenancyService.updateStatus).not.toHaveBeenCalled();
});

it('triggers reactivation email when PAYMENT_CONFIRMED for SUSPENDED tenant', async () => {
  mockBillingService.findTenantIdBySubscriptionId.mockResolvedValue('t1');
  mockTenancyService.findById.mockResolvedValue({ id: 't1', status: 'SUSPENDED' });
  // assume userService is mocked to return { email, nomeFantasia }
  const body = { event: 'PAYMENT_CONFIRMED', payment: { id: 'pay_1', subscription: 'sub_1' } };
  const raw = JSON.stringify(body);
  await controller.webhook(makeSignature(raw, 'WEBHOOK_TOKEN'), body, makeRawReq(raw));
  expect(mockMailService.sendAccountReactivated).toHaveBeenCalled();
});
```

(Adicione `mockMailService` aos providers; mock `findById`/`findOwnerByTenantId`.)

- [ ] **Step 2: Falhar**

Run: `pnpm --filter backend test -- billing.controller.spec`
Expected: novos testes falham.

- [ ] **Step 3: Reescrever webhook handler**

```typescript
@Post('webhook')
@HttpCode(204)
async webhook(
  @Headers('asaas-signature') signature: string | undefined,
  @Body() payload: any,
  @Req() req: RawBodyRequest<Request>,
): Promise<void> {
  const secret = this.configService.get<string>('ASAAS_WEBHOOK_TOKEN');
  if (!secret || !signature || !req.rawBody) {
    throw new ForbiddenException('Invalid webhook signature');
  }
  const expected = crypto.createHmac('sha256', secret).update(req.rawBody).digest('hex');
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    throw new ForbiddenException('Invalid webhook signature');
  }

  const event: string = payload?.event ?? '';

  // Eventos relacionados a invoice (sync local table)
  const invoiceEvents = new Set([
    'PAYMENT_CREATED', 'PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED',
    'PAYMENT_OVERDUE', 'PAYMENT_REFUNDED', 'PAYMENT_DELETED',
  ]);
  if (invoiceEvents.has(event)) {
    await this.billingService.syncInvoiceFromWebhook(payload);
  }

  // Eventos que atualizam tenant_status
  const statusMap: Record<string, TenantStatus> = {
    PAYMENT_RECEIVED: TenantStatus.ACTIVE,
    PAYMENT_CONFIRMED: TenantStatus.ACTIVE,
    PAYMENT_OVERDUE: TenantStatus.OVERDUE,
    PAYMENT_REFUNDED: TenantStatus.OVERDUE,
    SUBSCRIPTION_INACTIVATED: TenantStatus.SUSPENDED,
  };
  const targetStatus = statusMap[event];
  if (targetStatus) {
    const subscriptionId =
      payload?.payment?.subscription ?? payload?.subscription?.id ?? null;
    if (subscriptionId) {
      const tenantId = await this.billingService.findTenantIdBySubscriptionId(subscriptionId);
      if (tenantId) {
        const tenantBefore = await this.tenancyService.findById(tenantId);
        await this.tenancyService.updateStatus(tenantId, targetStatus);

        // Email de reativação se tenant saiu de SUSPENDED/OVERDUE → ACTIVE
        if (
          targetStatus === TenantStatus.ACTIVE &&
          tenantBefore &&
          (tenantBefore.status === TenantStatus.SUSPENDED ||
            tenantBefore.status === TenantStatus.OVERDUE)
        ) {
          const owner = await this.tenancyService.findOwnerByTenantId(tenantId);
          if (owner) {
            await this.mailService.sendAccountReactivated(owner.email, owner.name);
          }
        }
      }
    }
  }

  // Checkout
  if (event === 'CHECKOUT_PAID') {
    await this.billingService.syncCardFromWebhook(payload);
  }
  if (event === 'CHECKOUT_EXPIRED') {
    this.logger.log(`CHECKOUT_EXPIRED: ${JSON.stringify(payload?.checkout?.id ?? '?')}`);
  }
}
```

(Imports adicionais: `MailService` no constructor; injetar.)

Adicionar `findOwnerByTenantId` em `TenancyService` se não existir (retorna `UserEntity` com role OWNER).

- [ ] **Step 4: Adicionar endpoints REST**

Em `billing.controller.ts`, adicionar antes de `webhook`:

```typescript
@Get()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.OWNER)
async getCurrent(@Req() req: any): Promise<BillingSummaryDto> {
  return this.billingService.getCurrentBilling(req.user.tenantId);
}

@Get('invoices')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.OWNER)
async listInvoices(@Req() req: any): Promise<OpenInvoiceDto[]> {
  return this.billingService.listPaidInvoices(req.user.tenantId);
}

@Get('invoices/open')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.OWNER)
async openInvoice(@Req() req: any): Promise<OpenInvoiceDto | null> {
  return this.billingService.getOpenInvoice(req.user.tenantId);
}

@Post('invoices/:id/pix')
@HttpCode(200)
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.OWNER)
async regeneratePix(
  @Param('id') invoiceId: string,
  @Req() req: any,
): Promise<{ qrCodeBase64: string; copyPaste: string }> {
  return this.billingService.generatePixForInvoice(invoiceId, req.user.tenantId);
}

@Post('checkout-session')
@HttpCode(200)
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.OWNER)
async checkoutCard(@Req() req: any): Promise<CheckoutSessionDto> {
  return this.billingService.createCheckoutSessionForCard(
    req.user.tenantId,
    req.user.email,
  );
}

@Post('invoices/:id/checkout')
@HttpCode(200)
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.OWNER)
async checkoutInvoice(
  @Param('id') invoiceId: string,
  @Req() req: any,
): Promise<CheckoutSessionDto> {
  return this.billingService.createCheckoutSessionForInvoice(
    req.user.tenantId,
    invoiceId,
  );
}

@Delete('card')
@HttpCode(204)
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.OWNER)
async removeCard(@Req() req: any): Promise<void> {
  await this.billingService.removeCard(req.user.tenantId);
}

@Post('cancel')
@HttpCode(204)
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.OWNER)
async cancel(@Req() req: any): Promise<void> {
  await this.billingService.cancelSubscription(req.user.tenantId);
}

@Post('reactivate')
@HttpCode(200)
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.OWNER)
async reactivate(@Req() req: any): Promise<CheckoutSessionDto> {
  return this.billingService.reactivateSubscription(
    req.user.tenantId,
    req.user.email,
  );
}
```

(Imports adicionais: `Get`, `Param`, `Delete`, `UseGuards` do @nestjs/common; `JwtAuthGuard`, `RolesGuard`, `Roles`, `Role` dos paths existentes.)

- [ ] **Step 5: Adicionar testes dos endpoints**

```typescript
describe('GET /billing', () => {
  it('returns billing summary for tenant', async () => {
    mockBillingService.getCurrentBilling.mockResolvedValue({
      status: 'TRIAL', planName: 'X', planValue: 89.90, billingType: null,
      card: null, nextDueDate: null, trialEndsAt: '2026-06-04', daysUntilTrialEnds: 7, canceledAt: null,
    });
    const result = await controller.getCurrent({ user: { tenantId: 't1' } } as any);
    expect(result.daysUntilTrialEnds).toBe(7);
  });
});
```

(Repetir o padrão para cada endpoint novo, com 1-2 testes mínimos cada.)

- [ ] **Step 6: Rodar testes**

Run: `pnpm --filter backend test -- billing.controller.spec`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/backend/src/modules/core/billing/
git commit -m "feat(billing): expand webhook to 8 events and add 9 self-service REST endpoints"
```

---

## Task 10: Cron jobs — sendTrialReminders + transitionOverdueToSuspended

**Files:**
- Modify: `apps/backend/src/modules/core/billing/billing.service.ts`
- Modify: `apps/backend/src/modules/core/billing/billing.service.spec.ts`
- Modify: `apps/backend/src/app.module.ts` (se `ScheduleModule.forRoot()` ainda não estiver registrado, adicionar)

- [ ] **Step 1: Verificar se ScheduleModule já está registrado**

Run: `grep -n "ScheduleModule" /home/vinicius/Projetos/vinicius/praktikus/apps/backend/src/app.module.ts`
Se ausente, adicionar `ScheduleModule.forRoot()` aos imports do AppModule.

- [ ] **Step 2: Testes**

```typescript
describe('sendTrialReminders', () => {
  it('emails tenant whose trialEndsAt is in 7 days', async () => {
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 7);
    trialEnd.setHours(12, 0, 0, 0);
    mockTenancyService.listAll = jest.fn().mockResolvedValue([
      { id: 't1', status: 'TRIAL', trialEndsAt: trialEnd },
    ]);
    mockTenancyService.findOwnerByTenantId = jest.fn().mockResolvedValue({
      email: 'a@b.com', name: 'Foo',
    });

    await service.sendTrialReminders();

    expect(mockMailService.sendTrialExpiringWarning).toHaveBeenCalledWith(
      'a@b.com', 'Foo', 7, expect.any(String),
    );
  });

  it('emails tenant whose trial ends tomorrow', async () => {
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 1);
    mockTenancyService.listAll = jest.fn().mockResolvedValue([
      { id: 't1', status: 'TRIAL', trialEndsAt: trialEnd },
    ]);
    mockTenancyService.findOwnerByTenantId = jest.fn().mockResolvedValue({
      email: 'a@b.com', name: 'Foo',
    });

    await service.sendTrialReminders();

    expect(mockMailService.sendTrialExpiringTomorrow).toHaveBeenCalled();
  });
});

describe('transitionOverdueToSuspended', () => {
  it('moves tenants overdue > graceDays to SUSPENDED', async () => {
    const overdueAt = new Date();
    overdueAt.setDate(overdueAt.getDate() - 6); // 6 dias atrás, grace=5
    mockTenancyService.listAll = jest.fn().mockResolvedValue([
      { id: 't1', status: 'OVERDUE', updatedAt: overdueAt },
    ]);
    mockTenancyService.findOwnerByTenantId = jest.fn().mockResolvedValue({
      email: 'a@b.com', name: 'Foo',
    });
    mockConfig.get.mockImplementation((k: string, d?: string) =>
      k === 'PRAKTIKUS_GRACE_PERIOD_DAYS' ? '5' : d);

    await service.transitionOverdueToSuspended();

    expect(mockTenancyService.updateStatus).toHaveBeenCalledWith('t1', 'SUSPENDED');
    expect(mockMailService.sendAccountSuspended).toHaveBeenCalled();
  });

  it('does not transition tenants still inside grace period', async () => {
    const overdueAt = new Date();
    overdueAt.setDate(overdueAt.getDate() - 3);
    mockTenancyService.listAll = jest.fn().mockResolvedValue([
      { id: 't1', status: 'OVERDUE', updatedAt: overdueAt },
    ]);
    mockConfig.get.mockImplementation((k: string, d?: string) =>
      k === 'PRAKTIKUS_GRACE_PERIOD_DAYS' ? '5' : d);

    await service.transitionOverdueToSuspended();
    expect(mockTenancyService.updateStatus).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Falhar**

Run: `pnpm --filter backend test -- billing.service.spec`
Expected: 4 testes novos falham.

- [ ] **Step 4: Implementar**

Em `billing.service.ts`:

```typescript
@Cron('0 9 * * *')
async sendTrialReminders(): Promise<void> {
  const tenants = await this.tenancyService.listAll();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const tenant of tenants) {
    if (tenant.status !== TenantStatus.TRIAL || !tenant.trialEndsAt) continue;
    const end = new Date(tenant.trialEndsAt);
    end.setHours(0, 0, 0, 0);
    const daysLeft = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    const owner = await this.tenancyService.findOwnerByTenantId(tenant.id);
    if (!owner) continue;
    const paymentUrl =
      this.config.get<string>('FRONTEND_URL', 'https://app.praktikus.com.br') +
      '/workshop/settings';

    if (daysLeft === 7) {
      await this.mailService.sendTrialExpiringWarning(owner.email, owner.name, 7, paymentUrl);
    } else if (daysLeft === 1) {
      await this.mailService.sendTrialExpiringTomorrow(owner.email, owner.name, paymentUrl);
    }
  }
}

@Cron('0 10 * * *')
async transitionOverdueToSuspended(): Promise<void> {
  const graceDays = parseInt(
    this.config.get<string>('PRAKTIKUS_GRACE_PERIOD_DAYS', '5'),
    10,
  );
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - graceDays);

  const tenants = await this.tenancyService.listAll();
  for (const tenant of tenants) {
    if (tenant.status !== TenantStatus.OVERDUE) continue;
    if (!tenant.updatedAt || tenant.updatedAt > cutoff) continue;

    await this.tenancyService.updateStatus(tenant.id, TenantStatus.SUSPENDED);
    const owner = await this.tenancyService.findOwnerByTenantId(tenant.id);
    if (owner) {
      const paymentUrl =
        this.config.get<string>('FRONTEND_URL', 'https://app.praktikus.com.br') +
        '/workshop/settings';
      await this.mailService.sendAccountSuspended(owner.email, owner.name, paymentUrl);
    }
  }
}
```

- [ ] **Step 5: Adicionar `listAll` em TenancyService**

```typescript
// tenancy.service.ts
async listAll(): Promise<TenantEntity[]> {
  return this.tenantRepo.find();
}
```

- [ ] **Step 6: Rodar testes**

Run: `pnpm --filter backend test -- billing.service.spec`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/backend/src/modules/core/
git commit -m "feat(billing): add trial reminders and overdue→suspended cron jobs"
```

---

## Task 11: TenantStatusGuard — whitelist /billing/* + /auth/*

**Files:**
- Modify: `apps/backend/src/modules/core/auth/tenant-status.guard.ts`
- Modify: `apps/backend/src/modules/core/auth/tenant-status.guard.spec.ts`

- [ ] **Step 1: Testes**

Em `tenant-status.guard.spec.ts`, adicionar:

```typescript
function makeCtxWithUrl(user: any, url: string) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user, url }),
    }),
  } as any;
}

it('lets SUSPENDED tenant access /billing endpoints', () => {
  expect(
    guard.canActivate(makeCtxWithUrl({ tenantStatus: 'SUSPENDED' }, '/billing')),
  ).toBe(true);
  expect(
    guard.canActivate(makeCtxWithUrl({ tenantStatus: 'SUSPENDED' }, '/billing/invoices/open')),
  ).toBe(true);
});

it('lets SUSPENDED tenant access /auth endpoints', () => {
  expect(
    guard.canActivate(makeCtxWithUrl({ tenantStatus: 'SUSPENDED' }, '/auth/refresh')),
  ).toBe(true);
});

it('blocks SUSPENDED tenant on other paths', () => {
  expect(() =>
    guard.canActivate(makeCtxWithUrl({ tenantStatus: 'SUSPENDED' }, '/orders')),
  ).toThrow(/conta_suspensa/);
});
```

- [ ] **Step 2: Falhar**

Run: `pnpm --filter backend test -- tenant-status.guard.spec`
Expected: novos testes falham.

- [ ] **Step 3: Implementar whitelist**

```typescript
// tenant-status.guard.ts
import {
  CanActivate, ExecutionContext, ForbiddenException, Injectable,
} from '@nestjs/common';
import { TenantStatus } from '../tenancy/tenant.entity';

const ALLOWED_PREFIXES = ['/billing', '/auth'];

@Injectable()
export class TenantStatusGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const url: string = request.url ?? '';

    if (!user) return true;
    if (ALLOWED_PREFIXES.some((p) => url.startsWith(p))) return true;
    if (user.tenantStatus === TenantStatus.SUSPENDED) {
      throw new ForbiddenException('conta_suspensa');
    }
    return true;
  }
}
```

- [ ] **Step 4: Rodar testes**

Run: `pnpm --filter backend test -- tenant-status.guard.spec`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/core/auth/
git commit -m "feat(auth): whitelist /billing/* and /auth/* in TenantStatusGuard"
```

---

## Task 12: 4 templates novos no MailService

**Files:**
- Modify: `apps/backend/src/modules/core/mail/mail.service.ts`
- Modify: `apps/backend/src/modules/core/mail/mail.service.spec.ts`

> **Nota:** `sendAccountReactivated` foi adicionado na Task 9 quando o webhook handler precisou — pular nesta task.

- [ ] **Step 1: Testes**

Em `mail.service.spec.ts`, adicionar:

```typescript
describe('billing emails', () => {
  beforeEach(() => {
    process.env.RESEND_API_KEY = 'real_key';
  });

  it('sendTrialExpiringWarning sends email with daysLeft and CTA', async () => {
    const sendSpy = jest.fn().mockResolvedValue({ data: {}, error: null });
    (service as any).resend = { emails: { send: sendSpy } };
    await service.sendTrialExpiringWarning('a@b.com', 'Foo', 7, 'https://app/x');
    const args = sendSpy.mock.calls[0][0];
    expect(args.to).toBe('a@b.com');
    expect(args.subject).toMatch(/7 dias/);
    expect(args.html).toContain('https://app/x');
  });

  it('sendAccountSuspended sends email', async () => {
    const sendSpy = jest.fn().mockResolvedValue({ data: {}, error: null });
    (service as any).resend = { emails: { send: sendSpy } };
    await service.sendAccountSuspended('a@b.com', 'Foo', 'https://app/x');
    expect(sendSpy).toHaveBeenCalled();
  });

  it('sendPaymentRefundIssue and sendTrialExpiringTomorrow are wired', async () => {
    const sendSpy = jest.fn().mockResolvedValue({ data: {}, error: null });
    (service as any).resend = { emails: { send: sendSpy } };
    await service.sendPaymentRefundIssue('a@b.com', 'Foo', 'https://app/x');
    await service.sendTrialExpiringTomorrow('a@b.com', 'Foo', 'https://app/x');
    expect(sendSpy).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Falhar**

Run: `pnpm --filter backend test -- mail.service.spec`
Expected: 4 testes falham.

- [ ] **Step 3: Implementar 4 métodos**

Adicionar em `mail.service.ts` antes do `escapeHtml`:

```typescript
async sendTrialExpiringWarning(
  email: string, name: string, daysLeft: number, paymentUrl: string,
): Promise<void> {
  await this.send(email, `Seu trial termina em ${daysLeft} dias — Praktikus`,
    this.billingHtml(name,
      `Seu trial termina em <strong>${daysLeft} dias</strong>.`,
      'Cadastre uma forma de pagamento para não perder acesso ao Praktikus.',
      'Cadastrar pagamento', paymentUrl,
    ),
  );
}

async sendTrialExpiringTomorrow(email: string, name: string, paymentUrl: string): Promise<void> {
  await this.send(email, 'Seu trial termina amanhã — Praktikus',
    this.billingHtml(name,
      'Seu trial termina <strong>amanhã</strong>.',
      'Cadastre uma forma de pagamento agora para evitar interrupção.',
      'Cadastrar pagamento', paymentUrl,
    ),
  );
}

async sendAccountSuspended(email: string, name: string, paymentUrl: string): Promise<void> {
  await this.send(email, 'Sua conta foi suspensa — Praktikus',
    this.billingHtml(name,
      'Sua conta foi suspensa por inadimplência.',
      'Pague a fatura em aberto para reativar imediatamente seu acesso.',
      'Ver fatura e pagar', paymentUrl,
    ),
  );
}

async sendPaymentRefundIssue(email: string, name: string, paymentUrl: string): Promise<void> {
  await this.send(email, 'Houve um problema com seu pagamento — Praktikus',
    this.billingHtml(name,
      'Identificamos um estorno na sua última cobrança.',
      'Entre em contato com seu banco e regularize o pagamento para evitar suspensão.',
      'Ver fatura', paymentUrl,
    ),
  );
}

private async send(to: string, subject: string, html: string): Promise<void> {
  if (!this.resend) {
    console.log(`[mail dev] ${subject} → ${to}`);
    return;
  }
  try {
    const { error } = await this.resend.emails.send({ from: this.from, to, subject, html });
    if (error) this.logger.warn(`Resend error sending "${subject}" to ${to}: ${error.message}`);
  } catch (err) {
    this.logger.warn(`Exception sending "${subject}" to ${to}: ${(err as Error).message}`);
  }
}

private billingHtml(
  name: string, headline: string, body: string,
  ctaLabel: string | null, ctaUrl: string | null,
): string {
  const cta = ctaLabel && ctaUrl
    ? `<p style="text-align:center; margin:28px 0;">
         <a href="${ctaUrl}" style="display:inline-block; background:#348E91; color:#fff; padding:12px 24px; border-radius:8px; text-decoration:none; font-weight:600;">${escapeHtml(ctaLabel)}</a>
       </p>`
    : '';
  return `<!DOCTYPE html>
<html lang="pt-BR">
<body style="font-family: -apple-system, system-ui, sans-serif; background:#f7f8f8; padding:32px; color:#0c1010;">
  <div style="max-width:520px; margin:0 auto; background:#fff; border-radius:12px; padding:32px; border:1px solid #e3e7e7;">
    <h1 style="margin:0 0 16px; font-size:20px; color:#0c1010;">Praktikus</h1>
    <p>Olá, ${escapeHtml(name)}.</p>
    <p>${headline}</p>
    <p style="font-size:14px; color:#5b6868;">${escapeHtml(body)}</p>
    ${cta}
  </div>
</body>
</html>`;
}
```

- [ ] **Step 4: Rodar testes**

Run: `pnpm --filter backend test -- mail.service.spec`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/core/mail/
git commit -m "feat(mail): add 5 billing lifecycle email templates"
```

---

## Task 13: .env.example + ConfigModule schema

**Files:**
- Modify: `apps/backend/.env.example`
- Modify: `apps/backend/src/config/config.module.ts` (se existir validação Joi)

- [ ] **Step 1: Atualizar .env.example**

Adicionar no final do arquivo:

```bash

# Asaas (billing)
ASAAS_API_KEY=mock
ASAAS_API_URL=https://sandbox.asaas.com/api/v3
ASAAS_PLAN_VALUE=89.90
ASAAS_WEBHOOK_TOKEN=change_me_to_32_random_chars
ASAAS_CHECKOUT_SUCCESS_URL=https://app.praktikus.com.br/workshop/settings?checkout=success
ASAAS_CHECKOUT_CANCEL_URL=https://app.praktikus.com.br/workshop/settings?checkout=cancel
ASAAS_CHECKOUT_EXPIRED_URL=https://app.praktikus.com.br/workshop/settings?checkout=expired
ASAAS_CHECKOUT_EXPIRE_MINUTES=30

# Billing flow
PRAKTIKUS_GRACE_PERIOD_DAYS=5
PRAKTIKUS_TRIAL_WARNING_DAYS=7
BILLING_PRODUCTION_ENABLED=false
FRONTEND_URL=http://localhost:5173

# Resend (já em uso para password recovery — mantém)
RESEND_API_KEY=
MAIL_FROM=Praktikus <no-reply@praktikus.com.br>
```

- [ ] **Step 2: Atualizar `.env` local com os mesmos defaults**

Execute manualmente: copie as novas linhas para `apps/backend/.env` (não commitado).

- [ ] **Step 3: Build + smoke**

Run: `pnpm --filter backend build && pnpm --filter backend start:dev` (parar com Ctrl+C após ver "Application is running")
Expected: app sobe sem erro de env. Logs mostram "AsaasClient em modo MOCK" (porque ASAAS_API_KEY=mock).

- [ ] **Step 4: Commit**

```bash
git add apps/backend/.env.example
git commit -m "chore(env): document new Asaas billing env vars"
```

---

## Task 14: Frontend — billing.service.ts + billing.store.ts

**Files:**
- Create: `apps/frontend/src/services/billing.service.ts`
- Create: `apps/frontend/src/store/billing.store.ts`

- [ ] **Step 1: billing.service.ts**

```typescript
// apps/frontend/src/services/billing.service.ts
import { api } from './api';

export interface BillingSummary {
  status: 'TRIAL' | 'ACTIVE' | 'OVERDUE' | 'SUSPENDED';
  planName: string;
  planValue: number;
  billingType: 'PIX' | 'CREDIT_CARD' | null;
  card: { last4: string; brand: string; expiry: string } | null;
  nextDueDate: string | null;
  trialEndsAt: string | null;
  daysUntilTrialEnds: number | null;
  canceledAt: string | null;
}

export interface OpenInvoice {
  id: string;
  asaasPaymentId: string;
  value: number;
  dueDate: string;
  status: 'PENDING' | 'CONFIRMED' | 'OVERDUE' | 'REFUNDED' | 'DELETED';
  billingType: 'PIX' | 'CREDIT_CARD' | 'BOLETO' | 'UNDEFINED';
  pix: { qrCodeBase64: string; copyPaste: string } | null;
}

export interface CheckoutSession {
  checkoutUrl: string;
  sessionId: string;
}

export const billingService = {
  getSummary: () => api.get<BillingSummary>('/billing').then((r) => r.data),
  getOpenInvoice: () => api.get<OpenInvoice | null>('/billing/invoices/open').then((r) => r.data),
  listInvoices: () => api.get<OpenInvoice[]>('/billing/invoices').then((r) => r.data),
  regeneratePix: (invoiceId: string) =>
    api.post<{ qrCodeBase64: string; copyPaste: string }>(`/billing/invoices/${invoiceId}/pix`)
       .then((r) => r.data),
  startCardCheckout: () =>
    api.post<CheckoutSession>('/billing/checkout-session').then((r) => r.data),
  startInvoiceCheckout: (invoiceId: string) =>
    api.post<CheckoutSession>(`/billing/invoices/${invoiceId}/checkout`).then((r) => r.data),
  removeCard: () => api.delete('/billing/card').then(() => {}),
  cancel: () => api.post('/billing/cancel').then(() => {}),
  reactivate: () => api.post<CheckoutSession>('/billing/reactivate').then((r) => r.data),
};
```

- [ ] **Step 2: billing.store.ts**

```typescript
// apps/frontend/src/store/billing.store.ts
import { create } from 'zustand';
import { billingService, type BillingSummary, type OpenInvoice } from '../services/billing.service';

interface BillingState {
  summary: BillingSummary | null;
  openInvoice: OpenInvoice | null;
  history: OpenInvoice[];
  loading: boolean;
  error: string | null;
  popupOpen: boolean;
  refresh: () => Promise<void>;
  setPopupOpen: (open: boolean) => void;
}

export const useBillingStore = create<BillingState>((set) => ({
  summary: null,
  openInvoice: null,
  history: [],
  loading: false,
  error: null,
  popupOpen: false,
  refresh: async () => {
    set({ loading: true, error: null });
    try {
      const [summary, openInvoice, history] = await Promise.all([
        billingService.getSummary(),
        billingService.getOpenInvoice(),
        billingService.listInvoices(),
      ]);
      set({ summary, openInvoice, history, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },
  setPopupOpen: (open) => set({ popupOpen: open }),
}));
```

- [ ] **Step 3: Smoke build**

Run: `pnpm --filter frontend build`
Expected: build OK, sem erros de tipo.

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/services/billing.service.ts apps/frontend/src/store/billing.store.ts
git commit -m "feat(frontend): add billing service and zustand store"
```

---

## Task 15: AsaasCheckoutPopup component

**Files:**
- Create: `apps/frontend/src/components/billing/AsaasCheckoutPopup.tsx`

- [ ] **Step 1: Implementar**

```typescript
import { useEffect, useRef } from 'react';
import { useBillingStore } from '../../store/billing.store';

interface Props {
  open: boolean;
  checkoutUrl: string | null;
  onClose: () => void;
  onSuccess: () => void;
  pollIntervalMs?: number;
  timeoutMs?: number;
}

export function AsaasCheckoutPopup({
  open, checkoutUrl, onClose, onSuccess,
  pollIntervalMs = 3000, timeoutMs = 5 * 60 * 1000,
}: Props) {
  const popupRef = useRef<Window | null>(null);
  const { refresh, summary } = useBillingStore();
  const startedAtRef = useRef<number>(0);
  const initialBillingTypeRef = useRef<string | null>(null);

  // Abrir popup quando open=true (CHAMADA SINCRONA num onClick — não use await antes)
  useEffect(() => {
    if (!open || !checkoutUrl) return;
    popupRef.current = window.open(
      checkoutUrl, 'asaas-checkout', 'width=480,height=720,top=100,left=100',
    );
    if (!popupRef.current) {
      alert('Permita popups para este site e tente novamente. Se preferir, abrirei o checkout em uma nova aba.');
      window.location.href = checkoutUrl;
      return;
    }
    startedAtRef.current = Date.now();
    initialBillingTypeRef.current = summary?.billingType ?? null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, checkoutUrl]);

  // Polling enquanto popup aberto
  useEffect(() => {
    if (!open) return;
    const interval = setInterval(async () => {
      // Detectar se popup fechado
      if (popupRef.current?.closed) {
        clearInterval(interval);
        await refresh();
        onClose();
        return;
      }
      // Detectar timeout
      if (Date.now() - startedAtRef.current > timeoutMs) {
        clearInterval(interval);
        try { popupRef.current?.close(); } catch { /* cross-origin */ }
        onClose();
        return;
      }
      // Polling de estado
      await refresh();
      const current = useBillingStore.getState().summary;
      if (
        current?.billingType === 'CREDIT_CARD' &&
        current.billingType !== initialBillingTypeRef.current
      ) {
        clearInterval(interval);
        try { popupRef.current?.close(); } catch { /* cross-origin */ }
        onSuccess();
      }
    }, pollIntervalMs);

    return () => clearInterval(interval);
  }, [open, refresh, onClose, onSuccess, pollIntervalMs, timeoutMs]);

  return null;
}
```

- [ ] **Step 2: Smoke build**

Run: `pnpm --filter frontend build`
Expected: OK.

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/components/billing/AsaasCheckoutPopup.tsx
git commit -m "feat(frontend): add AsaasCheckoutPopup with polling and timeout"
```

---

## Task 16: BillingStatusCard + PaymentMethodCard

**Files:**
- Create: `apps/frontend/src/components/billing/BillingStatusCard.tsx`
- Create: `apps/frontend/src/components/billing/PaymentMethodCard.tsx`

- [ ] **Step 1: BillingStatusCard**

```typescript
import { CBadge } from '@coreui/react';
import type { BillingSummary } from '../../services/billing.service';

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  TRIAL:     { label: 'Trial',     color: 'info' },
  ACTIVE:    { label: 'Ativo',     color: 'success' },
  OVERDUE:   { label: 'Em atraso', color: 'warning' },
  SUSPENDED: { label: 'Suspenso',  color: 'danger' },
};

export function BillingStatusCard({ summary }: { summary: BillingSummary }) {
  const status = STATUS_LABEL[summary.status] ?? { label: summary.status, color: 'secondary' };
  const formatBRL = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  let nextLine: string;
  if (summary.status === 'TRIAL' && summary.daysUntilTrialEnds !== null) {
    nextLine = `Trial termina em ${summary.daysUntilTrialEnds} dia${summary.daysUntilTrialEnds !== 1 ? 's' : ''}`;
  } else if (summary.nextDueDate) {
    nextLine = `Próxima cobrança em ${new Date(summary.nextDueDate).toLocaleDateString('pt-BR')}`;
  } else {
    nextLine = '—';
  }

  return (
    <div style={{ padding: 18, border: '1px solid #e3e7e7', borderRadius: 12, background: '#fff' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <strong style={{ fontSize: 16 }}>{summary.planName}</strong>
        <CBadge color={status.color}>{status.label}</CBadge>
      </div>
      <div style={{ fontSize: 22, fontWeight: 700 }}>{formatBRL(summary.planValue)}/mês</div>
      <div style={{ fontSize: 13, color: '#5b6868', marginTop: 6 }}>{nextLine}</div>
      {summary.canceledAt && (
        <div style={{ marginTop: 8, fontSize: 13, color: '#b91c1c' }}>
          Cancelada em {new Date(summary.canceledAt).toLocaleDateString('pt-BR')}.
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: PaymentMethodCard**

```typescript
import { CButton } from '@coreui/react';
import type { BillingSummary } from '../../services/billing.service';

interface Props {
  summary: BillingSummary;
  onAddCard: () => void;       // abre popup checkout
  onRemoveCard: () => void;
}

export function PaymentMethodCard({ summary, onAddCard, onRemoveCard }: Props) {
  return (
    <div style={{ padding: 18, border: '1px solid #e3e7e7', borderRadius: 12, background: '#fff' }}>
      <div style={{ fontSize: 12, textTransform: 'uppercase', color: '#5b6868', marginBottom: 8 }}>
        Forma de pagamento
      </div>

      {summary.card ? (
        <>
          <div style={{ fontSize: 15, fontWeight: 600 }}>
            {summary.card.brand} •••• {summary.card.last4}
          </div>
          <div style={{ fontSize: 13, color: '#5b6868' }}>Vence {summary.card.expiry}</div>
          <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
            <CButton color="primary" variant="outline" size="sm" onClick={onAddCard}>
              Trocar cartão
            </CButton>
            <CButton color="danger" variant="ghost" size="sm" onClick={onRemoveCard}>
              Remover
            </CButton>
          </div>
        </>
      ) : summary.billingType === 'PIX' ? (
        <>
          <div style={{ fontSize: 15, fontWeight: 600 }}>PIX a cada vencimento</div>
          <div style={{ fontSize: 13, color: '#5b6868' }}>
            Você paga manualmente cada fatura na aba acima.
          </div>
          <div style={{ marginTop: 12 }}>
            <CButton color="primary" variant="outline" size="sm" onClick={onAddCard}>
              Migrar para cartão
            </CButton>
          </div>
        </>
      ) : (
        <>
          <div style={{ fontSize: 14, color: '#5b6868', marginBottom: 12 }}>
            Nenhuma forma de pagamento cadastrada.
          </div>
          <CButton color="primary" onClick={onAddCard}>
            Cadastrar forma de pagamento
          </CButton>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Smoke build**

Run: `pnpm --filter frontend build`
Expected: OK.

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/components/billing/
git commit -m "feat(frontend): add BillingStatusCard and PaymentMethodCard"
```

---

## Task 17: OpenInvoiceCard (PIX QR + pagar com cartão)

**Files:**
- Create: `apps/frontend/src/components/billing/OpenInvoiceCard.tsx`

- [ ] **Step 1: Implementar**

```typescript
import { useState } from 'react';
import { CButton } from '@coreui/react';
import type { OpenInvoice } from '../../services/billing.service';

interface Props {
  invoice: OpenInvoice;
  onPayWithCard: () => void;   // abre popup Tipo 2
  onRegeneratePix: () => Promise<void>;
}

export function OpenInvoiceCard({ invoice, onPayWithCard, onRegeneratePix }: Props) {
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const formatBRL = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const copy = async () => {
    if (!invoice.pix?.copyPaste) return;
    await navigator.clipboard.writeText(invoice.pix.copyPaste);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const regenerate = async () => {
    setRegenerating(true);
    try { await onRegeneratePix(); } finally { setRegenerating(false); }
  };

  const isOverdue = invoice.status === 'OVERDUE';

  return (
    <div
      style={{
        padding: 24,
        border: `2px solid ${isOverdue ? '#dc2626' : '#348E91'}`,
        borderRadius: 14,
        background: isOverdue ? 'rgba(220,38,38,0.04)' : 'rgba(52,142,145,0.04)',
      }}
    >
      <div style={{ fontSize: 12, textTransform: 'uppercase', color: '#5b6868', marginBottom: 4 }}>
        {isOverdue ? 'Fatura em atraso' : 'Fatura aberta'}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 18 }}>
        <div style={{ fontSize: 26, fontWeight: 700 }}>{formatBRL(invoice.value)}</div>
        <div style={{ fontSize: 13, color: '#5b6868' }}>
          Vence {new Date(invoice.dueDate).toLocaleDateString('pt-BR')}
        </div>
      </div>

      {invoice.pix && (
        <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <img
            src={`data:image/png;base64,${invoice.pix.qrCodeBase64}`}
            alt="QR Code PIX"
            style={{ width: 180, height: 180, border: '1px solid #e3e7e7', borderRadius: 8 }}
          />
          <div style={{ flex: 1, minWidth: 240 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Pix Copia e Cola</div>
            <textarea
              readOnly
              value={invoice.pix.copyPaste}
              style={{
                width: '100%', minHeight: 100, fontFamily: 'monospace', fontSize: 11,
                padding: 8, borderRadius: 6, border: '1px solid #e3e7e7', resize: 'none',
              }}
              onFocus={(e) => e.target.select()}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <CButton color="primary" size="sm" onClick={copy}>
                {copied ? 'Copiado!' : 'Copiar código'}
              </CButton>
              <CButton color="secondary" variant="outline" size="sm" onClick={regenerate} disabled={regenerating}>
                {regenerating ? 'Atualizando…' : 'Atualizar QR'}
              </CButton>
            </div>
          </div>
        </div>
      )}

      <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid #e3e7e7' }}>
        <CButton color="primary" variant="outline" onClick={onPayWithCard}>
          Pagar com cartão de crédito
        </CButton>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Smoke**

Run: `pnpm --filter frontend build`
Expected: OK.

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/components/billing/OpenInvoiceCard.tsx
git commit -m "feat(frontend): add OpenInvoiceCard with PIX QR and pay-with-card CTA"
```

---

## Task 18: InvoiceHistoryTable + CancelSubscriptionDialog

**Files:**
- Create: `apps/frontend/src/components/billing/InvoiceHistoryTable.tsx`
- Create: `apps/frontend/src/components/billing/CancelSubscriptionDialog.tsx`

- [ ] **Step 1: InvoiceHistoryTable**

```typescript
import type { OpenInvoice } from '../../services/billing.service';

const METHOD_LABEL: Record<string, string> = {
  PIX: 'PIX',
  CREDIT_CARD: 'Cartão',
  BOLETO: 'Boleto',
  UNDEFINED: '—',
};

export function InvoiceHistoryTable({ invoices }: { invoices: OpenInvoice[] }) {
  if (invoices.length === 0) {
    return (
      <div style={{ padding: 18, color: '#5b6868', textAlign: 'center' }}>
        Nenhuma fatura paga ainda.
      </div>
    );
  }
  const formatBRL = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
      <thead>
        <tr style={{ textAlign: 'left', color: '#5b6868', fontSize: 12, textTransform: 'uppercase' }}>
          <th style={{ padding: '8px 0' }}>Data</th>
          <th style={{ padding: '8px 0' }}>Valor</th>
          <th style={{ padding: '8px 0' }}>Método</th>
          <th style={{ padding: '8px 0' }}>Status</th>
        </tr>
      </thead>
      <tbody>
        {invoices.map((inv) => (
          <tr key={inv.id} style={{ borderTop: '1px solid #e3e7e7' }}>
            <td style={{ padding: '10px 0' }}>{new Date(inv.dueDate).toLocaleDateString('pt-BR')}</td>
            <td style={{ padding: '10px 0', fontVariantNumeric: 'tabular-nums' }}>{formatBRL(inv.value)}</td>
            <td style={{ padding: '10px 0' }}>{METHOD_LABEL[inv.billingType] ?? inv.billingType}</td>
            <td style={{ padding: '10px 0', color: inv.status === 'CONFIRMED' ? '#15803d' : '#5b6868' }}>
              {inv.status === 'CONFIRMED' ? 'Pago' : inv.status}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

- [ ] **Step 2: CancelSubscriptionDialog**

```typescript
import { CModal, CModalHeader, CModalBody, CModalFooter, CButton } from '@coreui/react';

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export function CancelSubscriptionDialog({ open, onClose, onConfirm }: Props) {
  return (
    <CModal visible={open} onClose={onClose} alignment="center">
      <CModalHeader>Cancelar assinatura</CModalHeader>
      <CModalBody>
        <p>Você terá acesso ao Praktikus até o final do ciclo atual já pago.</p>
        <p>Após esse período, sua conta será suspensa. Tem certeza?</p>
      </CModalBody>
      <CModalFooter>
        <CButton color="secondary" variant="ghost" onClick={onClose}>Voltar</CButton>
        <CButton color="danger" onClick={async () => { await onConfirm(); onClose(); }}>
          Cancelar assinatura
        </CButton>
      </CModalFooter>
    </CModal>
  );
}
```

- [ ] **Step 3: Smoke**

Run: `pnpm --filter frontend build`
Expected: OK.

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/components/billing/
git commit -m "feat(frontend): add InvoiceHistoryTable and CancelSubscriptionDialog"
```

---

## Task 19: Reescrever SubscriptionTab compondo os novos componentes

**Files:**
- Modify: `apps/frontend/src/components/settings/SubscriptionTab.tsx`

- [ ] **Step 1: Substituir conteúdo**

```typescript
import { useEffect, useState } from 'react';
import { CAlert, CSpinner } from '@coreui/react';
import { Card, CardTitle } from './Card';
import { useBillingStore } from '../../store/billing.store';
import { billingService } from '../../services/billing.service';
import { BillingStatusCard } from '../billing/BillingStatusCard';
import { PaymentMethodCard } from '../billing/PaymentMethodCard';
import { OpenInvoiceCard } from '../billing/OpenInvoiceCard';
import { InvoiceHistoryTable } from '../billing/InvoiceHistoryTable';
import { CancelSubscriptionDialog } from '../billing/CancelSubscriptionDialog';
import { AsaasCheckoutPopup } from '../billing/AsaasCheckoutPopup';

export function SubscriptionTab() {
  const { summary, openInvoice, history, loading, error, refresh, popupOpen, setPopupOpen } = useBillingStore();
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);

  useEffect(() => { refresh(); }, [refresh]);

  // SINCRONO em onClick (sem await): abre popup imediatamente, faz request em background
  const startCardCheckout = () => {
    setPopupOpen(true);
    billingService.startCardCheckout()
      .then((s) => setCheckoutUrl(s.checkoutUrl))
      .catch(() => { setPopupOpen(false); alert('Falha ao iniciar o checkout. Tente novamente.'); });
  };

  const startInvoiceCheckout = (invoiceId: string) => {
    setPopupOpen(true);
    billingService.startInvoiceCheckout(invoiceId)
      .then((s) => setCheckoutUrl(s.checkoutUrl))
      .catch(() => { setPopupOpen(false); alert('Falha ao iniciar o pagamento. Tente novamente.'); });
  };

  const removeCard = async () => {
    if (!confirm('Remover o cartão? As próximas cobranças virão como PIX.')) return;
    await billingService.removeCard();
    await refresh();
  };

  const cancelSub = async () => {
    await billingService.cancel();
    await refresh();
  };

  const regenerateOpenPix = async () => {
    if (!openInvoice) return;
    await billingService.regeneratePix(openInvoice.id);
    await refresh();
  };

  if (loading && !summary) return <div className="text-center py-4"><CSpinner size="sm" color="primary" /></div>;
  if (error || !summary) return <CAlert color="danger">Erro ao carregar dados de assinatura.</CAlert>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 720 }}>
      <BillingStatusCard summary={summary} />

      {openInvoice && (openInvoice.status === 'PENDING' || openInvoice.status === 'OVERDUE') && (
        <OpenInvoiceCard
          invoice={openInvoice}
          onPayWithCard={() => startInvoiceCheckout(openInvoice.id)}
          onRegeneratePix={regenerateOpenPix}
        />
      )}

      <PaymentMethodCard summary={summary} onAddCard={startCardCheckout} onRemoveCard={removeCard} />

      <Card header={<CardTitle title="Histórico de faturas" />}>
        <InvoiceHistoryTable invoices={history} />
      </Card>

      {!summary.canceledAt && (
        <div style={{ textAlign: 'center', marginTop: 12 }}>
          <button
            onClick={() => setCancelOpen(true)}
            style={{
              background: 'transparent', border: 'none', color: '#5b6868',
              fontSize: 13, textDecoration: 'underline', cursor: 'pointer',
            }}
          >
            Cancelar assinatura
          </button>
        </div>
      )}

      <CancelSubscriptionDialog open={cancelOpen} onClose={() => setCancelOpen(false)} onConfirm={cancelSub} />

      <AsaasCheckoutPopup
        open={popupOpen}
        checkoutUrl={checkoutUrl}
        onClose={() => { setPopupOpen(false); setCheckoutUrl(null); }}
        onSuccess={() => { setPopupOpen(false); setCheckoutUrl(null); refresh(); }}
      />
    </div>
  );
}
```

- [ ] **Step 2: Smoke**

Run: `pnpm --filter frontend build`
Expected: OK.

- [ ] **Step 3: Smoke manual no browser**

Run: `pnpm --filter frontend dev`
Login no app, ir em **Configurações → Assinatura**. Esperado: cards renderizando com dados do tenant atual (em modo mock no backend, billingType=null, status=TRIAL, etc.). Popup não abre de verdade ainda — backend mock retorna URL fake.

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/components/settings/SubscriptionTab.tsx
git commit -m "feat(frontend): rewrite SubscriptionTab with full self-service composition"
```

---

## Task 20: Reescrever SuspendedPage

**Files:**
- Modify: `apps/frontend/src/pages/public/SuspendedPage.tsx`

- [ ] **Step 1: Substituir conteúdo**

```typescript
import { CButton, CCard, CCardBody } from '@coreui/react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/auth.store';

export function SuspendedPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const segmentBase = user?.tenant_segment === 'RECYCLING' ? '/recycling' : '/workshop';

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <CCard style={{ width: '100%', maxWidth: 480, textAlign: 'center' }}>
        <CCardBody className="p-5">
          <h2 className="fw-bold mb-3" style={{ color: 'var(--cui-danger)' }}>Sua assinatura foi suspensa</h2>
          <p className="text-secondary mb-4">
            Pague a fatura em aberto para reativar imediatamente sua conta.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <CButton color="primary" onClick={() => navigate(`${segmentBase}/settings`)}>
              Ver fatura e pagar
            </CButton>
            <CButton color="secondary" variant="ghost" onClick={() => { logout(); navigate('/'); }}>
              Sair
            </CButton>
            <a href="mailto:suporte@praktikus.com.br" style={{ fontSize: 13, color: '#5b6868' }}>
              Falar com suporte
            </a>
          </div>
        </CCardBody>
      </CCard>
    </div>
  );
}
```

- [ ] **Step 2: Smoke**

Run: `pnpm --filter frontend build`
Expected: OK.

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/pages/public/SuspendedPage.tsx
git commit -m "feat(frontend): rewrite SuspendedPage to use internal billing flow"
```

---

## Task 21: AppLayout banners (countdown amarelo + OVERDUE vermelho com countdown)

**Files:**
- Modify: `apps/frontend/src/layouts/AppLayout.tsx`
- Modify: `apps/frontend/src/layouts/RecyclingLayout.tsx` (mesma lógica)

- [ ] **Step 1: Identificar bloco atual em AppLayout.tsx**

Run: `grep -n "OVERDUE\|tenant_status" /home/vinicius/Projetos/vinicius/praktikus/apps/frontend/src/layouts/AppLayout.tsx`
Esperado: linhas ~282-286 com o `<CAlert color="warning">`.

- [ ] **Step 2: Substituir banner por componente que cobre TRIAL countdown e OVERDUE**

Adicionar antes do return do `AppLayout`, um helper:

```typescript
function TenantBanner({ status, trialEndsAt }: { status?: string; trialEndsAt?: string | null }) {
  const navigate = useNavigate();

  if (status === 'OVERDUE') {
    return (
      <div style={{ background: '#dc2626', color: '#fff', padding: '8px 16px', textAlign: 'center', fontSize: 14 }}>
        Sua assinatura está em atraso. Pague agora para evitar a suspensão.{' '}
        <a onClick={() => navigate('/workshop/settings')} style={{ color: '#fff', textDecoration: 'underline', cursor: 'pointer' }}>
          Pagar agora
        </a>
      </div>
    );
  }

  if (status === 'TRIAL' && trialEndsAt) {
    const diffDays = Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    const warnAtDays = 7; // PRAKTIKUS_TRIAL_WARNING_DAYS — replicar lógica no front
    if (diffDays <= warnAtDays && diffDays >= 0) {
      return (
        <div style={{ background: '#fef3c7', color: '#92400e', padding: '8px 16px', textAlign: 'center', fontSize: 14 }}>
          Seu trial termina em <strong>{diffDays} {diffDays === 1 ? 'dia' : 'dias'}</strong>. Cadastre uma forma de pagamento.{' '}
          <a onClick={() => navigate('/workshop/settings')} style={{ color: '#92400e', textDecoration: 'underline', cursor: 'pointer' }}>
            Cadastrar agora
          </a>
        </div>
      );
    }
  }

  return null;
}
```

- [ ] **Step 3: Substituir o `<CAlert>` existente pelo novo componente**

Procurar a linha 282-286 e substituir:

```typescript
{/* OLD:
{user?.tenant_status === 'OVERDUE' && (
  <CAlert color="warning" className="mb-0 rounded-0 text-center py-2">
    Pagamento em atraso. Regularize para evitar suspensão da conta.
  </CAlert>
)} */}
<TenantBanner
  status={user?.tenant_status}
  trialEndsAt={(user as any)?.trial_ends_at}
/>
```

⚠️ **Nota crítica**: o JWT atual NÃO tem `trial_ends_at`. Para o banner countdown funcionar, é preciso ou (a) adicionar `trial_ends_at` ao payload JWT no backend (`auth.service.ts:251-261`), ou (b) o frontend buscar via `billingService.getSummary()` no carregamento do layout. Implemente (a):

Em `apps/backend/src/modules/core/auth/auth.service.ts`, no `generateTokens`:

```typescript
private async generateTokens(
  user: UserEntity,
  tenantStatus: string,
  tenantSegment?: TenantSegment,
  whatsappEnabled?: boolean,
  trialEndsAt?: Date | null,           // ← novo
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
    trial_ends_at: trialEndsAt?.toISOString() ?? null,   // ← novo
  };
  // ...
}
```

E onde `generateTokens` é chamado, passar `tenant.trialEndsAt`.

Em `auth.store.ts` (frontend), adicionar `trial_ends_at?: string | null` ao `JwtUser`.

- [ ] **Step 4: Replicar em RecyclingLayout**

Mesma lógica, ajustando rotas para `/recycling/settings`.

- [ ] **Step 5: Smoke**

Run: `pnpm --filter frontend build && pnpm --filter backend build`
Expected: OK.

- [ ] **Step 6: Commit**

```bash
git add apps/frontend/src/layouts/ apps/frontend/src/store/auth.store.ts apps/backend/src/modules/core/auth/
git commit -m "feat(frontend): add trial countdown banner and red OVERDUE banner"
```

---

## Task 22: Quality Gate (Sonar) — obrigatória, sempre última

**Files:** N/A — esta task valida o trabalho das tasks anteriores.

- [ ] **Step 1: Garantir SonarQube de pé**

Run: `docker compose --profile sonar up -d`
Verificar: `curl -sf http://localhost:9000/api/system/status | grep '"status":"UP"'`
Expected: `"status":"UP"`. Se demorar, aguardar até 60s.

- [ ] **Step 2: Rodar coverage + scanner + aguardar gate**

Run: `pnpm sonar:check`
Expected: gate verde com mensagem `✅ Quality gate verde.`

- [ ] **Step 3: Se gate falhou, listar issues new-code**

Run: `curl -s -u "$SONAR_TOKEN:" "http://localhost:9000/api/issues/search?componentKeys=praktikus&resolved=false&inNewCodePeriod=true&ps=500" | jq '.issues[] | {key, rule, severity, message, component, line}'`

- [ ] **Step 4: Para cada issue, corrigir ou suprimir com justificativa**

- **Bug/vuln/duplicação real:** corrigir o código.
- **Falso positivo legítimo:** suprimir inline com `// NOSONAR(rule:S####) — <razão em pt-BR>`.

Re-rodar Step 2 até gate verde.

- [ ] **Step 5: Push autorizado**

Run: `git push`
Expected: pre-push hook valida silenciosamente e libera.
