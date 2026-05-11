# Painel Admin (Console do Dono) — Fase 1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar a Fase 1 do painel administrativo da Praktikus (rota `/admin/*`): autenticação de plataforma isolada, módulo backend `core/admin/` com 5 endpoints agregadores, frontend com design system dedicado em `pages/admin/`, 6 páginas (Login, Overview, Clientes, Segmentos, WhatsApp, Financeiro com placeholders) e seed de dev.

**Architecture:** Tabela `platform_users` no schema `public` + JWT separado (`PLATFORM_JWT_SECRET`) com claim `is_platform_user: true`. Guard `PlatformAuthGuard` rejeita JWTs de tenant; `JwtAuthGuard` rejeita JWTs de plataforma — mútua exclusão por design. Frontend admin é uma árvore isolada em `pages/admin/` com tokens CSS escopados em `.adm-root`, sem importar do app cliente. Todas as queries de Fase 1 batem só no schema `public` (`tenants`, `billing`, `platform_users`).

**Tech Stack:** NestJS 11 + TypeORM + Postgres + bcrypt + `@nestjs/jwt` + `@nestjs/throttler` (novo) | React 19 + Vite + Zustand + axios + Chart.js + react-chartjs-2 + react-hook-form + zod + use-debounce + jwt-decode | `@faker-js/faker` (novo dev dep) | Jest (backend) + Vitest (frontend).

**Spec:** [`docs/superpowers/specs/2026-05-04-admin-panel-fase-1-design.md`](../specs/2026-05-04-admin-panel-fase-1-design.md)

---

## Conventions (read once)

- **Commits**: formato `tipo(escopo): descrição` em pt-BR, conforme CLAUDE.md (ex: `feat(admin): add platform auth login`).
- **Imports cross-fronteira proibidos**: nada em `pages/admin/*` importa de `pages/workshop/*` ou `pages/recycling/*` (ou vice-versa). Único ponto de cruzamento permitido: `App.tsx` registra a rota `/admin/*`.
- **JWT payload**: snake_case (consistente com `JwtPayload` existente em [`apps/backend/src/modules/core/auth/jwt.strategy.ts:11-22`](../../apps/backend/src/modules/core/auth/jwt.strategy.ts#L11-L22)). Usar `is_platform_user` (não `isPlatformUser`).
- **Frontend localStorage**: `pk_admin_*` prefixo pra todas as chaves do admin (separação visual e nominal das chaves do app cliente).
- **bcrypt**: cost **12** pra `platform_users` (cliente usa cost 10 hoje — admin é mais sensível, justifica diferença).
- **Migration timestamp**: usar `1749000000000` em diante (após o último, `1748100000000-AddWhatsappSchema`).
- **Testes backend**: pasta `src/`, regex `*.spec.ts`. Integration em `apps/backend/test/integration/admin/`.
- **Testes frontend**: junto ao componente (`*.spec.tsx`).

---

## Task 1: Adicionar dependências (`@nestjs/throttler`, `@faker-js/faker`)

**Files:**
- Modify: `apps/backend/package.json`

- [ ] **Step 1: Instalar throttler como prod dep**

Run:
```bash
pnpm --filter backend add @nestjs/throttler@^6
```
Expected: `package.json` ganha `"@nestjs/throttler": "^6..."` em `dependencies`.

- [ ] **Step 2: Instalar Faker como dev dep**

Run:
```bash
pnpm --filter backend add -D @faker-js/faker@^9
```
Expected: `"@faker-js/faker": "^9..."` em `devDependencies`.

- [ ] **Step 3: Commit**

```bash
git add apps/backend/package.json pnpm-lock.yaml
git commit -m "chore(backend): add throttler and faker for admin panel"
```

---

## Task 2: Atualizar `.env.example` com vars de plataforma

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Adicionar bloco PLATFORM_*** após o bloco JWT existente**

Append a este arquivo (após a linha `JWT_REFRESH_EXPIRES_IN=30d`):

```
# Platform admin (console do dono — Fase 1)
PLATFORM_JWT_SECRET=dev_platform_secret_change_in_production_min_32_chars
PLATFORM_JWT_EXPIRES_IN=8h
PLATFORM_REFRESH_EXPIRES_IN=30d
PLATFORM_OWNER_EMAIL=vinny.fca@gmail.com
PLATFORM_OWNER_PASSWORD=changeme_dev_only
```

- [ ] **Step 2: Validar carregamento no .env real (manual, não commitar)**

Adicionar as mesmas vars ao seu `.env` local com valores reais. Não commitar `.env`.

- [ ] **Step 3: Commit**

```bash
git add .env.example
git commit -m "chore(env): add platform admin vars to .env.example"
```

---

## Task 3: Migration — `platform_users`, `platform_refresh_tokens` e índices

**Files:**
- Create: `apps/backend/src/database/migrations/1749000000000-AddPlatformUsersAndAdminIndexes.ts`

- [ ] **Step 1: Criar arquivo de migration**

```ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPlatformUsersAndAdminIndexes1749000000000
  implements MigrationInterface
{
  name = 'AddPlatformUsersAndAdminIndexes1749000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "public"."platform_users" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "email" varchar NOT NULL,
        "password_hash" varchar NOT NULL,
        "name" varchar NOT NULL,
        "role" varchar NOT NULL DEFAULT 'PLATFORM_OWNER',
        "last_login_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_platform_users" PRIMARY KEY ("id"),
        CONSTRAINT "uq_platform_users_email" UNIQUE ("email")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "public"."platform_refresh_tokens" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "platform_user_id" uuid NOT NULL,
        "token_hash" varchar NOT NULL,
        "expires_at" timestamptz NOT NULL,
        "revoked" boolean NOT NULL DEFAULT false,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_platform_refresh_tokens" PRIMARY KEY ("id"),
        CONSTRAINT "fk_platform_refresh_user"
          FOREIGN KEY ("platform_user_id")
          REFERENCES "public"."platform_users"("id")
          ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_platform_refresh_token_hash"
        ON "public"."platform_refresh_tokens" ("token_hash")
    `);

    // Performance — agregações de admin
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_tenants_status"
        ON "public"."tenants" ("status")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_tenants_segment_status"
        ON "public"."tenants" ("segment", "status")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_tenants_trial_ends_at"
        ON "public"."tenants" ("trial_ends_at")
        WHERE status = 'TRIAL'
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_tenants_endereco_state"
        ON "public"."tenants" ((endereco->>'state'))
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_tenants_whatsapp_enabled"
        ON "public"."tenants" ("whatsapp_enabled")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."idx_tenants_whatsapp_enabled"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."idx_tenants_endereco_state"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."idx_tenants_trial_ends_at"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."idx_tenants_segment_status"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."idx_tenants_status"`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "public"."platform_refresh_tokens"`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "public"."platform_users"`,
    );
  }
}
```

- [ ] **Step 2: Rodar migration**

Run: `pnpm --filter backend migration:run`
Expected: log `Migration AddPlatformUsersAndAdminIndexes1749000000000 has been executed successfully`.

- [ ] **Step 3: Verificar no Postgres**

Run:
```bash
docker compose exec postgres psql -U praktikus -d praktikus -c '\d public.platform_users'
docker compose exec postgres psql -U praktikus -d praktikus -c '\di public.idx_tenants_*'
```
Expected: tabela `platform_users` listada com 7 colunas; 5 índices `idx_tenants_*` listados.

- [ ] **Step 4: Commit**

```bash
git add apps/backend/src/database/migrations/1749000000000-AddPlatformUsersAndAdminIndexes.ts
git commit -m "feat(admin): migration for platform_users and tenants indexes"
```

---

## Task 4: Entidades `PlatformUserEntity` e `PlatformRefreshTokenEntity`

**Files:**
- Create: `apps/backend/src/modules/core/admin/admin-auth/platform-user.entity.ts`
- Create: `apps/backend/src/modules/core/admin/admin-auth/platform-refresh-token.entity.ts`

- [ ] **Step 1: Criar `platform-user.entity.ts`**

```ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

export const PLATFORM_OWNER_ROLE = 'PLATFORM_OWNER';

@Entity({ name: 'platform_users', schema: 'public' })
export class PlatformUserEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column({ name: 'password_hash' })
  passwordHash: string;

  @Column()
  name: string;

  @Column({ default: PLATFORM_OWNER_ROLE })
  role: string;

  @Column({ name: 'last_login_at', type: 'timestamptz', nullable: true })
  lastLoginAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
```

- [ ] **Step 2: Criar `platform-refresh-token.entity.ts`**

```ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'platform_refresh_tokens', schema: 'public' })
export class PlatformRefreshTokenEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'platform_user_id', type: 'uuid' })
  platformUserId: string;

  @Index('idx_platform_refresh_token_hash')
  @Column({ name: 'token_hash' })
  tokenHash: string;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @Column({ default: false })
  revoked: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/backend/src/modules/core/admin/admin-auth/platform-user.entity.ts \
        apps/backend/src/modules/core/admin/admin-auth/platform-refresh-token.entity.ts
git commit -m "feat(admin): add platform-user and platform-refresh-token entities"
```

---

## Task 5: DTOs de auth (`LoginDto`, `RefreshDto`, `LogoutDto`)

**Files:**
- Create: `apps/backend/src/modules/core/admin/admin-auth/dto/login.dto.ts`
- Create: `apps/backend/src/modules/core/admin/admin-auth/dto/refresh.dto.ts`
- Create: `apps/backend/src/modules/core/admin/admin-auth/dto/logout.dto.ts`

- [ ] **Step 1: Criar `login.dto.ts`**

```ts
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class PlatformLoginDto {
  @IsEmail({}, { message: 'E-mail inválido.' })
  email!: string;

  @IsString()
  @IsNotEmpty({ message: 'Senha é obrigatória.' })
  @MinLength(6, { message: 'Senha muito curta.' })
  password!: string;
}
```

- [ ] **Step 2: Criar `refresh.dto.ts`**

```ts
import { IsNotEmpty, IsString } from 'class-validator';

export class PlatformRefreshDto {
  @IsString()
  @IsNotEmpty()
  refresh_token!: string;
}
```

- [ ] **Step 3: Criar `logout.dto.ts`**

```ts
import { IsNotEmpty, IsString } from 'class-validator';

export class PlatformLogoutDto {
  @IsString()
  @IsNotEmpty()
  refresh_token!: string;
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/backend/src/modules/core/admin/admin-auth/dto/
git commit -m "feat(admin): add platform auth DTOs"
```

---

## Task 6: `PlatformAuthService` — TDD

**Files:**
- Create: `apps/backend/src/modules/core/admin/admin-auth/platform-auth.service.ts`
- Create: `apps/backend/src/modules/core/admin/admin-auth/platform-auth.service.spec.ts`

- [ ] **Step 1: Escrever testes que falham**

Criar `platform-auth.service.spec.ts`:

```ts
import { Test } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PlatformAuthService } from './platform-auth.service';
import { PlatformUserEntity } from './platform-user.entity';
import { PlatformRefreshTokenEntity } from './platform-refresh-token.entity';

describe('PlatformAuthService', () => {
  let service: PlatformAuthService;
  let userRepo: any;
  let refreshRepo: any;
  let jwt: any;

  beforeEach(async () => {
    userRepo = {
      findOne: jest.fn(),
      update: jest.fn(),
    };
    refreshRepo = {
      create: jest.fn().mockImplementation((d) => d),
      save: jest.fn().mockImplementation((d) => Promise.resolve(d)),
      findOne: jest.fn(),
      update: jest.fn(),
    };
    jwt = {
      sign: jest.fn().mockReturnValue('signed.jwt.token'),
    };
    const config = {
      get: jest.fn((k: string) => {
        if (k === 'PLATFORM_JWT_EXPIRES_IN') return '8h';
        if (k === 'PLATFORM_REFRESH_EXPIRES_IN') return '30d';
        return undefined;
      }),
    };

    const module = await Test.createTestingModule({
      providers: [
        PlatformAuthService,
        { provide: getRepositoryToken(PlatformUserEntity), useValue: userRepo },
        {
          provide: getRepositoryToken(PlatformRefreshTokenEntity),
          useValue: refreshRepo,
        },
        { provide: JwtService, useValue: jwt },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();

    service = module.get(PlatformAuthService);
  });

  describe('login', () => {
    it('rejeita email não cadastrado', async () => {
      userRepo.findOne.mockResolvedValue(null);
      await expect(
        service.login({ email: 'x@y.com', password: 'pw' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejeita senha incorreta', async () => {
      const hash = await bcrypt.hash('correct', 4);
      userRepo.findOne.mockResolvedValue({
        id: 'u1',
        email: 'x@y.com',
        passwordHash: hash,
        name: 'Vini',
      });
      await expect(
        service.login({ email: 'x@y.com', password: 'wrong' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('emite tokens com claim is_platform_user e atualiza lastLoginAt', async () => {
      const hash = await bcrypt.hash('correct', 4);
      userRepo.findOne.mockResolvedValue({
        id: 'u1',
        email: 'x@y.com',
        passwordHash: hash,
        name: 'Vini',
      });
      const tokens = await service.login({
        email: 'x@y.com',
        password: 'correct',
      });
      expect(tokens.access_token).toBe('signed.jwt.token');
      expect(tokens.refresh_token).toMatch(/^[a-f0-9]{80}$/);
      expect(jwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          sub: 'u1',
          email: 'x@y.com',
          name: 'Vini',
          is_platform_user: true,
        }),
        expect.any(Object),
      );
      expect(userRepo.update).toHaveBeenCalledWith(
        'u1',
        expect.objectContaining({ lastLoginAt: expect.any(Date) }),
      );
    });
  });

  describe('refresh', () => {
    it('rejeita token revogado', async () => {
      refreshRepo.findOne.mockResolvedValue({ revoked: true });
      await expect(service.refresh('any')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rejeita token expirado', async () => {
      refreshRepo.findOne.mockResolvedValue({
        revoked: false,
        expiresAt: new Date(Date.now() - 1000),
        platformUserId: 'u1',
      });
      await expect(service.refresh('any')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rotaciona token e emite novo par', async () => {
      const stored = {
        revoked: false,
        expiresAt: new Date(Date.now() + 60_000),
        platformUserId: 'u1',
      };
      refreshRepo.findOne.mockResolvedValue(stored);
      userRepo.findOne.mockResolvedValue({
        id: 'u1',
        email: 'x@y.com',
        name: 'Vini',
      });
      const tokens = await service.refresh('old');
      expect(tokens.access_token).toBe('signed.jwt.token');
      expect(refreshRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ revoked: true }),
      );
    });
  });

  describe('logout', () => {
    it('marca token como revoked', async () => {
      await service.logout('any');
      expect(refreshRepo.update).toHaveBeenCalledWith(
        expect.objectContaining({ tokenHash: expect.any(String) }),
        { revoked: true },
      );
    });
  });
});
```

- [ ] **Step 2: Rodar e verificar que falha**

Run: `pnpm --filter backend test -- platform-auth.service.spec`
Expected: FAIL com `Cannot find module './platform-auth.service'`.

- [ ] **Step 3: Implementar `platform-auth.service.ts`**

```ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PlatformUserEntity } from './platform-user.entity';
import { PlatformRefreshTokenEntity } from './platform-refresh-token.entity';
import { PlatformLoginDto } from './dto/login.dto';

export interface PlatformAuthTokens {
  access_token: string;
  refresh_token: string;
  user: { id: string; email: string; name: string };
}

const BCRYPT_COST = 12;

@Injectable()
export class PlatformAuthService {
  constructor(
    @InjectRepository(PlatformUserEntity)
    private readonly userRepo: Repository<PlatformUserEntity>,
    @InjectRepository(PlatformRefreshTokenEntity)
    private readonly refreshRepo: Repository<PlatformRefreshTokenEntity>,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(dto: PlatformLoginDto): Promise<PlatformAuthTokens> {
    const user = await this.userRepo.findOne({ where: { email: dto.email } });
    if (!user) {
      throw new UnauthorizedException('Credenciais inválidas.');
    }
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Credenciais inválidas.');
    }
    await this.userRepo.update(user.id, { lastLoginAt: new Date() });
    return this.issueTokens(user);
  }

  async refresh(refreshToken: string): Promise<PlatformAuthTokens> {
    const tokenHash = this.hashToken(refreshToken);
    const stored = await this.refreshRepo.findOne({ where: { tokenHash } });
    if (!stored || stored.revoked) {
      throw new UnauthorizedException('Refresh inválido.');
    }
    if (stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh expirado.');
    }
    stored.revoked = true;
    await this.refreshRepo.save(stored);

    const user = await this.userRepo.findOne({
      where: { id: stored.platformUserId },
    });
    if (!user) {
      throw new UnauthorizedException();
    }
    return this.issueTokens(user);
  }

  async logout(refreshToken: string): Promise<void> {
    const tokenHash = this.hashToken(refreshToken);
    await this.refreshRepo.update({ tokenHash }, { revoked: true });
  }

  async hashPassword(plain: string): Promise<string> {
    return bcrypt.hash(plain, BCRYPT_COST);
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private async issueTokens(
    user: PlatformUserEntity,
  ): Promise<PlatformAuthTokens> {
    const payload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      is_platform_user: true as const,
    };
    const expiresIn =
      this.config.get<string>('PLATFORM_JWT_EXPIRES_IN') ?? '8h';
    const accessToken = this.jwt.sign(payload, { expiresIn });

    const refreshToken = crypto.randomBytes(40).toString('hex');
    const tokenHash = this.hashToken(refreshToken);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await this.refreshRepo.save(
      this.refreshRepo.create({
        platformUserId: user.id,
        tokenHash,
        expiresAt,
      }),
    );

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      user: { id: user.id, email: user.email, name: user.name },
    };
  }
}
```

- [ ] **Step 4: Rodar testes — verde**

Run: `pnpm --filter backend test -- platform-auth.service.spec`
Expected: PASS — todos os testes passam.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/core/admin/admin-auth/platform-auth.service.ts \
        apps/backend/src/modules/core/admin/admin-auth/platform-auth.service.spec.ts
git commit -m "feat(admin): add PlatformAuthService with login/refresh/logout"
```

---

## Task 7: `PlatformJwtStrategy` (Passport)

**Files:**
- Create: `apps/backend/src/modules/core/admin/admin-auth/platform-jwt.strategy.ts`

- [ ] **Step 1: Implementar strategy**

```ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Repository } from 'typeorm';
import { PlatformUserEntity } from './platform-user.entity';

export interface PlatformJwtPayload {
  sub: string;
  email: string;
  name: string;
  is_platform_user: true;
  iat?: number;
  exp?: number;
}

export interface PlatformAuthUser {
  userId: string;
  email: string;
  name: string;
  role: string;
}

