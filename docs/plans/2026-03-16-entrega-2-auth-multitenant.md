# Entrega 2: Auth + Multi-tenancy + Onboarding — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implementar autenticação JWT com multi-tenancy (schema-per-tenant), cadastro de oficina com onboarding, roles (OWNER/EMPLOYEE), integração Asaas (trial 30 dias) e páginas de login/registro no frontend.

**Architecture:** Monolito modular NestJS. Cada oficina (tenant) recebe um schema dedicado no PostgreSQL. Tabelas globais ficam em `public` (tenants, users, refresh_tokens, billing). O TenantMiddleware lê o `tenant_id` do JWT e executa `SET search_path` antes de cada query de negócio. Asaas cria cliente + assinatura com trial. No desenvolvimento, se `ASAAS_API_KEY=mock`, a integração é simulada sem chamadas reais.

**Tech Stack:** NestJS 10, TypeORM 0.3, PostgreSQL 15, `@nestjs/jwt`, `@nestjs/passport`, `passport-jwt`, `bcrypt`, `class-validator`, `class-transformer`, `multer`, `axios`, `zustand`, `react-hook-form`, `zod`, `@hookform/resolvers`.

---

## Task 1: TypeORM Migrations Infrastructure

**Files:**
- Create: `apps/backend/src/database/data-source.ts`
- Modify: `apps/backend/package.json`

**Step 1: Instalar dependências do TypeORM CLI**

```bash
cd apps/backend
pnpm add typeorm-ts-node-commonjs --save-dev
pnpm add class-validator class-transformer
```

**Step 2: Criar `apps/backend/src/database/data-source.ts`**

Este arquivo é usado pelo CLI do TypeORM para rodar migrations fora do contexto do NestJS.

```typescript
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { join } from 'path';

dotenv.config({ path: join(__dirname, '../../../.env') });

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USER ?? 'Praktikus',
  password: process.env.DB_PASS ?? 'Praktikus_dev',
  database: process.env.DB_NAME ?? 'Praktikus',
  entities: [join(__dirname, '../**/*.entity{.ts,.js}')],
  migrations: [join(__dirname, './migrations/*.{ts,js}')],
  migrationsTableName: 'migrations',
  migrationsRun: false,
});
```

**Step 3: Adicionar scripts de migration ao `apps/backend/package.json`**

Editar `scripts`:

```json
"migration:generate": "typeorm-ts-node-commonjs -d src/database/data-source.ts migration:generate",
"migration:run": "typeorm-ts-node-commonjs -d src/database/data-source.ts migration:run",
"migration:revert": "typeorm-ts-node-commonjs -d src/database/data-source.ts migration:revert",
"migration:create": "typeorm-ts-node-commonjs migration:create"
```

**Step 4: Criar diretório de migrations**

```bash
mkdir -p src/database/migrations
```

**Step 5: Commit**

```bash
cd ../../
git add apps/backend/src/database/ apps/backend/package.json
git commit -m "chore(backend): add TypeORM migrations infrastructure"
```

---

## Task 2: Public Schema — Entidades e Migration Inicial

**Files:**
- Create: `apps/backend/src/modules/core/tenancy/tenant.entity.ts`
- Create: `apps/backend/src/modules/core/auth/user.entity.ts`
- Create: `apps/backend/src/modules/core/auth/refresh-token.entity.ts`
- Create: `apps/backend/src/modules/core/billing/billing.entity.ts`
- Create: `apps/backend/src/database/migrations/<timestamp>-CreatePublicSchema.ts`

**Step 1: Criar `apps/backend/src/modules/core/tenancy/tenant.entity.ts`**

```typescript
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum TenantStatus {
  TRIAL = 'TRIAL',
  ACTIVE = 'ACTIVE',
  OVERDUE = 'OVERDUE',
  SUSPENDED = 'SUSPENDED',
}

export type TenantAddress = {
  street: string;
  number: string;
  complement?: string;
  city: string;
  state: string;
  zip: string;
};

@Entity({ name: 'tenants', schema: 'public' })
export class TenantEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ unique: true })
  slug: string;

  @Column({ name: 'schema_name', unique: true })
  schemaName: string;

  @Index({ unique: true })
  @Column({ unique: true })
  cnpj: string;

  @Column({ name: 'razao_social' })
  razaoSocial: string;

  @Column({ name: 'nome_fantasia' })
  nomeFantasia: string;

  @Column({ type: 'jsonb', nullable: true })
  endereco: TenantAddress | null;

  @Column({ nullable: true })
  telefone: string;

  @Column({ name: 'logo_url', nullable: true })
  logoUrl: string;

  @Column({
    type: 'enum',
    enum: TenantStatus,
    default: TenantStatus.TRIAL,
  })
  status: TenantStatus;

  @Column({ name: 'trial_ends_at', type: 'timestamptz', nullable: true })
  trialEndsAt: Date | null;

  @Column({ name: 'billing_anchor_date', type: 'date', nullable: true })
  billingAnchorDate: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
```

**Step 2: Criar `apps/backend/src/modules/core/auth/user.entity.ts`**

```typescript
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum UserRole {
  OWNER = 'OWNER',
  EMPLOYEE = 'EMPLOYEE',
}

@Entity({ name: 'users', schema: 'public' })
export class UserEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id' })
  tenantId: string;

  @Index({ unique: true })
  @Column({ unique: true })
  email: string;

  @Column({ name: 'password_hash' })
  passwordHash: string;

  @Column()
  name: string;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.OWNER,
  })
  role: UserRole;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
```

**Step 3: Criar `apps/backend/src/modules/core/auth/refresh-token.entity.ts`**

```typescript
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'refresh_tokens', schema: 'public' })
export class RefreshTokenEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  @Index()
  userId: string;

  @Column({ name: 'token_hash', unique: true })
  tokenHash: string;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @Column({ default: false })
  revoked: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
```

**Step 4: Criar `apps/backend/src/modules/core/billing/billing.entity.ts`**

```typescript
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'billing', schema: 'public' })
export class BillingEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ name: 'tenant_id', unique: true })
  tenantId: string;

  @Column({ name: 'asaas_customer_id', nullable: true })
  asaasCustomerId: string;

  @Column({ name: 'asaas_subscription_id', nullable: true })
  asaasSubscriptionId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
```

**Step 5: Gerar a migration das tabelas públicas**

```bash
cd apps/backend
pnpm migration:generate src/database/migrations/CreatePublicSchema
```

Expected: arquivo `src/database/migrations/<timestamp>-CreatePublicSchema.ts` gerado com CREATE TABLE para tenants, users, refresh_tokens e billing.

> **Nota:** Verifique o arquivo gerado. Se alguma tabela estiver faltando (entidade não registrada ainda), adicione manualmente as queries SQL no arquivo de migration.

**Step 6: Atualizar `apps/backend/src/database/database.module.ts` com as entidades**

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TenantEntity } from '../modules/core/tenancy/tenant.entity';
import { UserEntity } from '../modules/core/auth/user.entity';
import { RefreshTokenEntity } from '../modules/core/auth/refresh-token.entity';
import { BillingEntity } from '../modules/core/billing/billing.entity';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('DB_HOST'),
        port: config.get<number>('DB_PORT'),
        username: config.get<string>('DB_USER'),
        password: config.get<string>('DB_PASS'),
        database: config.get<string>('DB_NAME'),
        entities: [TenantEntity, UserEntity, RefreshTokenEntity, BillingEntity],
        synchronize: false,
        logging: config.get('NODE_ENV') === 'development',
        migrations: [__dirname + '/migrations/*.{ts,js}'],
        migrationsRun: true,
      }),
    }),
  ],
})
export class DatabaseModule {}
```

**Step 7: Subir o Docker Compose e rodar migrations**

```bash
cd ../../
docker-compose up postgres -d
cd apps/backend
pnpm migration:run
```

Expected: `Migration CreatePublicSchema has been executed successfully.`

**Step 8: Commit**

```bash
cd ../../
git add apps/backend/src/modules/core/ apps/backend/src/database/
git commit -m "feat(backend): add public schema entities and initial migration"
```

---

## Task 3: Tenancy Module

**Files:**
- Create: `apps/backend/src/modules/core/tenancy/tenancy.service.ts`
- Create: `apps/backend/src/modules/core/tenancy/tenancy.service.spec.ts`
- Create: `apps/backend/src/modules/core/tenancy/tenancy.middleware.ts`
- Create: `apps/backend/src/modules/core/tenancy/tenancy.module.ts`

**Step 1: Escrever os testes do TenancyService ANTES de implementar**

Criar `apps/backend/src/modules/core/tenancy/tenancy.service.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { TenancyService } from './tenancy.service';
import { TenantEntity, TenantStatus } from './tenant.entity';

const mockTenantRepo = {
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
};

const mockDataSource = {
  query: jest.fn(),
  createQueryRunner: jest.fn().mockReturnValue({
    connect: jest.fn(),
    startTransaction: jest.fn(),
    query: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
  }),
};

