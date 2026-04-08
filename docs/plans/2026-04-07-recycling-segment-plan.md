# Recycling Segment Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement a complete recycling company segment (empresas de recicláveis) parallel to the existing workshop module, covering registration, employees, products, suppliers, cash register, purchases, stock, buyers, and sales.

**Architecture:** New `modules/recycling/` in the backend (parallel to `workshop/`) + new `pages/recycling/` in the frontend. Single code touch point to existing code: add `segment` field to `TenantEntity` and JWT payload. All recycling tables created via raw SQL in `create-tenant-tables.ts` under the tenant schema.

**Tech Stack:** NestJS + TypeORM + PostgreSQL (schema-per-tenant), React 19 + CoreUI, react-hook-form + zod, Zustand, axios, Jest + React Testing Library.

**Design doc:** `docs/plans/2026-04-07-recycling-segment-design.md`

---

## Task 1: Segment Field + Registration + Routing

Add `TenantSegment` enum, `segment` column to tenant, JWT payload, `/register/recycling` route, and post-login redirect by segment.

**Files:**
- Create: `packages/shared/src/enums/tenant-segment.enum.ts`
- Modify: `packages/shared/src/index.ts`
- Modify: `apps/backend/src/modules/core/tenancy/tenant.entity.ts`
- Modify: `apps/backend/src/modules/core/auth/dto/register.dto.ts`
- Modify: `apps/backend/src/modules/core/tenancy/tenancy.service.ts`
- Modify: `apps/backend/src/modules/core/auth/auth.service.ts`
- Modify: `apps/backend/src/modules/core/auth/jwt.strategy.ts`
- Modify: `apps/frontend/src/store/auth.store.ts`
- Modify: `apps/frontend/src/services/auth.service.ts`
- Modify: `apps/frontend/src/pages/auth/RegisterPage.tsx`
- Create: `apps/frontend/src/pages/auth/RegisterRecyclingPage.tsx`
- Create: `apps/frontend/src/pages/recycling/DashboardPage.tsx`
- Create: `apps/frontend/src/layouts/RecyclingLayout.tsx`
- Modify: `apps/frontend/src/App.tsx`
- Modify: `apps/backend/src/database/tenant-migrations/create-tenant-tables.ts`

### Step 1: Create TenantSegment enum in shared package

```typescript
// packages/shared/src/enums/tenant-segment.enum.ts
export enum TenantSegment {
  WORKSHOP = 'WORKSHOP',
  RECYCLING = 'RECYCLING',
}
```

### Step 2: Export from shared index

In `packages/shared/src/index.ts`, add:
```typescript
export * from './enums/tenant-segment.enum';
```

### Step 3: Add `segment` to TenantEntity

In `apps/backend/src/modules/core/tenancy/tenant.entity.ts`, add import and column after `billingAnchorDate`:
```typescript
import { TenantSegment } from '@praktikus/shared';

// inside the class, after billingAnchorDate column:
@Column({
  type: 'varchar',
  default: TenantSegment.WORKSHOP,
})
segment: TenantSegment;
```

### Step 4: Add segment to RegisterDto

In `apps/backend/src/modules/core/auth/dto/register.dto.ts`, add:
```typescript
import { IsEnum, IsOptional } from 'class-validator';
import { TenantSegment } from '@praktikus/shared';

// inside RegisterDto class:
@IsOptional()
@IsEnum(TenantSegment)
segment?: TenantSegment;
```

### Step 5: Update TenancyService to accept segment

In `apps/backend/src/modules/core/tenancy/tenancy.service.ts`, update `CreateTenantInput`:
```typescript
interface CreateTenantInput {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string;
  telefone?: string;
  endereco?: TenantEntity['endereco'];
  segment?: TenantSegment; // add this
}
```

In both `createTenant` and `createTenantWithManager`, add `segment` to the create call:
```typescript
// add to manager.create(TenantEntity, { ... }):
segment: input.segment ?? TenantSegment.WORKSHOP,
```

### Step 6: Update AuthService.register to pass segment

In `apps/backend/src/modules/core/auth/auth.service.ts`, update the call to `createTenantWithManager`:
```typescript
const tenant = await this.tenancyService.createTenantWithManager(
  {
    cnpj: dto.cnpj,
    razaoSocial: dto.razaoSocial,
    nomeFantasia: dto.nomeFantasia,
    telefone: dto.telefone,
    endereco: dto.endereco,
    segment: dto.segment,  // add this line
  },
  manager,
);
```

Then find where the JWT access token is signed (look for `jwtService.sign`) and add `tenant_segment: tenant.segment` to the payload:
```typescript
// in the signTokens / generateTokens method, add to payload:
tenant_segment: tenant.segment,
```

### Step 7: Update JWT types

In `apps/backend/src/modules/core/auth/jwt.strategy.ts`:
```typescript
export interface JwtPayload {
  sub: string;
  tenant_id: string;
  role: string;
  name?: string;
  email?: string;
  tenant_status?: string;
  tenant_segment?: string;  // add this
  iat?: number;
  exp?: number;
}

export interface AuthUser {
  userId: string;
  tenantId: string;
  role: string;
  email: string;
  tenantStatus: TenantStatus;
  tenantSegment: string;  // add this
}

// in validate():
return {
  userId: payload.sub,
  tenantId: payload.tenant_id,
  role: payload.role,
  email: user.email,
  tenantStatus: (payload.tenant_status as TenantStatus) ?? TenantStatus.ACTIVE,
  tenantSegment: payload.tenant_segment ?? TenantSegment.WORKSHOP,  // add this
};
```

### Step 8: Update frontend auth store and types

In `apps/frontend/src/store/auth.store.ts`, add `tenant_segment` to `JwtUser`:
```typescript
export interface JwtUser {
  sub: string;
  tenant_id: string;
  role: 'OWNER' | 'EMPLOYEE';
  name: string;
  email: string;
  exp: number;
  tenant_status: 'TRIAL' | 'ACTIVE' | 'OVERDUE' | 'SUSPENDED';
  tenant_segment: 'WORKSHOP' | 'RECYCLING';  // add this
}
```

### Step 9: Update auth service frontend

In `apps/frontend/src/services/auth.service.ts`, add `segment` to `RegisterPayload`:
```typescript
export interface RegisterPayload {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string;
  email: string;
  password: string;
  ownerName: string;
  telefone?: string;
  segment?: 'WORKSHOP' | 'RECYCLING';  // add this
}
```

### Step 10: Create RegisterRecyclingPage

Create `apps/frontend/src/pages/auth/RegisterRecyclingPage.tsx` — copy RegisterPage but:
- Change step label from `'Dados da Oficina'` to `'Dados da Empresa'`
- Change subtitle from `'Cadastre sua oficina — 30 dias grátis'` to `'Cadastre sua recicladora — 30 dias grátis'`
- Pass `segment: 'RECYCLING'` in the register call
- On success, navigate to `/recycling/dashboard` instead of `/workshop/dashboard`

```typescript
const tokens = await authService.register({ ...step1Data, ...rest, segment: 'RECYCLING' });
setTokens(tokens);
navigate('/recycling/dashboard');
```

### Step 11: Create stub recycling dashboard page

```typescript
// apps/frontend/src/pages/recycling/DashboardPage.tsx
export function RecyclingDashboardPage() {
  return (
    <div>
      <h4>Dashboard — Reciclagem</h4>
      <p className="text-secondary">Em construção.</p>
    </div>
  );
}
```

### Step 12: Create RecyclingLayout

Copy `apps/frontend/src/layouts/AppLayout.tsx` to `apps/frontend/src/layouts/RecyclingLayout.tsx` and change `navItems` to:
```typescript
const navItems = [
  { label: 'Dashboard', icon: cilSpeedometer, path: '/recycling/dashboard', ownerOnly: false },
  { label: 'Caixa', icon: cilDollar, path: '/recycling/cash-register', ownerOnly: false },
  { label: 'Compras', icon: cilBasket, path: '/recycling/purchases', ownerOnly: false },
  { label: 'Estoque', icon: cilStorage, path: '/recycling/stock', ownerOnly: false },
  { label: 'Vendas', icon: cilCart, path: '/recycling/sales', ownerOnly: false },
  { label: 'Fornecedores', icon: cilPeople, path: '/recycling/suppliers', ownerOnly: false },
  { label: 'Compradores', icon: cilFactory, path: '/recycling/buyers', ownerOnly: true },
  { label: 'Produtos', icon: cilList, path: '/recycling/products', ownerOnly: true },
  { label: 'Funcionários', icon: cilGroup, path: '/recycling/employees', ownerOnly: true },
  { label: 'Configurações', icon: cilSettings, path: '/recycling/settings', ownerOnly: true },
];
```

Use icons available in `@coreui/icons`: `cilDollar`, `cilStorage`, `cilCart`, `cilBasket`, `cilFactory`, `cilGroup`.

### Step 13: Update App.tsx routing

In `apps/frontend/src/App.tsx`, add imports and routes:
```typescript
import { RegisterRecyclingPage } from './pages/auth/RegisterRecyclingPage';
import { RecyclingDashboardPage } from './pages/recycling/DashboardPage';
import { RecyclingLayout } from './layouts/RecyclingLayout';

// inside <Routes>, add:
<Route path="/register/recycling" element={<RegisterRecyclingPage />} />
<Route
  path="/recycling"
  element={
    <PrivateRoute>
      <RecyclingLayout />
    </PrivateRoute>
  }
>
  <Route index element={<Navigate to="dashboard" replace />} />
  <Route path="dashboard" element={<RecyclingDashboardPage />} />
</Route>
```

Also update `LoginPage` navigation: after login, if `tenant_segment === 'RECYCLING'` navigate to `/recycling/dashboard`. Find where login success navigates (in `LoginPage.tsx`) and update accordingly.

### Step 14: Add recycling tables to tenant provisioning

In `apps/backend/src/database/tenant-migrations/create-tenant-tables.ts`, add recycling tables to the returned array:
```typescript
// Recycling segment tables
`CREATE TABLE IF NOT EXISTS "${schemaName}".units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR NOT NULL,
  abbreviation VARCHAR NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
)`,
`CREATE TABLE IF NOT EXISTS "${schemaName}".products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR NOT NULL,
  unit_id UUID NOT NULL REFERENCES "${schemaName}".units(id) ON DELETE RESTRICT,
  price_per_unit NUMERIC(10,4) NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
)`,
`CREATE TABLE IF NOT EXISTS "${schemaName}".suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR NOT NULL,
  document VARCHAR(18),
  document_type VARCHAR(4),
  phone VARCHAR,
  address JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
)`,
`CREATE TABLE IF NOT EXISTS "${schemaName}".buyers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR NOT NULL,
  cnpj VARCHAR(14),
  phone VARCHAR,
  contact_name VARCHAR,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
)`,
`CREATE TABLE IF NOT EXISTS "${schemaName}".cash_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id UUID NOT NULL,
  closed_by UUID,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  opening_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  closing_balance NUMERIC(12,2),
  status VARCHAR NOT NULL DEFAULT 'OPEN'
)`,
`CREATE TABLE IF NOT EXISTS "${schemaName}".cash_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cash_session_id UUID NOT NULL REFERENCES "${schemaName}".cash_sessions(id) ON DELETE RESTRICT,
  type VARCHAR NOT NULL,
  payment_method VARCHAR NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  description VARCHAR,
  reference_id UUID,
  reference_type VARCHAR,
  created_at TIMESTAMPTZ DEFAULT NOW()
)`,
`CREATE TABLE IF NOT EXISTS "${schemaName}".purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES "${schemaName}".suppliers(id) ON DELETE RESTRICT,
  operator_id UUID NOT NULL,
  cash_session_id UUID REFERENCES "${schemaName}".cash_sessions(id) ON DELETE RESTRICT,
  payment_method VARCHAR NOT NULL,
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  purchased_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes VARCHAR,
  created_at TIMESTAMPTZ DEFAULT NOW()
)`,
`CREATE TABLE IF NOT EXISTS "${schemaName}".purchase_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id UUID NOT NULL REFERENCES "${schemaName}".purchases(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES "${schemaName}".products(id) ON DELETE RESTRICT,
  quantity NUMERIC(10,4) NOT NULL,
  unit_price NUMERIC(10,4) NOT NULL,
  subtotal NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
)`,
`CREATE TABLE IF NOT EXISTS "${schemaName}".stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES "${schemaName}".products(id) ON DELETE RESTRICT,
  type VARCHAR NOT NULL,
  quantity NUMERIC(10,4) NOT NULL,
  reference_id UUID,
  reference_type VARCHAR,
  moved_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)`,
`CREATE TABLE IF NOT EXISTS "${schemaName}".sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id UUID NOT NULL REFERENCES "${schemaName}".buyers(id) ON DELETE RESTRICT,
  operator_id UUID NOT NULL,
  sold_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes VARCHAR,
  created_at TIMESTAMPTZ DEFAULT NOW()
)`,
`CREATE TABLE IF NOT EXISTS "${schemaName}".sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES "${schemaName}".sales(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES "${schemaName}".products(id) ON DELETE RESTRICT,
  quantity NUMERIC(10,4) NOT NULL,
  unit_price NUMERIC(10,4) NOT NULL,
  subtotal NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
)`,
`CREATE TABLE IF NOT EXISTS "${schemaName}".employee_permissions (
  user_id UUID PRIMARY KEY,
  can_manage_suppliers BOOLEAN NOT NULL DEFAULT true,
  can_manage_buyers BOOLEAN NOT NULL DEFAULT false,
  can_manage_products BOOLEAN NOT NULL DEFAULT false,
  can_open_close_cash BOOLEAN NOT NULL DEFAULT true,
  can_view_stock BOOLEAN NOT NULL DEFAULT true,
  can_view_reports BOOLEAN NOT NULL DEFAULT false,
  can_register_purchases BOOLEAN NOT NULL DEFAULT true,
  can_register_sales BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT NOW()
)`,
```

