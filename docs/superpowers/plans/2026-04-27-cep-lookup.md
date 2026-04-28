# CEP Lookup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar busca automática de endereço por CEP nos formulários de "Configurações da empresa" (workshop e recycling) e "Cadastro de fornecedor", compartilhando lógica via backend proxy autenticado e componente React reutilizável.

**Architecture:** Backend ganha módulo `core/cep` com `GET /api/cep/:cep` autenticado, usando `@nestjs/axios` para consultar ceplite.com.br (primário) com fallback para viacep.com.br. Frontend ganha hook `useCepLookup` (debounce de 300ms via `use-debounce`) e componente `<AddressFields />` consumido pelos dois formulários. Campo `bairro` (`neighborhood`) é adicionado aos tipos JSONB de endereço — sem migration de banco.

**Tech Stack:** NestJS 11, `@nestjs/axios` (novo), TypeORM, React 19, react-hook-form, zod, `use-debounce` (novo), CoreUI, Vitest + Testing Library.

**Spec:** [docs/superpowers/specs/2026-04-27-cep-lookup-design.md](../specs/2026-04-27-cep-lookup-design.md)

---

## File Structure

**Created:**
- `packages/shared/src/types/cep.ts` — type `CepLookupResponse`
- `apps/backend/src/modules/core/cep/cep.module.ts`
- `apps/backend/src/modules/core/cep/cep.controller.ts`
- `apps/backend/src/modules/core/cep/cep.service.ts`
- `apps/backend/src/modules/core/cep/cep.service.spec.ts`
- `apps/backend/src/modules/core/cep/dto/cep-lookup-response.dto.ts`
- `apps/frontend/src/services/cep.service.ts`
- `apps/frontend/src/services/cep.service.test.ts`
- `apps/frontend/src/hooks/useCepLookup.ts`
- `apps/frontend/src/hooks/useCepLookup.test.tsx`
- `apps/frontend/src/components/forms/AddressFields.tsx`
- `apps/frontend/src/components/forms/AddressFields.test.tsx`

**Modified:**
- `packages/shared/src/index.ts` — re-export `cep` types
- `apps/backend/package.json` — add `@nestjs/axios`, `axios`
- `apps/backend/src/app.module.ts` — register `CepModule`
- `apps/backend/src/modules/core/tenancy/tenant.entity.ts` — add `neighborhood` to `TenantAddress`
- `apps/backend/src/modules/recycling/suppliers/supplier.entity.ts` — add `neighborhood` to `SupplierAddress`
- `apps/backend/src/modules/workshop/companies/dto/update-company.dto.ts` — add `neighborhood` to `AddressUpdateDto`
- `apps/backend/src/modules/recycling/suppliers/dto/create-supplier.dto.ts` — add `neighborhood` to inline address shape
- `apps/frontend/package.json` — add `use-debounce`
- `apps/frontend/src/services/company.service.ts` — add `neighborhood` to `CompanyAddress`
- `apps/frontend/src/services/recycling/suppliers.service.ts` — add `neighborhood` to `Supplier.address`
- `apps/frontend/src/components/settings/CompanyTab.tsx` — replace address fields with `<AddressFields />`, add `neighborhood` to schema/payload
- `apps/frontend/src/pages/recycling/suppliers/SuppliersPage.tsx` — same change in `SupplierFormDialog`

---

## Task 1: Add `CepLookupResponse` type to shared package

**Files:**
- Create: `packages/shared/src/types/cep.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Create the type file**

Write `packages/shared/src/types/cep.ts`:

```typescript
export interface CepLookupResponse {
  cep: string;
  street: string;
  neighborhood: string;
  city: string;
  state: string;
}
```

- [ ] **Step 2: Re-export from shared index**

Modify `packages/shared/src/index.ts`. After the existing `export * from './types/coleta';` line, add:

```typescript
export * from './types/cep';
```

- [ ] **Step 3: Build the shared package**

Run:
```bash
pnpm --filter @praktikus/shared build
```

Expected: `dist/index.d.ts` and `dist/types/cep.d.ts` are generated without TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/types/cep.ts packages/shared/src/index.ts packages/shared/dist
git commit -m "feat(shared): add CepLookupResponse type"
```

---

## Task 2: Install backend HTTP module dependencies

**Files:**
- Modify: `apps/backend/package.json`

- [ ] **Step 1: Add `@nestjs/axios` and `axios`**

Run:
```bash
pnpm --filter backend add @nestjs/axios axios
```

Expected: `apps/backend/package.json` has `@nestjs/axios` and `axios` under `dependencies`.

- [ ] **Step 2: Verify install succeeded**

Run:
```bash
pnpm --filter backend exec tsc --noEmit
```

Expected: No TypeScript errors related to the new packages.

- [ ] **Step 3: Commit**

```bash
git add apps/backend/package.json pnpm-lock.yaml
git commit -m "chore(backend): add @nestjs/axios for HTTP client"
```

---

## Task 3: Create `CepLookupResponseDto` for the backend

**Files:**
- Create: `apps/backend/src/modules/core/cep/dto/cep-lookup-response.dto.ts`

- [ ] **Step 1: Create the DTO file**

Write `apps/backend/src/modules/core/cep/dto/cep-lookup-response.dto.ts`:

```typescript
import { CepLookupResponse } from '@praktikus/shared';

export class CepLookupResponseDto implements CepLookupResponse {
  cep: string;
  street: string;
  neighborhood: string;
  city: string;
  state: string;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/backend/src/modules/core/cep/dto/cep-lookup-response.dto.ts
git commit -m "feat(cep): add CepLookupResponseDto"
```

---

## Task 4: Write failing tests for `CepService`

**Files:**
- Create: `apps/backend/src/modules/core/cep/cep.service.spec.ts`

- [ ] **Step 1: Write the test file**

