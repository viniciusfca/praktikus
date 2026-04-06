# Billing Completo (Entrega 9) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implementar webhooks Asaas, bloqueio de acesso por inadimplência via JWT claim, reajuste anual via IPCA e aba de Assinatura na página de Configurações.

**Architecture:** `tenant_status` adicionado ao JWT como claim display-only. `TenantStatusGuard` global bloqueia tenants SUSPENDED. Webhook público valida HMAC-SHA256. `@Cron` mensal consulta IPCA do IBGE e atualiza valor no Asaas. Frontend usa interceptor 403 para redirecionar para `/suspended` e banner de aviso para `OVERDUE`.

**Tech Stack:** NestJS 11 + `@nestjs/schedule` (Cron), bcrypt/crypto (HMAC), TypeORM, React 18, CoreUI v5, Zustand.

---

## Task 1: Backend — `tenant_status` no JWT

**Files:**
- Modify: `apps/backend/src/modules/core/auth/auth.service.ts`
- Modify: `apps/backend/src/modules/core/auth/jwt.strategy.ts`
- Test: `apps/backend/src/modules/core/auth/auth.service.spec.ts`

### Contexto

`generateTokens(user: UserEntity)` é o método privado que monta o payload JWT. Ele já tem acesso a `TenancyService` via `this.tenancyService`. Precisamos buscar o `status` do tenant e inclui-lo no payload.

**Step 1: Atualizar `JwtPayload` e `AuthUser` em `jwt.strategy.ts`**

Em `apps/backend/src/modules/core/auth/jwt.strategy.ts`, adicionar `tenant_status` em ambas as interfaces:

```typescript
export interface JwtPayload {
  sub: string;
  tenant_id: string;
  role: string;
  name?: string;
  email?: string;
  tenant_status?: string;  // adicionado
  iat?: number;
  exp?: number;
}

export interface AuthUser {
  userId: string;
  tenantId: string;
  role: string;
  email: string;
  tenantStatus: string;  // adicionado
}
```

E no método `validate`, retornar o novo campo:

```typescript
async validate(payload: JwtPayload): Promise<AuthUser> {
  const user = await this.userRepo.findOne({ where: { id: payload.sub } });
  if (!user) {
    throw new UnauthorizedException();
  }
  return {
    userId: payload.sub,
    tenantId: payload.tenant_id,
    role: payload.role,
    email: user.email,
    tenantStatus: payload.tenant_status ?? 'ACTIVE',  // adicionado
  };
}
```

**Step 2: Escrever teste falhando em `auth.service.spec.ts`**

Adicionar ao `describe('login')` existente um novo teste:

```typescript
it('should include tenant_status in token payload', async () => {
  const user = {
    id: 'user-1',
    tenantId: 'tenant-1',
    role: UserRole.OWNER,
    email: 'owner@test.com',
    passwordHash: '$2b$10$hash',
    name: 'João',
  };
  mockUserRepo.findOne.mockResolvedValue(user);
  mockTenancyService.findById = jest.fn().mockResolvedValue({
    id: 'tenant-1',
    status: TenantStatus.ACTIVE,
  });
  mockRefreshTokenRepo.create.mockReturnValue({});
  mockRefreshTokenRepo.save.mockResolvedValue({});
  jest.spyOn(require('bcrypt'), 'compare').mockResolvedValue(true as never);

  await service.login({ email: 'owner@test.com', password: 'senha1234' });

  expect(mockJwtService.sign).toHaveBeenCalledWith(
    expect.objectContaining({ tenant_status: TenantStatus.ACTIVE }),
    expect.any(Object),
  );
});
```

**Step 3: Rodar teste para confirmar falha**

```bash
cd apps/backend && pnpm test --testPathPattern=auth.service.spec 2>&1 | tail -15
```
Expected: FAIL — `tenant_status` não está no payload

**Step 4: Atualizar `generateTokens` em `auth.service.ts`**

Alterar a assinatura de `generateTokens` para aceitar `tenantStatus` e incluí-lo no payload:

```typescript
private async generateTokens(user: UserEntity, tenantStatus: string): Promise<AuthTokens> {
  const payload = {
    sub: user.id,
    tenant_id: user.tenantId,
    role: user.role,
    name: user.name,
    email: user.email,
    tenant_status: tenantStatus,  // adicionado
  };
  // ... resto do método permanece igual
```

Atualizar os 3 callers de `generateTokens`:

**`register`** — já tem o `tenant` disponível:
```typescript
// trocar: return this.generateTokens(user);
return this.generateTokens(savedUser, tenant.status);
```
> Nota: `savedUser` é o `user` retornado do `manager.save` dentro da transação (linha ~70). O `tenant` também está disponível ali.

**`login`** — buscar status antes de gerar tokens:
```typescript
// Após: const passwordMatch = await bcrypt.compare(...)
// Antes do: return this.generateTokens(user);
const tenant = await this.tenancyService.findById(user.tenantId);
return this.generateTokens(user, tenant?.status ?? 'ACTIVE');
```

**`refresh`** — mesmo padrão:
```typescript
// Após: const user = await this.userRepo.findOne(...)
// Antes do: return this.generateTokens(user);
const tenant = await this.tenancyService.findById(user.tenantId);
return this.generateTokens(user, tenant?.status ?? 'ACTIVE');
```

**Step 5: Rodar testes**

```bash
cd apps/backend && pnpm test --testPathPattern=auth.service.spec 2>&1 | tail -10
```
Expected: todos passam

**Step 6: Rodar suíte completa**

```bash
cd apps/backend && pnpm test 2>&1 | tail -8
```
Expected: 121+ tests pass

**Step 7: Commit**

```bash
git add apps/backend/src/modules/core/auth/auth.service.ts \
        apps/backend/src/modules/core/auth/jwt.strategy.ts \
        apps/backend/src/modules/core/auth/auth.service.spec.ts
git commit -m "feat(billing): add tenant_status claim to JWT payload"
```

---

## Task 2: Backend — `TenantStatusGuard` global

**Files:**
- Create: `apps/backend/src/modules/core/auth/tenant-status.guard.ts`
- Modify: `apps/backend/src/app.module.ts`
- Test: `apps/backend/src/modules/core/auth/tenant-status.guard.spec.ts`

**Step 1: Criar `tenant-status.guard.spec.ts`**

```typescript
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { TenantStatusGuard } from './tenant-status.guard';

function makeCtx(user: any): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as any;
}

describe('TenantStatusGuard', () => {
  let guard: TenantStatusGuard;

  beforeEach(() => { guard = new TenantStatusGuard(); });

  it('should allow ACTIVE tenants', () => {
    expect(guard.canActivate(makeCtx({ tenantStatus: 'ACTIVE' }))).toBe(true);
  });

  it('should allow TRIAL tenants', () => {
    expect(guard.canActivate(makeCtx({ tenantStatus: 'TRIAL' }))).toBe(true);
  });

  it('should allow OVERDUE tenants (warning only, not blocked)', () => {
    expect(guard.canActivate(makeCtx({ tenantStatus: 'OVERDUE' }))).toBe(true);
  });

  it('should throw ForbiddenException for SUSPENDED tenants', () => {
    expect(() => guard.canActivate(makeCtx({ tenantStatus: 'SUSPENDED' }))).toThrow(
      ForbiddenException,
    );
  });

  it('should allow requests without user (unauthenticated routes)', () => {
    expect(guard.canActivate(makeCtx(undefined))).toBe(true);
  });
});
```

**Step 2: Rodar para confirmar falha**

```bash
cd apps/backend && pnpm test --testPathPattern=tenant-status.guard.spec 2>&1 | tail -10
```
Expected: FAIL — arquivo não encontrado

**Step 3: Criar `tenant-status.guard.ts`**

```typescript
import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

@Injectable()
export class TenantStatusGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) return true; // rota pública — deixar outros guards agirem

    if (user.tenantStatus === 'SUSPENDED') {
      throw new ForbiddenException('conta_suspensa');
    }

    return true;
  }
}
```

**Step 4: Rodar testes**

```bash
cd apps/backend && pnpm test --testPathPattern=tenant-status.guard.spec 2>&1 | tail -10
```
Expected: 5/5 PASS

**Step 5: Registrar guard global em `app.module.ts`**

Adicionar imports e provider:

```typescript
import { APP_GUARD } from '@nestjs/core';
import { TenantStatusGuard } from './modules/core/auth/tenant-status.guard';
```

No array `providers` do `AppModule`:
```typescript
providers: [
  { provide: APP_GUARD, useClass: TenantStatusGuard },
],
```

**Step 6: Rodar suíte completa**

```bash
cd apps/backend && pnpm test 2>&1 | tail -8
```
Expected: todos passam

**Step 7: Commit**

```bash
git add apps/backend/src/modules/core/auth/tenant-status.guard.ts \
        apps/backend/src/modules/core/auth/tenant-status.guard.spec.ts \
        apps/backend/src/app.module.ts
git commit -m "feat(billing): add TenantStatusGuard global — blocks SUSPENDED tenants"
```

