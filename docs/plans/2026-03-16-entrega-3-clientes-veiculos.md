# Entrega 3: Clientes e Veículos — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implementar CRUD de clientes e veículos no schema de cada tenant, com listagem paginada + busca no frontend.

**Architecture:** Customers e vehicles vivem em schemas dedicados por tenant (`tenant_<uuid>.customers`, `tenant_<uuid>.vehicles`). O `TenancyService.provisionSchema` cria as tabelas via SQL idempotente (`IF NOT EXISTS`) ao provisionar cada tenant. Os serviços usam um QueryRunner que executa `SET search_path TO "<schemaName>", public` antes de cada operação, garantindo isolamento sem precisar de schema hardcoded nas entidades.

**Tech Stack:** NestJS 10, TypeORM 0.3 (QueryRunner + EntityManager), class-validator, React + MUI, React Hook Form + Zod, axios.

---

## Task 1: Tenant Schema Migration + Atualizar provisionSchema

**Files:**
- Create: `apps/backend/src/database/tenant-migrations/create-tenant-tables.ts`
- Modify: `apps/backend/src/modules/core/tenancy/tenancy.service.ts`
- Modify: `apps/backend/src/modules/core/tenancy/tenancy.service.spec.ts`

**Contexto:** O método `provisionSchema` atual só cria o schema vazio. Precisamos também criar as tabelas `customers` e `vehicles` com `IF NOT EXISTS` para idempotência.

**Step 1: Criar `apps/backend/src/database/tenant-migrations/create-tenant-tables.ts`**

```typescript
/**
 * Gera as instruções SQL para criar as tabelas de um novo tenant.
 * Usa CREATE TABLE IF NOT EXISTS para idempotência (pode ser re-executado).
 */
export function createTenantTablesSql(schemaName: string): string[] {
  return [
    `CREATE TABLE IF NOT EXISTS "${schemaName}".customers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      nome VARCHAR NOT NULL,
      cpf_cnpj VARCHAR(14) UNIQUE NOT NULL,
      whatsapp VARCHAR,
      email VARCHAR,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS "${schemaName}".vehicles (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      customer_id UUID NOT NULL
        REFERENCES "${schemaName}".customers(id) ON DELETE RESTRICT,
      placa VARCHAR(7) UNIQUE NOT NULL,
      marca VARCHAR NOT NULL,
      modelo VARCHAR NOT NULL,
      ano INTEGER NOT NULL,
      km INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,
  ];
}
```

**Step 2: Atualizar `provisionSchema` em `tenancy.service.ts`**

Adicionar import no topo:
```typescript
import { createTenantTablesSql } from '../../database/tenant-migrations/create-tenant-tables';
```

Substituir o método `provisionSchema`:
```typescript
private async provisionSchema(schemaName: string): Promise<void> {
  if (!/^[a-z0-9_]+$/.test(schemaName)) {
    throw new Error(`Invalid schema name: ${schemaName}`);
  }
  const qr = this.dataSource.createQueryRunner();
  await qr.connect();
  try {
    await qr.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);
    for (const sql of createTenantTablesSql(schemaName)) {
      await qr.query(sql);
    }
  } finally {
    await qr.release();
  }
}
```

**Step 3: Escrever testes ANTES de rodar**

Adicionar em `tenancy.service.spec.ts` (dentro do `describe('provisionSchema')`):

```typescript
it('should create customers and vehicles tables after schema', async () => {
  mockQueryRunner.query.mockResolvedValue(undefined);

  await (service as any).provisionSchema('tenant_abc');

  // schema criado primeiro
  expect(mockQueryRunner.query).toHaveBeenNthCalledWith(
    1,
    expect.stringContaining('CREATE SCHEMA IF NOT EXISTS "tenant_abc"'),
  );
  // tabela customers
  expect(mockQueryRunner.query).toHaveBeenCalledWith(
    expect.stringContaining('customers'),
  );
  // tabela vehicles
  expect(mockQueryRunner.query).toHaveBeenCalledWith(
    expect.stringContaining('vehicles'),
  );
});
```

**Step 4: Rodar para confirmar que PASSA**

```bash
cd apps/backend
pnpm test -- --testPathPattern=tenancy.service.spec
```

Expected: PASS

**Step 5: Commit**

```bash
cd ../../
git add apps/backend/src/database/tenant-migrations/ apps/backend/src/modules/core/tenancy/
git commit -m "feat(backend): provision tenant schema with customers and vehicles tables"
```

---

## Task 2: CustomerEntity + VehicleEntity

**Files:**
- Create: `apps/backend/src/modules/workshop/customers/customer.entity.ts`
- Create: `apps/backend/src/modules/workshop/vehicles/vehicle.entity.ts`
- Modify: `apps/backend/src/database/database.module.ts`

**Contexto:** As entidades não têm `schema` fixo no decorator — o schema é resolvido dinamicamente via `search_path` definido no QueryRunner antes de cada query.

**Step 1: Criar `apps/backend/src/modules/workshop/customers/customer.entity.ts`**

```typescript
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'customers' })
export class CustomerEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  nome: string;

  @Column({ name: 'cpf_cnpj', length: 14, unique: true })
  cpfCnpj: string;

  @Column({ nullable: true })
  whatsapp: string | null;

  @Column({ nullable: true })
  email: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
```

**Step 2: Criar `apps/backend/src/modules/workshop/vehicles/vehicle.entity.ts`**

```typescript
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'vehicles' })
export class VehicleEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'customer_id', type: 'uuid' })
  customerId: string;

  @Column({ length: 7, unique: true })
  placa: string;

  @Column()
  marca: string;

  @Column()
  modelo: string;

  @Column({ type: 'integer' })
  ano: number;

  @Column({ type: 'integer', default: 0 })
  km: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