Write `apps/backend/src/modules/core/cep/cep.service.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { BadRequestException, BadGatewayException, NotFoundException } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { AxiosError, AxiosResponse } from 'axios';
import { CepService } from './cep.service';

describe('CepService', () => {
  let service: CepService;
  let httpGet: jest.Mock;

  beforeEach(async () => {
    httpGet = jest.fn();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CepService,
        { provide: HttpService, useValue: { get: httpGet } },
      ],
    }).compile();
    service = module.get<CepService>(CepService);
  });

  function ok<T>(data: T): AxiosResponse<T> {
    return { data, status: 200, statusText: 'OK', headers: {}, config: {} as any };
  }

  function axiosErr(status?: number): AxiosError {
    const err = new AxiosError('boom');
    if (status) err.response = { status, data: null, statusText: '', headers: {}, config: {} as any };
    return err;
  }

  it('rejects CEPs with fewer than 8 digits', async () => {
    await expect(service.lookup('123')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects CEPs with non-digit characters that result in fewer than 8 digits', async () => {
    await expect(service.lookup('abc-def')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('normalizes CEP with hyphen and calls ceplite first', async () => {
    httpGet.mockReturnValueOnce(of(ok({
      cep: '69921-001', logradouro: 'Rua A', bairro: 'Centro', cidade: 'Rio Branco', uf: 'AC',
    })));
    const result = await service.lookup('69921-001');
    expect(httpGet).toHaveBeenCalledWith('https://ceplite.com.br/cep/69921001', expect.any(Object));
    expect(result).toEqual({
      cep: '69921001', street: 'Rua A', neighborhood: 'Centro', city: 'Rio Branco', state: 'AC',
    });
  });

  it('falls back to viacep when ceplite times out', async () => {
    httpGet
      .mockReturnValueOnce(throwError(() => axiosErr()))
      .mockReturnValueOnce(of(ok({
        cep: '01001-000', logradouro: 'Praça da Sé', bairro: 'Sé', localidade: 'São Paulo', uf: 'SP',
      })));
    const result = await service.lookup('01001000');
    expect(httpGet).toHaveBeenCalledTimes(2);
    expect(httpGet).toHaveBeenNthCalledWith(2, 'https://viacep.com.br/ws/01001000/json/', expect.any(Object));
    expect(result.city).toBe('São Paulo');
    expect(result.state).toBe('SP');
  });

  it('returns 404 when both APIs say CEP does not exist', async () => {
    httpGet
      .mockReturnValueOnce(throwError(() => axiosErr(404)))
      .mockReturnValueOnce(of(ok({ erro: true })));
    await expect(service.lookup('00000000')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns 502 when both APIs fail with network errors', async () => {
    httpGet
      .mockReturnValueOnce(throwError(() => axiosErr()))
      .mockReturnValueOnce(throwError(() => axiosErr()));
    await expect(service.lookup('12345678')).rejects.toBeInstanceOf(BadGatewayException);
  });

  it('falls back when ceplite returns malformed payload', async () => {
    httpGet
      .mockReturnValueOnce(of(ok({ unexpected: 'shape' })))
      .mockReturnValueOnce(of(ok({
        cep: '01001-000', logradouro: 'Praça da Sé', bairro: 'Sé', localidade: 'São Paulo', uf: 'SP',
      })));
    const result = await service.lookup('01001000');
    expect(result.state).toBe('SP');
  });

  it('accepts ceplite response with empty street/neighborhood (general city CEP)', async () => {
    httpGet.mockReturnValueOnce(of(ok({
      cep: '69900-000', logradouro: '', bairro: '', cidade: 'Rio Branco', uf: 'AC',
    })));
    const result = await service.lookup('69900000');
    expect(result).toEqual({
      cep: '69900000', street: '', neighborhood: '', city: 'Rio Branco', state: 'AC',
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
```bash
pnpm --filter backend test -- cep.service.spec
```

Expected: All tests FAIL with "Cannot find module './cep.service'".

---

## Task 5: Implement `CepService`

**Files:**
- Create: `apps/backend/src/modules/core/cep/cep.service.ts`

- [ ] **Step 1: Implement the service**

Write `apps/backend/src/modules/core/cep/cep.service.ts`:

```typescript
import {
  Injectable,
  Logger,
  BadRequestException,
  BadGatewayException,
  NotFoundException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';
import { CepLookupResponseDto } from './dto/cep-lookup-response.dto';

interface CepliteRaw {
  cep?: string;
  logradouro?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
}

interface ViaCepRaw {
  cep?: string;
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  erro?: boolean;
}

const REQUEST_TIMEOUT_MS = 3000;

@Injectable()
export class CepService {
  private readonly logger = new Logger(CepService.name);

  constructor(private readonly http: HttpService) {}

  async lookup(rawCep: string): Promise<CepLookupResponseDto> {
    const cep = (rawCep ?? '').replace(/\D/g, '');
    if (cep.length !== 8) {
      throw new BadRequestException('CEP inválido');
    }

    const cepliteOutcome = await this.tryCeplite(cep);
    if (cepliteOutcome.kind === 'ok') return cepliteOutcome.value;

    const viacepOutcome = await this.tryViaCep(cep);
    if (viacepOutcome.kind === 'ok') return viacepOutcome.value;

    if (cepliteOutcome.kind === 'not-found' && viacepOutcome.kind === 'not-found') {
      throw new NotFoundException('CEP não encontrado');
    }

    this.logger.error(`[CepService] both ceplite and viacep failed for ${cep}`);
    throw new BadGatewayException('Falha ao consultar CEP');
  }

  private async tryCeplite(cep: string): Promise<Outcome> {
    try {
      const res = await firstValueFrom(
        this.http.get<CepliteRaw>(`https://ceplite.com.br/cep/${cep}`, {
          timeout: REQUEST_TIMEOUT_MS,
        }),
      );
      const normalized = this.normalizeCeplite(res.data, cep);
      if (normalized) return { kind: 'ok', value: normalized };
      return { kind: 'fail' };
    } catch (err) {
      const axiosErr = err as AxiosError;
      this.logger.warn(
        `[CepService] ceplite failed for ${cep}, falling back to viacep. Reason: ${axiosErr.message}`,
      );
      if (axiosErr.response?.status === 404) return { kind: 'not-found' };
      return { kind: 'fail' };
    }
  }

  private async tryViaCep(cep: string): Promise<Outcome> {
    try {
      const res = await firstValueFrom(
        this.http.get<ViaCepRaw>(`https://viacep.com.br/ws/${cep}/json/`, {
          timeout: REQUEST_TIMEOUT_MS,
        }),
      );
      if (res.data?.erro === true) return { kind: 'not-found' };
      const normalized = this.normalizeViaCep(res.data, cep);
      if (normalized) return { kind: 'ok', value: normalized };
      return { kind: 'fail' };
    } catch (err) {
      const axiosErr = err as AxiosError;
      if (axiosErr.response?.status === 404) return { kind: 'not-found' };
      return { kind: 'fail' };
    }
  }

  private normalizeCeplite(raw: CepliteRaw | null | undefined, cep: string): CepLookupResponseDto | null {
    if (!raw || typeof raw !== 'object') return null;
    if (raw.cidade === undefined || raw.uf === undefined) return null;
    return {
      cep,
      street: raw.logradouro ?? '',
      neighborhood: raw.bairro ?? '',
      city: raw.cidade ?? '',
      state: raw.uf ?? '',
    };
  }

  private normalizeViaCep(raw: ViaCepRaw | null | undefined, cep: string): CepLookupResponseDto | null {
    if (!raw || typeof raw !== 'object') return null;
    if (raw.localidade === undefined || raw.uf === undefined) return null;
    return {
      cep,
      street: raw.logradouro ?? '',
      neighborhood: raw.bairro ?? '',
      city: raw.localidade ?? '',
      state: raw.uf ?? '',
    };
  }
}

type Outcome =
  | { kind: 'ok'; value: CepLookupResponseDto }
  | { kind: 'not-found' }
  | { kind: 'fail' };
```

- [ ] **Step 2: Run tests to verify they pass**

Run:
```bash
pnpm --filter backend test -- cep.service.spec
```

Expected: All 7 tests PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/backend/src/modules/core/cep/cep.service.ts apps/backend/src/modules/core/cep/cep.service.spec.ts
git commit -m "feat(cep): implement CepService with ceplite primary and viacep fallback"
```

---

## Task 6: Implement `CepController`

**Files:**
- Create: `apps/backend/src/modules/core/cep/cep.controller.ts`

- [ ] **Step 1: Create the controller**

Write `apps/backend/src/modules/core/cep/cep.controller.ts`:

```typescript
import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CepService } from './cep.service';
import { CepLookupResponseDto } from './dto/cep-lookup-response.dto';

@Controller('cep')
@UseGuards(JwtAuthGuard)
export class CepController {
  constructor(private readonly cepService: CepService) {}

  @Get(':cep')
  async lookup(@Param('cep') cep: string): Promise<CepLookupResponseDto> {
    return this.cepService.lookup(cep);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/backend/src/modules/core/cep/cep.controller.ts
git commit -m "feat(cep): add CepController with JwtAuthGuard"
```

---

## Task 7: Wire `CepModule` and register in `AppModule`

**Files:**
- Create: `apps/backend/src/modules/core/cep/cep.module.ts`
- Modify: `apps/backend/src/app.module.ts`

- [ ] **Step 1: Create the module**

Write `apps/backend/src/modules/core/cep/cep.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { CepController } from './cep.controller';
import { CepService } from './cep.service';

@Module({
  imports: [HttpModule],
  controllers: [CepController],
  providers: [CepService],
})
export class CepModule {}
```

- [ ] **Step 2: Register in `AppModule`**

In `apps/backend/src/app.module.ts`, add the import at the top with the other module imports:

```typescript
import { CepModule } from './modules/core/cep/cep.module';
```

And add `CepModule` to the `imports` array (place it after `BillingModule` to keep core modules grouped):

```typescript
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    ScheduleModule.forRoot(),
    DatabaseModule,
    TenancyModule,
    AuthModule,
    BillingModule,
    CepModule,
    CompaniesModule,
    CustomersModule,
    VehiclesModule,
    CatalogModule,
    AppointmentsModule,
    ServiceOrdersModule,
    ReportsModule,
    RecyclingModule,
  ],
```

- [ ] **Step 3: Verify the backend compiles**

Run:
```bash
pnpm --filter backend build
```

Expected: Build succeeds with no errors.

- [ ] **Step 4: Smoke test the endpoint manually**

Start the backend in one terminal:
```bash
pnpm --filter backend start:dev
```

In another terminal, log in via the existing API (e.g., POST `/auth/login`) to get a JWT, then:
```bash
curl -H "Authorization: Bearer <YOUR_JWT>" http://localhost:3000/api/cep/01001000
```

Expected: JSON response with the shape `{ cep, street, neighborhood, city, state }`.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/core/cep/cep.module.ts apps/backend/src/app.module.ts
git commit -m "feat(cep): register CepModule in AppModule"
```

---

## Task 8: Add `neighborhood` to backend address types and DTOs

**Files:**
- Modify: `apps/backend/src/modules/core/tenancy/tenant.entity.ts`
- Modify: `apps/backend/src/modules/recycling/suppliers/supplier.entity.ts`
- Modify: `apps/backend/src/modules/workshop/companies/dto/update-company.dto.ts`
- Modify: `apps/backend/src/modules/recycling/suppliers/dto/create-supplier.dto.ts`

- [ ] **Step 1: Add `neighborhood` to `TenantAddress`**

In `apps/backend/src/modules/core/tenancy/tenant.entity.ts`, change the `TenantAddress` type to:

```typescript
export type TenantAddress = {
  street: string;
  number: string;
  neighborhood?: string;
  complement?: string;
  city: string;
  state: string;
  zip: string;
};
```

- [ ] **Step 2: Add `neighborhood` to `SupplierAddress`**

In `apps/backend/src/modules/recycling/suppliers/supplier.entity.ts`, change the `SupplierAddress` type to:

```typescript
export type SupplierAddress = {
  street: string;
  number: string;
  neighborhood?: string;
  complement?: string;
  city: string;
  state: string;
  zip: string;
};
```

- [ ] **Step 3: Add `neighborhood` to `AddressUpdateDto`**

In `apps/backend/src/modules/workshop/companies/dto/update-company.dto.ts`, add the new property to `AddressUpdateDto` (place it after `number` and before `complement` to mirror the entity order):

```typescript
class AddressUpdateDto {
  @IsOptional()
  @IsString()
  street?: string;

  @IsOptional()
  @IsString()
  number?: string;

  @IsOptional()
  @IsString()
  neighborhood?: string;

  @IsOptional()
  @IsString()
  complement?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  zip?: string;
}
```

- [ ] **Step 4: Add `neighborhood` to `CreateSupplierDto.address`**

In `apps/backend/src/modules/recycling/suppliers/dto/create-supplier.dto.ts`, change the inline address shape to:

```typescript
  @IsOptional()
  address?: {
    street: string;
    number: string;
    neighborhood?: string;
    complement?: string;
    city: string;
    state: string;
    zip: string;
  };
```

(`UpdateSupplierDto` extends `PartialType(CreateSupplierDto)`, so it inherits automatically — no change needed there.)

- [ ] **Step 5: Verify the backend compiles**

Run:
```bash
pnpm --filter backend build
```

Expected: Build succeeds.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/modules/core/tenancy/tenant.entity.ts apps/backend/src/modules/recycling/suppliers/supplier.entity.ts apps/backend/src/modules/workshop/companies/dto/update-company.dto.ts apps/backend/src/modules/recycling/suppliers/dto/create-supplier.dto.ts
git commit -m "feat(address): add optional neighborhood to backend address types and DTOs"
```

---

## Task 9: Install `use-debounce` on the frontend

**Files:**
- Modify: `apps/frontend/package.json`

- [ ] **Step 1: Add the dependency**

Run:
```bash
pnpm --filter frontend add use-debounce
```

Expected: `apps/frontend/package.json` has `use-debounce` under `dependencies`.

- [ ] **Step 2: Commit**

```bash
git add apps/frontend/package.json pnpm-lock.yaml
git commit -m "chore(frontend): add use-debounce for CEP lookup"
```

---

## Task 10: Add `neighborhood` to frontend service types

**Files:**
- Modify: `apps/frontend/src/services/company.service.ts`
- Modify: `apps/frontend/src/services/recycling/suppliers.service.ts`

- [ ] **Step 1: Update `CompanyAddress`**

In `apps/frontend/src/services/company.service.ts`, change the `CompanyAddress` interface to:

```typescript
export interface CompanyAddress {
  street: string;
  number: string;
  neighborhood?: string;
  complement?: string;
  city: string;
  state: string;
  zip: string;
}
```

- [ ] **Step 2: Update `Supplier.address`**

In `apps/frontend/src/services/recycling/suppliers.service.ts`, change the `Supplier` interface's `address` to:

```typescript
  address: {
    street: string;
    number: string;
    neighborhood?: string;
    complement?: string;
    city: string;
    state: string;
    zip: string;
  } | null;
```

- [ ] **Step 3: Verify the frontend compiles**

Run:
```bash
pnpm --filter frontend exec tsc -b --noEmit
```

Expected: No TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/services/company.service.ts apps/frontend/src/services/recycling/suppliers.service.ts
git commit -m "feat(address): add optional neighborhood to frontend address types"
```

---

## Task 11: Write failing test for `cep.service.ts` (frontend)

**Files:**
- Create: `apps/frontend/src/services/cep.service.test.ts`

- [ ] **Step 1: Write the test**

Write `apps/frontend/src/services/cep.service.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./api', () => ({
  api: { get: vi.fn() },
}));