@Injectable()
export class PlatformJwtStrategy extends PassportStrategy(
  Strategy,
  'platform-jwt',
) {
  constructor(
    config: ConfigService,
    @InjectRepository(PlatformUserEntity)
    private readonly userRepo: Repository<PlatformUserEntity>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('PLATFORM_JWT_SECRET')!,
    });
  }

  async validate(payload: PlatformJwtPayload): Promise<PlatformAuthUser> {
    if (payload.is_platform_user !== true) {
      throw new UnauthorizedException();
    }
    const user = await this.userRepo.findOne({ where: { id: payload.sub } });
    if (!user) {
      throw new UnauthorizedException();
    }
    return {
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    };
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/backend/src/modules/core/admin/admin-auth/platform-jwt.strategy.ts
git commit -m "feat(admin): add PlatformJwtStrategy with separate secret"
```

---

## Task 8: `PlatformAuthGuard` + `@PlatformOnly()` decorator

**Files:**
- Create: `apps/backend/src/modules/core/admin/admin-auth/platform-auth.guard.ts`
- Create: `apps/backend/src/modules/core/admin/admin-auth/platform.decorator.ts`
- Create: `apps/backend/src/modules/core/admin/admin-auth/platform-auth.guard.spec.ts`

- [ ] **Step 1: Criar decorator marker**

`platform.decorator.ts`:
```ts
import { SetMetadata } from '@nestjs/common';

export const PLATFORM_ONLY_KEY = 'platform_only';
export const PlatformOnly = () => SetMetadata(PLATFORM_ONLY_KEY, true);
```

- [ ] **Step 2: Implementar guard**

`platform-auth.guard.ts`:
```ts
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class PlatformAuthGuard extends AuthGuard('platform-jwt') {}
```

- [ ] **Step 3: Escrever teste do guard**

`platform-auth.guard.spec.ts`:
```ts
import { PlatformAuthGuard } from './platform-auth.guard';

describe('PlatformAuthGuard', () => {
  it('extends AuthGuard(platform-jwt)', () => {
    const guard = new PlatformAuthGuard();
    expect(guard).toBeInstanceOf(PlatformAuthGuard);
    // o passport interno chama o strategy 'platform-jwt' — coberto pelo
    // strategy.validate (já testado indiretamente via integration tests)
  });
});
```

- [ ] **Step 4: Rodar testes**

Run: `pnpm --filter backend test -- platform-auth.guard.spec`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/core/admin/admin-auth/platform-auth.guard.ts \
        apps/backend/src/modules/core/admin/admin-auth/platform-auth.guard.spec.ts \
        apps/backend/src/modules/core/admin/admin-auth/platform.decorator.ts
git commit -m "feat(admin): add PlatformAuthGuard and PlatformOnly decorator"
```

---

## Task 9: Reforçar `JwtStrategy` (tenant) pra rejeitar JWTs de plataforma

**Files:**
- Modify: `apps/backend/src/modules/core/auth/jwt.strategy.ts`
- Modify: `apps/backend/src/modules/core/auth/jwt.strategy.spec.ts`

Razão: defesa em profundidade. O strategy de tenant exige `tenant_id`; se um JWT de plataforma (sem `tenant_id`) bater nele, deve rejeitar explicitamente.

- [ ] **Step 1: Adicionar teste que falha**

Adicionar ao bloco `describe('JwtStrategy')` em [`apps/backend/src/modules/core/auth/jwt.strategy.spec.ts`](../../apps/backend/src/modules/core/auth/jwt.strategy.spec.ts):

```ts
it('rejeita payload com is_platform_user (não é JWT de tenant)', async () => {
  const strategy = /* já instanciado no describe pai */;
  await expect(
    strategy.validate({
      sub: 'pu1',
      is_platform_user: true,
      tenant_id: undefined as any,
      role: 'PLATFORM_OWNER',
    } as any),
  ).rejects.toThrow();
});

it('rejeita payload sem tenant_id', async () => {
  const strategy = /* já instanciado */;
  await expect(
    strategy.validate({ sub: 'u1', role: 'OWNER' } as any),
  ).rejects.toThrow();
});
```

(A criação do `strategy` deve seguir o padrão já presente nesse spec. Se o describe não existir, criar; se a estrutura existir, só inserir os 2 `it` blocks.)

- [ ] **Step 2: Rodar — verificar que pelo menos 1 teste falha**

Run: `pnpm --filter backend test -- jwt.strategy.spec`
Expected: FAIL — strategy hoje não rejeita esses casos.

- [ ] **Step 3: Modificar `jwt.strategy.ts` — bloco `validate`**

Substituir o método `validate` atual ([linhas 48-63 de `jwt.strategy.ts`](../../apps/backend/src/modules/core/auth/jwt.strategy.ts#L48-L63)) por:

```ts
async validate(payload: JwtPayload): Promise<AuthUser> {
  // Defense in depth: platform JWTs must be rejected by the tenant strategy.
  if ((payload as any).is_platform_user === true) {
    throw new UnauthorizedException();
  }
  if (!payload.tenant_id) {
    throw new UnauthorizedException();
  }

  const user = await this.userRepo.findOne({ where: { id: payload.sub } });
  if (!user) {
    throw new UnauthorizedException();
  }
  return {
    userId: payload.sub,
    tenantId: payload.tenant_id,
    role: payload.role,
    email: user.email,
    tenantStatus:
      (payload.tenant_status as TenantStatus) ?? TenantStatus.ACTIVE,
    tenantSegment: payload.tenant_segment ?? TenantSegment.WORKSHOP,
    whatsappEnabled: payload.whatsapp_enabled ?? false,
  };
}
```

- [ ] **Step 4: Rodar — verde**

Run: `pnpm --filter backend test -- jwt.strategy.spec`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/core/auth/jwt.strategy.ts \
        apps/backend/src/modules/core/auth/jwt.strategy.spec.ts
git commit -m "fix(auth): tenant JwtStrategy rejects platform JWTs explicitly"
```

---

## Task 10: `PlatformAuthController` com rate limit

**Files:**
- Create: `apps/backend/src/modules/core/admin/admin-auth/platform-auth.controller.ts`
- Create: `apps/backend/src/modules/core/admin/admin-auth/platform-auth.controller.spec.ts`

- [ ] **Step 1: Implementar controller**

```ts
import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { PlatformAuthService } from './platform-auth.service';
import { PlatformLoginDto } from './dto/login.dto';
import { PlatformRefreshDto } from './dto/refresh.dto';
import { PlatformLogoutDto } from './dto/logout.dto';
import { PlatformAuthGuard } from './platform-auth.guard';

@Controller('admin/auth')
export class PlatformAuthController {
  private readonly logger = new Logger(PlatformAuthController.name);

  constructor(private readonly auth: PlatformAuthService) {}

  // 10 tentativas / 15 min por IP — anti força bruta
  @Throttle({ default: { limit: 10, ttl: 15 * 60 * 1000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: PlatformLoginDto) {
    try {
      const tokens = await this.auth.login(dto);
      this.logger.log({
        event: 'platform_login_success',
        email: dto.email,
        userId: tokens.user.id,
      });
      return tokens;
    } catch (err) {
      if (err instanceof UnauthorizedException) {
        this.logger.warn({
          event: 'platform_login_failure',
          email: dto.email,
        });
      }
      throw err;
    }
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() dto: PlatformRefreshDto) {
    return this.auth.refresh(dto.refresh_token);
  }

  @UseGuards(PlatformAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Body() dto: PlatformLogoutDto): Promise<void> {
    this.logger.log({ event: 'platform_logout' });
    await this.auth.logout(dto.refresh_token);
  }
}
```

- [ ] **Step 2: Spec do controller**

```ts
import { Test } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { PlatformAuthController } from './platform-auth.controller';
import { PlatformAuthService } from './platform-auth.service';
import { PlatformAuthGuard } from './platform-auth.guard';

describe('PlatformAuthController', () => {
  let controller: PlatformAuthController;
  let auth: any;

  beforeEach(async () => {
    auth = {
      login: jest.fn(),
      refresh: jest.fn(),
      logout: jest.fn(),
    };
    const module = await Test.createTestingModule({
      controllers: [PlatformAuthController],
      providers: [{ provide: PlatformAuthService, useValue: auth }],
    })
      .overrideGuard(PlatformAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();
    controller = module.get(PlatformAuthController);
  });

  it('login delega ao service', async () => {
    auth.login.mockResolvedValue({
      access_token: 'a',
      refresh_token: 'r',
      user: { id: 'u', email: 'e', name: 'n' },
    });
    const out = await controller.login({
      email: 'x@y.com',
      password: 'pw',
    } as any);
    expect(out.access_token).toBe('a');
    expect(auth.login).toHaveBeenCalledWith({
      email: 'x@y.com',
      password: 'pw',
    });
  });

  it('login propaga UnauthorizedException', async () => {
    auth.login.mockRejectedValue(new UnauthorizedException());
    await expect(
      controller.login({ email: 'x@y.com', password: 'pw' } as any),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('refresh delega', async () => {
    auth.refresh.mockResolvedValue({ access_token: 'a' });
    await controller.refresh({ refresh_token: 'old' });
    expect(auth.refresh).toHaveBeenCalledWith('old');
  });

  it('logout delega', async () => {
    await controller.logout({ refresh_token: 'r' });
    expect(auth.logout).toHaveBeenCalledWith('r');
  });
});
```

- [ ] **Step 3: Rodar — verde**

Run: `pnpm --filter backend test -- platform-auth.controller.spec`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/backend/src/modules/core/admin/admin-auth/platform-auth.controller.ts \
        apps/backend/src/modules/core/admin/admin-auth/platform-auth.controller.spec.ts
git commit -m "feat(admin): add PlatformAuthController with rate-limited login"
```

---

## Task 11: `AdminModule` + wire em `AppModule` (com ThrottlerModule)

**Files:**
- Create: `apps/backend/src/modules/core/admin/admin.module.ts`
- Modify: `apps/backend/src/app.module.ts`

- [ ] **Step 1: Criar `admin.module.ts`**

```ts
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { PlatformUserEntity } from './admin-auth/platform-user.entity';
import { PlatformRefreshTokenEntity } from './admin-auth/platform-refresh-token.entity';
import { PlatformAuthService } from './admin-auth/platform-auth.service';
import { PlatformAuthController } from './admin-auth/platform-auth.controller';
import { PlatformJwtStrategy } from './admin-auth/platform-jwt.strategy';
import { TenantEntity } from '../tenancy/tenant.entity';
import { BillingEntity } from '../billing/billing.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PlatformUserEntity,
      PlatformRefreshTokenEntity,
      TenantEntity,
      BillingEntity,
    ]),
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('PLATFORM_JWT_SECRET'),
        signOptions: {
          expiresIn: config.get('PLATFORM_JWT_EXPIRES_IN', '8h'),
        },
      }),
    }),
    ThrottlerModule.forRoot([
      { name: 'default', ttl: 15 * 60 * 1000, limit: 1000 },
    ]),
  ],
  controllers: [PlatformAuthController],
  providers: [
    PlatformAuthService,
    PlatformJwtStrategy,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
  exports: [PlatformAuthService],
})
export class AdminModule {}
```

- [ ] **Step 2: Importar `AdminModule` em `app.module.ts`**

Em `apps/backend/src/app.module.ts`, adicionar import e incluir no array `imports` após `WhatsappModule`:

```ts
import { AdminModule } from './modules/core/admin/admin.module';
// ...
imports: [
  // ...existentes...
  WhatsappModule,
  AdminModule,
],
```

- [ ] **Step 3: Validar boot**

Run: `pnpm --filter backend start:dev`
Expected: log `Nest application successfully started`. Sem erros de DI.
Stop: Ctrl+C.

- [ ] **Step 4: Smoke manual — login deve funcionar com seed**

Pular esse step até a Task 18 (seed) estar pronta. Marcar como **OK por enquanto** se boot subiu sem erro.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/core/admin/admin.module.ts \
        apps/backend/src/app.module.ts
git commit -m "feat(admin): wire AdminModule with throttler into AppModule"
```

---

## Task 12: `AdminOverviewService` + Controller + DTOs

**Files:**
- Create: `apps/backend/src/modules/core/admin/admin-overview/dto/overview-response.dto.ts`
- Create: `apps/backend/src/modules/core/admin/admin-overview/admin-overview.service.ts`
- Create: `apps/backend/src/modules/core/admin/admin-overview/admin-overview.service.spec.ts`
- Create: `apps/backend/src/modules/core/admin/admin-overview/admin-overview.controller.ts`
- Modify: `apps/backend/src/modules/core/admin/admin.module.ts`

- [ ] **Step 1: Criar DTO de resposta**

`overview-response.dto.ts`:

```ts
import { TenantSegment } from '@praktikus/shared';

export interface OverviewKpi {
  value: number;
  deltaVsLastMonth: number | null;
  sparkline: number[]; // 6 itens (mês -5 ... mês 0)
}

export interface OverviewSegmentDistribution {
  segment: TenantSegment;
  count: number;
}

export interface OverviewUfDistribution {
  uf: string; // "SP", "RJ", ... ou "UNKNOWN"
  count: number;
}

export interface OverviewTrialExpiring {
  tenantId: string;
  nomeFantasia: string;
  segment: TenantSegment;
  trialEndsAt: string; // ISO
  daysLeft: number;
}

export interface OverviewResponseDto {
  kpis: {
    activeTenants: OverviewKpi;
    trialTenants: OverviewKpi;
    whatsappTenants: OverviewKpi;
    mrr: { value: null }; // placeholder Fase 1.5
  };
  statusDistribution: Array<{ status: string; count: number }>;
  segmentDistribution: OverviewSegmentDistribution[];
  ufDistribution: OverviewUfDistribution[];
  trialsExpiring: OverviewTrialExpiring[];
}
```

- [ ] **Step 2: Escrever testes que falham**

`admin-overview.service.spec.ts`:

```ts
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AdminOverviewService } from './admin-overview.service';
import { TenantEntity } from '../../tenancy/tenant.entity';

describe('AdminOverviewService', () => {
  let service: AdminOverviewService;
  let repo: any;

  beforeEach(async () => {
    repo = {
      createQueryBuilder: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn(),
      count: jest.fn(),
      find: jest.fn(),
    };
    const module = await Test.createTestingModule({
      providers: [
        AdminOverviewService,
        { provide: getRepositoryToken(TenantEntity), useValue: repo },
      ],
    }).compile();
    service = module.get(AdminOverviewService);
  });

  it('agrega KPIs, distribuições e trials expirando', async () => {
    repo.count
      .mockResolvedValueOnce(120) // activeTenants
      .mockResolvedValueOnce(30) // trialTenants
      .mockResolvedValueOnce(48); // whatsappTenants
    repo.getRawMany
      .mockResolvedValueOnce([
        { status: 'ACTIVE', count: '120' },
        { status: 'TRIAL', count: '30' },
        { status: 'OVERDUE', count: '5' },
        { status: 'SUSPENDED', count: '2' },
      ]) // statusDistribution
      .mockResolvedValueOnce([
        { segment: 'WORKSHOP', count: '90' },
        { segment: 'RECYCLING', count: '40' },
      ]) // segmentDistribution
      .mockResolvedValueOnce([
        { uf: 'SP', count: '40' },
        { uf: 'RJ', count: '15' },
      ]) // ufDistribution
      .mockResolvedValueOnce([
        { month: '2026-04', count: '8' },
        { month: '2026-05', count: '12' },
      ]); // sparkline base
    repo.find.mockResolvedValue([
      {
        id: 't1',
        nomeFantasia: 'Oficina ABC',
        segment: 'WORKSHOP',
        trialEndsAt: new Date(Date.now() + 3 * 86_400_000),
      },
    ]);

    const out = await service.getOverview();
    expect(out.kpis.activeTenants.value).toBe(120);
    expect(out.kpis.trialTenants.value).toBe(30);
    expect(out.kpis.whatsappTenants.value).toBe(48);
    expect(out.kpis.mrr.value).toBeNull();
    expect(out.statusDistribution).toHaveLength(4);
    expect(out.segmentDistribution).toHaveLength(2);
    expect(out.ufDistribution[0]).toEqual({ uf: 'SP', count: 40 });
    expect(out.trialsExpiring).toHaveLength(1);
    expect(out.trialsExpiring[0].daysLeft).toBeGreaterThanOrEqual(2);
    expect(out.trialsExpiring[0].daysLeft).toBeLessThanOrEqual(3);
  });

  it('lista de trials vazia quando não há expirando', async () => {
    repo.count.mockResolvedValue(0);
    repo.getRawMany.mockResolvedValue([]);
    repo.find.mockResolvedValue([]);
    const out = await service.getOverview();
    expect(out.trialsExpiring).toEqual([]);
  });
});
```

- [ ] **Step 3: Run — fail**

Run: `pnpm --filter backend test -- admin-overview.service.spec`
Expected: FAIL — module not found.

- [ ] **Step 4: Implementar service**

`admin-overview.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { TenantEntity, TenantStatus } from '../../tenancy/tenant.entity';
import { TenantSegment } from '@praktikus/shared';
import { OverviewResponseDto } from './dto/overview-response.dto';

@Injectable()
export class AdminOverviewService {
  constructor(
    @InjectRepository(TenantEntity)
    private readonly tenantRepo: Repository<TenantEntity>,
  ) {}

  async getOverview(): Promise<OverviewResponseDto> {
    const [
      activeCount,
      trialCount,
      whatsappCount,
      statusDistribution,
      segmentDistribution,
      ufDistributionRaw,
      sparklineRaw,
      expiringTenants,
    ] = await Promise.all([
      this.tenantRepo.count({ where: { status: TenantStatus.ACTIVE } }),
      this.tenantRepo.count({ where: { status: TenantStatus.TRIAL } }),
      this.tenantRepo.count({ where: { whatsappEnabled: true } }),
      this.statusDistribution(),
      this.segmentDistribution(),
      this.ufDistribution(),
      this.newTenantsLast6Months(),
      this.expiringTrials(),
    ]);

    const sparkline = this.fillMonths(sparklineRaw, 6);

    return {
      kpis: {
        activeTenants: { value: activeCount, deltaVsLastMonth: null, sparkline },
        trialTenants: { value: trialCount, deltaVsLastMonth: null, sparkline },
        whatsappTenants: {
          value: whatsappCount,
          deltaVsLastMonth: null,
          sparkline,
        },
        mrr: { value: null },
      },
      statusDistribution,
      segmentDistribution,
      ufDistribution: ufDistributionRaw,
      trialsExpiring: expiringTenants.map((t) => ({
        tenantId: t.id,
        nomeFantasia: t.nomeFantasia,
        segment: t.segment,
        trialEndsAt: t.trialEndsAt!.toISOString(),
        daysLeft: Math.ceil(
          (t.trialEndsAt!.getTime() - Date.now()) / 86_400_000,
        ),
      })),
    };
  }

  private async statusDistribution() {
    const rows: Array<{ status: string; count: string }> = await this.tenantRepo
      .createQueryBuilder('t')
      .select('t.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('t.status')
      .getRawMany();
    return rows.map((r) => ({ status: r.status, count: Number(r.count) }));
  }

  private async segmentDistribution() {
    const rows: Array<{ segment: string; count: string }> = await this.tenantRepo
      .createQueryBuilder('t')
      .select('t.segment', 'segment')
      .addSelect('COUNT(*)', 'count')
      .groupBy('t.segment')
      .getRawMany();
    return rows.map((r) => ({
      segment: r.segment as TenantSegment,
      count: Number(r.count),
    }));
  }

  private async ufDistribution() {
    const rows: Array<{ uf: string | null; count: string }> = await this
      .tenantRepo
      .createQueryBuilder('t')
      .select(`COALESCE(t.endereco->>'state', 'UNKNOWN')`, 'uf')
      .addSelect('COUNT(*)', 'count')
      .groupBy(`COALESCE(t.endereco->>'state', 'UNKNOWN')`)
      .getRawMany();
    return rows
      .map((r) => ({ uf: r.uf ?? 'UNKNOWN', count: Number(r.count) }))
      .sort((a, b) => b.count - a.count);
  }

  private async newTenantsLast6Months() {
    const rows: Array<{ month: string; count: string }> = await this.tenantRepo
      .createQueryBuilder('t')
      .select(`TO_CHAR(t.created_at, 'YYYY-MM')`, 'month')
      .addSelect('COUNT(*)', 'count')
      .where(`t.created_at >= NOW() - INTERVAL '6 months'`)
      .groupBy('month')
      .orderBy('month', 'ASC')
      .getRawMany();
    return rows.map((r) => ({ month: r.month, count: Number(r.count) }));
  }

  private fillMonths(
    rows: Array<{ month: string; count: number }>,
    n: number,
  ): number[] {
    const out: number[] = [];
    const map = new Map(rows.map((r) => [r.month, r.count]));
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
        2,
        '0',
      )}`;
      out.push(map.get(key) ?? 0);
    }
    return out;
  }

  private async expiringTrials() {
    const now = new Date();
    const in7d = new Date(Date.now() + 7 * 86_400_000);
    return this.tenantRepo.find({
      where: {
        status: TenantStatus.TRIAL,
        trialEndsAt: Between(now, in7d),
      },
      order: { trialEndsAt: 'ASC' },
      take: 20,
    });
  }
}
```

- [ ] **Step 5: Implementar controller**

`admin-overview.controller.ts`:

```ts
import { Controller, Get, UseGuards } from '@nestjs/common';
import { AdminOverviewService } from './admin-overview.service';
import { PlatformAuthGuard } from '../admin-auth/platform-auth.guard';
import { PlatformOnly } from '../admin-auth/platform.decorator';

@Controller('admin/overview')
@UseGuards(PlatformAuthGuard)
@PlatformOnly()
export class AdminOverviewController {
  constructor(private readonly service: AdminOverviewService) {}

  @Get()
  getOverview() {
    return this.service.getOverview();
  }
}
```

- [ ] **Step 6: Registrar no `admin.module.ts`**

Adicionar `AdminOverviewService` em `providers` e `AdminOverviewController` em `controllers`:

```ts
import { AdminOverviewController } from './admin-overview/admin-overview.controller';
import { AdminOverviewService } from './admin-overview/admin-overview.service';
// ...
controllers: [PlatformAuthController, AdminOverviewController],
providers: [
  PlatformAuthService,
  PlatformJwtStrategy,
  AdminOverviewService,
  { provide: APP_GUARD, useClass: ThrottlerGuard },
],
```

- [ ] **Step 7: Run — verde**

Run: `pnpm --filter backend test -- admin-overview.service.spec`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/backend/src/modules/core/admin/admin-overview/ \
        apps/backend/src/modules/core/admin/admin.module.ts
git commit -m "feat(admin): add overview endpoint with KPIs and aggregations"
```

---

## Task 13: `AdminTenantsService` + Controller (filtros, paginação, busca)

**Files:**
- Create: `apps/backend/src/modules/core/admin/admin-tenants/dto/list-tenants-query.dto.ts`
- Create: `apps/backend/src/modules/core/admin/admin-tenants/dto/tenants-response.dto.ts`
- Create: `apps/backend/src/modules/core/admin/admin-tenants/admin-tenants.service.ts`
- Create: `apps/backend/src/modules/core/admin/admin-tenants/admin-tenants.service.spec.ts`
- Create: `apps/backend/src/modules/core/admin/admin-tenants/admin-tenants.controller.ts`
- Modify: `apps/backend/src/modules/core/admin/admin.module.ts`

- [ ] **Step 1: DTO de query**

`list-tenants-query.dto.ts`:

```ts
import { Transform } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { TenantSegment } from '@praktikus/shared';
import { TenantStatus } from '../../../tenancy/tenant.entity';

export class ListTenantsQueryDto {
  @IsOptional()
  @IsEnum(TenantStatus)
  status?: TenantStatus;

  @IsOptional()
  @IsEnum(TenantSegment)
  segment?: TenantSegment;

  @IsOptional()
  @IsIn(['yes', 'no'])
  wpp?: 'yes' | 'no';

  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 25;
}
```

- [ ] **Step 2: DTO de resposta**

`tenants-response.dto.ts`:

```ts
import { TenantSegment } from '@praktikus/shared';
import { TenantStatus } from '../../../tenancy/tenant.entity';

export interface TenantListItem {
  id: string;
  nomeFantasia: string;
  razaoSocial: string;
  cnpj: string;
  segment: TenantSegment;
  status: TenantStatus;
  city: string | null;
  state: string | null;
  whatsappEnabled: boolean;
  whatsappPlan: string | null;
  // Fase 1.5+: planName, mrr, healthScore, lastSeenAt, userCount
  planName: null;
  mrr: null;
  healthScore: null;
  lastSeenAt: null;
  trialEndsAt: string | null;
  trialDaysLeft: number | null;
  createdAt: string;
}

export interface TenantsResponseDto {
  data: TenantListItem[];
  total: number;
  page: number;
  pageSize: number;
  countersByStatus: Record<TenantStatus, number>;
}
```

- [ ] **Step 3: Spec do service**

`admin-tenants.service.spec.ts`:

```ts
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AdminTenantsService } from './admin-tenants.service';
import { TenantEntity, TenantStatus } from '../../tenancy/tenant.entity';
import { TenantSegment } from '@praktikus/shared';

describe('AdminTenantsService', () => {
  let service: AdminTenantsService;
  let qb: any;
  let repo: any;

  beforeEach(async () => {
    qb = {
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn(),
    };
    repo = {
      createQueryBuilder: jest.fn().mockReturnValue(qb),
      count: jest.fn(),
    };
    const module = await Test.createTestingModule({
      providers: [
        AdminTenantsService,
        { provide: getRepositoryToken(TenantEntity), useValue: repo },
      ],
    }).compile();
    service = module.get(AdminTenantsService);
  });

  it('aplica filtros combinatórios + paginação', async () => {
    qb.getManyAndCount.mockResolvedValue([[], 0]);
    repo.count.mockResolvedValue(0);
    await service.list({
      status: TenantStatus.ACTIVE,
      segment: TenantSegment.WORKSHOP,
      wpp: 'yes',
      q: 'oficina',
      page: 2,
      pageSize: 25,
    });
    expect(qb.andWhere).toHaveBeenCalledWith('t.status = :status', {
      status: TenantStatus.ACTIVE,
    });
    expect(qb.andWhere).toHaveBeenCalledWith('t.segment = :segment', {
      segment: TenantSegment.WORKSHOP,
    });
    expect(qb.andWhere).toHaveBeenCalledWith('t.whatsapp_enabled = :wpp', {
      wpp: true,
    });
    expect(qb.skip).toHaveBeenCalledWith(25);
    expect(qb.take).toHaveBeenCalledWith(25);
  });

  it('mapeia tenants sem endereco para city/state null', async () => {
    qb.getManyAndCount.mockResolvedValue([
      [
        {
          id: 't1',
          nomeFantasia: 'A',
          razaoSocial: 'A LTDA',
          cnpj: '00.000.000/0001-00',
          segment: TenantSegment.WORKSHOP,
          status: TenantStatus.ACTIVE,
          endereco: null,
          whatsappEnabled: false,
          whatsappPlan: null,
          trialEndsAt: null,
          createdAt: new Date('2026-01-01'),
        },
      ],
      1,
    ]);
    repo.count.mockResolvedValue(0);
    const out = await service.list({});
    expect(out.data[0].city).toBeNull();
    expect(out.data[0].state).toBeNull();
    expect(out.data[0].mrr).toBeNull();
    expect(out.data[0].healthScore).toBeNull();
  });

  it('computa trialDaysLeft quando trialEndsAt está no futuro', async () => {
    const future = new Date(Date.now() + 5 * 86_400_000);
    qb.getManyAndCount.mockResolvedValue([
      [
        {
          id: 't1',
          nomeFantasia: 'A',
          razaoSocial: 'A',
          cnpj: 'x',
          segment: TenantSegment.WORKSHOP,
          status: TenantStatus.TRIAL,
          endereco: { city: 'SP', state: 'SP' },
          whatsappEnabled: false,
          whatsappPlan: null,
          trialEndsAt: future,
          createdAt: new Date(),
        },
      ],
      1,
    ]);
    repo.count.mockResolvedValue(0);
    const out = await service.list({});
    expect(out.data[0].trialDaysLeft).toBeGreaterThanOrEqual(4);
    expect(out.data[0].trialDaysLeft).toBeLessThanOrEqual(5);
  });

  it('retorna countersByStatus para todos os status', async () => {
    qb.getManyAndCount.mockResolvedValue([[], 0]);
    repo.count
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1);
    const out = await service.list({});
    expect(out.countersByStatus.ACTIVE).toBe(10);
    expect(out.countersByStatus.TRIAL).toBe(5);
    expect(out.countersByStatus.OVERDUE).toBe(2);
    expect(out.countersByStatus.SUSPENDED).toBe(1);
  });
});
```

- [ ] **Step 4: Run — fail**

Run: `pnpm --filter backend test -- admin-tenants.service.spec`
Expected: FAIL — module not found.

- [ ] **Step 5: Implementar service**

`admin-tenants.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantEntity, TenantStatus } from '../../tenancy/tenant.entity';
import { ListTenantsQueryDto } from './dto/list-tenants-query.dto';
import {
  TenantListItem,
  TenantsResponseDto,
} from './dto/tenants-response.dto';

@Injectable()
export class AdminTenantsService {
  constructor(
    @InjectRepository(TenantEntity)
    private readonly repo: Repository<TenantEntity>,
  ) {}

  async list(query: ListTenantsQueryDto): Promise<TenantsResponseDto> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const qb = this.repo
      .createQueryBuilder('t')
      .orderBy('t.created_at', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    if (query.status) {
      qb.andWhere('t.status = :status', { status: query.status });
    }
    if (query.segment) {
      qb.andWhere('t.segment = :segment', { segment: query.segment });
    }
    if (query.wpp) {
      qb.andWhere('t.whatsapp_enabled = :wpp', { wpp: query.wpp === 'yes' });
    }
    if (query.q && query.q.trim().length > 0) {
      qb.andWhere(
        `(t.nome_fantasia ILIKE :q OR t.razao_social ILIKE :q OR t.slug ILIKE :q OR t.cnpj ILIKE :q)`,
        { q: `%${query.q.trim()}%` },
      );
    }

    const [rows, total] = await qb.getManyAndCount();

    const [active, trial, overdue, suspended] = await Promise.all([
      this.repo.count({ where: { status: TenantStatus.ACTIVE } }),
      this.repo.count({ where: { status: TenantStatus.TRIAL } }),
      this.repo.count({ where: { status: TenantStatus.OVERDUE } }),
      this.repo.count({ where: { status: TenantStatus.SUSPENDED } }),
    ]);

    return {
      data: rows.map((t) => this.toItem(t)),
      total,
      page,
      pageSize,
      countersByStatus: {
        [TenantStatus.ACTIVE]: active,
        [TenantStatus.TRIAL]: trial,
        [TenantStatus.OVERDUE]: overdue,
        [TenantStatus.SUSPENDED]: suspended,
      },
    };
  }

  private toItem(t: TenantEntity): TenantListItem {
    const trialDaysLeft =
      t.trialEndsAt && t.trialEndsAt.getTime() > Date.now()
        ? Math.ceil((t.trialEndsAt.getTime() - Date.now()) / 86_400_000)
        : null;
    return {
      id: t.id,
      nomeFantasia: t.nomeFantasia,
      razaoSocial: t.razaoSocial,
      cnpj: t.cnpj,
      segment: t.segment,
      status: t.status,
      city: t.endereco?.city ?? null,
      state: t.endereco?.state ?? null,
      whatsappEnabled: t.whatsappEnabled,
      whatsappPlan: t.whatsappPlan ?? null,
      planName: null,
      mrr: null,
      healthScore: null,
      lastSeenAt: null,
      trialEndsAt: t.trialEndsAt ? t.trialEndsAt.toISOString() : null,
      trialDaysLeft,
      createdAt: t.createdAt.toISOString(),
    };
  }
}
```

- [ ] **Step 6: Implementar controller**

`admin-tenants.controller.ts`:

```ts
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AdminTenantsService } from './admin-tenants.service';
import { ListTenantsQueryDto } from './dto/list-tenants-query.dto';
import { PlatformAuthGuard } from '../admin-auth/platform-auth.guard';
import { PlatformOnly } from '../admin-auth/platform.decorator';

@Controller('admin/tenants')
@UseGuards(PlatformAuthGuard)
@PlatformOnly()
export class AdminTenantsController {
  constructor(private readonly service: AdminTenantsService) {}

  @Get()
  list(@Query() query: ListTenantsQueryDto) {
    return this.service.list(query);
  }
}
```

- [ ] **Step 7: Registrar em `admin.module.ts`**

Adicionar imports e nas listas `controllers`/`providers`:

```ts
import { AdminTenantsController } from './admin-tenants/admin-tenants.controller';
import { AdminTenantsService } from './admin-tenants/admin-tenants.service';
// ...
controllers: [PlatformAuthController, AdminOverviewController, AdminTenantsController],
providers: [
  PlatformAuthService,
  PlatformJwtStrategy,
  AdminOverviewService,
  AdminTenantsService,
  { provide: APP_GUARD, useClass: ThrottlerGuard },
],
```

- [ ] **Step 8: Run — verde**

Run: `pnpm --filter backend test -- admin-tenants.service.spec`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add apps/backend/src/modules/core/admin/admin-tenants/ \
        apps/backend/src/modules/core/admin/admin.module.ts
git commit -m "feat(admin): add tenants list endpoint with filters and pagination"
```

---

## Task 14: `AdminSegmentsService` + Controller

**Files:**
- Create: `apps/backend/src/modules/core/admin/admin-segments/dto/segments-response.dto.ts`
- Create: `apps/backend/src/modules/core/admin/admin-segments/admin-segments.service.ts`
- Create: `apps/backend/src/modules/core/admin/admin-segments/admin-segments.service.spec.ts`
- Create: `apps/backend/src/modules/core/admin/admin-segments/admin-segments.controller.ts`
- Modify: `apps/backend/src/modules/core/admin/admin.module.ts`

- [ ] **Step 1: DTO**

`segments-response.dto.ts`:

```ts
import { TenantSegment } from '@praktikus/shared';

export interface SegmentBreakdown {
  segment: TenantSegment;
  total: number;
  byStatus: Record<string, number>; // ACTIVE/TRIAL/OVERDUE/SUSPENDED
  whatsappCount: number;
  newLast30Days: number;
  mrr: null; // placeholder Fase 1.5
}

export interface SegmentsResponseDto {
  totalTenants: number;
  segments: SegmentBreakdown[];
}
```

- [ ] **Step 2: Spec do service**

```ts
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AdminSegmentsService } from './admin-segments.service';
import { TenantEntity } from '../../tenancy/tenant.entity';
import { TenantSegment } from '@praktikus/shared';

describe('AdminSegmentsService', () => {
  let service: AdminSegmentsService;
  let repo: any;

  beforeEach(async () => {
    repo = {
      createQueryBuilder: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      addGroupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn(),
      count: jest.fn(),
    };
    const module = await Test.createTestingModule({
      providers: [
        AdminSegmentsService,
        { provide: getRepositoryToken(TenantEntity), useValue: repo },
      ],
    }).compile();
    service = module.get(AdminSegmentsService);
  });

  it('agrupa por segmento e status', async () => {
    repo.count.mockResolvedValue(130);
    repo.getRawMany
      .mockResolvedValueOnce([
        { segment: 'WORKSHOP', status: 'ACTIVE', count: '50' },
        { segment: 'WORKSHOP', status: 'TRIAL', count: '10' },
        { segment: 'RECYCLING', status: 'ACTIVE', count: '40' },
      ])
      .mockResolvedValueOnce([
        { segment: 'WORKSHOP', count: '20' },
        { segment: 'RECYCLING', count: '15' },
      ])
      .mockResolvedValueOnce([
        { segment: 'WORKSHOP', count: '5' },
        { segment: 'RECYCLING', count: '3' },
      ]);
    const out = await service.list();
    expect(out.totalTenants).toBe(130);
    const wp = out.segments.find((s) => s.segment === TenantSegment.WORKSHOP)!;
    expect(wp.total).toBe(60);
    expect(wp.byStatus.ACTIVE).toBe(50);
    expect(wp.whatsappCount).toBe(20);
    expect(wp.newLast30Days).toBe(5);
    expect(wp.mrr).toBeNull();
  });
});
```

- [ ] **Step 3: Run — fail**

Run: `pnpm --filter backend test -- admin-segments.service.spec`
Expected: FAIL.

- [ ] **Step 4: Implementar service**

```ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantEntity } from '../../tenancy/tenant.entity';
import { TenantSegment } from '@praktikus/shared';
import { SegmentBreakdown, SegmentsResponseDto } from './dto/segments-response.dto';

@Injectable()
export class AdminSegmentsService {
  constructor(
    @InjectRepository(TenantEntity)
    private readonly repo: Repository<TenantEntity>,
  ) {}

  async list(): Promise<SegmentsResponseDto> {
    const [total, byStatusRows, whatsappRows, newRows] = await Promise.all([
      this.repo.count(),
      this.repo
        .createQueryBuilder('t')
        .select('t.segment', 'segment')
        .addSelect('t.status', 'status')
        .addSelect('COUNT(*)', 'count')
        .groupBy('t.segment')
        .addGroupBy('t.status')
        .getRawMany() as Promise<
        Array<{ segment: string; status: string; count: string }>
      >,
      this.repo
        .createQueryBuilder('t')
        .select('t.segment', 'segment')
        .addSelect('COUNT(*)', 'count')
        .where('t.whatsapp_enabled = true')
        .groupBy('t.segment')
        .getRawMany() as Promise<Array<{ segment: string; count: string }>>,
      this.repo
        .createQueryBuilder('t')
        .select('t.segment', 'segment')
        .addSelect('COUNT(*)', 'count')
        .where(`t.created_at >= NOW() - INTERVAL '30 days'`)
        .groupBy('t.segment')
        .getRawMany() as Promise<Array<{ segment: string; count: string }>>,
    ]);

    const segments = new Map<TenantSegment, SegmentBreakdown>();
    for (const seg of Object.values(TenantSegment)) {
      segments.set(seg, {
        segment: seg,
        total: 0,
        byStatus: {},
        whatsappCount: 0,
        newLast30Days: 0,
        mrr: null,
      });
    }

    for (const r of byStatusRows) {
      const seg = segments.get(r.segment as TenantSegment);
      if (!seg) continue;
      const c = Number(r.count);
      seg.total += c;
      seg.byStatus[r.status] = c;
    }
    for (const r of whatsappRows) {
      const seg = segments.get(r.segment as TenantSegment);
      if (seg) seg.whatsappCount = Number(r.count);
    }
    for (const r of newRows) {
      const seg = segments.get(r.segment as TenantSegment);
      if (seg) seg.newLast30Days = Number(r.count);
    }

    return {
      totalTenants: total,
      segments: Array.from(segments.values()),
    };
  }
}
```

- [ ] **Step 5: Controller**

```ts
import { Controller, Get, UseGuards } from '@nestjs/common';
import { AdminSegmentsService } from './admin-segments.service';
import { PlatformAuthGuard } from '../admin-auth/platform-auth.guard';
import { PlatformOnly } from '../admin-auth/platform.decorator';

@Controller('admin/segments')
@UseGuards(PlatformAuthGuard)
@PlatformOnly()
export class AdminSegmentsController {
  constructor(private readonly service: AdminSegmentsService) {}

  @Get()
  list() {
    return this.service.list();
  }
}
```

- [ ] **Step 6: Registrar no `admin.module.ts`** (mesmo padrão das tasks anteriores — adicionar imports + nas listas).

- [ ] **Step 7: Run — verde**

Run: `pnpm --filter backend test -- admin-segments.service.spec`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/backend/src/modules/core/admin/admin-segments/ \
        apps/backend/src/modules/core/admin/admin.module.ts
git commit -m "feat(admin): add segments breakdown endpoint"
```

---

## Task 15: `AdminWhatsappService` + Controller

**Files:**
- Create: `apps/backend/src/modules/core/admin/admin-whatsapp/dto/whatsapp-response.dto.ts`
- Create: `apps/backend/src/modules/core/admin/admin-whatsapp/admin-whatsapp.service.ts`
- Create: `apps/backend/src/modules/core/admin/admin-whatsapp/admin-whatsapp.service.spec.ts`
- Create: `apps/backend/src/modules/core/admin/admin-whatsapp/admin-whatsapp.controller.ts`
- Modify: `apps/backend/src/modules/core/admin/admin.module.ts`

- [ ] **Step 1: DTO**

```ts
import { TenantSegment } from '@praktikus/shared';
import { TenantStatus } from '../../../tenancy/tenant.entity';

export interface WhatsappAdoptionTenant {
  id: string;
  nomeFantasia: string;
  segment: TenantSegment;
  status: TenantStatus;
  whatsappPlan: string | null;
  enabledAt: string | null; // por enquanto = updated_at
  monthlyVolume: null; // Fase 1.5
}

export interface WhatsappResponseDto {
  kpis: {
    adoptionRate: number; // 0..1
    starterCount: number; // WhatsappPlan.STARTER
    proCount: number;     // WhatsappPlan.PRO
    enterpriseCount: number; // WhatsappPlan.ENTERPRISE
    addOnMrr: null;
  };
  using: WhatsappAdoptionTenant[];
  notUsing: WhatsappAdoptionTenant[];
  adoptionBySegment: Array<{
    segment: TenantSegment;
    rate: number; // 0..1
    using: number;
    eligible: number; // ACTIVE+TRIAL
  }>;
}
```

- [ ] **Step 2: Spec**

```ts
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AdminWhatsappService } from './admin-whatsapp.service';
import { TenantEntity, TenantStatus } from '../../tenancy/tenant.entity';
import { TenantSegment } from '@praktikus/shared';

describe('AdminWhatsappService', () => {
  let service: AdminWhatsappService;
  let repo: any;

  beforeEach(async () => {
    repo = {
      createQueryBuilder: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getRawMany: jest.fn(),
      find: jest.fn(),
      count: jest.fn(),
    };
    const module = await Test.createTestingModule({
      providers: [
        AdminWhatsappService,
        { provide: getRepositoryToken(TenantEntity), useValue: repo },
      ],
    }).compile();
    service = module.get(AdminWhatsappService);
  });

  it('calcula adoption rate sobre ACTIVE+TRIAL', async () => {
    repo.count
      .mockResolvedValueOnce(150) // eligible (ACTIVE+TRIAL)
      .mockResolvedValueOnce(60) // using
      .mockResolvedValueOnce(35) // STARTER
      .mockResolvedValueOnce(20) // PRO
      .mockResolvedValueOnce(5); // ENTERPRISE
    repo.find
      .mockResolvedValueOnce([]) // using
      .mockResolvedValueOnce([]); // notUsing
    repo.getRawMany.mockResolvedValueOnce([
      { segment: 'WORKSHOP', using: '40', eligible: '90' },
      { segment: 'RECYCLING', using: '20', eligible: '60' },
    ]);
    const out = await service.list();
    expect(out.kpis.adoptionRate).toBeCloseTo(60 / 150, 3);
    expect(out.kpis.starterCount).toBe(35);
    expect(out.kpis.proCount).toBe(20);
    expect(out.kpis.enterpriseCount).toBe(5);
    expect(out.kpis.addOnMrr).toBeNull();
    expect(out.adoptionBySegment[0].rate).toBeCloseTo(40 / 90, 3);
  });

  it('adoption rate 0 quando não há tenants elegíveis', async () => {
    repo.count
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);
    repo.find.mockResolvedValue([]);
    repo.getRawMany.mockResolvedValue([]);
    const out = await service.list();
    expect(out.kpis.adoptionRate).toBe(0);
  });
});
```

- [ ] **Step 3: Run — fail**

Run: `pnpm --filter backend test -- admin-whatsapp.service.spec`
Expected: FAIL.

- [ ] **Step 4: Implementar service**

```ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { TenantEntity, TenantStatus } from '../../tenancy/tenant.entity';
import { TenantSegment, WhatsappPlan } from '@praktikus/shared';
import {
  WhatsappAdoptionTenant,
  WhatsappResponseDto,
} from './dto/whatsapp-response.dto';

@Injectable()
export class AdminWhatsappService {
  constructor(
    @InjectRepository(TenantEntity)
    private readonly repo: Repository<TenantEntity>,
  ) {}

  async list(): Promise<WhatsappResponseDto> {
    const eligibleStatuses = [TenantStatus.ACTIVE, TenantStatus.TRIAL];

    const [
      eligibleCount,
      usingCount,
      starterCount,
      proCount,
      enterpriseCount,
    ] = await Promise.all([
      this.repo.count({ where: { status: In(eligibleStatuses) } }),
      this.repo.count({ where: { whatsappEnabled: true } }),
      this.repo.count({ where: { whatsappPlan: WhatsappPlan.STARTER } as any }),
      this.repo.count({ where: { whatsappPlan: WhatsappPlan.PRO } as any }),
      this.repo.count({ where: { whatsappPlan: WhatsappPlan.ENTERPRISE } as any }),
    ]);

    const [using, notUsing, segmentRows] = await Promise.all([
      this.repo.find({
        where: { whatsappEnabled: true },
        order: { updatedAt: 'DESC' },
        take: 100,
      }),
      this.repo.find({
        where: {
          whatsappEnabled: false,
          status: In(eligibleStatuses),
        },
        order: { createdAt: 'DESC' },
        take: 100,
      }),
      this.repo
        .createQueryBuilder('t')
        .select('t.segment', 'segment')
        .addSelect(
          `SUM(CASE WHEN t.whatsapp_enabled THEN 1 ELSE 0 END)`,
          'using',
        )
        .addSelect('COUNT(*)', 'eligible')
        .where('t.status IN (:...statuses)', { statuses: eligibleStatuses })
        .groupBy('t.segment')
        .getRawMany() as Promise<
        Array<{ segment: string; using: string; eligible: string }>
      >,
    ]);

    return {
      kpis: {
        adoptionRate: eligibleCount > 0 ? usingCount / eligibleCount : 0,
        starterCount,
        proCount,
        enterpriseCount,
        addOnMrr: null,
      },
      using: using.map((t) => this.toItem(t)),
      notUsing: notUsing.map((t) => this.toItem(t)),
      adoptionBySegment: segmentRows.map((r) => {
        const elig = Number(r.eligible);
        const use = Number(r.using);
        return {
          segment: r.segment as TenantSegment,
          rate: elig > 0 ? use / elig : 0,
          using: use,
          eligible: elig,
        };
      }),
    };
  }

  private toItem(t: TenantEntity): WhatsappAdoptionTenant {
    return {
      id: t.id,
      nomeFantasia: t.nomeFantasia,
      segment: t.segment,
      status: t.status,
      whatsappPlan: t.whatsappPlan ?? null,
      enabledAt: t.whatsappEnabled ? t.updatedAt.toISOString() : null,
      monthlyVolume: null,
    };
  }
}
```

- [ ] **Step 5: Controller**

```ts
import { Controller, Get, UseGuards } from '@nestjs/common';
import { AdminWhatsappService } from './admin-whatsapp.service';
import { PlatformAuthGuard } from '../admin-auth/platform-auth.guard';
import { PlatformOnly } from '../admin-auth/platform.decorator';

@Controller('admin/whatsapp')
@UseGuards(PlatformAuthGuard)
@PlatformOnly()
export class AdminWhatsappController {
  constructor(private readonly service: AdminWhatsappService) {}

  @Get()
  list() {
    return this.service.list();
  }
}
```

- [ ] **Step 6: Registrar no `admin.module.ts`** (mesmo padrão).

- [ ] **Step 7: Run — verde**

Run: `pnpm --filter backend test -- admin-whatsapp.service.spec`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/backend/src/modules/core/admin/admin-whatsapp/ \
        apps/backend/src/modules/core/admin/admin.module.ts
git commit -m "feat(admin): add whatsapp adoption endpoint"
```

---

## Task 16: `AdminFinancialService` + Controller (placeholders + counts)

**Files:**
- Create: `apps/backend/src/modules/core/admin/admin-financial/dto/financial-response.dto.ts`
- Create: `apps/backend/src/modules/core/admin/admin-financial/admin-financial.service.ts`
- Create: `apps/backend/src/modules/core/admin/admin-financial/admin-financial.service.spec.ts`
- Create: `apps/backend/src/modules/core/admin/admin-financial/admin-financial.controller.ts`
- Modify: `apps/backend/src/modules/core/admin/admin.module.ts`

- [ ] **Step 1: DTO**

```ts
export interface FinancialResponseDto {
  kpis: {
    mrr: null;
    arr: null;
    averageTicket: null;
    churn30d: null;
  };
  basicDistribution: {
    active: number;
    overdue: number;
    suspended: number;
    suspendedLast30Days: number;
  };
  recentCharges: []; // sempre vazio em Fase 1
}
```

- [ ] **Step 2: Spec**

```ts
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AdminFinancialService } from './admin-financial.service';
import { TenantEntity, TenantStatus } from '../../tenancy/tenant.entity';

describe('AdminFinancialService', () => {
  let service: AdminFinancialService;
  let repo: any;

  beforeEach(async () => {
    repo = { count: jest.fn() };
    const module = await Test.createTestingModule({
      providers: [
        AdminFinancialService,
        { provide: getRepositoryToken(TenantEntity), useValue: repo },
      ],
    }).compile();
    service = module.get(AdminFinancialService);
  });

  it('retorna KPIs Asaas como null e counts reais', async () => {
    repo.count
      .mockResolvedValueOnce(80) // ACTIVE
      .mockResolvedValueOnce(5) // OVERDUE
      .mockResolvedValueOnce(3) // SUSPENDED total
      .mockResolvedValueOnce(1); // SUSPENDED last 30d
    const out = await service.get();
    expect(out.kpis.mrr).toBeNull();
    expect(out.kpis.arr).toBeNull();
    expect(out.kpis.averageTicket).toBeNull();
    expect(out.kpis.churn30d).toBeNull();
    expect(out.basicDistribution.active).toBe(80);
    expect(out.basicDistribution.overdue).toBe(5);
    expect(out.basicDistribution.suspended).toBe(3);
    expect(out.basicDistribution.suspendedLast30Days).toBe(1);
    expect(out.recentCharges).toEqual([]);
  });
});
```

- [ ] **Step 3: Run — fail**

Run: `pnpm --filter backend test -- admin-financial.service.spec`
Expected: FAIL.

- [ ] **Step 4: Implementar service**

```ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import { TenantEntity, TenantStatus } from '../../tenancy/tenant.entity';
import { FinancialResponseDto } from './dto/financial-response.dto';

@Injectable()
export class AdminFinancialService {
  constructor(
    @InjectRepository(TenantEntity)
    private readonly repo: Repository<TenantEntity>,
  ) {}

  async get(): Promise<FinancialResponseDto> {
    const cutoff = new Date(Date.now() - 30 * 86_400_000);
    const [active, overdue, suspended, suspendedLast30] = await Promise.all([
      this.repo.count({ where: { status: TenantStatus.ACTIVE } }),
      this.repo.count({ where: { status: TenantStatus.OVERDUE } }),
      this.repo.count({ where: { status: TenantStatus.SUSPENDED } }),
      this.repo.count({
        where: {
          status: TenantStatus.SUSPENDED,
          updatedAt: MoreThan(cutoff),
        },
      }),
    ]);
    return {
      kpis: { mrr: null, arr: null, averageTicket: null, churn30d: null },
      basicDistribution: {
        active,
        overdue,
        suspended,
        suspendedLast30Days: suspendedLast30,
      },
      recentCharges: [],
    };
  }
}
```

- [ ] **Step 5: Controller**

```ts
import { Controller, Get, UseGuards } from '@nestjs/common';
import { AdminFinancialService } from './admin-financial.service';
import { PlatformAuthGuard } from '../admin-auth/platform-auth.guard';
import { PlatformOnly } from '../admin-auth/platform.decorator';

@Controller('admin/financial')
@UseGuards(PlatformAuthGuard)
@PlatformOnly()
export class AdminFinancialController {
  constructor(private readonly service: AdminFinancialService) {}

  @Get()
  get() {
    return this.service.get();
  }
}
```

- [ ] **Step 6: Registrar no `admin.module.ts`** (mesmo padrão).

- [ ] **Step 7: Run — verde**

Run: `pnpm --filter backend test -- admin-financial.service.spec`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/backend/src/modules/core/admin/admin-financial/ \
        apps/backend/src/modules/core/admin/admin.module.ts
git commit -m "feat(admin): add financial endpoint with placeholders and basic counts"
```

---

## Task 17: E2E test — admin endpoints + cross-token rejection

**Files:**
- Create: `apps/backend/test/admin.e2e-spec.ts`

Esse teste sobe o app completo, faz login real (precisa do seed da Task 18 ter rodado, ou cria platform user inline antes do teste) e bate em cada endpoint. Também valida o isolamento mútuo dos guards.

- [ ] **Step 1: Garantir DB de teste vazio do que importa**

Pré-requisito: Postgres local de pé (`docker compose up -d postgres`) com migrations aplicadas. Como esse teste compartilha o mesmo DB de dev, ele cria/limpa apenas seus próprios registros (platform_user dedicado).

- [ ] **Step 2: Escrever o teste**

```ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as bcrypt from 'bcrypt';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { PlatformUserEntity } from '../src/modules/core/admin/admin-auth/platform-user.entity';

describe('Admin endpoints (e2e)', () => {
  let app: INestApplication;
  let ds: DataSource;
  const TEST_EMAIL = 'e2e-platform@test.local';
  const TEST_PASSWORD = 'e2e_test_password_123';
  let platformAccessToken: string;
  let tenantAccessToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    ds = app.get(DataSource);

    // Seed um platform_user dedicado pra esse teste
    const repo = ds.getRepository(PlatformUserEntity);
    await repo.delete({ email: TEST_EMAIL });
    await repo.save({
      email: TEST_EMAIL,
      passwordHash: await bcrypt.hash(TEST_PASSWORD, 12),
      name: 'E2E Tester',
      role: 'PLATFORM_OWNER',
    });
  });

  afterAll(async () => {
    if (ds) {
      await ds
        .getRepository(PlatformUserEntity)
        .delete({ email: TEST_EMAIL });
    }
    await app.close();
  });

  it('POST /api/admin/auth/login devolve tokens válidos', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/admin/auth/login')
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD })
      .expect(200);
    expect(res.body.access_token).toBeDefined();
    expect(res.body.refresh_token).toBeDefined();
    expect(res.body.user.email).toBe(TEST_EMAIL);
    platformAccessToken = res.body.access_token;
  });

  it('POST /api/admin/auth/login rejeita senha errada', async () => {
    await request(app.getHttpServer())
      .post('/api/admin/auth/login')
      .send({ email: TEST_EMAIL, password: 'wrong' })
      .expect(401);
  });

  it.each([
    '/api/admin/overview',
    '/api/admin/tenants',
    '/api/admin/segments',
    '/api/admin/whatsapp',
    '/api/admin/financial',
  ])('GET %s autentica com platform JWT', async (path) => {
    const res = await request(app.getHttpServer())
      .get(path)
      .set('Authorization', `Bearer ${platformAccessToken}`)
      .expect(200);
    expect(res.body).toBeDefined();
  });

  it('GET /api/admin/overview rejeita sem token', async () => {
    await request(app.getHttpServer())
      .get('/api/admin/overview')
      .expect(401);
  });

  it('GET /api/admin/overview rejeita JWT de tenant', async () => {
    // Cria um tenant + user via fluxo real só se ainda não existir token
    if (!tenantAccessToken) {
      const reg = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          cnpj: '11.111.111/0001-11',
          razaoSocial: 'E2E Tenant LTDA',
          nomeFantasia: 'E2E Tenant',
          email: 'e2e-tenant@test.local',
          password: 'tenant_password_123',
          ownerName: 'E2E Owner',
          segment: 'WORKSHOP',
        });
      // Se já existir (re-run), faz login
      if (reg.status === 201 || reg.status === 200) {
        tenantAccessToken = reg.body.access_token;
      } else {
        const log = await request(app.getHttpServer())
          .post('/api/auth/login')
          .send({
            email: 'e2e-tenant@test.local',
            password: 'tenant_password_123',
          })
          .expect(200);
        tenantAccessToken = log.body.access_token;
      }
    }
    await request(app.getHttpServer())
      .get('/api/admin/overview')
      .set('Authorization', `Bearer ${tenantAccessToken}`)
      .expect(401);
  });

  it('GET /api/auth/me rejeita JWT de plataforma (defesa em profundidade)', async () => {
    // Endpoint de tenant qualquer protegido por JwtAuthGuard. Use um existente.
    // Se /api/auth/me não existir, troque por /api/customers ou outro.
    await request(app.getHttpServer())
      .patch('/api/auth/me/password')
      .set('Authorization', `Bearer ${platformAccessToken}`)
      .send({ currentPassword: 'x', newPassword: 'y' })
      .expect(401);
  });

  it('POST /api/admin/auth/logout invalida o refresh token', async () => {
    const log = await request(app.getHttpServer())
      .post('/api/admin/auth/login')
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD })
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/admin/auth/logout')
      .set('Authorization', `Bearer ${log.body.access_token}`)
      .send({ refresh_token: log.body.refresh_token })
      .expect(204);

    await request(app.getHttpServer())
      .post('/api/admin/auth/refresh')
      .send({ refresh_token: log.body.refresh_token })
      .expect(401);
  });
});
```

- [ ] **Step 3: Rodar e2e**

Run:
```bash
docker compose up -d postgres
pnpm --filter backend migration:run
pnpm --filter backend test:e2e -- admin.e2e-spec
```
Expected: PASS — todos os specs do bloco `Admin endpoints (e2e)` passam.

- [ ] **Step 4: Commit**

```bash
git add apps/backend/test/admin.e2e-spec.ts
git commit -m "test(admin): e2e covering all endpoints and cross-token rejection"
```

---

## Task 18: Seed dev — `seed-admin-dev.ts`

**Files:**
- Create: `apps/backend/src/scripts/seed-admin-dev.ts`
- Modify: `apps/backend/package.json` (adicionar script)

- [ ] **Step 1: Implementar seed**

```ts
import 'reflect-metadata';
import * as bcrypt from 'bcrypt';
import { faker } from '@faker-js/faker/locale/pt_BR';
import { AppDataSource } from '../database/data-source';
import { PlatformUserEntity } from '../modules/core/admin/admin-auth/platform-user.entity';
import { TenantEntity, TenantStatus } from '../modules/core/tenancy/tenant.entity';
import { TenantSegment } from '@praktikus/shared';

