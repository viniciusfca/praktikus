# Entrega 6: Ordem de Serviço (OS completa) — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement the complete service order (OS) module with state machine, checklist, service/part items, mechanic assignment, and budget approval via public link or manual.

**Architecture:** `ServiceOrdersService` handles all OS operations (CRUD, state machine, items, approval token) using the `withSchema<T>(QueryRunner)` pattern. `PublicQuotesService` handles the no-auth approval endpoint by looking up tokens from `public.service_order_approval_tokens`, then querying the tenant schema. Frontend uses a list page (`ServiceOrdersPage`) + detail page (`ServiceOrderDetailPage`) + public approval page (`QuoteApprovalPage`).

**Tech Stack:** NestJS 10 + TypeORM 0.3 + PostgreSQL schema-per-tenant + React 18 + MUI v5 + react-hook-form + zod

---

### Task 1: Tenant SQL tables + global migration

**Files:**
- Modify: `apps/backend/src/database/tenant-migrations/create-tenant-tables.ts`
- Create: `apps/backend/src/database/migrations/1742680000000-AddApprovalTokensTable.ts`

**Step 1: Add 3 tables to `create-tenant-tables.ts`**

Append after `appointment_comments` (before the closing `]`):

```typescript
    `CREATE TABLE IF NOT EXISTS "${schemaName}".service_orders (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      appointment_id UUID,
      cliente_id UUID NOT NULL,
      veiculo_id UUID NOT NULL,
      status VARCHAR NOT NULL DEFAULT 'ORCAMENTO',
      status_pagamento VARCHAR NOT NULL DEFAULT 'PENDENTE',
      km_entrada VARCHAR,
      combustivel VARCHAR,
      observacoes_entrada TEXT,
      approval_token UUID,
      approval_expires_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS "${schemaName}".so_items_services (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      so_id UUID NOT NULL REFERENCES "${schemaName}".service_orders(id) ON DELETE CASCADE,
      catalog_service_id UUID NOT NULL,
      nome_servico VARCHAR NOT NULL,
      valor NUMERIC(10,2) NOT NULL,
      mecanico_id UUID,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS "${schemaName}".so_items_parts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      so_id UUID NOT NULL REFERENCES "${schemaName}".service_orders(id) ON DELETE CASCADE,
      catalog_part_id UUID NOT NULL,
      nome_peca VARCHAR NOT NULL,
      quantidade INT NOT NULL DEFAULT 1,
      valor_unitario NUMERIC(10,2) NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
```

**Step 2: Create global migration**

Create `apps/backend/src/database/migrations/1742680000000-AddApprovalTokensTable.ts`:

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddApprovalTokensTable1742680000000 implements MigrationInterface {
  name = 'AddApprovalTokensTable1742680000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "public"."service_order_approval_tokens" (
        "token" uuid NOT NULL,
        "tenant_id" uuid NOT NULL,
        "so_id" uuid NOT NULL,
        "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "used_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_service_order_approval_tokens" PRIMARY KEY ("token")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_so_approval_tokens_tenant" ON "public"."service_order_approval_tokens" ("tenant_id")`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "public"."service_order_approval_tokens"`);
  }
}
```

**Step 3: Commit**

```bash
git add apps/backend/src/database/
git commit -m "feat(service-orders): add tenant tables + global approval_tokens migration"
```

---

### Task 2: TypeORM entities + DTOs + database.module.ts

**Files:**
- Create: `apps/backend/src/modules/workshop/service-orders/service-order.entity.ts`
- Create: `apps/backend/src/modules/workshop/service-orders/so-item-service.entity.ts`
- Create: `apps/backend/src/modules/workshop/service-orders/so-item-part.entity.ts`
- Create: `apps/backend/src/modules/workshop/service-orders/dto/create-service-order.dto.ts`
- Create: `apps/backend/src/modules/workshop/service-orders/dto/update-service-order.dto.ts`
- Create: `apps/backend/src/modules/workshop/service-orders/dto/patch-status.dto.ts`
- Create: `apps/backend/src/modules/workshop/service-orders/dto/patch-payment-status.dto.ts`
- Create: `apps/backend/src/modules/workshop/service-orders/dto/create-so-item-service.dto.ts`
- Create: `apps/backend/src/modules/workshop/service-orders/dto/create-so-item-part.dto.ts`
- Modify: `apps/backend/src/database/database.module.ts`

**Step 1: Create `service-order.entity.ts`**

```typescript
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'service_orders' })
export class ServiceOrderEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'appointment_id', nullable: true }) appointmentId: string | null;
  @Column({ name: 'cliente_id' }) clienteId: string;
  @Column({ name: 'veiculo_id' }) veiculoId: string;
  @Column({ default: 'ORCAMENTO' }) status: string;
  @Column({ name: 'status_pagamento', default: 'PENDENTE' }) statusPagamento: string;
  @Column({ name: 'km_entrada', nullable: true }) kmEntrada: string | null;
  @Column({ nullable: true }) combustivel: string | null;
  @Column({ name: 'observacoes_entrada', type: 'text', nullable: true }) observacoesEntrada: string | null;
  @Column({ name: 'approval_token', type: 'uuid', nullable: true }) approvalToken: string | null;
  @Column({ name: 'approval_expires_at', type: 'timestamptz', nullable: true }) approvalExpiresAt: Date | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;
}
```

**Step 2: Create `so-item-service.entity.ts`**

```typescript
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'so_items_services' })
export class SoItemServiceEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'so_id' }) soId: string;
  @Column({ name: 'catalog_service_id' }) catalogServiceId: string;
  @Column({ name: 'nome_servico' }) nomeServico: string;
  @Column({ type: 'numeric' }) valor: number;
  @Column({ name: 'mecanico_id', nullable: true }) mecanicoId: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
}
```

**Step 3: Create `so-item-part.entity.ts`**

```typescript
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'so_items_parts' })
export class SoItemPartEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'so_id' }) soId: string;
  @Column({ name: 'catalog_part_id' }) catalogPartId: string;
  @Column({ name: 'nome_peca' }) nomePeca: string;
  @Column({ type: 'int' }) quantidade: number;
  @Column({ name: 'valor_unitario', type: 'numeric' }) valorUnitario: number;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
}
```

**Step 4: Create DTOs**

`dto/create-service-order.dto.ts`:
```typescript
import { IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateServiceOrderDto {
  @IsUUID() clienteId: string;
  @IsUUID() veiculoId: string;
  @IsOptional() @IsUUID() appointmentId?: string;
  @IsOptional() @IsString() kmEntrada?: string;
  @IsOptional() @IsString() combustivel?: string;
  @IsOptional() @IsString() observacoesEntrada?: string;
}
```

`dto/update-service-order.dto.ts`:
```typescript
import { PartialType } from '@nestjs/mapped-types';
import { CreateServiceOrderDto } from './create-service-order.dto';
export class UpdateServiceOrderDto extends PartialType(CreateServiceOrderDto) {}
```

`dto/patch-status.dto.ts`:
```typescript
import { IsIn } from 'class-validator';
const VALID = ['ORCAMENTO', 'APROVADO', 'EM_EXECUCAO', 'AGUARDANDO_PECA', 'FINALIZADA', 'ENTREGUE'];
export class PatchStatusDto {
  @IsIn(VALID) status: string;
}
```

`dto/patch-payment-status.dto.ts`:
```typescript
import { IsIn } from 'class-validator';
export class PatchPaymentStatusDto {
  @IsIn(['PENDENTE', 'PAGO']) statusPagamento: string;
}
```

`dto/create-so-item-service.dto.ts`:
```typescript
import { IsNumber, IsOptional, IsString, IsUUID, Min, MinLength } from 'class-validator';
export class CreateSoItemServiceDto {
  @IsUUID() catalogServiceId: string;
  @IsString() @MinLength(1) nomeServico: string;
  @IsNumber() @Min(0) valor: number;
  @IsOptional() @IsUUID() mecanicoId?: string;
}
```

`dto/create-so-item-part.dto.ts`:
```typescript
import { IsInt, IsNumber, IsString, IsUUID, Min, MinLength } from 'class-validator';
export class CreateSoItemPartDto {
  @IsUUID() catalogPartId: string;
  @IsString() @MinLength(1) nomePeca: string;
  @IsInt() @Min(1) quantidade: number;
  @IsNumber() @Min(0) valorUnitario: number;
}
```

**Step 5: Register entities in `database.module.ts`**

Add to the `entities` array (after `AppointmentCommentEntity`):
```typescript
import { ServiceOrderEntity } from '../modules/workshop/service-orders/service-order.entity';
import { SoItemServiceEntity } from '../modules/workshop/service-orders/so-item-service.entity';
import { SoItemPartEntity } from '../modules/workshop/service-orders/so-item-part.entity';
// ...
entities: [..., AppointmentCommentEntity, ServiceOrderEntity, SoItemServiceEntity, SoItemPartEntity],
```

**Step 6: Commit**

```bash
git add apps/backend/src/
git commit -m "feat(service-orders): add entities and DTOs"
```

---

### Task 3: ServiceOrdersService

**Files:**
- Create: `apps/backend/src/modules/workshop/service-orders/service-orders.service.ts`

```typescript
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';
import { randomUUID } from 'crypto';
import { ServiceOrderEntity } from './service-order.entity';
import { SoItemServiceEntity } from './so-item-service.entity';
import { SoItemPartEntity } from './so-item-part.entity';
import { CreateServiceOrderDto } from './dto/create-service-order.dto';
import { UpdateServiceOrderDto } from './dto/update-service-order.dto';
import { CreateSoItemServiceDto } from './dto/create-so-item-service.dto';
import { CreateSoItemPartDto } from './dto/create-so-item-part.dto';

const VALID_TRANSITIONS: Record<string, string[]> = {
  ORCAMENTO: ['APROVADO'],
  APROVADO: ['EM_EXECUCAO'],
  EM_EXECUCAO: ['AGUARDANDO_PECA', 'FINALIZADA'],
  AGUARDANDO_PECA: ['EM_EXECUCAO'],
  FINALIZADA: ['ENTREGUE'],
  ENTREGUE: [],
};

// Statuses an EMPLOYEE can transition FROM
const EMPLOYEE_ALLOWED_FROM = ['ORCAMENTO', 'EM_EXECUCAO'];

@Injectable()
export class ServiceOrdersService {
  constructor(private readonly dataSource: DataSource) {}

  private getSchemaName(tenantId: string): string {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantId)) {
      throw new Error('Invalid tenantId');
    }
    return `tenant_${tenantId.replace(/-/g, '')}`;
  }

  private async withSchema<T>(tenantId: string, fn: (qr: QueryRunner) => Promise<T>): Promise<T> {
    const schemaName = this.getSchemaName(tenantId);
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    try {
      await qr.query(`SET search_path TO "${schemaName}", public`);
      return await fn(qr);
    } finally {
      await qr.release();
    }
  }

  private getSoRepo(qr: QueryRunner) { return qr.manager.getRepository(ServiceOrderEntity); }
  private getItemServiceRepo(qr: QueryRunner) { return qr.manager.getRepository(SoItemServiceEntity); }
  private getItemPartRepo(qr: QueryRunner) { return qr.manager.getRepository(SoItemPartEntity); }

  async list(
    tenantId: string,
    params: { status?: string; dateStart?: string; dateEnd?: string },
  ): Promise<ServiceOrderEntity[]> {
    return this.withSchema(tenantId, async (qr) => {
      const qb = this.getSoRepo(qr).createQueryBuilder('so').orderBy('so.createdAt', 'DESC');
      if (params.status) qb.andWhere('so.status = :status', { status: params.status });
      if (params.dateStart) qb.andWhere('so.createdAt >= :dateStart', { dateStart: params.dateStart });
      if (params.dateEnd) qb.andWhere('so.createdAt <= :dateEnd', { dateEnd: params.dateEnd });
      return qb.getMany();
    });
  }

  async getById(tenantId: string, id: string) {
    return this.withSchema(tenantId, async (qr) => {
      const so = await this.getSoRepo(qr).findOne({ where: { id } });
      if (!so) throw new NotFoundException('OS não encontrada.');
      const itemsServices = await this.getItemServiceRepo(qr).find({ where: { soId: id } });
      const itemsParts = await this.getItemPartRepo(qr).find({ where: { soId: id } });
      return { ...so, itemsServices, itemsParts };
    });
  }

  async create(tenantId: string, dto: CreateServiceOrderDto): Promise<ServiceOrderEntity> {
    return this.withSchema(tenantId, async (qr) => {
      const repo = this.getSoRepo(qr);
      return repo.save(repo.create({
        clienteId: dto.clienteId,
        veiculoId: dto.veiculoId,
        appointmentId: dto.appointmentId ?? null,
        kmEntrada: dto.kmEntrada ?? null,
        combustivel: dto.combustivel ?? null,
        observacoesEntrada: dto.observacoesEntrada ?? null,
      }));
    });
  }

  async update(tenantId: string, id: string, dto: UpdateServiceOrderDto): Promise<ServiceOrderEntity> {
    return this.withSchema(tenantId, async (qr) => {
      const repo = this.getSoRepo(qr);
      const so = await repo.findOne({ where: { id } });
      if (!so) throw new NotFoundException('OS não encontrada.');
      if (dto.kmEntrada !== undefined) so.kmEntrada = dto.kmEntrada;
      if (dto.combustivel !== undefined) so.combustivel = dto.combustivel;
      if (dto.observacoesEntrada !== undefined) so.observacoesEntrada = dto.observacoesEntrada;
      return repo.save(so);
    });
  }

  async patchStatus(
    tenantId: string,
    id: string,
    newStatus: string,
    userRole: string,
  ): Promise<ServiceOrderEntity> {
    return this.withSchema(tenantId, async (qr) => {
      const repo = this.getSoRepo(qr);
      const so = await repo.findOne({ where: { id } });
      if (!so) throw new NotFoundException('OS não encontrada.');

      if (!EMPLOYEE_ALLOWED_FROM.includes(so.status) && userRole !== 'OWNER') {
        throw new BadRequestException('Permissão insuficiente para esta transição.');
      }
      const allowed = VALID_TRANSITIONS[so.status] ?? [];
      if (!allowed.includes(newStatus)) {
        throw new BadRequestException(`Transição de ${so.status} para ${newStatus} não permitida.`);
      }

      so.status = newStatus;
      if (newStatus === 'APROVADO') {
        so.approvalToken = null;
        so.approvalExpiresAt = null;
      }
      return repo.save(so);
    });
  }

  async patchPaymentStatus(tenantId: string, id: string, statusPagamento: string): Promise<ServiceOrderEntity> {
    return this.withSchema(tenantId, async (qr) => {
      const repo = this.getSoRepo(qr);
      const so = await repo.findOne({ where: { id } });
      if (!so) throw new NotFoundException('OS não encontrada.');
      so.statusPagamento = statusPagamento;
      return repo.save(so);
    });
  }

  async generateApprovalToken(tenantId: string, id: string): Promise<{ token: string; expiresAt: Date }> {
    return this.withSchema(tenantId, async (qr) => {
      const repo = this.getSoRepo(qr);
      const so = await repo.findOne({ where: { id } });
      if (!so) throw new NotFoundException('OS não encontrada.');
      if (so.status !== 'ORCAMENTO') {
        throw new BadRequestException('Link só pode ser gerado com status ORCAMENTO.');
      }
      const token = randomUUID();
      const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);
      so.approvalToken = token;
      so.approvalExpiresAt = expiresAt;
      await repo.save(so);
      // Record in public table for cross-tenant lookup
      await this.dataSource.query(
        `INSERT INTO public.service_order_approval_tokens (token, tenant_id, so_id, expires_at)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (token) DO UPDATE SET expires_at = $4, used_at = NULL`,
        [token, tenantId, id, expiresAt.toISOString()],
      );
      return { token, expiresAt };
    });
  }

  async addItemService(tenantId: string, soId: string, dto: CreateSoItemServiceDto): Promise<SoItemServiceEntity> {
    return this.withSchema(tenantId, async (qr) => {
      const so = await this.getSoRepo(qr).findOne({ where: { id: soId } });
      if (!so) throw new NotFoundException('OS não encontrada.');
      const repo = this.getItemServiceRepo(qr);
      return repo.save(repo.create({
        soId,
        catalogServiceId: dto.catalogServiceId,
        nomeServico: dto.nomeServico,
        valor: dto.valor,
        mecanicoId: dto.mecanicoId ?? null,
      }));
    });
  }

  async removeItemService(tenantId: string, soId: string, itemId: string): Promise<void> {
    return this.withSchema(tenantId, async (qr) => {
      const item = await this.getItemServiceRepo(qr).findOne({ where: { id: itemId, soId } });
      if (!item) throw new NotFoundException('Item não encontrado.');
      await this.getItemServiceRepo(qr).remove(item);
    });
  }

  async addItemPart(tenantId: string, soId: string, dto: CreateSoItemPartDto): Promise<SoItemPartEntity> {
    return this.withSchema(tenantId, async (qr) => {
      const so = await this.getSoRepo(qr).findOne({ where: { id: soId } });
      if (!so) throw new NotFoundException('OS não encontrada.');
      const repo = this.getItemPartRepo(qr);
      return repo.save(repo.create({
        soId,
        catalogPartId: dto.catalogPartId,
        nomePeca: dto.nomePeca,
        quantidade: dto.quantidade,
        valorUnitario: dto.valorUnitario,
      }));
    });
  }

  async removeItemPart(tenantId: string, soId: string, itemId: string): Promise<void> {
    return this.withSchema(tenantId, async (qr) => {
      const item = await this.getItemPartRepo(qr).findOne({ where: { id: itemId, soId } });
      if (!item) throw new NotFoundException('Item não encontrado.');
      await this.getItemPartRepo(qr).remove(item);
    });
  }

  async delete(tenantId: string, id: string): Promise<void> {
    return this.withSchema(tenantId, async (qr) => {
      const so = await this.getSoRepo(qr).findOne({ where: { id } });
      if (!so) throw new NotFoundException('OS não encontrada.');
      if (so.approvalToken) {
        await this.dataSource.query(
          `DELETE FROM public.service_order_approval_tokens WHERE so_id = $1`,
          [id],
        );
      }
      await this.getSoRepo(qr).remove(so);
    });
  }
}
```

**Step 2: Commit**

```bash
git add apps/backend/src/modules/workshop/service-orders/service-orders.service.ts
git commit -m "feat(service-orders): add ServiceOrdersService"
```

---

### Task 4: ServiceOrdersService tests

**Files:**
- Create: `apps/backend/src/modules/workshop/service-orders/service-orders.service.spec.ts`

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ServiceOrdersService } from './service-orders.service';
import { ServiceOrderEntity } from './service-order.entity';
import { SoItemServiceEntity } from './so-item-service.entity';
import { SoItemPartEntity } from './so-item-part.entity';

const TENANT_ID = '00000000-0000-0000-0000-000000000001';
const SO_ID = '00000000-0000-0000-0000-000000000010';

const mockQb = {
  andWhere: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  getMany: jest.fn(),
};

const mockSoRepo = {
  createQueryBuilder: jest.fn().mockReturnValue(mockQb),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  remove: jest.fn(),
};

const mockItemServiceRepo = {
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  remove: jest.fn(),
};

const mockItemPartRepo = {
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  remove: jest.fn(),
};

const mockQueryRunner = {
  connect: jest.fn().mockResolvedValue(undefined),
  query: jest.fn().mockResolvedValue(undefined),
  manager: {
    getRepository: jest.fn((entity: any) => {
      if (entity?.name === 'ServiceOrderEntity') return mockSoRepo;
      if (entity?.name === 'SoItemServiceEntity') return mockItemServiceRepo;
      return mockItemPartRepo;
    }),
  },
  release: jest.fn().mockResolvedValue(undefined),
};

const mockDataSource = {
  createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
  query: jest.fn().mockResolvedValue(undefined),
};

describe('ServiceOrdersService', () => {
  let service: ServiceOrdersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ServiceOrdersService,
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();
    service = module.get<ServiceOrdersService>(ServiceOrdersService);
    jest.clearAllMocks();
    mockQueryRunner.query.mockResolvedValue(undefined);
    mockQueryRunner.manager.getRepository.mockImplementation((entity: any) => {
      if (entity?.name === 'ServiceOrderEntity') return mockSoRepo;
      if (entity?.name === 'SoItemServiceEntity') return mockItemServiceRepo;
      return mockItemPartRepo;
    });
    mockSoRepo.createQueryBuilder.mockReturnValue(mockQb);
    mockQb.andWhere.mockReturnThis();
    mockQb.orderBy.mockReturnThis();
  });

  describe('list', () => {
    it('should return service orders and set search_path', async () => {
      const items = [{ id: SO_ID, status: 'ORCAMENTO' }];
      mockQb.getMany.mockResolvedValue(items);
      const result = await service.list(TENANT_ID, {});
      expect(result).toEqual(items);
      expect(mockQueryRunner.query).toHaveBeenCalledWith(expect.stringContaining('SET search_path'));
    });

    it('should apply status filter', async () => {
      mockQb.getMany.mockResolvedValue([]);
      await service.list(TENANT_ID, { status: 'APROVADO' });
      expect(mockQb.andWhere).toHaveBeenCalledWith(expect.stringContaining('status'), expect.any(Object));
    });
  });

  describe('getById', () => {
    it('should return SO with items when found', async () => {
      const so = { id: SO_ID, status: 'ORCAMENTO' };
      mockSoRepo.findOne.mockResolvedValue(so);
      mockItemServiceRepo.find.mockResolvedValue([]);
      mockItemPartRepo.find.mockResolvedValue([]);
      const result = await service.getById(TENANT_ID, SO_ID);
      expect(result.id).toBe(SO_ID);
      expect(result).toHaveProperty('itemsServices');
      expect(result).toHaveProperty('itemsParts');
    });

    it('should throw NotFoundException when not found', async () => {
      mockSoRepo.findOne.mockResolvedValue(null);
      await expect(service.getById(TENANT_ID, SO_ID)).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create and return service order', async () => {
      const dto = {
        clienteId: '00000000-0000-0000-0000-000000000002',
        veiculoId: '00000000-0000-0000-0000-000000000003',
      };
      const created = { id: SO_ID, ...dto, status: 'ORCAMENTO' };
      mockSoRepo.create.mockReturnValue(created);
      mockSoRepo.save.mockResolvedValue(created);
      const result = await service.create(TENANT_ID, dto as any);
      expect(result.id).toBe(SO_ID);
      expect(result.status).toBe('ORCAMENTO');
    });
  });

  describe('patchStatus', () => {
    it('should transition status for valid move', async () => {
      const so = { id: SO_ID, status: 'ORCAMENTO', approvalToken: null };
      mockSoRepo.findOne.mockResolvedValue(so);
      mockSoRepo.save.mockResolvedValue({ ...so, status: 'APROVADO' });
      const result = await service.patchStatus(TENANT_ID, SO_ID, 'APROVADO', 'OWNER');
      expect(result.status).toBe('APROVADO');
    });

    it('should throw BadRequestException for invalid transition', async () => {
      const so = { id: SO_ID, status: 'ORCAMENTO' };
      mockSoRepo.findOne.mockResolvedValue(so);
      await expect(service.patchStatus(TENANT_ID, SO_ID, 'ENTREGUE', 'OWNER')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if EMPLOYEE tries to transition from APROVADO', async () => {
      const so = { id: SO_ID, status: 'APROVADO' };
      mockSoRepo.findOne.mockResolvedValue(so);
      await expect(service.patchStatus(TENANT_ID, SO_ID, 'EM_EXECUCAO', 'EMPLOYEE')).rejects.toThrow(BadRequestException);
    });
  });

  describe('generateApprovalToken', () => {
    it('should generate token for ORCAMENTO status', async () => {
      const so = { id: SO_ID, status: 'ORCAMENTO', approvalToken: null, approvalExpiresAt: null };
      mockSoRepo.findOne.mockResolvedValue(so);
      mockSoRepo.save.mockResolvedValue(so);
      mockDataSource.query.mockResolvedValue(undefined);
      const result = await service.generateApprovalToken(TENANT_ID, SO_ID);
      expect(result).toHaveProperty('token');
      expect(result).toHaveProperty('expiresAt');
    });

    it('should throw BadRequestException if status is not ORCAMENTO', async () => {
      const so = { id: SO_ID, status: 'APROVADO' };
      mockSoRepo.findOne.mockResolvedValue(so);
      await expect(service.generateApprovalToken(TENANT_ID, SO_ID)).rejects.toThrow(BadRequestException);
    });
  });

  describe('addItemService', () => {
    it('should add item when SO exists', async () => {
      const so = { id: SO_ID };
      const item = { id: 'item1', soId: SO_ID };
      mockSoRepo.findOne.mockResolvedValue(so);
      mockItemServiceRepo.create.mockReturnValue(item);
      mockItemServiceRepo.save.mockResolvedValue(item);
      const dto = { catalogServiceId: '00000000-0000-0000-0000-000000000099', nomeServico: 'Troca de óleo', valor: 150 };
      const result = await service.addItemService(TENANT_ID, SO_ID, dto as any);
      expect(result.id).toBe('item1');
    });

    it('should throw NotFoundException when SO not found', async () => {
      mockSoRepo.findOne.mockResolvedValue(null);
      await expect(service.addItemService(TENANT_ID, SO_ID, {} as any)).rejects.toThrow(NotFoundException);
    });
  });

  describe('delete', () => {
    it('should delete SO when found', async () => {
      const so = { id: SO_ID, approvalToken: null };
      mockSoRepo.findOne.mockResolvedValue(so);
      mockSoRepo.remove.mockResolvedValue(undefined);
      await service.delete(TENANT_ID, SO_ID);
      expect(mockSoRepo.remove).toHaveBeenCalledWith(so);
    });

    it('should throw NotFoundException when not found', async () => {
      mockSoRepo.findOne.mockResolvedValue(null);
      await expect(service.delete(TENANT_ID, SO_ID)).rejects.toThrow(NotFoundException);
    });
  });
});
```

**Step 2: Run tests**

```bash
cd apps/backend
node "c:\Users\vinic\OneDrive\Projetos\Praktikus\node_modules\.pnpm\jest@30.3.0_@types+node@22.19.15_ts-node@10.9.2\node_modules\jest\bin\jest.js" --testPathPattern=service-orders.service.spec
```

Expected: 12 tests passing.

**Step 3: Commit**

```bash
git add apps/backend/src/modules/workshop/service-orders/service-orders.service.spec.ts
git commit -m "test(service-orders): add ServiceOrdersService unit tests"
```

---

### Task 5: PublicQuotesService + tests

**Files:**
- Create: `apps/backend/src/modules/workshop/service-orders/public-quotes.service.ts`
- Create: `apps/backend/src/modules/workshop/service-orders/public-quotes.service.spec.ts`

**Step 1: Create `public-quotes.service.ts`**

```typescript
import { ConflictException, GoneException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ServiceOrderEntity } from './service-order.entity';
import { SoItemServiceEntity } from './so-item-service.entity';
import { SoItemPartEntity } from './so-item-part.entity';