import { lookupCep } from './cep.service';
import { api } from './api';
const mockApi = api as any;

describe('lookupCep', () => {
  beforeEach(() => vi.clearAllMocks());

  it('strips non-digits before calling the backend', async () => {
    mockApi.get.mockResolvedValue({
      data: { cep: '01001000', street: 'Praça da Sé', neighborhood: 'Sé', city: 'São Paulo', state: 'SP' },
    });
    const result = await lookupCep('01001-000');
    expect(mockApi.get).toHaveBeenCalledWith('/cep/01001000');
    expect(result.city).toBe('São Paulo');
  });

  it('propagates errors from axios', async () => {
    mockApi.get.mockRejectedValue({ response: { status: 404 } });
    await expect(lookupCep('00000000')).rejects.toMatchObject({ response: { status: 404 } });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
pnpm --filter frontend test -- cep.service.test
```

Expected: Test FAILS with "Failed to resolve import './cep.service'".

---

## Task 12: Implement `cep.service.ts`

**Files:**
- Create: `apps/frontend/src/services/cep.service.ts`

- [ ] **Step 1: Implement the service**

Write `apps/frontend/src/services/cep.service.ts`:

```typescript
import { api } from './api';
import type { CepLookupResponse } from '@praktikus/shared';

export async function lookupCep(cep: string): Promise<CepLookupResponse> {
  const clean = cep.replace(/\D/g, '');
  const { data } = await api.get<CepLookupResponse>(`/cep/${clean}`);
  return data;
}
```

- [ ] **Step 2: Run test to verify it passes**

Run:
```bash
pnpm --filter frontend test -- cep.service.test
```

Expected: Both tests PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/services/cep.service.ts apps/frontend/src/services/cep.service.test.ts
git commit -m "feat(frontend): add cep.service for CEP lookup"
```

---

## Task 13: Write failing test for `useCepLookup` hook

**Files:**
- Create: `apps/frontend/src/hooks/useCepLookup.test.tsx`

- [ ] **Step 1: Write the test**

Write `apps/frontend/src/hooks/useCepLookup.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { UseFormSetValue, FieldValues } from 'react-hook-form';

vi.mock('../services/cep.service', () => ({
  lookupCep: vi.fn(),
}));

import { useCepLookup } from './useCepLookup';
import { lookupCep } from '../services/cep.service';

const mockLookup = lookupCep as unknown as ReturnType<typeof vi.fn>;

function renderUseCepLookup() {
  const setValue = vi.fn() as unknown as UseFormSetValue<FieldValues>;
  const hook = renderHook(() => useCepLookup<FieldValues>({ setValue }));
  return { hook, setValue: setValue as unknown as ReturnType<typeof vi.fn> };
}

describe('useCepLookup', () => {
  beforeEach(() => vi.clearAllMocks());

  it('does not call lookupCep when CEP has fewer than 8 digits', async () => {
    const { hook } = renderUseCepLookup();
    act(() => {
      hook.result.current.onCepChange('123');
    });
    await new Promise((r) => setTimeout(r, 400));
    expect(mockLookup).not.toHaveBeenCalled();
  });

  it('calls lookupCep and populates fields when CEP has 8 digits', async () => {
    mockLookup.mockResolvedValue({
      cep: '01001000', street: 'Praça da Sé', neighborhood: 'Sé', city: 'São Paulo', state: 'SP',
    });
    const { hook, setValue } = renderUseCepLookup();
    act(() => {
      hook.result.current.onCepChange('01001-000');
    });
    await waitFor(() => expect(mockLookup).toHaveBeenCalledWith('01001-000'));
    await waitFor(() => {
      expect(setValue).toHaveBeenCalledWith('street', 'Praça da Sé', { shouldDirty: true });
      expect(setValue).toHaveBeenCalledWith('neighborhood', 'Sé', { shouldDirty: true });
      expect(setValue).toHaveBeenCalledWith('city', 'São Paulo', { shouldDirty: true });
      expect(setValue).toHaveBeenCalledWith('state', 'SP', { shouldDirty: true });
    });
  });

  it('sets "CEP não encontrado" message on 404', async () => {
    mockLookup.mockRejectedValue({ response: { status: 404 } });
    const { hook } = renderUseCepLookup();
    act(() => {
      hook.result.current.onCepChange('00000000');
    });
    await waitFor(() => expect(hook.result.current.error).toBe('CEP não encontrado'));
  });

  it('sets generic error message on non-404 error', async () => {
    mockLookup.mockRejectedValue({ response: { status: 502 } });
    const { hook } = renderUseCepLookup();
    act(() => {
      hook.result.current.onCepChange('12345678');
    });
    await waitFor(() => expect(hook.result.current.error).toBe('Não foi possível consultar o CEP'));
  });

  it('toggles isLoading around the call', async () => {
    let resolve!: (v: any) => void;
    mockLookup.mockReturnValue(new Promise((r) => { resolve = r; }));
    const { hook } = renderUseCepLookup();
    act(() => {
      hook.result.current.onCepChange('01001000');
    });
    await waitFor(() => expect(hook.result.current.isLoading).toBe(true));
    act(() => {
      resolve({ cep: '01001000', street: '', neighborhood: '', city: '', state: '' });
    });
    await waitFor(() => expect(hook.result.current.isLoading).toBe(false));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
pnpm --filter frontend test -- useCepLookup
```

Expected: Test FAILS with "Failed to resolve import './useCepLookup'".

---

## Task 14: Implement `useCepLookup` hook

**Files:**
- Create: `apps/frontend/src/hooks/useCepLookup.ts`

- [ ] **Step 1: Implement the hook**

Write `apps/frontend/src/hooks/useCepLookup.ts`:

```typescript
import { useState } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import type { UseFormSetValue, FieldValues } from 'react-hook-form';
import { lookupCep } from '../services/cep.service';

interface UseCepLookupOptions<T extends FieldValues> {
  setValue: UseFormSetValue<T>;
  fields?: {
    street?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
  };
}

export function useCepLookup<T extends FieldValues>({
  setValue,
  fields,
}: UseCepLookupOptions<T>) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // setValue is generic over Path<T> and FieldPathValue<T, Path<T>> — at this layer
  // we don't know the concrete form shape, so cast to a permissive signature.
  const set = setValue as unknown as (
    name: string,
    value: string,
    options?: { shouldDirty?: boolean },
  ) => void;

  const onCepChange = useDebouncedCallback(async (rawCep: string) => {
    const clean = rawCep.replace(/\D/g, '');
    if (clean.length !== 8) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await lookupCep(rawCep);
      const opts = { shouldDirty: true };
      set(fields?.street ?? 'street', data.street, opts);
      set(fields?.neighborhood ?? 'neighborhood', data.neighborhood, opts);
      set(fields?.city ?? 'city', data.city, opts);
      set(fields?.state ?? 'state', data.state, opts);
    } catch (err) {
      const e = err as { response?: { status?: number } };
      if (e?.response?.status === 404) setError('CEP não encontrado');
      else setError('Não foi possível consultar o CEP');
    } finally {
      setIsLoading(false);
    }
  }, 300);

  return { onCepChange, isLoading, error };
}
```

- [ ] **Step 2: Run test to verify it passes**

Run:
```bash
pnpm --filter frontend test -- useCepLookup
```

Expected: All 5 tests PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/hooks/useCepLookup.ts apps/frontend/src/hooks/useCepLookup.test.tsx
git commit -m "feat(frontend): add useCepLookup hook with 300ms debounce"
```

---

## Task 15: Write failing test for `<AddressFields />`

**Files:**
- Create: `apps/frontend/src/components/forms/AddressFields.test.tsx`

- [ ] **Step 1: Write the test**

Write `apps/frontend/src/components/forms/AddressFields.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm } from 'react-hook-form';

vi.mock('../../services/cep.service', () => ({
  lookupCep: vi.fn(),
}));

import { AddressFields } from './AddressFields';
import { lookupCep } from '../../services/cep.service';

const mockLookup = lookupCep as unknown as ReturnType<typeof vi.fn>;

interface Form {
  street: string;
  number: string;
  neighborhood: string;
  complement: string;
  city: string;
  state: string;
  zip: string;
}

function Harness() {
  const { control, setValue, formState: { errors } } = useForm<Form>({
    defaultValues: {
      street: '', number: '', neighborhood: '', complement: '', city: '', state: '', zip: '',
    },
  });
  return <AddressFields control={control} setValue={setValue} errors={errors} />;
}

describe('<AddressFields />', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders all 7 address inputs', () => {
    render(<Harness />);
    expect(screen.getByLabelText(/CEP/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Rua/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Número/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Bairro/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Complemento/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Cidade/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Estado/i)).toBeInTheDocument();
  });

  it('fills street/neighborhood/city/state when 8 digits are typed in CEP', async () => {
    mockLookup.mockResolvedValue({
      cep: '01001000', street: 'Praça da Sé', neighborhood: 'Sé', city: 'São Paulo', state: 'SP',
    });
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(screen.getByLabelText(/CEP/i), '01001000');
    await waitFor(() => expect(mockLookup).toHaveBeenCalled());
    await waitFor(() => {
      expect(screen.getByLabelText(/Rua/i)).toHaveValue('Praça da Sé');
      expect(screen.getByLabelText(/Bairro/i)).toHaveValue('Sé');
      expect(screen.getByLabelText(/Cidade/i)).toHaveValue('São Paulo');
      expect(screen.getByLabelText(/Estado/i)).toHaveValue('SP');
    });
  });

  it('shows an error message below CEP when lookup fails with 404', async () => {
    mockLookup.mockRejectedValue({ response: { status: 404 } });
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(screen.getByLabelText(/CEP/i), '00000000');
    await waitFor(() => expect(screen.getByText(/CEP não encontrado/i)).toBeInTheDocument());
  });

  it('keeps fields editable after auto-fill', async () => {
    mockLookup.mockResolvedValue({
      cep: '01001000', street: 'Praça da Sé', neighborhood: 'Sé', city: 'São Paulo', state: 'SP',
    });
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(screen.getByLabelText(/CEP/i), '01001000');
    await waitFor(() => expect(screen.getByLabelText(/Rua/i)).toHaveValue('Praça da Sé'));
    await user.clear(screen.getByLabelText(/Rua/i));
    await user.type(screen.getByLabelText(/Rua/i), 'Outra Rua');
    expect(screen.getByLabelText(/Rua/i)).toHaveValue('Outra Rua');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
pnpm --filter frontend test -- AddressFields
```

Expected: Test FAILS with "Failed to resolve import './AddressFields'".

---

## Task 16: Implement `<AddressFields />`

**Files:**
- Create: `apps/frontend/src/components/forms/AddressFields.tsx`

- [ ] **Step 1: Implement the component**

Write `apps/frontend/src/components/forms/AddressFields.tsx`:

```tsx
import { Controller } from 'react-hook-form';
import type { Control, FieldErrors, FieldValues, UseFormSetValue, Path } from 'react-hook-form';
import { CFormFeedback, CFormInput, CFormLabel, CSpinner } from '@coreui/react';
import { useCepLookup } from '../../hooks/useCepLookup';

const labelStyle: React.CSSProperties = { fontWeight: 500, fontSize: 13 };

interface AddressFieldsProps<T extends FieldValues> {
  control: Control<T>;
  setValue: UseFormSetValue<T>;
  errors?: FieldErrors<T>;
  disabled?: boolean;
}

export function AddressFields<T extends FieldValues>({
  control,
  setValue,
  disabled,
}: AddressFieldsProps<T>) {
  const { onCepChange, isLoading, error } = useCepLookup<T>({ setValue });

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 12 }}>
      <div style={{ gridColumn: 'span 4' }}>
        <CFormLabel style={labelStyle} htmlFor="address-zip">
          CEP
        </CFormLabel>
        <div style={{ position: 'relative' }}>
          <Controller
            control={control}
            name={'zip' as Path<T>}
            render={({ field }) => (
              <CFormInput
                id="address-zip"
                placeholder="00000-000"
                disabled={disabled}
                value={(field.value as string) ?? ''}
                onChange={(e) => {
                  field.onChange(e);
                  onCepChange(e.target.value);
                }}
                onBlur={field.onBlur}
                invalid={!!error}
              />
            )}
          />
          {isLoading && (
            <div style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)' }}>
              <CSpinner size="sm" />
            </div>
          )}
        </div>
        {error && <CFormFeedback invalid>{error}</CFormFeedback>}
      </div>

      <div style={{ gridColumn: 'span 8' }}>
        <CFormLabel style={labelStyle} htmlFor="address-street">
          Rua
        </CFormLabel>
        <Controller
          control={control}
          name={'street' as Path<T>}
          render={({ field }) => (
            <CFormInput id="address-street" disabled={disabled} value={(field.value as string) ?? ''} onChange={field.onChange} />
          )}
        />
      </div>

      <div style={{ gridColumn: 'span 3' }}>
        <CFormLabel style={labelStyle} htmlFor="address-number">
          Número
        </CFormLabel>
        <Controller
          control={control}
          name={'number' as Path<T>}
          render={({ field }) => (
            <CFormInput id="address-number" disabled={disabled} value={(field.value as string) ?? ''} onChange={field.onChange} />
          )}
        />
      </div>

      <div style={{ gridColumn: 'span 5' }}>
        <CFormLabel style={labelStyle} htmlFor="address-neighborhood">
          Bairro
        </CFormLabel>
        <Controller
          control={control}
          name={'neighborhood' as Path<T>}
          render={({ field }) => (
            <CFormInput id="address-neighborhood" disabled={disabled} value={(field.value as string) ?? ''} onChange={field.onChange} />
          )}
        />
      </div>

      <div style={{ gridColumn: 'span 4' }}>
        <CFormLabel style={labelStyle} htmlFor="address-complement">
          Complemento
        </CFormLabel>
        <Controller
          control={control}
          name={'complement' as Path<T>}
          render={({ field }) => (
            <CFormInput id="address-complement" disabled={disabled} value={(field.value as string) ?? ''} onChange={field.onChange} />
          )}
        />
      </div>

      <div style={{ gridColumn: 'span 10' }}>
        <CFormLabel style={labelStyle} htmlFor="address-city">
          Cidade
        </CFormLabel>
        <Controller
          control={control}
          name={'city' as Path<T>}
          render={({ field }) => (
            <CFormInput id="address-city" disabled={disabled} value={(field.value as string) ?? ''} onChange={field.onChange} />
          )}
        />
      </div>

      <div style={{ gridColumn: 'span 2' }}>
        <CFormLabel style={labelStyle} htmlFor="address-state">
          Estado
        </CFormLabel>
        <Controller
          control={control}
          name={'state' as Path<T>}
          render={({ field }) => (
            <CFormInput
              id="address-state"
              maxLength={2}
              placeholder="SP"
              disabled={disabled}
              value={(field.value as string) ?? ''}
              onChange={field.onChange}
            />
          )}
        />
      </div>
    </div>
  );
}
```

Note: `errors` is accepted in the public interface for future per-field validation messages, but is not destructured today (would trigger `noUnusedLocals`). Consumers continue to pass it without runtime impact.

- [ ] **Step 2: Run test to verify it passes**

Run:
```bash
pnpm --filter frontend test -- AddressFields
```

Expected: All 4 tests PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/components/forms/AddressFields.tsx apps/frontend/src/components/forms/AddressFields.test.tsx
git commit -m "feat(frontend): add reusable AddressFields component with CEP autofill"
```