```

**Step 3: Adicionar entidades ao `database.module.ts`**

Adicionar imports:
```typescript
import { CustomerEntity } from '../modules/workshop/customers/customer.entity';
import { VehicleEntity } from '../modules/workshop/vehicles/vehicle.entity';
```

Atualizar a linha `entities`:
```typescript
entities: [TenantEntity, UserEntity, RefreshTokenEntity, BillingEntity, CustomerEntity, VehicleEntity],
```

**Step 4: Rodar todos os testes para confirmar que nada quebrou**

```bash
cd apps/backend
pnpm test
```

Expected: PASS — todos os 40 testes existentes.

**Step 5: Commit**

```bash
cd ../../
git add apps/backend/src/modules/workshop/customers/customer.entity.ts
git add apps/backend/src/modules/workshop/vehicles/vehicle.entity.ts
git add apps/backend/src/database/database.module.ts
git commit -m "feat(backend): add CustomerEntity and VehicleEntity for tenant schema"
```

---

## Task 3: Customers Module — Service (TDD) + Controller + Module

**Files:**
- Create: `apps/backend/src/modules/workshop/customers/dto/create-customer.dto.ts`
- Create: `apps/backend/src/modules/workshop/customers/dto/update-customer.dto.ts`
- Create: `apps/backend/src/modules/workshop/customers/customers.service.spec.ts`
- Create: `apps/backend/src/modules/workshop/customers/customers.service.ts`
- Create: `apps/backend/src/modules/workshop/customers/customers.controller.ts`
- Create: `apps/backend/src/modules/workshop/customers/customers.module.ts`
- Modify: `apps/backend/src/app.module.ts`

**Contexto:** O service usa `DataSource` + QueryRunner com `SET search_path`. O `tenantId` vem do JWT e o schema name é derivado internamente. A deleção falha com `409 Conflict` se o cliente tiver veículos cadastrados.

**Step 1: Criar DTOs**

`apps/backend/src/modules/workshop/customers/dto/create-customer.dto.ts`:
```typescript
import { IsString, IsEmail, IsOptional, MinLength, Matches } from 'class-validator';

export class CreateCustomerDto {
  @IsString()
  @MinLength(2)
  nome: string;

  @IsString()
  @Matches(/^\d{11}$|^\d{14}$/, {
    message: 'CPF deve ter 11 dígitos ou CNPJ 14 dígitos numéricos',
  })
  cpfCnpj: string;

  @IsOptional()
  @IsString()
  whatsapp?: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}
```

`apps/backend/src/modules/workshop/customers/dto/update-customer.dto.ts`:
```typescript
import { PartialType } from '@nestjs/mapped-types';
import { CreateCustomerDto } from './create-customer.dto';

export class UpdateCustomerDto extends PartialType(CreateCustomerDto) {}
```

**Step 2: Escrever testes do CustomersService ANTES de implementar**

Criar `apps/backend/src/modules/workshop/customers/customers.service.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CustomersService } from './customers.service';
import { CustomerEntity } from './customer.entity';

const mockQb = {
  where: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  take: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  getManyAndCount: jest.fn(),
};

const mockCustomerRepo = {
  createQueryBuilder: jest.fn().mockReturnValue(mockQb),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  count: jest.fn(),
};

const mockVehicleRepo = {
  count: jest.fn(),
};

const mockQueryRunner = {
  connect: jest.fn().mockResolvedValue(undefined),
  query: jest.fn().mockResolvedValue(undefined),
  manager: {
    getRepository: jest.fn((entity) => {
      if (entity === CustomerEntity) return mockCustomerRepo;
      return mockVehicleRepo;
    }),
  },
  release: jest.fn().mockResolvedValue(undefined),
};

const mockDataSource = {
  createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
};