### Step 15: Run tests and verify

```bash
pnpm --filter backend test -- --testPathPattern=auth
pnpm --filter backend test -- --testPathPattern=tenancy
```

Expected: all existing tests pass.

### Step 16: Commit

```bash
git add packages/shared/src/enums/tenant-segment.enum.ts \
  packages/shared/src/index.ts \
  apps/backend/src/modules/core/tenancy/tenant.entity.ts \
  apps/backend/src/modules/core/auth/dto/register.dto.ts \
  apps/backend/src/modules/core/tenancy/tenancy.service.ts \
  apps/backend/src/modules/core/auth/auth.service.ts \
  apps/backend/src/modules/core/auth/jwt.strategy.ts \
  apps/frontend/src/store/auth.store.ts \
  apps/frontend/src/services/auth.service.ts \
  apps/frontend/src/pages/auth/RegisterRecyclingPage.tsx \
  apps/frontend/src/pages/recycling/DashboardPage.tsx \
  apps/frontend/src/layouts/RecyclingLayout.tsx \
  apps/frontend/src/App.tsx \
  apps/backend/src/database/tenant-migrations/create-tenant-tables.ts
git commit -m "feat(recycling): add segment field, registration route, and recycling layout"
```

---

## Task 2: Employees + Individual Permissions

CRUD for employees (users with EMPLOYEE role) and configurable permissions per employee.

**Files:**
- Create: `apps/backend/src/modules/recycling/employees/employee-permissions.entity.ts`
- Create: `apps/backend/src/modules/recycling/employees/dto/create-employee.dto.ts`
- Create: `apps/backend/src/modules/recycling/employees/dto/update-permissions.dto.ts`
- Create: `apps/backend/src/modules/recycling/employees/employees.service.ts`
- Create: `apps/backend/src/modules/recycling/employees/employees.service.spec.ts`
- Create: `apps/backend/src/modules/recycling/employees/employees.controller.ts`
- Create: `apps/backend/src/modules/recycling/employees/employees.module.ts`
- Create: `apps/backend/src/modules/recycling/recycling.module.ts`
- Create: `apps/backend/src/modules/recycling/employees/employee-permissions.guard.ts`
- Create: `apps/frontend/src/services/recycling/employees.service.ts`
- Create: `apps/frontend/src/pages/recycling/employees/EmployeesPage.tsx`
- Create: `apps/frontend/src/pages/recycling/employees/EmployeeFormPage.tsx`
- Create: `apps/frontend/src/pages/recycling/employees/EmployeePermissionsPage.tsx`
- Modify: `apps/frontend/src/App.tsx`
- Modify: `apps/backend/src/app.module.ts`

### Step 1: Create EmployeePermissions entity

```typescript
// apps/backend/src/modules/recycling/employees/employee-permissions.entity.ts
import { Entity, PrimaryColumn, Column, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'employee_permissions' })
export class EmployeePermissionsEntity {
  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'can_manage_suppliers', default: true })
  canManageSuppliers: boolean;

  @Column({ name: 'can_manage_buyers', default: false })
  canManageBuyers: boolean;

  @Column({ name: 'can_manage_products', default: false })
  canManageProducts: boolean;

  @Column({ name: 'can_open_close_cash', default: true })
  canOpenCloseCash: boolean;

  @Column({ name: 'can_view_stock', default: true })
  canViewStock: boolean;

  @Column({ name: 'can_view_reports', default: false })
  canViewReports: boolean;

  @Column({ name: 'can_register_purchases', default: true })
  canRegisterPurchases: boolean;

  @Column({ name: 'can_register_sales', default: true })
  canRegisterSales: boolean;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
```

### Step 2: Create DTOs

```typescript
// apps/backend/src/modules/recycling/employees/dto/create-employee.dto.ts
import { IsEmail, IsString, MinLength } from 'class-validator';

export class CreateEmployeeDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;
}
```

```typescript
// apps/backend/src/modules/recycling/employees/dto/update-permissions.dto.ts
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdatePermissionsDto {
  @IsOptional() @IsBoolean() canManageSuppliers?: boolean;
  @IsOptional() @IsBoolean() canManageBuyers?: boolean;
  @IsOptional() @IsBoolean() canManageProducts?: boolean;
  @IsOptional() @IsBoolean() canOpenCloseCash?: boolean;
  @IsOptional() @IsBoolean() canViewStock?: boolean;
  @IsOptional() @IsBoolean() canViewReports?: boolean;
  @IsOptional() @IsBoolean() canRegisterPurchases?: boolean;
  @IsOptional() @IsBoolean() canRegisterSales?: boolean;
}
```

### Step 3: Write failing tests for EmployeesService

```typescript
// apps/backend/src/modules/recycling/employees/employees.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { EmployeesService } from './employees.service';
import { UserEntity } from '../../core/auth/user.entity';
import { EmployeePermissionsEntity } from './employee-permissions.entity';

const mockUserRepo = { findOne: jest.fn(), create: jest.fn(), save: jest.fn(), find: jest.fn() };
const mockPermRepo = { findOne: jest.fn(), create: jest.fn(), save: jest.fn() };

const mockQueryRunner = {
  connect: jest.fn().mockResolvedValue(undefined),
  query: jest.fn().mockResolvedValue(undefined),
  manager: {
    getRepository: jest.fn((entity) => {
      if (entity === UserEntity) return mockUserRepo;
      return mockPermRepo;
    }),
  },
  release: jest.fn().mockResolvedValue(undefined),
};

const mockDataSource = {
  createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
};

describe('EmployeesService', () => {
  let service: EmployeesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmployeesService,
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();
    service = module.get<EmployeesService>(EmployeesService);
    jest.clearAllMocks();
    mockQueryRunner.manager.getRepository.mockImplementation((entity) => {
      if (entity === UserEntity) return mockUserRepo;
      return mockPermRepo;
    });
  });

  describe('list', () => {
    it('should return employees for the tenant', async () => {
      const employees = [{ id: 'u1', name: 'Ana', role: 'EMPLOYEE' }];
      mockUserRepo.find.mockResolvedValue(employees);
      const result = await service.list('00000000-0000-0000-0000-000000000001');
      expect(result).toEqual(employees);
    });
  });

  describe('create', () => {
    it('should throw ConflictException when email already exists in tenant', async () => {
      mockUserRepo.findOne.mockResolvedValue({ id: 'existing' });
      await expect(
        service.create('00000000-0000-0000-0000-000000000001', {
          name: 'Ana', email: 'ana@test.com', password: 'senha123'
        })
      ).rejects.toThrow(ConflictException);
    });

    it('should create employee with default permissions', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);
      const newUser = { id: 'u1', name: 'Ana', role: 'EMPLOYEE' };
      mockUserRepo.create.mockReturnValue(newUser);
      mockUserRepo.save.mockResolvedValue(newUser);
      mockPermRepo.create.mockReturnValue({ userId: 'u1' });
      mockPermRepo.save.mockResolvedValue({ userId: 'u1' });

      const result = await service.create('00000000-0000-0000-0000-000000000001', {
        name: 'Ana', email: 'ana@test.com', password: 'senha123'
      });

      expect(mockPermRepo.save).toHaveBeenCalled();
      expect(result).toEqual(newUser);
    });
  });

  describe('getPermissions', () => {
    it('should throw NotFoundException when employee not found', async () => {
      mockPermRepo.findOne.mockResolvedValue(null);
      await expect(
        service.getPermissions('00000000-0000-0000-0000-000000000001', 'u1')
      ).rejects.toThrow(NotFoundException);
    });

    it('should return permissions for employee', async () => {
      const perms = { userId: 'u1', canManageSuppliers: true };
      mockPermRepo.findOne.mockResolvedValue(perms);
      const result = await service.getPermissions('00000000-0000-0000-0000-000000000001', 'u1');
      expect(result).toEqual(perms);
    });
  });

  describe('updatePermissions', () => {
    it('should update permissions', async () => {
      const perms = { userId: 'u1', canManageSuppliers: true, canManageBuyers: false };
      mockPermRepo.findOne.mockResolvedValue(perms);
      mockPermRepo.save.mockResolvedValue({ ...perms, canManageBuyers: true });

      const result = await service.updatePermissions('00000000-0000-0000-0000-000000000001', 'u1', { canManageBuyers: true });
      expect(result.canManageBuyers).toBe(true);
    });
  });
});
```

Run: `pnpm --filter backend test -- --testPathPattern=employees.service`
Expected: FAIL (EmployeesService not found)

### Step 4: Implement EmployeesService

```typescript
// apps/backend/src/modules/recycling/employees/employees.service.ts
import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { UserEntity, UserRole } from '../../core/auth/user.entity';
import { EmployeePermissionsEntity } from './employee-permissions.entity';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdatePermissionsDto } from './dto/update-permissions.dto';

@Injectable()
export class EmployeesService {
  constructor(private readonly dataSource: DataSource) {}

  private getSchemaName(tenantId: string): string {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantId)) {
      throw new Error('Invalid tenantId');
    }
    return `tenant_${tenantId.replace(/-/g, '')}`;
  }

  private async withSchema<T>(
    tenantId: string,
    fn: (manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    const schemaName = this.getSchemaName(tenantId);
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    try {
      await qr.query(`SET search_path TO "${schemaName}", public`);
      return await fn(qr.manager);
    } finally {
      await qr.release();
    }
  }

  async list(tenantId: string): Promise<UserEntity[]> {
    return this.withSchema(tenantId, async (manager) => {
      const repo = manager.getRepository(UserEntity);
      return repo.find({ where: { tenantId, role: UserRole.EMPLOYEE } });
    });
  }

  async create(tenantId: string, dto: CreateEmployeeDto): Promise<UserEntity> {
    return this.withSchema(tenantId, async (manager) => {
      const userRepo = manager.getRepository(UserEntity);
      const permRepo = manager.getRepository(EmployeePermissionsEntity);

      const existing = await userRepo.findOne({ where: { tenantId, email: dto.email } });
      if (existing) throw new ConflictException('E-mail já cadastrado neste tenant.');

      const passwordHash = await bcrypt.hash(dto.password, 10);
      const user = userRepo.create({
        tenantId,
        email: dto.email,
        passwordHash,
        name: dto.name,
        role: UserRole.EMPLOYEE,
      });
      const saved = await userRepo.save(user);

      const perms = permRepo.create({ userId: saved.id });
      await permRepo.save(perms);

      return saved;
    });
  }

  async delete(tenantId: string, userId: string): Promise<void> {
    return this.withSchema(tenantId, async (manager) => {
      const userRepo = manager.getRepository(UserEntity);
      const user = await userRepo.findOne({ where: { id: userId, tenantId, role: UserRole.EMPLOYEE } });
      if (!user) throw new NotFoundException('Funcionário não encontrado.');
      await userRepo.remove(user);
    });
  }

  async getPermissions(tenantId: string, userId: string): Promise<EmployeePermissionsEntity> {
    return this.withSchema(tenantId, async (manager) => {
      const permRepo = manager.getRepository(EmployeePermissionsEntity);
      const perms = await permRepo.findOne({ where: { userId } });
      if (!perms) throw new NotFoundException('Permissões não encontradas.');
      return perms;
    });
  }

  async updatePermissions(
    tenantId: string,
    userId: string,
    dto: UpdatePermissionsDto,
  ): Promise<EmployeePermissionsEntity> {
    return this.withSchema(tenantId, async (manager) => {
      const permRepo = manager.getRepository(EmployeePermissionsEntity);
      const perms = await permRepo.findOne({ where: { userId } });
      if (!perms) throw new NotFoundException('Permissões não encontradas.');
      Object.assign(perms, dto);
      return permRepo.save(perms);
    });
  }
}
```

### Step 5: Run tests again

```bash
pnpm --filter backend test -- --testPathPattern=employees.service
```
Expected: all PASS.

### Step 6: Create EmployeePermissionsGuard