const UFS = [
  'SP', 'RJ', 'MG', 'RS', 'PR', 'SC', 'BA', 'GO', 'PE', 'CE',
  'DF', 'ES', 'PA', 'AM', 'MT',
];

const CITIES_BY_UF: Record<string, string[]> = {
  SP: ['São Paulo', 'Campinas', 'Santos'],
  RJ: ['Rio de Janeiro', 'Niterói'],
  MG: ['Belo Horizonte', 'Uberlândia'],
  RS: ['Porto Alegre', 'Caxias'],
  PR: ['Curitiba', 'Londrina'],
  SC: ['Florianópolis', 'Joinville'],
  BA: ['Salvador'],
  GO: ['Goiânia'],
  PE: ['Recife'],
  CE: ['Fortaleza'],
  DF: ['Brasília'],
  ES: ['Vitória'],
  PA: ['Belém'],
  AM: ['Manaus'],
  MT: ['Cuiabá'],
};

function randomDate(daysAgoMin: number, daysAgoMax: number): Date {
  const span = daysAgoMax - daysAgoMin;
  const offset = Math.floor(Math.random() * span) + daysAgoMin;
  return new Date(Date.now() - offset * 86_400_000);
}

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('seed-admin-dev refuses to run with NODE_ENV=production');
  }

  const ownerEmail = process.env.PLATFORM_OWNER_EMAIL;
  const ownerPassword = process.env.PLATFORM_OWNER_PASSWORD;
  if (!ownerEmail || !ownerPassword) {
    throw new Error(
      'PLATFORM_OWNER_EMAIL and PLATFORM_OWNER_PASSWORD must be set in .env',
    );
  }

  await AppDataSource.initialize();
  console.log('[seed] DataSource initialized');

  // 1) Upsert platform_user único
  const userRepo = AppDataSource.getRepository(PlatformUserEntity);
  const passwordHash = await bcrypt.hash(ownerPassword, 12);
  const existing = await userRepo.findOne({ where: { email: ownerEmail } });
  if (existing) {
    existing.passwordHash = passwordHash;
    existing.name = existing.name || 'Platform Owner';
    await userRepo.save(existing);
    console.log(`[seed] Updated platform_user ${ownerEmail}`);
  } else {
    await userRepo.save({
      email: ownerEmail,
      passwordHash,
      name: 'Platform Owner',
      role: 'PLATFORM_OWNER',
    });
    console.log(`[seed] Created platform_user ${ownerEmail}`);
  }

  // 2) Popular ~80 tenants se a tabela tiver <20 registros
  const tenantRepo = AppDataSource.getRepository(TenantEntity);
  const tenantCount = await tenantRepo.count();
  if (tenantCount >= 20) {
    console.log(
      `[seed] Tenants count = ${tenantCount} (>= 20). Skipping fake tenants.`,
    );
    await AppDataSource.destroy();
    return;
  }

  console.log(`[seed] Tenants count = ${tenantCount}. Creating fakes...`);
  const TARGET = 80;
  const toCreate = TARGET - tenantCount;

  // Distribuição alvo: 60% ACTIVE, 25% TRIAL, 8% OVERDUE, 7% SUSPENDED
  // 70% WORKSHOP, 30% RECYCLING
  // 40% whatsappEnabled, distribuídos entre STARTER (60%), PRO (25%), ENTERPRISE (15%)

  const fakes: Partial<TenantEntity>[] = [];
  for (let i = 0; i < toCreate; i++) {
    const r = Math.random();
    let status: TenantStatus;
    if (r < 0.6) status = TenantStatus.ACTIVE;
    else if (r < 0.85) status = TenantStatus.TRIAL;
    else if (r < 0.93) status = TenantStatus.OVERDUE;
    else status = TenantStatus.SUSPENDED;

    const segment =
      Math.random() < 0.7 ? TenantSegment.WORKSHOP : TenantSegment.RECYCLING;

    const uf = faker.helpers.arrayElement(UFS);
    const city = faker.helpers.arrayElement(CITIES_BY_UF[uf]);

    const wppEnabled = Math.random() < 0.4;

    let trialEndsAt: Date | null = null;
    if (status === TenantStatus.TRIAL) {
      // Espalha: alguns expirando próximos 7d, outros adiante
      const daysAhead =
        Math.random() < 0.3
          ? Math.floor(Math.random() * 7) + 1
          : Math.floor(Math.random() * 30) + 7;
      trialEndsAt = new Date(Date.now() + daysAhead * 86_400_000);
    }

    const cnpj = faker.string.numeric(14).replace(
      /(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,
      '$1.$2.$3/$4-$5',
    );

    const idx = String(i).padStart(3, '0');
    fakes.push({
      slug: `seed-${idx}-${faker.string.alphanumeric(6).toLowerCase()}`,
      schemaName: `tenant_seed_${idx}_${faker.string.alphanumeric(8).toLowerCase()}`,
      cnpj,
      razaoSocial: `${faker.company.name()} LTDA`,
      nomeFantasia: faker.company.name(),
      endereco: {
        street: faker.location.street(),
        number: String(faker.number.int({ min: 1, max: 9999 })),
        city,
        state: uf,
        zip: faker.location.zipCode('########'),
      },
      telefone: faker.phone.number(),
      status,
      segment,
      whatsappEnabled: wppEnabled,
      whatsappPlan: wppEnabled
        ? (Math.random() < 0.6
            ? 'STARTER'
            : Math.random() < 0.85
              ? 'PRO'
              : 'ENTERPRISE') as any
        : null,
      trialEndsAt,
      createdAt: randomDate(0, 180),
      updatedAt: new Date(),
    });
  }

  // Bulk insert (não cria schemas/tabelas internas — esses tenants são "metadata-only" pro admin)
  await tenantRepo.insert(fakes as any[]);
  console.log(`[seed] Inserted ${fakes.length} fake tenants`);

  await AppDataSource.destroy();
  console.log('[seed] Done.');
}

