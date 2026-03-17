# Entrega 5: Agendamentos — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement full CRUD for appointments with conflict alert, comment timeline, weekly calendar view, and paginated list view.

**Architecture:** AppointmentsModule in `workshop/appointments/` following the same `withSchema<T>` pattern as CatalogModule (DataSource injection, QueryRunner, UUID validation). Frontend AppointmentsPage with toggle between weekly calendar and list views, plus modal form dialog and detail drawer.

**Tech Stack:** NestJS 10 + TypeORM (backend), React 18 + MUI v5 + react-hook-form + zod (frontend). Same patterns as Entrega 4 (`catalog`).

---

## Context

- Design doc: `docs/plans/2026-03-17-entrega-5-agendamentos-design.md`
- Pattern reference: `apps/backend/src/modules/workshop/catalog/catalog-services.service.ts` (withSchema, getSchemaName)
- Pattern reference: `apps/backend/src/modules/workshop/catalog/catalog-services.service.spec.ts` (test mock structure)
- Frontend pattern: `apps/frontend/src/pages/workshop/catalog/CatalogPage.tsx`
- Sidebar navigation for `/workshop/appointments` already exists in `apps/frontend/src/layouts/AppLayout.tsx`

---

## Task 1: DB Migration — Add appointments tables

**Files:**
- Modify: `apps/backend/src/database/tenant-migrations/create-tenant-tables.ts`

**Step 1: Add two new SQL statements to `createTenantTablesSql`**

Add after the `catalog_parts` entry (before the closing `]`):

```typescript
    `CREATE TABLE IF NOT EXISTS "${schemaName}".appointments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      cliente_id UUID NOT NULL,
      veiculo_id UUID NOT NULL,
      data_hora TIMESTAMPTZ NOT NULL,
      duracao_min INT NOT NULL DEFAULT 60,
      tipo_servico VARCHAR,
      status VARCHAR NOT NULL DEFAULT 'PENDENTE',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS "${schemaName}".appointment_comments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      appointment_id UUID NOT NULL
        REFERENCES "${schemaName}".appointments(id) ON DELETE CASCADE,
      texto VARCHAR NOT NULL,
      created_by_id UUID NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
```

**Step 2: Verify the file looks correct**

```bash
cat apps/backend/src/database/tenant-migrations/create-tenant-tables.ts
```

Expected: 6 `CREATE TABLE IF NOT EXISTS` statements total.

**Step 3: Commit**

```bash
git add apps/backend/src/database/tenant-migrations/create-tenant-tables.ts
git commit -m "feat(db): add appointments and appointment_comments tenant tables"
```

---

## Task 2: Backend Entities + DTOs

**Files:**
- Create: `apps/backend/src/modules/workshop/appointments/appointment.entity.ts`
- Create: `apps/backend/src/modules/workshop/appointments/appointment-comment.entity.ts`
- Create: `apps/backend/src/modules/workshop/appointments/dto/create-appointment.dto.ts`
- Create: `apps/backend/src/modules/workshop/appointments/dto/update-appointment.dto.ts`
- Create: `apps/backend/src/modules/workshop/appointments/dto/create-appointment-comment.dto.ts`

**Step 1: Create `appointment.entity.ts`**

```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'appointments' })
export class AppointmentEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'cliente_id' })
  clienteId: string;

  @Column({ name: 'veiculo_id' })
  veiculoId: string;

  @Column({ name: 'data_hora', type: 'timestamptz' })
  dataHora: Date;

  @Column({ name: 'duracao_min', default: 60 })
  duracaoMin: number;

  @Column({ name: 'tipo_servico', nullable: true })
  tipoServico: string | null;

  @Column({ default: 'PENDENTE' })
  status: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
```

**Step 2: Create `appointment-comment.entity.ts`**

```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity({ name: 'appointment_comments' })
export class AppointmentCommentEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'appointment_id' })
  appointmentId: string;

  @Column()
  texto: string;

  @Column({ name: 'created_by_id' })
  createdById: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
```

**Step 3: Create `dto/create-appointment.dto.ts`**

```typescript
import {
  IsDateString, IsIn, IsInt, IsOptional, IsString, IsUUID, Min,
} from 'class-validator';

export class CreateAppointmentDto {
  @IsUUID()
  clienteId: string;

  @IsUUID()
  veiculoId: string;

  @IsDateString()
  dataHora: string;

  @IsOptional()
  @IsInt()
  @Min(15)
  duracaoMin?: number;

  @IsOptional()
  @IsString()
  tipoServico?: string;

  @IsOptional()
  @IsIn(['PENDENTE', 'CONFIRMADO', 'CONCLUIDO', 'CANCELADO'])
  status?: string;
}
```

**Step 4: Create `dto/update-appointment.dto.ts`**

```typescript
import { PartialType } from '@nestjs/mapped-types';
import { CreateAppointmentDto } from './create-appointment.dto';

export class UpdateAppointmentDto extends PartialType(CreateAppointmentDto) {}
```

**Step 5: Create `dto/create-appointment-comment.dto.ts`**

```typescript
import { IsString, MinLength } from 'class-validator';

export class CreateAppointmentCommentDto {
  @IsString()
  @MinLength(1)
  texto: string;
}
```

**Step 6: Commit**

```bash
git add apps/backend/src/modules/workshop/appointments/
git commit -m "feat(appointments): add entities and DTOs"
```

---

## Task 3: AppointmentsService + Tests

**Files:**
- Create: `apps/backend/src/modules/workshop/appointments/appointments.service.ts`
- Create: `apps/backend/src/modules/workshop/appointments/appointments.service.spec.ts`

**Step 1: Write the failing test first**

Create `appointments.service.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AppointmentsService } from './appointments.service';
import { AppointmentEntity } from './appointment.entity';

const TENANT_ID = '00000000-0000-0000-0000-000000000001';

const mockQb = {
  andWhere: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  getMany: jest.fn(),
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
  query: jest.fn().mockResolvedValue([]),
  manager: { getRepository: jest.fn().mockReturnValue(mockRepo) },
  release: jest.fn().mockResolvedValue(undefined),
};

const mockDataSource = {
  createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
};