```typescript
// apps/backend/src/modules/recycling/employees/employee-permissions.guard.ts
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../../core/auth/user.entity';
import { EmployeesService } from './employees.service';

export const PERMISSION_KEY = 'permission';
export const RequirePermission = (perm: keyof EmployeesService) =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@nestjs/common').SetMetadata(PERMISSION_KEY, perm);

@Injectable()
export class EmployeePermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly employeesService: EmployeesService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const permKey = this.reflector.getAllAndOverride<string>(PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!permKey) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) return false;
    if (user.role === UserRole.OWNER) return true;

    try {
      const perms = await this.employeesService.getPermissions(user.tenantId, user.userId);
      return !!(perms as any)[permKey];
    } catch {
      throw new ForbiddenException('Sem permissão para esta ação.');
    }
  }
}
```

### Step 7: Create EmployeesController

```typescript
// apps/backend/src/modules/recycling/employees/employees.controller.ts
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { RolesGuard } from '../../core/auth/roles.guard';
import { Roles } from '../../core/auth/roles.decorator';
import { UserRole } from '../../core/auth/user.entity';
import { AuthUser } from '../../core/auth/jwt.strategy';
import { EmployeesService } from './employees.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdatePermissionsDto } from './dto/update-permissions.dto';

interface RequestWithUser extends Request {
  user: AuthUser;
}

@Controller('recycling/employees')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.OWNER)
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Get()
  list(@Request() req: RequestWithUser) {
    return this.employeesService.list(req.user.tenantId);
  }

  @Post()
  create(@Request() req: RequestWithUser, @Body() dto: CreateEmployeeDto) {
    return this.employeesService.create(req.user.tenantId, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  delete(
    @Request() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.employeesService.delete(req.user.tenantId, id);
  }

  @Get(':id/permissions')
  getPermissions(
    @Request() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.employeesService.getPermissions(req.user.tenantId, id);
  }

  @Patch(':id/permissions')
  updatePermissions(
    @Request() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePermissionsDto,
  ) {
    return this.employeesService.updatePermissions(req.user.tenantId, id, dto);
  }
}
```

### Step 8: Create EmployeesModule and RecyclingModule

```typescript
// apps/backend/src/modules/recycling/employees/employees.module.ts
import { Module } from '@nestjs/common';
import { EmployeesController } from './employees.controller';
import { EmployeesService } from './employees.service';

@Module({
  controllers: [EmployeesController],
  providers: [EmployeesService],
  exports: [EmployeesService],
})
export class EmployeesModule {}
```

```typescript
// apps/backend/src/modules/recycling/recycling.module.ts
import { Module } from '@nestjs/common';
import { EmployeesModule } from './employees/employees.module';

@Module({
  imports: [EmployeesModule],
})
export class RecyclingModule {}
```

Import `RecyclingModule` in `apps/backend/src/app.module.ts` (same pattern as WorkshopModule or the core modules already imported there).

### Step 9: Create frontend employees service + pages

```typescript
// apps/frontend/src/services/recycling/employees.service.ts
import { api } from '../api';

export interface Employee {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
}

export interface EmployeePermissions {
  userId: string;
  canManageSuppliers: boolean;
  canManageBuyers: boolean;
  canManageProducts: boolean;
  canOpenCloseCash: boolean;
  canViewStock: boolean;
  canViewReports: boolean;
  canRegisterPurchases: boolean;
  canRegisterSales: boolean;
}

export const employeesService = {
  async list(): Promise<Employee[]> {
    const { data } = await api.get<Employee[]>('/recycling/employees');
    return data;
  },
  async create(payload: { name: string; email: string; password: string }): Promise<Employee> {
    const { data } = await api.post<Employee>('/recycling/employees', payload);
    return data;
  },
  async delete(id: string): Promise<void> {
    await api.delete(`/recycling/employees/${id}`);
  },
  async getPermissions(id: string): Promise<EmployeePermissions> {
    const { data } = await api.get<EmployeePermissions>(`/recycling/employees/${id}/permissions`);
    return data;
  },
  async updatePermissions(id: string, perms: Partial<EmployeePermissions>): Promise<EmployeePermissions> {
    const { data } = await api.patch<EmployeePermissions>(`/recycling/employees/${id}/permissions`, perms);
    return data;
  },
};
```

Create `apps/frontend/src/pages/recycling/employees/EmployeesPage.tsx` — list employees with a "Novo Funcionário" button and link to permissions. Use the same CTable/CButton pattern from existing pages (e.g., CustomersPage).

Create `apps/frontend/src/pages/recycling/employees/EmployeeFormPage.tsx` — form with name, email, password fields using react-hook-form + zod.

Create `apps/frontend/src/pages/recycling/employees/EmployeePermissionsPage.tsx` — list all boolean permissions as toggles (CFormSwitch), save with PATCH.

Add routes to `App.tsx` under `/recycling`:
```tsx
<Route path="employees" element={<EmployeesPage />} />
<Route path="employees/new" element={<EmployeeFormPage />} />
<Route path="employees/:id/permissions" element={<EmployeePermissionsPage />} />
```

### Step 10: Run all recycling tests

```bash
pnpm --filter backend test -- --testPathPattern=employees
```
Expected: all PASS.

### Step 11: Commit

```bash
git add apps/backend/src/modules/recycling/ apps/frontend/src/services/recycling/ apps/frontend/src/pages/recycling/employees/ apps/backend/src/app.module.ts apps/frontend/src/App.tsx
git commit -m "feat(recycling): add employees module with individual permissions"
```

---

## Task 3: Units of Measure + Products

CRUD for configurable units of measure (kg, litro, etc.) and recyclable products with price per unit.

**Files:**
- Create: `apps/backend/src/modules/recycling/units/unit.entity.ts`
- Create: `apps/backend/src/modules/recycling/units/dto/create-unit.dto.ts`
- Create: `apps/backend/src/modules/recycling/units/units.service.ts`
- Create: `apps/backend/src/modules/recycling/units/units.service.spec.ts`
- Create: `apps/backend/src/modules/recycling/units/units.controller.ts`
- Create: `apps/backend/src/modules/recycling/units/units.module.ts`
- Create: `apps/backend/src/modules/recycling/products/product.entity.ts`
- Create: `apps/backend/src/modules/recycling/products/dto/create-product.dto.ts`
- Create: `apps/backend/src/modules/recycling/products/dto/update-product.dto.ts`
- Create: `apps/backend/src/modules/recycling/products/products.service.ts`
- Create: `apps/backend/src/modules/recycling/products/products.service.spec.ts`
- Create: `apps/backend/src/modules/recycling/products/products.controller.ts`
- Create: `apps/backend/src/modules/recycling/products/products.module.ts`
- Create: `apps/frontend/src/services/recycling/units.service.ts`
- Create: `apps/frontend/src/services/recycling/products.service.ts`
- Create: `apps/frontend/src/pages/recycling/products/ProductsPage.tsx`
- Create: `apps/frontend/src/pages/recycling/products/ProductFormPage.tsx`
- Modify: `apps/backend/src/modules/recycling/recycling.module.ts`
- Modify: `apps/frontend/src/App.tsx`

### Step 1: Unit entity

```typescript
// apps/backend/src/modules/recycling/units/unit.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'units' })
export class UnitEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  abbreviation: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
```

### Step 2: Unit DTO

```typescript
// apps/backend/src/modules/recycling/units/dto/create-unit.dto.ts
import { IsString, MinLength, MaxLength } from 'class-validator';

export class CreateUnitDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsString()
  @MaxLength(10)
  abbreviation: string;
}
```

### Step 3: Write failing tests for UnitsService

```typescript
// apps/backend/src/modules/recycling/units/units.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { UnitsService } from './units.service';
import { UnitEntity } from './unit.entity';

const mockUnitRepo = { find: jest.fn(), findOne: jest.fn(), create: jest.fn(), save: jest.fn(), remove: jest.fn() };
const mockQueryRunner = {
  connect: jest.fn().mockResolvedValue(undefined),
  query: jest.fn().mockResolvedValue(undefined),
  manager: { getRepository: jest.fn().mockReturnValue(mockUnitRepo) },
  release: jest.fn().mockResolvedValue(undefined),
};
const mockDataSource = { createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner) };

describe('UnitsService', () => {
  let service: UnitsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UnitsService, { provide: DataSource, useValue: mockDataSource }],
    }).compile();
    service = module.get<UnitsService>(UnitsService);
    jest.clearAllMocks();
    mockQueryRunner.manager.getRepository.mockReturnValue(mockUnitRepo);
  });

  it('should list all units', async () => {
    mockUnitRepo.find.mockResolvedValue([{ id: 'u1', name: 'Quilograma', abbreviation: 'kg' }]);
    const result = await service.list('00000000-0000-0000-0000-000000000001');
    expect(result).toHaveLength(1);
  });

  it('should create a unit', async () => {
    const dto = { name: 'Quilograma', abbreviation: 'kg' };
    const created = { id: 'u1', ...dto };
    mockUnitRepo.create.mockReturnValue(created);
    mockUnitRepo.save.mockResolvedValue(created);
    const result = await service.create('00000000-0000-0000-0000-000000000001', dto);
    expect(result).toEqual(created);
  });

  it('should throw NotFoundException on delete when unit not found', async () => {
    mockUnitRepo.findOne.mockResolvedValue(null);
    await expect(service.delete('00000000-0000-0000-0000-000000000001', 'nonexistent')).rejects.toThrow(NotFoundException);
  });
});
```

Run: `pnpm --filter backend test -- --testPathPattern=units.service`
Expected: FAIL.

### Step 4: Implement UnitsService

Follow the exact `withSchema` pattern from `CustomersService`. Methods: `list(tenantId)`, `create(tenantId, dto)`, `update(tenantId, id, dto)`, `delete(tenantId, id)`.

On delete, check if any product references this unit first — throw `ConflictException` if yes.

### Step 5: Run tests

```bash
pnpm --filter backend test -- --testPathPattern=units.service
```
Expected: all PASS.

### Step 6: Product entity

```typescript
// apps/backend/src/modules/recycling/products/product.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'products' })
export class ProductEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ name: 'unit_id', type: 'uuid' })
  unitId: string;

  @Column({ name: 'price_per_unit', type: 'numeric', precision: 10, scale: 4 })
  pricePerUnit: number;

  @Column({ default: true })
  active: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
```

### Step 7: Product DTOs

```typescript
// apps/backend/src/modules/recycling/products/dto/create-product.dto.ts
import { IsString, IsUUID, IsNumber, IsPositive, IsOptional, IsBoolean } from 'class-validator';

export class CreateProductDto {
  @IsString()
  name: string;

  @IsUUID()
  unitId: string;

  @IsNumber()
  @IsPositive()
  pricePerUnit: number;
}
```

```typescript
// apps/backend/src/modules/recycling/products/dto/update-product.dto.ts
import { PartialType } from '@nestjs/mapped-types';
import { CreateProductDto } from './create-product.dto';
import { IsOptional, IsBoolean } from 'class-validator';

export class UpdateProductDto extends PartialType(CreateProductDto) {
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
```

### Step 8: Write failing tests, implement ProductsService, run tests

Follow the same pattern as UnitsService tests. ProductsService methods: `list(tenantId, includeInactive?)`, `getById(tenantId, id)`, `create(tenantId, dto)`, `update(tenantId, id, dto)`. No delete — only deactivate via `active: false`.

Write tests for: listing only active products by default, listing all when `includeInactive=true`, creating product, updating price, throwing NotFoundException when not found.

### Step 9: Create UnitsController and ProductsController

Follow the same pattern as `CustomersController`. Units and Products are OWNER-only for CRUD (employees cannot manage). Route prefixes: `recycling/units` and `recycling/products`.

### Step 10: Create modules, add to RecyclingModule

```typescript
// recycling.module.ts — add UnitsModule and ProductsModule to imports
import { UnitsModule } from './units/units.module';
import { ProductsModule } from './products/products.module';

@Module({
  imports: [EmployeesModule, UnitsModule, ProductsModule],
})
export class RecyclingModule {}
```

### Step 11: Frontend services and pages

```typescript
// apps/frontend/src/services/recycling/units.service.ts
import { api } from '../api';
export interface Unit { id: string; name: string; abbreviation: string; }
export const unitsService = {
  async list(): Promise<Unit[]> { const { data } = await api.get<Unit[]>('/recycling/units'); return data; },
  async create(payload: { name: string; abbreviation: string }): Promise<Unit> {
    const { data } = await api.post<Unit>('/recycling/units', payload); return data;
  },
  async update(id: string, payload: Partial<{ name: string; abbreviation: string }>): Promise<Unit> {
    const { data } = await api.patch<Unit>(`/recycling/units/${id}`, payload); return data;
  },
  async delete(id: string): Promise<void> { await api.delete(`/recycling/units/${id}`); },
};
```

Create `ProductsPage.tsx` — table with columns: Nome, Unidade, Preço por Unidade, Status (Ativo/Inativo), actions (editar, desativar).

Create `ProductFormPage.tsx` — form with name, unitId (select from units list), pricePerUnit.

Units management goes in the Configurações page (SettingsPage for recycling) — a tab with units CRUD inline.

Add routes to App.tsx under `/recycling`:
```tsx
<Route path="products" element={<ProductsPage />} />
<Route path="products/new" element={<ProductFormPage />} />
<Route path="products/:id/edit" element={<ProductFormPage />} />
```