---

## Task 3: Backend — Webhook Asaas

**Files:**
- Create: `apps/backend/src/modules/core/billing/billing.controller.ts`
- Modify: `apps/backend/src/modules/core/billing/billing.module.ts`
- Modify: `apps/backend/src/app.module.ts`
- Test: `apps/backend/src/modules/core/billing/billing.controller.spec.ts`

**Step 1: Criar teste falhando**

Criar `apps/backend/src/modules/core/billing/billing.controller.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { TenancyService } from '../tenancy/tenancy.service';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

const mockTenancyService = { updateStatus: jest.fn() };
const mockConfigService = {
  get: jest.fn().mockImplementation((key: string, fallback?: string) => {
    if (key === 'ASAAS_WEBHOOK_TOKEN') return 'test-secret';
    return fallback;
  }),
};

function makeSignature(body: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(body).digest('hex');
}

describe('BillingController', () => {
  let controller: BillingController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BillingController],
      providers: [
        { provide: TenancyService, useValue: mockTenancyService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    controller = module.get<BillingController>(BillingController);
    jest.clearAllMocks();
  });

  it('should return 401 for invalid signature', async () => {
    const rawBody = '{"event":"PAYMENT_RECEIVED"}';
    await expect(
      controller.handleWebhook('invalid-sig', rawBody, {}),
    ).rejects.toThrow(ForbiddenException);
  });

  it('should update status to ACTIVE on PAYMENT_RECEIVED', async () => {
    const payload = { event: 'PAYMENT_RECEIVED', payment: { subscription: 'sub-1' } };
    const rawBody = JSON.stringify(payload);
    const sig = makeSignature(rawBody, 'test-secret');

    mockTenancyService.updateStatus = jest.fn().mockResolvedValue(undefined);
    // findByAsaasSubscriptionId needs to return a tenant
    mockTenancyService.findByAsaasSubscriptionId = jest.fn().mockResolvedValue({ id: 'tenant-1' });

    await controller.handleWebhook(sig, rawBody, payload);

    expect(mockTenancyService.updateStatus).toHaveBeenCalledWith('tenant-1', 'ACTIVE');
  });

  it('should update status to SUSPENDED on SUBSCRIPTION_INACTIVATED', async () => {
    const payload = { event: 'SUBSCRIPTION_INACTIVATED', subscription: { id: 'sub-1' } };
    const rawBody = JSON.stringify(payload);
    const sig = makeSignature(rawBody, 'test-secret');

    mockTenancyService.findByAsaasSubscriptionId = jest.fn().mockResolvedValue({ id: 'tenant-1' });
    mockTenancyService.updateStatus = jest.fn().mockResolvedValue(undefined);

    await controller.handleWebhook(sig, rawBody, payload);

    expect(mockTenancyService.updateStatus).toHaveBeenCalledWith('tenant-1', 'SUSPENDED');
  });

  it('should ignore unknown events and return 200', async () => {
    const payload = { event: 'UNKNOWN_EVENT' };
    const rawBody = JSON.stringify(payload);
    const sig = makeSignature(rawBody, 'test-secret');

    await expect(controller.handleWebhook(sig, rawBody, payload)).resolves.toBeUndefined();
    expect(mockTenancyService.updateStatus).not.toHaveBeenCalled();
  });
});
```

**Step 2: Rodar para confirmar falha**

```bash
cd apps/backend && pnpm test --testPathPattern=billing.controller.spec 2>&1 | tail -10
```

**Step 3: Adicionar `findByAsaasSubscriptionId` e `updateStatus` em `TenancyService`**

Em `apps/backend/src/modules/core/tenancy/tenancy.service.ts`, adicionar:

```typescript
async findByAsaasSubscriptionId(subscriptionId: string): Promise<TenantEntity | null> {
  // A billing entity tem o asaasSubscriptionId; precisamos do tenantId para buscar o tenant
  // Como BillingEntity está em BillingModule, a melhor abordagem é:
  // 1. Injetar BillingRepo aqui, ou
  // 2. Usar uma query direta
  // Opção mais simples: adicionar um método ao BillingService e injetar lá
  // Ver nota abaixo
  return null; // placeholder — implementar via BillingService
}
```

> **Nota arquitetural:** `TenancyService` não tem acesso a `BillingEntity`. A dependência correta é inversa: `BillingController` acessa tanto `BillingService` (para lookup por `asaasSubscriptionId`) quanto `TenancyService.updateStatus`. Assim:

**Adicionar `findBySubscriptionId` ao `BillingService`** em `billing.service.ts`:

```typescript
async findTenantIdBySubscriptionId(subscriptionId: string): Promise<string | null> {
  const billing = await this.billingRepo.findOne({
    where: { asaasSubscriptionId: subscriptionId },
  });
  return billing?.tenantId ?? null;
}
```

**Adicionar `updateStatus` ao `TenancyService`** em `tenancy.service.ts`:

```typescript
async updateStatus(tenantId: string, status: TenantStatus): Promise<void> {
  await this.tenantRepo.update({ id: tenantId }, { status });
}
```

**Step 4: Criar `billing.controller.ts`**

```typescript
import {
  Body,
  Controller,
  ForbiddenException,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { BillingService } from './billing.service';
import { TenancyService } from '../tenancy/tenancy.service';
import { TenantStatus } from '../tenancy/tenant.entity';

const EVENT_STATUS_MAP: Record<string, TenantStatus> = {
  PAYMENT_RECEIVED: TenantStatus.ACTIVE,
  PAYMENT_CONFIRMED: TenantStatus.ACTIVE,
  PAYMENT_OVERDUE: TenantStatus.OVERDUE,
  SUBSCRIPTION_INACTIVATED: TenantStatus.SUSPENDED,
};

@Controller('billing')
export class BillingController {
  constructor(
    private readonly billingService: BillingService,
    private readonly tenancyService: TenancyService,
    private readonly config: ConfigService,
  ) {}

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Headers('asaas-signature') signature: string,
    @Body('__rawBody') rawBody: string,
    @Body() payload: any,
  ): Promise<void> {
    const secret = this.config.get<string>('ASAAS_WEBHOOK_TOKEN', '');
    const expected = crypto.createHmac('sha256', secret).update(rawBody ?? '').digest('hex');

    if (!secret || signature !== expected) {
      throw new ForbiddenException('Assinatura inválida');
    }

    const targetStatus = EVENT_STATUS_MAP[payload?.event];
    if (!targetStatus) return; // evento desconhecido — ignorar

    // Extrair subscriptionId do payload (varia por tipo de evento)
    const subscriptionId: string | undefined =
      payload?.payment?.subscription ?? payload?.subscription?.id;

    if (!subscriptionId) return;

    const tenantId = await this.billingService.findTenantIdBySubscriptionId(subscriptionId);
    if (!tenantId) return;

    await this.tenancyService.updateStatus(tenantId, targetStatus);
  }
}
```

> **Nota sobre `rawBody`:** O NestJS não expõe o body bruto por padrão. Para HMAC precisamos do payload exato como string. A forma mais simples é habilitar `rawBody: true` no `NestFactory.create()` em `main.ts` e usar o decorator `@RawBodyRequest`. Alternativamente, para testes podemos passar `rawBody` diretamente. Ver Step 5.

**Step 5: Habilitar rawBody em `main.ts`**

Em `apps/backend/src/main.ts`, adicionar `rawBody: true`:

```typescript
const app = await NestFactory.create(AppModule, { rawBody: true });
```

E ajustar o controller para usar `Request` diretamente:

```typescript
import { Request } from 'express';

@Post('webhook')
@HttpCode(HttpStatus.OK)
async handleWebhook(
  @Headers('asaas-signature') signature: string,
  @Req() req: RawBodyRequest<Request>,
  @Body() payload: any,
): Promise<void> {
  const rawBody = req.rawBody?.toString() ?? '';
  const secret = this.config.get<string>('ASAAS_WEBHOOK_TOKEN', '');
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

  if (!secret || signature !== expected) {
    throw new ForbiddenException('Assinatura inválida');
  }
  // ... resto igual
}
```

> E no teste, a assinatura é calculada sobre `rawBody` passado como string diretamente.

**Step 6: Atualizar `BillingModule`**

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BillingEntity } from './billing.entity';
import { BillingService } from './billing.service';
import { BillingController } from './billing.controller';
import { TenancyModule } from '../tenancy/tenancy.module';