describe('AppointmentsService', () => {
  let service: AppointmentsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppointmentsService,
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();
    service = module.get<AppointmentsService>(AppointmentsService);
    jest.clearAllMocks();
    mockQueryRunner.manager.getRepository.mockReturnValue(mockRepo);
    mockRepo.createQueryBuilder.mockReturnValue(mockQb);
    mockQb.andWhere.mockReturnThis();
    mockQb.orderBy.mockReturnThis();
    mockQueryRunner.query.mockResolvedValue([]);
  });

  describe('list', () => {
    it('should return appointments and set search_path', async () => {
      const items = [{ id: 'a1', status: 'PENDENTE' }];
      mockQb.getMany.mockResolvedValue(items);

      const result = await service.list(TENANT_ID, {});

      expect(result).toEqual(items);
      expect(mockQueryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining('SET search_path'),
      );
    });

    it('should apply dateStart filter when provided', async () => {
      mockQb.getMany.mockResolvedValue([]);

      await service.list(TENANT_ID, { dateStart: '2026-03-17T00:00:00Z' });

      expect(mockQb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('dateStart'),
        expect.any(Object),
      );
    });
  });

  describe('getById', () => {
    it('should return appointment when found', async () => {
      const item = { id: 'a1', status: 'PENDENTE' };
      mockRepo.findOne.mockResolvedValue(item);

      const result = await service.getById(TENANT_ID, 'a1');

      expect(result).toEqual(item);
    });

    it('should throw NotFoundException when not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.getById(TENANT_ID, 'nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create appointment and return data with conflicts', async () => {
      const dto = {
        clienteId: '00000000-0000-0000-0000-000000000002',
        veiculoId: '00000000-0000-0000-0000-000000000003',
        dataHora: '2026-03-17T09:00:00Z',
        duracaoMin: 60,
      };
      const created = { id: 'a1', ...dto };
      mockRepo.create.mockReturnValue(created);
      mockRepo.save.mockResolvedValue(created);
      mockQueryRunner.query.mockResolvedValueOnce(undefined) // SET search_path
        .mockResolvedValueOnce([]); // conflicts query

      const result = await service.create(TENANT_ID, dto as any);

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('conflicts');
      expect(result.conflicts).toEqual([]);
    });

    it('should return conflicts when overlapping appointment exists', async () => {
      const dto = {
        clienteId: '00000000-0000-0000-0000-000000000002',
        veiculoId: '00000000-0000-0000-0000-000000000003',
        dataHora: '2026-03-17T09:00:00Z',
        duracaoMin: 60,
      };
      const conflict = { id: 'a2', data_hora: '2026-03-17T09:30:00Z', tipo_servico: 'Troca de óleo' };
      const created = { id: 'a1' };
      mockRepo.create.mockReturnValue(created);
      mockRepo.save.mockResolvedValue(created);
      mockQueryRunner.query
        .mockResolvedValueOnce(undefined)   // SET search_path
        .mockResolvedValueOnce([conflict]); // conflicts query

      const result = await service.create(TENANT_ID, dto as any);

      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].id).toBe('a2');
    });
  });

  describe('update', () => {
    it('should update appointment and return data with conflicts', async () => {
      const item = { id: 'a1', status: 'PENDENTE', dataHora: new Date('2026-03-17T09:00:00Z'), duracaoMin: 60 };
      mockRepo.findOne.mockResolvedValue(item);
      mockRepo.save.mockResolvedValue({ ...item, status: 'CONFIRMADO' });

      const result = await service.update(TENANT_ID, 'a1', { status: 'CONFIRMADO' } as any);

      expect(result.data.status).toBe('CONFIRMADO');
      expect(result).toHaveProperty('conflicts');
    });

    it('should throw NotFoundException when not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.update(TENANT_ID, 'nonexistent', {} as any)).rejects.toThrow(NotFoundException);
    });
  });

  describe('delete', () => {
    it('should delete appointment when found', async () => {
      const item = { id: 'a1' };
      mockRepo.findOne.mockResolvedValue(item);
      mockRepo.remove.mockResolvedValue(undefined);

      await service.delete(TENANT_ID, 'a1');

      expect(mockRepo.remove).toHaveBeenCalledWith(item);
    });

    it('should throw NotFoundException when not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.delete(TENANT_ID, 'nonexistent')).rejects.toThrow(NotFoundException);
    });
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd apps/backend && npx jest appointments.service.spec.ts --no-coverage
```

Expected: FAIL — `AppointmentsService` not found.

**Step 3: Create `appointments.service.ts`**

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { AppointmentEntity } from './appointment.entity';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';

@Injectable()
export class AppointmentsService {
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

  private async findConflicts(
    manager: EntityManager,
    dataHora: string,
    duracaoMin: number,
    excludeId?: string,
  ): Promise<Array<{ id: string; data_hora: Date; tipo_servico: string | null }>> {
    const startTime = new Date(dataHora);
    const endTime = new Date(startTime.getTime() + duracaoMin * 60 * 1000);
    const excludeUuid = excludeId ?? '00000000-0000-0000-0000-000000000000';
    return manager.query(
      `SELECT id, data_hora, tipo_servico FROM appointments
       WHERE status NOT IN ('CANCELADO', 'CONCLUIDO')
         AND id != $1
         AND data_hora < $2
         AND (data_hora + (duracao_min * interval '1 minute')) > $3`,
      [excludeUuid, endTime.toISOString(), startTime.toISOString()],
    );
  }

  async list(
    tenantId: string,
    params: { dateStart?: string; dateEnd?: string; status?: string },
  ): Promise<AppointmentEntity[]> {
    return this.withSchema(tenantId, async (manager) => {
      const repo = manager.getRepository(AppointmentEntity);
      const qb = repo.createQueryBuilder('a').orderBy('a.dataHora', 'ASC');
      if (params.dateStart) qb.andWhere('a.dataHora >= :dateStart', { dateStart: params.dateStart });
      if (params.dateEnd) qb.andWhere('a.dataHora <= :dateEnd', { dateEnd: params.dateEnd });
      if (params.status) qb.andWhere('a.status = :status', { status: params.status });
      return qb.getMany();
    });
  }

  async getById(tenantId: string, id: string): Promise<AppointmentEntity> {
    return this.withSchema(tenantId, async (manager) => {
      const repo = manager.getRepository(AppointmentEntity);
      const item = await repo.findOne({ where: { id } });
      if (!item) throw new NotFoundException('Agendamento não encontrado.');
      return item;
    });
  }

  async create(
    tenantId: string,
    dto: CreateAppointmentDto,
  ): Promise<{ data: AppointmentEntity; conflicts: any[] }> {
    return this.withSchema(tenantId, async (manager) => {
      const duracaoMin = dto.duracaoMin ?? 60;
      const conflicts = await this.findConflicts(manager, dto.dataHora, duracaoMin);
      const repo = manager.getRepository(AppointmentEntity);
      const item = await repo.save(
        repo.create({
          clienteId: dto.clienteId,
          veiculoId: dto.veiculoId,
          dataHora: new Date(dto.dataHora),
          duracaoMin,
          tipoServico: dto.tipoServico ?? null,
          status: dto.status ?? 'PENDENTE',
        }),
      );
      return { data: item, conflicts };
    });
  }

  async update(
    tenantId: string,
    id: string,
    dto: UpdateAppointmentDto,
  ): Promise<{ data: AppointmentEntity; conflicts: any[] }> {
    return this.withSchema(tenantId, async (manager) => {
      const repo = manager.getRepository(AppointmentEntity);
      const item = await repo.findOne({ where: { id } });
      if (!item) throw new NotFoundException('Agendamento não encontrado.');

      let conflicts: any[] = [];
      if (dto.dataHora !== undefined || dto.duracaoMin !== undefined) {
        const newDataHora = dto.dataHora ?? item.dataHora.toISOString();
        const newDuracao = dto.duracaoMin ?? item.duracaoMin;
        conflicts = await this.findConflicts(manager, newDataHora, newDuracao, id);
      }

      Object.assign(item, {
        ...(dto.clienteId !== undefined && { clienteId: dto.clienteId }),
        ...(dto.veiculoId !== undefined && { veiculoId: dto.veiculoId }),
        ...(dto.dataHora !== undefined && { dataHora: new Date(dto.dataHora) }),
        ...(dto.duracaoMin !== undefined && { duracaoMin: dto.duracaoMin }),
        ...(dto.tipoServico !== undefined && { tipoServico: dto.tipoServico }),
        ...(dto.status !== undefined && { status: dto.status }),
      });

      const updated = await repo.save(item);
      return { data: updated, conflicts };
    });
  }

  async delete(tenantId: string, id: string): Promise<void> {
    return this.withSchema(tenantId, async (manager) => {
      const repo = manager.getRepository(AppointmentEntity);
      const item = await repo.findOne({ where: { id } });
      if (!item) throw new NotFoundException('Agendamento não encontrado.');
      await repo.remove(item);
    });
  }
}
```

**Step 4: Run tests to verify they pass**

```bash
cd apps/backend && npx jest appointments.service.spec.ts --no-coverage
```

Expected: All tests PASS.

**Step 5: Commit**

```bash
git add apps/backend/src/modules/workshop/appointments/
git commit -m "feat(appointments): add AppointmentsService with conflict detection"
```

---

## Task 4: AppointmentCommentsService + Tests

**Files:**
- Create: `apps/backend/src/modules/workshop/appointments/appointment-comments.service.ts`
- Create: `apps/backend/src/modules/workshop/appointments/appointment-comments.service.spec.ts`

**Step 1: Write the failing test first**

Create `appointment-comments.service.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AppointmentCommentsService } from './appointment-comments.service';

const TENANT_ID = '00000000-0000-0000-0000-000000000001';

const mockCommentRepo = {
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  remove: jest.fn(),
};

const mockApptRepo = {
  findOne: jest.fn(),
};

const mockQueryRunner = {
  connect: jest.fn().mockResolvedValue(undefined),
  query: jest.fn().mockResolvedValue(undefined),
  manager: {
    getRepository: jest.fn((entity) => {
      if (entity.name === 'AppointmentEntity') return mockApptRepo;
      return mockCommentRepo;
    }),
  },
  release: jest.fn().mockResolvedValue(undefined),
};

const mockDataSource = {
  createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
};

describe('AppointmentCommentsService', () => {
  let service: AppointmentCommentsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppointmentCommentsService,
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();
    service = module.get<AppointmentCommentsService>(AppointmentCommentsService);
    jest.clearAllMocks();
    mockQueryRunner.manager.getRepository.mockImplementation((entity: any) => {
      if (entity?.name === 'AppointmentEntity') return mockApptRepo;
      return mockCommentRepo;
    });
  });

  describe('listComments', () => {
    it('should return comments for an appointment', async () => {
      const comments = [{ id: 'c1', texto: 'Ligou, não atendeu' }];
      mockCommentRepo.find.mockResolvedValue(comments);

      const result = await service.listComments(TENANT_ID, 'a1');

      expect(result).toEqual(comments);
    });
  });

  describe('addComment', () => {
    it('should throw NotFoundException when appointment not found', async () => {
      mockApptRepo.findOne.mockResolvedValue(null);

      await expect(
        service.addComment(TENANT_ID, 'nonexistent', { texto: 'teste' }, 'user1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should create and return comment when appointment exists', async () => {
      mockApptRepo.findOne.mockResolvedValue({ id: 'a1' });
      const comment = { id: 'c1', texto: 'Ligou, não atendeu', appointmentId: 'a1' };
      mockCommentRepo.create.mockReturnValue(comment);
      mockCommentRepo.save.mockResolvedValue(comment);

      const result = await service.addComment(TENANT_ID, 'a1', { texto: 'Ligou, não atendeu' }, 'user1');

      expect(result).toEqual(comment);
    });
  });

  describe('deleteComment', () => {
    it('should throw NotFoundException when comment not found', async () => {
      mockCommentRepo.findOne.mockResolvedValue(null);

      await expect(
        service.deleteComment(TENANT_ID, 'a1', 'nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should delete comment when found', async () => {
      const comment = { id: 'c1', appointmentId: 'a1' };
      mockCommentRepo.findOne.mockResolvedValue(comment);
      mockCommentRepo.remove.mockResolvedValue(undefined);

      await service.deleteComment(TENANT_ID, 'a1', 'c1');

      expect(mockCommentRepo.remove).toHaveBeenCalledWith(comment);
    });
  });
});
```

**Step 2: Run to verify it fails**

```bash
cd apps/backend && npx jest appointment-comments.service.spec.ts --no-coverage
```

Expected: FAIL — `AppointmentCommentsService` not found.

**Step 3: Create `appointment-comments.service.ts`**

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { AppointmentEntity } from './appointment.entity';
import { AppointmentCommentEntity } from './appointment-comment.entity';
import { CreateAppointmentCommentDto } from './dto/create-appointment-comment.dto';

@Injectable()
export class AppointmentCommentsService {
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

  async listComments(
    tenantId: string,
    appointmentId: string,
  ): Promise<AppointmentCommentEntity[]> {
    return this.withSchema(tenantId, async (manager) => {
      const repo = manager.getRepository(AppointmentCommentEntity);
      return repo.find({ where: { appointmentId }, order: { createdAt: 'ASC' } });
    });
  }

  async addComment(
    tenantId: string,
    appointmentId: string,
    dto: CreateAppointmentCommentDto,
    userId: string,
  ): Promise<AppointmentCommentEntity> {
    return this.withSchema(tenantId, async (manager) => {
      const apptRepo = manager.getRepository(AppointmentEntity);
      const appt = await apptRepo.findOne({ where: { id: appointmentId } });
      if (!appt) throw new NotFoundException('Agendamento não encontrado.');

      const commentRepo = manager.getRepository(AppointmentCommentEntity);
      return commentRepo.save(
        commentRepo.create({ appointmentId, texto: dto.texto, createdById: userId }),
      );
    });
  }

  async deleteComment(
    tenantId: string,
    appointmentId: string,
    commentId: string,
  ): Promise<void> {
    return this.withSchema(tenantId, async (manager) => {
      const repo = manager.getRepository(AppointmentCommentEntity);
      const item = await repo.findOne({ where: { id: commentId, appointmentId } });
      if (!item) throw new NotFoundException('Comentário não encontrado.');
      await repo.remove(item);
    });
  }
}
```

**Step 4: Run tests to verify they pass**

```bash
cd apps/backend && npx jest appointment-comments.service.spec.ts --no-coverage
```

Expected: All tests PASS.

**Step 5: Commit**

```bash
git add apps/backend/src/modules/workshop/appointments/
git commit -m "feat(appointments): add AppointmentCommentsService"
```

---

## Task 5: Controllers + Module + Registration

**Files:**
- Create: `apps/backend/src/modules/workshop/appointments/appointments.controller.ts`
- Create: `apps/backend/src/modules/workshop/appointments/appointment-comments.controller.ts`
- Create: `apps/backend/src/modules/workshop/appointments/appointments.module.ts`
- Modify: `apps/backend/src/app.module.ts`
- Modify: `apps/backend/src/database/database.module.ts`

**Step 1: Create `appointments.controller.ts`**

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
import { AppointmentsService } from './appointments.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';

interface RequestWithUser extends Request {
  user: AuthUser;
}

@Controller('workshop/appointments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Get()
  list(
    @Request() req: RequestWithUser,
    @Query('date_start') dateStart?: string,
    @Query('date_end') dateEnd?: string,
    @Query('status') status?: string,
  ) {
    return this.appointmentsService.list(req.user.tenantId, { dateStart, dateEnd, status });
  }

  @Get(':id')
  getById(@Request() req: RequestWithUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.appointmentsService.getById(req.user.tenantId, id);
  }

  @Post()
  create(@Request() req: RequestWithUser, @Body() dto: CreateAppointmentDto) {
    return this.appointmentsService.create(req.user.tenantId, dto);
  }

  @Patch(':id')
  update(
    @Request() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAppointmentDto,
  ) {
    return this.appointmentsService.update(req.user.tenantId, id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.OWNER)
  @HttpCode(204)
  delete(@Request() req: RequestWithUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.appointmentsService.delete(req.user.tenantId, id);
  }
}
```

**Step 2: Create `appointment-comments.controller.ts`**

```typescript
import {
  Body, Controller, Delete, HttpCode, Param,
  ParseUUIDPipe, Post, Request, UseGuards, Get,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { RolesGuard } from '../../core/auth/roles.guard';
import { Roles } from '../../core/auth/roles.decorator';
import { UserRole } from '../../core/auth/user.entity';
import { AuthUser } from '../../core/auth/jwt.strategy';
import { AppointmentCommentsService } from './appointment-comments.service';
import { CreateAppointmentCommentDto } from './dto/create-appointment-comment.dto';

interface RequestWithUser extends Request {
  user: AuthUser;
}

@Controller('workshop/appointments/:appointmentId/comments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AppointmentCommentsController {
  constructor(private readonly commentsService: AppointmentCommentsService) {}

  @Get()
  list(
    @Request() req: RequestWithUser,
    @Param('appointmentId', ParseUUIDPipe) appointmentId: string,
  ) {
    return this.commentsService.listComments(req.user.tenantId, appointmentId);
  }

  @Post()
  addComment(
    @Request() req: RequestWithUser,
    @Param('appointmentId', ParseUUIDPipe) appointmentId: string,
    @Body() dto: CreateAppointmentCommentDto,
  ) {
    return this.commentsService.addComment(
      req.user.tenantId,
      appointmentId,
      dto,
      req.user.userId,
    );
  }

  @Delete(':commentId')
  @Roles(UserRole.OWNER)
  @HttpCode(204)
  deleteComment(
    @Request() req: RequestWithUser,
    @Param('appointmentId', ParseUUIDPipe) appointmentId: string,
    @Param('commentId', ParseUUIDPipe) commentId: string,
  ) {
    return this.commentsService.deleteComment(req.user.tenantId, appointmentId, commentId);
  }
}
```

**Step 3: Check what fields AuthUser has**

Before writing the controller, verify the `AuthUser` interface in `apps/backend/src/modules/core/auth/jwt.strategy.ts` has a `userId` field. If the field is named differently (e.g., `sub` or `id`), adjust `req.user.userId` accordingly.

```bash
grep -n "userId\|sub\|interface AuthUser" apps/backend/src/modules/core/auth/jwt.strategy.ts
```

**Step 4: Create `appointments.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { AppointmentsController } from './appointments.controller';
import { AppointmentsService } from './appointments.service';
import { AppointmentCommentsController } from './appointment-comments.controller';
import { AppointmentCommentsService } from './appointment-comments.service';

@Module({
  controllers: [AppointmentsController, AppointmentCommentsController],
  providers: [AppointmentsService, AppointmentCommentsService],
})
export class AppointmentsModule {}
```

**Step 5: Register AppointmentsModule in `app.module.ts`**

Add import:
```typescript
import { AppointmentsModule } from './modules/workshop/appointments/appointments.module';
```

Add `AppointmentsModule` to the `imports` array after `CatalogModule`.

**Step 6: Register entities in `database.module.ts`**

Add imports:
```typescript
import { AppointmentEntity } from '../modules/workshop/appointments/appointment.entity';
import { AppointmentCommentEntity } from '../modules/workshop/appointments/appointment-comment.entity';
```

Add `AppointmentEntity, AppointmentCommentEntity` to the `entities` array.

**Step 7: Run all backend tests to verify nothing is broken**

```bash
cd apps/backend && npx jest --no-coverage
```

Expected: All tests PASS.

**Step 8: Commit**

```bash
git add apps/backend/src/modules/workshop/appointments/ apps/backend/src/app.module.ts apps/backend/src/database/database.module.ts
git commit -m "feat(appointments): add controllers, module, register in app"
```

---

## Task 6: Frontend Service

**Files:**
- Create: `apps/frontend/src/services/appointments.service.ts`

**Step 1: Create `appointments.service.ts`**

```typescript
import { api } from './api';

export type AppointmentStatus = 'PENDENTE' | 'CONFIRMADO' | 'CONCLUIDO' | 'CANCELADO';

export interface Appointment {
  id: string;
  clienteId: string;
  veiculoId: string;
  dataHora: string;
  duracaoMin: number;
  tipoServico: string | null;
  status: AppointmentStatus;
  createdAt: string;
  updatedAt: string;
}

export interface AppointmentConflict {
  id: string;
  data_hora: string;
  tipo_servico: string | null;
}

export interface AppointmentResponse {
  data: Appointment;
  conflicts: AppointmentConflict[];
}

export interface AppointmentComment {
  id: string;
  appointmentId: string;
  texto: string;
  createdById: string;
  createdAt: string;
}

export interface CreateAppointmentPayload {
  clienteId: string;
  veiculoId: string;
  dataHora: string;
  duracaoMin?: number;
  tipoServico?: string;
  status?: AppointmentStatus;
}

export const appointmentsApi = {
  async list(params?: {
    date_start?: string;
    date_end?: string;
    status?: string;
  }): Promise<Appointment[]> {
    const { data } = await api.get<Appointment[]>('/workshop/appointments', { params });
    return data;
  },

  async getById(id: string): Promise<Appointment> {
    const { data } = await api.get<Appointment>(`/workshop/appointments/${id}`);
    return data;
  },

  async create(payload: CreateAppointmentPayload): Promise<AppointmentResponse> {
    const { data } = await api.post<AppointmentResponse>('/workshop/appointments', payload);
    return data;
  },

  async update(id: string, payload: Partial<CreateAppointmentPayload>): Promise<AppointmentResponse> {
    const { data } = await api.patch<AppointmentResponse>(`/workshop/appointments/${id}`, payload);
    return data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/workshop/appointments/${id}`);
  },
};