### Step 12: Run all tests and commit

```bash
pnpm --filter backend test -- --testPathPattern="units|products"
```
Expected: all PASS.

```bash
git add apps/backend/src/modules/recycling/units/ apps/backend/src/modules/recycling/products/ apps/frontend/src/services/recycling/units.service.ts apps/frontend/src/services/recycling/products.service.ts apps/frontend/src/pages/recycling/products/
git commit -m "feat(recycling): add units of measure and products modules"
```

---

## Task 4: Suppliers

CRUD for suppliers (individuals/companies that sell recyclable material).

**Files:**
- Create: `apps/backend/src/modules/recycling/suppliers/supplier.entity.ts`
- Create: `apps/backend/src/modules/recycling/suppliers/dto/create-supplier.dto.ts`
- Create: `apps/backend/src/modules/recycling/suppliers/dto/update-supplier.dto.ts`
- Create: `apps/backend/src/modules/recycling/suppliers/suppliers.service.ts`
- Create: `apps/backend/src/modules/recycling/suppliers/suppliers.service.spec.ts`
- Create: `apps/backend/src/modules/recycling/suppliers/suppliers.controller.ts`
- Create: `apps/backend/src/modules/recycling/suppliers/suppliers.module.ts`
- Create: `apps/frontend/src/services/recycling/suppliers.service.ts`
- Create: `apps/frontend/src/pages/recycling/suppliers/SuppliersPage.tsx`
- Create: `apps/frontend/src/pages/recycling/suppliers/SupplierFormPage.tsx`
- Modify: `apps/backend/src/modules/recycling/recycling.module.ts`
- Modify: `apps/frontend/src/App.tsx`

### Step 1: Supplier entity

```typescript
// apps/backend/src/modules/recycling/suppliers/supplier.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export type SupplierAddress = {
  street: string;
  number: string;
  complement?: string;
  city: string;
  state: string;
  zip: string;
};

@Entity({ name: 'suppliers' })
export class SupplierEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'varchar', nullable: true })
  document: string | null;  // CPF or CNPJ digits only

  @Column({ name: 'document_type', type: 'varchar', nullable: true })
  documentType: 'CPF' | 'CNPJ' | null;

  @Column({ type: 'varchar', nullable: true })
  phone: string | null;

  @Column({ type: 'jsonb', nullable: true })
  address: SupplierAddress | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
```

### Step 2: Supplier DTOs

```typescript
// apps/backend/src/modules/recycling/suppliers/dto/create-supplier.dto.ts
import { IsString, IsOptional, Matches, IsIn, ValidateIf } from 'class-validator';

export class CreateSupplierDto {
  @IsString()
  name: string;

  @IsOptional()
  @Matches(/^\d{11}$|^\d{14}$/, { message: 'Documento deve ter 11 (CPF) ou 14 (CNPJ) dígitos' })
  document?: string;

  @ValidateIf((o) => !!o.document)
  @IsIn(['CPF', 'CNPJ'])
  documentType?: 'CPF' | 'CNPJ';

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  address?: {
    street: string;
    number: string;
    complement?: string;
    city: string;
    state: string;
    zip: string;
  };
}
```

```typescript
// apps/backend/src/modules/recycling/suppliers/dto/update-supplier.dto.ts
import { PartialType } from '@nestjs/mapped-types';
import { CreateSupplierDto } from './create-supplier.dto';
export class UpdateSupplierDto extends PartialType(CreateSupplierDto) {}
```

### Step 3: Write failing tests for SuppliersService

Test cases: list with pagination and search, getById throws NotFoundException, create, update throws NotFoundException, delete throws ConflictException when supplier has purchases.

```typescript
// apps/backend/src/modules/recycling/suppliers/suppliers.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { SuppliersService } from './suppliers.service';
import { SupplierEntity } from './supplier.entity';

const mockQb = {
  where: jest.fn().mockReturnThis(),
  orWhere: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  take: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  getManyAndCount: jest.fn(),
};

const mockSupplierRepo = {
  createQueryBuilder: jest.fn().mockReturnValue(mockQb),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  remove: jest.fn(),
};

const mockQueryRunner = {
  connect: jest.fn().mockResolvedValue(undefined),
  query: jest.fn().mockResolvedValue(undefined),
  manager: { getRepository: jest.fn().mockReturnValue(mockSupplierRepo) },
  release: jest.fn().mockResolvedValue(undefined),
};
const mockDataSource = { createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner) };

describe('SuppliersService', () => {
  let service: SuppliersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SuppliersService, { provide: DataSource, useValue: mockDataSource }],
    }).compile();
    service = module.get<SuppliersService>(SuppliersService);
    jest.clearAllMocks();
    mockQueryRunner.manager.getRepository.mockReturnValue(mockSupplierRepo);
    mockSupplierRepo.createQueryBuilder.mockReturnValue(mockQb);
    mockQb.where.mockReturnThis();
    mockQb.orWhere.mockReturnThis();
    mockQb.skip.mockReturnThis();
    mockQb.take.mockReturnThis();
    mockQb.orderBy.mockReturnThis();
  });

  it('should return paginated suppliers', async () => {
    mockQb.getManyAndCount.mockResolvedValue([[{ id: 's1', name: 'João' }], 1]);
    const result = await service.list('00000000-0000-0000-0000-000000000001', 1, 20);
    expect(result.total).toBe(1);
  });

  it('should throw NotFoundException when supplier not found', async () => {
    mockSupplierRepo.findOne.mockResolvedValue(null);
    await expect(service.getById('00000000-0000-0000-0000-000000000001', 'missing')).rejects.toThrow(NotFoundException);
  });

  it('should create supplier', async () => {
    const dto = { name: 'João', document: '12345678901', documentType: 'CPF' as const };
    const created = { id: 's1', ...dto };
    mockSupplierRepo.create.mockReturnValue(created);
    mockSupplierRepo.save.mockResolvedValue(created);
    const result = await service.create('00000000-0000-0000-0000-000000000001', dto);
    expect(result.name).toBe('João');
  });
});
```

Run: `pnpm --filter backend test -- --testPathPattern=suppliers.service`
Expected: FAIL.

### Step 4: Implement SuppliersService

Follow CustomersService pattern. Methods: `list(tenantId, page, limit, search?)`, `getById(tenantId, id)`, `create(tenantId, dto)`, `update(tenantId, id, dto)`, `delete(tenantId, id)`.

On delete: check if any `purchases` reference this supplier — throw `ConflictException('Fornecedor possui compras registradas.')` if yes. Use `manager.query` to count:
```typescript
const [{ count }] = await manager.query(
  `SELECT COUNT(*) as count FROM purchases WHERE supplier_id = $1`,
  [id]
);
if (Number(count) > 0) throw new ConflictException('Fornecedor possui compras registradas.');
```

### Step 5: Run tests, create controller, module, add to RecyclingModule

Controller prefix: `recycling/suppliers`. Employees with `canManageSuppliers` permission can access GET/POST/PATCH. Only OWNER can DELETE.

```typescript
// controller — EMPLOYEE with canManageSuppliers can list/create/update
// DELETE remains OWNER-only
```

Use `EmployeePermissionsGuard` for the relevant routes.

### Step 6: Frontend suppliers service and pages

```typescript
// apps/frontend/src/services/recycling/suppliers.service.ts
import { api } from '../api';
// ... similar pattern to customers.service.ts
```

`SuppliersPage.tsx` — table with columns: Nome, Documento, Telefone, actions.
`SupplierFormPage.tsx` — form with name, documentType (select: CPF/CNPJ), document (masked), phone, address fields.

### Step 7: Run all tests and commit

```bash
pnpm --filter backend test -- --testPathPattern=suppliers.service
```

```bash
git add apps/backend/src/modules/recycling/suppliers/ apps/frontend/src/services/recycling/suppliers.service.ts apps/frontend/src/pages/recycling/suppliers/
git commit -m "feat(recycling): add suppliers module"
```

---

## Task 5: Cash Register

Cash sessions (open/close) with transaction tracking. Multiple sessions per day allowed.

**Files:**
- Create: `apps/backend/src/modules/recycling/cash-register/cash-session.entity.ts`
- Create: `apps/backend/src/modules/recycling/cash-register/cash-transaction.entity.ts`
- Create: `apps/backend/src/modules/recycling/cash-register/dto/open-session.dto.ts`
- Create: `apps/backend/src/modules/recycling/cash-register/dto/add-transaction.dto.ts`
- Create: `apps/backend/src/modules/recycling/cash-register/cash-register.service.ts`
- Create: `apps/backend/src/modules/recycling/cash-register/cash-register.service.spec.ts`
- Create: `apps/backend/src/modules/recycling/cash-register/cash-register.controller.ts`
- Create: `apps/backend/src/modules/recycling/cash-register/cash-register.module.ts`
- Create: `apps/frontend/src/services/recycling/cash-register.service.ts`
- Create: `apps/frontend/src/pages/recycling/cash-register/CashRegisterPage.tsx`
- Modify: `apps/backend/src/modules/recycling/recycling.module.ts`
- Modify: `apps/frontend/src/App.tsx`

### Step 1: Entities

```typescript
// apps/backend/src/modules/recycling/cash-register/cash-session.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

export enum CashSessionStatus {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
}

@Entity({ name: 'cash_sessions' })
export class CashSessionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'operator_id', type: 'uuid' })
  operatorId: string;  // user who OPENED

  @Column({ name: 'closed_by', type: 'uuid', nullable: true })
  closedBy: string | null;  // user who CLOSED

  @Column({ name: 'opened_at', type: 'timestamptz', default: () => 'NOW()' })
  openedAt: Date;

  @Column({ name: 'closed_at', type: 'timestamptz', nullable: true })
  closedAt: Date | null;

  @Column({ name: 'opening_balance', type: 'numeric', precision: 12, scale: 2, default: 0 })
  openingBalance: number;

  @Column({ name: 'closing_balance', type: 'numeric', precision: 12, scale: 2, nullable: true })
  closingBalance: number | null;

  @Column({ type: 'varchar', default: CashSessionStatus.OPEN })
  status: CashSessionStatus;
}
```

```typescript
// apps/backend/src/modules/recycling/cash-register/cash-transaction.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

export enum TransactionType {
  IN = 'IN',
  OUT = 'OUT',
}

export enum PaymentMethod {
  CASH = 'CASH',
  PIX = 'PIX',
  CARD = 'CARD',
}

@Entity({ name: 'cash_transactions' })
export class CashTransactionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'cash_session_id', type: 'uuid' })
  cashSessionId: string;

  @Column({ type: 'varchar' })
  type: TransactionType;

  @Column({ name: 'payment_method', type: 'varchar' })
  paymentMethod: PaymentMethod;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  amount: number;

  @Column({ type: 'varchar', nullable: true })
  description: string | null;

  @Column({ name: 'reference_id', type: 'uuid', nullable: true })
  referenceId: string | null;

  @Column({ name: 'reference_type', type: 'varchar', nullable: true })
  referenceType: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
```

### Step 2: DTOs

```typescript
// apps/backend/src/modules/recycling/cash-register/dto/add-transaction.dto.ts
import { IsEnum, IsNumber, IsPositive, IsOptional, IsString, IsUUID } from 'class-validator';
import { TransactionType, PaymentMethod } from '../cash-transaction.entity';

export class AddTransactionDto {
  @IsEnum(TransactionType)
  type: TransactionType;

  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @IsNumber()
  @IsPositive()
  amount: number;

  @IsOptional()
  @IsString()
  description?: string;
}
```

### Step 3: Write failing tests for CashRegisterService

Critical tests to cover:

1. **open()**: opening balance = closing_balance of last CLOSED session (or 0 if none)
2. **close()**: closing_balance = opening_balance + SUM(IN CASH) - SUM(OUT CASH). PIX/CARD not counted.
3. **getCurrent()**: returns OPEN session or null
4. **close()**: throws BadRequestException if no open session
5. **addTransaction()**: throws BadRequestException if no open session