main().catch((err) => {
  console.error('[seed] Failed:', err);
  process.exit(1);
});
```

- [ ] **Step 2: Adicionar script em `apps/backend/package.json`**

Adicionar dentro de `"scripts"`:

```json
"seed:admin-dev": "ts-node -r tsconfig-paths/register src/scripts/seed-admin-dev.ts"
```

- [ ] **Step 3: Rodar o seed**

Run: `pnpm --filter backend seed:admin-dev`
Expected: logs `[seed] Created/Updated platform_user ...` e `[seed] Inserted N fake tenants`. Sem erros.

- [ ] **Step 4: Verificar no Postgres**

Run:
```bash
docker compose exec postgres psql -U praktikus -d praktikus -c \
  "SELECT count(*), status FROM tenants GROUP BY status;"
docker compose exec postgres psql -U praktikus -d praktikus -c \
  "SELECT email, name FROM platform_users;"
```
Expected: distribuição ~60% ACTIVE, ~25% TRIAL, ~8% OVERDUE, ~7% SUSPENDED. 1 platform_user com seu email.

- [ ] **Step 5: Smoke manual — login real**

Run:
```bash
curl -X POST http://localhost:3000/api/admin/auth/login \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$PLATFORM_OWNER_EMAIL\",\"password\":\"$PLATFORM_OWNER_PASSWORD\"}"
```
Expected: JSON com `access_token`, `refresh_token`, `user`.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/scripts/seed-admin-dev.ts apps/backend/package.json
git commit -m "feat(admin): dev seed script for platform_user and fake tenants"
```

---

## Task 19: Admin DS — `admin-tokens.css` + `admin-components.css`

**Files:**
- Create: `apps/frontend/src/pages/admin/styles/admin-tokens.css`
- Create: `apps/frontend/src/pages/admin/styles/admin-components.css`

Os tokens vêm do mock em `_design-reference/design_handoff_admin_panel/reference/tokens.css`, mas escopados em `.adm-root` (não em `:root`) pra isolar do app cliente.

- [ ] **Step 1: Criar `admin-tokens.css`**

```css
/* Admin Panel Design Tokens — Praktikus
 * Escopado em .adm-root pra isolar do app cliente.
 */

.adm-root {
  /* Brand teal/petróleo */
  --brand-50:  #F2F5F5;
  --brand-100: #DCE6E6;
  --brand-200: #B6CDCE;
  --brand-300: #86AEB0;
  --brand-400: #558D8F;
  --brand-500: #348E91;
  --brand-600: #2B7375;
  --brand-700: #1C5052;
  --brand-800: #213635;
  --brand-900: #142322;
  --brand-950: #0A0C0D;

  /* Neutrals */
  --neutral-0:   #FFFFFF;
  --neutral-50:  #F7F8F8;
  --neutral-100: #EEF0F0;
  --neutral-200: #DDE1E1;
  --neutral-300: #BEC5C5;
  --neutral-400: #8E9898;
  --neutral-500: #6B7575;
  --neutral-600: #4E5757;
  --neutral-700: #353D3D;
  --neutral-800: #1F2626;
  --neutral-900: #121717;
  --neutral-950: #0A0C0D;

  /* Semantic */
  --adm-success: #3BA776;
  --adm-success-bg: #E6F4EC;
  --adm-warning: #D98A2B;
  --adm-warning-bg: #FBEEDB;
  --adm-danger:  #D95B5B;
  --adm-danger-bg: #FBE6E6;
  --adm-info:    #348E91;
  --adm-info-bg: #E2EEEE;

  /* Radius / spacing */
  --adm-radius-xs: 4px;
  --adm-radius-sm: 6px;
  --adm-radius-md: 10px;
  --adm-radius-lg: 14px;
  --adm-radius-xl: 20px;
  --adm-radius-2xl: 28px;
  --adm-radius: var(--adm-radius-md);

  --adm-density: 1;
  --adm-space-row: calc(12px * var(--adm-density));
  --adm-space-card: calc(24px * var(--adm-density));
  --adm-space-input-y: calc(10px * var(--adm-density));

  /* Shadows (light) */
  --adm-shadow-xs: 0 1px 2px rgba(10, 12, 13, 0.04);
  --adm-shadow-sm: 0 1px 3px rgba(10, 12, 13, 0.06), 0 1px 2px rgba(10, 12, 13, 0.04);
  --adm-shadow-md: 0 4px 12px rgba(10, 12, 13, 0.08), 0 2px 4px rgba(10, 12, 13, 0.04);
  --adm-shadow-lg: 0 12px 28px rgba(10, 12, 13, 0.10), 0 4px 8px rgba(10, 12, 13, 0.05);

  /* Typography */
  --adm-font-sans: 'Inter', 'InterVariable', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --adm-font-display: 'Instrument Serif', 'Iowan Old Style', 'Georgia', serif;
  --adm-font-mono: 'JetBrains Mono', 'SF Mono', Menlo, monospace;

  /* Light theme (default) */
  color-scheme: light;
  --adm-bg:           #FBFBFA;
  --adm-bg-subtle:    #F4F5F5;
  --adm-bg-muted:     #EEF0F0;
  --adm-surface:      #FFFFFF;
  --adm-surface-2:    #F7F8F8;
  --adm-border:       #E4E7E7;
  --adm-border-strong:#CDD3D3;
  --adm-fg:           #0F1414;
  --adm-fg-muted:     #5A6464;
  --adm-fg-subtle:    #8A9393;
  --adm-accent:       var(--brand-500);
  --adm-accent-fg:    #FFFFFF;
  --adm-accent-soft:  #E2EEEE;
  --adm-accent-hover: var(--brand-600);
  --adm-ring:         color-mix(in oklch, var(--adm-accent) 40%, transparent);

  /* Segment colors (Fase 1: 2 segmentos) */
  --adm-seg-workshop:  #348E91;
  --adm-seg-recycling: #D98A2B;

  font-family: var(--adm-font-sans);
  background: var(--adm-bg);
  color: var(--adm-fg);
}

.adm-root[data-theme="dark"] {
  color-scheme: dark;
  --adm-bg:           #0A0C0D;
  --adm-bg-subtle:    #121717;
  --adm-bg-muted:     #18201F;
  --adm-surface:      #141A1A;
  --adm-surface-2:    #1A2221;
  --adm-border:       #24302F;
  --adm-border-strong:#334241;
  --adm-fg:           #EEF2F2;
  --adm-fg-muted:     #9AA5A5;
  --adm-fg-subtle:    #6A7575;
  --adm-accent:       #3FA3A6;
  --adm-accent-fg:    #05100F;
  --adm-accent-soft:  #14302F;
  --adm-accent-hover: #52B5B8;

  --adm-shadow-xs: 0 1px 2px rgba(0, 0, 0, 0.35);
  --adm-shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.4);
  --adm-shadow-md: 0 6px 16px rgba(0, 0, 0, 0.45);
  --adm-shadow-lg: 0 16px 32px rgba(0, 0, 0, 0.55);
}
```

- [ ] **Step 2: Criar `admin-components.css`**

Esse arquivo cresce ao longo do plano (cada primitivo adiciona seu bloco). Comece com base + utilities:

```css
/* Admin DS — primitivos. Escopado em .adm-root. */

.adm-root *,
.adm-root *::before,
.adm-root *::after {
  box-sizing: border-box;
}

.adm-root {
  font-size: 14px;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}

/* Card */
.adm-card {
  background: var(--adm-surface);
  border: 1px solid var(--adm-border);
  border-radius: var(--adm-radius-md);
  box-shadow: var(--adm-shadow-xs);
  padding: var(--adm-space-card);
}
.adm-card__title {
  font-weight: 600;
  font-size: 14px;
  color: var(--adm-fg);
  margin: 0 0 8px 0;
}

/* Badge */
.adm-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  font-size: 11px;
  font-weight: 600;
  border-radius: var(--adm-radius-xs);
  text-transform: uppercase;
  letter-spacing: 0.02em;
  background: var(--adm-bg-subtle);
  color: var(--adm-fg-muted);
}
.adm-badge--success { background: var(--adm-success-bg); color: var(--adm-success); }
.adm-badge--warning { background: var(--adm-warning-bg); color: var(--adm-warning); }
.adm-badge--danger  { background: var(--adm-danger-bg);  color: var(--adm-danger); }
.adm-badge--info    { background: var(--adm-info-bg);    color: var(--adm-info); }

/* Button */
.adm-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 14px;
  font-size: 13px;
  font-weight: 600;
  border-radius: var(--adm-radius-sm);
  border: 1px solid var(--adm-border);
  background: var(--adm-surface);
  color: var(--adm-fg);
  cursor: pointer;
  transition: background .12s ease, border-color .12s ease;
}
.adm-btn:hover { background: var(--adm-bg-subtle); }
.adm-btn--primary {
  background: var(--adm-accent);
  border-color: var(--adm-accent);
  color: var(--adm-accent-fg);
}
.adm-btn--primary:hover { background: var(--adm-accent-hover); }
.adm-btn:disabled { opacity: .5; cursor: not-allowed; }

/* Skeleton */
@keyframes adm-shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
.adm-skeleton {
  display: inline-block;
  background: linear-gradient(
    90deg,
    var(--adm-bg-subtle) 0%,
    var(--adm-bg-muted) 50%,
    var(--adm-bg-subtle) 100%
  );
  background-size: 200% 100%;
  animation: adm-shimmer 1.4s ease-in-out infinite;
  border-radius: var(--adm-radius-xs);
}

/* Empty state */
.adm-empty {
  text-align: center;
  padding: 32px 16px;
  color: var(--adm-fg-muted);
}
.adm-empty__title { font-weight: 600; margin-bottom: 4px; }
.adm-empty__msg { font-size: 13px; }

/* Layout */
.adm-shell { display: grid; grid-template-columns: 240px 1fr; min-height: 100vh; }
.adm-shell__sidebar { background: var(--brand-950); color: #DCE6E6; }
.adm-shell__main { display: flex; flex-direction: column; }
.adm-topbar {
  position: sticky; top: 0; z-index: 10;
  background: var(--adm-surface);
  border-bottom: 1px solid var(--adm-border);
  height: 56px;
  padding: 0 24px;
  display: flex; align-items: center; justify-content: space-between;
}
.adm-content { padding: 24px; flex: 1; }
```

(Outros estilos — `.adm-kpi`, `.adm-table`, `.adm-chip`, `.adm-filterbar`, `.adm-healthbar`, `.adm-avatar`, `.adm-tilemap` — são adicionados nas tasks dos respectivos componentes.)

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/pages/admin/styles/
git commit -m "feat(admin-ui): add scoped tokens and base components CSS"
```

---

## Task 20: `services/admin.api.ts` — axios isolado + interceptor

**Files:**
- Create: `apps/frontend/src/services/admin.api.ts`

- [ ] **Step 1: Implementar cliente isolado**

```ts
import axios, { type AxiosError } from 'axios';

const ACCESS_KEY = 'pk_admin_access_token';
const REFRESH_KEY = 'pk_admin_refresh_token';

export const adminApi = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api',
  headers: {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache',
  },
});