describe('CustomersService', () => {
  let service: CustomersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomersService,
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<CustomersService>(CustomersService);
    jest.clearAllMocks();
    mockQueryRunner.manager.getRepository.mockImplementation((entity) => {
      if (entity === CustomerEntity) return mockCustomerRepo;
      return mockVehicleRepo;
    });
    mockCustomerRepo.createQueryBuilder.mockReturnValue(mockQb);
    mockQb.where.mockReturnThis();
    mockQb.skip.mockReturnThis();
    mockQb.take.mockReturnThis();
    mockQb.orderBy.mockReturnThis();
  });

  describe('list', () => {
    it('should return paginated customers', async () => {
      const customers = [{ id: 'c1', nome: 'João' }];
      mockQb.getManyAndCount.mockResolvedValue([customers, 1]);

      const result = await service.list('tenant-1', 1, 20);

      expect(result).toEqual({ data: customers, total: 1, page: 1, limit: 20 });
      expect(mockQueryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining('SET search_path'),
      );
    });

    it('should apply search filter when provided', async () => {
      mockQb.getManyAndCount.mockResolvedValue([[], 0]);

      await service.list('tenant-1', 1, 20, 'joao');

      expect(mockQb.where).toHaveBeenCalledWith(
        expect.stringContaining('ILIKE'),
        expect.any(Object),
      );
    });
  });

  describe('getById', () => {
    it('should return customer with vehicles', async () => {
      const customer = { id: 'c1', nome: 'João' };
      mockCustomerRepo.findOne.mockResolvedValue(customer);

      const result = await service.getById('tenant-1', 'c1');

      expect(result).toEqual(customer);
    });

    it('should throw NotFoundException when customer not found', async () => {
      mockCustomerRepo.findOne.mockResolvedValue(null);

      await expect(service.getById('tenant-1', 'nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('should create and return customer', async () => {
      const dto = { nome: 'João', cpfCnpj: '12345678901' };
      const created = { id: 'c1', ...dto };
      mockCustomerRepo.create.mockReturnValue(created);
      mockCustomerRepo.save.mockResolvedValue(created);

      const result = await service.create('tenant-1', dto as any);

      expect(result).toEqual(created);
      expect(mockCustomerRepo.save).toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('should throw ConflictException when customer has vehicles', async () => {
      const customer = { id: 'c1' };
      mockCustomerRepo.findOne.mockResolvedValue(customer);
      mockVehicleRepo.count.mockResolvedValue(2);

      await expect(service.delete('tenant-1', 'c1')).rejects.toThrow(
        ConflictException,
      );
    });

    it('should delete customer when no vehicles', async () => {
      const customer = { id: 'c1' };
      mockCustomerRepo.findOne.mockResolvedValue(customer);
      mockVehicleRepo.count.mockResolvedValue(0);
      mockCustomerRepo.save = jest.fn(); // usado em remove pattern
      // TypeORM remove via repository
      const mockRemove = jest.fn().mockResolvedValue(undefined);
      mockCustomerRepo.remove = mockRemove;

      await service.delete('tenant-1', 'c1');

      expect(mockRemove).toHaveBeenCalledWith(customer);
    });
  });
});
```

**Step 3: Rodar para confirmar que FALHA**

```bash
cd apps/backend
pnpm test -- --testPathPattern=customers.service.spec
```

Expected: FAIL — `Cannot find module './customers.service'`

**Step 4: Criar `apps/backend/src/modules/workshop/customers/customers.service.ts`**

```typescript
import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { CustomerEntity } from './customer.entity';
import { VehicleEntity } from '../vehicles/vehicle.entity';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

@Injectable()
export class CustomersService {
  constructor(private readonly dataSource: DataSource) {}

  private getSchemaName(tenantId: string): string {
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

  async list(tenantId: string, page: number, limit: number, search?: string) {
    return this.withSchema(tenantId, async (manager) => {
      const repo = manager.getRepository(CustomerEntity);
      const qb = repo.createQueryBuilder('c');
      if (search) {
        qb.where('c.nome ILIKE :s OR c.cpf_cnpj ILIKE :s', {
          s: `%${search}%`,
        });
      }
      const [data, total] = await qb
        .skip((page - 1) * limit)
        .take(limit)
        .orderBy('c.nome', 'ASC')
        .getManyAndCount();
      return { data, total, page, limit };
    });
  }

  async getById(tenantId: string, id: string): Promise<CustomerEntity> {
    return this.withSchema(tenantId, async (manager) => {
      const repo = manager.getRepository(CustomerEntity);
      const customer = await repo.findOne({ where: { id } });
      if (!customer) throw new NotFoundException('Cliente não encontrado.');
      return customer;
    });
  }

  async create(tenantId: string, dto: CreateCustomerDto): Promise<CustomerEntity> {
    return this.withSchema(tenantId, async (manager) => {
      const repo = manager.getRepository(CustomerEntity);
      const customer = repo.create({
        nome: dto.nome,
        cpfCnpj: dto.cpfCnpj,
        whatsapp: dto.whatsapp ?? null,
        email: dto.email ?? null,
      });
      return repo.save(customer);
    });
  }

  async update(tenantId: string, id: string, dto: UpdateCustomerDto): Promise<CustomerEntity> {
    return this.withSchema(tenantId, async (manager) => {
      const repo = manager.getRepository(CustomerEntity);
      const customer = await repo.findOne({ where: { id } });
      if (!customer) throw new NotFoundException('Cliente não encontrado.');
      Object.assign(customer, {
        ...(dto.nome !== undefined && { nome: dto.nome }),
        ...(dto.cpfCnpj !== undefined && { cpfCnpj: dto.cpfCnpj }),
        ...(dto.whatsapp !== undefined && { whatsapp: dto.whatsapp }),
        ...(dto.email !== undefined && { email: dto.email }),
      });
      return repo.save(customer);
    });
  }

  async delete(tenantId: string, id: string): Promise<void> {
    return this.withSchema(tenantId, async (manager) => {
      const customerRepo = manager.getRepository(CustomerEntity);
      const vehicleRepo = manager.getRepository(VehicleEntity);

      const customer = await customerRepo.findOne({ where: { id } });
      if (!customer) throw new NotFoundException('Cliente não encontrado.');

      const vehicleCount = await vehicleRepo.count({
        where: { customerId: id },
      });
      if (vehicleCount > 0) {
        throw new ConflictException(
          'Não é possível excluir um cliente com veículos cadastrados.',
        );
      }

      await customerRepo.remove(customer);
    });
  }
}
```

**Step 5: Rodar para confirmar que PASSA**

```bash
pnpm test -- --testPathPattern=customers.service.spec
```

Expected: PASS

**Step 6: Criar `apps/backend/src/modules/workshop/customers/customers.controller.ts`**

```typescript
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
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { RolesGuard } from '../../core/auth/roles.guard';
import { Roles } from '../../core/auth/roles.decorator';
import { UserRole } from '../../core/auth/user.entity';
import { AuthUser } from '../../core/auth/jwt.strategy';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

interface RequestWithUser extends Request {
  user: AuthUser;
}

@Controller('workshop/customers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  list(
    @Request() req: RequestWithUser,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('search') search?: string,
  ) {
    return this.customersService.list(
      req.user.tenantId,
      Number(page),
      Number(limit),
      search,
    );
  }

  @Get(':id')
  getById(
    @Request() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.customersService.getById(req.user.tenantId, id);
  }

  @Post()
  create(@Request() req: RequestWithUser, @Body() dto: CreateCustomerDto) {
    return this.customersService.create(req.user.tenantId, dto);
  }

  @Patch(':id')
  update(
    @Request() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCustomerDto,
  ) {
    return this.customersService.update(req.user.tenantId, id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.OWNER)
  @HttpCode(204)
  delete(
    @Request() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.customersService.delete(req.user.tenantId, id);
  }
}
```

**Step 7: Criar `apps/backend/src/modules/workshop/customers/customers.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { CustomersController } from './customers.controller';

@Module({
  controllers: [CustomersController],
  providers: [CustomersService],
})
export class CustomersModule {}
```

**Step 8: Adicionar CustomersModule ao AppModule**

Em `apps/backend/src/app.module.ts`, adicionar:
```typescript
import { CustomersModule } from './modules/workshop/customers/customers.module';
// ... no array imports:
CustomersModule,
```

**Step 9: Rodar todos os testes**

```bash
pnpm test
```

Expected: PASS — todos os testes existentes + novos do customers.service.spec

**Step 10: Commit**

```bash
cd ../../
git add apps/backend/src/modules/workshop/customers/ apps/backend/src/app.module.ts
git commit -m "feat(backend): add CustomersModule with CRUD and pagination"
```

---

## Task 4: Vehicles Module — Service (TDD) + Controller + Module

**Files:**
- Create: `apps/backend/src/modules/workshop/vehicles/dto/create-vehicle.dto.ts`
- Create: `apps/backend/src/modules/workshop/vehicles/dto/update-vehicle.dto.ts`
- Create: `apps/backend/src/modules/workshop/vehicles/vehicles.service.spec.ts`
- Create: `apps/backend/src/modules/workshop/vehicles/vehicles.service.ts`
- Create: `apps/backend/src/modules/workshop/vehicles/vehicles.controller.ts`
- Create: `apps/backend/src/modules/workshop/vehicles/vehicles.module.ts`
- Modify: `apps/backend/src/app.module.ts`

**Step 1: Criar DTOs**

`apps/backend/src/modules/workshop/vehicles/dto/create-vehicle.dto.ts`:
```typescript
import { IsString, IsInt, IsUUID, Min, Max, Matches } from 'class-validator';

export class CreateVehicleDto {
  @IsUUID()
  customerId: string;

  @IsString()
  @Matches(/^[A-Z]{3}\d{4}$|^[A-Z]{3}\d[A-Z]\d{2}$/, {
    message: 'Placa inválida. Use formato ABC1234 (antigo) ou ABC1D23 (Mercosul)',
  })
  placa: string;

  @IsString()
  marca: string;

  @IsString()
  modelo: string;

  @IsInt()
  @Min(1900)
  @Max(2100)
  ano: number;

  @IsInt()
  @Min(0)
  km: number;
}
```

`apps/backend/src/modules/workshop/vehicles/dto/update-vehicle.dto.ts`:
```typescript
import { PartialType } from '@nestjs/mapped-types';
import { CreateVehicleDto } from './create-vehicle.dto';

export class UpdateVehicleDto extends PartialType(CreateVehicleDto) {}
```

**Step 2: Escrever testes do VehiclesService ANTES de implementar**

Criar `apps/backend/src/modules/workshop/vehicles/vehicles.service.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { VehiclesService } from './vehicles.service';
import { VehicleEntity } from './vehicle.entity';

const mockQb = {
  where: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  take: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  getManyAndCount: jest.fn(),
};

const mockVehicleRepo = {
  createQueryBuilder: jest.fn().mockReturnValue(mockQb),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  remove: jest.fn(),
};

const mockQueryRunner = {
  connect: jest.fn().mockResolvedValue(undefined),
  query: jest.fn().mockResolvedValue(undefined),
  manager: {
    getRepository: jest.fn().mockReturnValue(mockVehicleRepo),
  },
  release: jest.fn().mockResolvedValue(undefined),
};

const mockDataSource = {
  createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
};

describe('VehiclesService', () => {
  let service: VehiclesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VehiclesService,
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<VehiclesService>(VehiclesService);
    jest.clearAllMocks();
    mockQueryRunner.manager.getRepository.mockReturnValue(mockVehicleRepo);
    mockVehicleRepo.createQueryBuilder.mockReturnValue(mockQb);
    mockQb.where.mockReturnThis();
    mockQb.skip.mockReturnThis();
    mockQb.take.mockReturnThis();
    mockQb.orderBy.mockReturnThis();
  });

  describe('list', () => {
    it('should return paginated vehicles', async () => {
      const vehicles = [{ id: 'v1', placa: 'ABC1234' }];
      mockQb.getManyAndCount.mockResolvedValue([vehicles, 1]);

      const result = await service.list('tenant-1', 1, 20);

      expect(result).toEqual({ data: vehicles, total: 1, page: 1, limit: 20 });
    });
  });

  describe('getById', () => {
    it('should return vehicle when found', async () => {
      const vehicle = { id: 'v1', placa: 'ABC1234' };
      mockVehicleRepo.findOne.mockResolvedValue(vehicle);

      const result = await service.getById('tenant-1', 'v1');

      expect(result).toEqual(vehicle);
    });

    it('should throw NotFoundException when vehicle not found', async () => {
      mockVehicleRepo.findOne.mockResolvedValue(null);

      await expect(service.getById('tenant-1', 'v1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('should create and return vehicle', async () => {
      const dto = { customerId: 'c1', placa: 'ABC1234', marca: 'Ford', modelo: 'Ka', ano: 2020, km: 0 };
      const created = { id: 'v1', ...dto };
      mockVehicleRepo.create.mockReturnValue(created);
      mockVehicleRepo.save.mockResolvedValue(created);

      const result = await service.create('tenant-1', dto as any);

      expect(result).toEqual(created);
    });
  });

  describe('delete', () => {
    it('should delete vehicle when found', async () => {
      const vehicle = { id: 'v1' };
      mockVehicleRepo.findOne.mockResolvedValue(vehicle);
      mockVehicleRepo.remove.mockResolvedValue(undefined);

      await service.delete('tenant-1', 'v1');

      expect(mockVehicleRepo.remove).toHaveBeenCalledWith(vehicle);
    });
  });
});
```

**Step 3: Rodar para confirmar que FALHA**

```bash
pnpm test -- --testPathPattern=vehicles.service.spec
```

Expected: FAIL — `Cannot find module './vehicles.service'`

**Step 4: Criar `apps/backend/src/modules/workshop/vehicles/vehicles.service.ts`**

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { VehicleEntity } from './vehicle.entity';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';

@Injectable()
export class VehiclesService {
  constructor(private readonly dataSource: DataSource) {}

  private getSchemaName(tenantId: string): string {
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

  async list(tenantId: string, page: number, limit: number, search?: string) {
    return this.withSchema(tenantId, async (manager) => {
      const repo = manager.getRepository(VehicleEntity);
      const qb = repo.createQueryBuilder('v');
      if (search) {
        qb.where(
          'v.placa ILIKE :s OR v.marca ILIKE :s OR v.modelo ILIKE :s',
          { s: `%${search}%` },
        );
      }
      const [data, total] = await qb
        .skip((page - 1) * limit)
        .take(limit)
        .orderBy('v.placa', 'ASC')
        .getManyAndCount();
      return { data, total, page, limit };
    });
  }

  async getById(tenantId: string, id: string): Promise<VehicleEntity> {
    return this.withSchema(tenantId, async (manager) => {
      const repo = manager.getRepository(VehicleEntity);
      const vehicle = await repo.findOne({ where: { id } });
      if (!vehicle) throw new NotFoundException('Veículo não encontrado.');
      return vehicle;
    });
  }

  async create(tenantId: string, dto: CreateVehicleDto): Promise<VehicleEntity> {
    return this.withSchema(tenantId, async (manager) => {
      const repo = manager.getRepository(VehicleEntity);
      const vehicle = repo.create({
        customerId: dto.customerId,
        placa: dto.placa,
        marca: dto.marca,
        modelo: dto.modelo,
        ano: dto.ano,
        km: dto.km,
      });
      return repo.save(vehicle);
    });
  }

  async update(tenantId: string, id: string, dto: UpdateVehicleDto): Promise<VehicleEntity> {
    return this.withSchema(tenantId, async (manager) => {
      const repo = manager.getRepository(VehicleEntity);
      const vehicle = await repo.findOne({ where: { id } });
      if (!vehicle) throw new NotFoundException('Veículo não encontrado.');
      Object.assign(vehicle, {
        ...(dto.placa !== undefined && { placa: dto.placa }),
        ...(dto.marca !== undefined && { marca: dto.marca }),
        ...(dto.modelo !== undefined && { modelo: dto.modelo }),
        ...(dto.ano !== undefined && { ano: dto.ano }),
        ...(dto.km !== undefined && { km: dto.km }),
      });
      return repo.save(vehicle);
    });
  }

  async delete(tenantId: string, id: string): Promise<void> {
    return this.withSchema(tenantId, async (manager) => {
      const repo = manager.getRepository(VehicleEntity);
      const vehicle = await repo.findOne({ where: { id } });
      if (!vehicle) throw new NotFoundException('Veículo não encontrado.');
      await repo.remove(vehicle);
    });
  }
}
```

**Step 5: Rodar para confirmar que PASSA**

```bash
pnpm test -- --testPathPattern=vehicles.service.spec
```

Expected: PASS

**Step 6: Criar `apps/backend/src/modules/workshop/vehicles/vehicles.controller.ts`**

```typescript
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
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { RolesGuard } from '../../core/auth/roles.guard';
import { Roles } from '../../core/auth/roles.decorator';
import { UserRole } from '../../core/auth/user.entity';
import { AuthUser } from '../../core/auth/jwt.strategy';
import { VehiclesService } from './vehicles.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';

interface RequestWithUser extends Request {
  user: AuthUser;
}

@Controller('workshop/vehicles')
@UseGuards(JwtAuthGuard, RolesGuard)
export class VehiclesController {
  constructor(private readonly vehiclesService: VehiclesService) {}

  @Get()
  list(
    @Request() req: RequestWithUser,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('search') search?: string,
  ) {
    return this.vehiclesService.list(
      req.user.tenantId,
      Number(page),
      Number(limit),
      search,
    );
  }

  @Get(':id')
  getById(
    @Request() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.vehiclesService.getById(req.user.tenantId, id);
  }

  @Post()
  create(@Request() req: RequestWithUser, @Body() dto: CreateVehicleDto) {
    return this.vehiclesService.create(req.user.tenantId, dto);
  }

  @Patch(':id')
  update(
    @Request() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateVehicleDto,
  ) {
    return this.vehiclesService.update(req.user.tenantId, id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.OWNER)
  @HttpCode(204)
  delete(
    @Request() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.vehiclesService.delete(req.user.tenantId, id);
  }
}
```

**Step 7: Criar `apps/backend/src/modules/workshop/vehicles/vehicles.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { VehiclesService } from './vehicles.service';
import { VehiclesController } from './vehicles.controller';

@Module({
  controllers: [VehiclesController],
  providers: [VehiclesService],
})
export class VehiclesModule {}
```

**Step 8: Adicionar VehiclesModule ao AppModule**

Em `apps/backend/src/app.module.ts`, adicionar:
```typescript
import { VehiclesModule } from './modules/workshop/vehicles/vehicles.module';
// ... no array imports:
VehiclesModule,
```

**Step 9: Rodar todos os testes**

```bash
pnpm test
```

Expected: PASS — todos os testes

**Step 10: Commit**

```bash
cd ../../
git add apps/backend/src/modules/workshop/vehicles/ apps/backend/src/app.module.ts
git commit -m "feat(backend): add VehiclesModule with CRUD and pagination"
```

---

## Task 5: Frontend — Customers Service + Pages

**Files:**
- Create: `apps/frontend/src/services/customers.service.ts`
- Create: `apps/frontend/src/services/customers.service.test.ts`
- Create: `apps/frontend/src/pages/workshop/customers/CustomersPage.tsx`
- Create: `apps/frontend/src/pages/workshop/customers/CustomerFormPage.tsx`
- Create: `apps/frontend/src/pages/workshop/customers/CustomerDetailPage.tsx`

**Step 1: Criar `apps/frontend/src/services/customers.service.ts`**

```typescript
import { api } from './api';

export interface Customer {
  id: string;
  nome: string;
  cpfCnpj: string;
  whatsapp: string | null;
  email: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface CreateCustomerPayload {
  nome: string;
  cpfCnpj: string;
  whatsapp?: string;
  email?: string;
}

export const customersService = {
  async list(params?: {
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<PaginatedResponse<Customer>> {
    const { data } = await api.get<PaginatedResponse<Customer>>(
      '/workshop/customers',
      { params },
    );
    return data;
  },

  async getById(id: string): Promise<Customer> {
    const { data } = await api.get<Customer>(`/workshop/customers/${id}`);
    return data;
  },

  async create(payload: CreateCustomerPayload): Promise<Customer> {
    const { data } = await api.post<Customer>('/workshop/customers', payload);
    return data;
  },

  async update(id: string, payload: Partial<CreateCustomerPayload>): Promise<Customer> {
    const { data } = await api.patch<Customer>(`/workshop/customers/${id}`, payload);
    return data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/workshop/customers/${id}`);
  },
};
```

**Step 2: Criar `apps/frontend/src/services/customers.service.test.ts`**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./api', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

import { customersService } from './customers.service';
import { api } from './api';
const mockApi = api as any;

describe('customersService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should call GET /workshop/customers on list', async () => {
    mockApi.get.mockResolvedValue({ data: { data: [], total: 0, page: 1, limit: 20 } });
    const result = await customersService.list({ page: 1, limit: 20 });
    expect(mockApi.get).toHaveBeenCalledWith('/workshop/customers', expect.any(Object));
    expect(result.data).toEqual([]);
  });

  it('should call POST /workshop/customers on create', async () => {
    const payload = { nome: 'João', cpfCnpj: '12345678901' };
    mockApi.post.mockResolvedValue({ data: { id: 'c1', ...payload } });
    const result = await customersService.create(payload);
    expect(mockApi.post).toHaveBeenCalledWith('/workshop/customers', payload);
    expect(result.id).toBe('c1');
  });

  it('should call DELETE /workshop/customers/:id on delete', async () => {
    mockApi.delete.mockResolvedValue({});
    await customersService.delete('c1');
    expect(mockApi.delete).toHaveBeenCalledWith('/workshop/customers/c1');
  });
});
```