describe('TenancyService', () => {
  let service: TenancyService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenancyService,
        { provide: getRepositoryToken(TenantEntity), useValue: mockTenantRepo },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<TenancyService>(TenancyService);
    jest.clearAllMocks();
  });

  describe('generateSchemaName', () => {
    it('should generate a valid schema name from tenant id', () => {
      const name = service.generateSchemaName('abc123-def456');
      expect(name).toBe('tenant_abc123def456');
    });
  });

  describe('generateSlug', () => {
    it('should generate a URL-safe slug from nome fantasia', () => {
      const slug = service.generateSlug('Auto Center João & Silva');
      expect(slug).toMatch(/^[a-z0-9-]+$/);
      expect(slug).toContain('auto');
      expect(slug).toContain('center');
    });
  });

  describe('createTenant', () => {
    it('should create a tenant with TRIAL status and trial_ends_at set to 30 days', async () => {
      const input = {
        cnpj: '12345678000199',
        razaoSocial: 'Auto Center Ltda',
        nomeFantasia: 'Auto Center',
        telefone: '11999999999',
      };

      const savedTenant = { id: 'uuid-1', ...input, status: TenantStatus.TRIAL };
      mockTenantRepo.create.mockReturnValue(savedTenant);
      mockTenantRepo.save.mockResolvedValue(savedTenant);

      const qr = mockDataSource.createQueryRunner();

      const result = await service.createTenant(input);

      expect(mockTenantRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: TenantStatus.TRIAL }),
      );
      expect(result).toMatchObject({ status: TenantStatus.TRIAL });
    });
  });

  describe('findById', () => {
    it('should find a tenant by id', async () => {
      const tenant = { id: 'uuid-1', nomeFantasia: 'Auto Center', status: TenantStatus.ACTIVE };
      mockTenantRepo.findOne.mockResolvedValue(tenant);

      const result = await service.findById('uuid-1');
      expect(result).toEqual(tenant);
      expect(mockTenantRepo.findOne).toHaveBeenCalledWith({ where: { id: 'uuid-1' } });
    });

    it('should return null if tenant not found', async () => {
      mockTenantRepo.findOne.mockResolvedValue(null);
      const result = await service.findById('nonexistent');
      expect(result).toBeNull();
    });
  });
});
```

**Step 2: Rodar o teste para confirmar que FALHA**

```bash
cd apps/backend
pnpm test -- --testPathPattern=tenancy.service.spec
```

Expected: FAIL — `Cannot find module './tenancy.service'`

**Step 3: Implementar `apps/backend/src/modules/core/tenancy/tenancy.service.ts`**

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { TenantEntity, TenantStatus } from './tenant.entity';

interface CreateTenantInput {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string;
  telefone?: string;
  endereco?: TenantEntity['endereco'];
}

@Injectable()
export class TenancyService {
  constructor(
    @InjectRepository(TenantEntity)
    private readonly tenantRepo: Repository<TenantEntity>,
    private readonly dataSource: DataSource,
  ) {}

  generateSchemaName(tenantId: string): string {
    const sanitized = tenantId.replace(/-/g, '');
    return `tenant_${sanitized}`;
  }

  generateSlug(nomeFantasia: string): string {
    return nomeFantasia
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  async createTenant(input: CreateTenantInput): Promise<TenantEntity> {
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 30);

    const tenant = this.tenantRepo.create({
      cnpj: input.cnpj,
      razaoSocial: input.razaoSocial,
      nomeFantasia: input.nomeFantasia,
      telefone: input.telefone,
      endereco: input.endereco ?? null,
      slug: this.generateSlug(input.nomeFantasia),
      schemaName: 'pending',
      status: TenantStatus.TRIAL,
      trialEndsAt,
      billingAnchorDate: new Date(),
    });

    const saved = await this.tenantRepo.save(tenant);

    const schemaName = this.generateSchemaName(saved.id);
    saved.schemaName = schemaName;
    await this.tenantRepo.save(saved);

    await this.provisionSchema(schemaName);

    return saved;
  }

  private async provisionSchema(schemaName: string): Promise<void> {
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    try {
      await qr.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);
    } finally {
      await qr.release();
    }
  }

  async findById(id: string): Promise<TenantEntity | null> {
    return this.tenantRepo.findOne({ where: { id } });
  }

  async findByCnpj(cnpj: string): Promise<TenantEntity | null> {
    return this.tenantRepo.findOne({ where: { cnpj } });
  }
}
```

**Step 4: Rodar o teste para confirmar que PASSA**

```bash
pnpm test -- --testPathPattern=tenancy.service.spec
```

Expected: PASS — todos os testes do TenancyService.

**Step 5: Criar `apps/backend/src/modules/core/tenancy/tenancy.middleware.ts`**

O middleware lê o `tenant_id` do JWT (sem validar a assinatura — o JWT Guard faz isso) e armazena no contexto da request.

```typescript
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

export interface TenantRequest extends Request {
  tenantId?: string;
  tenantSchemaName?: string;
}

@Injectable()
export class TenancyMiddleware implements NestMiddleware {
  use(req: TenantRequest, res: Response, next: NextFunction): void {
    const authHeader = req.headers.authorization;

    if (authHeader?.startsWith('Bearer ')) {
      try {
        const token = authHeader.slice(7);
        const payload = JSON.parse(
          Buffer.from(token.split('.')[1], 'base64').toString(),
        );
        if (payload.tenant_id) {
          req.tenantId = payload.tenant_id;
          req.tenantSchemaName = `tenant_${payload.tenant_id.replace(/-/g, '')}`;
        }
      } catch {
        // token inválido — o JWT Guard vai rejeitar no controller
      }
    }

    next();
  }
}
```

**Step 6: Criar `apps/backend/src/modules/core/tenancy/tenancy.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantEntity } from './tenant.entity';
import { TenancyService } from './tenancy.service';

@Module({
  imports: [TypeOrmModule.forFeature([TenantEntity])],
  providers: [TenancyService],
  exports: [TenancyService],
})
export class TenancyModule {}
```

**Step 7: Registrar TenancyMiddleware no AppModule**

Editar `apps/backend/src/app.module.ts`:

```typescript
import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './health/health.controller';
import { DatabaseModule } from './database/database.module';
import { TenancyModule } from './modules/core/tenancy/tenancy.module';
import { TenancyMiddleware } from './modules/core/tenancy/tenancy.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    DatabaseModule,
    TenancyModule,
  ],
  controllers: [HealthController],
  providers: [],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(TenancyMiddleware).forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
```

**Step 8: Commit**

```bash
cd ../../
git add apps/backend/src/modules/core/tenancy/ apps/backend/src/app.module.ts
git commit -m "feat(backend): add TenancyService and TenancyMiddleware (schema-per-tenant)"
```

---

## Task 4: Auth Module — JWT Infrastructure (Strategy + Guards)

**Files:**
- Create: `apps/backend/src/modules/core/auth/auth.module.ts`
- Create: `apps/backend/src/modules/core/auth/jwt.strategy.ts`
- Create: `apps/backend/src/modules/core/auth/jwt-auth.guard.ts`
- Create: `apps/backend/src/modules/core/auth/roles.guard.ts`
- Create: `apps/backend/src/modules/core/auth/roles.decorator.ts`
- Create: `apps/backend/src/modules/core/auth/jwt.strategy.spec.ts`

**Step 1: Instalar dependências de autenticação**

```bash
cd apps/backend
pnpm add @nestjs/jwt @nestjs/passport passport passport-jwt bcrypt
pnpm add -D @types/passport-jwt @types/bcrypt
```

**Step 2: Escrever testes da JwtStrategy ANTES de implementar**

Criar `apps/backend/src/modules/core/auth/jwt.strategy.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UserEntity } from './user.entity';

const mockUserRepo = {
  findOne: jest.fn(),
};

const mockConfigService = {
  get: jest.fn().mockReturnValue('test_secret'),
};

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: getRepositoryToken(UserEntity), useValue: mockUserRepo },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
    jest.clearAllMocks();
  });

  describe('validate', () => {
    it('should return user payload when user exists', async () => {
      const user = { id: 'user-1', tenantId: 'tenant-1', role: 'OWNER', email: 'a@b.com' };
      mockUserRepo.findOne.mockResolvedValue(user);

      const payload = { sub: 'user-1', tenant_id: 'tenant-1', role: 'OWNER' };
      const result = await strategy.validate(payload);

      expect(result).toEqual({
        userId: 'user-1',
        tenantId: 'tenant-1',
        role: 'OWNER',
        email: 'a@b.com',
      });
    });

    it('should throw UnauthorizedException when user not found', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);

      const payload = { sub: 'nonexistent', tenant_id: 'tenant-1', role: 'OWNER' };
      await expect(strategy.validate(payload)).rejects.toThrow('Unauthorized');
    });
  });
});
```

**Step 3: Rodar o teste para confirmar que FALHA**

```bash
pnpm test -- --testPathPattern=jwt.strategy.spec
```

Expected: FAIL — `Cannot find module './jwt.strategy'`

**Step 4: Criar `apps/backend/src/modules/core/auth/jwt.strategy.ts`**