---

## Task 17: Migrate `CompanyTab` to use `<AddressFields />`

**Files:**
- Modify: `apps/frontend/src/components/settings/CompanyTab.tsx`

- [ ] **Step 1: Add `neighborhood` to schema and form type**

In `apps/frontend/src/components/settings/CompanyTab.tsx`, change the `companySchema` to include `neighborhood`:

```typescript
const companySchema = z.object({
  nomeFantasia: z.string().min(2, 'Mínimo 2 caracteres'),
  razaoSocial: z.string().min(3, 'Mínimo 3 caracteres'),
  telefone: z.string().optional(),
  street: z.string().optional(),
  number: z.string().optional(),
  neighborhood: z.string().optional(),
  complement: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
});
```

- [ ] **Step 2: Destructure `setValue` and `control` from `useForm`**

Replace the existing `useForm` line:

```typescript
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } =
    useForm<CompanyForm>({ resolver: zodResolver(companySchema) });
```

with:

```typescript
  const { register, control, setValue, handleSubmit, reset, formState: { errors, isSubmitting } } =
    useForm<CompanyForm>({ resolver: zodResolver(companySchema) });
```

- [ ] **Step 3: Add `neighborhood` to `defaultValues` in `reset()`**

In the `useEffect` that loads the profile, add `neighborhood` to the `reset` call:

```typescript
      reset({
        nomeFantasia: p.nomeFantasia,
        razaoSocial: p.razaoSocial,
        telefone: p.telefone ?? '',
        street: p.endereco?.street ?? '',
        number: p.endereco?.number ?? '',
        neighborhood: p.endereco?.neighborhood ?? '',
        complement: p.endereco?.complement ?? '',
        city: p.endereco?.city ?? '',
        state: p.endereco?.state ?? '',
        zip: p.endereco?.zip ?? '',
      });
```

- [ ] **Step 4: Add `neighborhood` to the submit payload**

In `onSubmit`, change the `endereco` payload to:

```typescript
        endereco: {
          street: data.street ?? '',
          number: data.number ?? '',
          neighborhood: data.neighborhood,
          complement: data.complement,
          city: data.city ?? '',
          state: data.state ?? '',
          zip: data.zip ?? '',
        },
```

- [ ] **Step 5: Add the import for `AddressFields`**

At the top of the file, after the existing imports, add:

```typescript
import { AddressFields } from '../forms/AddressFields';
```

- [ ] **Step 6: Replace the address-fields JSX with `<AddressFields />`**

Find the block (lines 207–234 in current file) that starts with:

```tsx
          <Card header={<CardTitle title="Endereço" desc="Endereço fiscal da empresa" />}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 14 }}>
              <div style={{ gridColumn: 'span 8' }}>
                <CFormLabel style={labelStyle}>Rua</CFormLabel>
```