@Injectable()
export class PublicQuotesService {
  constructor(private readonly dataSource: DataSource) {}

  private getSchemaName(tenantId: string): string {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantId)) {
      throw new Error('Invalid tenantId');
    }
    return `tenant_${tenantId.replace(/-/g, '')}`;
  }

  private async lookupToken(token: string) {
    const rows: Array<{ tenant_id: string; so_id: string; expires_at: string; used_at: string | null }> =
      await this.dataSource.query(
        `SELECT tenant_id, so_id, expires_at, used_at FROM public.service_order_approval_tokens WHERE token = $1`,
        [token],
      );
    if (!rows.length) throw new NotFoundException('Token inválido.');
    const row = rows[0];
    if (row.used_at) throw new ConflictException('Token já utilizado.');
    if (new Date(row.expires_at) < new Date()) throw new GoneException('Token expirado.');
    return row;
  }

  async getQuote(token: string) {
    const { tenant_id, so_id } = await this.lookupToken(token);
    const schemaName = this.getSchemaName(tenant_id);
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    try {
      await qr.query(`SET search_path TO "${schemaName}", public`);
      const so = await qr.manager.getRepository(ServiceOrderEntity).findOne({ where: { id: so_id } });
      if (!so) throw new NotFoundException('OS não encontrada.');
      const itemsServices = await qr.manager.getRepository(SoItemServiceEntity).find({ where: { soId: so_id } });
      const itemsParts = await qr.manager.getRepository(SoItemPartEntity).find({ where: { soId: so_id } });
      const [clienteRows, veiculoRows, tenantRows] = await Promise.all([
        qr.query(`SELECT nome, cpf_cnpj FROM customers WHERE id = $1`, [so.clienteId]),
        qr.query(`SELECT placa, marca, modelo, ano FROM vehicles WHERE id = $1`, [so.veiculoId]),
        this.dataSource.query(`SELECT nome_fantasia FROM public.tenants WHERE id = $1`, [tenant_id]),
      ]);
      const totalServices = itemsServices.reduce((s, i) => s + Number(i.valor), 0);
      const totalParts = itemsParts.reduce((s, i) => s + Number(i.valorUnitario) * i.quantidade, 0);
      return {
        so: { id: so.id, status: so.status, createdAt: so.createdAt },
        empresa: tenantRows[0] ?? null,
        cliente: clienteRows[0] ?? null,
        veiculo: veiculoRows[0] ?? null,
        itemsServices,
        itemsParts,
        total: totalServices + totalParts,
      };
    } finally {
      await qr.release();
    }
  }

  async approve(token: string): Promise<void> {
    const { tenant_id, so_id } = await this.lookupToken(token);
    const schemaName = this.getSchemaName(tenant_id);
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    try {
      await qr.query(`SET search_path TO "${schemaName}", public`);
      const repo = qr.manager.getRepository(ServiceOrderEntity);
      const so = await repo.findOne({ where: { id: so_id } });
      if (!so) throw new NotFoundException('OS não encontrada.');
      so.status = 'APROVADO';
      so.approvalToken = null;
      so.approvalExpiresAt = null;
      await repo.save(so);
    } finally {
      await qr.release();
    }
    await this.dataSource.query(
      `UPDATE public.service_order_approval_tokens SET used_at = NOW() WHERE token = $1`,
      [token],
    );
  }

  async reject(token: string): Promise<void> {
    const { tenant_id, so_id } = await this.lookupToken(token);
    const schemaName = this.getSchemaName(tenant_id);
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    try {
      await qr.query(`SET search_path TO "${schemaName}", public`);
      const repo = qr.manager.getRepository(ServiceOrderEntity);
      const so = await repo.findOne({ where: { id: so_id } });
      if (!so) throw new NotFoundException('OS não encontrada.');
      so.approvalToken = null;
      so.approvalExpiresAt = null;
      await repo.save(so);
    } finally {
      await qr.release();
    }
    await this.dataSource.query(
      `UPDATE public.service_order_approval_tokens SET used_at = NOW() WHERE token = $1`,
      [token],
    );
  }
}
```

**Step 2: Create `public-quotes.service.spec.ts`**

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, GoneException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { PublicQuotesService } from './public-quotes.service';
import { ServiceOrderEntity } from './service-order.entity';

const TENANT_ID = '00000000-0000-0000-0000-000000000001';
const SO_ID = '00000000-0000-0000-0000-000000000010';
const TOKEN = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

const futureDate = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
const pastDate = new Date(Date.now() - 1000).toISOString();

const mockSoRepo = {
  findOne: jest.fn(),
  save: jest.fn(),
};

const mockSoItemServiceRepo = { find: jest.fn().mockResolvedValue([]) };
const mockSoItemPartRepo = { find: jest.fn().mockResolvedValue([]) };

const mockQueryRunner = {
  connect: jest.fn().mockResolvedValue(undefined),
  query: jest.fn().mockResolvedValue([]),
  manager: {
    getRepository: jest.fn((entity: any) => {
      if (entity?.name === 'ServiceOrderEntity') return mockSoRepo;
      if (entity?.name === 'SoItemServiceEntity') return mockSoItemServiceRepo;
      return mockSoItemPartRepo;
    }),
  },
  release: jest.fn().mockResolvedValue(undefined),
};

const mockDataSource = {
  createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
  query: jest.fn(),
};

describe('PublicQuotesService', () => {
  let service: PublicQuotesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PublicQuotesService,
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();
    service = module.get<PublicQuotesService>(PublicQuotesService);
    jest.clearAllMocks();
    mockQueryRunner.query.mockResolvedValue([]);
    mockQueryRunner.manager.getRepository.mockImplementation((entity: any) => {
      if (entity?.name === 'ServiceOrderEntity') return mockSoRepo;
      if (entity?.name === 'SoItemServiceEntity') return mockSoItemServiceRepo;
      return mockSoItemPartRepo;
    });
    mockSoItemServiceRepo.find.mockResolvedValue([]);
    mockSoItemPartRepo.find.mockResolvedValue([]);
  });

  describe('getQuote', () => {
    it('should return quote data for valid token', async () => {
      const tokenRow = [{ tenant_id: TENANT_ID, so_id: SO_ID, expires_at: futureDate, used_at: null }];
      const so = { id: SO_ID, status: 'ORCAMENTO', clienteId: 'c1', veiculoId: 'v1', createdAt: new Date() };
      mockDataSource.query
        .mockResolvedValueOnce(tokenRow)  // lookupToken
        .mockResolvedValueOnce([{ nome_fantasia: 'Oficina X' }]); // tenant
      mockQueryRunner.query
        .mockResolvedValueOnce(undefined)  // SET search_path
        .mockResolvedValueOnce([{ nome: 'João' }])  // customers
        .mockResolvedValueOnce([{ placa: 'ABC1234' }]);  // vehicles
      mockSoRepo.findOne.mockResolvedValue(so);
      const result = await service.getQuote(TOKEN);
      expect(result).toHaveProperty('so');
      expect(result).toHaveProperty('total');
    });

    it('should throw NotFoundException for unknown token', async () => {
      mockDataSource.query.mockResolvedValue([]);
      await expect(service.getQuote(TOKEN)).rejects.toThrow(NotFoundException);
    });

    it('should throw GoneException for expired token', async () => {
      mockDataSource.query.mockResolvedValue([
        { tenant_id: TENANT_ID, so_id: SO_ID, expires_at: pastDate, used_at: null },
      ]);
      await expect(service.getQuote(TOKEN)).rejects.toThrow(GoneException);
    });

    it('should throw ConflictException for already used token', async () => {
      mockDataSource.query.mockResolvedValue([
        { tenant_id: TENANT_ID, so_id: SO_ID, expires_at: futureDate, used_at: new Date().toISOString() },
      ]);
      await expect(service.getQuote(TOKEN)).rejects.toThrow(ConflictException);
    });
  });

  describe('approve', () => {
    it('should set status APROVADO and mark token used', async () => {
      const tokenRow = [{ tenant_id: TENANT_ID, so_id: SO_ID, expires_at: futureDate, used_at: null }];
      const so = { id: SO_ID, status: 'ORCAMENTO', approvalToken: TOKEN, approvalExpiresAt: new Date() };
      mockDataSource.query
        .mockResolvedValueOnce(tokenRow)   // lookupToken
        .mockResolvedValueOnce(undefined); // UPDATE used_at
      mockSoRepo.findOne.mockResolvedValue(so);
      mockSoRepo.save.mockResolvedValue({ ...so, status: 'APROVADO' });
      await service.approve(TOKEN);
      expect(mockSoRepo.save).toHaveBeenCalledWith(expect.objectContaining({ status: 'APROVADO' }));
    });
  });
});
```