**Step 3: Rodar para confirmar que PASSA**

```bash
cd apps/frontend
pnpm test -- customers.service
```

Expected: PASS

**Step 4: Criar `apps/frontend/src/pages/workshop/customers/CustomersPage.tsx`**

```tsx
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Button, IconButton, Paper, Table, TableBody, TableCell,
  TableContainer, TableHead, TablePagination, TableRow,
  TextField, Typography, CircularProgress, Alert,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import VisibilityIcon from '@mui/icons-material/Visibility';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { customersService, type Customer } from '../../../services/customers.service';

export function CustomersPage() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await customersService.list({
        page: page + 1,
        limit: rowsPerPage,
        search: search || undefined,
      });
      setCustomers(result.data);
      setTotal(result.total);
    } catch {
      setError('Erro ao carregar clientes.');
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, search]);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja excluir este cliente?')) return;
    try {
      await customersService.delete(id);
      loadCustomers();
    } catch (err: any) {
      alert(err?.response?.data?.message ?? 'Erro ao excluir cliente.');
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h5" fontWeight="bold">Clientes</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate('/workshop/customers/new')}
        >
          Novo Cliente
        </Button>
      </Box>

      <TextField
        label="Buscar por nome ou CPF/CNPJ"
        value={search}
        onChange={(e) => { setSearch(e.target.value); setPage(0); }}
        sx={{ mb: 2, width: 360 }}
        size="small"
      />

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Nome</TableCell>
              <TableCell>CPF/CNPJ</TableCell>
              <TableCell>WhatsApp</TableCell>
              <TableCell align="right">Ações</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4} align="center">
                  <CircularProgress size={24} />
                </TableCell>
              </TableRow>
            ) : customers.map((c) => (
              <TableRow key={c.id}>
                <TableCell>{c.nome}</TableCell>
                <TableCell>{c.cpfCnpj}</TableCell>
                <TableCell>{c.whatsapp ?? '—'}</TableCell>
                <TableCell align="right">
                  <IconButton size="small" onClick={() => navigate(`/workshop/customers/${c.id}`)}>
                    <VisibilityIcon fontSize="small" />
                  </IconButton>
                  <IconButton size="small" onClick={() => navigate(`/workshop/customers/${c.id}/edit`)}>
                    <EditIcon fontSize="small" />
                  </IconButton>
                  <IconButton size="small" color="error" onClick={() => handleDelete(c.id)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <TablePagination
          component="div"
          count={total}
          page={page}
          rowsPerPage={rowsPerPage}
          onPageChange={(_, p) => setPage(p)}
          onRowsPerPageChange={(e) => { setRowsPerPage(Number(e.target.value)); setPage(0); }}
          rowsPerPageOptions={[10, 20, 50]}
          labelRowsPerPage="Por página:"
        />
      </TableContainer>
    </Box>
  );
}
```