…and replace the entire `<Card>` body (the `<div style={{ display: 'grid', ... }}>` and all 6 nested `<div>` inputs inside it) with:

```tsx
          <Card header={<CardTitle title="Endereço" desc="Endereço fiscal da empresa" />}>
            <AddressFields control={control} setValue={setValue} errors={errors} />
          </Card>
```

- [ ] **Step 7: Run typecheck and tests**

Run:
```bash
pnpm --filter frontend exec tsc -b --noEmit
pnpm --filter frontend test
```

Expected: Both succeed.

- [ ] **Step 8: Smoke test in the browser**

Start the frontend dev server (and the backend if not running):
```bash
pnpm --filter frontend dev
```

Navigate to `/workshop/settings` (workshop tenant) and `/recycling/settings` (recycling tenant), open the "Empresa" tab, and:

1. Type `01001-000` in the CEP field. Confirm street, neighborhood, city, and state autofill.
2. Click "Salvar alterações". Reload and confirm the values persist (including the new bairro).

- [ ] **Step 9: Commit**

```bash
git add apps/frontend/src/components/settings/CompanyTab.tsx
git commit -m "feat(settings): use AddressFields with CEP autofill in CompanyTab"
```

---

## Task 18: Migrate `SupplierFormDialog` to use `<AddressFields />`