**Step 3: Run tests**

```bash
cd apps/backend
node "c:\Users\vinic\OneDrive\Projetos\Praktikus\node_modules\.pnpm\jest@30.3.0_@types+node@22.19.15_ts-node@10.9.2\node_modules\jest\bin\jest.js" --testPathPattern=public-quotes.service.spec
```

Expected: 5 tests passing.

**Step 4: Commit**

```bash
git add apps/backend/src/modules/workshop/service-orders/
git commit -m "feat(service-orders): add PublicQuotesService with tests"
```

---

### Task 6: Controllers + Module + registration

**Files:**
- Create: `apps/backend/src/modules/workshop/service-orders/service-orders.controller.ts`
- Create: `apps/backend/src/modules/workshop/service-orders/public-quotes.controller.ts`
- Create: `apps/backend/src/modules/workshop/service-orders/service-orders.module.ts`
- Modify: `apps/backend/src/app.module.ts`

**Step 1: Create `service-orders.controller.ts`**

```typescript
import {
  Body, Controller, Delete, Get, HttpCode, Param,
  ParseUUIDPipe, Patch, Post, Query, Request, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { RolesGuard } from '../../core/auth/roles.guard';
import { Roles } from '../../core/auth/roles.decorator';
import { UserRole } from '../../core/auth/user.entity';
import { AuthUser } from '../../core/auth/jwt.strategy';
import { ServiceOrdersService } from './service-orders.service';
import { CreateServiceOrderDto } from './dto/create-service-order.dto';
import { UpdateServiceOrderDto } from './dto/update-service-order.dto';
import { PatchStatusDto } from './dto/patch-status.dto';
import { PatchPaymentStatusDto } from './dto/patch-payment-status.dto';
import { CreateSoItemServiceDto } from './dto/create-so-item-service.dto';
import { CreateSoItemPartDto } from './dto/create-so-item-part.dto';

interface RequestWithUser extends Request {
  user: AuthUser;
}

@Controller('workshop/service-orders')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ServiceOrdersController {
  constructor(private readonly soService: ServiceOrdersService) {}

  @Get()
  list(
    @Request() req: RequestWithUser,
    @Query('status') status?: string,
    @Query('date_start') dateStart?: string,
    @Query('date_end') dateEnd?: string,
  ) {
    return this.soService.list(req.user.tenantId, { status, dateStart, dateEnd });
  }

  @Get(':id')
  getById(@Request() req: RequestWithUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.soService.getById(req.user.tenantId, id);
  }

  @Post()
  create(@Request() req: RequestWithUser, @Body() dto: CreateServiceOrderDto) {
    return this.soService.create(req.user.tenantId, dto);
  }

  @Patch(':id')
  update(
    @Request() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateServiceOrderDto,
  ) {
    return this.soService.update(req.user.tenantId, id, dto);
  }

  @Patch(':id/status')
  patchStatus(
    @Request() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PatchStatusDto,
  ) {
    return this.soService.patchStatus(req.user.tenantId, id, dto.status, req.user.role);
  }

  @Patch(':id/payment-status')
  @Roles(UserRole.OWNER)
  patchPaymentStatus(
    @Request() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PatchPaymentStatusDto,
  ) {
    return this.soService.patchPaymentStatus(req.user.tenantId, id, dto.statusPagamento);
  }

  @Post(':id/approval-token')
  generateApprovalToken(@Request() req: RequestWithUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.soService.generateApprovalToken(req.user.tenantId, id);
  }

  // Items — services
  @Post(':soId/items/services')
  addItemService(
    @Request() req: RequestWithUser,
    @Param('soId', ParseUUIDPipe) soId: string,
    @Body() dto: CreateSoItemServiceDto,
  ) {
    return this.soService.addItemService(req.user.tenantId, soId, dto);
  }

  @Delete(':soId/items/services/:itemId')
  @HttpCode(204)
  removeItemService(
    @Request() req: RequestWithUser,
    @Param('soId', ParseUUIDPipe) soId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
  ) {
    return this.soService.removeItemService(req.user.tenantId, soId, itemId);
  }

  // Items — parts
  @Post(':soId/items/parts')
  addItemPart(
    @Request() req: RequestWithUser,
    @Param('soId', ParseUUIDPipe) soId: string,
    @Body() dto: CreateSoItemPartDto,
  ) {
    return this.soService.addItemPart(req.user.tenantId, soId, dto);
  }

  @Delete(':soId/items/parts/:itemId')
  @HttpCode(204)
  removeItemPart(
    @Request() req: RequestWithUser,
    @Param('soId', ParseUUIDPipe) soId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
  ) {
    return this.soService.removeItemPart(req.user.tenantId, soId, itemId);
  }

  @Delete(':id')
  @Roles(UserRole.OWNER)
  @HttpCode(204)
  delete(@Request() req: RequestWithUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.soService.delete(req.user.tenantId, id);
  }
}
```