```typescript
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Repository } from 'typeorm';
import { UserEntity } from './user.entity';

export interface JwtPayload {
  sub: string;
  tenant_id: string;
  role: string;
}

export interface AuthUser {
  userId: string;
  tenantId: string;
  role: string;
  email: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly config: ConfigService,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthUser> {
    const user = await this.userRepo.findOne({ where: { id: payload.sub } });
    if (!user) throw new UnauthorizedException();
    return {
      userId: payload.sub,
      tenantId: payload.tenant_id,
      role: payload.role,
      email: user.email,
    };
  }
}
```

**Step 5: Criar `apps/backend/src/modules/core/auth/jwt-auth.guard.ts`**

```typescript
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
```

**Step 6: Criar `apps/backend/src/modules/core/auth/roles.decorator.ts`**

```typescript
import { SetMetadata } from '@nestjs/common';
import { UserRole } from './user.entity';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
```

**Step 7: Criar `apps/backend/src/modules/core/auth/roles.guard.ts`**

```typescript
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';
import { UserRole } from './user.entity';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) return true;

    const { user } = context.switchToHttp().getRequest();
    if (!requiredRoles.includes(user?.role)) {
      throw new ForbiddenException('Acesso negado: permissão insuficiente.');
    }
    return true;
  }
}
```

**Step 8: Rodar os testes para confirmar que PASSA**

```bash
pnpm test -- --testPathPattern=jwt.strategy.spec
```

Expected: PASS

**Step 9: Commit**

```bash
cd ../../
git add apps/backend/src/modules/core/auth/
git commit -m "feat(backend): add JWT strategy, guards and roles decorator"
```

---

## Task 5: Auth Module — Register Endpoint (TDD)

**Files:**
- Create: `apps/backend/src/modules/core/auth/dto/register.dto.ts`
- Create: `apps/backend/src/modules/core/auth/auth.service.ts`
- Create: `apps/backend/src/modules/core/auth/auth.service.spec.ts`
- Create: `apps/backend/src/modules/core/auth/auth.controller.ts`
- Create: `apps/backend/src/modules/core/auth/auth.controller.spec.ts`
- Create: `apps/backend/src/modules/core/auth/auth.module.ts`

**Step 1: Criar `apps/backend/src/modules/core/auth/dto/register.dto.ts`**

```typescript
import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  Matches,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class AddressDto {
  @IsString()
  street: string;

  @IsString()
  number: string;

  @IsOptional()
  @IsString()
  complement?: string;

  @IsString()
  city: string;

  @IsString()
  @MaxLength(2)
  state: string;

  @IsString()
  @Matches(/^\d{5}-?\d{3}$/)
  zip: string;
}

export class RegisterDto {
  // Dados da oficina
  @IsString()
  @Matches(/^\d{14}$/, { message: 'CNPJ deve conter 14 dígitos numéricos' })
  cnpj: string;

  @IsString()
  @MinLength(3)
  razaoSocial: string;

  @IsString()
  @MinLength(2)
  nomeFantasia: string;

  @IsOptional()
  @IsString()
  telefone?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => AddressDto)
  endereco?: AddressDto;

  // Dados do usuário (owner)
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  ownerName: string;
}
```

**Step 2: Escrever testes do AuthService — register ANTES de implementar**

Criar `apps/backend/src/modules/core/auth/auth.service.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { UserEntity, UserRole } from './user.entity';
import { RefreshTokenEntity } from './refresh-token.entity';
import { TenancyService } from '../tenancy/tenancy.service';
import { BillingService } from '../billing/billing.service';
import { TenantStatus } from '../tenancy/tenant.entity';

const mockUserRepo = {
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
};

const mockRefreshTokenRepo = {
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
};

const mockTenancyService = {
  createTenant: jest.fn(),
  findByCnpj: jest.fn(),
};

const mockBillingService = {
  setupTrial: jest.fn(),
};

const mockJwtService = {
  sign: jest.fn().mockReturnValue('mock_token'),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(UserEntity), useValue: mockUserRepo },
        { provide: getRepositoryToken(RefreshTokenEntity), useValue: mockRefreshTokenRepo },
        { provide: TenancyService, useValue: mockTenancyService },
        { provide: BillingService, useValue: mockBillingService },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  describe('register', () => {
    const dto = {
      cnpj: '12345678000199',
      razaoSocial: 'Auto Center Ltda',
      nomeFantasia: 'Auto Center',
      email: 'owner@autocenter.com',
      password: 'senha123',
      ownerName: 'João Silva',
    };

    it('should create tenant, user and return tokens', async () => {
      mockTenancyService.findByCnpj.mockResolvedValue(null);
      mockUserRepo.findOne.mockResolvedValue(null);

      const tenant = { id: 'tenant-1', schemaName: 'tenant_1', status: TenantStatus.TRIAL };
      mockTenancyService.createTenant.mockResolvedValue(tenant);

      const user = { id: 'user-1', tenantId: 'tenant-1', role: UserRole.OWNER };
      mockUserRepo.create.mockReturnValue(user);
      mockUserRepo.save.mockResolvedValue(user);
      mockRefreshTokenRepo.create.mockReturnValue({});
      mockRefreshTokenRepo.save.mockResolvedValue({});

      mockBillingService.setupTrial.mockResolvedValue(undefined);

      const result = await service.register(dto);

      expect(mockTenancyService.createTenant).toHaveBeenCalledWith(
        expect.objectContaining({ cnpj: dto.cnpj }),
      );
      expect(result).toHaveProperty('access_token');
      expect(result).toHaveProperty('refresh_token');
    });

    it('should throw ConflictException when CNPJ already registered', async () => {
      mockTenancyService.findByCnpj.mockResolvedValue({ id: 'existing' });

      await expect(service.register(dto)).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException when email already registered', async () => {
      mockTenancyService.findByCnpj.mockResolvedValue(null);
      mockUserRepo.findOne.mockResolvedValue({ id: 'existing-user' });

      await expect(service.register(dto)).rejects.toThrow(ConflictException);
    });
  });
});
```

**Step 3: Rodar o teste para confirmar que FALHA**

```bash
cd apps/backend
pnpm test -- --testPathPattern=auth.service.spec
```

Expected: FAIL — `Cannot find module './auth.service'`

**Step 4: Criar `apps/backend/src/modules/core/auth/auth.service.ts`**

```typescript
import {
  Injectable,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { UserEntity, UserRole } from './user.entity';
import { RefreshTokenEntity } from './refresh-token.entity';
import { TenancyService } from '../tenancy/tenancy.service';
import { BillingService } from '../billing/billing.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(RefreshTokenEntity)
    private readonly refreshTokenRepo: Repository<RefreshTokenEntity>,
    private readonly tenancyService: TenancyService,
    private readonly billingService: BillingService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const existingTenant = await this.tenancyService.findByCnpj(dto.cnpj);
    if (existingTenant) throw new ConflictException('CNPJ já cadastrado.');

    const existingUser = await this.userRepo.findOne({ where: { email: dto.email } });
    if (existingUser) throw new ConflictException('E-mail já cadastrado.');

    const tenant = await this.tenancyService.createTenant({
      cnpj: dto.cnpj,
      razaoSocial: dto.razaoSocial,
      nomeFantasia: dto.nomeFantasia,
      telefone: dto.telefone,
      endereco: dto.endereco,
    });

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = this.userRepo.create({
      tenantId: tenant.id,
      email: dto.email,
      passwordHash,
      name: dto.ownerName,
      role: UserRole.OWNER,
    });
    const savedUser = await this.userRepo.save(user);

    await this.billingService.setupTrial(tenant.id, dto.email, dto.nomeFantasia);

    return this.generateTokens(savedUser, tenant.id);
  }

  async login(dto: LoginDto) {
    const user = await this.userRepo.findOne({ where: { email: dto.email } });
    if (!user) throw new UnauthorizedException('Credenciais inválidas.');

    const passwordMatch = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatch) throw new UnauthorizedException('Credenciais inválidas.');

    return this.generateTokens(user, user.tenantId);
  }

  async refresh(refreshToken: string) {
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const stored = await this.refreshTokenRepo.findOne({
      where: { tokenHash, revoked: false },
    });

    if (!stored || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token inválido ou expirado.');
    }

    stored.revoked = true;
    await this.refreshTokenRepo.save(stored);

    const user = await this.userRepo.findOne({ where: { id: stored.userId } });
    if (!user) throw new UnauthorizedException();

    return this.generateTokens(user, user.tenantId);
  }

  async logout(refreshToken: string): Promise<void> {
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    await this.refreshTokenRepo.update({ tokenHash }, { revoked: true });
  }

  private async generateTokens(user: UserEntity, tenantId: string) {
    const payload = { sub: user.id, tenant_id: tenantId, role: user.role };

    const accessToken = this.jwtService.sign(payload, { expiresIn: '15m' });
    const refreshToken = crypto.randomBytes(40).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await this.refreshTokenRepo.save(
      this.refreshTokenRepo.create({ userId: user.id, tokenHash, expiresAt }),
    );

    return { access_token: accessToken, refresh_token: refreshToken };
  }
}
```

**Step 5: Criar `apps/backend/src/modules/core/auth/dto/login.dto.ts`**

```typescript
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;
}
```

**Step 6: Rodar o teste para confirmar que PASSA**

```bash
pnpm test -- --testPathPattern=auth.service.spec
```