```typescript
// apps/backend/src/modules/recycling/cash-register/cash-register.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CashRegisterService } from './cash-register.service';
import { CashSessionEntity, CashSessionStatus } from './cash-session.entity';
import { CashTransactionEntity, TransactionType, PaymentMethod } from './cash-transaction.entity';

const mockSessionRepo = { findOne: jest.fn(), create: jest.fn(), save: jest.fn() };
const mockTxRepo = { create: jest.fn(), save: jest.fn() };

const mockQueryRunner = {
  connect: jest.fn().mockResolvedValue(undefined),
  query: jest.fn().mockResolvedValue(undefined),
  manager: {
    getRepository: jest.fn((entity) => {
      if (entity === CashSessionEntity) return mockSessionRepo;
      return mockTxRepo;
    }),
  },
  release: jest.fn().mockResolvedValue(undefined),
};
const mockDataSource = { createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner) };

const TENANT = '00000000-0000-0000-0000-000000000001';
const OPERATOR = '00000000-0000-0000-0000-000000000002';

describe('CashRegisterService', () => {
  let service: CashRegisterService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CashRegisterService, { provide: DataSource, useValue: mockDataSource }],
    }).compile();
    service = module.get<CashRegisterService>(CashRegisterService);
    jest.clearAllMocks();
    mockQueryRunner.manager.getRepository.mockImplementation((entity) => {
      if (entity === CashSessionEntity) return mockSessionRepo;
      return mockTxRepo;
    });
  });

  describe('open', () => {
    it('should open session with opening_balance = 0 when no previous session', async () => {
      // No previous closed session
      mockSessionRepo.findOne
        .mockResolvedValueOnce(null)  // no open session
        .mockResolvedValueOnce(null); // no last closed session
      const newSession = { id: 's1', openingBalance: 0, status: CashSessionStatus.OPEN };
      mockSessionRepo.create.mockReturnValue(newSession);
      mockSessionRepo.save.mockResolvedValue(newSession);

      const result = await service.open(TENANT, OPERATOR);
      expect(result.openingBalance).toBe(0);
    });

    it('should set opening_balance from last closed session closing_balance', async () => {
      mockSessionRepo.findOne
        .mockResolvedValueOnce(null)  // no current open
        .mockResolvedValueOnce({ closingBalance: 150.00 });
      const newSession = { id: 's2', openingBalance: 150.00, status: CashSessionStatus.OPEN };
      mockSessionRepo.create.mockReturnValue(newSession);
      mockSessionRepo.save.mockResolvedValue(newSession);

      const result = await service.open(TENANT, OPERATOR);
      expect(result.openingBalance).toBe(150.00);
    });
  });

  describe('close', () => {
    it('should throw BadRequestException when no open session', async () => {
      mockSessionRepo.findOne.mockResolvedValue(null);
      await expect(service.close(TENANT, OPERATOR)).rejects.toThrow(BadRequestException);
    });

    it('should calculate closing_balance using only CASH transactions', async () => {
      const openSession = { id: 's1', openingBalance: 100, status: CashSessionStatus.OPEN };
      mockSessionRepo.findOne.mockResolvedValue(openSession);

      // Mock raw query for SUM: CASH IN = 200, CASH OUT = 50
      mockQueryRunner.query
        .mockResolvedValueOnce(undefined) // SET search_path
        .mockResolvedValueOnce([{ sum: '200.00' }]) // CASH IN sum
        .mockResolvedValueOnce([{ sum: '50.00' }]); // CASH OUT sum

      mockSessionRepo.save.mockResolvedValue({
        ...openSession,
        status: CashSessionStatus.CLOSED,
        closingBalance: 250, // 100 + 200 - 50
      });

      const result = await service.close(TENANT, OPERATOR);
      expect(result.closingBalance).toBe(250);
    });
  });

  describe('getCurrent', () => {
    it('should return null when no open session', async () => {
      mockSessionRepo.findOne.mockResolvedValue(null);
      const result = await service.getCurrent(TENANT);
      expect(result).toBeNull();
    });

    it('should return open session', async () => {
      const session = { id: 's1', status: CashSessionStatus.OPEN };
      mockSessionRepo.findOne.mockResolvedValue(session);
      const result = await service.getCurrent(TENANT);
      expect(result).toEqual(session);
    });
  });

  describe('addTransaction', () => {
    it('should throw BadRequestException when adding transaction with no open session', async () => {
      mockSessionRepo.findOne.mockResolvedValue(null);
      await expect(
        service.addTransaction(TENANT, { type: TransactionType.IN, paymentMethod: PaymentMethod.CASH, amount: 50 })
      ).rejects.toThrow(BadRequestException);
    });
  });
});
```

Run: `pnpm --filter backend test -- --testPathPattern=cash-register.service`
Expected: FAIL.

### Step 4: Implement CashRegisterService

```typescript
// apps/backend/src/modules/recycling/cash-register/cash-register.service.ts
import { Injectable, BadRequestException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { CashSessionEntity, CashSessionStatus } from './cash-session.entity';
import { CashTransactionEntity, TransactionType, PaymentMethod } from './cash-transaction.entity';
import { AddTransactionDto } from './dto/add-transaction.dto';

@Injectable()
export class CashRegisterService {
  constructor(private readonly dataSource: DataSource) {}

  private getSchemaName(tenantId: string): string {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantId)) {
      throw new Error('Invalid tenantId');
    }
    return `tenant_${tenantId.replace(/-/g, '')}`;
  }

  private async withSchema<T>(tenantId: string, fn: (manager: EntityManager, qr: any) => Promise<T>): Promise<T> {
    const schemaName = this.getSchemaName(tenantId);
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    try {
      await qr.query(`SET search_path TO "${schemaName}", public`);
      return await fn(qr.manager, qr);
    } finally {
      await qr.release();
    }
  }

  async open(tenantId: string, operatorId: string): Promise<CashSessionEntity> {
    return this.withSchema(tenantId, async (manager) => {
      const sessionRepo = manager.getRepository(CashSessionEntity);

      // Check for existing open session
      const existing = await sessionRepo.findOne({ where: { status: CashSessionStatus.OPEN } });
      if (existing) throw new BadRequestException('Já existe uma sessão de caixa aberta.');

      // Get opening balance from last closed session
      const lastClosed = await sessionRepo.findOne({
        where: { status: CashSessionStatus.CLOSED },
        order: { closedAt: 'DESC' } as any,
      });

      const openingBalance = lastClosed?.closingBalance ?? 0;

      const session = sessionRepo.create({
        operatorId,
        openingBalance,
        status: CashSessionStatus.OPEN,
        openedAt: new Date(),
      });
      return sessionRepo.save(session);
    });
  }

  async close(tenantId: string, closedBy: string): Promise<CashSessionEntity> {
    return this.withSchema(tenantId, async (manager, qr) => {
      const sessionRepo = manager.getRepository(CashSessionEntity);
      const schemaName = this.getSchemaName(tenantId);

      const session = await sessionRepo.findOne({ where: { status: CashSessionStatus.OPEN } });
      if (!session) throw new BadRequestException('Não há sessão de caixa aberta.');

      // Sum only CASH transactions
      const [cashInResult] = await qr.query(
        `SELECT COALESCE(SUM(amount), 0) as sum FROM "${schemaName}".cash_transactions WHERE cash_session_id = $1 AND type = 'IN' AND payment_method = 'CASH'`,
        [session.id]
      );
      const [cashOutResult] = await qr.query(
        `SELECT COALESCE(SUM(amount), 0) as sum FROM "${schemaName}".cash_transactions WHERE cash_session_id = $1 AND type = 'OUT' AND payment_method = 'CASH'`,
        [session.id]
      );

      const cashIn = Number(cashInResult.sum);
      const cashOut = Number(cashOutResult.sum);
      const closingBalance = Number(session.openingBalance) + cashIn - cashOut;

      Object.assign(session, {
        closedBy,
        closedAt: new Date(),
        closingBalance,
        status: CashSessionStatus.CLOSED,
      });
      return sessionRepo.save(session);
    });
  }

  async getCurrent(tenantId: string): Promise<CashSessionEntity | null> {
    return this.withSchema(tenantId, async (manager) => {
      const sessionRepo = manager.getRepository(CashSessionEntity);
      return sessionRepo.findOne({ where: { status: CashSessionStatus.OPEN } });
    });
  }

  async addTransaction(tenantId: string, dto: AddTransactionDto): Promise<CashTransactionEntity> {
    return this.withSchema(tenantId, async (manager) => {
      const sessionRepo = manager.getRepository(CashSessionEntity);
      const txRepo = manager.getRepository(CashTransactionEntity);

      const session = await sessionRepo.findOne({ where: { status: CashSessionStatus.OPEN } });
      if (!session) throw new BadRequestException('Não há sessão de caixa aberta.');

      const tx = txRepo.create({
        cashSessionId: session.id,
        type: dto.type,
        paymentMethod: dto.paymentMethod,
        amount: dto.amount,
        description: dto.description ?? null,
        referenceId: null,
        referenceType: null,
      });
      return txRepo.save(tx);
    });
  }

  async getTransactions(tenantId: string, sessionId: string): Promise<CashTransactionEntity[]> {
    return this.withSchema(tenantId, async (manager) => {
      const txRepo = manager.getRepository(CashTransactionEntity);
      return txRepo.find({ where: { cashSessionId: sessionId }, order: { createdAt: 'ASC' } as any });
    });
  }
}
```

### Step 5: Run tests

```bash
pnpm --filter backend test -- --testPathPattern=cash-register.service
```
Expected: all PASS.

### Step 6: Create controller, module, add to RecyclingModule

```typescript
// Controller routes:
// POST /recycling/cash-register/open — open session
// POST /recycling/cash-register/close — close session
// GET /recycling/cash-register/current — get current open session
// POST /recycling/cash-register/transactions — add manual transaction
// GET /recycling/cash-register/sessions/:sessionId/transactions — get session transactions
```

All employees can open/close cash (guarded by `canOpenCloseCash` permission).

### Step 7: Frontend cash register page

`CashRegisterPage.tsx` displays:
- Current session status (OPEN/CLOSED) with operator name and time
- Opening balance and current physical cash balance (calculated)
- Button: "Abrir Caixa" (when closed) / "Fechar Caixa" (when open)
- "Adicionar Entrada Manual" and "Adicionar Saída Manual" buttons
- List of today's transactions with type, method, amount, description

### Step 8: Run all tests and commit

```bash
pnpm --filter backend test -- --testPathPattern=cash-register
git add apps/backend/src/modules/recycling/cash-register/ apps/frontend/src/services/recycling/cash-register.service.ts apps/frontend/src/pages/recycling/cash-register/
git commit -m "feat(recycling): add cash register module with open/close/balance logic"
```

---

## Task 6: Purchases

Atomic purchase flow: create purchase + stock movements + cash transaction in one operation.

**Files:**
- Create: `apps/backend/src/modules/recycling/purchases/purchase.entity.ts`
- Create: `apps/backend/src/modules/recycling/purchases/purchase-item.entity.ts`
- Create: `apps/backend/src/modules/recycling/purchases/stock-movement.entity.ts`
- Create: `apps/backend/src/modules/recycling/purchases/dto/create-purchase.dto.ts`
- Create: `apps/backend/src/modules/recycling/purchases/purchases.service.ts`
- Create: `apps/backend/src/modules/recycling/purchases/purchases.service.spec.ts`
- Create: `apps/backend/src/modules/recycling/purchases/purchases.controller.ts`
- Create: `apps/backend/src/modules/recycling/purchases/purchases.module.ts`
- Create: `apps/frontend/src/services/recycling/purchases.service.ts`
- Create: `apps/frontend/src/pages/recycling/purchases/PurchasesPage.tsx`
- Create: `apps/frontend/src/pages/recycling/purchases/NewPurchasePage.tsx`
- Modify: `apps/backend/src/modules/recycling/recycling.module.ts`
- Modify: `apps/frontend/src/App.tsx`

### Step 1: Entities

```typescript
// apps/backend/src/modules/recycling/purchases/purchase.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';
import { PaymentMethod } from '../cash-register/cash-transaction.entity';

@Entity({ name: 'purchases' })
export class PurchaseEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'supplier_id', type: 'uuid' }) supplierId: string;
  @Column({ name: 'operator_id', type: 'uuid' }) operatorId: string;
  @Column({ name: 'cash_session_id', type: 'uuid', nullable: true }) cashSessionId: string | null;
  @Column({ name: 'payment_method', type: 'varchar' }) paymentMethod: PaymentMethod;
  @Column({ name: 'total_amount', type: 'numeric', precision: 12, scale: 2, default: 0 }) totalAmount: number;
  @Column({ name: 'purchased_at', type: 'timestamptz', default: () => 'NOW()' }) purchasedAt: Date;
  @Column({ type: 'varchar', nullable: true }) notes: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
}
```

```typescript
// apps/backend/src/modules/recycling/purchases/purchase-item.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity({ name: 'purchase_items' })
export class PurchaseItemEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'purchase_id', type: 'uuid' }) purchaseId: string;
  @Column({ name: 'product_id', type: 'uuid' }) productId: string;
  @Column({ type: 'numeric', precision: 10, scale: 4 }) quantity: number;
  @Column({ name: 'unit_price', type: 'numeric', precision: 10, scale: 4 }) unitPrice: number;
  @Column({ type: 'numeric', precision: 12, scale: 2 }) subtotal: number;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
}
```

```typescript
// apps/backend/src/modules/recycling/purchases/stock-movement.entity.ts
import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

export enum MovementType { IN = 'IN', OUT = 'OUT' }

@Entity({ name: 'stock_movements' })
export class StockMovementEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'product_id', type: 'uuid' }) productId: string;
  @Column({ type: 'varchar' }) type: MovementType;
  @Column({ type: 'numeric', precision: 10, scale: 4 }) quantity: number;
  @Column({ name: 'reference_id', type: 'uuid', nullable: true }) referenceId: string | null;
  @Column({ name: 'reference_type', type: 'varchar', nullable: true }) referenceType: string | null;
  @Column({ name: 'moved_at', type: 'timestamptz', default: () => 'NOW()' }) movedAt: Date;
}
```

