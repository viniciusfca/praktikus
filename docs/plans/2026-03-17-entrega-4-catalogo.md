# Entrega 4: Catálogo (Serviços e Peças) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implementar CRUD de serviços e peças no catálogo da oficina, seguindo o padrão já estabelecido de customers/vehicles.

**Architecture:** CatalogModule único em `workshop/catalog/` com dois controllers (`/catalog/services` e `/catalog/parts`), dois services, duas entidades TypeORM. Frontend: uma página `/workshop/catalog` com abas MUI (Serviços / Peças), formulários em modal Dialog.

**Tech Stack:** NestJS + TypeORM + PostgreSQL (tenant schema) + React + MUI + react-hook-form + zod + axios

---

## Contexto do Projeto

- Monorepo pnpm: `apps/backend/` e `apps/frontend/`
- Backend tests: `npx jest --no-coverage` em `apps/backend/`
- Frontend tests: `npx vitest run` em `apps/frontend/`
- Tenant UUID de teste nos specs: `'00000000-0000-0000-0000-000000000001'`
- Padrão `withSchema<T>`: QueryRunner + `SET search_path TO "${schemaName}", public`
- `getSchemaName` valida UUID antes de usar

---

## Task 1: Adicionar tabelas ao tenant migration

**Files:**
- Modify: `apps/backend/src/database/tenant-migrations/create-tenant-tables.ts`
- Modify: `apps/backend/src/modules/core/tenancy/tenancy.service.spec.ts`

### Step 1: Atualizar `create-tenant-tables.ts`

Adicionar as duas tabelas ao array retornado pela função `createTenantTablesSql`. O arquivo atual retorna customers (índice 0) e vehicles (índice 1). Adicionar catalog_services (índice 2) e catalog_parts (índice 3):

```typescript
// apps/backend/src/database/tenant-migrations/create-tenant-tables.ts
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
    `CREATE TABLE IF NOT EXISTS "${schemaName}".catalog_services (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      nome VARCHAR NOT NULL,
      descricao VARCHAR,
      preco_padrao NUMERIC(10,2) NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS "${schemaName}".catalog_parts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      nome VARCHAR NOT NULL,
      codigo VARCHAR,
      preco_unitario NUMERIC(10,2) NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,
  ];
}
```

### Step 2: Atualizar tenancy.service.spec.ts

O teste atual verifica `toHaveBeenNthCalledWith(2, ...)` para customers e `(3, ...)` para vehicles. Adicionar asserções para `(4, ...)` e `(5, ...)` das novas tabelas. Abrir o arquivo `apps/backend/src/modules/core/tenancy/tenancy.service.spec.ts`, localizar o bloco `describe('provisionSchema')` e adicionar ao teste existente:

```typescript
// Adicionar DENTRO do teste já existente, após as verificações de vehicles:
expect(mockQueryRunner.query).toHaveBeenNthCalledWith(
  4,
  expect.stringContaining('catalog_services'),
);
expect(mockQueryRunner.query).toHaveBeenNthCalledWith(
  5,
  expect.stringContaining('catalog_parts'),
);
```

### Step 3: Rodar os testes para verificar que falham

```bash
cd apps/backend
npx jest tenancy.service.spec --no-coverage
```

Expected: FAIL — as asserções (4) e (5) falharão pois o migration ainda não inclui as novas tabelas... espere, na verdade o arquivo de migration JÁ foi atualizado no Step 1, então os testes devem passar após o Step 1. Execute assim:

```bash
cd apps/backend
npx jest tenancy.service.spec --no-coverage
```

Expected: PASS

### Step 4: Rodar todos os testes

```bash
cd apps/backend
npx jest --no-coverage
```

Expected: todos passando (≥59 tests)

### Step 5: Commit

```bash
git add apps/backend/src/database/tenant-migrations/create-tenant-tables.ts \
        apps/backend/src/modules/core/tenancy/tenancy.service.spec.ts
git commit -m "feat(catalog): add catalog_services and catalog_parts to tenant migration"
```

---

## Task 2: Entidades TypeORM + DatabaseModule

**Files:**
- Create: `apps/backend/src/modules/workshop/catalog/catalog-service.entity.ts`
- Create: `apps/backend/src/modules/workshop/catalog/catalog-part.entity.ts`
- Modify: `apps/backend/src/database/database.module.ts`

### Step 1: Criar CatalogServiceEntity

```typescript
// apps/backend/src/modules/workshop/catalog/catalog-service.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

const numericTransformer = {
  to: (v: number) => v,
  from: (v: string) => parseFloat(v),
};

@Entity({ name: 'catalog_services' })
export class CatalogServiceEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  nome: string;

  @Column({ nullable: true })
  descricao: string | null;

  @Column({
    name: 'preco_padrao',
    type: 'numeric',
    precision: 10,
    scale: 2,
    default: 0,
    transformer: numericTransformer,
  })
  precoPadrao: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
```

### Step 2: Criar CatalogPartEntity

```typescript
// apps/backend/src/modules/workshop/catalog/catalog-part.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

const numericTransformer = {
  to: (v: number) => v,
  from: (v: string) => parseFloat(v),
};

@Entity({ name: 'catalog_parts' })
export class CatalogPartEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  nome: string;

  @Column({ nullable: true })
  codigo: string | null;

  @Column({
    name: 'preco_unitario',
    type: 'numeric',
    precision: 10,
    scale: 2,
    default: 0,
    transformer: numericTransformer,
  })
  precoUnitario: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