**Files:**
- Modify: `apps/frontend/src/pages/recycling/suppliers/SuppliersPage.tsx`

- [ ] **Step 1: Add `neighborhood` to the zod schema**

In `apps/frontend/src/pages/recycling/suppliers/SuppliersPage.tsx`, change the `schema` to include `neighborhood`:

```typescript
const schema = z
  .object({
    name: z.string().min(2, 'Nome deve ter ao menos 2 caracteres'),
    documentType: z.enum(['CPF', 'CNPJ', '']).optional(),
    document: z.string().optional(),
    phone: z.string().optional(),
    street: z.string().optional(),
    number: z.string().optional(),
    neighborhood: z.string().optional(),
    complement: z.string().optional(),
    city: z.string().optional(),
    state: z.string().max(2, 'UF deve ter 2 caracteres').optional(),
    zip: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    // ...existing CPF/CNPJ validation block remains unchanged
    if (data.documentType) {
      if (!data.document) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Documento é obrigatório quando o tipo é selecionado',
          path: ['document'],
        });
      } else if (data.documentType === 'CPF' && !/^\d{11}$/.test(data.document)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'CPF deve ter 11 dígitos',
          path: ['document'],
        });
      } else if (data.documentType === 'CNPJ' && !/^\d{14}$/.test(data.document)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'CNPJ deve ter 14 dígitos',
          path: ['document'],
        });
      }
    }
  });
```

- [ ] **Step 2: Destructure `setValue` from `useForm`**