### Step 2: DTO

```typescript
// apps/backend/src/modules/recycling/purchases/dto/create-purchase.dto.ts
import { IsEnum, IsUUID, IsOptional, IsString, IsArray, ValidateNested, IsNumber, IsPositive } from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentMethod } from '../../cash-register/cash-transaction.entity';

export class PurchaseItemDto {
  @IsUUID()
  productId: string;

  @IsNumber()
  @IsPositive()
  quantity: number;

  @IsNumber()
  @IsPositive()
  unitPrice: number;
}

export class CreatePurchaseDto {
  @IsUUID()
  supplierId: string;

  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PurchaseItemDto)
  items: PurchaseItemDto[];

  @IsOptional()
  @IsString()
  notes?: string;
}
```

### Step 3: Write failing tests for PurchasesService

Critical business rules to test:
1. `create()` throws `BadRequestException` when no open cash session
2. `create()` creates purchase + purchase_items + stock_movements (IN) + cash_transaction atomically
3. `create()` correctly calculates `total_amount` from items (quantity × unitPrice)
4. CASH payment creates cash_transaction that impacts physical balance
5. PIX payment creates cash_transaction that does NOT impact physical balance (still recorded)

```typescript
// apps/backend/src/modules/recycling/purchases/purchases.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { PurchasesService } from './purchases.service';
import { PurchaseEntity } from './purchase.entity';
import { PurchaseItemEntity } from './purchase-item.entity';
import { StockMovementEntity } from './stock-movement.entity';
import { CashSessionEntity, CashSessionStatus } from '../cash-register/cash-session.entity';
import { CashTransactionEntity, PaymentMethod } from '../cash-register/cash-transaction.entity';

const mockPurchaseRepo = { create: jest.fn(), save: jest.fn(), findOne: jest.fn(), createQueryBuilder: jest.fn() };
const mockItemRepo = { create: jest.fn(), save: jest.fn() };
const mockMovementRepo = { create: jest.fn(), save: jest.fn() };
const mockSessionRepo = { findOne: jest.fn() };
const mockTxRepo = { create: jest.fn(), save: jest.fn() };

const mockQueryRunner = {
  connect: jest.fn().mockResolvedValue(undefined),
  query: jest.fn().mockResolvedValue(undefined),
  manager: {
    getRepository: jest.fn((entity) => {
      if (entity === PurchaseEntity) return mockPurchaseRepo;
      if (entity === PurchaseItemEntity) return mockItemRepo;
      if (entity === StockMovementEntity) return mockMovementRepo;
      if (entity === CashSessionEntity) return mockSessionRepo;
      return mockTxRepo;
    }),
  },
  release: jest.fn().mockResolvedValue(undefined),
};
const mockDataSource = { createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner) };

const TENANT = '00000000-0000-0000-0000-000000000001';
const OPERATOR = '00000000-0000-0000-0000-000000000002';

describe('PurchasesService', () => {
  let service: PurchasesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PurchasesService, { provide: DataSource, useValue: mockDataSource }],
    }).compile();
    service = module.get<PurchasesService>(PurchasesService);
    jest.clearAllMocks();
    mockQueryRunner.manager.getRepository.mockImplementation((entity) => {
      if (entity === PurchaseEntity) return mockPurchaseRepo;
      if (entity === PurchaseItemEntity) return mockItemRepo;
      if (entity === StockMovementEntity) return mockMovementRepo;
      if (entity === CashSessionEntity) return mockSessionRepo;
      return mockTxRepo;
    });
  });

  describe('create', () => {
    it('should throw BadRequestException when no open cash session', async () => {
      mockSessionRepo.findOne.mockResolvedValue(null);
      await expect(
        service.create(TENANT, OPERATOR, {
          supplierId: 'sup1',
          paymentMethod: PaymentMethod.CASH,
          items: [{ productId: 'p1', quantity: 10, unitPrice: 2.5 }],
        })
      ).rejects.toThrow(BadRequestException);
    });

    it('should create purchase with correct total_amount', async () => {
      const session = { id: 'sess1', status: CashSessionStatus.OPEN };
      mockSessionRepo.findOne.mockResolvedValue(session);

      const purchase = { id: 'pur1', totalAmount: 25 };
      mockPurchaseRepo.create.mockReturnValue(purchase);
      mockPurchaseRepo.save.mockResolvedValue(purchase);
      mockItemRepo.create.mockReturnValue({});
      mockItemRepo.save.mockResolvedValue({});
      mockMovementRepo.create.mockReturnValue({});
      mockMovementRepo.save.mockResolvedValue({});
      mockTxRepo.create.mockReturnValue({});
      mockTxRepo.save.mockResolvedValue({});

      const result = await service.create(TENANT, OPERATOR, {
        supplierId: 'sup1',
        paymentMethod: PaymentMethod.CASH,
        items: [{ productId: 'p1', quantity: 10, unitPrice: 2.5 }],
      });

      // total_amount = 10 * 2.5 = 25
      expect(mockPurchaseRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ totalAmount: 25 })
      );

      // stock movement IN created
      expect(mockMovementRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'IN', quantity: 10 })
      );

      // cash transaction OUT created (money goes to supplier)
      expect(mockTxRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'OUT', amount: 25 })
      );

      expect(result).toEqual(purchase);
    });

    it('should create cash_transaction for PIX payment (not CASH)', async () => {
      const session = { id: 'sess1', status: CashSessionStatus.OPEN };
      mockSessionRepo.findOne.mockResolvedValue(session);

      const purchase = { id: 'pur1', totalAmount: 30 };
      mockPurchaseRepo.create.mockReturnValue(purchase);
      mockPurchaseRepo.save.mockResolvedValue(purchase);
      mockItemRepo.create.mockReturnValue({});
      mockItemRepo.save.mockResolvedValue({});
      mockMovementRepo.create.mockReturnValue({});
      mockMovementRepo.save.mockResolvedValue({});
      mockTxRepo.create.mockReturnValue({});
      mockTxRepo.save.mockResolvedValue({});

      await service.create(TENANT, OPERATOR, {
        supplierId: 'sup1',
        paymentMethod: PaymentMethod.PIX,
        items: [{ productId: 'p1', quantity: 12, unitPrice: 2.5 }],
      });

      // PIX transaction still created (for reporting), but paymentMethod = PIX
      expect(mockTxRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ paymentMethod: PaymentMethod.PIX, type: 'OUT' })
      );
    });
  });
});
```

Run: `pnpm --filter backend test -- --testPathPattern=purchases.service`
Expected: FAIL.

### Step 4: Implement PurchasesService

```typescript
// apps/backend/src/modules/recycling/purchases/purchases.service.ts
import { Injectable, BadRequestException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { PurchaseEntity } from './purchase.entity';
import { PurchaseItemEntity } from './purchase-item.entity';
import { StockMovementEntity, MovementType } from './stock-movement.entity';
import { CashSessionEntity, CashSessionStatus } from '../cash-register/cash-session.entity';
import { CashTransactionEntity, TransactionType } from '../cash-register/cash-transaction.entity';
import { CreatePurchaseDto } from './dto/create-purchase.dto';

@Injectable()
export class PurchasesService {
  constructor(private readonly dataSource: DataSource) {}

  private getSchemaName(tenantId: string): string {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantId)) {
      throw new Error('Invalid tenantId');
    }
    return `tenant_${tenantId.replace(/-/g, '')}`;
  }

  private async withSchema<T>(tenantId: string, fn: (manager: EntityManager) => Promise<T>): Promise<T> {
    const schemaName = this.getSchemaName(tenantId);
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    try {
      await qr.query(`SET search_path TO "${schemaName}", public`);
      return await fn(qr.manager);
    } finally {
      await qr.release();
    }
  }

  async list(tenantId: string, page: number, limit: number): Promise<{ data: PurchaseEntity[]; total: number; page: number; limit: number }> {
    return this.withSchema(tenantId, async (manager) => {
      const repo = manager.getRepository(PurchaseEntity);
      const qb = repo.createQueryBuilder('p')
        .orderBy('p.purchasedAt', 'DESC')
        .skip((page - 1) * limit)
        .take(limit);
      const [data, total] = await qb.getManyAndCount();
      return { data, total, page, limit };
    });
  }

  async create(tenantId: string, operatorId: string, dto: CreatePurchaseDto): Promise<PurchaseEntity> {
    return this.withSchema(tenantId, async (manager) => {
      const sessionRepo = manager.getRepository(CashSessionEntity);
      const purchaseRepo = manager.getRepository(PurchaseEntity);
      const itemRepo = manager.getRepository(PurchaseItemEntity);
      const movementRepo = manager.getRepository(StockMovementEntity);
      const txRepo = manager.getRepository(CashTransactionEntity);

      // 1. Validate open cash session
      const session = await sessionRepo.findOne({ where: { status: CashSessionStatus.OPEN } });
      if (!session) throw new BadRequestException('Abra o caixa antes de registrar uma compra.');

      // 2. Calculate total
      const totalAmount = dto.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

      // 3. Create purchase
      const purchase = purchaseRepo.create({
        supplierId: dto.supplierId,
        operatorId,
        cashSessionId: session.id,
        paymentMethod: dto.paymentMethod,
        totalAmount,
        notes: dto.notes ?? null,
        purchasedAt: new Date(),
      });
      const savedPurchase = await purchaseRepo.save(purchase);

      // 4. Create purchase_items + stock_movements (IN) for each item
      for (const item of dto.items) {
        const subtotal = item.quantity * item.unitPrice;
        await itemRepo.save(
          itemRepo.create({
            purchaseId: savedPurchase.id,
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            subtotal,
          })
        );
        await movementRepo.save(
          movementRepo.create({
            productId: item.productId,
            type: MovementType.IN,
            quantity: item.quantity,
            referenceId: savedPurchase.id,
            referenceType: 'PURCHASE',
            movedAt: new Date(),
          })
        );
      }

      // 5. Create cash transaction (OUT — company pays supplier)
      await txRepo.save(
        txRepo.create({
          cashSessionId: session.id,
          type: TransactionType.OUT,
          paymentMethod: dto.paymentMethod,
          amount: totalAmount,
          description: `Compra de materiais`,
          referenceId: savedPurchase.id,
          referenceType: 'PURCHASE',
        })
      );

      return savedPurchase;
    });
  }
}
```

### Step 5: Run tests

```bash
pnpm --filter backend test -- --testPathPattern=purchases.service
```
Expected: all PASS.

### Step 6: Create controller, module, add to RecyclingModule

Controller prefix: `recycling/purchases`. Employees with `canRegisterPurchases` can POST. All with `canViewStock` can GET.

### Step 7: Frontend purchases service and pages

`PurchasesPage.tsx` — list with columns: Data, Fornecedor, Forma de Pagamento, Total. Filter by date range.

`NewPurchasePage.tsx` — multi-step or single-page form:
1. Select supplier (searchable dropdown)
2. Add items (product select + quantity input + auto-fill unit price from product, editable)
3. Running total displayed
4. Payment method select (CASH / PIX / CARD)
5. Submit

### Step 8: Run all tests and commit

```bash
pnpm --filter backend test -- --testPathPattern=purchases
git add apps/backend/src/modules/recycling/purchases/ apps/frontend/src/services/recycling/purchases.service.ts apps/frontend/src/pages/recycling/purchases/
git commit -m "feat(recycling): add purchases module with atomic stock and cash integration"
```

---

## Task 7: Stock View

Display current stock balance per product and movement history.

**Files:**
- Create: `apps/backend/src/modules/recycling/stock/stock.service.ts`
- Create: `apps/backend/src/modules/recycling/stock/stock.service.spec.ts`
- Create: `apps/backend/src/modules/recycling/stock/stock.controller.ts`
- Create: `apps/backend/src/modules/recycling/stock/stock.module.ts`
- Create: `apps/frontend/src/services/recycling/stock.service.ts`
- Create: `apps/frontend/src/pages/recycling/stock/StockPage.tsx`
- Modify: `apps/backend/src/modules/recycling/recycling.module.ts`
- Modify: `apps/frontend/src/App.tsx`

### Step 1: Write failing tests for StockService