@Module({
  imports: [TypeOrmModule.forFeature([BillingEntity]), TenancyModule],
  controllers: [BillingController],
  providers: [BillingService],
  exports: [BillingService],
})
export class BillingModule {}
```

**Step 7: Registrar `BillingModule` em `app.module.ts`**

```typescript
import { BillingModule } from './modules/core/billing/billing.module';
// adicionar BillingModule ao array imports
```

**Step 8: Rodar testes**

```bash
cd apps/backend && pnpm test --testPathPattern=billing.controller.spec 2>&1 | tail -10
```
Expected: 4/4 PASS

**Step 9: Rodar suíte completa**

```bash
cd apps/backend && pnpm test 2>&1 | tail -8
```

**Step 10: Commit**

```bash
git add apps/backend/src/modules/core/billing/billing.controller.ts \
        apps/backend/src/modules/core/billing/billing.controller.spec.ts \
        apps/backend/src/modules/core/billing/billing.module.ts \
        apps/backend/src/modules/core/billing/billing.service.ts \
        apps/backend/src/modules/core/tenancy/tenancy.service.ts \
        apps/backend/src/app.module.ts \
        apps/backend/src/main.ts
git commit -m "feat(billing): add POST /billing/webhook with HMAC validation"
```

---

## Task 4: Backend — Reajuste anual (@Cron + IPCA)

**Files:**
- Modify: `apps/backend/src/modules/core/billing/billing.service.ts`
- Modify: `apps/backend/src/modules/core/billing/billing.module.ts`
- Modify: `apps/backend/src/app.module.ts`
- Test: `apps/backend/src/modules/core/billing/billing.service.spec.ts`

**Step 1: Instalar `@nestjs/schedule`**

```bash
cd apps/backend && pnpm add @nestjs/schedule
```

**Step 2: Escrever teste falhando**

Adicionar ao `billing.service.spec.ts` (criar arquivo se não existir):

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { BillingService } from './billing.service';
import { BillingEntity } from './billing.entity';
import { TenancyService } from '../tenancy/tenancy.service';
import { DataSource } from 'typeorm';

const mockBillingRepo = { findOne: jest.fn(), save: jest.fn(), create: jest.fn(), find: jest.fn() };
const mockTenancyService = { findById: jest.fn(), updateStatus: jest.fn() };
const mockConfig = { get: jest.fn() };

describe('BillingService', () => {
  let service: BillingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillingService,
        { provide: getRepositoryToken(BillingEntity), useValue: mockBillingRepo },
        { provide: TenancyService, useValue: mockTenancyService },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();
    service = module.get<BillingService>(BillingService);
    jest.clearAllMocks();
  });

  describe('applyAnnualAdjustment', () => {
    it('should update Asaas subscription with IPCA-adjusted value', async () => {
      const today = new Date();
      const billingAnchorDate = new Date(today);

      mockTenancyService.findById = jest.fn().mockResolvedValue({
        id: 'tenant-1',
        billingAnchorDate,
        status: 'ACTIVE',
      });
      mockBillingRepo.find = jest.fn().mockResolvedValue([
        { tenantId: 'tenant-1', asaasSubscriptionId: 'sub-1' },
      ]);

      // Mock IBGE API call
      jest.spyOn(global, 'fetch' as any).mockResolvedValue({
        ok: true,
        json: async () => [{ resultados: [{ series: [{ serie: { '202303': '5.19' } }] }] }],
      } as any);

      mockConfig.get.mockImplementation((key: string, def?: any) => {
        if (key === 'ASAAS_API_KEY') return 'mock';
        if (key === 'ASAAS_PLAN_VALUE') return '69.90';
        return def;
      });

      await service.applyAnnualAdjustment();

      // Em modo mock, apenas loga — sem chamar Asaas real
      // Verificar que não lança
    });

    it('should skip tenants whose billingAnchorDate does not match today', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      mockBillingRepo.find = jest.fn().mockResolvedValue([
        { tenantId: 'tenant-1', asaasSubscriptionId: 'sub-1' },
      ]);
      mockTenancyService.findById = jest.fn().mockResolvedValue({
        id: 'tenant-1',
        billingAnchorDate: yesterday,
        status: 'ACTIVE',
      });

      await service.applyAnnualAdjustment();

      // fetch não deve ter sido chamado (nenhum reajuste)
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });
});
```

**Step 3: Rodar para confirmar falha**

```bash
cd apps/backend && pnpm test --testPathPattern=billing.service.spec 2>&1 | tail -15
```

**Step 4: Adicionar `applyAnnualAdjustment` e `@Cron` ao `BillingService`**

Adicionar imports ao topo de `billing.service.ts`:

```typescript
import { Cron, CronExpression } from '@nestjs/schedule';
import { TenancyService } from '../tenancy/tenancy.service';
import { InjectRepository } from '@nestjs/typeorm';
```

Adicionar `TenancyService` ao construtor:

```typescript
constructor(
  @InjectRepository(BillingEntity)
  private readonly billingRepo: Repository<BillingEntity>,
  private readonly config: ConfigService,
  private readonly tenancyService: TenancyService,  // adicionado
) { ... }
```

Adicionar o método ao `BillingService`:

```typescript
async findTenantIdBySubscriptionId(subscriptionId: string): Promise<string | null> {
  const billing = await this.billingRepo.findOne({
    where: { asaasSubscriptionId: subscriptionId },
  });
  return billing?.tenantId ?? null;
}

@Cron('0 9 1 * *') // dia 1 de cada mês às 9h
async applyAnnualAdjustment(): Promise<void> {
  const today = new Date();
  const todayDay = today.getDate();
  const todayMonth = today.getMonth() + 1;

  const allBillings = await this.billingRepo.find();

  for (const billing of allBillings) {
    const tenant = await this.tenancyService.findById(billing.tenantId);
    if (!tenant?.billingAnchorDate) continue;

    const anchor = new Date(tenant.billingAnchorDate);
    if (anchor.getDate() !== todayDay || anchor.getMonth() + 1 !== todayMonth) continue;

    let ipcaRate: number;
    try {
      ipcaRate = await this.fetchIpcaAccumulado12Months();
    } catch (err) {
      this.logger.error(`IBGE IPCA fetch failed for tenant ${billing.tenantId}: ${(err as Error).message}`);
      continue; // não aplica reajuste — retenta no próximo ciclo
    }

    const currentValue = parseFloat(this.config.get<string>('ASAAS_PLAN_VALUE', '69.90'));
    const newValue = parseFloat((currentValue * (1 + ipcaRate)).toFixed(2));

    if (this.isMock) {
      this.logger.log(`[MOCK] Reajuste anual tenant ${billing.tenantId}: R$${currentValue} → R$${newValue} (IPCA ${(ipcaRate * 100).toFixed(2)}%)`);
      continue;
    }

    const apiKey = this.config.get<string>('ASAAS_API_KEY')!;
    const baseUrl = this.config.get<string>('ASAAS_API_URL', 'https://sandbox.asaas.com/api/v3');

    try {
      await fetch(`${baseUrl}/subscriptions/${billing.asaasSubscriptionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', access_token: apiKey },
        body: JSON.stringify({ value: newValue }),
      });
      this.logger.log(`Reajuste anual aplicado tenant ${billing.tenantId}: R$${currentValue} → R$${newValue}`);
    } catch (err) {
      this.logger.error(`Asaas PATCH subscription failed for tenant ${billing.tenantId}: ${(err as Error).message}`);
    }
  }
}

private async fetchIpcaAccumulado12Months(): Promise<number> {
  // API IBGE — IPCA acumulado 12 meses (agregado 6691, variável 63)
  const now = new Date();
  const endPeriod = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const start = new Date(now);
  start.setMonth(start.getMonth() - 12);
  const startPeriod = `${start.getFullYear()}${String(start.getMonth() + 1).padStart(2, '0')}`;

  const url = `https://servicodados.ibge.gov.br/api/v3/agregados/6691/periodos/${startPeriod}-${endPeriod}/variaveis/63?localidades=N1[all]`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`IBGE API error: ${res.status}`);

  const data = (await res.json()) as any[];
  const series = data?.[0]?.resultados?.[0]?.series?.[0]?.serie ?? {};
  const values = Object.values(series) as string[];
  if (values.length === 0) throw new Error('IBGE returned empty series');

  // Último valor disponível = IPCA acumulado 12 meses mais recente
  const latest = parseFloat(values[values.length - 1]);
  if (isNaN(latest)) throw new Error('IBGE value is not a number');

  return latest / 100; // converter de % para decimal
}
```

**Step 5: Adicionar `ScheduleModule` ao `AppModule`**

```typescript
import { ScheduleModule } from '@nestjs/schedule';
// no array imports:
ScheduleModule.forRoot(),
```

**Step 6: Rodar testes**

```bash
cd apps/backend && pnpm test --testPathPattern=billing.service.spec 2>&1 | tail -10
```

**Step 7: Rodar suíte completa**

```bash
cd apps/backend && pnpm test 2>&1 | tail -8
```

**Step 8: Commit**

```bash
git add apps/backend/src/modules/core/billing/billing.service.ts \
        apps/backend/src/modules/core/billing/billing.service.spec.ts \
        apps/backend/src/modules/core/billing/billing.module.ts \
        apps/backend/src/app.module.ts