adminApi.interceptors.request.use((config) => {
  const token = localStorage.getItem(ACCESS_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

adminApi.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original: any = error.config;
    if (error.response?.status === 401 && !original?._retry) {
      original._retry = true;
      const refreshToken = localStorage.getItem(REFRESH_KEY);
      if (refreshToken) {
        try {
          const { data } = await axios.post<{
            access_token: string;
            refresh_token: string;
          }>(
            `${import.meta.env.VITE_API_URL ?? '/api'}/admin/auth/refresh`,
            { refresh_token: refreshToken },
          );
          localStorage.setItem(ACCESS_KEY, data.access_token);
          localStorage.setItem(REFRESH_KEY, data.refresh_token);
          original.headers.Authorization = `Bearer ${data.access_token}`;
          return adminApi(original);
        } catch {
          localStorage.removeItem(ACCESS_KEY);
          localStorage.removeItem(REFRESH_KEY);
          window.location.href = '/admin/login';
        }
      } else {
        window.location.href = '/admin/login';
      }
    }
    return Promise.reject(error);
  },
);

export const ADMIN_TOKEN_KEYS = {
  access: ACCESS_KEY,
  refresh: REFRESH_KEY,
} as const;
```

- [ ] **Step 2: Commit**

```bash
git add apps/frontend/src/services/admin.api.ts
git commit -m "feat(admin-ui): add isolated axios client for admin endpoints"
```

---

## Task 21: `services/admin-auth.service.ts` + testes

**Files:**
- Create: `apps/frontend/src/services/admin-auth.service.ts`
- Create: `apps/frontend/src/services/admin-auth.service.test.ts`

- [ ] **Step 1: Implementar service**

```ts
import { adminApi, ADMIN_TOKEN_KEYS } from './admin.api';

export interface AdminLoginPayload {
  email: string;
  password: string;
}

export interface AdminAuthTokens {
  access_token: string;
  refresh_token: string;
  user: { id: string; email: string; name: string };
}

export const adminAuthService = {
  async login(payload: AdminLoginPayload): Promise<AdminAuthTokens> {
    const { data } = await adminApi.post<AdminAuthTokens>(
      '/admin/auth/login',
      payload,
    );
    return data;
  },

  async logout(refreshToken: string): Promise<void> {
    await adminApi.post('/admin/auth/logout', { refresh_token: refreshToken });
  },

  persistTokens(tokens: AdminAuthTokens): void {
    localStorage.setItem(ADMIN_TOKEN_KEYS.access, tokens.access_token);
    localStorage.setItem(ADMIN_TOKEN_KEYS.refresh, tokens.refresh_token);
  },

  clearTokens(): void {
    localStorage.removeItem(ADMIN_TOKEN_KEYS.access);
    localStorage.removeItem(ADMIN_TOKEN_KEYS.refresh);
  },

  getAccessToken(): string | null {
    return localStorage.getItem(ADMIN_TOKEN_KEYS.access);
  },

  getRefreshToken(): string | null {
    return localStorage.getItem(ADMIN_TOKEN_KEYS.refresh);
  },
};
```

- [ ] **Step 2: Tests**

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { adminAuthService } from './admin-auth.service';

vi.mock('./admin.api', () => ({
  adminApi: { post: vi.fn() },
  ADMIN_TOKEN_KEYS: {
    access: 'pk_admin_access_token',
    refresh: 'pk_admin_refresh_token',
  },
}));

import { adminApi } from './admin.api';
const mockPost = (adminApi as any).post as ReturnType<typeof vi.fn>;

describe('adminAuthService', () => {
  beforeEach(() => {
    localStorage.clear();
    mockPost.mockReset();
  });

  it('login chama POST /admin/auth/login e devolve tokens', async () => {
    mockPost.mockResolvedValue({
      data: {
        access_token: 'a',
        refresh_token: 'r',
        user: { id: 'u', email: 'e@e', name: 'n' },
      },
    });
    const out = await adminAuthService.login({ email: 'e@e', password: 'p' });
    expect(mockPost).toHaveBeenCalledWith('/admin/auth/login', {
      email: 'e@e',
      password: 'p',
    });
    expect(out.access_token).toBe('a');
  });

  it('persistTokens grava nas chaves pk_admin_*', () => {
    adminAuthService.persistTokens({
      access_token: 'a',
      refresh_token: 'r',
      user: { id: 'u', email: 'e@e', name: 'n' },
    });
    expect(localStorage.getItem('pk_admin_access_token')).toBe('a');
    expect(localStorage.getItem('pk_admin_refresh_token')).toBe('r');
  });

  it('clearTokens remove ambas as chaves', () => {
    localStorage.setItem('pk_admin_access_token', 'a');
    localStorage.setItem('pk_admin_refresh_token', 'r');
    adminAuthService.clearTokens();
    expect(localStorage.getItem('pk_admin_access_token')).toBeNull();
    expect(localStorage.getItem('pk_admin_refresh_token')).toBeNull();
  });
});
```

- [ ] **Step 3: Run — verde**

Run: `pnpm --filter frontend test -- admin-auth.service`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/services/admin-auth.service.ts \
        apps/frontend/src/services/admin-auth.service.test.ts
git commit -m "feat(admin-ui): add admin auth service with isolated tokens"
```

---

## Task 22: Store Zustand `platform-auth.store.ts` + testes

**Files:**
- Create: `apps/frontend/src/store/platform-auth.store.ts`
- Create: `apps/frontend/src/store/platform-auth.store.test.ts`

- [ ] **Step 1: Implementar store**

```ts
import { create } from 'zustand';
import { jwtDecode } from 'jwt-decode';
import { adminAuthService } from '../services/admin-auth.service';

export interface PlatformJwtUser {
  sub: string;
  email: string;
  name: string;
  is_platform_user: true;
  exp: number;
}

interface PlatformAuthState {
  user: PlatformJwtUser | null;
  isAuthenticated: boolean;
  isHydrated: boolean;
  setTokens: (t: {
    access_token: string;
    refresh_token: string;
    user: { id: string; email: string; name: string };
  }) => void;
  logout: () => Promise<void>;
  hydrate: () => void;
}

export const usePlatformAuthStore = create<PlatformAuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isHydrated: false,

  setTokens(tokens) {
    adminAuthService.persistTokens(tokens);
    const decoded = jwtDecode<PlatformJwtUser>(tokens.access_token);
    set({ user: decoded, isAuthenticated: true, isHydrated: true });
  },

  async logout() {
    const refresh = adminAuthService.getRefreshToken();
    if (refresh) {
      try {
        await adminAuthService.logout(refresh);
      } catch {
        // silent — token may already be invalid
      }
    }
    adminAuthService.clearTokens();
    set({ user: null, isAuthenticated: false });
  },

  hydrate() {
    const token = adminAuthService.getAccessToken();
    if (token) {
      try {
        const decoded = jwtDecode<PlatformJwtUser>(token);
        const expired = decoded.exp * 1000 < Date.now();
        if (!expired && decoded.is_platform_user === true) {
          set({ user: decoded, isAuthenticated: true, isHydrated: true });
          return;
        }
        adminAuthService.clearTokens();
      } catch {
        adminAuthService.clearTokens();
      }
    }
    set({ isHydrated: true });
  },
}));
```

- [ ] **Step 2: Tests**

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { usePlatformAuthStore } from './platform-auth.store';

vi.mock('../services/admin-auth.service', () => ({
  adminAuthService: {
    persistTokens: vi.fn(),
    clearTokens: vi.fn(),
    getAccessToken: vi.fn(),
    getRefreshToken: vi.fn(),
    logout: vi.fn(),
  },
}));

vi.mock('jwt-decode', () => ({
  jwtDecode: vi.fn(),
}));

import { adminAuthService } from '../services/admin-auth.service';
import { jwtDecode } from 'jwt-decode';

describe('usePlatformAuthStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePlatformAuthStore.setState({
      user: null,
      isAuthenticated: false,
      isHydrated: false,
    });
  });

  it('hydrate marca authenticated quando token de plataforma é válido', () => {
    (adminAuthService.getAccessToken as any).mockReturnValue('valid.jwt');
    (jwtDecode as any).mockReturnValue({
      sub: 'u1',
      email: 'a@a',
      name: 'A',
      is_platform_user: true,
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    usePlatformAuthStore.getState().hydrate();
    const state = usePlatformAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.isHydrated).toBe(true);
    expect(state.user?.email).toBe('a@a');
  });

  it('hydrate limpa tokens se is_platform_user faltar', () => {
    (adminAuthService.getAccessToken as any).mockReturnValue('jwt');
    (jwtDecode as any).mockReturnValue({
      sub: 'u1',
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    usePlatformAuthStore.getState().hydrate();
    expect(adminAuthService.clearTokens).toHaveBeenCalled();
    expect(usePlatformAuthStore.getState().isAuthenticated).toBe(false);
  });

  it('hydrate limpa tokens se expirado', () => {
    (adminAuthService.getAccessToken as any).mockReturnValue('jwt');
    (jwtDecode as any).mockReturnValue({
      sub: 'u1',
      is_platform_user: true,
      exp: Math.floor(Date.now() / 1000) - 10,
    });
    usePlatformAuthStore.getState().hydrate();
    expect(adminAuthService.clearTokens).toHaveBeenCalled();
  });

  it('setTokens persiste e decodifica', () => {
    (jwtDecode as any).mockReturnValue({
      sub: 'u1',
      email: 'a@a',
      name: 'A',
      is_platform_user: true,
      exp: 0,
    });
    usePlatformAuthStore.getState().setTokens({
      access_token: 'a',
      refresh_token: 'r',
      user: { id: 'u1', email: 'a@a', name: 'A' },
    });
    expect(adminAuthService.persistTokens).toHaveBeenCalled();
    expect(usePlatformAuthStore.getState().isAuthenticated).toBe(true);
  });

  it('logout chama service e zera state', async () => {
    (adminAuthService.getRefreshToken as any).mockReturnValue('r');
    await usePlatformAuthStore.getState().logout();
    expect(adminAuthService.logout).toHaveBeenCalledWith('r');
    expect(adminAuthService.clearTokens).toHaveBeenCalled();
    expect(usePlatformAuthStore.getState().user).toBeNull();
  });
});
```

- [ ] **Step 3: Run — verde**

Run: `pnpm --filter frontend test -- platform-auth.store`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/store/platform-auth.store.ts \
        apps/frontend/src/store/platform-auth.store.test.ts
git commit -m "feat(admin-ui): add platform-auth zustand store with hydration"
```

---

## Task 23: `PlatformOnlyRoute` + testes

**Files:**
- Create: `apps/frontend/src/pages/admin/_layout/PlatformOnlyRoute.tsx`
- Create: `apps/frontend/src/pages/admin/_layout/PlatformOnlyRoute.test.tsx`

- [ ] **Step 1: Implementar guard de rota**

```tsx
import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { usePlatformAuthStore } from '../../../store/platform-auth.store';

interface Props {
  children: ReactNode;
}

export function PlatformOnlyRoute({ children }: Props) {
  const isAuthenticated = usePlatformAuthStore((s) => s.isAuthenticated);
  const isHydrated = usePlatformAuthStore((s) => s.isHydrated);
  const location = useLocation();

  if (!isHydrated) return null;
  if (!isAuthenticated) {
    // Persiste última página tentada (sem o /admin/login final)
    if (
      location.pathname !== '/admin/login' &&
      location.pathname.startsWith('/admin')
    ) {
      localStorage.setItem('pk_admin_page', location.pathname);
    }
    return <Navigate to="/admin/login" replace />;
  }
  return <>{children}</>;
}
```

- [ ] **Step 2: Tests**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { PlatformOnlyRoute } from './PlatformOnlyRoute';

vi.mock('../../../store/platform-auth.store', () => ({
  usePlatformAuthStore: vi.fn(),
}));

import { usePlatformAuthStore } from '../../../store/platform-auth.store';
const mockStore = usePlatformAuthStore as any;

describe('PlatformOnlyRoute', () => {
  it('renderiza filhos quando autenticado', () => {
    mockStore.mockImplementation((s: any) =>
      s({ isAuthenticated: true, isHydrated: true }),
    );
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route
            path="/admin"
            element={
              <PlatformOnlyRoute>
                <div>OK</div>
              </PlatformOnlyRoute>
            }
          />
          <Route path="/admin/login" element={<div>LOGIN</div>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText('OK')).toBeInTheDocument();
  });

  it('redireciona pra /admin/login quando não autenticado', () => {
    mockStore.mockImplementation((s: any) =>
      s({ isAuthenticated: false, isHydrated: true }),
    );
    render(
      <MemoryRouter initialEntries={['/admin/clientes']}>
        <Routes>
          <Route
            path="/admin/clientes"
            element={
              <PlatformOnlyRoute>
                <div>OK</div>
              </PlatformOnlyRoute>
            }
          />
          <Route path="/admin/login" element={<div>LOGIN</div>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.queryByText('OK')).not.toBeInTheDocument();
    expect(screen.getByText('LOGIN')).toBeInTheDocument();
  });

  it('persiste pk_admin_page quando redireciona', () => {
    localStorage.clear();
    mockStore.mockImplementation((s: any) =>
      s({ isAuthenticated: false, isHydrated: true }),
    );
    render(
      <MemoryRouter initialEntries={['/admin/clientes']}>
        <Routes>
          <Route
            path="/admin/clientes"
            element={
              <PlatformOnlyRoute>
                <div>OK</div>
              </PlatformOnlyRoute>
            }
          />
          <Route path="/admin/login" element={<div>LOGIN</div>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(localStorage.getItem('pk_admin_page')).toBe('/admin/clientes');
  });
});
```

- [ ] **Step 3: Run — verde**

Run: `pnpm --filter frontend test -- PlatformOnlyRoute`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/pages/admin/_layout/PlatformOnlyRoute.tsx \
        apps/frontend/src/pages/admin/_layout/PlatformOnlyRoute.test.tsx
git commit -m "feat(admin-ui): add PlatformOnlyRoute guard with last-page persistence"
```

---

## Task 24: Lib helpers — `format`, `status-labels`, `segment-colors`

**Files:**
- Create: `apps/frontend/src/pages/admin/lib/format.ts`
- Create: `apps/frontend/src/pages/admin/lib/format.test.ts`
- Create: `apps/frontend/src/pages/admin/lib/status-labels.ts`
- Create: `apps/frontend/src/pages/admin/lib/segment-colors.ts`

- [ ] **Step 1: `format.ts`**

```ts
const BRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

export function formatBRL(value: number | null | undefined): string {
  if (value == null) return '—';
  return BRL.format(value);
}

export function formatPercent(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—';
  return `${(value * 100).toFixed(1)}%`;
}

export function formatNumber(value: number | null | undefined): string {
  if (value == null) return '—';
  return new Intl.NumberFormat('pt-BR').format(value);
}

export function formatRelativeTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.round(diffMs / 60_000);
  if (diffMin < 1) return 'agora';
  if (diffMin < 60) return `há ${diffMin} min`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `há ${diffH}h`;
  const diffD = Math.round(diffH / 24);
  if (diffD < 30) return `há ${diffD}d`;
  return date.toLocaleDateString('pt-BR');
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
```

- [ ] **Step 2: `format.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import {
  formatBRL,
  formatPercent,
  formatNumber,
  initialsOf,
} from './format';

describe('format helpers', () => {
  it('formatBRL retorna — para null/undefined', () => {
    expect(formatBRL(null)).toBe('—');
    expect(formatBRL(undefined)).toBe('—');
  });

  it('formatBRL formata valores', () => {
    expect(formatBRL(1234.56)).toMatch(/R\$\s?1\.234,56/);
  });

  it('formatPercent retorna — para null e NaN', () => {
    expect(formatPercent(null)).toBe('—');
    expect(formatPercent(NaN)).toBe('—');
  });

  it('formatPercent formata 0.4 como 40.0%', () => {
    expect(formatPercent(0.4)).toBe('40.0%');
  });

  it('formatNumber retorna — para null', () => {
    expect(formatNumber(null)).toBe('—');
    expect(formatNumber(1234)).toBe('1.234');
  });

  it('initialsOf', () => {
    expect(initialsOf('Vinícius Souza')).toBe('VS');
    expect(initialsOf('Vinícius')).toBe('VI');
    expect(initialsOf('')).toBe('?');
  });
});
```

- [ ] **Step 3: `status-labels.ts`**

```ts
import { TenantStatus } from '@praktikus/shared';

// Note: TenantStatus enum vive em apps/backend/src/modules/core/tenancy/tenant.entity.ts
// e está re-exportado em @praktikus/shared (validar que existe; se não, manter local).
// Se não estiver no shared, use o tipo abaixo:
export type AdminTenantStatus = 'TRIAL' | 'ACTIVE' | 'OVERDUE' | 'SUSPENDED';

export const STATUS_LABEL: Record<AdminTenantStatus, string> = {
  ACTIVE: 'Ativo',
  TRIAL: 'Trial',
  OVERDUE: 'Em atraso',
  SUSPENDED: 'Suspenso',
};

export const STATUS_VARIANT: Record<
  AdminTenantStatus,
  'success' | 'info' | 'warning' | 'danger'
> = {
  ACTIVE: 'success',
  TRIAL: 'info',
  OVERDUE: 'warning',
  SUSPENDED: 'danger',
};

// Se @praktikus/shared não exportar TenantStatus, remover o import acima.
void TenantStatus;
```

> **Nota pro implementador:** quando rodar `tsc -b` se reclamar do import de `TenantStatus` em `@praktikus/shared`, remova o import e use só o tipo local `AdminTenantStatus`. O shared exporta `Role`, `TenantStatus`, `TenantSegment` (verificar em [`packages/shared/src/index.ts`](../../packages/shared/src/index.ts)). Se `TenantStatus` estiver disponível, prefira o enum.

- [ ] **Step 4: `segment-colors.ts`**

```ts
import { TenantSegment } from '@praktikus/shared';

export const SEGMENT_COLOR: Record<TenantSegment, string> = {
  [TenantSegment.WORKSHOP]: 'var(--adm-seg-workshop)',
  [TenantSegment.RECYCLING]: 'var(--adm-seg-recycling)',
};

export const SEGMENT_LABEL: Record<TenantSegment, string> = {
  [TenantSegment.WORKSHOP]: 'Oficina',
  [TenantSegment.RECYCLING]: 'Recicláveis',
};
```

- [ ] **Step 5: Run — verde**

Run: `pnpm --filter frontend test -- format`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/frontend/src/pages/admin/lib/
git commit -m "feat(admin-ui): add format, status-labels, segment-colors helpers"
```

---

## Task 25: Primitivos básicos — `Card`, `Badge`, `Button`, `Avatar`, `Chip`

**Files:**
- Create: `apps/frontend/src/pages/admin/components/Card.tsx`
- Create: `apps/frontend/src/pages/admin/components/Badge.tsx`
- Create: `apps/frontend/src/pages/admin/components/Button.tsx`
- Create: `apps/frontend/src/pages/admin/components/Avatar.tsx`
- Create: `apps/frontend/src/pages/admin/components/Chip.tsx`
- Create: `apps/frontend/src/pages/admin/components/primitives.test.tsx`

- [ ] **Step 1: `Card.tsx`**

```tsx
import type { ReactNode } from 'react';

interface Props {
  title?: string;
  className?: string;
  children: ReactNode;
}

export function Card({ title, className = '', children }: Props) {
  return (
    <section className={`adm-card ${className}`}>
      {title && <h3 className="adm-card__title">{title}</h3>}
      {children}
    </section>
  );
}
```

- [ ] **Step 2: `Badge.tsx`**

```tsx
import type { ReactNode } from 'react';

type Variant = 'default' | 'success' | 'warning' | 'danger' | 'info';

interface Props {
  variant?: Variant;
  children: ReactNode;
}

export function Badge({ variant = 'default', children }: Props) {
  const cls = variant === 'default' ? 'adm-badge' : `adm-badge adm-badge--${variant}`;
  return <span className={cls}>{children}</span>;
}
```

- [ ] **Step 3: `Button.tsx`**

```tsx
import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'primary';
  children: ReactNode;
}

export function Button({
  variant = 'default',
  className = '',
  children,
  ...rest
}: Props) {
  const cls = variant === 'primary' ? 'adm-btn adm-btn--primary' : 'adm-btn';
  return (
    <button className={`${cls} ${className}`} {...rest}>
      {children}
    </button>
  );
}
```

- [ ] **Step 4: `Avatar.tsx`**

```tsx
import { initialsOf } from '../lib/format';

interface Props {
  name: string;
  size?: number;
  color?: string;
}

export function Avatar({ name, size = 32, color = 'var(--adm-accent)' }: Props) {
  const inits = initialsOf(name);
  return (
    <span
      className="adm-avatar"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        background: color,
        color: 'var(--adm-accent-fg)',
        borderRadius: '50%',
        fontSize: Math.round(size * 0.42),
        fontWeight: 600,
      }}
      aria-label={name}
    >
      {inits}
    </span>
  );
}
```

- [ ] **Step 5: `Chip.tsx`**

```tsx
import type { ReactNode } from 'react';

interface Props {
  active?: boolean;
  onClick?: () => void;
  children: ReactNode;
}

export function Chip({ active = false, onClick, children }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="adm-chip"
      data-active={active ? 'true' : 'false'}
      style={{
        padding: '6px 12px',
        fontSize: 12,
        fontWeight: 500,
        borderRadius: 999,
        border: '1px solid var(--adm-border)',
        background: active ? 'var(--adm-accent-soft)' : 'var(--adm-surface)',
        color: active ? 'var(--adm-accent)' : 'var(--adm-fg-muted)',
        cursor: 'pointer',
        transition: 'all .12s ease',
      }}
    >
      {children}
    </button>
  );
}
```

- [ ] **Step 6: `primitives.test.tsx`**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Card } from './Card';
import { Badge } from './Badge';
import { Button } from './Button';
import { Avatar } from './Avatar';
import { Chip } from './Chip';

describe('admin primitives', () => {
  it('Card renderiza titulo e children', () => {
    render(<Card title="T">conteudo</Card>);
    expect(screen.getByText('T')).toBeInTheDocument();
    expect(screen.getByText('conteudo')).toBeInTheDocument();
  });

  it('Badge aplica classe da variant', () => {
    const { container } = render(<Badge variant="success">OK</Badge>);
    expect(container.querySelector('.adm-badge--success')).toBeInTheDocument();
  });

  it('Button primary tem classe modificadora', () => {
    const { container } = render(<Button variant="primary">x</Button>);
    expect(container.querySelector('.adm-btn--primary')).toBeInTheDocument();
  });

  it('Avatar renderiza iniciais do nome', () => {
    render(<Avatar name="Vinícius Souza" />);
    expect(screen.getByText('VS')).toBeInTheDocument();
  });

  it('Chip dispara onClick e marca data-active', () => {
    const fn = vi.fn();
    render(
      <Chip active onClick={fn}>
        Sel
      </Chip>,
    );
    fireEvent.click(screen.getByText('Sel'));
    expect(fn).toHaveBeenCalled();
    expect(screen.getByText('Sel')).toHaveAttribute('data-active', 'true');
  });
});
```

- [ ] **Step 7: Run — verde**

Run: `pnpm --filter frontend test -- primitives`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/frontend/src/pages/admin/components/Card.tsx \
        apps/frontend/src/pages/admin/components/Badge.tsx \
        apps/frontend/src/pages/admin/components/Button.tsx \
        apps/frontend/src/pages/admin/components/Avatar.tsx \
        apps/frontend/src/pages/admin/components/Chip.tsx \
        apps/frontend/src/pages/admin/components/primitives.test.tsx
git commit -m "feat(admin-ui): add Card, Badge, Button, Avatar, Chip primitives"
```

---

## Task 26: `Skeleton`, `EmptyState`, `HealthBar`

**Files:**
- Create: `apps/frontend/src/pages/admin/components/Skeleton.tsx`
- Create: `apps/frontend/src/pages/admin/components/EmptyState.tsx`
- Create: `apps/frontend/src/pages/admin/components/HealthBar.tsx`
- Create: `apps/frontend/src/pages/admin/components/HealthBar.test.tsx`

- [ ] **Step 1: `Skeleton.tsx`**