```typescript
// apps/backend/src/modules/recycling/stock/stock.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { StockService } from './stock.service';

const mockQueryRunner = {
  connect: jest.fn().mockResolvedValue(undefined),
  query: jest.fn(),
  release: jest.fn().mockResolvedValue(undefined),
};
const mockDataSource = { createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner) };

describe('StockService', () => {
  let service: StockService;
  const TENANT = '00000000-0000-0000-0000-000000000001';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [StockService, { provide: DataSource, useValue: mockDataSource }],
    }).compile();
    service = module.get<StockService>(StockService);
    jest.clearAllMocks();
  });

  describe('getBalances', () => {
    it('should return stock balance per product using SUM of movements', async () => {
      mockQueryRunner.query
        .mockResolvedValueOnce(undefined) // SET search_path
        .mockResolvedValueOnce([
          { product_id: 'p1', product_name: 'Papelão', unit_abbreviation: 'kg', balance: '150.0000' },
          { product_id: 'p2', product_name: 'Latinha', unit_abbreviation: 'kg', balance: '30.0000' },
        ]);

      const result = await service.getBalances(TENANT);
      expect(result).toHaveLength(2);
      expect(result[0].balance).toBe(150);
    });
  });

  describe('getMovements', () => {
    it('should return movements for a specific product ordered by date desc', async () => {
      mockQueryRunner.query
        .mockResolvedValueOnce(undefined) // SET search_path
        .mockResolvedValueOnce([
          { id: 'm1', type: 'IN', quantity: '100.0000', moved_at: '2026-04-07T10:00:00Z' },
        ]);

      const result = await service.getMovements(TENANT, 'p1');
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('IN');
    });
  });
});
```

Run: `pnpm --filter backend test -- --testPathPattern=stock.service`
Expected: FAIL.

### Step 2: Implement StockService

```typescript
// apps/backend/src/modules/recycling/stock/stock.service.ts
import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class StockService {
  constructor(private readonly dataSource: DataSource) {}

  private getSchemaName(tenantId: string): string {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantId)) {
      throw new Error('Invalid tenantId');
    }
    return `tenant_${tenantId.replace(/-/g, '')}`;
  }

  async getBalances(tenantId: string): Promise<Array<{
    productId: string;
    productName: string;
    unitAbbreviation: string;
    balance: number;
  }>> {
    const schemaName = this.getSchemaName(tenantId);
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    try {
      await qr.query(`SET search_path TO "${schemaName}", public`);
      const rows = await qr.query(`
        SELECT
          p.id as product_id,
          p.name as product_name,
          u.abbreviation as unit_abbreviation,
          COALESCE(
            SUM(CASE WHEN sm.type = 'IN' THEN sm.quantity ELSE -sm.quantity END),
            0
          ) as balance
        FROM "${schemaName}".products p
        JOIN "${schemaName}".units u ON p.unit_id = u.id
        LEFT JOIN "${schemaName}".stock_movements sm ON sm.product_id = p.id
        WHERE p.active = true
        GROUP BY p.id, p.name, u.abbreviation
        ORDER BY p.name ASC
      `);
      return rows.map((r: any) => ({
        productId: r.product_id,
        productName: r.product_name,
        unitAbbreviation: r.unit_abbreviation,
        balance: Number(r.balance),
      }));
    } finally {
      await qr.release();
    }
  }

  async getMovements(tenantId: string, productId: string): Promise<Array<{
    id: string;
    type: string;
    quantity: number;
    referenceType: string | null;
    movedAt: Date;
  }>> {
    const schemaName = this.getSchemaName(tenantId);
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    try {
      await qr.query(`SET search_path TO "${schemaName}", public`);
      const rows = await qr.query(`
        SELECT id, type, quantity, reference_type, moved_at
        FROM "${schemaName}".stock_movements
        WHERE product_id = $1
        ORDER BY moved_at DESC
        LIMIT 100
      `, [productId]);
      return rows.map((r: any) => ({
        id: r.id,
        type: r.type,
        quantity: Number(r.quantity),
        referenceType: r.reference_type,
        movedAt: r.moved_at,
      }));
    } finally {
      await qr.release();
    }
  }

  async getDailyPurchaseTotals(tenantId: string, date: string): Promise<Array<{
    productId: string;
    productName: string;
    totalQuantity: number;
    unitAbbreviation: string;
  }>> {
    const schemaName = this.getSchemaName(tenantId);
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    try {
      await qr.query(`SET search_path TO "${schemaName}", public`);
      const rows = await qr.query(`
        SELECT
          p.id as product_id,
          p.name as product_name,
          u.abbreviation as unit_abbreviation,
          COALESCE(SUM(sm.quantity), 0) as total_quantity
        FROM "${schemaName}".stock_movements sm
        JOIN "${schemaName}".products p ON sm.product_id = p.id
        JOIN "${schemaName}".units u ON p.unit_id = u.id
        WHERE sm.type = 'IN'
          AND sm.reference_type = 'PURCHASE'
          AND DATE(sm.moved_at) = $1
        GROUP BY p.id, p.name, u.abbreviation
        ORDER BY total_quantity DESC
      `, [date]);
      return rows.map((r: any) => ({
        productId: r.product_id,
        productName: r.product_name,
        unitAbbreviation: r.unit_abbreviation,
        totalQuantity: Number(r.total_quantity),
      }));
    } finally {
      await qr.release();
    }
  }
}
```

### Step 3: Run tests

```bash
pnpm --filter backend test -- --testPathPattern=stock.service
```
Expected: all PASS.

### Step 4: Create controller, module, add to RecyclingModule

Routes:
- `GET /recycling/stock` — current balance per product
- `GET /recycling/stock/:productId/movements` — movement history
- `GET /recycling/stock/daily?date=2026-04-07` — daily purchase totals (for reports)

Guard with `canViewStock` permission.

### Step 5: Frontend stock page

`StockPage.tsx` — table with columns: Produto, Unidade, Saldo Atual. Color-code: green if balance > 0, yellow if zero. Click a row to expand movement history.

### Step 6: Run all tests and commit

```bash
pnpm --filter backend test -- --testPathPattern=stock
git add apps/backend/src/modules/recycling/stock/ apps/frontend/src/services/recycling/stock.service.ts apps/frontend/src/pages/recycling/stock/
git commit -m "feat(recycling): add stock module with balance and movement history"
```

---

## Task 8: Buyers + Sales

CRUD for buyer companies and sale registration with stock write-down.

**Files:**
- Create: `apps/backend/src/modules/recycling/buyers/buyer.entity.ts`
- Create: `apps/backend/src/modules/recycling/buyers/dto/create-buyer.dto.ts`
- Create: `apps/backend/src/modules/recycling/buyers/dto/update-buyer.dto.ts`
- Create: `apps/backend/src/modules/recycling/buyers/buyers.service.ts`
- Create: `apps/backend/src/modules/recycling/buyers/buyers.service.spec.ts`
- Create: `apps/backend/src/modules/recycling/buyers/buyers.controller.ts`
- Create: `apps/backend/src/modules/recycling/buyers/buyers.module.ts`
- Create: `apps/backend/src/modules/recycling/sales/sale.entity.ts`
- Create: `apps/backend/src/modules/recycling/sales/sale-item.entity.ts`
- Create: `apps/backend/src/modules/recycling/sales/dto/create-sale.dto.ts`
- Create: `apps/backend/src/modules/recycling/sales/sales.service.ts`
- Create: `apps/backend/src/modules/recycling/sales/sales.service.spec.ts`
- Create: `apps/backend/src/modules/recycling/sales/sales.controller.ts`
- Create: `apps/backend/src/modules/recycling/sales/sales.module.ts`
- Create: `apps/frontend/src/services/recycling/buyers.service.ts`
- Create: `apps/frontend/src/services/recycling/sales.service.ts`
- Create: `apps/frontend/src/pages/recycling/buyers/BuyersPage.tsx`
- Create: `apps/frontend/src/pages/recycling/buyers/BuyerFormPage.tsx`
- Create: `apps/frontend/src/pages/recycling/sales/SalesPage.tsx`
- Create: `apps/frontend/src/pages/recycling/sales/NewSalePage.tsx`
- Modify: `apps/backend/src/modules/recycling/recycling.module.ts`
- Modify: `apps/frontend/src/App.tsx`

### Step 1: Buyer entity

```typescript
// apps/backend/src/modules/recycling/buyers/buyer.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'buyers' })
export class BuyerEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() name: string;
  @Column({ type: 'varchar', nullable: true }) cnpj: string | null;
  @Column({ type: 'varchar', nullable: true }) phone: string | null;
  @Column({ name: 'contact_name', type: 'varchar', nullable: true }) contactName: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;
}
```

### Step 2: Buyer DTOs

```typescript
// apps/backend/src/modules/recycling/buyers/dto/create-buyer.dto.ts
import { IsString, IsOptional, Matches, MinLength } from 'class-validator';

export class CreateBuyerDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsOptional()
  @Matches(/^\d{14}$/, { message: 'CNPJ deve ter 14 dígitos' })
  cnpj?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  contactName?: string;
}
```

### Step 3: Implement BuyersService with tests (follow SuppliersService pattern)

Tests: list, getById (NotFoundException), create, update, delete (ConflictException when buyer has sales).

### Step 4: Sale entities

```typescript
// apps/backend/src/modules/recycling/sales/sale.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity({ name: 'sales' })
export class SaleEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'buyer_id', type: 'uuid' }) buyerId: string;
  @Column({ name: 'operator_id', type: 'uuid' }) operatorId: string;
  @Column({ name: 'sold_at', type: 'timestamptz', default: () => 'NOW()' }) soldAt: Date;
  @Column({ type: 'varchar', nullable: true }) notes: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
}
```

```typescript
// apps/backend/src/modules/recycling/sales/sale-item.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity({ name: 'sale_items' })
export class SaleItemEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'sale_id', type: 'uuid' }) saleId: string;
  @Column({ name: 'product_id', type: 'uuid' }) productId: string;
  @Column({ type: 'numeric', precision: 10, scale: 4 }) quantity: number;
  @Column({ name: 'unit_price', type: 'numeric', precision: 10, scale: 4 }) unitPrice: number;
  @Column({ type: 'numeric', precision: 12, scale: 2 }) subtotal: number;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
}
```

### Step 5: Sale DTO

```typescript
// apps/backend/src/modules/recycling/sales/dto/create-sale.dto.ts
import { IsArray, IsOptional, IsPositive, IsNumber, IsString, IsUUID, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class SaleItemDto {
  @IsUUID() productId: string;
  @IsNumber() @IsPositive() quantity: number;
  @IsNumber() @IsPositive() unitPrice: number;
}

export class CreateSaleDto {
  @IsUUID() buyerId: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => SaleItemDto) items: SaleItemDto[];
  @IsOptional() @IsString() notes?: string;
}
```

### Step 6: Write failing tests for SalesService

Critical rules:
1. `create()` throws `BadRequestException` when stock is insufficient for any item
2. `create()` creates sale + sale_items + stock_movements (OUT) atomically
3. `create()` does NOT create any cash_transaction

```typescript
// apps/backend/src/modules/recycling/sales/sales.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { SalesService } from './sales.service';
import { SaleEntity } from './sale.entity';
import { SaleItemEntity } from './sale-item.entity';
import { StockMovementEntity } from '../purchases/stock-movement.entity';

const mockSaleRepo = { create: jest.fn(), save: jest.fn(), createQueryBuilder: jest.fn() };
const mockItemRepo = { create: jest.fn(), save: jest.fn() };
const mockMovementRepo = { create: jest.fn(), save: jest.fn() };

const mockQueryRunner = {
  connect: jest.fn().mockResolvedValue(undefined),
  query: jest.fn(),
  manager: {
    getRepository: jest.fn((entity) => {
      if (entity === SaleEntity) return mockSaleRepo;
      if (entity === SaleItemEntity) return mockItemRepo;
      return mockMovementRepo;
    }),
  },
  release: jest.fn().mockResolvedValue(undefined),
};
const mockDataSource = { createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner) };

const TENANT = '00000000-0000-0000-0000-000000000001';
const OPERATOR = '00000000-0000-0000-0000-000000000002';

describe('SalesService', () => {
  let service: SalesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SalesService, { provide: DataSource, useValue: mockDataSource }],
    }).compile();
    service = module.get<SalesService>(SalesService);
    jest.clearAllMocks();
    mockQueryRunner.manager.getRepository.mockImplementation((entity) => {
      if (entity === SaleEntity) return mockSaleRepo;
      if (entity === SaleItemEntity) return mockItemRepo;
      return mockMovementRepo;
    });
  });

  describe('create', () => {
    it('should throw BadRequestException when stock is insufficient', async () => {
      // Balance query returns 5, but trying to sell 10
      mockQueryRunner.query
        .mockResolvedValueOnce(undefined) // SET search_path
        .mockResolvedValueOnce([{ balance: '5.0000' }]); // stock balance for p1

      await expect(
        service.create(TENANT, OPERATOR, {
          buyerId: 'b1',
          items: [{ productId: 'p1', quantity: 10, unitPrice: 1.5 }],
        })
      ).rejects.toThrow(BadRequestException);
    });

    it('should create sale with stock OUT movements when stock is sufficient', async () => {
      mockQueryRunner.query
        .mockResolvedValueOnce(undefined) // SET search_path
        .mockResolvedValueOnce([{ balance: '50.0000' }]); // sufficient stock

      const sale = { id: 'sale1' };
      mockSaleRepo.create.mockReturnValue(sale);
      mockSaleRepo.save.mockResolvedValue(sale);
      mockItemRepo.create.mockReturnValue({});
      mockItemRepo.save.mockResolvedValue({});
      mockMovementRepo.create.mockReturnValue({});
      mockMovementRepo.save.mockResolvedValue({});

      const result = await service.create(TENANT, OPERATOR, {
        buyerId: 'b1',
        items: [{ productId: 'p1', quantity: 10, unitPrice: 1.5 }],
      });

      expect(mockMovementRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'OUT', quantity: 10 })
      );
      expect(result).toEqual(sale);
    });
  });
});
```