```

### Step 3: Registrar entidades no DatabaseModule

Abrir `apps/backend/src/database/database.module.ts` e adicionar os imports e as entidades no array:

```typescript
import { CatalogServiceEntity } from '../modules/workshop/catalog/catalog-service.entity';
import { CatalogPartEntity } from '../modules/workshop/catalog/catalog-part.entity';
```

No array `entities`:
```typescript
entities: [TenantEntity, UserEntity, RefreshTokenEntity, BillingEntity, CustomerEntity, VehicleEntity, CatalogServiceEntity, CatalogPartEntity],
```

### Step 4: Rodar todos os testes (verificar que não quebrou nada)

```bash
cd apps/backend
npx jest --no-coverage
```

Expected: PASS (≥59 tests)

### Step 5: Commit

```bash
git add apps/backend/src/modules/workshop/catalog/catalog-service.entity.ts \
        apps/backend/src/modules/workshop/catalog/catalog-part.entity.ts \
        apps/backend/src/database/database.module.ts
git commit -m "feat(catalog): add CatalogServiceEntity and CatalogPartEntity"
```

---

## Task 3: CatalogServices Backend (DTOs + Service TDD + Controller + Module)

**Files:**
- Create: `apps/backend/src/modules/workshop/catalog/dto/create-catalog-service.dto.ts`
- Create: `apps/backend/src/modules/workshop/catalog/dto/update-catalog-service.dto.ts`
- Create: `apps/backend/src/modules/workshop/catalog/catalog-services.service.spec.ts`
- Create: `apps/backend/src/modules/workshop/catalog/catalog-services.service.ts`
- Create: `apps/backend/src/modules/workshop/catalog/catalog-services.controller.ts`
- Create: `apps/backend/src/modules/workshop/catalog/catalog.module.ts`
- Modify: `apps/backend/src/app.module.ts`

### Step 1: Criar DTOs

```typescript
// apps/backend/src/modules/workshop/catalog/dto/create-catalog-service.dto.ts
import { IsString, IsOptional, IsNumber, Min, MinLength } from 'class-validator';

export class CreateCatalogServiceDto {
  @IsString()
  @MinLength(2)
  nome: string;

  @IsOptional()
  @IsString()
  descricao?: string;

  @IsNumber()
  @Min(0)
  precoPadrao: number;
}
```

```typescript
// apps/backend/src/modules/workshop/catalog/dto/update-catalog-service.dto.ts
import { PartialType } from '@nestjs/mapped-types';
import { CreateCatalogServiceDto } from './create-catalog-service.dto';

export class UpdateCatalogServiceDto extends PartialType(CreateCatalogServiceDto) {}
```

### Step 2: Escrever o teste (TDD — escreva ANTES do service)

```typescript
// apps/backend/src/modules/workshop/catalog/catalog-services.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CatalogServicesService } from './catalog-services.service';
import { CatalogServiceEntity } from './catalog-service.entity';

const TENANT_ID = '00000000-0000-0000-0000-000000000001';

const mockQb = {
  where: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  take: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  getManyAndCount: jest.fn(),
};

const mockRepo = {
  createQueryBuilder: jest.fn().mockReturnValue(mockQb),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  remove: jest.fn(),
};

const mockQueryRunner = {
  connect: jest.fn().mockResolvedValue(undefined),
  query: jest.fn().mockResolvedValue(undefined),
  manager: { getRepository: jest.fn().mockReturnValue(mockRepo) },
  release: jest.fn().mockResolvedValue(undefined),
};

const mockDataSource = {
  createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
};

describe('CatalogServicesService', () => {
  let service: CatalogServicesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CatalogServicesService,
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();
    service = module.get<CatalogServicesService>(CatalogServicesService);
    jest.clearAllMocks();
    mockQueryRunner.manager.getRepository.mockReturnValue(mockRepo);
    mockRepo.createQueryBuilder.mockReturnValue(mockQb);
    mockQb.where.mockReturnThis();
    mockQb.skip.mockReturnThis();
    mockQb.take.mockReturnThis();
    mockQb.orderBy.mockReturnThis();
  });

  describe('list', () => {
    it('should return paginated services and set search_path', async () => {
      const items = [{ id: 's1', nome: 'Troca de óleo' }];
      mockQb.getManyAndCount.mockResolvedValue([items, 1]);

      const result = await service.list(TENANT_ID, 1, 20);

      expect(result).toEqual({ data: items, total: 1, page: 1, limit: 20 });
      expect(mockQueryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining('SET search_path'),
      );
    });

    it('should apply search filter when provided', async () => {
      mockQb.getManyAndCount.mockResolvedValue([[], 0]);

      await service.list(TENANT_ID, 1, 20, 'oleo');

      expect(mockQb.where).toHaveBeenCalledWith(
        expect.stringContaining('ILIKE'),
        expect.any(Object),
      );
    });
  });

  describe('getById', () => {
    it('should return service when found', async () => {
      const item = { id: 's1', nome: 'Troca de óleo' };
      mockRepo.findOne.mockResolvedValue(item);

      const result = await service.getById(TENANT_ID, 's1');

      expect(result).toEqual(item);
    });

    it('should throw NotFoundException when not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.getById(TENANT_ID, 'nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create and return service', async () => {
      const dto = { nome: 'Troca de óleo', precoPadrao: 80 };
      const created = { id: 's1', ...dto };
      mockRepo.create.mockReturnValue(created);
      mockRepo.save.mockResolvedValue(created);

      const result = await service.create(TENANT_ID, dto as any);

      expect(result).toEqual(created);
      expect(mockRepo.save).toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('should update and return service', async () => {
      const item = { id: 's1', nome: 'Troca de óleo', precoPadrao: 80 };
      mockRepo.findOne.mockResolvedValue(item);
      mockRepo.save.mockResolvedValue({ ...item, nome: 'Troca de filtro' });

      const result = await service.update(TENANT_ID, 's1', { nome: 'Troca de filtro' } as any);

      expect(mockRepo.save).toHaveBeenCalled();
      expect(result.nome).toBe('Troca de filtro');
    });

    it('should throw NotFoundException when not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.update(TENANT_ID, 'nonexistent', {} as any)).rejects.toThrow(NotFoundException);
    });
  });

  describe('delete', () => {
    it('should delete service when found', async () => {
      const item = { id: 's1' };
      mockRepo.findOne.mockResolvedValue(item);
      mockRepo.remove.mockResolvedValue(undefined);

      await service.delete(TENANT_ID, 's1');

      expect(mockRepo.remove).toHaveBeenCalledWith(item);
    });

    it('should throw NotFoundException when not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.delete(TENANT_ID, 'nonexistent')).rejects.toThrow(NotFoundException);
    });
  });
});
```

### Step 3: Rodar o teste para verificar que falha

```bash
cd apps/backend
npx jest catalog-services.service.spec --no-coverage
```

Expected: FAIL — `CatalogServicesService` não existe ainda.

### Step 4: Criar o service

```typescript
// apps/backend/src/modules/workshop/catalog/catalog-services.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { CatalogServiceEntity } from './catalog-service.entity';
import { CreateCatalogServiceDto } from './dto/create-catalog-service.dto';