**Step 2: Create `public-quotes.controller.ts`**

```typescript
import { Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { PublicQuotesService } from './public-quotes.service';

@Controller('public/quotes')
export class PublicQuotesController {
  constructor(private readonly publicQuotesService: PublicQuotesService) {}

  @Get(':token')
  getQuote(@Param('token') token: string) {
    return this.publicQuotesService.getQuote(token);
  }

  @Post(':token/approve')
  @HttpCode(204)
  approve(@Param('token') token: string) {
    return this.publicQuotesService.approve(token);
  }

  @Post(':token/reject')
  @HttpCode(204)
  reject(@Param('token') token: string) {
    return this.publicQuotesService.reject(token);
  }
}
```

**Step 3: Create `service-orders.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { ServiceOrdersController } from './service-orders.controller';
import { PublicQuotesController } from './public-quotes.controller';
import { ServiceOrdersService } from './service-orders.service';
import { PublicQuotesService } from './public-quotes.service';

@Module({
  controllers: [ServiceOrdersController, PublicQuotesController],
  providers: [ServiceOrdersService, PublicQuotesService],
})
export class ServiceOrdersModule {}
```

**Step 4: Register in `app.module.ts`**

Add import and register after `AppointmentsModule`:
```typescript
import { ServiceOrdersModule } from './modules/workshop/service-orders/service-orders.module';
// ...
imports: [..., AppointmentsModule, ServiceOrdersModule],
```