**Step 5: Criar `apps/frontend/src/pages/workshop/customers/CustomerFormPage.tsx`**

```tsx
import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Box, Button, Card, CardContent, TextField, Typography, Alert, CircularProgress,
} from '@mui/material';
import { customersService } from '../../../services/customers.service';

const schema = z.object({
  nome: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres'),
  cpfCnpj: z
    .string()
    .regex(/^\d{11}$|^\d{14}$/, 'CPF deve ter 11 dígitos ou CNPJ 14 dígitos'),
  whatsapp: z.string().optional(),
  email: z.string().email('E-mail inválido').optional().or(z.literal('')),
});

type FormData = z.infer<typeof schema>;

export function CustomerFormPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (isEdit && id) {
      customersService.getById(id).then((customer) => {
        reset({
          nome: customer.nome,
          cpfCnpj: customer.cpfCnpj,
          whatsapp: customer.whatsapp ?? '',
          email: customer.email ?? '',
        });
      });
    }
  }, [id, isEdit, reset]);

  const onSubmit = async (data: FormData) => {
    const payload = {
      nome: data.nome,
      cpfCnpj: data.cpfCnpj,
      whatsapp: data.whatsapp || undefined,
      email: data.email || undefined,
    };
    try {
      if (isEdit && id) {
        await customersService.update(id, payload);
      } else {
        await customersService.create(payload);
      }
      navigate('/workshop/customers');
    } catch (err: any) {
      setError('root', {
        message: err?.response?.data?.message ?? 'Erro ao salvar cliente.',
      });
    }
  };

  return (
    <Box sx={{ maxWidth: 560 }}>
      <Typography variant="h5" fontWeight="bold" mb={3}>
        {isEdit ? 'Editar Cliente' : 'Novo Cliente'}
      </Typography>
      <Card>
        <CardContent sx={{ p: 3 }}>
          {errors.root && (
            <Alert severity="error" sx={{ mb: 2 }}>{errors.root.message}</Alert>
          )}
          <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
            <TextField
              label="Nome"
              fullWidth
              margin="normal"
              {...register('nome')}
              error={!!errors.nome}
              helperText={errors.nome?.message}
            />
            <TextField
              label="CPF / CNPJ (somente números)"
              fullWidth
              margin="normal"
              inputProps={{ maxLength: 14 }}
              {...register('cpfCnpj')}
              error={!!errors.cpfCnpj}
              helperText={errors.cpfCnpj?.message}
            />
            <TextField
              label="WhatsApp (opcional)"
              fullWidth
              margin="normal"
              {...register('whatsapp')}
            />
            <TextField
              label="E-mail (opcional)"
              type="email"
              fullWidth
              margin="normal"
              {...register('email')}
              error={!!errors.email}
              helperText={errors.email?.message}
            />
            <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
              <Button variant="outlined" fullWidth onClick={() => navigate('/workshop/customers')}>
                Cancelar
              </Button>
              <Button type="submit" variant="contained" fullWidth disabled={isSubmitting}>
                {isSubmitting ? <CircularProgress size={22} /> : 'Salvar'}
              </Button>
            </Box>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
```