export const appointmentCommentsApi = {
  async list(appointmentId: string): Promise<AppointmentComment[]> {
    const { data } = await api.get<AppointmentComment[]>(
      `/workshop/appointments/${appointmentId}/comments`,
    );
    return data;
  },

  async create(appointmentId: string, texto: string): Promise<AppointmentComment> {
    const { data } = await api.post<AppointmentComment>(
      `/workshop/appointments/${appointmentId}/comments`,
      { texto },
    );
    return data;
  },

  async delete(appointmentId: string, commentId: string): Promise<void> {
    await api.delete(`/workshop/appointments/${appointmentId}/comments/${commentId}`);
  },
};
```

**Step 2: Commit**

```bash
git add apps/frontend/src/services/appointments.service.ts
git commit -m "feat(appointments): add frontend appointments service"
```

---

## Task 7: Frontend AppointmentFormDialog

**Files:**
- Create: `apps/frontend/src/pages/workshop/appointments/AppointmentFormDialog.tsx`

This modal handles both create and edit. On save, calls `appointmentsApi.create` or `appointmentsApi.update`. If `conflicts.length > 0`, shows yellow Alert warning (does not prevent save).

**Step 1: Create `AppointmentFormDialog.tsx`**

```typescript
import { useEffect, useState } from 'react';
import {
  Alert, Autocomplete, Box, Button, Dialog, DialogActions,
  DialogContent, DialogTitle, FormControl, InputLabel,
  MenuItem, Select, TextField,
} from '@mui/material';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { appointmentsApi, type Appointment, type AppointmentStatus } from '../../../services/appointments.service';
import { customersService, type Customer } from '../../../services/customers.service';
import { vehiclesService, type Vehicle } from '../../../services/vehicles.service';