Expected: PASS — todos os testes do AuthService.

**Step 7: Criar `apps/backend/src/modules/core/auth/auth.controller.ts`**

```typescript
import { Body, Controller, HttpCode, Post, UseGuards, Request } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(@Body('refresh_token') refreshToken: string) {
    return this.authService.refresh(refreshToken);
  }

  @Post('logout')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard)
  async logout(@Body('refresh_token') refreshToken: string) {
    return this.authService.logout(refreshToken);
  }
}
```

**Step 8: Escrever e rodar os testes do AuthController**

Criar `apps/backend/src/modules/core/auth/auth.controller.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

const mockAuthService = {
  register: jest.fn().mockResolvedValue({ access_token: 'tok', refresh_token: 'ref' }),
  login: jest.fn().mockResolvedValue({ access_token: 'tok', refresh_token: 'ref' }),
  refresh: jest.fn().mockResolvedValue({ access_token: 'tok', refresh_token: 'ref' }),
  logout: jest.fn().mockResolvedValue(undefined),
};

describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    jest.clearAllMocks();
  });

  it('should call register and return tokens', async () => {
    const dto = {
      cnpj: '12345678000199',
      razaoSocial: 'Test',
      nomeFantasia: 'Test',
      email: 'a@b.com',
      password: 'pass1234',
      ownerName: 'Test',
    };
    const result = await controller.register(dto as any);
    expect(mockAuthService.register).toHaveBeenCalledWith(dto);
    expect(result).toHaveProperty('access_token');
  });

  it('should call login and return tokens', async () => {
    const result = await controller.login({ email: 'a@b.com', password: 'pass1234' });
    expect(result).toHaveProperty('access_token');
  });
});
```

```bash
pnpm test -- --testPathPattern=auth.controller.spec
```

Expected: PASS

**Step 9: Criar `apps/backend/src/modules/core/auth/auth.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { UserEntity } from './user.entity';
import { RefreshTokenEntity } from './refresh-token.entity';
import { TenancyModule } from '../tenancy/tenancy.module';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserEntity, RefreshTokenEntity]),
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: config.get<string>('JWT_EXPIRES_IN', '15m') },
      }),
    }),
    TenancyModule,
    BillingModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
```

**Step 10: Adicionar AuthModule ao AppModule**

Editar `apps/backend/src/app.module.ts` — adicionar `AuthModule` ao array `imports` e ao `import`.

**Step 11: Ativar ValidationPipe global em `main.ts`**

Editar `apps/backend/src/main.ts`:

```typescript
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.enableCors();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`Backend running on http://localhost:${port}`);
}
bootstrap();
```

**Step 12: Commit**

```bash
cd ../../
git add apps/backend/src/modules/core/auth/ apps/backend/src/app.module.ts apps/backend/src/main.ts
git commit -m "feat(backend): add Auth module with register, login, refresh and logout endpoints"
```

---

## Task 6: Billing Module — Asaas Integration

**Files:**
- Create: `apps/backend/src/modules/core/billing/billing.service.ts`
- Create: `apps/backend/src/modules/core/billing/billing.service.spec.ts`
- Create: `apps/backend/src/modules/core/billing/billing.module.ts`

**Step 1: Adicionar variáveis Asaas ao `.env` e `.env.example`**

Adicionar ao `apps/backend/.env`:
```env
ASAAS_API_KEY=mock
ASAAS_API_URL=https://sandbox.asaas.com/api/v3
ASAAS_PLAN_VALUE=69.90
```

Fazer o mesmo em `apps/backend/.env.example`.

**Step 2: Escrever testes do BillingService ANTES de implementar**

Criar `apps/backend/src/modules/core/billing/billing.service.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BillingService } from './billing.service';
import { BillingEntity } from './billing.entity';

const mockBillingRepo = {
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
};

const mockConfigService = {
  get: jest.fn((key: string) => {
    const map: Record<string, string> = {
      ASAAS_API_KEY: 'mock',
      ASAAS_API_URL: 'https://sandbox.asaas.com/api/v3',
      ASAAS_PLAN_VALUE: '69.90',
    };
    return map[key];
  }),
};

describe('BillingService', () => {
  let service: BillingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillingService,
        { provide: getRepositoryToken(BillingEntity), useValue: mockBillingRepo },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<BillingService>(BillingService);
    jest.clearAllMocks();
  });

  describe('setupTrial', () => {
    it('should create billing record with mock Asaas data when API key is "mock"', async () => {
      const billing = { id: 'billing-1', tenantId: 'tenant-1' };
      mockBillingRepo.create.mockReturnValue(billing);
      mockBillingRepo.save.mockResolvedValue(billing);

      await service.setupTrial('tenant-1', 'owner@test.com', 'Auto Center');

      expect(mockBillingRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: 'tenant-1' }),
      );
    });
  });
});
```

**Step 3: Rodar para confirmar que FALHA**

```bash
cd apps/backend
pnpm test -- --testPathPattern=billing.service.spec
```

Expected: FAIL

**Step 4: Criar `apps/backend/src/modules/core/billing/billing.service.ts`**

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { BillingEntity } from './billing.entity';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private readonly isMock: boolean;

  constructor(
    @InjectRepository(BillingEntity)
    private readonly billingRepo: Repository<BillingEntity>,
    private readonly config: ConfigService,
  ) {
    this.isMock = this.config.get<string>('ASAAS_API_KEY') === 'mock';
    if (this.isMock) {
      this.logger.warn('Asaas rodando em modo MOCK. Nenhuma cobrança real será criada.');
    }
  }

  async setupTrial(tenantId: string, email: string, name: string): Promise<void> {
    let asaasCustomerId = `mock_customer_${tenantId}`;
    let asaasSubscriptionId = `mock_subscription_${tenantId}`;

    if (!this.isMock) {
      const apiKey = this.config.get<string>('ASAAS_API_KEY');
      const baseUrl = this.config.get<string>('ASAAS_API_URL');
      const planValue = this.config.get<string>('ASAAS_PLAN_VALUE', '69.90');

      const customerRes = await fetch(`${baseUrl}/customers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          access_token: apiKey,
        },
        body: JSON.stringify({ name, email }),
      });
      const customer = await customerRes.json();
      asaasCustomerId = customer.id;

      const today = new Date();
      const dueDate = new Date(today.setDate(today.getDate() + 30));
      const dueDateStr = dueDate.toISOString().split('T')[0];

      const subRes = await fetch(`${baseUrl}/subscriptions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          access_token: apiKey,
        },
        body: JSON.stringify({
          customer: asaasCustomerId,
          billingType: 'CREDIT_CARD',
          value: parseFloat(planValue),
          nextDueDate: dueDateStr,
          cycle: 'MONTHLY',
          description: 'Plano Praktikus — R$69,90/mês',
          trialPeriodDays: 30,
        }),
      });
      const subscription = await subRes.json();
      asaasSubscriptionId = subscription.id;
    }

    await this.billingRepo.save(
      this.billingRepo.create({ tenantId, asaasCustomerId, asaasSubscriptionId }),
    );
  }
}
```

**Step 5: Criar `apps/backend/src/modules/core/billing/billing.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BillingEntity } from './billing.entity';
import { BillingService } from './billing.service';

@Module({
  imports: [TypeOrmModule.forFeature([BillingEntity])],
  providers: [BillingService],
  exports: [BillingService],
})
export class BillingModule {}
```

**Step 6: Rodar para confirmar que PASSA**

```bash
pnpm test -- --testPathPattern=billing.service.spec
```

Expected: PASS

**Step 7: Commit**

```bash
cd ../../
git add apps/backend/src/modules/core/billing/
git commit -m "feat(backend): add BillingModule with Asaas integration (mock mode for dev)"
```

---

## Task 7: Workshop Companies Module — Profile Endpoint (TDD)

**Files:**
- Create: `apps/backend/src/modules/workshop/companies/dto/update-company.dto.ts`
- Create: `apps/backend/src/modules/workshop/companies/companies.service.ts`
- Create: `apps/backend/src/modules/workshop/companies/companies.service.spec.ts`
- Create: `apps/backend/src/modules/workshop/companies/companies.controller.ts`
- Create: `apps/backend/src/modules/workshop/companies/companies.module.ts`

**Contexto:** Os dados da oficina (CNPJ, logo, endereço) ficam em `public.tenants`. O módulo de companies é apenas uma fachada que lê e atualiza esses dados para o tenant autenticado.

**Step 1: Criar `apps/backend/src/modules/workshop/companies/dto/update-company.dto.ts`**

```typescript
import { IsString, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { AddressDto } from '../../core/auth/dto/register.dto';

export class UpdateCompanyDto {
  @IsOptional()
  @IsString()
  nomeFantasia?: string;

  @IsOptional()
  @IsString()
  razaoSocial?: string;

  @IsOptional()
  @IsString()
  telefone?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => AddressDto)
  endereco?: AddressDto;
}
```

**Step 2: Escrever testes do CompaniesService ANTES de implementar**

Criar `apps/backend/src/modules/workshop/companies/companies.service.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { CompaniesService } from './companies.service';
import { TenancyService } from '../../core/tenancy/tenancy.service';
import { TenantStatus } from '../../core/tenancy/tenant.entity';

const mockTenancyService = {
  findById: jest.fn(),
  tenantRepo: { save: jest.fn() },
};

describe('CompaniesService', () => {
  let service: CompaniesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CompaniesService,
        { provide: TenancyService, useValue: mockTenancyService },
      ],
    }).compile();

    service = module.get<CompaniesService>(CompaniesService);
    jest.clearAllMocks();
  });

  describe('getProfile', () => {
    it('should return tenant as company profile', async () => {
      const tenant = { id: 'tenant-1', nomeFantasia: 'Auto Center', status: TenantStatus.ACTIVE };
      mockTenancyService.findById.mockResolvedValue(tenant);

      const result = await service.getProfile('tenant-1');
      expect(result).toEqual(tenant);
    });

    it('should throw NotFoundException if tenant not found', async () => {
      mockTenancyService.findById.mockResolvedValue(null);
      await expect(service.getProfile('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });
});
```

**Step 3: Rodar para confirmar que FALHA**

```bash
cd apps/backend
pnpm test -- --testPathPattern=companies.service.spec
```

Expected: FAIL

**Step 4: Criar `apps/backend/src/modules/workshop/companies/companies.service.ts`**

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenancyService } from '../../core/tenancy/tenancy.service';
import { TenantEntity } from '../../core/tenancy/tenant.entity';
import { UpdateCompanyDto } from './dto/update-company.dto';