@Injectable()
export class CatalogServicesService {
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

  async list(
    tenantId: string,
    page: number,
    limit: number,
    search?: string,
  ): Promise<{ data: CatalogServiceEntity[]; total: number; page: number; limit: number }> {
    return this.withSchema(tenantId, async (manager) => {
      const repo = manager.getRepository(CatalogServiceEntity);
      const qb = repo.createQueryBuilder('s');
      if (search) qb.where('s.nome ILIKE :s', { s: `%${search}%` });
      const [data, total] = await qb
        .skip((page - 1) * limit)
        .take(limit)
        .orderBy('s.nome', 'ASC')
        .getManyAndCount();
      return { data, total, page, limit };
    });
  }

  async getById(tenantId: string, id: string): Promise<CatalogServiceEntity> {
    return this.withSchema(tenantId, async (manager) => {
      const repo = manager.getRepository(CatalogServiceEntity);
      const item = await repo.findOne({ where: { id } });
      if (!item) throw new NotFoundException('Serviço não encontrado.');
      return item;
    });
  }

  async create(tenantId: string, dto: CreateCatalogServiceDto): Promise<CatalogServiceEntity> {
    return this.withSchema(tenantId, async (manager) => {
      const repo = manager.getRepository(CatalogServiceEntity);
      return repo.save(repo.create({
        nome: dto.nome,
        descricao: dto.descricao ?? null,
        precoPadrao: dto.precoPadrao,
      }));
    });
  }

  async update(
    tenantId: string,
    id: string,
    dto: Partial<CreateCatalogServiceDto>,
  ): Promise<CatalogServiceEntity> {
    return this.withSchema(tenantId, async (manager) => {
      const repo = manager.getRepository(CatalogServiceEntity);
      const item = await repo.findOne({ where: { id } });
      if (!item) throw new NotFoundException('Serviço não encontrado.');
      Object.assign(item, {
        ...(dto.nome !== undefined && { nome: dto.nome }),
        ...(dto.descricao !== undefined && { descricao: dto.descricao }),
        ...(dto.precoPadrao !== undefined && { precoPadrao: dto.precoPadrao }),
      });
      return repo.save(item);
    });
  }