```tsx
interface Props {
  width?: number | string;
  height?: number | string;
}

export function Skeleton({ width = '100%', height = 16 }: Props) {
  return (
    <span
      className="adm-skeleton"
      style={{ width, height, display: 'inline-block' }}
      aria-hidden="true"
    />
  );
}
```

- [ ] **Step 2: `EmptyState.tsx`**

```tsx
import type { ReactNode } from 'react';

interface Props {
  title: string;
  message?: string;
  action?: ReactNode;
}

export function EmptyState({ title, message, action }: Props) {
  return (
    <div className="adm-empty">
      <div className="adm-empty__title">{title}</div>
      {message && <div className="adm-empty__msg">{message}</div>}
      {action && <div style={{ marginTop: 12 }}>{action}</div>}
    </div>
  );
}
```

- [ ] **Step 3: `HealthBar.tsx`**

```tsx
interface Props {
  /** 0..100 ou null — null mostra "sem dado" */
  score: number | null | undefined;
}

function colorFor(s: number): string {
  if (s >= 80) return 'var(--adm-success)';
  if (s >= 50) return 'var(--adm-warning)';
  return 'var(--adm-danger)';
}

export function HealthBar({ score }: Props) {
  if (score == null) {
    return (
      <div
        className="adm-healthbar adm-healthbar--null"
        title="Disponível na Fase 1.5"
      >
        <div
          style={{
            width: '100%',
            height: 6,
            background: 'var(--adm-bg-muted)',
            borderRadius: 3,
          }}
        />
        <small
          style={{
            display: 'block',
            color: 'var(--adm-fg-subtle)',
            fontSize: 10,
            marginTop: 2,
          }}
        >
          Sem dado
        </small>
      </div>
    );
  }
  const clamped = Math.max(0, Math.min(100, score));
  return (
    <div className="adm-healthbar" title={`Score ${clamped}/100`}>
      <div
        style={{
          width: '100%',
          height: 6,
          background: 'var(--adm-bg-muted)',
          borderRadius: 3,
        }}
      >
        <div
          style={{
            width: `${clamped}%`,
            height: '100%',
            background: colorFor(clamped),
            borderRadius: 3,
            transition: 'width .2s ease',
          }}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: `HealthBar.test.tsx`**

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HealthBar } from './HealthBar';

describe('HealthBar', () => {
  it('mostra "Sem dado" quando score=null', () => {
    render(<HealthBar score={null} />);
    expect(screen.getByText('Sem dado')).toBeInTheDocument();
  });

  it('mostra "Sem dado" quando score=undefined', () => {
    render(<HealthBar score={undefined} />);
    expect(screen.getByText('Sem dado')).toBeInTheDocument();
  });

  it('renderiza barra com score=85 (não mostra "Sem dado")', () => {
    render(<HealthBar score={85} />);
    expect(screen.queryByText('Sem dado')).not.toBeInTheDocument();
  });

  it('clampa scores fora do range', () => {
    const { container } = render(<HealthBar score={150} />);
    const inner = container.querySelector(
      '.adm-healthbar > div > div',
    ) as HTMLElement;
    expect(inner.style.width).toBe('100%');
  });
});
```

- [ ] **Step 5: Run — verde**

Run: `pnpm --filter frontend test -- HealthBar`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/frontend/src/pages/admin/components/Skeleton.tsx \
        apps/frontend/src/pages/admin/components/EmptyState.tsx \
        apps/frontend/src/pages/admin/components/HealthBar.tsx \
        apps/frontend/src/pages/admin/components/HealthBar.test.tsx
git commit -m "feat(admin-ui): add Skeleton, EmptyState, HealthBar"
```

---

## Task 27: `SparklineSvg` + `KpiCard`

**Files:**
- Create: `apps/frontend/src/pages/admin/components/charts/SparklineSvg.tsx`
- Create: `apps/frontend/src/pages/admin/components/KpiCard.tsx`
- Create: `apps/frontend/src/pages/admin/components/KpiCard.test.tsx`

- [ ] **Step 1: `SparklineSvg.tsx`**

```tsx
interface Props {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
}

export function SparklineSvg({
  data,
  width = 80,
  height = 32,
  color = 'var(--adm-accent)',
}: Props) {
  if (data.length === 0) {
    return <svg width={width} height={height} aria-hidden="true" />;
  }
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const stepX = data.length > 1 ? width / (data.length - 1) : width;
  const points = data
    .map((v, i) => {
      const x = i * stepX;
      const y = height - ((v - min) / range) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <svg width={width} height={height} aria-hidden="true">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        points={points}
      />
    </svg>
  );
}
```

- [ ] **Step 2: `KpiCard.tsx`**

```tsx
import type { ReactNode } from 'react';
import { Skeleton } from './Skeleton';
import { SparklineSvg } from './charts/SparklineSvg';

interface Props {
  label: string;
  value: number | string | null;
  formatValue?: (v: number | string) => string;
  delta?: number | null;
  sparkline?: number[];
  icon?: ReactNode;
  /** Tooltip mostrado quando value=null */
  nullHint?: string;
}

export function KpiCard({
  label,
  value,
  formatValue,
  delta,
  sparkline,
  icon,
  nullHint = 'Disponível na Fase 1.5',
}: Props) {
  const isNull = value == null;
  const display = isNull
    ? '—'
    : formatValue
      ? formatValue(value as number | string)
      : String(value);

  return (
    <div
      className="adm-kpi adm-card"
      title={isNull ? nullHint : undefined}
      style={{ position: 'relative', minHeight: 88 }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          color: 'var(--adm-fg-muted)',
          fontSize: 11,
          textTransform: 'uppercase',
          letterSpacing: 0.04,
          fontWeight: 600,
          marginBottom: 8,
        }}
      >
        {icon}
        {label}
      </div>
      <div
        style={{
          fontSize: 26,
          fontWeight: 700,
          fontVariantNumeric: 'tabular-nums',
          color: isNull ? 'var(--adm-fg-subtle)' : 'var(--adm-fg)',
        }}
      >
        {display}
      </div>
      {!isNull && delta != null && (
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: delta >= 0 ? 'var(--adm-success)' : 'var(--adm-danger)',
          }}
        >
          {delta >= 0 ? '+' : ''}
          {delta}%
        </div>
      )}
      <div
        style={{ position: 'absolute', right: 16, bottom: 16 }}
        aria-hidden="true"
      >
        {isNull ? (
          <Skeleton width={80} height={32} />
        ) : sparkline && sparkline.length > 0 ? (
          <SparklineSvg data={sparkline} />
        ) : null}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Tests**

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { KpiCard } from './KpiCard';

describe('KpiCard', () => {
  it('mostra "—" e oculta sparkline quando value=null', () => {
    const { container } = render(
      <KpiCard label="MRR" value={null} sparkline={[1, 2, 3]} />,
    );
    expect(screen.getByText('—')).toBeInTheDocument();
    // SparklineSvg não renderiza polyline; em vez disso tem skeleton
    expect(container.querySelector('polyline')).not.toBeInTheDocument();
    expect(container.querySelector('.adm-skeleton')).toBeInTheDocument();
  });

  it('renderiza valor formatado e sparkline quando value não é null', () => {
    const { container } = render(
      <KpiCard
        label="MRR"
        value={1234.5}
        formatValue={(v) => `R$ ${(v as number).toFixed(2)}`}
        sparkline={[1, 2, 3, 4]}
      />,
    );
    expect(screen.getByText('R$ 1234.50')).toBeInTheDocument();
    expect(container.querySelector('polyline')).toBeInTheDocument();
  });

  it('mostra delta com cor success se positivo', () => {
    const { container } = render(
      <KpiCard label="x" value={10} delta={5} />,
    );
    const deltaEl = container.querySelector(
      'div[style*="success"]',
    ) as HTMLElement;
    expect(deltaEl?.textContent).toMatch(/\+5/);
  });
});
```

- [ ] **Step 4: Run — verde**

Run: `pnpm --filter frontend test -- KpiCard`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/pages/admin/components/charts/SparklineSvg.tsx \
        apps/frontend/src/pages/admin/components/KpiCard.tsx \
        apps/frontend/src/pages/admin/components/KpiCard.test.tsx
git commit -m "feat(admin-ui): add KpiCard with sparkline and null-value handling"
```

---

## Task 28: `FilterBar` + `DataTable`

**Files:**
- Create: `apps/frontend/src/pages/admin/components/FilterBar.tsx`
- Create: `apps/frontend/src/pages/admin/components/FilterBar.test.tsx`
- Create: `apps/frontend/src/pages/admin/components/DataTable.tsx`

- [ ] **Step 1: `FilterBar.tsx` — wrapper genérico**

```tsx
import type { ReactNode } from 'react';

interface Props {
  search?: ReactNode;
  chips?: ReactNode;
  actions?: ReactNode;
}

export function FilterBar({ search, chips, actions }: Props) {
  return (
    <div
      className="adm-filterbar"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flexWrap: 'wrap',
        padding: '12px 16px',
        background: 'var(--adm-surface)',
        border: '1px solid var(--adm-border)',
        borderRadius: 'var(--adm-radius-md)',
      }}
    >
      {search && <div style={{ flex: '1 1 240px' }}>{search}</div>}
      {chips && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{chips}</div>
      )}
      {actions && <div style={{ marginLeft: 'auto' }}>{actions}</div>}
    </div>
  );
}
```

- [ ] **Step 2: `DataTable.tsx`**

```tsx
import type { ReactNode } from 'react';
import { Skeleton } from './Skeleton';
import { EmptyState } from './EmptyState';

interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  width?: string | number;
}

interface Props<T> {
  columns: Column<T>[];
  data: T[];
  isLoading?: boolean;
  emptyTitle?: string;
  emptyMessage?: string;
  emptyAction?: ReactNode;
}

export function DataTable<T extends { id: string }>({
  columns,
  data,
  isLoading,
  emptyTitle = 'Nenhum resultado',
  emptyMessage,
  emptyAction,
}: Props<T>) {
  if (isLoading) {
    return (
      <div style={{ padding: 16 }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} style={{ marginBottom: 8 }}>
            <Skeleton height={36} />
          </div>
        ))}
      </div>
    );
  }
  if (data.length === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        message={emptyMessage}
        action={emptyAction}
      />
    );
  }
  return (
    <table
      className="adm-table"
      style={{ width: '100%', borderCollapse: 'collapse' }}
    >
      <thead>
        <tr>
          {columns.map((c) => (
            <th
              key={c.key}
              style={{
                textAlign: 'left',
                padding: '10px 12px',
                fontSize: 11,
                fontWeight: 600,
                textTransform: 'uppercase',
                color: 'var(--adm-fg-muted)',
                borderBottom: '1px solid var(--adm-border)',
                width: c.width,
              }}
            >
              {c.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((row) => (
          <tr
            key={row.id}
            style={{ borderBottom: '1px solid var(--adm-border)' }}
          >
            {columns.map((c) => (
              <td
                key={c.key}
                style={{ padding: '10px 12px', fontSize: 13 }}
              >
                {c.render(row)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

- [ ] **Step 3: `FilterBar.test.tsx`**

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FilterBar } from './FilterBar';

describe('FilterBar', () => {
  it('renderiza search, chips e actions slots', () => {
    render(
      <FilterBar
        search={<input placeholder="busca" />}
        chips={<button>chip</button>}
        actions={<button>action</button>}
      />,
    );
    expect(screen.getByPlaceholderText('busca')).toBeInTheDocument();
    expect(screen.getByText('chip')).toBeInTheDocument();
    expect(screen.getByText('action')).toBeInTheDocument();
  });
});
```

- [ ] **Step 4: Run — verde**

Run: `pnpm --filter frontend test -- FilterBar`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/pages/admin/components/FilterBar.tsx \
        apps/frontend/src/pages/admin/components/FilterBar.test.tsx \
        apps/frontend/src/pages/admin/components/DataTable.tsx
git commit -m "feat(admin-ui): add FilterBar and generic DataTable"
```

---

## Task 29: Charts — `DonutChart` + `StackedBar` (Chart.js)

**Files:**
- Create: `apps/frontend/src/pages/admin/components/charts/DonutChart.tsx`
- Create: `apps/frontend/src/pages/admin/components/charts/StackedBar.tsx`

Razão de não testar visualmente: Chart.js usa canvas e não é trivialmente testável em jsdom. Smoke tests via Playwright ficam pra Fase 2.

- [ ] **Step 1: `DonutChart.tsx`**

```tsx
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { Doughnut } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip, Legend);

interface Slice {
  label: string;
  value: number;
  color: string;
}

interface Props {
  data: Slice[];
  size?: number;
}

export function DonutChart({ data, size = 160 }: Props) {
  return (
    <div style={{ width: size, height: size }}>
      <Doughnut
        data={{
          labels: data.map((d) => d.label),
          datasets: [
            {
              data: data.map((d) => d.value),
              backgroundColor: data.map((d) => d.color),
              borderWidth: 0,
            },
          ],
        }}
        options={{
          cutout: '70%',
          plugins: {
            legend: { display: false },
            tooltip: { enabled: true },
          },
          maintainAspectRatio: false,
        }}
      />
    </div>
  );
}
```

- [ ] **Step 2: `StackedBar.tsx` (100% horizontal, simples)**

```tsx
interface Segment {
  label: string;
  value: number;
  color: string;
}

interface Props {
  segments: Segment[];
  height?: number;
}