@Injectable()
export class CompaniesService {
  constructor(
    private readonly tenancyService: TenancyService,
    @InjectRepository(TenantEntity)
    private readonly tenantRepo: Repository<TenantEntity>,
  ) {}

  async getProfile(tenantId: string): Promise<TenantEntity> {
    const tenant = await this.tenancyService.findById(tenantId);
    if (!tenant) throw new NotFoundException('Oficina não encontrada.');
    return tenant;
  }

  async updateProfile(tenantId: string, dto: UpdateCompanyDto): Promise<TenantEntity> {
    const tenant = await this.getProfile(tenantId);
    Object.assign(tenant, dto);
    return this.tenantRepo.save(tenant);
  }

  async updateLogo(tenantId: string, logoUrl: string): Promise<TenantEntity> {
    const tenant = await this.getProfile(tenantId);
    tenant.logoUrl = logoUrl;
    return this.tenantRepo.save(tenant);
  }
}
```

**Step 5: Rodar para confirmar que PASSA**

```bash
pnpm test -- --testPathPattern=companies.service.spec
```

Expected: PASS

**Step 6: Criar `apps/backend/src/modules/workshop/companies/companies.controller.ts`**

```typescript
import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Request,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { RolesGuard } from '../../core/auth/roles.guard';
import { Roles } from '../../core/auth/roles.decorator';
import { UserRole } from '../../core/auth/user.entity';
import { CompaniesService } from './companies.service';
import { UpdateCompanyDto } from './dto/update-company.dto';

@Controller('workshop/company')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Get()
  getProfile(@Request() req: any) {
    return this.companiesService.getProfile(req.user.tenantId);
  }

  @Patch()
  @Roles(UserRole.OWNER)
  updateProfile(@Request() req: any, @Body() dto: UpdateCompanyDto) {
    return this.companiesService.updateProfile(req.user.tenantId, dto);
  }

  @Post('logo')
  @Roles(UserRole.OWNER)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: join(process.cwd(), 'uploads', 'logos'),
        filename: (_req, file, cb) => {
          const uniqueName = `${Date.now()}${extname(file.originalname)}`;
          cb(null, uniqueName);
        },
      }),
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png)$/)) {
          return cb(new Error('Apenas JPG e PNG são permitidos.'), false);
        }
        cb(null, true);
      },
      limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
    }),
  )
  uploadLogo(@Request() req: any, @UploadedFile() file: Express.Multer.File) {
    const logoUrl = `/uploads/logos/${file.filename}`;
    return this.companiesService.updateLogo(req.user.tenantId, logoUrl);
  }
}
```

**Step 7: Criar `apps/backend/src/modules/workshop/companies/companies.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { TenantEntity } from '../../core/tenancy/tenant.entity';
import { TenancyModule } from '../../core/tenancy/tenancy.module';
import { CompaniesService } from './companies.service';
import { CompaniesController } from './companies.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([TenantEntity]),
    TenancyModule,
    MulterModule.register({ dest: './uploads' }),
  ],
  controllers: [CompaniesController],
  providers: [CompaniesService],
})
export class CompaniesModule {}
```

**Step 8: Instalar multer**

```bash
cd apps/backend
pnpm add multer @nestjs/platform-express
pnpm add -D @types/multer
```

**Step 9: Adicionar CompaniesModule ao AppModule**

Editar `apps/backend/src/app.module.ts` — adicionar import de `CompaniesModule`.

**Step 10: Servir arquivos estáticos no `main.ts`**

Adicionar em `apps/backend/src/main.ts` após criar o app:

```typescript
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';

const app = await NestFactory.create<NestExpressApplication>(AppModule);
app.useStaticAssets(join(__dirname, '..', 'uploads'), { prefix: '/uploads' });
```

**Step 11: Commit**

```bash
cd ../../
git add apps/backend/src/modules/workshop/
git commit -m "feat(backend): add WorkshopCompanies module with profile and logo upload"
```

---

## Task 8: Frontend — Auth API Service + Zustand Store

**Files:**
- Create: `apps/frontend/src/services/api.ts`
- Create: `apps/frontend/src/services/auth.service.ts`
- Create: `apps/frontend/src/services/auth.service.test.ts`
- Create: `apps/frontend/src/store/auth.store.ts`
- Create: `apps/frontend/src/store/auth.store.test.ts`

**Step 1: Instalar dependências do frontend**

```bash
cd apps/frontend
pnpm add axios zustand react-hook-form @hookform/resolvers zod jwt-decode
```

**Step 2: Criar `apps/frontend/src/services/api.ts`**

```typescript
import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      const refreshToken = localStorage.getItem('refresh_token');
      if (refreshToken) {
        try {
          const { data } = await axios.post('/api/auth/refresh', {
            refresh_token: refreshToken,
          });
          localStorage.setItem('access_token', data.access_token);
          localStorage.setItem('refresh_token', data.refresh_token);
          original.headers.Authorization = `Bearer ${data.access_token}`;
          return api(original);
        } catch {
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  },
);
```

**Step 3: Criar `apps/frontend/src/services/auth.service.ts`**

```typescript
import { api } from './api';

export interface RegisterPayload {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string;
  email: string;
  password: string;
  ownerName: string;
  telefone?: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
}

export const authService = {
  async register(payload: RegisterPayload): Promise<AuthTokens> {
    const { data } = await api.post<AuthTokens>('/auth/register', payload);
    return data;
  },

  async login(payload: LoginPayload): Promise<AuthTokens> {
    const { data } = await api.post<AuthTokens>('/auth/login', payload);
    return data;
  },

  async logout(refreshToken: string): Promise<void> {
    await api.post('/auth/logout', { refresh_token: refreshToken });
  },

  persistTokens(tokens: AuthTokens): void {
    localStorage.setItem('access_token', tokens.access_token);
    localStorage.setItem('refresh_token', tokens.refresh_token);
  },

  clearTokens(): void {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
  },

  getAccessToken(): string | null {
    return localStorage.getItem('access_token');
  },

  isAuthenticated(): boolean {
    return !!localStorage.getItem('access_token');
  },
};
```

**Step 4: Escrever testes do authService ANTES de implementar**

Criar `apps/frontend/src/services/auth.service.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./api', () => ({
  api: {
    post: vi.fn(),
  },
}));

import { authService } from './auth.service';
import { api } from './api';

const mockApi = api as any;

describe('authService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('should persist tokens to localStorage', () => {
    authService.persistTokens({ access_token: 'acc', refresh_token: 'ref' });
    expect(localStorage.getItem('access_token')).toBe('acc');
    expect(localStorage.getItem('refresh_token')).toBe('ref');
  });

  it('should clear tokens from localStorage', () => {
    localStorage.setItem('access_token', 'tok');
    authService.clearTokens();
    expect(localStorage.getItem('access_token')).toBeNull();
  });

  it('should return true for isAuthenticated when token exists', () => {
    localStorage.setItem('access_token', 'tok');
    expect(authService.isAuthenticated()).toBe(true);
  });

  it('should return false for isAuthenticated when no token', () => {
    expect(authService.isAuthenticated()).toBe(false);
  });

  it('should call api.post on login', async () => {
    mockApi.post.mockResolvedValue({ data: { access_token: 'a', refresh_token: 'r' } });
    const result = await authService.login({ email: 'a@b.com', password: 'pass1234' });
    expect(mockApi.post).toHaveBeenCalledWith('/auth/login', expect.any(Object));
    expect(result.access_token).toBe('a');
  });
});
```

**Step 5: Rodar o teste**

```bash
cd apps/frontend
pnpm test -- auth.service
```

Expected: PASS

**Step 6: Criar `apps/frontend/src/store/auth.store.ts`**

```typescript
import { create } from 'zustand';
import { jwtDecode } from 'jwt-decode';
import { authService } from '../services/auth.service';