git commit -m "feat(billing): add @Cron annual IPCA adjustment for Asaas subscriptions"
```

---

## Task 5: Frontend — `tenant_status` no JwtUser + OVERDUE banner + 403 redirect

**Files:**
- Modify: `apps/frontend/src/store/auth.store.ts`
- Modify: `apps/frontend/src/services/api.ts`
- Modify: `apps/frontend/src/layouts/AppLayout.tsx`

**Step 1: Adicionar `tenant_status` ao `JwtUser`**

Em `apps/frontend/src/store/auth.store.ts`, adicionar campo à interface:

```typescript
export interface JwtUser {
  sub: string;
  tenant_id: string;
  role: 'OWNER' | 'EMPLOYEE';
  name: string;
  email: string;
  exp: number;
  tenant_status: 'TRIAL' | 'ACTIVE' | 'OVERDUE' | 'SUSPENDED';  // adicionado
}
```

**Step 2: Adicionar handler 403 ao interceptor em `api.ts`**

No interceptor de resposta, antes do `return Promise.reject(error)`, adicionar:

```typescript
if (error.response?.status === 403) {
  const message = error.response?.data?.message;
  if (message === 'conta_suspensa') {
    window.location.href = '/suspended';
    return;
  }
}
```

O bloco completo do interceptor deve ficar:

```typescript
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;

    if (error.response?.status === 403) {
      const message = error.response?.data?.message;
      if (message === 'conta_suspensa') {
        window.location.href = '/suspended';
        return;
      }
    }

    if (error.response?.status === 401 && !original._retry) {
      // ... código existente de refresh token
    }
    return Promise.reject(error);
  },
);
```

**Step 3: Adicionar banner OVERDUE ao `AppLayout.tsx`**

Adicionar import no topo do arquivo (já deve ter `CAlert`; se não tiver, adicionar):
```typescript
import { CAlert } from '@coreui/react'; // se não existir
```

No JSX do `AppLayout`, logo após a abertura do container principal (antes de `<Outlet />`), adicionar:

```tsx
{user?.tenant_status === 'OVERDUE' && (
  <CAlert color="warning" className="mb-0 rounded-0 text-center py-2">
    Pagamento em atraso. Regularize para evitar suspensão da conta.
  </CAlert>
)}
```

**Step 4: Verificar build**

```bash
cd apps/frontend && pnpm build 2>&1 | grep "error" | head -10
```

**Step 5: Rodar testes**

```bash
cd apps/frontend && pnpm test 2>&1 | tail -8
```

**Step 6: Commit**

```bash
git add apps/frontend/src/store/auth.store.ts \
        apps/frontend/src/services/api.ts \
        apps/frontend/src/layouts/AppLayout.tsx
git commit -m "feat(billing): add tenant_status to JWT store, OVERDUE banner, 403 redirect"
```

---

## Task 6: Frontend — `SuspendedPage` + rota

**Files:**
- Create: `apps/frontend/src/pages/public/SuspendedPage.tsx`
- Modify: `apps/frontend/src/App.tsx`

**Step 1: Criar `SuspendedPage.tsx`**

```tsx
import { CButton, CCard, CCardBody } from '@coreui/react';

export function SuspendedPage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <CCard style={{ width: '100%', maxWidth: 480, textAlign: 'center' }}>
        <CCardBody className="p-5">
          <h2 className="fw-bold mb-3" style={{ color: 'var(--cui-danger)' }}>
            Conta Suspensa
          </h2>
          <p className="text-secondary mb-4">
            O acesso à sua conta foi suspenso por inadimplência. Regularize o
            pagamento para reativar o sistema.
          </p>
          <CButton
            color="primary"
            href="https://www.asaas.com/login"
            target="_blank"
            rel="noopener noreferrer"
          >
            Regularizar pagamento
          </CButton>
        </CCardBody>
      </CCard>
    </div>
  );
}
```

**Step 2: Adicionar rota em `App.tsx`**

Adicionar import:
```typescript
import { SuspendedPage } from './pages/public/SuspendedPage';
```

Adicionar rota pública (fora do `PrivateRoute`):
```tsx
<Route path="/suspended" element={<SuspendedPage />} />
```

**Step 3: Build + testes**

```bash
cd apps/frontend && pnpm build 2>&1 | grep "error" | head -10
cd apps/frontend && pnpm test 2>&1 | tail -8
```

**Step 4: Commit**

```bash
git add apps/frontend/src/pages/public/SuspendedPage.tsx \
        apps/frontend/src/App.tsx