export function StackedBar({ segments, height = 14 }: Props) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  if (total === 0) {
    return (
      <div
        style={{
          height,
          background: 'var(--adm-bg-muted)',
          borderRadius: height / 2,
        }}
      />
    );
  }
  return (
    <div
      style={{
        display: 'flex',
        height,
        borderRadius: height / 2,
        overflow: 'hidden',
        background: 'var(--adm-bg-muted)',
      }}
    >
      {segments.map((s, i) => (
        <div
          key={i}
          title={`${s.label}: ${s.value} (${((s.value / total) * 100).toFixed(0)}%)`}
          style={{
            flex: s.value,
            background: s.color,
          }}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/pages/admin/components/charts/DonutChart.tsx \
        apps/frontend/src/pages/admin/components/charts/StackedBar.tsx
git commit -m "feat(admin-ui): add DonutChart and StackedBar wrappers"
```

---

## Task 30: `BrazilTilemap` (cartograma SVG)

**Files:**
- Create: `apps/frontend/src/pages/admin/components/charts/BrazilTilemap.tsx`

Porta direta do mock (`_design-reference/.../admin.jsx` linhas 441-509). Sem testes — visual.

- [ ] **Step 1: Implementar componente**

```tsx
import { useState } from 'react';

interface UfDatum {
  uf: string;
  count: number;
}

interface Props {
  data: UfDatum[];
}

const UF_COORDS: Record<
  string,
  { c: number; r: number; name: string; mini?: boolean }
> = {
  RR: { c: 2, r: 0, name: 'Roraima' },
  AP: { c: 4, r: 0, name: 'Amapá' },
  AM: { c: 1, r: 1, name: 'Amazonas' },
  PA: { c: 3, r: 1, name: 'Pará' },
  AC: { c: 0, r: 2, name: 'Acre' },
  RO: { c: 1, r: 2, name: 'Rondônia' },
  MA: { c: 4, r: 1, name: 'Maranhão' },
  CE: { c: 5, r: 1, name: 'Ceará' },
  RN: { c: 6, r: 1, name: 'Rio G. Norte' },
  PI: { c: 4, r: 2, name: 'Piauí' },
  PB: { c: 6, r: 2, name: 'Paraíba' },
  PE: { c: 5, r: 2, name: 'Pernambuco' },
  AL: { c: 6, r: 3, name: 'Alagoas' },
  SE: { c: 5, r: 3, name: 'Sergipe' },
  BA: { c: 4, r: 3, name: 'Bahia' },
  MT: { c: 2, r: 2, name: 'Mato Grosso' },
  TO: { c: 3, r: 2, name: 'Tocantins' },
  GO: { c: 3, r: 3, name: 'Goiás' },
  DF: { c: 4, r: 3.0, name: 'Distrito Federal', mini: true },
  MS: { c: 2, r: 3, name: 'Mato G. do Sul' },
  MG: { c: 3, r: 4, name: 'Minas Gerais' },
  ES: { c: 4, r: 4, name: 'Espírito Santo' },
  SP: { c: 2, r: 4, name: 'São Paulo' },
  RJ: { c: 3, r: 5, name: 'Rio de Janeiro' },
  PR: { c: 2, r: 5, name: 'Paraná' },
  SC: { c: 2, r: 6, name: 'Santa Catarina' },
  RS: { c: 1, r: 7, name: 'Rio G. do Sul' },
};

const TILE = 64;
const GAP = 6;

function colorFor(ratio: number): string {
  if (ratio === 0) return 'var(--adm-bg-subtle)';
  if (ratio <= 0.1) return 'var(--brand-100)';
  if (ratio <= 0.33) return 'var(--brand-300)';
  if (ratio <= 0.66) return 'var(--brand-500)';
  return 'var(--brand-700)';
}

export function BrazilTilemap({ data }: Props) {
  const [hover, setHover] = useState<string | null>(null);
  const counts: Record<string, number> = {};
  Object.keys(UF_COORDS).forEach((uf) => (counts[uf] = 0));
  data.forEach((d) => {
    if (counts[d.uf] !== undefined) counts[d.uf] = d.count;
  });

  const max = Math.max(...Object.values(counts), 1);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  const cols = 7;
  const rows = 8;
  const width = cols * TILE + (cols - 1) * GAP;
  const height = rows * TILE + (rows - 1) * GAP;

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Distribuição de clientes por UF"
      >
        {Object.entries(UF_COORDS).map(([uf, pos]) => {
          const x = pos.c * (TILE + GAP);
          const y = pos.r * (TILE + GAP);
          const ratio = counts[uf] / max;
          const fill = colorFor(ratio);
          const isMini = pos.mini;
          const w = isMini ? 22 : TILE;
          const h = isMini ? 22 : TILE;
          const offset = isMini ? TILE - 22 - 2 : 0;
          return (
            <g
              key={uf}
              onMouseEnter={() => setHover(uf)}
              onMouseLeave={() => setHover(null)}
              style={{ cursor: 'pointer' }}
            >
              <rect
                x={x + offset}
                y={y + offset}
                width={w}
                height={h}
                rx={6}
                fill={fill}
                stroke={hover === uf ? 'var(--adm-accent)' : 'var(--adm-border)'}
                strokeWidth={hover === uf ? 2 : 1}
              />
              <text
                x={x + offset + w / 2}
                y={y + offset + h / 2}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={isMini ? 9 : 11}
                fontWeight={600}
                fill={ratio > 0.5 ? '#fff' : 'var(--adm-fg)'}
              >
                {uf}
              </text>
            </g>
          );
        })}
      </svg>
      {hover && (
        <div
          style={{
            position: 'absolute',
            top: 8,
            left: 8,
            background: 'var(--adm-surface)',
            border: '1px solid var(--adm-border)',
            borderRadius: 8,
            padding: '8px 12px',
            fontSize: 12,
            boxShadow: 'var(--adm-shadow-md)',
            pointerEvents: 'none',
          }}
        >
          <div style={{ fontWeight: 600 }}>
            {hover} — {UF_COORDS[hover].name}
          </div>
          <div style={{ color: 'var(--adm-fg-muted)' }}>
            {counts[hover]} cliente(s){' '}
            {total > 0 && (
              <>· {((counts[hover] / total) * 100).toFixed(1)}% da base</>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/frontend/src/pages/admin/components/charts/BrazilTilemap.tsx
git commit -m "feat(admin-ui): add BrazilTilemap cartogram for tenant UF distribution"
```

---

## Task 31: Layout shell — `AdminSidebar`, `AdminTopbar`, `AdminLayout`

**Files:**
- Create: `apps/frontend/src/pages/admin/_layout/AdminSidebar.tsx`
- Create: `apps/frontend/src/pages/admin/_layout/AdminTopbar.tsx`
- Create: `apps/frontend/src/pages/admin/_layout/AdminLayout.tsx`

- [ ] **Step 1: `AdminSidebar.tsx`**

```tsx
import { NavLink } from 'react-router-dom';
import { Avatar } from '../components/Avatar';
import { Badge } from '../components/Badge';
import { usePlatformAuthStore } from '../../../store/platform-auth.store';

const NAV = [
  { to: '/admin', label: 'Visão geral', exact: true },
  { to: '/admin/clientes', label: 'Clientes' },
  { to: '/admin/segmentos', label: 'Segmentos' },
  { to: '/admin/whatsapp', label: 'WhatsApp' },
  { to: '/admin/financeiro', label: 'Financeiro' },
];

const COMING = [
  { label: 'Suporte' },
  { label: 'Configurações' },
];

export function AdminSidebar() {
  const user = usePlatformAuthStore((s) => s.user);
  const logout = usePlatformAuthStore((s) => s.logout);

  return (
    <aside
      style={{
        background: 'var(--brand-950)',
        color: '#DCE6E6',
        height: '100vh',
        position: 'sticky',
        top: 0,
        display: 'flex',
        flexDirection: 'column',
        padding: '20px 12px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '0 8px 16px',
          borderBottom: '1px solid #1F3536',
          marginBottom: 12,
        }}
      >
        <strong style={{ fontSize: 16, color: '#fff' }}>Praktikus</strong>
        <Badge variant="info">Admin</Badge>
      </div>

      <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.exact}
            style={({ isActive }) => ({
              padding: '10px 12px',
              borderRadius: 8,
              color: isActive ? '#fff' : '#86AEB0',
              background: isActive ? '#122020' : 'transparent',
              border: isActive ? '1px solid #1F3536' : '1px solid transparent',
              fontSize: 13,
              fontWeight: isActive ? 600 : 500,
              textDecoration: 'none',
              transition: 'all .12s ease',
            })}
          >
            {item.label}
          </NavLink>
        ))}

        <div style={{ height: 12 }} />

        {COMING.map((item) => (
          <div
            key={item.label}
            style={{
              padding: '10px 12px',
              borderRadius: 8,
              color: '#4E5757',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'not-allowed',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
            title="Em breve"
          >
            <span>{item.label}</span>
            <span
              style={{
                fontSize: 9,
                fontWeight: 600,
                textTransform: 'uppercase',
                color: '#558D8F',
              }}
            >
              Em breve
            </span>
          </div>
        ))}
      </nav>

      <div
        style={{
          paddingTop: 16,
          borderTop: '1px solid #1F3536',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <Avatar name={user?.name ?? '?'} size={32} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: '#fff',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {user?.name ?? '—'}
          </div>
          <div style={{ fontSize: 10, color: '#86AEB0' }}>
            Platform Owner
          </div>
        </div>
        <button
          onClick={() => {
            void logout().then(() => {
              window.location.href = '/admin/login';
            });
          }}
          style={{
            background: 'transparent',
            border: '1px solid #1F3536',
            color: '#86AEB0',
            padding: '4px 8px',
            fontSize: 11,
            borderRadius: 6,
            cursor: 'pointer',
          }}
        >
          Sair
        </button>
      </div>
    </aside>
  );
}
```

- [ ] **Step 2: `AdminTopbar.tsx`**

```tsx
import { useEffect, useState } from 'react';

const THEME_KEY = 'pk_admin_theme';

interface Props {
  title: string;
}

export function AdminTopbar({ title }: Props) {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem(THEME_KEY) as 'light' | 'dark') ?? 'light';
  });

  useEffect(() => {
    const root = document.querySelector('.adm-root');
    if (root) root.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  return (
    <div className="adm-topbar">
      <div>
        <div style={{ fontSize: 16, fontWeight: 600 }}>{title}</div>
        <div style={{ fontSize: 11, color: 'var(--adm-fg-muted)' }}>
          Praktikus · Console do administrador
        </div>
      </div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <button
          onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
          aria-label="Alternar tema"
          style={{
            background: 'transparent',
            border: '1px solid var(--adm-border)',
            borderRadius: 8,
            padding: '6px 10px',
            fontSize: 12,
            cursor: 'pointer',
            color: 'var(--adm-fg-muted)',
          }}
        >
          {theme === 'light' ? '🌙 Dark' : '☀️ Light'}
        </button>
      </div>
    </div>
  );
}
```

> **Nota:** o uso de emoji acima é puramente para exemplo de afetação visual; substitua por SVG inline ou ícone CoreUI ao implementar (regra do projeto: sem emojis em código a menos que solicitado).

Substitua os emojis:

```tsx
{theme === 'light' ? 'Dark' : 'Light'}
```

- [ ] **Step 3: `AdminLayout.tsx`**

```tsx
import { Outlet, useLocation } from 'react-router-dom';
import { AdminSidebar } from './AdminSidebar';
import { AdminTopbar } from './AdminTopbar';
import '../styles/admin-tokens.css';
import '../styles/admin-components.css';

const TITLES: Record<string, string> = {
  '/admin': 'Visão geral',
  '/admin/clientes': 'Clientes',
  '/admin/segmentos': 'Segmentos',
  '/admin/whatsapp': 'WhatsApp',
  '/admin/financeiro': 'Financeiro',
};

export function AdminLayout() {
  const loc = useLocation();
  const title = TITLES[loc.pathname] ?? 'Admin';
  return (
    <div className="adm-root adm-shell">
      <AdminSidebar />
      <div className="adm-shell__main">
        <AdminTopbar title={title} />
        <main className="adm-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/pages/admin/_layout/
git commit -m "feat(admin-ui): add admin layout shell (sidebar, topbar, layout)"
```

---

## Task 32: Hooks de fetch — `useAdminOverview`, `useAdminTenants`, etc

**Files:**
- Create: `apps/frontend/src/pages/admin/hooks/useAdminOverview.ts`
- Create: `apps/frontend/src/pages/admin/hooks/useAdminTenants.ts`
- Create: `apps/frontend/src/pages/admin/hooks/useAdminSegments.ts`
- Create: `apps/frontend/src/pages/admin/hooks/useAdminWhatsapp.ts`
- Create: `apps/frontend/src/pages/admin/hooks/useAdminFinancial.ts`
- Create: `apps/frontend/src/pages/admin/hooks/useAdminTenants.test.ts`

Padrão único pra todos os hooks: `useState<T | null>(null)` + `useEffect` que chama `adminApi.get(path)` e gerencia `loading`/`error`. Sem TanStack Query (não está no projeto).

- [ ] **Step 1: `useAdminOverview.ts`**

```ts
import { useEffect, useState } from 'react';
import { adminApi } from '../../../services/admin.api';

export interface OverviewData {
  kpis: {
    activeTenants: { value: number; deltaVsLastMonth: number | null; sparkline: number[] };
    trialTenants: { value: number; deltaVsLastMonth: number | null; sparkline: number[] };
    whatsappTenants: { value: number; deltaVsLastMonth: number | null; sparkline: number[] };
    mrr: { value: null };
  };
  statusDistribution: Array<{ status: string; count: number }>;
  segmentDistribution: Array<{ segment: string; count: number }>;
  ufDistribution: Array<{ uf: string; count: number }>;
  trialsExpiring: Array<{
    tenantId: string;
    nomeFantasia: string;
    segment: string;
    trialEndsAt: string;
    daysLeft: number;
  }>;
}

export function useAdminOverview() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    adminApi
      .get<OverviewData>('/admin/overview')
      .then((res) => {
        if (!cancelled) setData(res.data);
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message ?? 'Erro');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadTick]);

  return { data, loading, error, reload: () => setReloadTick((t) => t + 1) };
}
```

- [ ] **Step 2: `useAdminTenants.ts` (com filtros + debounced search)**

```ts
import { useEffect, useMemo, useState } from 'react';
import { useDebounce } from 'use-debounce';
import { adminApi } from '../../../services/admin.api';

export type TenantStatusKey = 'ACTIVE' | 'TRIAL' | 'OVERDUE' | 'SUSPENDED';

export interface TenantFilters {
  status?: TenantStatusKey | 'all';
  segment?: 'WORKSHOP' | 'RECYCLING' | 'all';
  wpp?: 'yes' | 'no' | 'all';
  q?: string;
  page?: number;
  pageSize?: number;
}

export interface TenantRow {
  id: string;
  nomeFantasia: string;
  razaoSocial: string;
  cnpj: string;
  segment: 'WORKSHOP' | 'RECYCLING';
  status: TenantStatusKey;
  city: string | null;
  state: string | null;
  whatsappEnabled: boolean;
  whatsappPlan: string | null;
  planName: null;
  mrr: null;
  healthScore: null;
  lastSeenAt: null;
  trialEndsAt: string | null;
  trialDaysLeft: number | null;
  createdAt: string;
}

export interface TenantsData {
  data: TenantRow[];
  total: number;
  page: number;
  pageSize: number;
  countersByStatus: Record<TenantStatusKey, number>;
}

export function useAdminTenants(filters: TenantFilters) {
  const [data, setData] = useState<TenantsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [debouncedQ] = useDebounce(filters.q ?? '', 300);

  const params = useMemo(() => {
    const p: Record<string, string | number> = {
      page: filters.page ?? 1,
      pageSize: filters.pageSize ?? 25,
    };
    if (filters.status && filters.status !== 'all') p.status = filters.status;
    if (filters.segment && filters.segment !== 'all') p.segment = filters.segment;
    if (filters.wpp && filters.wpp !== 'all') p.wpp = filters.wpp;
    if (debouncedQ.trim()) p.q = debouncedQ.trim();
    return p;
  }, [
    filters.status,
    filters.segment,
    filters.wpp,
    debouncedQ,
    filters.page,
    filters.pageSize,
  ]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    adminApi
      .get<TenantsData>('/admin/tenants', { params })
      .then((res) => {
        if (!cancelled) setData(res.data);
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message ?? 'Erro');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [params]);

  return { data, loading, error };
}
```

- [ ] **Step 3: `useAdminSegments.ts` / `useAdminWhatsapp.ts` / `useAdminFinancial.ts`**

Cada um segue o mesmo padrão de `useAdminOverview`. Tipos e endpoint diferentes:

```ts
// useAdminSegments.ts
import { useEffect, useState } from 'react';
import { adminApi } from '../../../services/admin.api';

export interface SegmentsData {
  totalTenants: number;
  segments: Array<{
    segment: 'WORKSHOP' | 'RECYCLING';
    total: number;
    byStatus: Record<string, number>;
    whatsappCount: number;
    newLast30Days: number;
    mrr: null;
  }>;
}

export function useAdminSegments() {
  const [data, setData] = useState<SegmentsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    adminApi
      .get<SegmentsData>('/admin/segments')
      .then((res) => !cancelled && setData(res.data))
      .catch((err) => !cancelled && setError(err?.message ?? 'Erro'))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, []);
  return { data, loading, error };
}
```

```ts
// useAdminWhatsapp.ts
import { useEffect, useState } from 'react';
import { adminApi } from '../../../services/admin.api';

export interface WhatsappData {
  kpis: {
    adoptionRate: number;
    starterCount: number;
    proCount: number;
    enterpriseCount: number;
    addOnMrr: null;
  };
  using: Array<any>;
  notUsing: Array<any>;
  adoptionBySegment: Array<{
    segment: 'WORKSHOP' | 'RECYCLING';
    rate: number;
    using: number;
    eligible: number;
  }>;
}

export function useAdminWhatsapp() {
  const [data, setData] = useState<WhatsappData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    adminApi
      .get<WhatsappData>('/admin/whatsapp')
      .then((res) => !cancelled && setData(res.data))
      .catch((err) => !cancelled && setError(err?.message ?? 'Erro'))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, []);
  return { data, loading, error };
}
```

```ts
// useAdminFinancial.ts
import { useEffect, useState } from 'react';
import { adminApi } from '../../../services/admin.api';

export interface FinancialData {
  kpis: {
    mrr: null;
    arr: null;
    averageTicket: null;
    churn30d: null;
  };
  basicDistribution: {
    active: number;
    overdue: number;
    suspended: number;
    suspendedLast30Days: number;
  };
  recentCharges: [];
}

export function useAdminFinancial() {
  const [data, setData] = useState<FinancialData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    adminApi
      .get<FinancialData>('/admin/financial')
      .then((res) => !cancelled && setData(res.data))
      .catch((err) => !cancelled && setError(err?.message ?? 'Erro'))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, []);
  return { data, loading, error };
}
```

- [ ] **Step 4: Test pra `useAdminTenants` (filtros + debounce)**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useAdminTenants } from './useAdminTenants';

vi.mock('../../../services/admin.api', () => ({
  adminApi: { get: vi.fn() },
}));

import { adminApi } from '../../../services/admin.api';
const mockGet = (adminApi as any).get as ReturnType<typeof vi.fn>;

describe('useAdminTenants', () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockGet.mockResolvedValue({
      data: {
        data: [],
        total: 0,
        page: 1,
        pageSize: 25,
        countersByStatus: { ACTIVE: 0, TRIAL: 0, OVERDUE: 0, SUSPENDED: 0 },
      },
    });
  });

  it('aplica status, segment, wpp como params', async () => {
    renderHook(() =>
      useAdminTenants({
        status: 'ACTIVE',
        segment: 'WORKSHOP',
        wpp: 'yes',
        page: 1,
        pageSize: 25,
      }),
    );
    await waitFor(() => expect(mockGet).toHaveBeenCalled());
    const call = mockGet.mock.calls[0];
    expect(call[0]).toBe('/admin/tenants');
    expect(call[1].params.status).toBe('ACTIVE');
    expect(call[1].params.segment).toBe('WORKSHOP');
    expect(call[1].params.wpp).toBe('yes');
  });

  it('omite filtros quando "all"', async () => {
    renderHook(() =>
      useAdminTenants({
        status: 'all',
        segment: 'all',
        wpp: 'all',
      }),
    );
    await waitFor(() => expect(mockGet).toHaveBeenCalled());
    const params = mockGet.mock.calls[0][1].params;
    expect(params.status).toBeUndefined();
    expect(params.segment).toBeUndefined();
    expect(params.wpp).toBeUndefined();
  });
});
```

- [ ] **Step 5: Run — verde**

Run: `pnpm --filter frontend test -- useAdminTenants`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/frontend/src/pages/admin/hooks/
git commit -m "feat(admin-ui): add fetch hooks for overview, tenants, segments, whatsapp, financial"
```

---

## Task 33: `LoginPage`

**Files:**
- Create: `apps/frontend/src/pages/admin/pages/LoginPage.tsx`
- Create: `apps/frontend/src/pages/admin/pages/LoginPage.test.tsx`

- [ ] **Step 1: Implementar página**

```tsx
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { adminAuthService } from '../../../services/admin-auth.service';
import { usePlatformAuthStore } from '../../../store/platform-auth.store';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import '../styles/admin-tokens.css';
import '../styles/admin-components.css';

const schema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(6, 'Senha muito curta'),
});

type Form = z.infer<typeof schema>;

export function LoginPage() {
  const setTokens = usePlatformAuthStore((s) => s.setTokens);
  const navigate = useNavigate();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Form>({ resolver: zodResolver(schema) });

  async function onSubmit(values: Form) {
    setSubmitError(null);
    try {
      const tokens = await adminAuthService.login(values);
      setTokens(tokens);
      const last = localStorage.getItem('pk_admin_page');
      navigate(last && last.startsWith('/admin') ? last : '/admin', {
        replace: true,
      });
    } catch (err: any) {
      setSubmitError(
        err?.response?.status === 401
          ? 'E-mail ou senha incorretos.'
          : 'Falha ao entrar. Tente novamente.',
      );
    }
  }

  return (
    <div
      className="adm-root"
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--adm-bg-subtle)',
        padding: 16,
      }}
    >
      <div style={{ width: '100%', maxWidth: 400 }}>
        <Card>
          <h1 style={{ fontSize: 18, marginTop: 0, marginBottom: 4 }}>
            Praktikus Admin
          </h1>
          <p
            style={{
              fontSize: 12,
              color: 'var(--adm-fg-muted)',
              marginTop: 0,
              marginBottom: 16,
            }}
          >
            Console do administrador
          </p>
          <form
            onSubmit={handleSubmit(onSubmit)}
            style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
          >
            <label style={{ fontSize: 12, fontWeight: 600 }}>
              E-mail
              <input
                type="email"
                autoComplete="username"
                {...register('email')}
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid var(--adm-border)',
                  borderRadius: 6,
                  fontSize: 13,
                  marginTop: 4,
                }}
              />
              {errors.email && (
                <small style={{ color: 'var(--adm-danger)' }}>
                  {errors.email.message}
                </small>
              )}
            </label>
            <label style={{ fontSize: 12, fontWeight: 600 }}>
              Senha
              <input
                type="password"
                autoComplete="current-password"
                {...register('password')}
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid var(--adm-border)',
                  borderRadius: 6,
                  fontSize: 13,
                  marginTop: 4,
                }}
              />
              {errors.password && (
                <small style={{ color: 'var(--adm-danger)' }}>
                  {errors.password.message}
                </small>
              )}
            </label>
            {submitError && (
              <div
                role="alert"
                style={{
                  fontSize: 12,
                  color: 'var(--adm-danger)',
                  background: 'var(--adm-danger-bg)',
                  padding: 8,
                  borderRadius: 6,
                }}
              >
                {submitError}
              </div>
            )}
            <Button type="submit" variant="primary" disabled={isSubmitting}>
              {isSubmitting ? 'Entrando…' : 'Entrar'}
            </Button>
            <button
              type="button"
              disabled
              title="Em breve"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--adm-fg-subtle)',
                fontSize: 12,
                cursor: 'not-allowed',
              }}
            >
              Esqueci a senha
            </button>
          </form>
        </Card>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Test (smoke)**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LoginPage } from './LoginPage';

vi.mock('../../../store/platform-auth.store', () => ({
  usePlatformAuthStore: vi.fn().mockImplementation((s: any) =>
    s({ setTokens: vi.fn() }),
  ),
}));

describe('LoginPage', () => {
  it('renderiza form de login', () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );
    expect(screen.getByText('Praktikus Admin')).toBeInTheDocument();
    expect(screen.getByLabelText(/E-mail/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Senha/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /entrar/i })).toBeInTheDocument();
  });

  it('botão "Esqueci a senha" está disabled em Fase 1', () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );
    const btn = screen.getByText(/Esqueci a senha/i);
    expect(btn).toBeDisabled();
  });
});
```

- [ ] **Step 3: Run — verde**

Run: `pnpm --filter frontend test -- LoginPage`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/pages/admin/pages/LoginPage.tsx \
        apps/frontend/src/pages/admin/pages/LoginPage.test.tsx
git commit -m "feat(admin-ui): add LoginPage with react-hook-form + zod"
```

---

## Task 34: `OverviewPage` (Dashboard)

**Files:**
- Create: `apps/frontend/src/pages/admin/pages/OverviewPage.tsx`

- [ ] **Step 1: Implementar página**

```tsx
import { useAdminOverview } from '../hooks/useAdminOverview';
import { Card } from '../components/Card';
import { KpiCard } from '../components/KpiCard';
import { DonutChart } from '../components/charts/DonutChart';
import { StackedBar } from '../components/charts/StackedBar';
import { BrazilTilemap } from '../components/charts/BrazilTilemap';
import { Skeleton } from '../components/Skeleton';
import { EmptyState } from '../components/EmptyState';
import { Badge } from '../components/Badge';
import { formatNumber } from '../lib/format';
import {
  STATUS_LABEL,
  STATUS_VARIANT,
  type AdminTenantStatus,
} from '../lib/status-labels';
import { SEGMENT_COLOR, SEGMENT_LABEL } from '../lib/segment-colors';
import type { TenantSegment } from '@praktikus/shared';

const STATUS_COLORS: Record<AdminTenantStatus, string> = {
  ACTIVE: 'var(--adm-success)',
  TRIAL: 'var(--adm-info)',
  OVERDUE: 'var(--adm-warning)',
  SUSPENDED: 'var(--adm-danger)',
};

export function OverviewPage() {
  const { data, loading, error } = useAdminOverview();

  if (error) {
    return <EmptyState title="Erro" message={error} />;
  }
  if (loading || !data) {
    return (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
        }}
      >
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} height={88} />
        ))}
      </div>
    );
  }

  const k = data.kpis;
  const adoption =
    k.activeTenants.value + k.trialTenants.value > 0
      ? k.whatsappTenants.value /
        (k.activeTenants.value + k.trialTenants.value)
      : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
        }}
      >
        <KpiCard
          label="Clientes ativos"
          value={k.activeTenants.value}
          formatValue={(v) => formatNumber(v as number)}
          delta={k.activeTenants.deltaVsLastMonth}
          sparkline={k.activeTenants.sparkline}
        />
        <KpiCard
          label="Em trial"
          value={k.trialTenants.value}
          formatValue={(v) => formatNumber(v as number)}
          delta={k.trialTenants.deltaVsLastMonth}
          sparkline={k.trialTenants.sparkline}
        />
        <KpiCard
          label="Usam WhatsApp"
          value={k.whatsappTenants.value}
          formatValue={(v) =>
            `${formatNumber(v as number)} (${(adoption * 100).toFixed(0)}%)`
          }
          delta={k.whatsappTenants.deltaVsLastMonth}
          sparkline={k.whatsappTenants.sparkline}
        />
        <KpiCard label="MRR" value={null} />
      </div>

      <div
        style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}
      >
        <Card title="MRR (últimos 6 meses)">
          <div style={{ position: 'relative', height: 240 }}>
            <Skeleton width="100%" height={240} />
            <Badge variant="info">
              <span style={{ fontSize: 9 }}>Fase 1.5</span>
            </Badge>
          </div>
        </Card>
        <Card title="Distribuição por status">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              flexWrap: 'wrap',
            }}
          >
            <DonutChart
              size={140}
              data={data.statusDistribution.map((s) => ({
                label: STATUS_LABEL[s.status as AdminTenantStatus] ?? s.status,
                value: s.count,
                color:
                  STATUS_COLORS[s.status as AdminTenantStatus] ??
                  'var(--adm-fg-subtle)',
              }))}
            />
            <ul
              style={{
                listStyle: 'none',
                padding: 0,
                margin: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                fontSize: 12,
              }}
            >
              {data.statusDistribution.map((s) => (
                <li
                  key={s.status}
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background:
                        STATUS_COLORS[s.status as AdminTenantStatus] ??
                        'var(--adm-fg-subtle)',
                    }}
                  />
                  <Badge
                    variant={
                      STATUS_VARIANT[s.status as AdminTenantStatus] ??
                      'default'
                    }
                  >
                    {STATUS_LABEL[s.status as AdminTenantStatus] ?? s.status}
                  </Badge>
                  <span style={{ fontWeight: 600 }}>{s.count}</span>
                </li>
              ))}
            </ul>
          </div>
        </Card>
      </div>

      <div
        style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}
      >
        <Card title="Distribuição por segmento">
          <StackedBar
            segments={data.segmentDistribution.map((s) => ({
              label: SEGMENT_LABEL[s.segment as TenantSegment] ?? s.segment,
              value: s.count,
              color: SEGMENT_COLOR[s.segment as TenantSegment] ?? '#888',
            }))}
          />
          <ul
            style={{
              listStyle: 'none',
              padding: 0,
              margin: '12px 0 0',
              display: 'flex',
              gap: 12,
              fontSize: 12,
            }}
          >
            {data.segmentDistribution.map((s) => (
              <li
                key={s.segment}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background:
                      SEGMENT_COLOR[s.segment as TenantSegment] ?? '#888',
                  }}
                />
                {SEGMENT_LABEL[s.segment as TenantSegment] ?? s.segment} ·{' '}
                <strong>{s.count}</strong>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Trials expirando (próximos 7 dias)">
          {data.trialsExpiring.length === 0 ? (
            <EmptyState
              title="Nenhum trial expirando"
              message="Tudo tranquilo nos próximos 7 dias."
            />
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {data.trialsExpiring.map((t) => (
                <li
                  key={t.tenantId}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '6px 0',
                    borderBottom: '1px solid var(--adm-border)',
                    fontSize: 13,
                  }}
                >
                  <span>{t.nomeFantasia}</span>
                  <span style={{ color: 'var(--adm-warning)', fontWeight: 600 }}>
                    {t.daysLeft}d
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card title="Distribuição por UF">
        <BrazilTilemap data={data.ufDistribution} />
      </Card>

      <Card title="Atividade recente">
        <EmptyState
          title="Sem dados ainda"
          message="Eventos vão aparecer aqui quando o log de atividades estiver disponível (Fase 1.5)."
        />
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/frontend/src/pages/admin/pages/OverviewPage.tsx
git commit -m "feat(admin-ui): add OverviewPage dashboard"
```

---

## Task 35: `TenantsPage`

**Files:**
- Create: `apps/frontend/src/pages/admin/pages/TenantsPage.tsx`

Persiste filtros em `localStorage['pk_admin_filters_clientes']`. Usa `useAdminTenants`, `Card`, `Chip`, `FilterBar`, `DataTable`, `Badge`, `HealthBar`, `Avatar`.

- [ ] **Step 1: Implementar página**