**Step 5: Run all backend tests**

```bash
cd apps/backend
node "c:\Users\vinic\OneDrive\Projetos\Praktikus\node_modules\.pnpm\jest@30.3.0_@types+node@22.19.15_ts-node@10.9.2\node_modules\jest\bin\jest.js"
```

Expected: all existing tests + new tests passing.

**Step 6: Commit**

```bash
git add apps/backend/src/
git commit -m "feat(service-orders): add controllers, module, and register in AppModule"
```

---

### Task 7: Frontend service + test

**Files:**
- Create: `apps/frontend/src/services/service-orders.service.ts`
- Create: `apps/frontend/src/services/service-orders.service.test.ts`

**Step 1: Create `service-orders.service.ts`**

```typescript
import { api } from './api';
import axios from 'axios';

export type SoStatus = 'ORCAMENTO' | 'APROVADO' | 'EM_EXECUCAO' | 'AGUARDANDO_PECA' | 'FINALIZADA' | 'ENTREGUE';
export type SoPaymentStatus = 'PENDENTE' | 'PAGO';

export interface ServiceOrder {
  id: string;
  appointmentId: string | null;
  clienteId: string;
  veiculoId: string;
  status: SoStatus;
  statusPagamento: SoPaymentStatus;
  kmEntrada: string | null;
  combustivel: string | null;
  observacoesEntrada: string | null;
  approvalToken: string | null;
  approvalExpiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SoItemService {
  id: string;
  soId: string;
  catalogServiceId: string;
  nomeServico: string;
  valor: number;
  mecanicoId: string | null;
  createdAt: string;
}

export interface SoItemPart {
  id: string;
  soId: string;
  catalogPartId: string;
  nomePeca: string;
  quantidade: number;
  valorUnitario: number;
  createdAt: string;
}

export interface ServiceOrderDetail extends ServiceOrder {
  itemsServices: SoItemService[];
  itemsParts: SoItemPart[];
}

export interface CreateServiceOrderPayload {
  clienteId: string;
  veiculoId: string;
  appointmentId?: string;
  kmEntrada?: string;
  combustivel?: string;
  observacoesEntrada?: string;
}

export interface CreateSoItemServicePayload {
  catalogServiceId: string;
  nomeServico: string;
  valor: number;
  mecanicoId?: string;
}

export interface CreateSoItemPartPayload {
  catalogPartId: string;
  nomePeca: string;
  quantidade: number;
  valorUnitario: number;
}

export interface QuoteData {
  so: { id: string; status: string; createdAt: string };
  empresa: { nome_fantasia: string } | null;
  cliente: { nome: string; cpf_cnpj: string } | null;
  veiculo: { placa: string; marca: string; modelo: string; ano: number } | null;
  itemsServices: SoItemService[];
  itemsParts: SoItemPart[];
  total: number;
}

export const serviceOrdersApi = {
  async list(params?: { status?: string; date_start?: string; date_end?: string }): Promise<ServiceOrder[]> {
    const { data } = await api.get<ServiceOrder[]>('/workshop/service-orders', { params });
    return data;
  },
  async getById(id: string): Promise<ServiceOrderDetail> {
    const { data } = await api.get<ServiceOrderDetail>(`/workshop/service-orders/${id}`);
    return data;
  },
  async create(payload: CreateServiceOrderPayload): Promise<ServiceOrder> {
    const { data } = await api.post<ServiceOrder>('/workshop/service-orders', payload);
    return data;
  },
  async update(id: string, payload: Partial<CreateServiceOrderPayload>): Promise<ServiceOrder> {
    const { data } = await api.patch<ServiceOrder>(`/workshop/service-orders/${id}`, payload);
    return data;
  },
  async patchStatus(id: string, status: SoStatus): Promise<ServiceOrder> {
    const { data } = await api.patch<ServiceOrder>(`/workshop/service-orders/${id}/status`, { status });
    return data;
  },
  async patchPaymentStatus(id: string, statusPagamento: SoPaymentStatus): Promise<ServiceOrder> {
    const { data } = await api.patch<ServiceOrder>(`/workshop/service-orders/${id}/payment-status`, { statusPagamento });
    return data;
  },
  async generateApprovalToken(id: string): Promise<{ token: string; expiresAt: string }> {
    const { data } = await api.post<{ token: string; expiresAt: string }>(`/workshop/service-orders/${id}/approval-token`);
    return data;
  },
  async delete(id: string): Promise<void> {
    await api.delete(`/workshop/service-orders/${id}`);
  },
};

export const soItemsServicesApi = {
  async create(soId: string, payload: CreateSoItemServicePayload): Promise<SoItemService> {
    const { data } = await api.post<SoItemService>(`/workshop/service-orders/${soId}/items/services`, payload);
    return data;
  },
  async delete(soId: string, itemId: string): Promise<void> {
    await api.delete(`/workshop/service-orders/${soId}/items/services/${itemId}`);
  },
};

export const soItemsPartsApi = {
  async create(soId: string, payload: CreateSoItemPartPayload): Promise<SoItemPart> {
    const { data } = await api.post<SoItemPart>(`/workshop/service-orders/${soId}/items/parts`, payload);
    return data;
  },
  async delete(soId: string, itemId: string): Promise<void> {
    await api.delete(`/workshop/service-orders/${soId}/items/parts/${itemId}`);
  },
};

// Public API — no auth header (separate axios instance)
const publicApi = axios.create({ baseURL: (import.meta as any).env?.VITE_API_URL ?? 'http://localhost:3001/api' });

export const publicQuotesApi = {
  async get(token: string): Promise<QuoteData> {
    const { data } = await publicApi.get<QuoteData>(`/public/quotes/${token}`);
    return data;
  },
  async approve(token: string): Promise<void> {
    await publicApi.post(`/public/quotes/${token}/approve`);
  },
  async reject(token: string): Promise<void> {
    await publicApi.post(`/public/quotes/${token}/reject`);
  },
};
```

**Step 2: Create `service-orders.service.test.ts`**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./api', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

vi.mock('axios', () => ({
  default: { create: vi.fn(() => ({ get: vi.fn(), post: vi.fn() })) },
}));

import { serviceOrdersApi, soItemsServicesApi, soItemsPartsApi } from './service-orders.service';
import { api } from './api';

const mockApi = api as any;

describe('serviceOrdersApi', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should call GET /workshop/service-orders on list', async () => {
    mockApi.get.mockResolvedValue({ data: [] });
    await serviceOrdersApi.list();
    expect(mockApi.get).toHaveBeenCalledWith('/workshop/service-orders', expect.any(Object));
  });

  it('should call POST /workshop/service-orders on create', async () => {
    const payload = { clienteId: 'c1', veiculoId: 'v1' };
    mockApi.post.mockResolvedValue({ data: { id: 'so1', ...payload } });
    const result = await serviceOrdersApi.create(payload);
    expect(mockApi.post).toHaveBeenCalledWith('/workshop/service-orders', payload);
    expect(result.id).toBe('so1');
  });

  it('should call PATCH /workshop/service-orders/:id/status on patchStatus', async () => {
    mockApi.patch.mockResolvedValue({ data: { id: 'so1', status: 'APROVADO' } });
    const result = await serviceOrdersApi.patchStatus('so1', 'APROVADO');
    expect(mockApi.patch).toHaveBeenCalledWith('/workshop/service-orders/so1/status', { status: 'APROVADO' });
    expect(result.status).toBe('APROVADO');
  });

  it('should call DELETE /workshop/service-orders/:id on delete', async () => {
    mockApi.delete.mockResolvedValue({});
    await serviceOrdersApi.delete('so1');
    expect(mockApi.delete).toHaveBeenCalledWith('/workshop/service-orders/so1');
  });
});