**Step 6: Criar `apps/frontend/src/pages/workshop/customers/CustomerDetailPage.tsx`**

```tsx
import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box, Button, Card, CardContent, Chip, Divider, IconButton,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Typography, Paper, CircularProgress,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import AddIcon from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { customersService, type Customer } from '../../../services/customers.service';
import { vehiclesService, type Vehicle } from '../../../services/vehicles.service';

export function CustomerDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      customersService.getById(id),
      vehiclesService.list({ search: undefined }),
    ]).then(([c, v]) => {
      setCustomer(c);
      setVehicles(v.data.filter((veh) => veh.customerId === id));
    }).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}><CircularProgress /></Box>;
  if (!customer) return <Typography>Cliente não encontrado.</Typography>;

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
        <IconButton onClick={() => navigate('/workshop/customers')}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h5" fontWeight="bold">{customer.nome}</Typography>
        <Button
          startIcon={<EditIcon />}
          onClick={() => navigate(`/workshop/customers/${id}/edit`)}
          sx={{ ml: 'auto' }}
        >
          Editar
        </Button>
      </Box>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="subtitle2" color="text.secondary">CPF / CNPJ</Typography>
          <Typography mb={1}>{customer.cpfCnpj}</Typography>
          <Divider sx={{ my: 1 }} />
          <Typography variant="subtitle2" color="text.secondary">WhatsApp</Typography>
          <Typography mb={1}>{customer.whatsapp ?? '—'}</Typography>
          <Divider sx={{ my: 1 }} />
          <Typography variant="subtitle2" color="text.secondary">E-mail</Typography>
          <Typography>{customer.email ?? '—'}</Typography>
        </CardContent>
      </Card>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">Veículos</Typography>
        <Button
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={() => navigate(`/workshop/vehicles/new?customerId=${id}`)}
        >
          Novo Veículo
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Placa</TableCell>
              <TableCell>Marca / Modelo</TableCell>
              <TableCell>Ano</TableCell>
              <TableCell>KM</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {vehicles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align="center">Nenhum veículo cadastrado.</TableCell>
              </TableRow>
            ) : vehicles.map((v) => (
              <TableRow key={v.id}>
                <TableCell><Chip label={v.placa} size="small" /></TableCell>
                <TableCell>{v.marca} {v.modelo}</TableCell>
                <TableCell>{v.ano}</TableCell>
                <TableCell>{v.km.toLocaleString()} km</TableCell>
                <TableCell>
                  <IconButton size="small" onClick={() => navigate(`/workshop/vehicles/${v.id}/edit`)}>
                    <EditIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
```

**Step 7: Commit**

```bash
cd ../../
git add apps/frontend/src/services/customers.service.ts
git add apps/frontend/src/services/customers.service.test.ts
git add apps/frontend/src/pages/workshop/customers/
git commit -m "feat(frontend): add CustomersPage, CustomerFormPage, CustomerDetailPage"
```

---

## Task 6: Frontend — Vehicles Service + Pages