interface JwtUser {
  sub: string;
  tenant_id: string;
  role: 'OWNER' | 'EMPLOYEE';
}

interface AuthState {
  user: JwtUser | null;
  isAuthenticated: boolean;
  setTokens: (tokens: { access_token: string; refresh_token: string }) => void;
  logout: () => Promise<void>;
  hydrate: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,

  setTokens(tokens) {
    authService.persistTokens(tokens);
    const decoded = jwtDecode<JwtUser>(tokens.access_token);
    set({ user: decoded, isAuthenticated: true });
  },

  async logout() {
    const refreshToken = localStorage.getItem('refresh_token');
    if (refreshToken) {
      try {
        await authService.logout(refreshToken);
      } catch {
        // silently ignore
      }
    }
    authService.clearTokens();
    set({ user: null, isAuthenticated: false });
  },

  hydrate() {
    const token = authService.getAccessToken();
    if (token) {
      try {
        const decoded = jwtDecode<JwtUser>(token);
        const isExpired = decoded.exp ? decoded.exp * 1000 < Date.now() : false;
        if (!isExpired) {
          set({ user: decoded, isAuthenticated: true });
        } else {
          authService.clearTokens();
        }
      } catch {
        authService.clearTokens();
      }
    }
  },
}));
```

**Step 7: Commit**

```bash
cd ../../
git add apps/frontend/src/services/ apps/frontend/src/store/
git commit -m "feat(frontend): add auth API service and Zustand auth store"
```

---

## Task 9: Frontend — Login Page (TDD)

**Files:**
- Create: `apps/frontend/src/pages/auth/LoginPage.tsx`
- Create: `apps/frontend/src/pages/auth/LoginPage.test.tsx`

**Step 1: Escrever os testes da LoginPage ANTES de implementar**

Criar `apps/frontend/src/pages/auth/LoginPage.test.tsx`:

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LoginPage } from './LoginPage';

vi.mock('../../services/auth.service', () => ({
  authService: {
    login: vi.fn(),
  },
}));

vi.mock('../../store/auth.store', () => ({
  useAuthStore: vi.fn(() => ({
    setTokens: vi.fn(),
  })),
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual as object, useNavigate: () => mockNavigate };
});

import { authService } from '../../services/auth.service';
const mockAuthService = authService as any;

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderLogin = () =>
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

  it('renders email and password fields', () => {
    renderLogin();
    expect(screen.getByLabelText(/e-mail/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/senha/i)).toBeInTheDocument();
  });

  it('shows validation error when submitting empty form', async () => {
    renderLogin();
    fireEvent.click(screen.getByRole('button', { name: /entrar/i }));
    await waitFor(() => {
      expect(screen.getByText(/e-mail/i)).toBeInTheDocument();
    });
  });

  it('calls authService.login with form values', async () => {
    mockAuthService.login.mockResolvedValue({ access_token: 'tok', refresh_token: 'ref' });
    renderLogin();

    fireEvent.change(screen.getByLabelText(/e-mail/i), {
      target: { value: 'owner@test.com' },
    });
    fireEvent.change(screen.getByLabelText(/senha/i), {
      target: { value: 'senha1234' },
    });
    fireEvent.click(screen.getByRole('button', { name: /entrar/i }));

    await waitFor(() => {
      expect(mockAuthService.login).toHaveBeenCalledWith({
        email: 'owner@test.com',
        password: 'senha1234',
      });
    });
  });

  it('navigates to dashboard on successful login', async () => {
    mockAuthService.login.mockResolvedValue({ access_token: 'tok', refresh_token: 'ref' });
    renderLogin();

    fireEvent.change(screen.getByLabelText(/e-mail/i), { target: { value: 'a@b.com' } });
    fireEvent.change(screen.getByLabelText(/senha/i), { target: { value: 'pass1234' } });
    fireEvent.click(screen.getByRole('button', { name: /entrar/i }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/workshop/dashboard');
    });
  });

  it('shows error message on failed login', async () => {
    mockAuthService.login.mockRejectedValue({
      response: { data: { message: 'Credenciais inválidas.' } },
    });
    renderLogin();

    fireEvent.change(screen.getByLabelText(/e-mail/i), { target: { value: 'a@b.com' } });
    fireEvent.change(screen.getByLabelText(/senha/i), { target: { value: 'wrongpass' } });
    fireEvent.click(screen.getByRole('button', { name: /entrar/i }));

    await waitFor(() => {
      expect(screen.getByText(/credenciais inválidas/i)).toBeInTheDocument();
    });
  });
});
```

**Step 2: Rodar para confirmar que FALHA**

```bash
cd apps/frontend
pnpm test -- LoginPage
```

Expected: FAIL — `Cannot find module './LoginPage'`

**Step 3: Criar `apps/frontend/src/pages/auth/LoginPage.tsx`**

```typescript
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Box, Button, Card, CardContent, TextField, Typography, Alert, CircularProgress,
} from '@mui/material';
import { authService } from '../../services/auth.service';
import { useAuthStore } from '../../store/auth.store';

const schema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(8, 'Senha deve ter no mínimo 8 caracteres'),
});

type FormData = z.infer<typeof schema>;

export function LoginPage() {
  const navigate = useNavigate();
  const setTokens = useAuthStore((s) => s.setTokens);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    setError(null);
    try {
      const tokens = await authService.login(data);
      setTokens(tokens);
      navigate('/workshop/dashboard');
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Erro ao fazer login.');
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 2,
      }}
    >
      <Card sx={{ width: '100%', maxWidth: 420 }}>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h5" fontWeight="bold" textAlign="center" mb={1}>
            Praktikus
          </Typography>
          <Typography variant="body2" color="text.secondary" textAlign="center" mb={3}>
            Acesse sua conta
          </Typography>

          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
            <TextField
              label="E-mail"
              type="email"
              fullWidth
              margin="normal"
              inputProps={{ 'aria-label': 'E-mail' }}
              {...register('email')}
              error={!!errors.email}
              helperText={errors.email?.message}
            />
            <TextField
              label="Senha"
              type="password"
              fullWidth
              margin="normal"
              inputProps={{ 'aria-label': 'Senha' }}
              {...register('password')}
              error={!!errors.password}
              helperText={errors.password?.message}
            />
            <Button
              type="submit"
              variant="contained"
              fullWidth
              size="large"
              disabled={isSubmitting}
              sx={{ mt: 2 }}
            >
              {isSubmitting ? <CircularProgress size={24} /> : 'Entrar'}
            </Button>
          </Box>

          <Typography variant="body2" textAlign="center" mt={2}>
            Não tem conta?{' '}
            <Link to="/register" style={{ color: 'inherit' }}>
              Cadastre sua oficina
            </Link>
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
}
```

**Step 4: Rodar para confirmar que PASSA**

```bash
pnpm test -- LoginPage
```

Expected: PASS — todos os testes da LoginPage.

**Step 5: Commit**

```bash
cd ../../
git add apps/frontend/src/pages/auth/LoginPage.tsx apps/frontend/src/pages/auth/LoginPage.test.tsx
git commit -m "feat(frontend): add LoginPage with form validation and auth integration"
```

---

## Task 10: Frontend — Register/Onboarding Page (TDD)

**Files:**
- Create: `apps/frontend/src/pages/auth/RegisterPage.tsx`
- Create: `apps/frontend/src/pages/auth/RegisterPage.test.tsx`

**Step 1: Escrever os testes da RegisterPage ANTES de implementar**

Criar `apps/frontend/src/pages/auth/RegisterPage.test.tsx`:

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RegisterPage } from './RegisterPage';

vi.mock('../../services/auth.service', () => ({
  authService: { register: vi.fn() },
}));

vi.mock('../../store/auth.store', () => ({
  useAuthStore: vi.fn(() => ({ setTokens: vi.fn() })),
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual as object, useNavigate: () => mockNavigate };
});

import { authService } from '../../services/auth.service';
const mockAuthService = authService as any;

describe('RegisterPage', () => {
  beforeEach(() => vi.clearAllMocks());

  const renderPage = () =>
    render(<MemoryRouter><RegisterPage /></MemoryRouter>);

  it('renders step 1 with company fields', () => {
    renderPage();
    expect(screen.getByLabelText(/cnpj/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/raz[aã]o social/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/nome fantasia/i)).toBeInTheDocument();
  });

  it('shows CNPJ validation error for invalid input', async () => {
    renderPage();
    fireEvent.change(screen.getByLabelText(/cnpj/i), { target: { value: '123' } });
    fireEvent.click(screen.getByRole('button', { name: /pr[oó]ximo/i }));
    await waitFor(() => {
      expect(screen.getByText(/14 d[ií]gitos/i)).toBeInTheDocument();
    });
  });

  it('advances to step 2 after valid step 1', async () => {
    renderPage();
    fireEvent.change(screen.getByLabelText(/cnpj/i), { target: { value: '12345678000199' } });
    fireEvent.change(screen.getByLabelText(/raz[aã]o social/i), { target: { value: 'Auto Center Ltda' } });
    fireEvent.change(screen.getByLabelText(/nome fantasia/i), { target: { value: 'Auto Center' } });
    fireEvent.click(screen.getByRole('button', { name: /pr[oó]ximo/i }));
    await waitFor(() => {
      expect(screen.getByLabelText(/e-mail/i)).toBeInTheDocument();
    });
  });
});
```

**Step 2: Rodar para confirmar que FALHA**

```bash
cd apps/frontend
pnpm test -- RegisterPage
```

Expected: FAIL

**Step 3: Criar `apps/frontend/src/pages/auth/RegisterPage.tsx`**

```typescript
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Box, Button, Card, CardContent, TextField, Typography, Alert,
  Stepper, Step, StepLabel, CircularProgress,
} from '@mui/material';
import { authService } from '../../services/auth.service';
import { useAuthStore } from '../../store/auth.store';