  async delete(tenantId: string, id: string): Promise<void> {
    return this.withSchema(tenantId, async (manager) => {
      const repo = manager.getRepository(CatalogServiceEntity);
      const item = await repo.findOne({ where: { id } });
      if (!item) throw new NotFoundException('Serviço não encontrado.');
      await repo.remove(item);
    });
  }
}
```

### Step 5: Rodar o teste para verificar que passa

```bash
cd apps/backend
npx jest catalog-services.service.spec --no-coverage
```

Expected: PASS (6 tests)

### Step 6: Criar o controller

```typescript
// apps/backend/src/modules/workshop/catalog/catalog-services.controller.ts
import {
  Body, Controller, Delete, Get, HttpCode, Param,
  ParseUUIDPipe, Patch, Post, Query, Request, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { RolesGuard } from '../../core/auth/roles.guard';
import { Roles } from '../../core/auth/roles.decorator';
import { UserRole } from '../../core/auth/user.entity';
import { AuthUser } from '../../core/auth/jwt.strategy';
import { CatalogServicesService } from './catalog-services.service';
import { CreateCatalogServiceDto } from './dto/create-catalog-service.dto';
import { UpdateCatalogServiceDto } from './dto/update-catalog-service.dto';

interface RequestWithUser extends Request {
  user: AuthUser;
}

@Controller('workshop/catalog/services')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CatalogServicesController {
  constructor(private readonly catalogServicesService: CatalogServicesService) {}

  @Get()
  list(
    @Request() req: RequestWithUser,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('search') search?: string,
  ) {
    return this.catalogServicesService.list(req.user.tenantId, Number(page), Number(limit), search);
  }

  @Get(':id')
  getById(@Request() req: RequestWithUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.catalogServicesService.getById(req.user.tenantId, id);
  }

  @Post()
  create(@Request() req: RequestWithUser, @Body() dto: CreateCatalogServiceDto) {
    return this.catalogServicesService.create(req.user.tenantId, dto);
  }

  @Patch(':id')
  update(
    @Request() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCatalogServiceDto,
  ) {
    return this.catalogServicesService.update(req.user.tenantId, id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.OWNER)
  @HttpCode(204)
  delete(@Request() req: RequestWithUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.catalogServicesService.delete(req.user.tenantId, id);
  }
}
```

### Step 7: Criar CatalogModule e registrar em AppModule

```typescript
// apps/backend/src/modules/workshop/catalog/catalog.module.ts
import { Module } from '@nestjs/common';
import { CatalogServicesService } from './catalog-services.service';
import { CatalogServicesController } from './catalog-services.controller';

@Module({
  controllers: [CatalogServicesController],
  providers: [CatalogServicesService],
})
export class CatalogModule {}
```

Em `apps/backend/src/app.module.ts`, adicionar:
```typescript
import { CatalogModule } from './modules/workshop/catalog/catalog.module';
// ...
imports: [
  // ... existentes ...
  CatalogModule,
],
```

### Step 8: Rodar todos os testes

```bash
cd apps/backend
npx jest --no-coverage
```

Expected: PASS (≥65 tests)

### Step 9: Commit

```bash
git add apps/backend/src/modules/workshop/catalog/
git add apps/backend/src/app.module.ts
git commit -m "feat(catalog): add CatalogServices CRUD with TDD"
```

---

## Task 4: CatalogParts Backend (DTOs + Service TDD + Controller)

**Files:**
- Create: `apps/backend/src/modules/workshop/catalog/dto/create-catalog-part.dto.ts`
- Create: `apps/backend/src/modules/workshop/catalog/dto/update-catalog-part.dto.ts`
- Create: `apps/backend/src/modules/workshop/catalog/catalog-parts.service.spec.ts`
- Create: `apps/backend/src/modules/workshop/catalog/catalog-parts.service.ts`
- Create: `apps/backend/src/modules/workshop/catalog/catalog-parts.controller.ts`
- Modify: `apps/backend/src/modules/workshop/catalog/catalog.module.ts`

### Step 1: Criar DTOs

```typescript
// apps/backend/src/modules/workshop/catalog/dto/create-catalog-part.dto.ts
import { IsString, IsOptional, IsNumber, Min, MinLength } from 'class-validator';

export class CreateCatalogPartDto {
  @IsString()
  @MinLength(2)
  nome: string;

  @IsOptional()
  @IsString()
  codigo?: string;

  @IsNumber()
  @Min(0)
  precoUnitario: number;
}
```

```typescript
// apps/backend/src/modules/workshop/catalog/dto/update-catalog-part.dto.ts
import { PartialType } from '@nestjs/mapped-types';
import { CreateCatalogPartDto } from './create-catalog-part.dto';

export class UpdateCatalogPartDto extends PartialType(CreateCatalogPartDto) {}
```

### Step 2: Escrever o teste (TDD — escreva ANTES do service)

```typescript
// apps/backend/src/modules/workshop/catalog/catalog-parts.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CatalogPartsService } from './catalog-parts.service';
import { CatalogPartEntity } from './catalog-part.entity';

const TENANT_ID = '00000000-0000-0000-0000-000000000001';

const mockQb = {
  where: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  take: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  getManyAndCount: jest.fn(),
};

const mockRepo = {
  createQueryBuilder: jest.fn().mockReturnValue(mockQb),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  remove: jest.fn(),
};

const mockQueryRunner = {
  connect: jest.fn().mockResolvedValue(undefined),
  query: jest.fn().mockResolvedValue(undefined),
  manager: { getRepository: jest.fn().mockReturnValue(mockRepo) },
  release: jest.fn().mockResolvedValue(undefined),
};

const mockDataSource = {
  createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
};

describe('CatalogPartsService', () => {
  let service: CatalogPartsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CatalogPartsService,
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();
    service = module.get<CatalogPartsService>(CatalogPartsService);
    jest.clearAllMocks();
    mockQueryRunner.manager.getRepository.mockReturnValue(mockRepo);
    mockRepo.createQueryBuilder.mockReturnValue(mockQb);
    mockQb.where.mockReturnThis();
    mockQb.skip.mockReturnThis();
    mockQb.take.mockReturnThis();
    mockQb.orderBy.mockReturnThis();
  });

  describe('list', () => {
    it('should return paginated parts and set search_path', async () => {
      const items = [{ id: 'p1', nome: 'Filtro de óleo' }];
      mockQb.getManyAndCount.mockResolvedValue([items, 1]);

      const result = await service.list(TENANT_ID, 1, 20);

      expect(result).toEqual({ data: items, total: 1, page: 1, limit: 20 });
      expect(mockQueryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining('SET search_path'),
      );
    });

    it('should apply search filter on nome and codigo', async () => {
      mockQb.getManyAndCount.mockResolvedValue([[], 0]);

      await service.list(TENANT_ID, 1, 20, 'filtro');

      expect(mockQb.where).toHaveBeenCalledWith(
        expect.stringContaining('ILIKE'),
        expect.any(Object),
      );
    });
  });

  describe('getById', () => {
    it('should return part when found', async () => {
      const item = { id: 'p1', nome: 'Filtro de óleo' };
      mockRepo.findOne.mockResolvedValue(item);

      const result = await service.getById(TENANT_ID, 'p1');

      expect(result).toEqual(item);
    });

    it('should throw NotFoundException when not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.getById(TENANT_ID, 'nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create and return part', async () => {
      const dto = { nome: 'Filtro de óleo', precoUnitario: 25 };
      const created = { id: 'p1', ...dto };
      mockRepo.create.mockReturnValue(created);
      mockRepo.save.mockResolvedValue(created);

      const result = await service.create(TENANT_ID, dto as any);

      expect(result).toEqual(created);
      expect(mockRepo.save).toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('should update and return part', async () => {
      const item = { id: 'p1', nome: 'Filtro de óleo', precoUnitario: 25 };
      mockRepo.findOne.mockResolvedValue(item);
      mockRepo.save.mockResolvedValue({ ...item, nome: 'Filtro de ar' });

      const result = await service.update(TENANT_ID, 'p1', { nome: 'Filtro de ar' } as any);

      expect(mockRepo.save).toHaveBeenCalled();
      expect(result.nome).toBe('Filtro de ar');
    });

    it('should throw NotFoundException when not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.update(TENANT_ID, 'nonexistent', {} as any)).rejects.toThrow(NotFoundException);
    });
  });

  describe('delete', () => {
    it('should delete part when found', async () => {
      const item = { id: 'p1' };
      mockRepo.findOne.mockResolvedValue(item);
      mockRepo.remove.mockResolvedValue(undefined);

      await service.delete(TENANT_ID, 'p1');

      expect(mockRepo.remove).toHaveBeenCalledWith(item);
    });

    it('should throw NotFoundException when not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.delete(TENANT_ID, 'nonexistent')).rejects.toThrow(NotFoundException);
    });
  });
});
```

### Step 3: Rodar o teste para verificar que falha

```bash
cd apps/backend
npx jest catalog-parts.service.spec --no-coverage
```

Expected: FAIL — `CatalogPartsService` não existe ainda.

### Step 4: Criar o service

```typescript
// apps/backend/src/modules/workshop/catalog/catalog-parts.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { CatalogPartEntity } from './catalog-part.entity';
import { CreateCatalogPartDto } from './dto/create-catalog-part.dto';