**Files:**
- Create: `apps/frontend/src/services/vehicles.service.ts`
- Create: `apps/frontend/src/services/vehicles.service.test.ts`
- Create: `apps/frontend/src/pages/workshop/vehicles/VehiclesPage.tsx`
- Create: `apps/frontend/src/pages/workshop/vehicles/VehicleFormPage.tsx`

**Step 1: Criar `apps/frontend/src/services/vehicles.service.ts`**

```typescript
import { api } from './api';
import { type PaginatedResponse } from './customers.service';

export interface Vehicle {
  id: string;
  customerId: string;
  placa: string;
  marca: string;
  modelo: string;
  ano: number;
  km: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateVehiclePayload {
  customerId: string;
  placa: string;
  marca: string;
  modelo: string;
  ano: number;
  km: number;
}

export const vehiclesService = {
  async list(params?: {
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<PaginatedResponse<Vehicle>> {
    const { data } = await api.get<PaginatedResponse<Vehicle>>(
      '/workshop/vehicles',
      { params },
    );
    return data;
  },

  async getById(id: string): Promise<Vehicle> {
    const { data } = await api.get<Vehicle>(`/workshop/vehicles/${id}`);
    return data;
  },

  async create(payload: CreateVehiclePayload): Promise<Vehicle> {
    const { data } = await api.post<Vehicle>('/workshop/vehicles', payload);
    return data;
  },

  async update(id: string, payload: Partial<CreateVehiclePayload>): Promise<Vehicle> {
    const { data } = await api.patch<Vehicle>(`/workshop/vehicles/${id}`, payload);
    return data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/workshop/vehicles/${id}`);
  },
};
```

**Step 2: Criar `apps/frontend/src/services/vehicles.service.test.ts`**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./api', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

import { vehiclesService } from './vehicles.service';
import { api } from './api';
const mockApi = api as any;

describe('vehiclesService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should call GET /workshop/vehicles on list', async () => {
    mockApi.get.mockResolvedValue({ data: { data: [], total: 0, page: 1, limit: 20 } });
    const result = await vehiclesService.list({ page: 1 });
    expect(mockApi.get).toHaveBeenCalledWith('/workshop/vehicles', expect.any(Object));
    expect(result.data).toEqual([]);
  });

  it('should call POST /workshop/vehicles on create', async () => {
    const payload = { customerId: 'c1', placa: 'ABC1234', marca: 'Ford', modelo: 'Ka', ano: 2020, km: 0 };
    mockApi.post.mockResolvedValue({ data: { id: 'v1', ...payload } });
    const result = await vehiclesService.create(payload);
    expect(mockApi.post).toHaveBeenCalledWith('/workshop/vehicles', payload);
    expect(result.id).toBe('v1');
  });
});
```

**Step 3: Criar `apps/frontend/src/pages/workshop/vehicles/VehiclesPage.tsx`**

```tsx
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Button, Chip, IconButton, Paper, Table, TableBody, TableCell,
  TableContainer, TableHead, TablePagination, TableRow,
  TextField, Typography, CircularProgress, Alert,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { vehiclesService, type Vehicle } from '../../../services/vehicles.service';

export function VehiclesPage() {
  const navigate = useNavigate();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadVehicles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await vehiclesService.list({
        page: page + 1,
        limit: rowsPerPage,
        search: search || undefined,
      });
      setVehicles(result.data);
      setTotal(result.total);
    } catch {
      setError('Erro ao carregar veículos.');
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, search]);

  useEffect(() => { loadVehicles(); }, [loadVehicles]);

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja excluir este veículo?')) return;
    try {
      await vehiclesService.delete(id);
      loadVehicles();
    } catch (err: any) {
      alert(err?.response?.data?.message ?? 'Erro ao excluir.');
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h5" fontWeight="bold">Veículos</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate('/workshop/vehicles/new')}
        >
          Novo Veículo
        </Button>
      </Box>

      <TextField
        label="Buscar por placa, marca ou modelo"
        value={search}
        onChange={(e) => { setSearch(e.target.value); setPage(0); }}
        sx={{ mb: 2, width: 360 }}
        size="small"
      />

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Placa</TableCell>
              <TableCell>Marca</TableCell>
              <TableCell>Modelo</TableCell>
              <TableCell>Ano</TableCell>
              <TableCell>KM</TableCell>
              <TableCell align="right">Ações</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} align="center"><CircularProgress size={24} /></TableCell>
              </TableRow>
            ) : vehicles.map((v) => (
              <TableRow key={v.id}>
                <TableCell><Chip label={v.placa} size="small" /></TableCell>
                <TableCell>{v.marca}</TableCell>
                <TableCell>{v.modelo}</TableCell>
                <TableCell>{v.ano}</TableCell>
                <TableCell>{v.km.toLocaleString()} km</TableCell>
                <TableCell align="right">
                  <IconButton size="small" onClick={() => navigate(`/workshop/vehicles/${v.id}/edit`)}>
                    <EditIcon fontSize="small" />
                  </IconButton>
                  <IconButton size="small" color="error" onClick={() => handleDelete(v.id)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <TablePagination
          component="div"
          count={total}
          page={page}
          rowsPerPage={rowsPerPage}
          onPageChange={(_, p) => setPage(p)}
          onRowsPerPageChange={(e) => { setRowsPerPage(Number(e.target.value)); setPage(0); }}
          rowsPerPageOptions={[10, 20, 50]}
          labelRowsPerPage="Por página:"
        />
      </TableContainer>
    </Box>
  );
}
```

**Step 4: Criar `apps/frontend/src/pages/workshop/vehicles/VehicleFormPage.tsx`**