const step1Schema = z.object({
  cnpj: z.string().regex(/^\d{14}$/, 'CNPJ deve conter 14 dígitos numéricos'),
  razaoSocial: z.string().min(3, 'Razão Social deve ter no mínimo 3 caracteres'),
  nomeFantasia: z.string().min(2, 'Nome Fantasia deve ter no mínimo 2 caracteres'),
  telefone: z.string().optional(),
});

const step2Schema = z.object({
  ownerName: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres'),
  email: z.string().email('E-mail inválido'),
  password: z.string().min(8, 'Senha deve ter no mínimo 8 caracteres'),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'As senhas não coincidem',
  path: ['confirmPassword'],
});

type Step1Data = z.infer<typeof step1Schema>;
type Step2Data = z.infer<typeof step2Schema>;

const steps = ['Dados da Oficina', 'Dados do Responsável'];

export function RegisterPage() {
  const navigate = useNavigate();
  const setTokens = useAuthStore((s) => s.setTokens);
  const [activeStep, setActiveStep] = useState(0);
  const [step1Data, setStep1Data] = useState<Step1Data | null>(null);
  const [error, setError] = useState<string | null>(null);

  const form1 = useForm<Step1Data>({ resolver: zodResolver(step1Schema) });
  const form2 = useForm<Step2Data>({ resolver: zodResolver(step2Schema) });

  const onStep1Submit = (data: Step1Data) => {
    setStep1Data(data);
    setActiveStep(1);
  };

  const onStep2Submit = async (data: Step2Data) => {
    if (!step1Data) return;
    setError(null);
    try {
      const tokens = await authService.register({ ...step1Data, ...data });
      setTokens(tokens);
      navigate('/workshop/dashboard');
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Erro ao cadastrar.');
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }}>
      <Card sx={{ width: '100%', maxWidth: 520 }}>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h5" fontWeight="bold" textAlign="center" mb={1}>
            Praktikus
          </Typography>
          <Typography variant="body2" color="text.secondary" textAlign="center" mb={3}>
            Cadastre sua oficina — 30 dias grátis
          </Typography>

          <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
            {steps.map((label) => (
              <Step key={label}><StepLabel>{label}</StepLabel></Step>
            ))}
          </Stepper>

          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          {activeStep === 0 && (
            <Box component="form" onSubmit={form1.handleSubmit(onStep1Submit)} noValidate>
              <TextField
                label="CNPJ"
                fullWidth
                margin="normal"
                inputProps={{ 'aria-label': 'CNPJ' }}
                placeholder="Apenas números (14 dígitos)"
                {...form1.register('cnpj')}
                error={!!form1.formState.errors.cnpj}
                helperText={form1.formState.errors.cnpj?.message}
              />
              <TextField
                label="Razão Social"
                fullWidth
                margin="normal"
                inputProps={{ 'aria-label': 'Razão Social' }}
                {...form1.register('razaoSocial')}
                error={!!form1.formState.errors.razaoSocial}
                helperText={form1.formState.errors.razaoSocial?.message}
              />
              <TextField
                label="Nome Fantasia"
                fullWidth
                margin="normal"
                inputProps={{ 'aria-label': 'Nome Fantasia' }}
                {...form1.register('nomeFantasia')}
                error={!!form1.formState.errors.nomeFantasia}
                helperText={form1.formState.errors.nomeFantasia?.message}
              />
              <TextField
                label="Telefone"
                fullWidth
                margin="normal"
                {...form1.register('telefone')}
              />
              <Button type="submit" variant="contained" fullWidth size="large" sx={{ mt: 2 }}>
                Próximo
              </Button>
            </Box>
          )}

          {activeStep === 1 && (
            <Box component="form" onSubmit={form2.handleSubmit(onStep2Submit)} noValidate>
              <TextField
                label="Seu nome"
                fullWidth
                margin="normal"
                inputProps={{ 'aria-label': 'Seu nome' }}
                {...form2.register('ownerName')}
                error={!!form2.formState.errors.ownerName}
                helperText={form2.formState.errors.ownerName?.message}
              />
              <TextField
                label="E-mail"
                type="email"
                fullWidth
                margin="normal"
                inputProps={{ 'aria-label': 'E-mail' }}
                {...form2.register('email')}
                error={!!form2.formState.errors.email}
                helperText={form2.formState.errors.email?.message}
              />
              <TextField
                label="Senha"
                type="password"
                fullWidth
                margin="normal"
                inputProps={{ 'aria-label': 'Senha' }}
                {...form2.register('password')}
                error={!!form2.formState.errors.password}
                helperText={form2.formState.errors.password?.message}
              />
              <TextField
                label="Confirmar senha"
                type="password"
                fullWidth
                margin="normal"
                {...form2.register('confirmPassword')}
                error={!!form2.formState.errors.confirmPassword}
                helperText={form2.formState.errors.confirmPassword?.message}
              />
              <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
                <Button variant="outlined" fullWidth onClick={() => setActiveStep(0)}>
                  Voltar
                </Button>
                <Button
                  type="submit"
                  variant="contained"
                  fullWidth
                  size="large"
                  disabled={form2.formState.isSubmitting}
                >
                  {form2.formState.isSubmitting ? <CircularProgress size={24} /> : 'Cadastrar'}
                </Button>
              </Box>
            </Box>
          )}

          <Typography variant="body2" textAlign="center" mt={2}>
            Já tem conta?{' '}
            <Link to="/login" style={{ color: 'inherit' }}>
              Entrar
            </Link>
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
}
```

**Step 4: Rodar para confirmar que PASSA**

```bash
pnpm test -- RegisterPage
```

Expected: PASS — todos os testes da RegisterPage.

**Step 5: Commit**

```bash
cd ../../
git add apps/frontend/src/pages/auth/RegisterPage.tsx apps/frontend/src/pages/auth/RegisterPage.test.tsx
git commit -m "feat(frontend): add RegisterPage with multi-step onboarding form"
```

---

## Task 11: Frontend — Protected Routes + App Layout + Dashboard Placeholder

**Files:**
- Create: `apps/frontend/src/components/PrivateRoute.tsx`
- Create: `apps/frontend/src/components/PrivateRoute.test.tsx`
- Create: `apps/frontend/src/layouts/AppLayout.tsx`
- Create: `apps/frontend/src/pages/workshop/DashboardPage.tsx`
- Modify: `apps/frontend/src/App.tsx`

**Step 1: Escrever teste do PrivateRoute ANTES de implementar**

Criar `apps/frontend/src/components/PrivateRoute.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import { PrivateRoute } from './PrivateRoute';

vi.mock('../store/auth.store', () => ({
  useAuthStore: vi.fn(),
}));

import { useAuthStore } from '../store/auth.store';
const mockUseAuthStore = useAuthStore as any;