```tsx
import { useEffect, useState } from 'react';
import { useAdminTenants, type TenantFilters } from '../hooks/useAdminTenants';
import { Card } from '../components/Card';
import { Chip } from '../components/Chip';
import { FilterBar } from '../components/FilterBar';
import { DataTable } from '../components/DataTable';
import { KpiCard } from '../components/KpiCard';
import { Badge } from '../components/Badge';
import { Avatar } from '../components/Avatar';
import { HealthBar } from '../components/HealthBar';
import { Button } from '../components/Button';
import { formatNumber } from '../lib/format';
import {
  STATUS_LABEL,
  STATUS_VARIANT,
  type AdminTenantStatus,
} from '../lib/status-labels';
import { SEGMENT_COLOR, SEGMENT_LABEL } from '../lib/segment-colors';
import type { TenantSegment } from '@praktikus/shared';

const FILTERS_KEY = 'pk_admin_filters_clientes';

const STATUSES: AdminTenantStatus[] = [
  'ACTIVE',
  'TRIAL',
  'OVERDUE',
  'SUSPENDED',
];

function loadFilters(): TenantFilters {
  try {
    const raw = localStorage.getItem(FILTERS_KEY);
    if (!raw) return { status: 'all', segment: 'all', wpp: 'all', q: '' };
    return { ...JSON.parse(raw), page: 1 };
  } catch {
    return { status: 'all', segment: 'all', wpp: 'all', q: '' };
  }
}

export function TenantsPage() {
  const [filters, setFilters] = useState<TenantFilters>(() => loadFilters());

  useEffect(() => {
    localStorage.setItem(
      FILTERS_KEY,
      JSON.stringify({
        status: filters.status,
        segment: filters.segment,
        wpp: filters.wpp,
        q: filters.q,
      }),
    );
  }, [filters.status, filters.segment, filters.wpp, filters.q]);

  const { data, loading, error } = useAdminTenants(filters);
  const counters = data?.countersByStatus;

  function setStatus(s: AdminTenantStatus | 'all') {
    setFilters((f) => ({ ...f, status: s, page: 1 }));
  }
  function setSegment(s: TenantFilters['segment']) {
    setFilters((f) => ({ ...f, segment: s, page: 1 }));
  }
  function setWpp(s: TenantFilters['wpp']) {
    setFilters((f) => ({ ...f, wpp: s, page: 1 }));
  }
  function clear() {
    setFilters({
      status: 'all',
      segment: 'all',
      wpp: 'all',
      q: '',
      page: 1,
      pageSize: 25,
    });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
        }}
      >
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setStatus(filters.status === s ? 'all' : s)}
            style={{
              all: 'unset',
              cursor: 'pointer',
              border:
                filters.status === s
                  ? '2px solid var(--adm-accent)'
                  : '1px solid var(--adm-border)',
              borderRadius: 'var(--adm-radius-md)',
              transition: 'all .12s ease',
            }}
          >
            <KpiCard
              label={STATUS_LABEL[s]}
              value={counters ? counters[s] : null}
              formatValue={(v) => formatNumber(v as number)}
            />
          </button>
        ))}
      </div>

      <Card>
        <FilterBar
          search={
            <input
              type="search"
              placeholder="Buscar por nome, CNPJ, slug…"
              value={filters.q ?? ''}
              onChange={(e) =>
                setFilters((f) => ({ ...f, q: e.target.value, page: 1 }))
              }
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid var(--adm-border)',
                borderRadius: 6,
                fontSize: 13,
              }}
            />
          }
          chips={
            <>
              <Chip
                active={filters.segment === 'all'}
                onClick={() => setSegment('all')}
              >
                Todos os segmentos
              </Chip>
              <Chip
                active={filters.segment === 'WORKSHOP'}
                onClick={() => setSegment('WORKSHOP')}
              >
                Oficina
              </Chip>
              <Chip
                active={filters.segment === 'RECYCLING'}
                onClick={() => setSegment('RECYCLING')}
              >
                Recicláveis
              </Chip>
              <span style={{ width: 1, background: 'var(--adm-border)' }} />
              <Chip active={filters.wpp === 'all'} onClick={() => setWpp('all')}>
                WhatsApp: todos
              </Chip>
              <Chip active={filters.wpp === 'yes'} onClick={() => setWpp('yes')}>
                Usa
              </Chip>
              <Chip active={filters.wpp === 'no'} onClick={() => setWpp('no')}>
                Não usa
              </Chip>
            </>
          }
          actions={<Button onClick={clear}>Limpar filtros</Button>}
        />

        <div style={{ marginTop: 12 }}>
          {error ? (
            <div style={{ color: 'var(--adm-danger)' }}>{error}</div>
          ) : (
            <DataTable
              isLoading={loading}
              data={data?.data ?? []}
              emptyTitle="Nenhum cliente encontrado"
              emptyMessage="Ajuste os filtros pra ver resultados."
              emptyAction={<Button onClick={clear}>Limpar filtros</Button>}
              columns={[
                {
                  key: 'cliente',
                  header: 'Cliente',
                  render: (t) => (
                    <div
                      style={{
                        display: 'flex',
                        gap: 8,
                        alignItems: 'center',
                      }}
                    >
                      <Avatar
                        name={t.nomeFantasia}
                        color={
                          SEGMENT_COLOR[t.segment as TenantSegment] ??
                          'var(--adm-accent)'
                        }
                      />
                      <div>
                        <div style={{ fontWeight: 600 }}>{t.nomeFantasia}</div>
                        <div
                          style={{
                            fontSize: 11,
                            color: 'var(--adm-fg-muted)',
                          }}
                        >
                          {t.cnpj}
                          {t.city && (
                            <>
                              {' '}
                              · {t.city}/{t.state}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ),
                },
                {
                  key: 'segment',
                  header: 'Segmento',
                  render: (t) => (
                    <span
                      style={{
                        color: SEGMENT_COLOR[t.segment as TenantSegment],
                        fontWeight: 600,
                      }}
                    >
                      {SEGMENT_LABEL[t.segment as TenantSegment] ?? t.segment}
                    </span>
                  ),
                },
                {
                  key: 'status',
                  header: 'Status',
                  render: (t) => (
                    <Badge variant={STATUS_VARIANT[t.status as AdminTenantStatus]}>
                      {STATUS_LABEL[t.status as AdminTenantStatus]}
                    </Badge>
                  ),
                },
                { key: 'plan', header: 'Plano', render: () => '—' },
                {
                  key: 'wpp',
                  header: 'WhatsApp',
                  render: (t) => (
                    <Badge variant={t.whatsappEnabled ? 'success' : 'default'}>
                      {t.whatsappEnabled ? 'On' : 'Off'}
                    </Badge>
                  ),
                },
                {
                  key: 'health',
                  header: 'Saúde',
                  render: (t) => <HealthBar score={t.healthScore} />,
                },
                { key: 'mrr', header: 'MRR', render: () => '—' },
                { key: 'lastSeen', header: 'Última atividade', render: () => '—' },
                {
                  key: 'actions',
                  header: '',
                  render: () => (
                    <Button disabled title="Em breve">
                      Ver
                    </Button>
                  ),
                },
              ]}
            />
          )}

          {data && data.total > 0 && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: 12,
                fontSize: 12,
                color: 'var(--adm-fg-muted)',
              }}
            >
              <span>
                Página {data.page} ·{' '}
                {(data.page - 1) * data.pageSize + 1}–
                {Math.min(data.page * data.pageSize, data.total)} de {data.total}
              </span>
              <span style={{ display: 'flex', gap: 8 }}>
                <Button
                  disabled={data.page === 1}
                  onClick={() =>
                    setFilters((f) => ({ ...f, page: (f.page ?? 1) - 1 }))
                  }
                >
                  Anterior
                </Button>
                <Button
                  disabled={data.page * data.pageSize >= data.total}
                  onClick={() =>
                    setFilters((f) => ({ ...f, page: (f.page ?? 1) + 1 }))
                  }
                >
                  Próxima
                </Button>
              </span>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/frontend/src/pages/admin/pages/TenantsPage.tsx
git commit -m "feat(admin-ui): add TenantsPage with filters, search and pagination"
```

---

## Task 36: `SegmentsPage`

**Files:**
- Create: `apps/frontend/src/pages/admin/pages/SegmentsPage.tsx`

- [ ] **Step 1: Implementar**

```tsx
import { useAdminSegments } from '../hooks/useAdminSegments';
import { Card } from '../components/Card';
import { StackedBar } from '../components/charts/StackedBar';
import { Skeleton } from '../components/Skeleton';
import { EmptyState } from '../components/EmptyState';
import { formatNumber } from '../lib/format';
import { SEGMENT_COLOR, SEGMENT_LABEL } from '../lib/segment-colors';
import { STATUS_LABEL, type AdminTenantStatus } from '../lib/status-labels';
import type { TenantSegment } from '@praktikus/shared';

const STATUS_COLORS: Record<AdminTenantStatus, string> = {
  ACTIVE: 'var(--adm-success)',
  TRIAL: 'var(--adm-info)',
  OVERDUE: 'var(--adm-warning)',
  SUSPENDED: 'var(--adm-danger)',
};

export function SegmentsPage() {
  const { data, loading, error } = useAdminSegments();
  if (error) return <EmptyState title="Erro" message={error} />;
  if (loading || !data) return <Skeleton width="100%" height={200} />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card title="Composição por segmento">
        <StackedBar
          height={20}
          segments={data.segments.map((s) => ({
            label: SEGMENT_LABEL[s.segment as TenantSegment] ?? s.segment,
            value: s.total,
            color: SEGMENT_COLOR[s.segment as TenantSegment] ?? '#888',
          }))}
        />
        <div style={{ fontSize: 12, marginTop: 8, color: 'var(--adm-fg-muted)' }}>
          Total: <strong>{formatNumber(data.totalTenants)}</strong> tenants
        </div>
      </Card>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: 16,
        }}
      >
        {data.segments.map((s) => {
          const segKey = s.segment as TenantSegment;
          return (
            <Card key={s.segment}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 12,
                }}
              >
                <span
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: 4,
                    background: SEGMENT_COLOR[segKey] ?? '#888',
                  }}
                />
                <strong>{SEGMENT_LABEL[segKey] ?? s.segment}</strong>
                <span
                  style={{
                    marginLeft: 'auto',
                    fontSize: 11,
                    color: 'var(--adm-fg-muted)',
                  }}
                >
                  {s.newLast30Days} novos / 30d
                </span>
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: 8,
                  fontSize: 12,
                }}
              >
                <div>
                  Ativos: <strong>{s.byStatus.ACTIVE ?? 0}</strong>
                </div>
                <div>
                  Trial: <strong>{s.byStatus.TRIAL ?? 0}</strong>
                </div>
                <div>
                  WhatsApp: <strong>{s.whatsappCount}</strong>
                </div>
                <div>MRR: —</div>
              </div>
              <div style={{ marginTop: 12 }}>
                <StackedBar
                  segments={(['ACTIVE', 'TRIAL', 'OVERDUE', 'SUSPENDED'] as AdminTenantStatus[]).map(
                    (st) => ({
                      label: STATUS_LABEL[st],
                      value: s.byStatus[st] ?? 0,
                      color: STATUS_COLORS[st],
                    }),
                  )}
                />
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/frontend/src/pages/admin/pages/SegmentsPage.tsx
git commit -m "feat(admin-ui): add SegmentsPage with stacked bar and per-segment cards"
```

---

## Task 37: `WhatsappPage`

**Files:**
- Create: `apps/frontend/src/pages/admin/pages/WhatsappPage.tsx`

- [ ] **Step 1: Implementar**

```tsx
import { useAdminWhatsapp } from '../hooks/useAdminWhatsapp';
import { Card } from '../components/Card';
import { KpiCard } from '../components/KpiCard';
import { Skeleton } from '../components/Skeleton';
import { EmptyState } from '../components/EmptyState';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { DataTable } from '../components/DataTable';
import { formatNumber, formatPercent } from '../lib/format';
import { SEGMENT_COLOR, SEGMENT_LABEL } from '../lib/segment-colors';
import { STATUS_LABEL, STATUS_VARIANT, type AdminTenantStatus } from '../lib/status-labels';
import type { TenantSegment } from '@praktikus/shared';

export function WhatsappPage() {
  const { data, loading, error } = useAdminWhatsapp();
  if (error) return <EmptyState title="Erro" message={error} />;
  if (loading || !data) return <Skeleton width="100%" height={200} />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
        }}
      >
        <KpiCard
          label="Adesão"
          value={data.kpis.adoptionRate}
          formatValue={(v) => formatPercent(v as number)}
        />
        <KpiCard label="MRR add-on" value={null} />
        <KpiCard
          label="Plano STARTER"
          value={data.kpis.starterCount}
          formatValue={(v) => formatNumber(v as number)}
        />
        <KpiCard
          label="Plano PRO + ENTERPRISE"
          value={data.kpis.proCount + data.kpis.enterpriseCount}
          formatValue={(v) => formatNumber(v as number)}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Card title="Quem usa">
          <DataTable
            data={data.using}
            emptyTitle="Ninguém ativou ainda"
            columns={[
              {
                key: 'name',
                header: 'Cliente',
                render: (t) => <strong>{t.nomeFantasia}</strong>,
              },
              {
                key: 'seg',
                header: 'Segmento',
                render: (t) =>
                  SEGMENT_LABEL[t.segment as TenantSegment] ?? t.segment,
              },
              {
                key: 'plan',
                header: 'Plano',
                render: (t) => (
                  <Badge variant="info">{t.whatsappPlan ?? '—'}</Badge>
                ),
              },
              { key: 'vol', header: 'Volume mensal', render: () => '—' },
            ]}
          />
        </Card>
        <Card title="Não usam">
          <DataTable
            data={data.notUsing}
            emptyTitle="Todos os elegíveis já usam"
            columns={[
              {
                key: 'name',
                header: 'Cliente',
                render: (t) => <strong>{t.nomeFantasia}</strong>,
              },
              {
                key: 'seg',
                header: 'Segmento',
                render: (t) =>
                  SEGMENT_LABEL[t.segment as TenantSegment] ?? t.segment,
              },
              {
                key: 'st',
                header: 'Status',
                render: (t) => (
                  <Badge variant={STATUS_VARIANT[t.status as AdminTenantStatus]}>
                    {STATUS_LABEL[t.status as AdminTenantStatus]}
                  </Badge>
                ),
              },
              {
                key: 'cta',
                header: '',
                render: () => (
                  <Button disabled title="Em breve">
                    Oferecer
                  </Button>
                ),
              },
            ]}
          />
        </Card>
      </div>

      <Card title="Adesão por segmento">
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {data.adoptionBySegment.map((s) => (
            <li
              key={s.segment}
              style={{
                display: 'grid',
                gridTemplateColumns: '120px 1fr 80px',
                gap: 12,
                alignItems: 'center',
                padding: '6px 0',
              }}
            >
              <span
                style={{ color: SEGMENT_COLOR[s.segment as TenantSegment] }}
              >
                {SEGMENT_LABEL[s.segment as TenantSegment] ?? s.segment}
              </span>
              <div
                style={{
                  height: 8,
                  background: 'var(--adm-bg-muted)',
                  borderRadius: 4,
                }}
              >
                <div
                  style={{
                    width: `${(s.rate * 100).toFixed(0)}%`,
                    height: '100%',
                    background: SEGMENT_COLOR[s.segment as TenantSegment],
                    borderRadius: 4,
                  }}
                />
              </div>
              <span style={{ fontSize: 12, fontWeight: 600 }}>
                {formatPercent(s.rate)} ({s.using}/{s.eligible})
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/frontend/src/pages/admin/pages/WhatsappPage.tsx
git commit -m "feat(admin-ui): add WhatsappPage with adoption KPIs and tables"
```

---

## Task 38: `FinancialPage` (placeholders + counts)

**Files:**
- Create: `apps/frontend/src/pages/admin/pages/FinancialPage.tsx`

- [ ] **Step 1: Implementar**

```tsx
import { useAdminFinancial } from '../hooks/useAdminFinancial';
import { Card } from '../components/Card';
import { KpiCard } from '../components/KpiCard';
import { Skeleton } from '../components/Skeleton';
import { EmptyState } from '../components/EmptyState';
import { formatNumber } from '../lib/format';

export function FinancialPage() {
  const { data, loading, error } = useAdminFinancial();
  if (error) return <EmptyState title="Erro" message={error} />;
  if (loading || !data) return <Skeleton width="100%" height={200} />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
        }}
      >
        <KpiCard label="MRR" value={null} />
        <KpiCard label="ARR" value={null} />
        <KpiCard label="Ticket médio" value={null} />
        <KpiCard label="Churn 30d" value={null} />
      </div>

      <Card title="Distribuição financeira (visão básica)">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 16,
          }}
        >
          <div>
            <div style={{ fontSize: 11, color: 'var(--adm-fg-muted)' }}>
              Pagantes (ACTIVE)
            </div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>
              {formatNumber(data.basicDistribution.active)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--adm-fg-muted)' }}>
              Em atraso (OVERDUE)
            </div>
            <div
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: 'var(--adm-warning)',
              }}
            >
              {formatNumber(data.basicDistribution.overdue)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--adm-fg-muted)' }}>
              Suspensos (total)
            </div>
            <div
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: 'var(--adm-danger)',
              }}
            >
              {formatNumber(data.basicDistribution.suspended)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--adm-fg-muted)' }}>
              Suspensos últimos 30d
            </div>
            <div
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: 'var(--adm-danger)',
              }}
            >
              {formatNumber(data.basicDistribution.suspendedLast30Days)}
            </div>
          </div>
        </div>
      </Card>

      <Card title="Cobranças recentes">
        <EmptyState
          title="Sem dados ainda"
          message="A integração com Asaas (sync de cobranças) entra na Fase 1.5."
        />
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/frontend/src/pages/admin/pages/FinancialPage.tsx
git commit -m "feat(admin-ui): add FinancialPage with placeholders and basic counts"
```

---

## Task 39: Wire `/admin/*` no `App.tsx` com lazy-load + hydrate

**Files:**
- Modify: `apps/frontend/src/App.tsx`

- [ ] **Step 1: Adicionar imports e rotas**

No topo do arquivo (após os imports existentes):

```tsx
import { lazy, Suspense } from 'react';
import { PlatformOnlyRoute } from './pages/admin/_layout/PlatformOnlyRoute';
import { usePlatformAuthStore } from './store/platform-auth.store';

const AdminLayout = lazy(() =>
  import('./pages/admin/_layout/AdminLayout').then((m) => ({ default: m.AdminLayout })),
);
const AdminLoginPage = lazy(() =>
  import('./pages/admin/pages/LoginPage').then((m) => ({ default: m.LoginPage })),
);
const AdminOverviewPage = lazy(() =>
  import('./pages/admin/pages/OverviewPage').then((m) => ({ default: m.OverviewPage })),
);
const AdminTenantsPage = lazy(() =>
  import('./pages/admin/pages/TenantsPage').then((m) => ({ default: m.TenantsPage })),
);
const AdminSegmentsPage = lazy(() =>
  import('./pages/admin/pages/SegmentsPage').then((m) => ({ default: m.SegmentsPage })),
);
const AdminWhatsappPage = lazy(() =>
  import('./pages/admin/pages/WhatsappPage').then((m) => ({ default: m.WhatsappPage })),
);
const AdminFinancialPage = lazy(() =>
  import('./pages/admin/pages/FinancialPage').then((m) => ({ default: m.FinancialPage })),
);
```

No corpo do `App` component, **adicionar** a chamada de hydrate logo após a chamada existente:

```tsx
const hydrate = useAuthStore((s) => s.hydrate);
const platformHydrate = usePlatformAuthStore((s) => s.hydrate);

useEffect(() => {
  hydrate();
  platformHydrate();
}, [hydrate, platformHydrate]);
```

Antes do `</Routes>`, **adicionar** o bloco `/admin/*`:

```tsx
<Route
  path="/admin/login"
  element={
    <Suspense fallback={null}>
      <AdminLoginPage />
    </Suspense>
  }
/>
<Route
  path="/admin"
  element={
    <PlatformOnlyRoute>
      <Suspense fallback={null}>
        <AdminLayout />
      </Suspense>
    </PlatformOnlyRoute>
  }
>
  <Route
    index
    element={
      <Suspense fallback={null}>
        <AdminOverviewPage />
      </Suspense>
    }
  />
  <Route
    path="clientes"
    element={
      <Suspense fallback={null}>
        <AdminTenantsPage />
      </Suspense>
    }
  />
  <Route
    path="segmentos"
    element={
      <Suspense fallback={null}>
        <AdminSegmentsPage />
      </Suspense>
    }
  />
  <Route
    path="whatsapp"
    element={
      <Suspense fallback={null}>
        <AdminWhatsappPage />
      </Suspense>
    }
  />
  <Route
    path="financeiro"
    element={
      <Suspense fallback={null}>
        <AdminFinancialPage />
      </Suspense>
    }
  />
</Route>
```

- [ ] **Step 2: Atualizar `PublicOnlyRoute` se necessário**

[`apps/frontend/src/components/PublicOnlyRoute.tsx`](../../apps/frontend/src/components/PublicOnlyRoute.tsx) atualmente redireciona usuários autenticados pra `/workshop` ou `/recycling`. Ele lê de `useAuthStore` (tenant), não de `usePlatformAuthStore` — então não vai interferir com platform users. **Nenhuma mudança necessária** aqui, mas validar manualmente: navegar pra `/login` enquanto logado como platform user **não** deve redirecionar; navegar pra `/login` enquanto logado como tenant continua redirecionando.

- [ ] **Step 3: Smoke manual fim-a-fim**

```bash
docker compose up -d
pnpm --filter backend migration:run
pnpm --filter backend seed:admin-dev
pnpm --filter backend start:dev &
pnpm --filter frontend dev
```

Em `http://localhost:5173/admin`:

1. Sem login → redireciona pra `/admin/login`
2. Login com `PLATFORM_OWNER_EMAIL` / `PLATFORM_OWNER_PASSWORD` → entra em `/admin` (Overview)
3. Sidebar funcional, navegação entre Clientes/Segmentos/WhatsApp/Financeiro carrega sem erro
4. Tema dark toggle no topbar funciona
5. Tentar acessar `/workshop/dashboard` ainda autenticado como platform → JwtAuthGuard rejeita (401), redireciona pra `/login`
6. Logout do admin (botão Sair na sidebar) volta pra `/admin/login`

Esperado: todas as páginas renderizam, navegação fluida, dados de fake-tenants visíveis.

- [ ] **Step 4: Tests do App.tsx (opcional, smoke)**

Atualizar [`apps/frontend/src/App.test.tsx`](../../apps/frontend/src/App.test.tsx) **só se necessário** — caso esteja quebrado por causa do `usePlatformAuthStore` mock faltando, adicionar:

```tsx
vi.mock('./store/platform-auth.store', () => ({
  usePlatformAuthStore: vi.fn().mockImplementation((s: any) =>
    typeof s === 'function'
      ? s({ hydrate: vi.fn(), isAuthenticated: false, isHydrated: true })
      : { hydrate: vi.fn(), isAuthenticated: false, isHydrated: true },
  ),
}));
```

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/App.tsx apps/frontend/src/App.test.tsx
git commit -m "feat(admin-ui): wire /admin routes with lazy-load and platform guard"
```

---

## Task 40: Quality Gate (Sonar) — obrigatória, sempre última

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

---

## Apêndice — Resumo de arquivos criados/modificados

**Backend (criados):**
- `apps/backend/src/database/migrations/1749000000000-AddPlatformUsersAndAdminIndexes.ts`
- `apps/backend/src/modules/core/admin/admin.module.ts`
- `apps/backend/src/modules/core/admin/admin-auth/{platform-user.entity,platform-refresh-token.entity,platform-auth.{service,controller,guard},platform-jwt.strategy,platform.decorator,dto/{login,refresh,logout}.dto}.ts`
- `apps/backend/src/modules/core/admin/admin-{overview,tenants,segments,whatsapp,financial}/{*.{controller,service}.ts,dto/*.dto.ts}`
- `apps/backend/src/scripts/seed-admin-dev.ts`
- `apps/backend/test/admin.e2e-spec.ts`
- Tests `*.spec.ts` correspondentes

**Backend (modificados):**
- `apps/backend/src/app.module.ts` (importa `AdminModule`)
- `apps/backend/src/modules/core/auth/jwt.strategy.ts` (rejeita JWTs de plataforma)
- `apps/backend/package.json` (deps + script seed)
- `.env.example` (vars `PLATFORM_*`)

**Frontend (criados):**
- `apps/frontend/src/services/{admin.api,admin-auth.service}.ts`
- `apps/frontend/src/store/platform-auth.store.ts`
- `apps/frontend/src/pages/admin/_layout/{AdminLayout,AdminSidebar,AdminTopbar,PlatformOnlyRoute}.tsx`
- `apps/frontend/src/pages/admin/components/{Card,Badge,Button,Avatar,Chip,KpiCard,FilterBar,DataTable,HealthBar,EmptyState,Skeleton}.tsx`
- `apps/frontend/src/pages/admin/components/charts/{DonutChart,StackedBar,SparklineSvg,BrazilTilemap}.tsx`
- `apps/frontend/src/pages/admin/styles/{admin-tokens,admin-components}.css`
- `apps/frontend/src/pages/admin/hooks/{useAdminOverview,useAdminTenants,useAdminSegments,useAdminWhatsapp,useAdminFinancial}.ts`
- `apps/frontend/src/pages/admin/pages/{LoginPage,OverviewPage,TenantsPage,SegmentsPage,WhatsappPage,FinancialPage}.tsx`
- `apps/frontend/src/pages/admin/lib/{format,status-labels,segment-colors}.ts`
- Tests `*.test.{ts,tsx}` correspondentes

**Frontend (modificados):**
- `apps/frontend/src/App.tsx` (rotas `/admin/*` lazy + hydrate)

---

**Total: 40 tasks.** Backend (1-18), Frontend (19-39), Quality Gate (40).