```tsx
import { useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Box, Button, Card, CardContent, TextField, Typography, Alert, CircularProgress,
} from '@mui/material';
import { vehiclesService } from '../../../services/vehicles.service';

const currentYear = new Date().getFullYear();

const schema = z.object({
  customerId: z.string().uuid('ID do cliente inválido'),
  placa: z
    .string()
    .regex(/^[A-Z]{3}\d{4}$|^[A-Z]{3}\d[A-Z]\d{2}$/, 'Placa inválida (ex: ABC1234 ou ABC1D23)'),
  marca: z.string().min(1, 'Marca obrigatória'),
  modelo: z.string().min(1, 'Modelo obrigatório'),
  ano: z.coerce
    .number()
    .int()
    .min(1900, 'Ano inválido')
    .max(currentYear + 1, `Ano máximo: ${currentYear + 1}`),
  km: z.coerce.number().int().min(0, 'KM não pode ser negativo'),
});

type FormData = z.infer<typeof schema>;

export function VehicleFormPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const isEdit = Boolean(id);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  useEffect(() => {
    const prefilledCustomerId = searchParams.get('customerId');
    if (isEdit && id) {
      vehiclesService.getById(id).then((v) => {
        reset({ customerId: v.customerId, placa: v.placa, marca: v.marca, modelo: v.modelo, ano: v.ano, km: v.km });
      });
    } else if (prefilledCustomerId) {
      reset({ customerId: prefilledCustomerId, placa: '', marca: '', modelo: '', ano: currentYear, km: 0 });
    }
  }, [id, isEdit, reset, searchParams]);

  const onSubmit = async (data: FormData) => {
    try {
      if (isEdit && id) {
        await vehiclesService.update(id, data);
      } else {
        await vehiclesService.create(data);
      }
      navigate(-1);
    } catch (err: any) {
      setError('root', {
        message: err?.response?.data?.message ?? 'Erro ao salvar veículo.',
      });
    }
  };

  return (
    <Box sx={{ maxWidth: 560 }}>
      <Typography variant="h5" fontWeight="bold" mb={3}>
        {isEdit ? 'Editar Veículo' : 'Novo Veículo'}
      </Typography>
      <Card>
        <CardContent sx={{ p: 3 }}>
          {errors.root && (
            <Alert severity="error" sx={{ mb: 2 }}>{errors.root.message}</Alert>
          )}
          <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
            <TextField
              label="ID do Cliente"
              fullWidth
              margin="normal"
              {...register('customerId')}
              error={!!errors.customerId}
              helperText={errors.customerId?.message}
            />
            <TextField
              label="Placa (ex: ABC1234)"
              fullWidth
              margin="normal"
              inputProps={{ style: { textTransform: 'uppercase' }, maxLength: 7 }}
              {...register('placa')}
              error={!!errors.placa}
              helperText={errors.placa?.message}
            />
            <TextField
              label="Marca"
              fullWidth
              margin="normal"
              {...register('marca')}
              error={!!errors.marca}
              helperText={errors.marca?.message}
            />
            <TextField
              label="Modelo"
              fullWidth
              margin="normal"
              {...register('modelo')}
              error={!!errors.modelo}
              helperText={errors.modelo?.message}
            />
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                label="Ano"
                type="number"
                fullWidth
                margin="normal"
                {...register('ano')}
                error={!!errors.ano}
                helperText={errors.ano?.message}
              />
              <TextField
                label="KM"
                type="number"
                fullWidth
                margin="normal"
                {...register('km')}
                error={!!errors.km}
                helperText={errors.km?.message}
              />
            </Box>
            <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
              <Button variant="outlined" fullWidth onClick={() => navigate(-1)}>
                Cancelar
              </Button>
              <Button type="submit" variant="contained" fullWidth disabled={isSubmitting}>
                {isSubmitting ? <CircularProgress size={22} /> : 'Salvar'}
              </Button>
            </Box>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
```

**Step 5: Rodar testes do frontend**

```bash
cd apps/frontend
pnpm test
```

Expected: PASS — todos os testes existentes + novos do vehicles.service.test.ts e customers.service.test.ts

**Step 6: Commit**

```bash
cd ../../
git add apps/frontend/src/services/vehicles.service.ts
git add apps/frontend/src/services/vehicles.service.test.ts
git add apps/frontend/src/pages/workshop/vehicles/
git commit -m "feat(frontend): add VehiclesPage and VehicleFormPage"
```

---

## Task 7: Atualizar App.tsx + Validação Final

**Files:**
- Modify: `apps/frontend/src/App.tsx`

**Step 1: Atualizar `apps/frontend/src/App.tsx` com todas as novas rotas**

Adicionar imports:
```typescript
import { CustomersPage } from './pages/workshop/customers/CustomersPage';
import { CustomerFormPage } from './pages/workshop/customers/CustomerFormPage';
import { CustomerDetailPage } from './pages/workshop/customers/CustomerDetailPage';
import { VehiclesPage } from './pages/workshop/vehicles/VehiclesPage';
import { VehicleFormPage } from './pages/workshop/vehicles/VehicleFormPage';
```

Dentro do bloco `<Route path="/workshop" ...>`, adicionar após `<Route path="dashboard" ...>`:
```tsx
<Route path="customers" element={<CustomersPage />} />
<Route path="customers/new" element={<CustomerFormPage />} />
<Route path="customers/:id" element={<CustomerDetailPage />} />
<Route path="customers/:id/edit" element={<CustomerFormPage />} />
<Route path="vehicles" element={<VehiclesPage />} />
<Route path="vehicles/new" element={<VehicleFormPage />} />
<Route path="vehicles/:id/edit" element={<VehicleFormPage />} />
```

**Step 2: Rodar todos os testes**

```bash
cd c:/Users/vinic/OneDrive/Projetos/Praktikus/.worktrees/entrega-3
pnpm test
```

Expected: PASS — todos os testes (backend + frontend)

**Step 3: Subir com Docker e testar manualmente**

```bash
docker-compose up --build
```

Verificar:
- `POST /api/auth/register` → cria tenant com schema + tabelas `customers` e `vehicles`
- `GET /api/workshop/customers` (com Bearer token) → retorna `{ data: [], total: 0, page: 1, limit: 20 }`
- `POST /api/workshop/customers` → cria cliente
- `GET /api/workshop/vehicles` → retorna lista vazia
- `POST /api/workshop/vehicles` → cria veículo vinculado ao cliente
- `DELETE /api/workshop/customers/:id` com veículos → retorna 409
- Frontend: `/workshop/customers` exibe tabela paginada com busca
- Frontend: `/workshop/customers/new` exibe formulário com validação
- Frontend: `/workshop/vehicles` exibe tabela de veículos

**Step 4: Commit final**

```bash
git add apps/frontend/src/App.tsx
git commit -m "chore: entrega 3 completa — CRUD clientes e veículos com paginação"
```

---

## Checklist de Validação da Entrega 3

- [ ] `docker-compose up --build` sobe sem erros
- [ ] Novo tenant tem tabelas `customers` e `vehicles` criadas automaticamente
- [ ] `POST /api/workshop/customers` cria cliente com CPF ou CNPJ
- [ ] `GET /api/workshop/customers?search=joao` filtra por nome/CPF_CNPJ
- [ ] `DELETE /api/workshop/customers/:id` retorna 409 se tiver veículos
- [ ] `POST /api/workshop/vehicles` cria veículo vinculado a cliente
- [ ] `GET /api/workshop/vehicles?search=ford` filtra por placa/marca/modelo
- [ ] Frontend: `/workshop/customers` exibe tabela paginada + busca
- [ ] Frontend: formulário valida CPF (11 dígitos) e CNPJ (14 dígitos)
- [ ] Frontend: formulário de veículo valida placa no formato correto
- [ ] Frontend: detalhe do cliente exibe veículos vinculados
- [ ] Todos os testes passam com `pnpm test`