describe('PrivateRoute', () => {
  it('renders children when authenticated', () => {
    mockUseAuthStore.mockReturnValue({ isAuthenticated: true });
    render(
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route path="/protected" element={<PrivateRoute><div>Protected Content</div></PrivateRoute>} />
          <Route path="/login" element={<div>Login</div>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('redirects to /login when not authenticated', () => {
    mockUseAuthStore.mockReturnValue({ isAuthenticated: false });
    render(
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route path="/protected" element={<PrivateRoute><div>Protected Content</div></PrivateRoute>} />
          <Route path="/login" element={<div>Login Page</div>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    expect(screen.getByText('Login Page')).toBeInTheDocument();
  });
});
```

**Step 2: Rodar para confirmar que FALHA**

```bash
cd apps/frontend
pnpm test -- PrivateRoute
```

Expected: FAIL

**Step 3: Criar `apps/frontend/src/components/PrivateRoute.tsx`**

```typescript
import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';

interface Props {
  children: ReactNode;
}

export function PrivateRoute({ children }: Props) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
```

**Step 4: Rodar para confirmar que PASSA**

```bash
pnpm test -- PrivateRoute
```

Expected: PASS

**Step 5: Criar `apps/frontend/src/layouts/AppLayout.tsx`**

```typescript
import { useState } from 'react';
import { Outlet, useNavigate, Link, useLocation } from 'react-router-dom';
import {
  Box, Drawer, List, ListItem, ListItemButton, ListItemIcon, ListItemText,
  AppBar, Toolbar, Typography, IconButton, Divider,
} from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import EventIcon from '@mui/icons-material/Event';
import AssignmentIcon from '@mui/icons-material/Assignment';
import PeopleIcon from '@mui/icons-material/People';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import InventoryIcon from '@mui/icons-material/Inventory';
import BarChartIcon from '@mui/icons-material/BarChart';
import SettingsIcon from '@mui/icons-material/Settings';
import LogoutIcon from '@mui/icons-material/Logout';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import { useAuthStore } from '../store/auth.store';
import { useThemeMode } from '../theme/ThemeProvider';

const DRAWER_WIDTH = 240;

const navItems = [
  { label: 'Dashboard', icon: <DashboardIcon />, path: '/workshop/dashboard' },
  { label: 'Agendamentos', icon: <EventIcon />, path: '/workshop/appointments' },
  { label: 'Ordens de Serviço', icon: <AssignmentIcon />, path: '/workshop/service-orders' },
  { label: 'Clientes', icon: <PeopleIcon />, path: '/workshop/customers' },
  { label: 'Veículos', icon: <DirectionsCarIcon />, path: '/workshop/vehicles' },
  { label: 'Catálogo', icon: <InventoryIcon />, path: '/workshop/catalog' },
  { label: 'Relatórios', icon: <BarChartIcon />, path: '/workshop/reports' },
  { label: 'Configurações', icon: <SettingsIcon />, path: '/workshop/settings' },
];

export function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const logout = useAuthStore((s) => s.logout);
  const { toggleTheme } = useThemeMode();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
        <Toolbar sx={{ justifyContent: 'space-between' }}>
          <Typography variant="h6" fontWeight="bold" color="primary">
            Praktikus
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <IconButton onClick={toggleTheme} color="inherit"><Brightness4Icon /></IconButton>
            <IconButton onClick={handleLogout} color="inherit"><LogoutIcon /></IconButton>
          </Box>
        </Toolbar>
      </AppBar>

      <Drawer
        variant="permanent"
        sx={{
          width: DRAWER_WIDTH,
          '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box' },
        }}
      >
        <Toolbar />
        <Box sx={{ overflow: 'auto' }}>
          <List>
            {navItems.map((item) => (
              <ListItem key={item.label} disablePadding>
                <ListItemButton
                  component={Link}
                  to={item.path}
                  selected={location.pathname === item.path}
                >
                  <ListItemIcon>{item.icon}</ListItemIcon>
                  <ListItemText primary={item.label} />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
          <Divider />
        </Box>
      </Drawer>

      <Box component="main" sx={{ flexGrow: 1, p: 3, ml: `${DRAWER_WIDTH}px` }}>
        <Toolbar />
        <Outlet />
      </Box>
    </Box>
  );
}
```

**Step 6: Criar `apps/frontend/src/pages/workshop/DashboardPage.tsx`**

```typescript
import { Box, Card, CardContent, Grid, Typography } from '@mui/material';
import AssignmentIcon from '@mui/icons-material/Assignment';
import EventIcon from '@mui/icons-material/Event';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';

export function DashboardPage() {
  const cards = [
    { label: 'OS Abertas', value: '—', icon: <AssignmentIcon fontSize="large" color="primary" /> },
    { label: 'Agendamentos Hoje', value: '—', icon: <EventIcon fontSize="large" color="primary" /> },
    { label: 'Faturamento do Mês', value: '—', icon: <AttachMoneyIcon fontSize="large" color="primary" /> },
  ];

  return (
    <Box>
      <Typography variant="h5" fontWeight="bold" mb={3}>
        Dashboard
      </Typography>
      <Grid container spacing={3}>
        {cards.map((card) => (
          <Grid item xs={12} sm={6} md={4} key={card.label}>
            <Card>
              <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                {card.icon}
                <Box>
                  <Typography variant="h4" fontWeight="bold">{card.value}</Typography>
                  <Typography variant="body2" color="text.secondary">{card.label}</Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
```

**Step 7: Atualizar `apps/frontend/src/App.tsx` com todas as rotas**

```typescript
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { AppThemeProvider } from './theme/ThemeProvider';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { AppLayout } from './layouts/AppLayout';
import { DashboardPage } from './pages/workshop/DashboardPage';
import { PrivateRoute } from './components/PrivateRoute';
import { useAuthStore } from './store/auth.store';

function App() {
  const hydrate = useAuthStore((s) => s.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  return (
    <AppThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route
            path="/workshop"
            element={
              <PrivateRoute>
                <AppLayout />
              </PrivateRoute>
            }
          >
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AppThemeProvider>
  );
}

export default App;
```

**Step 8: Rodar todos os testes do frontend**

```bash
cd apps/frontend
pnpm test
```

Expected: PASS — todos os testes existentes ainda passando.

**Step 9: Commit**

```bash
cd ../../
git add apps/frontend/src/
git commit -m "feat(frontend): add PrivateRoute, AppLayout with sidebar and DashboardPage placeholder"
```

---

## Task 12: Atualizar `.env` e Validação Final

**Step 1: Garantir que o `.env` raiz tem todas as variáveis necessárias**

Editar `.env` e `.env.example` na raiz:

```env
# PostgreSQL
POSTGRES_USER=Praktikus
POSTGRES_PASSWORD=Praktikus_dev
POSTGRES_DB=Praktikus

# Redis
REDIS_PORT=6379

# Backend
PORT=3000
NODE_ENV=development
DB_HOST=postgres
DB_PORT=5432
DB_USER=Praktikus
DB_PASS=Praktikus_dev
DB_NAME=Praktikus
REDIS_HOST=redis
JWT_SECRET=dev_secret_change_in_production_min_32_chars
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=30d

# Asaas (usar "mock" para desenvolvimento local)
ASAAS_API_KEY=mock
ASAAS_API_URL=https://sandbox.asaas.com/api/v3
ASAAS_PLAN_VALUE=69.90

# Frontend
VITE_API_URL=http://localhost:3000/api
```

**Step 2: Subir todos os serviços**

```bash
cd c:/Users/vinic/OneDrive/Projetos/Praktikus
docker-compose up --build
```

Expected: Todos os 4 serviços sobem — postgres, redis, backend, frontend.

**Step 3: Testar o endpoint de registro**

```bash
curl -s -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "cnpj": "12345678000199",
    "razaoSocial": "Auto Center Ltda",
    "nomeFantasia": "Auto Center",
    "email": "owner@autocenter.com",
    "password": "senha1234",
    "ownerName": "João Silva"
  }' | jq .
```

Expected:
```json
{
  "access_token": "eyJ...",
  "refresh_token": "abc..."
}
```

**Step 4: Testar o endpoint de login**

```bash
curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "owner@autocenter.com", "password": "senha1234"}' | jq .
```

Expected: `{ "access_token": "...", "refresh_token": "..." }`

**Step 5: Testar o perfil da oficina com o token**

```bash
TOKEN="<access_token_do_step_4>"
curl -s http://localhost:3000/api/workshop/company \
  -H "Authorization: Bearer $TOKEN" | jq .
```

Expected: JSON com os dados da oficina cadastrada.

**Step 6: Acessar o frontend e testar o fluxo completo**

Abrir `http://localhost:80`:
1. Clicar em "Começar grátis" → deve ir para `/register`
2. Preencher os dados da oficina (Passo 1) → Próximo
3. Preencher dados do responsável (Passo 2) → Cadastrar
4. Deve redirecionar para `/workshop/dashboard`
5. Dashboard exibe sidebar com todos os itens de navegação
6. Toggle de tema (ícone na AppBar) alterna entre dark/light
7. Logout (ícone na AppBar) redireciona para `/login`

**Step 7: Rodar todos os testes**

```bash
pnpm test
```

Expected: Todos os testes passando (backend + frontend).

**Step 8: Commit final**

```bash
git add .
git commit -m "chore: entrega 2 completa — auth JWT, multi-tenancy schema-per-tenant, onboarding e painel"
```

---

## Checklist de Validação da Entrega 2

- [ ] `docker-compose up --build` sobe todos os serviços sem erros
- [ ] Migrations rodaram e tabelas `public.tenants`, `public.users`, `public.refresh_tokens`, `public.billing` existem
- [ ] `POST /api/auth/register` cria tenant com schema dedicado no PostgreSQL, retorna tokens
- [ ] `POST /api/auth/login` retorna tokens válidos
- [ ] `POST /api/auth/refresh` renova tokens
- [ ] `POST /api/auth/logout` revoga refresh token
- [ ] `GET /api/workshop/company` retorna perfil da oficina (requer JWT)
- [ ] `PATCH /api/workshop/company` atualiza perfil (somente OWNER)
- [ ] `POST /api/workshop/company/logo` faz upload de logo (somente OWNER)
- [ ] CNPJ duplicado retorna `409 Conflict`
- [ ] E-mail duplicado retorna `409 Conflict`
- [ ] Frontend: `/register` exibe formulário 2-passos com validação
- [ ] Frontend: `/login` exibe formulário e redireciona para dashboard após login
- [ ] Frontend: `/workshop/dashboard` exibe sidebar e cards de resumo
- [ ] Frontend: rotas protegidas redirecionam para `/login` sem autenticação
- [ ] Frontend: toggle de tema persiste no `localStorage`
- [ ] Todos os testes passam com `pnpm test`