@Injectable()
export class CatalogPartsService {
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

  async list(
    tenantId: string,
    page: number,
    limit: number,
    search?: string,
  ): Promise<{ data: CatalogPartEntity[]; total: number; page: number; limit: number }> {
    return this.withSchema(tenantId, async (manager) => {
      const repo = manager.getRepository(CatalogPartEntity);
      const qb = repo.createQueryBuilder('p');
      if (search) qb.where('p.nome ILIKE :s OR p.codigo ILIKE :s', { s: `%${search}%` });
      const [data, total] = await qb
        .skip((page - 1) * limit)
        .take(limit)
        .orderBy('p.nome', 'ASC')
        .getManyAndCount();
      return { data, total, page, limit };
    });
  }

  async getById(tenantId: string, id: string): Promise<CatalogPartEntity> {
    return this.withSchema(tenantId, async (manager) => {
      const repo = manager.getRepository(CatalogPartEntity);
      const item = await repo.findOne({ where: { id } });
      if (!item) throw new NotFoundException('Peça não encontrada.');
      return item;
    });
  }

  async create(tenantId: string, dto: CreateCatalogPartDto): Promise<CatalogPartEntity> {
    return this.withSchema(tenantId, async (manager) => {
      const repo = manager.getRepository(CatalogPartEntity);
      return repo.save(repo.create({
        nome: dto.nome,
        codigo: dto.codigo ?? null,
        precoUnitario: dto.precoUnitario,
      }));
    });
  }

  async update(
    tenantId: string,
    id: string,
    dto: Partial<CreateCatalogPartDto>,
  ): Promise<CatalogPartEntity> {
    return this.withSchema(tenantId, async (manager) => {
      const repo = manager.getRepository(CatalogPartEntity);
      const item = await repo.findOne({ where: { id } });
      if (!item) throw new NotFoundException('Peça não encontrada.');
      Object.assign(item, {
        ...(dto.nome !== undefined && { nome: dto.nome }),
        ...(dto.codigo !== undefined && { codigo: dto.codigo }),
        ...(dto.precoUnitario !== undefined && { precoUnitario: dto.precoUnitario }),
      });
      return repo.save(item);
    });
  }