git commit -m "feat(billing): add SuspendedPage and /suspended route"
```

---

## Task 7: Frontend — Aba Assinatura em SettingsPage

**Files:**
- Modify: `apps/frontend/src/services/company.service.ts`
- Modify: `apps/frontend/src/pages/workshop/settings/SettingsPage.tsx`

**Step 1: Atualizar `CompanyProfile` em `company.service.ts`**

Adicionar campos de billing à interface (já retornados por `GET /workshop/company`):

```typescript
export interface CompanyProfile {
  id: string;
  nomeFantasia: string;
  razaoSocial: string;
  cnpj: string;
  telefone: string | null;
  endereco: CompanyAddress | null;
  logoUrl: string | null;
  status: 'TRIAL' | 'ACTIVE' | 'OVERDUE' | 'SUSPENDED';  // adicionado
  trialEndsAt: string | null;       // adicionado (ISO date string)
  billingAnchorDate: string | null; // adicionado (ISO date string)
}
```

**Step 2: Adicionar `SubscriptionTab` em `SettingsPage.tsx`**

Adicionar o componente antes do `SettingsPage`:

```tsx
const STATUS_LABEL: Record<string, string> = {
  TRIAL: 'Trial',
  ACTIVE: 'Ativo',
  OVERDUE: 'Em atraso',
  SUSPENDED: 'Suspenso',
};

const STATUS_COLOR: Record<string, string> = {
  TRIAL: 'var(--cui-info)',
  ACTIVE: 'var(--cui-success)',
  OVERDUE: 'var(--cui-warning)',
  SUSPENDED: 'var(--cui-danger)',
};

function SubscriptionTab() {
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    companyService.getProfile()
      .then(setProfile)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-center py-4"><CSpinner /></div>;
  if (!profile) return <CAlert color="danger">Erro ao carregar dados de assinatura.</CAlert>;

  const statusLabel = STATUS_LABEL[profile.status] ?? profile.status;
  const statusColor = STATUS_COLOR[profile.status] ?? 'var(--cui-secondary)';

  const nextDate = profile.status === 'TRIAL'
    ? profile.trialEndsAt
    : profile.billingAnchorDate;

  const formattedDate = nextDate
    ? new Date(nextDate).toLocaleDateString('pt-BR')
    : '—';

  const dateLabel = profile.status === 'TRIAL' ? 'Fim do trial' : 'Próxima cobrança';

  return (
    <div style={{ maxWidth: 420 }}>
      <div className="mb-4 d-flex align-items-center gap-3">
        <span className="fw-semibold">Status:</span>
        <span
          className="px-3 py-1 rounded"
          style={{
            backgroundColor: statusColor,
            color: '#fff',
            fontSize: '0.875rem',
            fontWeight: 600,
          }}
        >
          {statusLabel}
        </span>
      </div>
      <div className="mb-4">
        <span className="fw-semibold">{dateLabel}:</span>{' '}
        <span>{formattedDate}</span>
      </div>
      <CButton
        color="primary"
        variant="outline"
        href="https://www.asaas.com/login"
        target="_blank"
        rel="noopener noreferrer"
      >
        Gerenciar assinatura
      </CButton>
    </div>
  );
}
```

**Step 3: Adicionar terceira aba ao `SettingsPage`**

No `CNav`, adicionar terceiro item:
```tsx
<CNavItem>
  <CNavLink active={activeTab === 2} onClick={() => setActiveTab(2)} style={{ cursor: 'pointer' }}>
    Assinatura
  </CNavLink>
</CNavItem>
```

No `CTabContent`, adicionar terceiro pane:
```tsx
<CTabPane visible={activeTab === 2}>
  <SubscriptionTab />
</CTabPane>
```

**Step 4: Build + testes**

```bash
cd apps/frontend && pnpm build 2>&1 | grep "error" | head -10
cd apps/frontend && pnpm test 2>&1 | tail -8
```

**Step 5: Commit**

```bash
git add apps/frontend/src/services/company.service.ts \
        apps/frontend/src/pages/workshop/settings/SettingsPage.tsx
git commit -m "feat(billing): add Assinatura tab to SettingsPage"
```

---

## Done

Após todas as tarefas:
- Backend: JWT inclui `tenant_status`; `TenantStatusGuard` global bloqueia SUSPENDED; webhook `/billing/webhook` atualiza status via HMAC; `@Cron` aplica IPCA anual
- Frontend: banner OVERDUE no AppLayout; redirect `/suspended` para tenants bloqueados; aba Assinatura em Configurações