const schema = z.object({
  clienteId: z.string().uuid('Selecione um cliente'),
  veiculoId: z.string().uuid('Selecione um veículo'),
  date: z.string().min(1, 'Data obrigatória'),
  time: z.string().min(1, 'Hora obrigatória'),
  duracaoMin: z.coerce.number().int().min(15, 'Mínimo 15 minutos'),
  tipoServico: z.string().optional(),
  status: z.enum(['PENDENTE', 'CONFIRMADO', 'CONCLUIDO', 'CANCELADO']),
});

type FormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  editing: Appointment | null;
  onClose: () => void;
  onSaved: () => void;
}

export function AppointmentFormDialog({ open, editing, onClose, onSaved }: Props) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [conflictWarning, setConflictWarning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { control, register, handleSubmit, watch, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { duracaoMin: 60, status: 'PENDENTE' },
  });

  const selectedClienteId = watch('clienteId');

  // Load customers on open
  useEffect(() => {
    if (!open) return;
    customersService.list({ limit: 100 }).then((r) => setCustomers(r.data));
  }, [open]);

  // Load vehicles when cliente changes
  useEffect(() => {
    if (!selectedClienteId) { setVehicles([]); return; }
    vehiclesService.list({ limit: 100 }).then((r) =>
      setVehicles(r.data.filter((v) => v.customerId === selectedClienteId)),
    );
  }, [selectedClienteId]);

  // Populate form when editing
  useEffect(() => {
    if (editing) {
      const d = new Date(editing.dataHora);
      const date = d.toISOString().slice(0, 10);
      const time = d.toTimeString().slice(0, 5);
      reset({
        clienteId: editing.clienteId,
        veiculoId: editing.veiculoId,
        date,
        time,
        duracaoMin: editing.duracaoMin,
        tipoServico: editing.tipoServico ?? '',
        status: editing.status as AppointmentStatus,
      });
    } else {
      reset({ duracaoMin: 60, status: 'PENDENTE', date: '', time: '', clienteId: '', veiculoId: '', tipoServico: '' });
    }
    setConflictWarning(false);
    setError(null);
  }, [editing, open, reset]);

  const onSubmit = async (values: FormData) => {
    setSaving(true);
    setError(null);
    setConflictWarning(false);
    try {
      const dataHora = `${values.date}T${values.time}:00.000Z`;
      const payload = {
        clienteId: values.clienteId,
        veiculoId: values.veiculoId,
        dataHora,
        duracaoMin: values.duracaoMin,
        tipoServico: values.tipoServico || undefined,
        status: values.status,
      };

      let result;
      if (editing) {
        result = await appointmentsApi.update(editing.id, payload);
      } else {
        result = await appointmentsApi.create(payload);
      }

      if (result.conflicts.length > 0) {
        setConflictWarning(true);
      }
      onSaved();
      if (result.conflicts.length === 0) onClose();
    } catch {
      setError('Erro ao salvar agendamento.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{editing ? 'Editar Agendamento' : 'Novo Agendamento'}</DialogTitle>
      <DialogContent>
        <Box component="form" sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          {conflictWarning && (
            <Alert severity="warning">
              Atenção: já existe agendamento neste horário. O agendamento foi salvo mesmo assim.
            </Alert>
          )}
          {error && <Alert severity="error">{error}</Alert>}

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
                  <TextField
                    {...params}
                    label="Cliente"
                    error={!!errors.clienteId}
                    helperText={errors.clienteId?.message}
                  />
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

          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              label="Data"
              type="date"
              InputLabelProps={{ shrink: true }}
              {...register('date')}
              error={!!errors.date}
              helperText={errors.date?.message}
              fullWidth
            />
            <TextField
              label="Hora"
              type="time"
              InputLabelProps={{ shrink: true }}
              {...register('time')}
              error={!!errors.time}
              helperText={errors.time?.message}
              fullWidth
            />
          </Box>

          <TextField
            label="Duração (minutos)"
            type="number"
            {...register('duracaoMin')}
            error={!!errors.duracaoMin}
            helperText={errors.duracaoMin?.message}
          />

          <TextField
            label="Tipo de Serviço"
            {...register('tipoServico')}
            placeholder="ex: Troca de óleo, Alinhamento..."
          />

          <Controller
            name="status"
            control={control}
            render={({ field }) => (
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select {...field} label="Status">
                  <MenuItem value="PENDENTE">Pendente</MenuItem>
                  <MenuItem value="CONFIRMADO">Confirmado</MenuItem>
                  <MenuItem value="CONCLUIDO">Concluído</MenuItem>
                  <MenuItem value="CANCELADO">Cancelado</MenuItem>
                </Select>
              </FormControl>
            )}
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button variant="contained" onClick={handleSubmit(onSubmit)} disabled={saving}>
          {saving ? 'Salvando...' : 'Salvar'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
```

**Step 2: Commit**

```bash
git add apps/frontend/src/pages/workshop/appointments/
git commit -m "feat(appointments): add AppointmentFormDialog"
```

---

## Task 8: Frontend AppointmentDrawer

**Files:**
- Create: `apps/frontend/src/pages/workshop/appointments/AppointmentDrawer.tsx`

This side drawer shows appointment details + comment timeline + add comment form.

**Step 1: Create `AppointmentDrawer.tsx`**

```typescript
import { useEffect, useState } from 'react';
import {
  Alert, Box, Button, Chip, CircularProgress, Divider,
  Drawer, IconButton, TextField, Toolbar, Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import SendIcon from '@mui/icons-material/Send';
import {
  appointmentsApi, appointmentCommentsApi,
  type Appointment, type AppointmentComment,
} from '../../../services/appointments.service';
import { customersService, type Customer } from '../../../services/customers.service';
import { vehiclesService, type Vehicle } from '../../../services/vehicles.service';

const STATUS_COLORS: Record<string, 'warning' | 'info' | 'success' | 'default'> = {
  PENDENTE: 'warning',
  CONFIRMADO: 'info',
  CONCLUIDO: 'success',
  CANCELADO: 'default',
};

interface Props {
  appointmentId: string | null;
  onClose: () => void;
  onEdit: (appt: Appointment) => void;
  onDeleted: () => void;
  isOwner: boolean;
}

export function AppointmentDrawer({ appointmentId, onClose, onEdit, onDeleted, isOwner }: Props) {
  const [appt, setAppt] = useState<Appointment | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [comments, setComments] = useState<AppointmentComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const [a, c] = await Promise.all([
        appointmentsApi.getById(id),
        appointmentCommentsApi.list(id),
      ]);
      setAppt(a);
      setComments(c);
      const [cust, veh] = await Promise.all([
        customersService.getById(a.clienteId),
        vehiclesService.getById(a.veiculoId),
      ]);
      setCustomer(cust);
      setVehicle(veh);
    } catch {
      setError('Erro ao carregar agendamento.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (appointmentId) loadData(appointmentId);
    else { setAppt(null); setCustomer(null); setVehicle(null); setComments([]); }
  }, [appointmentId]);

  const handleAddComment = async () => {
    if (!newComment.trim() || !appointmentId) return;
    try {
      const c = await appointmentCommentsApi.create(appointmentId, newComment.trim());
      setComments((prev) => [...prev, c]);
      setNewComment('');
    } catch {
      setError('Erro ao adicionar comentário.');
    }
  };

  const handleDelete = async () => {
    if (!appt) return;
    if (!window.confirm('Confirmar exclusão do agendamento?')) return;
    try {
      await appointmentsApi.delete(appt.id);
      onDeleted();
      onClose();
    } catch {
      setError('Erro ao deletar agendamento.');
    }
  };

  return (
    <Drawer anchor="right" open={!!appointmentId} onClose={onClose}>
      <Box sx={{ width: 380, p: 2, display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h6">Agendamento</Typography>
          <IconButton onClick={onClose}><CloseIcon /></IconButton>
        </Box>

        {loading && <CircularProgress sx={{ alignSelf: 'center', mt: 4 }} />}
        {error && <Alert severity="error">{error}</Alert>}

        {appt && !loading && (
          <>
            <Chip
              label={appt.status}
              color={STATUS_COLORS[appt.status] ?? 'default'}
              size="small"
              sx={{ alignSelf: 'flex-start', mb: 2 }}
            />

            <Typography variant="body2" color="text.secondary">Cliente</Typography>
            <Typography variant="body1" mb={1}>{customer?.nome ?? appt.clienteId}</Typography>

            <Typography variant="body2" color="text.secondary">Veículo</Typography>
            <Typography variant="body1" mb={1}>
              {vehicle ? `${vehicle.placa} — ${vehicle.modelo}` : appt.veiculoId}
            </Typography>

            <Typography variant="body2" color="text.secondary">Data/Hora</Typography>
            <Typography variant="body1" mb={1}>
              {new Date(appt.dataHora).toLocaleString('pt-BR')} ({appt.duracaoMin} min)
            </Typography>

            {appt.tipoServico && (
              <>
                <Typography variant="body2" color="text.secondary">Tipo de Serviço</Typography>
                <Typography variant="body1" mb={1}>{appt.tipoServico}</Typography>
              </>
            )}

            <Box sx={{ display: 'flex', gap: 1, mt: 1, mb: 2 }}>
              <Button size="small" variant="outlined" onClick={() => onEdit(appt)}>Editar</Button>
              {isOwner && (
                <Button size="small" variant="outlined" color="error" onClick={handleDelete}>
                  Deletar
                </Button>
              )}
            </Box>

            <Divider sx={{ mb: 2 }} />
            <Typography variant="subtitle2" mb={1}>Comentários</Typography>

            <Box sx={{ flex: 1, overflowY: 'auto', mb: 2 }}>
              {comments.length === 0 && (
                <Typography variant="body2" color="text.secondary">Nenhum comentário.</Typography>
              )}
              {comments.map((c) => (
                <Box key={c.id} sx={{ mb: 1.5, p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
                  <Typography variant="body2">{c.texto}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {new Date(c.createdAt).toLocaleString('pt-BR')}
                  </Typography>
                </Box>
              ))}
            </Box>

            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField
                size="small"
                placeholder="Adicionar comentário..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
                fullWidth
              />
              <IconButton onClick={handleAddComment} disabled={!newComment.trim()}>
                <SendIcon />
              </IconButton>
            </Box>
          </>
        )}
      </Box>
    </Drawer>
  );
}
```

**Step 2: Commit**

```bash
git add apps/frontend/src/pages/workshop/appointments/
git commit -m "feat(appointments): add AppointmentDrawer with comments timeline"
```

---

## Task 9: Frontend AppointmentsPage + App.tsx Route

**Files:**
- Create: `apps/frontend/src/pages/workshop/appointments/AppointmentsPage.tsx`
- Modify: `apps/frontend/src/App.tsx`

This is the main page with two views (weekly calendar + list) plus the toolbar.

**Step 1: Create `AppointmentsPage.tsx`**

```typescript
import { useState, useEffect, useCallback } from 'react';
import {
  Alert, Box, Button, Chip, CircularProgress, IconButton,
  Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import ListIcon from '@mui/icons-material/List';
import {
  appointmentsApi, type Appointment,
} from '../../../services/appointments.service';
import { AppointmentFormDialog } from './AppointmentFormDialog';
import { AppointmentDrawer } from './AppointmentDrawer';
import { useAuthStore } from '../../../store/auth.store';

const STATUS_COLORS: Record<string, 'warning' | 'info' | 'success' | 'default'> = {
  PENDENTE: 'warning',
  CONFIRMADO: 'info',
  CONCLUIDO: 'success',
  CANCELADO: 'default',
};

const DAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function getWeekDates(referenceDate: Date): Date[] {
  const day = referenceDate.getDay(); // 0=Sun
  const monday = new Date(referenceDate);
  monday.setDate(referenceDate.getDate() - day + (day === 0 ? -6 : 1));
  monday.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

export function AppointmentsPage() {
  const [view, setView] = useState<'calendar' | 'list'>('calendar');
  const [weekRef, setWeekRef] = useState(new Date());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Appointment | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const user = useAuthStore((s) => s.user);
  const isOwner = user?.role === 'OWNER';

  const weekDates = getWeekDates(weekRef);
  const weekStart = weekDates[0];
  const weekEnd = weekDates[6];

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const items = await appointmentsApi.list({
        date_start: weekStart.toISOString(),
        date_end: new Date(weekEnd.getTime() + 86400000).toISOString(),
      });
      setAppointments(items);
    } catch {
      setError('Erro ao carregar agendamentos.');
    } finally {
      setLoading(false);
    }
  }, [weekStart.toISOString(), weekEnd.toISOString()]);

  useEffect(() => { load(); }, [load]);

  const prevWeek = () => setWeekRef((d) => { const n = new Date(d); n.setDate(d.getDate() - 7); return n; });
  const nextWeek = () => setWeekRef((d) => { const n = new Date(d); n.setDate(d.getDate() + 7); return n; });

  const openNew = () => { setEditing(null); setFormOpen(true); };
  const openEdit = (appt: Appointment) => { setEditing(appt); setFormOpen(true); setSelectedId(null); };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Confirmar exclusão?')) return;
    try {
      await appointmentsApi.delete(id);
      load();
    } catch {
      setError('Erro ao deletar agendamento.');
    }
  };

  const weekLabel = `${weekDates[0].toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} – ${weekDates[6].toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}`;

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h5" fontWeight="bold">Agendamentos</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openNew}>
          Novo Agendamento
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton onClick={prevWeek}><ChevronLeftIcon /></IconButton>
          <Typography>{weekLabel}</Typography>
          <IconButton onClick={nextWeek}><ChevronRightIcon /></IconButton>
        </Box>
        <ToggleButtonGroup value={view} exclusive onChange={(_, v) => v && setView(v)} size="small">
          <ToggleButton value="calendar"><CalendarMonthIcon fontSize="small" /></ToggleButton>
          <ToggleButton value="list"><ListIcon fontSize="small" /></ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {loading && <CircularProgress sx={{ display: 'block', mx: 'auto', my: 4 }} />}

      {!loading && view === 'calendar' && (
        <Paper>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: 1, borderColor: 'divider' }}>
            {weekDates.map((d, i) => (
              <Box key={i} sx={{ p: 1, textAlign: 'center', borderRight: i < 6 ? 1 : 0, borderColor: 'divider' }}>
                <Typography variant="caption" color="text.secondary">{DAY_LABELS[d.getDay()]}</Typography>
                <Typography variant="body2" fontWeight={isSameDay(d, new Date()) ? 'bold' : 'normal'}>
                  {d.getDate()}
                </Typography>
              </Box>
            ))}
          </Box>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', minHeight: 400 }}>
            {weekDates.map((d, i) => {
              const dayAppts = appointments
                .filter((a) => isSameDay(new Date(a.dataHora), d))
                .sort((a, b) => a.dataHora.localeCompare(b.dataHora));
              return (
                <Box
                  key={i}
                  sx={{
                    p: 0.5,
                    borderRight: i < 6 ? 1 : 0,
                    borderColor: 'divider',
                    minHeight: 200,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 0.5,
                  }}
                >
                  {dayAppts.map((a) => (
                    <Box
                      key={a.id}
                      onClick={() => setSelectedId(a.id)}
                      sx={{
                        p: 0.75,
                        borderRadius: 1,
                        cursor: 'pointer',
                        fontSize: '0.75rem',
                        bgcolor:
                          a.status === 'PENDENTE' ? 'warning.dark' :
                          a.status === 'CONFIRMADO' ? 'info.dark' :
                          a.status === 'CONCLUIDO' ? 'success.dark' : 'action.disabledBackground',
                        '&:hover': { opacity: 0.85 },
                      }}
                    >
                      <Typography variant="caption" display="block" fontWeight="bold">
                        {new Date(a.dataHora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </Typography>
                      <Typography variant="caption" display="block" noWrap>
                        {a.tipoServico ?? '—'}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              );
            })}
          </Box>
        </Paper>
      )}

      {!loading && view === 'list' && (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Data/Hora</TableCell>
                <TableCell>Tipo de Serviço</TableCell>
                <TableCell>Duração</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Ações</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {appointments.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} align="center">Nenhum agendamento nesta semana.</TableCell>
                </TableRow>
              )}
              {appointments.map((a) => (
                <TableRow
                  key={a.id}
                  hover
                  onClick={() => setSelectedId(a.id)}
                  sx={{ cursor: 'pointer' }}
                >
                  <TableCell>{new Date(a.dataHora).toLocaleString('pt-BR')}</TableCell>
                  <TableCell>{a.tipoServico ?? '—'}</TableCell>
                  <TableCell>{a.duracaoMin} min</TableCell>
                  <TableCell>
                    <Chip label={a.status} color={STATUS_COLORS[a.status]} size="small" />
                  </TableCell>
                  <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                    <IconButton size="small" onClick={() => openEdit(a)}><EditIcon fontSize="small" /></IconButton>
                    {isOwner && (
                      <IconButton size="small" color="error" onClick={() => handleDelete(a.id)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <AppointmentFormDialog
        open={formOpen}
        editing={editing}
        onClose={() => setFormOpen(false)}
        onSaved={() => load()}
      />

      <AppointmentDrawer
        appointmentId={selectedId}
        onClose={() => setSelectedId(null)}
        onEdit={(appt) => { setSelectedId(null); openEdit(appt); }}
        onDeleted={() => load()}
        isOwner={isOwner}
      />
    </Box>
  );
}
```

**Step 2: Add route in `App.tsx`**

Add import:
```typescript
import { AppointmentsPage } from './pages/workshop/appointments/AppointmentsPage';
```

Add route inside the workshop `<Route>` block, after `catalog`:
```typescript
<Route path="appointments" element={<AppointmentsPage />} />
```

**Step 3: Check `useAuthStore` for user role field**

Run:
```bash
grep -n "role\|user" apps/frontend/src/store/auth.store.ts | head -20
```

If the user's role field is named differently than `user.role`, adjust the `isOwner` line in `AppointmentsPage.tsx`.

**Step 4: Run frontend type check**

```bash
cd apps/frontend && npx tsc --noEmit
```

Fix any TypeScript errors before committing.

**Step 5: Run backend tests one last time**

```bash
cd apps/backend && npx jest --no-coverage
```

Expected: All tests PASS.

**Step 6: Commit**

```bash
git add apps/frontend/src/pages/workshop/appointments/ apps/frontend/src/App.tsx
git commit -m "feat(appointments): add AppointmentsPage with weekly calendar and list view"
```

---

## Final Verification

Start Docker Compose and verify end-to-end:

```bash
docker-compose up --build
```

Manual test checklist:
- [ ] Create new appointment — form opens, saves, appears in calendar and list
- [ ] Create appointment with overlapping time — yellow conflict warning shown, saved anyway
- [ ] Click appointment in calendar — drawer opens with details
- [ ] Add comment in drawer — appears in timeline immediately
- [ ] Edit appointment — form pre-filled, saves correctly
- [ ] Change status — reflects immediately in calendar color
- [ ] Delete appointment as OWNER — confirmation prompt, removed from list
- [ ] Navigate prev/next week — appointments update
- [ ] Toggle calendar ↔ list view