  async delete(tenantId: string, id: string): Promise<void> {
    return this.withSchema(tenantId, async (manager) => {
      const repo = manager.getRepository(CatalogPartEntity);
      const item = await repo.findOne({ where: { id } });
      if (!item) throw new NotFoundException('Peça não encontrada.');
      await repo.remove(item);
    });
  }
}
```

### Step 5: Rodar o teste para verificar que passa

```bash
cd apps/backend
npx jest catalog-parts.service.spec --no-coverage
```

Expected: PASS (6 tests)

### Step 6: Criar o controller

```typescript
// apps/backend/src/modules/workshop/catalog/catalog-parts.controller.ts
import {
  Body, Controller, Delete, Get, HttpCode, Param,
  ParseUUIDPipe, Patch, Post, Query, Request, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { RolesGuard } from '../../core/auth/roles.guard';
import { Roles } from '../../core/auth/roles.decorator';
import { UserRole } from '../../core/auth/user.entity';
import { AuthUser } from '../../core/auth/jwt.strategy';
import { CatalogPartsService } from './catalog-parts.service';
import { CreateCatalogPartDto } from './dto/create-catalog-part.dto';
import { UpdateCatalogPartDto } from './dto/update-catalog-part.dto';

interface RequestWithUser extends Request {
  user: AuthUser;
}

@Controller('workshop/catalog/parts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CatalogPartsController {
  constructor(private readonly catalogPartsService: CatalogPartsService) {}

  @Get()
  list(
    @Request() req: RequestWithUser,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('search') search?: string,
  ) {
    return this.catalogPartsService.list(req.user.tenantId, Number(page), Number(limit), search);
  }

  @Get(':id')
  getById(@Request() req: RequestWithUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.catalogPartsService.getById(req.user.tenantId, id);
  }

  @Post()
  create(@Request() req: RequestWithUser, @Body() dto: CreateCatalogPartDto) {
    return this.catalogPartsService.create(req.user.tenantId, dto);
  }

  @Patch(':id')
  update(
    @Request() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCatalogPartDto,
  ) {
    return this.catalogPartsService.update(req.user.tenantId, id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.OWNER)
  @HttpCode(204)
  delete(@Request() req: RequestWithUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.catalogPartsService.delete(req.user.tenantId, id);
  }
}
```

### Step 7: Adicionar CatalogPartsService e CatalogPartsController ao CatalogModule

```typescript
// apps/backend/src/modules/workshop/catalog/catalog.module.ts
import { Module } from '@nestjs/common';
import { CatalogServicesService } from './catalog-services.service';
import { CatalogServicesController } from './catalog-services.controller';
import { CatalogPartsService } from './catalog-parts.service';
import { CatalogPartsController } from './catalog-parts.controller';

@Module({
  controllers: [CatalogServicesController, CatalogPartsController],
  providers: [CatalogServicesService, CatalogPartsService],
})
export class CatalogModule {}
```

### Step 8: Rodar todos os testes

```bash
cd apps/backend
npx jest --no-coverage
```

Expected: PASS (≥71 tests)

### Step 9: Commit

```bash
git add apps/backend/src/modules/workshop/catalog/
git commit -m "feat(catalog): add CatalogParts CRUD with TDD"
```

---

## Task 5: Frontend — catalog.service.ts + CatalogPage + Rota

**Files:**
- Create: `apps/frontend/src/services/catalog.service.ts`
- Create: `apps/frontend/src/services/catalog.service.test.ts`
- Create: `apps/frontend/src/pages/workshop/catalog/CatalogPage.tsx`
- Modify: `apps/frontend/src/App.tsx`

### Step 1: Criar catalog.service.ts

```typescript
// apps/frontend/src/services/catalog.service.ts
import { api } from './api';
import type { PaginatedResponse } from './customers.service';

export interface CatalogService {
  id: string;
  nome: string;
  descricao: string | null;
  precoPadrao: number;
  createdAt: string;
  updatedAt: string;
}

export interface CatalogPart {
  id: string;
  nome: string;
  codigo: string | null;
  precoUnitario: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCatalogServicePayload {
  nome: string;
  descricao?: string;
  precoPadrao: number;
}

export interface CreateCatalogPartPayload {
  nome: string;
  codigo?: string;
  precoUnitario: number;
}

export const catalogServicesApi = {
  async list(params?: { page?: number; limit?: number; search?: string }): Promise<PaginatedResponse<CatalogService>> {
    const { data } = await api.get<PaginatedResponse<CatalogService>>('/workshop/catalog/services', { params });
    return data;
  },
  async getById(id: string): Promise<CatalogService> {
    const { data } = await api.get<CatalogService>(`/workshop/catalog/services/${id}`);
    return data;
  },
  async create(payload: CreateCatalogServicePayload): Promise<CatalogService> {
    const { data } = await api.post<CatalogService>('/workshop/catalog/services', payload);
    return data;
  },
  async update(id: string, payload: Partial<CreateCatalogServicePayload>): Promise<CatalogService> {
    const { data } = await api.patch<CatalogService>(`/workshop/catalog/services/${id}`, payload);
    return data;
  },
  async delete(id: string): Promise<void> {
    await api.delete(`/workshop/catalog/services/${id}`);
  },
};

export const catalogPartsApi = {
  async list(params?: { page?: number; limit?: number; search?: string }): Promise<PaginatedResponse<CatalogPart>> {
    const { data } = await api.get<PaginatedResponse<CatalogPart>>('/workshop/catalog/parts', { params });
    return data;
  },
  async getById(id: string): Promise<CatalogPart> {
    const { data } = await api.get<CatalogPart>(`/workshop/catalog/parts/${id}`);
    return data;
  },
  async create(payload: CreateCatalogPartPayload): Promise<CatalogPart> {
    const { data } = await api.post<CatalogPart>('/workshop/catalog/parts', payload);
    return data;
  },
  async update(id: string, payload: Partial<CreateCatalogPartPayload>): Promise<CatalogPart> {
    const { data } = await api.patch<CatalogPart>(`/workshop/catalog/parts/${id}`, payload);
    return data;
  },
  async delete(id: string): Promise<void> {
    await api.delete(`/workshop/catalog/parts/${id}`);
  },
};
```

### Step 2: Escrever testes do service (TDD)

```typescript
// apps/frontend/src/services/catalog.service.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./api', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

import { catalogServicesApi, catalogPartsApi } from './catalog.service';
import { api } from './api';
const mockApi = api as any;

describe('catalogServicesApi', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should call GET /workshop/catalog/services on list', async () => {
    mockApi.get.mockResolvedValue({ data: { data: [], total: 0, page: 1, limit: 20 } });
    const result = await catalogServicesApi.list({ page: 1, limit: 20 });
    expect(mockApi.get).toHaveBeenCalledWith('/workshop/catalog/services', expect.any(Object));
    expect(result.data).toEqual([]);
  });

  it('should call POST /workshop/catalog/services on create', async () => {
    const payload = { nome: 'Troca de óleo', precoPadrao: 80 };
    mockApi.post.mockResolvedValue({ data: { id: 's1', ...payload } });
    const result = await catalogServicesApi.create(payload);
    expect(mockApi.post).toHaveBeenCalledWith('/workshop/catalog/services', payload);
    expect(result.id).toBe('s1');
  });

  it('should call DELETE /workshop/catalog/services/:id on delete', async () => {
    mockApi.delete.mockResolvedValue({});
    await catalogServicesApi.delete('s1');
    expect(mockApi.delete).toHaveBeenCalledWith('/workshop/catalog/services/s1');
  });
});