Replace the existing `useForm` destructure inside `SupplierFormDialog`:

```typescript
  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });
```

with:

```typescript
  const {
    register,
    control,
    setValue,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });
```

- [ ] **Step 3: Add `neighborhood` to both `reset()` calls**

In the `useEffect` inside `SupplierFormDialog`, add `neighborhood` to the editing branch:

```typescript
    if (editing) {
      reset({
        name: editing.name,
        documentType: editing.documentType ?? '',
        document: editing.document ?? '',
        phone: editing.phone ?? '',
        street: editing.address?.street ?? '',
        number: editing.address?.number ?? '',
        neighborhood: editing.address?.neighborhood ?? '',
        complement: editing.address?.complement ?? '',
        city: editing.address?.city ?? '',
        state: editing.address?.state ?? '',
        zip: editing.address?.zip ?? '',
      });
    } else {
      reset({
        name: '',
        documentType: '',
        document: '',
        phone: '',
        street: '',
        number: '',
        neighborhood: '',
        complement: '',
        city: '',
        state: '',
        zip: '',
      });
    }
```

- [ ] **Step 4: Update the submit `address` shape**

In `onSubmit`, change the `address` block to:

```typescript
      address: hasAddress
        ? {
            street: data.street ?? '',
            number: data.number ?? '',
            neighborhood: data.neighborhood || undefined,
            complement: data.complement || undefined,
            city: data.city ?? '',
            state: data.state ?? '',
            zip: data.zip ?? '',
          }
        : null,
```

- [ ] **Step 5: Import `AddressFields`**

Add the import near the top of the file (after the `suppliersService` import):

```typescript
import { AddressFields } from '../../../components/forms/AddressFields';
```

- [ ] **Step 6: Replace the address-fields JSX**

Find the block that starts with:

```tsx
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 12 }}>
              <div style={{ gridColumn: 'span 9' }}>
                <CFormLabel style={labelStyle}>Logradouro</CFormLabel>
```

…and ends with the closing `</div>` of the `repeat(12, 1fr)` grid (the final block containing `CEP`, before `</CModalBody>`). Replace the entire grid (the outer `<div style={{ display: 'grid', ... }}>...</div>` containing all 6 address fields) with:

```tsx
            <AddressFields control={control} setValue={setValue} errors={errors} />
```

The "Endereço (opcional)" section divider above it stays in place.

- [ ] **Step 7: Run typecheck and tests**

Run:
```bash
pnpm --filter frontend exec tsc -b --noEmit
pnpm --filter frontend test
```

Expected: Both succeed.

- [ ] **Step 8: Smoke test in the browser**

Start the frontend dev server (and the backend if not running):
```bash
pnpm --filter frontend dev
```

Navigate to `/recycling/suppliers`, click "Novo fornecedor", and:

1. Type `01001-000` in the CEP field. Confirm street, neighborhood, city, and state autofill.
2. Fill in name, click "Salvar". Confirm the supplier appears in the list with the city.
3. Click the edit (pencil) icon on the new supplier — confirm the form reopens with the bairro filled in.

- [ ] **Step 9: Commit**

```bash
git add apps/frontend/src/pages/recycling/suppliers/SuppliersPage.tsx
git commit -m "feat(suppliers): use AddressFields with CEP autofill in supplier form"
```

---

## Task 19: Audit and adjust supplier listing if `bairro` should be displayed

**Files:**
- (Possibly modify) `apps/frontend/src/pages/recycling/suppliers/SuppliersPage.tsx`

- [ ] **Step 1: Inspect the current listing**

The `SuppliersPage` listing today shows a "Cidade" column rendered as `${city}/${state}`. There is no current view where the full address (with bairro) is displayed.

Run:
```bash
grep -nR "address.street\|address?.street\|endereco?.street\|endereco.street" apps/frontend/src
```

Expected: Confirm no other component renders the full address breakdown. If the only matches are inside form `reset()` calls, no listing change is needed.

- [ ] **Step 2: Decide**

If the grep confirms there is no display of the full address, no change is needed in this task. Skip to step 3.

If there is a display somewhere (a detail page, a print template, etc.), modify it to include `bairro` when present, formatting like `${street}, ${number}${neighborhood ? ' - ' + neighborhood : ''}, ${city}/${state}`.

- [ ] **Step 3: Commit (only if a change was made)**

If a change was made:

```bash
git add <changed files>
git commit -m "feat(address): show bairro where address is displayed"
```

If no change was made, skip the commit.

---

## Task 20: Run the full test suite and final verification

**Files:**
- (Verification only)

- [ ] **Step 1: Run backend tests**

```bash
pnpm --filter backend test
```

Expected: All tests pass, including the new `cep.service.spec`.

- [ ] **Step 2: Run frontend tests**

```bash
pnpm --filter frontend test
```

Expected: All tests pass, including `cep.service.test`, `useCepLookup.test`, and `AddressFields.test`.

- [ ] **Step 3: Run linters**

```bash
pnpm lint
```

Expected: No new lint errors.

- [ ] **Step 4: Final smoke test (already done in Tasks 17 and 18, repeat as confirmation)**

Start backend + frontend, log in, and verify CEP autofill in:

1. `/workshop/settings` → Empresa tab.
2. `/recycling/settings` → Empresa tab.
3. `/recycling/suppliers` → "Novo fornecedor" modal.

For each, type `01001-000` and confirm autofill of street, neighborhood, city, and state.

- [ ] **Step 5: No commit needed (verification step only).**

---

## Summary

This plan delivers the CEP-lookup feature spec end-to-end:

- New shared type (`CepLookupResponse`) and backend module (`core/cep`) with ceplite primary + viacep fallback.
- New optional `neighborhood` field threaded through entities, DTOs, frontend services and forms — no DB migration since address columns are JSONB.
- New reusable frontend primitives: `cep.service.ts`, `useCepLookup` hook, `<AddressFields />` component.
- Two existing forms (`CompanyTab`, `SupplierFormDialog`) migrated to `<AddressFields />`, with CEP as the first field of the address section.
- Tests at every layer (backend service unit, frontend service unit, hook unit, component integration).
- Manual smoke test instructions for each of the three places the form appears.