describe('soItemsServicesApi', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should call POST .../items/services on create', async () => {
    const item = { id: 'i1', nomeServico: 'Troca de óleo' };
    mockApi.post.mockResolvedValue({ data: item });
    const result = await soItemsServicesApi.create('so1', { catalogServiceId: 'cs1', nomeServico: 'Troca de óleo', valor: 100 });
    expect(mockApi.post).toHaveBeenCalledWith('/workshop/service-orders/so1/items/services', expect.any(Object));
    expect(result.id).toBe('i1');
  });
});

describe('soItemsPartsApi', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should call DELETE .../items/parts/:itemId on delete', async () => {
    mockApi.delete.mockResolvedValue({});
    await soItemsPartsApi.delete('so1', 'p1');
    expect(mockApi.delete).toHaveBeenCalledWith('/workshop/service-orders/so1/items/parts/p1');
  });
});
```

**Step 3: Run frontend tests**

```bash
cd apps/frontend
npx vitest run src/services/service-orders.service.test.ts
```

Expected: 6 tests passing.

**Step 4: Commit**

```bash
git add apps/frontend/src/services/service-orders.service.ts apps/frontend/src/services/service-orders.service.test.ts
git commit -m "feat(service-orders): add frontend service with tests"
```

---

### Task 8: ServiceOrdersPage (list + create dialog)

**Files:**
- Create: `apps/frontend/src/pages/workshop/service-orders/CreateServiceOrderDialog.tsx`
- Create: `apps/frontend/src/pages/workshop/service-orders/ServiceOrdersPage.tsx`

**Step 1: Create `CreateServiceOrderDialog.tsx`**

```tsx
import { useEffect, useState } from 'react';
import {
  Autocomplete, Box, Button, Dialog, DialogActions,
  DialogContent, DialogTitle, TextField,
} from '@mui/material';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { serviceOrdersApi, type CreateServiceOrderPayload } from '../../../services/service-orders.service';
import { customersService, type Customer } from '../../../services/customers.service';
import { vehiclesService, type Vehicle } from '../../../services/vehicles.service';
import { appointmentsApi, type Appointment } from '../../../services/appointments.service';