describe('catalogPartsApi', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should call GET /workshop/catalog/parts on list', async () => {
    mockApi.get.mockResolvedValue({ data: { data: [], total: 0, page: 1, limit: 20 } });
    const result = await catalogPartsApi.list({ page: 1, limit: 20 });
    expect(mockApi.get).toHaveBeenCalledWith('/workshop/catalog/parts', expect.any(Object));
    expect(result.data).toEqual([]);
  });

  it('should call POST /workshop/catalog/parts on create', async () => {
    const payload = { nome: 'Filtro de óleo', precoUnitario: 25 };
    mockApi.post.mockResolvedValue({ data: { id: 'p1', ...payload } });
    const result = await catalogPartsApi.create(payload);
    expect(mockApi.post).toHaveBeenCalledWith('/workshop/catalog/parts', payload);
    expect(result.id).toBe('p1');
  });

  it('should call DELETE /workshop/catalog/parts/:id on delete', async () => {
    mockApi.delete.mockResolvedValue({});
    await catalogPartsApi.delete('p1');
    expect(mockApi.delete).toHaveBeenCalledWith('/workshop/catalog/parts/p1');
  });
});
```

### Step 3: Rodar os testes de frontend para verificar que falham

```bash
cd apps/frontend
npx vitest run src/services/catalog.service.test.ts
```

Expected: FAIL — arquivo não existe ainda. Depois de criar os arquivos no Step 1 e 2, rodar novamente.

```bash
cd apps/frontend
npx vitest run src/services/catalog.service.test.ts
```

Expected: PASS (6 tests)

### Step 4: Criar CatalogPage.tsx

Esta página tem duas abas com tabelas paginadas e modal de formulário para criação/edição. É o componente mais complexo desta entrega.

```tsx
// apps/frontend/src/pages/workshop/catalog/CatalogPage.tsx
import { useState, useEffect, useCallback } from 'react';
import {
  Alert, Box, Button, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, IconButton, Paper, Tab, Table,
  TableBody, TableCell, TableContainer, TableHead, TablePagination,
  TableRow, Tabs, TextField, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  catalogServicesApi, catalogPartsApi,
  type CatalogService, type CatalogPart,
} from '../../../services/catalog.service';

// --- Schemas Zod ---
const serviceSchema = z.object({
  nome: z.string().min(2, 'Mínimo 2 caracteres'),
  descricao: z.string().optional(),
  precoPadrao: z.coerce.number().min(0, 'Deve ser ≥ 0'),
});
type ServiceForm = z.infer<typeof serviceSchema>;

const partSchema = z.object({
  nome: z.string().min(2, 'Mínimo 2 caracteres'),
  codigo: z.string().optional(),
  precoUnitario: z.coerce.number().min(0, 'Deve ser ≥ 0'),
});
type PartForm = z.infer<typeof partSchema>;