Run: `pnpm --filter backend test -- --testPathPattern=sales.service`
Expected: FAIL.

### Step 7: Implement SalesService

```typescript
// apps/backend/src/modules/recycling/sales/sales.service.ts
import { Injectable, BadRequestException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { SaleEntity } from './sale.entity';
import { SaleItemEntity } from './sale-item.entity';
import { StockMovementEntity, MovementType } from '../purchases/stock-movement.entity';
import { CreateSaleDto } from './dto/create-sale.dto';

@Injectable()
export class SalesService {
  constructor(private readonly dataSource: DataSource) {}

  private getSchemaName(tenantId: string): string {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantId)) {
      throw new Error('Invalid tenantId');
    }
    return `tenant_${tenantId.replace(/-/g, '')}`;
  }

  private async withSchema<T>(tenantId: string, fn: (manager: EntityManager, qr: any) => Promise<T>): Promise<T> {
    const schemaName = this.getSchemaName(tenantId);
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    try {
      await qr.query(`SET search_path TO "${schemaName}", public`);
      return await fn(qr.manager, qr);
    } finally {
      await qr.release();
    }
  }

  private async getProductBalance(qr: any, schemaName: string, productId: string): Promise<number> {
    const [{ balance }] = await qr.query(`
      SELECT COALESCE(
        SUM(CASE WHEN type = 'IN' THEN quantity ELSE -quantity END), 0
      ) as balance
      FROM "${schemaName}".stock_movements
      WHERE product_id = $1
    `, [productId]);
    return Number(balance);
  }

  async list(tenantId: string, page: number, limit: number): Promise<{ data: SaleEntity[]; total: number; page: number; limit: number }> {
    return this.withSchema(tenantId, async (manager) => {
      const repo = manager.getRepository(SaleEntity);
      const qb = repo.createQueryBuilder('s')
        .orderBy('s.soldAt', 'DESC')
        .skip((page - 1) * limit)
        .take(limit);
      const [data, total] = await qb.getManyAndCount();
      return { data, total, page, limit };
    });
  }

  async create(tenantId: string, operatorId: string, dto: CreateSaleDto): Promise<SaleEntity> {
    const schemaName = this.getSchemaName(tenantId);
    return this.withSchema(tenantId, async (manager, qr) => {
      const saleRepo = manager.getRepository(SaleEntity);
      const itemRepo = manager.getRepository(SaleItemEntity);
      const movementRepo = manager.getRepository(StockMovementEntity);

      // 1. Validate stock for each item
      for (const item of dto.items) {
        const balance = await this.getProductBalance(qr, schemaName, item.productId);
        if (balance < item.quantity) {
          throw new BadRequestException(
            `Estoque insuficiente para o produto ${item.productId}. Disponível: ${balance}, Solicitado: ${item.quantity}`
          );
        }
      }

      // 2. Create sale
      const sale = saleRepo.create({
        buyerId: dto.buyerId,
        operatorId,
        soldAt: new Date(),
        notes: dto.notes ?? null,
      });
      const savedSale = await saleRepo.save(sale);

      // 3. Create sale_items + stock_movements (OUT)
      for (const item of dto.items) {
        const subtotal = item.quantity * item.unitPrice;
        await itemRepo.save(
          itemRepo.create({
            saleId: savedSale.id,
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            subtotal,
          })
        );
        await movementRepo.save(
          movementRepo.create({
            productId: item.productId,
            type: MovementType.OUT,
            quantity: item.quantity,
            referenceId: savedSale.id,
            referenceType: 'SALE',
            movedAt: new Date(),
          })
        );
      }

      return savedSale;
    });
  }
}
```

### Step 8: Run tests

```bash
pnpm --filter backend test -- --testPathPattern=sales.service
```
Expected: all PASS.

### Step 9: Create controllers, modules, add to RecyclingModule

Buyers controller: OWNER-only CRUD at `recycling/buyers`.
Sales controller: employees with `canRegisterSales` can POST, `canViewStock` can GET at `recycling/sales`.

### Step 10: Frontend buyers + sales pages

`BuyersPage.tsx` — table: Nome, CNPJ, Telefone, Contato.
`BuyerFormPage.tsx` — form with name, cnpj, phone, contactName.
`SalesPage.tsx` — list: Data, Comprador, itens count.
`NewSalePage.tsx` — select buyer, add items (product + quantity + price), shows current stock balance next to quantity field as a hint, submit.

### Step 11: Run all tests and commit

```bash
pnpm --filter backend test -- --testPathPattern="buyers|sales"
git add apps/backend/src/modules/recycling/buyers/ apps/backend/src/modules/recycling/sales/ apps/frontend/src/services/recycling/buyers.service.ts apps/frontend/src/services/recycling/sales.service.ts apps/frontend/src/pages/recycling/buyers/ apps/frontend/src/pages/recycling/sales/
git commit -m "feat(recycling): add buyers and sales modules with stock validation"
```

---

## Task 9: Dashboard + Basic Reports

Dashboard cards and basic metrics for daily operations.

**Files:**
- Create: `apps/backend/src/modules/recycling/reports/reports.service.ts`
- Create: `apps/backend/src/modules/recycling/reports/reports.service.spec.ts`
- Create: `apps/backend/src/modules/recycling/reports/reports.controller.ts`
- Create: `apps/backend/src/modules/recycling/reports/reports.module.ts`
- Create: `apps/frontend/src/services/recycling/reports.service.ts`
- Modify: `apps/frontend/src/pages/recycling/DashboardPage.tsx`
- Create: `apps/frontend/src/pages/recycling/reports/ReportsPage.tsx`
- Modify: `apps/backend/src/modules/recycling/recycling.module.ts`
- Modify: `apps/frontend/src/App.tsx`

### Step 1: Write failing tests for ReportsService

```typescript
// apps/backend/src/modules/recycling/reports/reports.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { RecyclingReportsService } from './reports.service';

const mockQueryRunner = {
  connect: jest.fn().mockResolvedValue(undefined),
  query: jest.fn(),
  release: jest.fn().mockResolvedValue(undefined),
};
const mockDataSource = { createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner) };

describe('RecyclingReportsService', () => {
  let service: RecyclingReportsService;
  const TENANT = '00000000-0000-0000-0000-000000000001';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RecyclingReportsService, { provide: DataSource, useValue: mockDataSource }],
    }).compile();
    service = module.get<RecyclingReportsService>(RecyclingReportsService);
    jest.clearAllMocks();
  });

  describe('getDashboardSummary', () => {
    it('should return today totals and cash session info', async () => {
      mockQueryRunner.query
        .mockResolvedValueOnce(undefined) // SET search_path
        .mockResolvedValueOnce([{ total_today: '1500.00', purchases_count: '5' }])
        .mockResolvedValueOnce([{ status: 'OPEN', opening_balance: '200.00' }]);

      const result = await service.getDashboardSummary(TENANT);
      expect(result.totalPurchasedToday).toBe(1500);
      expect(result.purchasesCountToday).toBe(5);
      expect(result.cashSession).toBeDefined();
    });
  });

  describe('getPurchasesByPeriod', () => {
    it('should return purchase totals grouped by day', async () => {
      mockQueryRunner.query
        .mockResolvedValueOnce(undefined) // SET search_path
        .mockResolvedValueOnce([
          { date: '2026-04-07', total: '1500.00', count: '3' },
        ]);

      const result = await service.getPurchasesByPeriod(TENANT, '2026-04-01', '2026-04-07');
      expect(result).toHaveLength(1);
      expect(result[0].total).toBe(1500);
    });
  });
});
```

Run: `pnpm --filter backend test -- --testPathPattern=recycling.*reports.service`
Expected: FAIL.

### Step 2: Implement RecyclingReportsService

```typescript
// apps/backend/src/modules/recycling/reports/reports.service.ts
import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class RecyclingReportsService {
  constructor(private readonly dataSource: DataSource) {}

  private getSchemaName(tenantId: string): string {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantId)) {
      throw new Error('Invalid tenantId');
    }
    return `tenant_${tenantId.replace(/-/g, '')}`;
  }

  async getDashboardSummary(tenantId: string): Promise<{
    totalPurchasedToday: number;
    purchasesCountToday: number;
    cashSession: { status: string; openingBalance: number } | null;
  }> {
    const schemaName = this.getSchemaName(tenantId);
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    try {
      await qr.query(`SET search_path TO "${schemaName}", public`);

      const [purchaseSummary] = await qr.query(`
        SELECT
          COALESCE(SUM(total_amount), 0) as total_today,
          COUNT(*) as purchases_count
        FROM "${schemaName}".purchases
        WHERE DATE(purchased_at) = CURRENT_DATE
      `);

      const [cashSession] = await qr.query(`
        SELECT status, opening_balance
        FROM "${schemaName}".cash_sessions
        WHERE status = 'OPEN'
        LIMIT 1
      `);

      return {
        totalPurchasedToday: Number(purchaseSummary.total_today),
        purchasesCountToday: Number(purchaseSummary.purchases_count),
        cashSession: cashSession
          ? { status: cashSession.status, openingBalance: Number(cashSession.opening_balance) }
          : null,
      };
    } finally {
      await qr.release();
    }
  }

  async getPurchasesByPeriod(tenantId: string, startDate: string, endDate: string): Promise<Array<{
    date: string;
    total: number;
    count: number;
  }>> {
    const schemaName = this.getSchemaName(tenantId);
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    try {
      await qr.query(`SET search_path TO "${schemaName}", public`);
      const rows = await qr.query(`
        SELECT
          DATE(purchased_at) as date,
          SUM(total_amount) as total,
          COUNT(*) as count
        FROM "${schemaName}".purchases
        WHERE DATE(purchased_at) BETWEEN $1 AND $2
        GROUP BY DATE(purchased_at)
        ORDER BY date ASC
      `, [startDate, endDate]);
      return rows.map((r: any) => ({
        date: r.date,
        total: Number(r.total),
        count: Number(r.count),
      }));
    } finally {
      await qr.release();
    }
  }
}
```

### Step 3: Run tests

```bash
pnpm --filter backend test -- --testPathPattern=recycling.*reports
```
Expected: all PASS.

### Step 4: Create ReportsController and module

```typescript
// Routes:
// GET /recycling/reports/dashboard — dashboard summary
// GET /recycling/reports/purchases?startDate=2026-04-01&endDate=2026-04-07 — OWNER only
```

### Step 5: Update RecyclingDashboardPage

Replace the stub content with real data from `GET /recycling/reports/dashboard`:

```tsx
// apps/frontend/src/pages/recycling/DashboardPage.tsx
// Three CCard components:
// 1. "Compras Hoje" — totalPurchasedToday (R$ formatted) + purchasesCountToday
// 2. "Caixa" — status badge (OPEN/CLOSED) + opening balance
// 3. "Estoque Crítico" — products with balance = 0 (link to /recycling/stock)
```

### Step 6: Create ReportsPage

`apps/frontend/src/pages/recycling/reports/ReportsPage.tsx`:
- Date range picker (start/end date)
- Table: Data, Total Comprado (R$), Nº de Compras
- Summary row with totals

### Step 7: Add reports route to App.tsx under `/recycling`

```tsx
<Route path="reports" element={<ReportsPage />} />
```

### Step 8: Run all tests

```bash
pnpm --filter backend test
pnpm --filter frontend test
```
Expected: all PASS.

### Step 9: Commit

```bash
git add apps/backend/src/modules/recycling/reports/ apps/frontend/src/services/recycling/reports.service.ts apps/frontend/src/pages/recycling/DashboardPage.tsx apps/frontend/src/pages/recycling/reports/ apps/frontend/src/App.tsx
git commit -m "feat(recycling): add dashboard and basic purchase reports"
```

---

## Final Verification

### Step 1: Run full test suite

```bash
pnpm --filter backend test
pnpm --filter frontend test
```
Expected: all PASS, no regressions in workshop module.

### Step 2: Smoke test via docker-compose

```bash
docker-compose up
```

Test the complete flow:
1. Register new recycling company at `http://localhost:3000/register/recycling`
2. Login — should redirect to `/recycling/dashboard`
3. Create a unit of measure (kg) and a product (Papelão, R$ 0.50/kg)
4. Create a supplier (João Silva, CPF)
5. Open cash register
6. Create a purchase (10 kg papelão from João, CASH payment)
7. Verify stock shows 10 kg papelão
8. Create a buyer company
9. Create a sale (5 kg papelão)
10. Verify stock shows 5 kg papelão
11. Close cash register — verify closing balance = opening + 0 (no cash IN) - cash paid

### Step 3: Verify workshop module unchanged

Login as existing workshop tenant — should still go to `/workshop/dashboard` with all features working.

### Step 4: Final commit

```bash
git commit -m "feat(recycling): complete recycling segment v1"
```