const schema = z.object({
  clienteId: z.string().uuid('Selecione um cliente'),
  veiculoId: z.string().uuid('Selecione um veículo'),
  appointmentId: z.string().uuid().optional().or(z.literal('')),
  kmEntrada: z.string().optional(),
  combustivel: z.string().optional(),
  observacoesEntrada: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export function CreateServiceOrderDialog({ open, onClose, onSaved }: Props) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [saving, setSaving] = useState(false);

  const { control, register, handleSubmit, watch, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { clienteId: '', veiculoId: '', appointmentId: '' },
  });

  const selectedClienteId = watch('clienteId');

  useEffect(() => {
    if (!open) return;
    customersService.list({ limit: 200 }).then((r) => setCustomers(r.data));
  }, [open]);

  useEffect(() => {
    if (!selectedClienteId) { setVehicles([]); setAppointments([]); return; }
    Promise.all([
      vehiclesService.list({ limit: 200 }),
      appointmentsApi.list(),
    ]).then(([vRes, aRes]) => {
      setVehicles(vRes.data.filter((v) => v.customerId === selectedClienteId));
      setAppointments(aRes.filter((a) => a.clienteId === selectedClienteId));
    });
  }, [selectedClienteId]);

  useEffect(() => {
    if (!open) reset({ clienteId: '', veiculoId: '', appointmentId: '' });
  }, [open, reset]);

  const onSubmit = async (values: FormData) => {
    setSaving(true);
    try {
      const payload: CreateServiceOrderPayload = {
        clienteId: values.clienteId,
        veiculoId: values.veiculoId,
        ...(values.appointmentId ? { appointmentId: values.appointmentId } : {}),
        kmEntrada: values.kmEntrada || undefined,
        combustivel: values.combustivel || undefined,
        observacoesEntrada: values.observacoesEntrada || undefined,
      };
      await serviceOrdersApi.create(payload);
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Nova Ordem de Serviço</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <Controller
            name="clienteId"
            control={control}
            render={({ field }) => (
              <Autocomplete
                options={customers}
                getOptionLabel={(c) => `${c.nome} — ${c.cpfCnpj}`}
                value={customers.find((c) => c.id === field.value) ?? null}
                onChange={(_, v) => field.onChange(v?.id ?? '')}
                renderInput={(params) => (
                  <TextField {...params} label="Cliente" error={!!errors.clienteId} helperText={errors.clienteId?.message} />
                )}
              />
            )}
          />
          <Controller
            name="veiculoId"
            control={control}
            render={({ field }) => (
              <Autocomplete
                options={vehicles}
                getOptionLabel={(v) => `${v.placa} — ${v.modelo}`}
                value={vehicles.find((v) => v.id === field.value) ?? null}
                onChange={(_, v) => field.onChange(v?.id ?? '')}
                disabled={!selectedClienteId}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Veículo"
                    error={!!errors.veiculoId}
                    helperText={errors.veiculoId?.message ?? (!selectedClienteId ? 'Selecione o cliente primeiro' : '')}
                  />
                )}
              />
            )}
          />
          <Controller
            name="appointmentId"
            control={control}
            render={({ field }) => (
              <Autocomplete
                options={appointments}
                getOptionLabel={(a) => `${new Date(a.dataHora).toLocaleString('pt-BR')} — ${a.tipoServico ?? 'Sem tipo'}`}
                value={appointments.find((a) => a.id === field.value) ?? null}
                onChange={(_, v) => field.onChange(v?.id ?? '')}
                disabled={!selectedClienteId}
                renderInput={(params) => (
                  <TextField {...params} label="Agendamento (opcional)" />
                )}
              />
            )}
          />
          <TextField label="KM de Entrada" {...register('kmEntrada')} />
          <TextField label="Combustível" {...register('combustivel')} placeholder="ex: 1/2, Cheio..." />
          <TextField label="Observações de Entrada" {...register('observacoesEntrada')} multiline rows={3} />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button variant="contained" onClick={handleSubmit(onSubmit)} disabled={saving}>
          {saving ? 'Criando...' : 'Criar OS'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
```

**Step 2: Create `ServiceOrdersPage.tsx`**

```tsx
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Button, Chip, IconButton, Paper, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { serviceOrdersApi, type ServiceOrder, type SoStatus } from '../../../services/service-orders.service';
import { useAuthStore } from '../../../store/auth.store';
import { CreateServiceOrderDialog } from './CreateServiceOrderDialog';

const STATUS_LABEL: Record<SoStatus, string> = {
  ORCAMENTO: 'Orçamento',
  APROVADO: 'Aprovado',
  EM_EXECUCAO: 'Em Execução',
  AGUARDANDO_PECA: 'Aguard. Peça',
  FINALIZADA: 'Finalizada',
  ENTREGUE: 'Entregue',
};

const STATUS_COLOR: Record<SoStatus, 'default' | 'warning' | 'info' | 'primary' | 'secondary' | 'success' | 'error'> = {
  ORCAMENTO: 'default',
  APROVADO: 'info',
  EM_EXECUCAO: 'primary',
  AGUARDANDO_PECA: 'warning',
  FINALIZADA: 'secondary',
  ENTREGUE: 'success',
};

export function ServiceOrdersPage() {
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const isOwner = user?.role === 'OWNER';

  const load = useCallback(async () => {
    const data = await serviceOrdersApi.list();
    setOrders(data);
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5">Ordens de Serviço</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>
          Nova OS
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Data</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Pagamento</TableCell>
              <TableCell>KM</TableCell>
              <TableCell align="right">Ações</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {orders.map((so) => (
              <TableRow key={so.id} hover>
                <TableCell>{new Date(so.createdAt).toLocaleDateString('pt-BR')}</TableCell>
                <TableCell>
                  <Chip
                    label={STATUS_LABEL[so.status]}
                    color={STATUS_COLOR[so.status]}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  <Chip
                    label={so.statusPagamento}
                    color={so.statusPagamento === 'PAGO' ? 'success' : 'default'}
                    size="small"
                    variant="outlined"
                  />
                </TableCell>
                <TableCell>{so.kmEntrada ?? '—'}</TableCell>
                <TableCell align="right">
                  <IconButton size="small" onClick={() => navigate(`/workshop/service-orders/${so.id}`)}>
                    <OpenInNewIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            {orders.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} align="center">Nenhuma OS encontrada.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <CreateServiceOrderDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSaved={load}
      />
    </Box>
  );
}
```

**Step 3: Check TypeScript**

```bash
cd apps/frontend && npx tsc --noEmit
```

Expected: no errors.

**Step 4: Commit**

```bash
git add apps/frontend/src/pages/workshop/service-orders/
git commit -m "feat(service-orders): add ServiceOrdersPage with list and create dialog"
```

---

### Task 9: ServiceOrderDetailPage

**Files:**
- Create: `apps/frontend/src/pages/workshop/service-orders/ServiceOrderDetailPage.tsx`

```tsx
import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress,
  Dialog, DialogActions, DialogContent, DialogTitle, Divider,
  IconButton, Stack, Table, TableBody, TableCell, TableHead,
  TableRow, TextField, Tooltip, Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import {
  serviceOrdersApi, soItemsServicesApi, soItemsPartsApi,
  type ServiceOrderDetail, type SoStatus, type SoItemService, type SoItemPart,
} from '../../../services/service-orders.service';
import { useAuthStore } from '../../../store/auth.store';
import { customersService, type Customer } from '../../../services/customers.service';
import { vehiclesService, type Vehicle } from '../../../services/vehicles.service';
import { catalogApi, type CatalogService, type CatalogPart } from '../../../services/catalog.service';

// ---------- helpers ----------
const STATUS_LABEL: Record<SoStatus, string> = {
  ORCAMENTO: 'Orçamento', APROVADO: 'Aprovado', EM_EXECUCAO: 'Em Execução',
  AGUARDANDO_PECA: 'Aguard. Peça', FINALIZADA: 'Finalizada', ENTREGUE: 'Entregue',
};
const NEXT_STATUSES: Partial<Record<SoStatus, SoStatus[]>> = {
  ORCAMENTO: ['APROVADO'],
  APROVADO: ['EM_EXECUCAO'],
  EM_EXECUCAO: ['AGUARDANDO_PECA', 'FINALIZADA'],
  AGUARDANDO_PECA: ['EM_EXECUCAO'],
  FINALIZADA: ['ENTREGUE'],
};

// ---------- add item dialogs ----------
interface AddServiceDialogProps {
  open: boolean;
  soId: string;
  services: CatalogService[];
  onClose: () => void;
  onSaved: () => void;
}

function AddServiceDialog({ open, soId, services, onClose, onSaved }: AddServiceDialogProps) {
  const [serviceId, setServiceId] = useState('');
  const [nome, setNome] = useState('');
  const [valor, setValor] = useState('');
  const [mecanicoId, setMecanicoId] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!serviceId || !nome || !valor) return;
    setSaving(true);
    try {
      await soItemsServicesApi.create(soId, { catalogServiceId: serviceId, nomeServico: nome, valor: Number(valor), mecanicoId: mecanicoId || undefined });
      onSaved(); onClose();
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Adicionar Serviço</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <TextField select label="Serviço" value={serviceId} onChange={(e) => {
            const s = services.find((x) => x.id === e.target.value);
            setServiceId(e.target.value); setNome(s?.nome ?? ''); setValor(String(s?.precoPadrao ?? ''));
          }} SelectProps={{ native: true }}>
            <option value="" />
            {services.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
          </TextField>
          <TextField label="Nome do Serviço" value={nome} onChange={(e) => setNome(e.target.value)} />
          <TextField label="Valor (R$)" type="number" value={valor} onChange={(e) => setValor(e.target.value)} />
          <TextField label="ID do Mecânico (opcional)" value={mecanicoId} onChange={(e) => setMecanicoId(e.target.value)} />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving}>Adicionar</Button>
      </DialogActions>
    </Dialog>
  );
}

interface AddPartDialogProps {
  open: boolean;
  soId: string;
  parts: CatalogPart[];
  onClose: () => void;
  onSaved: () => void;
}

function AddPartDialog({ open, soId, parts, onClose, onSaved }: AddPartDialogProps) {
  const [partId, setPartId] = useState('');
  const [nome, setNome] = useState('');
  const [quantidade, setQuantidade] = useState('1');
  const [valorUnitario, setValorUnitario] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!partId || !nome || !valorUnitario) return;
    setSaving(true);
    try {
      await soItemsPartsApi.create(soId, { catalogPartId: partId, nomePeca: nome, quantidade: Number(quantidade), valorUnitario: Number(valorUnitario) });
      onSaved(); onClose();
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Adicionar Peça</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <TextField select label="Peça" value={partId} onChange={(e) => {
            const p = parts.find((x) => x.id === e.target.value);
            setPartId(e.target.value); setNome(p?.nome ?? ''); setValorUnitario(String(p?.precoUnitario ?? ''));
          }} SelectProps={{ native: true }}>
            <option value="" />
            {parts.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </TextField>
          <TextField label="Nome da Peça" value={nome} onChange={(e) => setNome(e.target.value)} />
          <TextField label="Quantidade" type="number" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} />
          <TextField label="Valor Unitário (R$)" type="number" value={valorUnitario} onChange={(e) => setValorUnitario(e.target.value)} />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving}>Adicionar</Button>
      </DialogActions>
    </Dialog>
  );
}

// ---------- main page ----------
export function ServiceOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const isOwner = user?.role === 'OWNER';

  const [so, setSo] = useState<ServiceOrderDetail | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [catalogServices, setCatalogServices] = useState<CatalogService[]>([]);
  const [catalogParts, setCatalogParts] = useState<CatalogPart[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addServiceOpen, setAddServiceOpen] = useState(false);
  const [addPartOpen, setAddPartOpen] = useState(false);
  const [approvalLink, setApprovalLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Checklist edit state
  const [km, setKm] = useState('');
  const [combustivel, setCombustivel] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [savingChecklist, setSavingChecklist] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const data = await serviceOrdersApi.getById(id);
      setSo(data);
      setKm(data.kmEntrada ?? '');
      setCombustivel(data.combustivel ?? '');
      setObservacoes(data.observacoesEntrada ?? '');
      const [cust, veh, svcs, prts] = await Promise.all([
        customersService.getById(data.clienteId).catch(() => null),
        vehiclesService.getById(data.veiculoId).catch(() => null),
        catalogApi.listServices({ limit: 200 }),
        catalogApi.listParts({ limit: 200 }),
      ]);
      setCustomer(cust);
      setVehicle(veh);
      setCatalogServices(svcs.data);
      setCatalogParts(prts.data);
    } catch {
      setError('Erro ao carregar OS.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleTransition = async (newStatus: SoStatus) => {
    if (!id) return;
    await serviceOrdersApi.patchStatus(id, newStatus);
    await load();
  };

  const handleTogglePayment = async () => {
    if (!id || !so) return;
    await serviceOrdersApi.patchPaymentStatus(id, so.statusPagamento === 'PAGO' ? 'PENDENTE' : 'PAGO');
    await load();
  };

  const handleSaveChecklist = async () => {
    if (!id) return;
    setSavingChecklist(true);
    try {
      await serviceOrdersApi.update(id, { kmEntrada: km, combustivel, observacoesEntrada: observacoes });
      await load();
    } finally { setSavingChecklist(false); }
  };

  const handleGenerateLink = async () => {
    if (!id) return;
    const { token } = await serviceOrdersApi.generateApprovalToken(id);
    const link = `${window.location.origin}/quotes/${token}`;
    setApprovalLink(link);
    await load();
  };

  const handleCopy = () => {
    if (!approvalLink) return;
    navigator.clipboard.writeText(approvalLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRemoveService = async (itemId: string) => {
    if (!id) return;
    await soItemsServicesApi.delete(id, itemId);
    await load();
  };

  const handleRemovePart = async (itemId: string) => {
    if (!id) return;
    await soItemsPartsApi.delete(id, itemId);
    await load();
  };

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}><CircularProgress /></Box>;
  if (error || !so) return <Alert severity="error">{error ?? 'OS não encontrada.'}</Alert>;

  const totalServices = so.itemsServices.reduce((s, i) => s + Number(i.valor), 0);
  const totalParts = so.itemsParts.reduce((s, i) => s + Number(i.valorUnitario) * i.quantidade, 0);
  const total = totalServices + totalParts;
  const nextStatuses = NEXT_STATUSES[so.status] ?? [];
  const isFinal = so.status === 'ENTREGUE';

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <IconButton onClick={() => navigate('/workshop/service-orders')}><ArrowBackIcon /></IconButton>
        <Typography variant="h5" sx={{ flex: 1 }}>Ordem de Serviço</Typography>
        <Chip label={STATUS_LABEL[so.status]} color="primary" />
        <Chip
          label={so.statusPagamento}
          color={so.statusPagamento === 'PAGO' ? 'success' : 'default'}
          variant="outlined"
          onClick={isOwner ? handleTogglePayment : undefined}
          sx={{ cursor: isOwner ? 'pointer' : 'default' }}
        />
      </Box>

      {/* Transition buttons */}
      {nextStatuses.length > 0 && (
        <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
          {nextStatuses.map((s) => (
            <Button key={s} variant="outlined" onClick={() => handleTransition(s)}>
              → {STATUS_LABEL[s]}
            </Button>
          ))}
        </Stack>
      )}

      {/* Dados */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight="bold" gutterBottom>Dados</Typography>
          <Typography>Cliente: {customer?.nome ?? so.clienteId}</Typography>
          <Typography>Veículo: {vehicle ? `${vehicle.placa} — ${vehicle.modelo}` : so.veiculoId}</Typography>
          {so.appointmentId && <Typography>Agendamento: {so.appointmentId}</Typography>}
          <Typography variant="caption" color="text.secondary">
            Criado em: {new Date(so.createdAt).toLocaleString('pt-BR')}
          </Typography>
        </CardContent>
      </Card>

      {/* Checklist */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight="bold" gutterBottom>Checklist de Entrada</Typography>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 2 }}>
            <TextField label="KM de Entrada" value={km} onChange={(e) => setKm(e.target.value)} disabled={isFinal} size="small" />
            <TextField label="Combustível" value={combustivel} onChange={(e) => setCombustivel(e.target.value)} disabled={isFinal} size="small" />
          </Box>
          <TextField
            label="Observações / Avarias"
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            disabled={isFinal}
            multiline rows={3} fullWidth sx={{ mb: 1 }}
          />
          {!isFinal && (
            <Button variant="outlined" size="small" onClick={handleSaveChecklist} disabled={savingChecklist}>
              {savingChecklist ? 'Salvando...' : 'Salvar Checklist'}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Serviços */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="subtitle1" fontWeight="bold">Serviços</Typography>
            {!isFinal && (
              <Button size="small" onClick={() => setAddServiceOpen(true)}>+ Adicionar</Button>
            )}
          </Box>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Serviço</TableCell>
                <TableCell>Mecânico</TableCell>
                <TableCell align="right">Valor</TableCell>
                {!isFinal && <TableCell />}
              </TableRow>
            </TableHead>
            <TableBody>
              {so.itemsServices.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.nomeServico}</TableCell>
                  <TableCell>{item.mecanicoId ?? '—'}</TableCell>
                  <TableCell align="right">R$ {Number(item.valor).toFixed(2)}</TableCell>
                  {!isFinal && (
                    <TableCell align="right">
                      <Button size="small" color="error" onClick={() => handleRemoveService(item.id)}>Remover</Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {so.itemsServices.length === 0 && (
                <TableRow><TableCell colSpan={4} align="center">Nenhum serviço.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Peças */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="subtitle1" fontWeight="bold">Peças</Typography>
            {!isFinal && (
              <Button size="small" onClick={() => setAddPartOpen(true)}>+ Adicionar</Button>
            )}
          </Box>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Peça</TableCell>
                <TableCell align="right">Qtd</TableCell>
                <TableCell align="right">Valor Unit.</TableCell>
                <TableCell align="right">Subtotal</TableCell>
                {!isFinal && <TableCell />}
              </TableRow>
            </TableHead>
            <TableBody>
              {so.itemsParts.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.nomePeca}</TableCell>
                  <TableCell align="right">{item.quantidade}</TableCell>
                  <TableCell align="right">R$ {Number(item.valorUnitario).toFixed(2)}</TableCell>
                  <TableCell align="right">R$ {(Number(item.valorUnitario) * item.quantidade).toFixed(2)}</TableCell>
                  {!isFinal && (
                    <TableCell align="right">
                      <Button size="small" color="error" onClick={() => handleRemovePart(item.id)}>Remover</Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {so.itemsParts.length === 0 && (
                <TableRow><TableCell colSpan={5} align="center">Nenhuma peça.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Total */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight="bold">Total</Typography>
          <Divider sx={{ my: 1 }} />
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography>Serviços</Typography>
            <Typography>R$ {totalServices.toFixed(2)}</Typography>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography>Peças</Typography>
            <Typography>R$ {totalParts.toFixed(2)}</Typography>
          </Box>
          <Divider sx={{ my: 1 }} />
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="h6">Total</Typography>
            <Typography variant="h6">R$ {total.toFixed(2)}</Typography>
          </Box>
        </CardContent>
      </Card>

      {/* Aprovação */}
      {so.status === 'ORCAMENTO' && (
        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Typography variant="subtitle1" fontWeight="bold" gutterBottom>Link de Aprovação</Typography>
            {so.approvalToken && so.approvalExpiresAt && !approvalLink && (
              <Alert severity="info" sx={{ mb: 1 }}>
                Token ativo até {new Date(so.approvalExpiresAt).toLocaleString('pt-BR')}
              </Alert>
            )}
            <Stack direction="row" spacing={1} alignItems="center">
              <Button variant="outlined" onClick={handleGenerateLink}>
                {so.approvalToken ? 'Gerar novo link' : 'Gerar link de aprovação'}
              </Button>
              {approvalLink && (
                <Tooltip title={copied ? 'Copiado!' : 'Copiar link'}>
                  <IconButton onClick={handleCopy}><ContentCopyIcon /></IconButton>
                </Tooltip>
              )}
            </Stack>
            {approvalLink && (
              <Typography variant="body2" sx={{ mt: 1, wordBreak: 'break-all', color: 'text.secondary' }}>
                {approvalLink}
              </Typography>
            )}
          </CardContent>
        </Card>
      )}

      {/* Dialogs */}
      <AddServiceDialog
        open={addServiceOpen}
        soId={so.id}
        services={catalogServices}
        onClose={() => setAddServiceOpen(false)}
        onSaved={load}
      />
      <AddPartDialog
        open={addPartOpen}
        soId={so.id}
        parts={catalogParts}
        onClose={() => setAddPartOpen(false)}
        onSaved={load}
      />
    </Box>
  );
}
```

**Step 2: Check TypeScript**

```bash
cd apps/frontend && npx tsc --noEmit
```

Expected: no errors. If `customersService.getById` or `vehiclesService.getById` don't exist, check their service files and use the correct method names.

**Step 3: Commit**

```bash
git add apps/frontend/src/pages/workshop/service-orders/ServiceOrderDetailPage.tsx
git commit -m "feat(service-orders): add ServiceOrderDetailPage"
```

---

### Task 10: QuoteApprovalPage + App.tsx routing

**Files:**
- Create: `apps/frontend/src/pages/public/QuoteApprovalPage.tsx`
- Modify: `apps/frontend/src/App.tsx`

**Step 1: Create `QuoteApprovalPage.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Alert, Box, Button, Card, CardContent, CircularProgress,
  Divider, Stack, Table, TableBody, TableCell, TableHead,
  TableRow, Typography,
} from '@mui/material';
import { publicQuotesApi, type QuoteData } from '../../services/service-orders.service';

export function QuoteApprovalPage() {
  const { token } = useParams<{ token: string }>();
  const [quote, setQuote] = useState<QuoteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [done, setDone] = useState<'approved' | 'rejected' | null>(null);
  const [acting, setActing] = useState(false);

  useEffect(() => {
    if (!token) return;
    publicQuotesApi.get(token)
      .then(setQuote)
      .catch((err) => {
        if (err.response?.status === 410) setErrorMsg('Este link expirou. Solicite um novo orçamento.');
        else if (err.response?.status === 409) setErrorMsg('Este link já foi utilizado.');
        else setErrorMsg('Link inválido ou indisponível.');
      })
      .finally(() => setLoading(false));
  }, [token]);

  const handleApprove = async () => {
    if (!token) return;
    setActing(true);
    try {
      await publicQuotesApi.approve(token);
      setDone('approved');
    } finally { setActing(false); }
  };

  const handleReject = async () => {
    if (!token) return;
    setActing(true);
    try {
      await publicQuotesApi.reject(token);
      setDone('rejected');
    } finally { setActing(false); }
  };

  if (loading) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
      <CircularProgress />
    </Box>
  );

  if (errorMsg) return (
    <Box sx={{ maxWidth: 600, mx: 'auto', mt: 8, p: 2 }}>
      <Alert severity="error">{errorMsg}</Alert>
    </Box>
  );

  if (done) return (
    <Box sx={{ maxWidth: 600, mx: 'auto', mt: 8, p: 2 }}>
      <Alert severity={done === 'approved' ? 'success' : 'info'}>
        {done === 'approved'
          ? 'Orçamento aprovado com sucesso! A equipe entrará em contato.'
          : 'Orçamento recusado. Entraremos em contato para discutir alternativas.'}
      </Alert>
    </Box>
  );

  if (!quote) return null;

  const total = quote.total;

  return (
    <Box sx={{ maxWidth: 700, mx: 'auto', mt: 4, p: 2 }}>
      <Typography variant="h5" gutterBottom>
        {quote.empresa?.nome_fantasia ?? 'Orçamento'}
      </Typography>
      <Typography variant="body2" color="text.secondary" gutterBottom>
        Orçamento criado em {new Date(quote.so.createdAt).toLocaleDateString('pt-BR')}
      </Typography>

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight="bold">Cliente</Typography>
          <Typography>{quote.cliente?.nome ?? '—'}</Typography>
          <Divider sx={{ my: 1 }} />
          <Typography variant="subtitle1" fontWeight="bold">Veículo</Typography>
          <Typography>
            {quote.veiculo ? `${quote.veiculo.placa} — ${quote.veiculo.marca} ${quote.veiculo.modelo} (${quote.veiculo.ano})` : '—'}
          </Typography>
        </CardContent>
      </Card>

      {quote.itemsServices.length > 0 && (
        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Typography variant="subtitle1" fontWeight="bold" gutterBottom>Serviços</Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Descrição</TableCell>
                  <TableCell align="right">Valor</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {quote.itemsServices.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell>{i.nomeServico}</TableCell>
                    <TableCell align="right">R$ {Number(i.valor).toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {quote.itemsParts.length > 0 && (
        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Typography variant="subtitle1" fontWeight="bold" gutterBottom>Peças</Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Peça</TableCell>
                  <TableCell align="right">Qtd</TableCell>
                  <TableCell align="right">Valor Unit.</TableCell>
                  <TableCell align="right">Subtotal</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {quote.itemsParts.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell>{i.nomePeca}</TableCell>
                    <TableCell align="right">{i.quantidade}</TableCell>
                    <TableCell align="right">R$ {Number(i.valorUnitario).toFixed(2)}</TableCell>
                    <TableCell align="right">R$ {(Number(i.valorUnitario) * i.quantidade).toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="h6">Total</Typography>
            <Typography variant="h6">R$ {total.toFixed(2)}</Typography>
          </Box>
        </CardContent>
      </Card>

      <Stack direction="row" spacing={2}>
        <Button variant="contained" color="success" size="large" onClick={handleApprove} disabled={acting} fullWidth>
          Aprovar Orçamento
        </Button>
        <Button variant="outlined" color="inherit" size="large" onClick={handleReject} disabled={acting} fullWidth>
          Recusar
        </Button>
      </Stack>
    </Box>
  );
}
```

**Step 2: Update `App.tsx`**

Add import and two new routes:

```typescript
import { ServiceOrdersPage } from './pages/workshop/service-orders/ServiceOrdersPage';
import { ServiceOrderDetailPage } from './pages/workshop/service-orders/ServiceOrderDetailPage';
import { QuoteApprovalPage } from './pages/public/QuoteApprovalPage';
```

Inside `<Routes>`, before the `/workshop` route, add the public route:
```tsx
<Route path="/quotes/:token" element={<QuoteApprovalPage />} />
```

Inside the `/workshop` nested routes, after `appointments`:
```tsx
<Route path="service-orders" element={<ServiceOrdersPage />} />
<Route path="service-orders/:id" element={<ServiceOrderDetailPage />} />
```

**Step 3: Check TypeScript + run all frontend tests**

```bash
cd apps/frontend
npx tsc --noEmit
npx vitest run
```

Expected: no TypeScript errors, all tests passing.

**Step 4: Commit**

```bash
git add apps/frontend/src/
git commit -m "feat(service-orders): add QuoteApprovalPage and register all routes"
```

---

### Task 11: Final verification

**Step 1: Run all backend tests**

```bash
cd apps/backend
node "c:\Users\vinic\OneDrive\Projetos\Praktikus\node_modules\.pnpm\jest@30.3.0_@types+node@22.19.15_ts-node@10.9.2\node_modules\jest\bin\jest.js"
```

Expected: all test suites passing (existing 14 + 2 new = 16 suites).

**Step 2: Final commit with summary**

```bash
git add .
git commit -m "feat(service-orders): complete Entrega 6 — OS module with state machine, items, approval link, and public approval page"
```