// --- ServicesTab ---
function ServicesTab() {
  const [items, setItems] = useState<CatalogService[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CatalogService | null>(null);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<ServiceForm>({
    resolver: zodResolver(serviceSchema),
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await catalogServicesApi.list({ page: page + 1, limit: rowsPerPage, search: search || undefined });
      setItems(result.data);
      setTotal(result.total);
    } catch {
      setError('Erro ao carregar serviços.');
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, search]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditing(null); reset({ nome: '', descricao: '', precoPadrao: 0 }); setModalOpen(true); };
  const openEdit = (item: CatalogService) => {
    setEditing(item);
    reset({ nome: item.nome, descricao: item.descricao ?? '', precoPadrao: item.precoPadrao });
    setModalOpen(true);
  };

  const onSubmit = async (values: ServiceForm) => {
    try {
      if (editing) {
        await catalogServicesApi.update(editing.id, values);
      } else {
        await catalogServicesApi.create(values);
      }
      setModalOpen(false);
      load();
    } catch {
      alert('Erro ao salvar serviço.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja excluir este serviço?')) return;
    try {
      await catalogServicesApi.delete(id);
      load();
    } catch (err: any) {
      alert(err?.response?.data?.message ?? 'Erro ao excluir serviço.');
    }
  };

  return (
    <Box sx={{ mt: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        <TextField
          label="Buscar por nome"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          size="small"
          sx={{ width: 320 }}
        />
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
          Novo Serviço
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Nome</TableCell>
              <TableCell>Descrição</TableCell>
              <TableCell>Preço Padrão</TableCell>
              <TableCell align="right">Ações</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={4} align="center"><CircularProgress size={24} /></TableCell></TableRow>
            ) : items.map((item) => (
              <TableRow key={item.id}>
                <TableCell>{item.nome}</TableCell>
                <TableCell>{item.descricao ?? '—'}</TableCell>
                <TableCell>R$ {Number(item.precoPadrao).toFixed(2)}</TableCell>
                <TableCell align="right">
                  <IconButton size="small" onClick={() => openEdit(item)}><EditIcon fontSize="small" /></IconButton>
                  <IconButton size="small" color="error" onClick={() => handleDelete(item.id)}><DeleteIcon fontSize="small" /></IconButton>
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

      <Dialog open={modalOpen} onClose={() => setModalOpen(false)} fullWidth maxWidth="sm">
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogTitle>{editing ? 'Editar Serviço' : 'Novo Serviço'}</DialogTitle>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
            <TextField
              label="Nome *"
              {...register('nome')}
              error={!!errors.nome}
              helperText={errors.nome?.message}
              fullWidth
            />
            <TextField
              label="Descrição"
              {...register('descricao')}
              fullWidth
              multiline
              rows={2}
            />
            <TextField
              label="Preço Padrão (R$) *"
              type="number"
              inputProps={{ step: '0.01', min: '0' }}
              {...register('precoPadrao')}
              error={!!errors.precoPadrao}
              helperText={errors.precoPadrao?.message}
              fullWidth
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button type="submit" variant="contained">Salvar</Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
}

// --- PartsTab ---
function PartsTab() {
  const [items, setItems] = useState<CatalogPart[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CatalogPart | null>(null);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<PartForm>({
    resolver: zodResolver(partSchema),
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await catalogPartsApi.list({ page: page + 1, limit: rowsPerPage, search: search || undefined });
      setItems(result.data);
      setTotal(result.total);
    } catch {
      setError('Erro ao carregar peças.');
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, search]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditing(null); reset({ nome: '', codigo: '', precoUnitario: 0 }); setModalOpen(true); };
  const openEdit = (item: CatalogPart) => {
    setEditing(item);
    reset({ nome: item.nome, codigo: item.codigo ?? '', precoUnitario: item.precoUnitario });
    setModalOpen(true);
  };

  const onSubmit = async (values: PartForm) => {
    try {
      if (editing) {
        await catalogPartsApi.update(editing.id, values);
      } else {
        await catalogPartsApi.create(values);
      }
      setModalOpen(false);
      load();
    } catch {
      alert('Erro ao salvar peça.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja excluir esta peça?')) return;
    try {
      await catalogPartsApi.delete(id);
      load();
    } catch (err: any) {
      alert(err?.response?.data?.message ?? 'Erro ao excluir peça.');
    }
  };

  return (
    <Box sx={{ mt: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        <TextField
          label="Buscar por nome ou código"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          size="small"
          sx={{ width: 320 }}
        />
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
          Nova Peça
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Nome</TableCell>
              <TableCell>Código</TableCell>
              <TableCell>Preço Unitário</TableCell>
              <TableCell align="right">Ações</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={4} align="center"><CircularProgress size={24} /></TableCell></TableRow>
            ) : items.map((item) => (
              <TableRow key={item.id}>
                <TableCell>{item.nome}</TableCell>
                <TableCell>{item.codigo ?? '—'}</TableCell>
                <TableCell>R$ {Number(item.precoUnitario).toFixed(2)}</TableCell>
                <TableCell align="right">
                  <IconButton size="small" onClick={() => openEdit(item)}><EditIcon fontSize="small" /></IconButton>
                  <IconButton size="small" color="error" onClick={() => handleDelete(item.id)}><DeleteIcon fontSize="small" /></IconButton>
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

      <Dialog open={modalOpen} onClose={() => setModalOpen(false)} fullWidth maxWidth="sm">
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogTitle>{editing ? 'Editar Peça' : 'Nova Peça'}</DialogTitle>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
            <TextField
              label="Nome *"
              {...register('nome')}
              error={!!errors.nome}
              helperText={errors.nome?.message}
              fullWidth
            />
            <TextField
              label="Código / Referência"
              {...register('codigo')}
              fullWidth
            />
            <TextField
              label="Preço Unitário (R$) *"
              type="number"
              inputProps={{ step: '0.01', min: '0' }}
              {...register('precoUnitario')}
              error={!!errors.precoUnitario}
              helperText={errors.precoUnitario?.message}
              fullWidth
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button type="submit" variant="contained">Salvar</Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
}

// --- CatalogPage ---
export function CatalogPage() {
  const [tab, setTab] = useState(0);

  return (
    <Box>
      <Typography variant="h5" fontWeight="bold" sx={{ mb: 2 }}>
        Catálogo
      </Typography>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tab label="Serviços" />
        <Tab label="Peças" />
      </Tabs>
      {tab === 0 && <ServicesTab />}
      {tab === 1 && <PartsTab />}
    </Box>
  );
}
```

### Step 5: Registrar rota em App.tsx

Abrir `apps/frontend/src/App.tsx` e adicionar:

```typescript
// Import no topo:
import { CatalogPage } from './pages/workshop/catalog/CatalogPage';
```

Adicionar a rota DENTRO do bloco `PrivateRoute → AppLayout`, após as rotas de vehicles:

```tsx
<Route path="catalog" element={<CatalogPage />} />
```

### Step 6: Rodar todos os testes de frontend

```bash
cd apps/frontend
npx vitest run
```

Expected: PASS (≥32 tests)

### Step 7: Commit

```bash
git add apps/frontend/src/services/catalog.service.ts \
        apps/frontend/src/services/catalog.service.test.ts \
        apps/frontend/src/pages/workshop/catalog/CatalogPage.tsx \
        apps/frontend/src/App.tsx
git commit -m "feat(catalog): add CatalogPage with tabbed UI for services and parts"
```

---

## Verificação Final

```bash
# Backend
cd apps/backend && npx jest --no-coverage
# Expected: ≥71 tests passing

# Frontend
cd apps/frontend && npx vitest run
# Expected: ≥32 tests passing
```
