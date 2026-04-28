# Recuperação de senha + remoção de "Lembrar de mim" — Plano

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar fluxo end-to-end de recuperação de senha por email (Resend), remover checkbox "Lembrar de mim" da LoginPage, e expor o link "Esqueci a senha" funcionalmente.

**Architecture:** Backend gera token random (32 bytes hex), armazena apenas o `sha256(token)` em `public.password_reset_tokens` (TTL 1h), envia o token plaintext por email via Resend. Reset valida token, atualiza senha (bcrypt round 10), marca token usado, deleta refresh tokens (force-relogin) e envia email de confirmação. Frontend ganha 2 páginas dedicadas (`/forgot-password`, `/reset-password/:token`) reusando `<AuthShell>`.

**Tech Stack:** NestJS + TypeORM + bcrypt + Resend (backend); React 19 + react-hook-form + zod + react-router-dom (frontend).

**Spec:** [docs/superpowers/specs/2026-04-25-password-recovery-design.md](../specs/2026-04-25-password-recovery-design.md)

---

## File Structure

**Backend — novos:**
- `apps/backend/src/modules/core/auth/password-reset-token.entity.ts`
- `apps/backend/src/modules/core/auth/dto/forgot-password.dto.ts`
- `apps/backend/src/modules/core/auth/dto/reset-password.dto.ts`
- `apps/backend/src/modules/core/mail/mail.module.ts`
- `apps/backend/src/modules/core/mail/mail.service.ts`
- `apps/backend/src/modules/core/mail/mail.service.spec.ts`
- `apps/backend/src/database/migrations/1747000000000-AddPasswordResetTokens.ts`

**Backend — modificados:**
- `apps/backend/src/modules/core/auth/auth.module.ts`
- `apps/backend/src/modules/core/auth/auth.service.ts`
- `apps/backend/src/modules/core/auth/auth.service.spec.ts`
- `apps/backend/src/modules/core/auth/auth.controller.ts`

**Frontend — novos:**
- `apps/frontend/src/pages/auth/ForgotPasswordPage.tsx`
- `apps/frontend/src/pages/auth/ResetPasswordPage.tsx`

**Frontend — modificados:**
- `apps/frontend/src/services/auth.service.ts`
- `apps/frontend/src/pages/auth/LoginPage.tsx`
- `apps/frontend/src/App.tsx`

---

## Phase 1 — Backend

### Task 1: Entity + Migration

**Files:**
- Create: `apps/backend/src/modules/core/auth/password-reset-token.entity.ts`
- Create: `apps/backend/src/database/migrations/1747000000000-AddPasswordResetTokens.ts`

- [ ] **Step 1: Criar a entity**

Criar `apps/backend/src/modules/core/auth/password-reset-token.entity.ts`:

```typescript
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'password_reset_tokens', schema: 'public' })
export class PasswordResetTokenEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  @Index()
  userId: string;

  @Column({ name: 'token_hash', type: 'varchar', length: 64, unique: true })
  tokenHash: string;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @Column({ name: 'used_at', type: 'timestamptz', nullable: true })
  usedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
```

- [ ] **Step 2: Criar a migration**

Criar `apps/backend/src/database/migrations/1747000000000-AddPasswordResetTokens.ts`:

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPasswordResetTokens1747000000000 implements MigrationInterface {
  name = 'AddPasswordResetTokens1747000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "public"."password_reset_tokens" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" UUID NOT NULL REFERENCES "public"."users"("id") ON DELETE CASCADE,
        "token_hash" VARCHAR(64) NOT NULL,
        "expires_at" TIMESTAMPTZ NOT NULL,
        "used_at" TIMESTAMPTZ NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT "UQ_password_reset_tokens_token_hash" UNIQUE ("token_hash")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_password_reset_tokens_user_id" ON "public"."password_reset_tokens" ("user_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_password_reset_tokens_user_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "public"."password_reset_tokens"`);
  }
}
```

- [ ] **Step 3: Typecheck**

Run: `source ~/.nvm/nvm.sh && nvm use 20 > /dev/null && pnpm --filter backend exec tsc --noEmit`
Expected: zero errors.

- [ ] **Step 4: NÃO commitar ainda — comita junto com Task 7 (backend atômico).**

---

### Task 2: MailService + MailModule

**Files:**
- Create: `apps/backend/src/modules/core/mail/mail.module.ts`
- Create: `apps/backend/src/modules/core/mail/mail.service.ts`
- Create: `apps/backend/src/modules/core/mail/mail.service.spec.ts`
- Modify: `apps/backend/package.json` (via `pnpm add`)

- [ ] **Step 1: Instalar dependência Resend**

Run: `source ~/.nvm/nvm.sh && nvm use 20 > /dev/null && pnpm --filter backend add resend`
Expected: instala `resend` em `apps/backend/package.json` (sem erros).

- [ ] **Step 2: Criar o spec ANTES da implementação (TDD)**

Criar `apps/backend/src/modules/core/mail/mail.service.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { MailService } from './mail.service';

const mockResendSend = jest.fn();

jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: (...args: unknown[]) => mockResendSend(...args) },
  })),
}));

function buildModule(env: Record<string, string | undefined>) {
  return Test.createTestingModule({
    providers: [
      MailService,
      {
        provide: ConfigService,
        useValue: { get: (key: string) => env[key] },
      },
    ],
  }).compile();
}

describe('MailService', () => {
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    mockResendSend.mockReset();
    mockResendSend.mockResolvedValue({ data: { id: 'mock-id' }, error: null });
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  describe('dev mode (no RESEND_API_KEY)', () => {
    it('logs reset URL instead of sending email', async () => {
      const module: TestingModule = await buildModule({});
      const service = module.get<MailService>(MailService);

      await service.sendPasswordReset('a@b.com', 'João', 'http://x/reset/abc');

      expect(mockResendSend).not.toHaveBeenCalled();
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('http://x/reset/abc'),
      );
    });

    it('logs password-changed confirmation in dev mode', async () => {
      const module: TestingModule = await buildModule({});
      const service = module.get<MailService>(MailService);

      await service.sendPasswordChangedConfirmation('a@b.com', 'João');

      expect(mockResendSend).not.toHaveBeenCalled();
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('a@b.com'));
    });
  });

  describe('prod mode (with RESEND_API_KEY)', () => {
    it('calls Resend with reset email payload', async () => {
      const module: TestingModule = await buildModule({
        RESEND_API_KEY: 'rk_test',
        MAIL_FROM: 'Praktikus <no-reply@praktikus.com.br>',
      });
      const service = module.get<MailService>(MailService);

      await service.sendPasswordReset('a@b.com', 'João', 'http://x/reset/abc');

      expect(mockResendSend).toHaveBeenCalledTimes(1);
      const payload = mockResendSend.mock.calls[0][0];
      expect(payload.from).toBe('Praktikus <no-reply@praktikus.com.br>');
      expect(payload.to).toBe('a@b.com');
      expect(payload.subject).toMatch(/recupera/i);
      expect(payload.html).toContain('http://x/reset/abc');
      expect(payload.html).toContain('João');
    });

    it('does not throw when Resend returns an error', async () => {
      mockResendSend.mockResolvedValue({ data: null, error: { message: 'rate limited' } });
      const module: TestingModule = await buildModule({ RESEND_API_KEY: 'rk_test' });
      const service = module.get<MailService>(MailService);

      await expect(
        service.sendPasswordReset('a@b.com', 'João', 'http://x/r/abc'),
      ).resolves.toBeUndefined();
    });
  });
});
```

- [ ] **Step 3: Rodar — deve falhar (módulo não existe)**

Run: `source ~/.nvm/nvm.sh && nvm use 20 > /dev/null && pnpm --filter backend test -- mail.service.spec.ts`
Expected: FAIL — `Cannot find module './mail.service'`.

- [ ] **Step 4: Implementar o MailService**

Criar `apps/backend/src/modules/core/mail/mail.service.ts`:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly resend: Resend | null;
  private readonly from: string;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    this.resend = apiKey ? new Resend(apiKey) : null;
    this.from = this.config.get<string>('MAIL_FROM') ?? 'Praktikus <no-reply@praktikus.com.br>';
  }

  async sendPasswordReset(email: string, name: string, resetUrl: string): Promise<void> {
    if (!this.resend) {
      // eslint-disable-next-line no-console -- dev-only path; surfaces link to terminal
      console.log(`[mail dev] password reset for ${email}: ${resetUrl}`);
      return;
    }
    try {
      const { error } = await this.resend.emails.send({
        from: this.from,
        to: email,
        subject: 'Recuperação de senha — Praktikus',
        html: this.passwordResetHtml(name, resetUrl),
      });
      if (error) {
        this.logger.warn(`Resend error sending reset to ${email}: ${error.message}`);
      }
    } catch (err) {
      this.logger.warn(`Exception sending reset to ${email}: ${(err as Error).message}`);
    }
  }

  async sendPasswordChangedConfirmation(email: string, name: string): Promise<void> {
    if (!this.resend) {
      // eslint-disable-next-line no-console -- dev-only path
      console.log(`[mail dev] password changed for ${email} (${name})`);
      return;
    }
    try {
      const { error } = await this.resend.emails.send({
        from: this.from,
        to: email,
        subject: 'Sua senha foi alterada — Praktikus',
        html: this.passwordChangedHtml(name),
      });
      if (error) {
        this.logger.warn(`Resend error sending confirmation to ${email}: ${error.message}`);
      }
    } catch (err) {
      this.logger.warn(`Exception sending confirmation to ${email}: ${(err as Error).message}`);
    }
  }

  private passwordResetHtml(name: string, resetUrl: string): string {
    return `<!DOCTYPE html>
<html lang="pt-BR">
<body style="font-family: -apple-system, system-ui, sans-serif; background:#f7f8f8; padding:32px; color:#0c1010;">
  <div style="max-width:520px; margin:0 auto; background:#fff; border-radius:12px; padding:32px; border:1px solid #e3e7e7;">
    <h1 style="margin:0 0 16px; font-size:20px; color:#0c1010;">Praktikus</h1>
    <p>Olá, ${escapeHtml(name)}.</p>
    <p>Recebemos um pedido para redefinir sua senha. Clique no botão abaixo para criar uma nova senha:</p>
    <p style="text-align:center; margin:28px 0;">
      <a href="${resetUrl}" style="display:inline-block; background:#348E91; color:#fff; padding:12px 24px; border-radius:8px; text-decoration:none; font-weight:600;">
        Redefinir senha
      </a>
    </p>
    <p style="font-size:13px; color:#5b6868;">Este link é válido por 1 hora. Se você não solicitou essa redefinição, ignore este e-mail — sua senha permanece inalterada.</p>
    <p style="font-size:12px; color:#94a3a3; margin-top:24px;">Se o botão não funcionar, copie e cole este link no navegador:<br/>${resetUrl}</p>
  </div>
</body>
</html>`;
  }

  private passwordChangedHtml(name: string): string {
    return `<!DOCTYPE html>
<html lang="pt-BR">
<body style="font-family: -apple-system, system-ui, sans-serif; background:#f7f8f8; padding:32px; color:#0c1010;">
  <div style="max-width:520px; margin:0 auto; background:#fff; border-radius:12px; padding:32px; border:1px solid #e3e7e7;">
    <h1 style="margin:0 0 16px; font-size:20px; color:#0c1010;">Praktikus</h1>
    <p>Olá, ${escapeHtml(name)}.</p>
    <p>Sua senha foi alterada com sucesso. Se não foi você, entre em contato com o suporte imediatamente.</p>
  </div>
</body>
</html>`;
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
```

- [ ] **Step 5: Criar o module**

Criar `apps/backend/src/modules/core/mail/mail.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MailService } from './mail.service';

@Module({
  imports: [ConfigModule],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
```

- [ ] **Step 6: Rodar testes — devem passar (4/4)**

Run: `source ~/.nvm/nvm.sh && nvm use 20 > /dev/null && pnpm --filter backend test -- mail.service.spec.ts`
Expected: PASS, 4/4.

- [ ] **Step 7: NÃO commitar ainda.**

---

### Task 3: Wire MailModule + PasswordResetTokenEntity em AuthModule

**Files:**
- Modify: `apps/backend/src/modules/core/auth/auth.module.ts`

- [ ] **Step 1: Atualizar imports e TypeOrmModule.forFeature**

Substituir o conteúdo de `apps/backend/src/modules/core/auth/auth.module.ts` por:

```typescript
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { RolesGuard } from './roles.guard';
import { UserEntity } from './user.entity';
import { RefreshTokenEntity } from './refresh-token.entity';
import { PasswordResetTokenEntity } from './password-reset-token.entity';
import { TenancyModule } from '../tenancy/tenancy.module';
import { BillingModule } from '../billing/billing.module';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserEntity, RefreshTokenEntity, PasswordResetTokenEntity]),
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: config.get('JWT_EXPIRES_IN', '15m') as any },
      }),
    }),
    TenancyModule,
    BillingModule,
    MailModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, RolesGuard],
  exports: [AuthService, JwtModule, RolesGuard],
})
export class AuthModule {}
```

- [ ] **Step 2: Typecheck**

Run: `source ~/.nvm/nvm.sh && nvm use 20 > /dev/null && pnpm --filter backend exec tsc --noEmit`
Expected: zero errors (haverá erro futuro em auth.service.ts quando ele referenciar campos novos, mas ainda não chegamos lá).

- [ ] **Step 3: NÃO commitar ainda.**

---

### Task 4: DTOs

**Files:**
- Create: `apps/backend/src/modules/core/auth/dto/forgot-password.dto.ts`
- Create: `apps/backend/src/modules/core/auth/dto/reset-password.dto.ts`

- [ ] **Step 1: ForgotPasswordDto**

Criar `apps/backend/src/modules/core/auth/dto/forgot-password.dto.ts`:

```typescript
import { IsEmail } from 'class-validator';

export class ForgotPasswordDto {
  @IsEmail({}, { message: 'E-mail inválido' })
  email: string;
}
```

- [ ] **Step 2: ResetPasswordDto**

Criar `apps/backend/src/modules/core/auth/dto/reset-password.dto.ts`:

```typescript
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @IsString()
  @IsNotEmpty()
  token: string;

  @IsString()
  @MinLength(8, { message: 'Senha deve ter no mínimo 8 caracteres' })
  newPassword: string;
}
```

- [ ] **Step 3: Typecheck**

Run: `source ~/.nvm/nvm.sh && nvm use 20 > /dev/null && pnpm --filter backend exec tsc --noEmit`
Expected: zero errors.

- [ ] **Step 4: NÃO commitar ainda.**

---

### Task 5: AuthService.requestPasswordReset + tests

**Files:**
- Modify: `apps/backend/src/modules/core/auth/auth.service.ts`
- Modify: `apps/backend/src/modules/core/auth/auth.service.spec.ts`

- [ ] **Step 1: Atualizar imports e construtor do AuthService**

Em `apps/backend/src/modules/core/auth/auth.service.ts`, no topo (após os imports existentes), adicionar:

```typescript
import { PasswordResetTokenEntity } from './password-reset-token.entity';
import { MailService } from '../mail/mail.service';
import { ConfigService } from '@nestjs/config';
```

No `@Injectable() class AuthService`, adicionar ao construtor (depois das injeções existentes, antes de `@InjectDataSource`):

```typescript
    @InjectRepository(PasswordResetTokenEntity)
    private readonly resetTokenRepo: Repository<PasswordResetTokenEntity>,
    private readonly mail: MailService,
    private readonly config: ConfigService,
```

A ordem final do construtor fica: `userRepo, refreshTokenRepo, resetTokenRepo, tenancyService, billingService, jwtService, mail, config, dataSource`. Confirme que todos existem.

- [ ] **Step 2: Escrever os testes ANTES da implementação**

Em `apps/backend/src/modules/core/auth/auth.service.spec.ts`, localizar o bloco `describe('AuthService', ...)`. Examinar a estrutura existente de mocks (`mockUserRepo`, `mockRefreshTokenRepo`, etc.) e adicionar:

No topo do arquivo, adicionar mocks novos (perto dos demais):

```typescript
const mockResetTokenRepo = {
  save: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
};

const mockMailService = {
  sendPasswordReset: jest.fn(),
  sendPasswordChangedConfirmation: jest.fn(),
};

const mockConfigService = {
  get: jest.fn((key: string) => {
    if (key === 'APP_BASE_URL') return 'http://localhost:5173';
    return undefined;
  }),
};
```

No `Test.createTestingModule({ providers: [...] })` da fixture, adicionar:

```typescript
{ provide: getRepositoryToken(PasswordResetTokenEntity), useValue: mockResetTokenRepo },
{ provide: MailService, useValue: mockMailService },
{ provide: ConfigService, useValue: mockConfigService },
```

E os imports no topo do spec:

```typescript
import { PasswordResetTokenEntity } from './password-reset-token.entity';
import { MailService } from '../mail/mail.service';
import { ConfigService } from '@nestjs/config';
```

No topo do spec, também adicionar `IsNull` ao import do typeorm:

```typescript
import { IsNull } from 'typeorm';
```

No `beforeEach`, fazer reset dos novos mocks:

```typescript
mockResetTokenRepo.save.mockReset();
mockResetTokenRepo.findOne.mockReset();
mockResetTokenRepo.update.mockReset();
mockMailService.sendPasswordReset.mockReset();
mockMailService.sendPasswordChangedConfirmation.mockReset();
mockConfigService.get.mockReset();
mockConfigService.get.mockImplementation((key: string) => {
  if (key === 'APP_BASE_URL') return 'http://localhost:5173';
  return undefined;
});
```

Adicionar um novo bloco de testes ao final do `describe('AuthService', ...)`:

```typescript
  describe('requestPasswordReset', () => {
    it('does nothing when email does not exist', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);

      await service.requestPasswordReset('ghost@example.com');

      expect(mockResetTokenRepo.save).not.toHaveBeenCalled();
      expect(mockMailService.sendPasswordReset).not.toHaveBeenCalled();
    });

    it('creates a token (storing only its hash) and sends email when user exists', async () => {
      mockUserRepo.findOne.mockResolvedValue({ id: 'u1', email: 'a@b.com', name: 'Ana' });
      mockResetTokenRepo.save.mockResolvedValue({});
      mockResetTokenRepo.update.mockResolvedValue({});

      await service.requestPasswordReset('a@b.com');

      // Previous active tokens for this user are invalidated first.
      expect(mockResetTokenRepo.update).toHaveBeenCalledWith(
        { userId: 'u1', usedAt: IsNull() },
        expect.objectContaining({ usedAt: expect.any(Date) }),
      );
      expect(mockResetTokenRepo.save).toHaveBeenCalledTimes(1);
      const saved = mockResetTokenRepo.save.mock.calls[0][0];
      expect(saved.userId).toBe('u1');
      expect(saved.tokenHash).toMatch(/^[a-f0-9]{64}$/);
      expect(saved.expiresAt).toBeInstanceOf(Date);

      expect(mockMailService.sendPasswordReset).toHaveBeenCalledTimes(1);
      const [toEmail, toName, resetUrl] = mockMailService.sendPasswordReset.mock.calls[0];
      expect(toEmail).toBe('a@b.com');
      expect(toName).toBe('Ana');
      expect(resetUrl).toMatch(
        /^http:\/\/localhost:5173\/reset-password\/[a-f0-9]{64}$/,
      );

      // The plaintext token in the URL must NOT equal the hash stored in DB.
      const tokenInUrl = resetUrl.split('/').pop()!;
      expect(tokenInUrl).not.toBe(saved.tokenHash);
    });
  });
```

- [ ] **Step 3: Rodar testes — devem falhar**

Run: `source ~/.nvm/nvm.sh && nvm use 20 > /dev/null && pnpm --filter backend test -- auth.service.spec.ts -t "requestPasswordReset"`
Expected: FAIL — `service.requestPasswordReset is not a function`.

- [ ] **Step 4: Implementar `requestPasswordReset` no service**

Em `apps/backend/src/modules/core/auth/auth.service.ts`, adicionar como método público (antes do bloco `private async generateTokens(...)` ou após os métodos `login`/`refresh`/`changePassword` — manter ordem natural, perto de `changePassword`):

```typescript
  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.userRepo.findOne({ where: { email } });
    if (!user) {
      // Anti-enumeration: silent no-op when the email is not registered.
      return;
    }

    // Invalidate previous active tokens for this user.
    await this.resetTokenRepo.update(
      { userId: user.id, usedAt: IsNull() },
      { usedAt: new Date() },
    );

    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await this.resetTokenRepo.save({
      userId: user.id,
      tokenHash,
      expiresAt,
      usedAt: null,
    });

    const baseUrl = this.config.get<string>('APP_BASE_URL') ?? 'http://localhost:5173';
    const resetUrl = `${baseUrl}/reset-password/${token}`;

    await this.mail.sendPasswordReset(user.email, user.name, resetUrl);
  }
```

Adicionar `IsNull` ao import do `typeorm` no topo do arquivo:

```typescript
import { DataSource, IsNull, Repository } from 'typeorm';
```

(O teste já foi escrito com `IsNull()` no Step 2 acima, então nada a mudar nele.)

- [ ] **Step 5: Rodar testes — devem passar**

Run: `source ~/.nvm/nvm.sh && nvm use 20 > /dev/null && pnpm --filter backend test -- auth.service.spec.ts -t "requestPasswordReset"`
Expected: PASS, 2/2.

- [ ] **Step 6: NÃO commitar ainda.**

---

### Task 6: AuthService.resetPassword + tests (transação)

**Files:**
- Modify: `apps/backend/src/modules/core/auth/auth.service.ts`
- Modify: `apps/backend/src/modules/core/auth/auth.service.spec.ts`

- [ ] **Step 1: Adicionar `BadRequestException` ao import do `@nestjs/common`**

Em `apps/backend/src/modules/core/auth/auth.service.ts`, atualizar o import:

```typescript
import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
```

- [ ] **Step 2: Escrever os testes ANTES da implementação**

Em `apps/backend/src/modules/core/auth/auth.service.spec.ts`, adicionar bloco novo abaixo de `describe('requestPasswordReset', ...)`:

```typescript
  describe('resetPassword', () => {
    function makeValidRecord(overrides: Partial<{ id: string; userId: string; expiresAt: Date; usedAt: Date | null }> = {}) {
      return {
        id: 'rt1',
        userId: 'u1',
        tokenHash: 'a'.repeat(64),
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        usedAt: null,
        ...overrides,
      };
    }

    it('updates password, marks token used, and deletes refresh tokens (in a transaction)', async () => {
      mockResetTokenRepo.findOne.mockResolvedValue(makeValidRecord());
      mockUserRepo.findOne.mockResolvedValue({ id: 'u1', email: 'a@b.com', name: 'Ana', passwordHash: 'old' });

      // Capture transaction callback
      const managerMock = {
        save: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
        delete: jest.fn().mockResolvedValue({}),
      };
      (mockDataSource.transaction as jest.Mock).mockImplementation(async (cb) => cb(managerMock));

      await service.resetPassword('plaintext-token-here', 'newStrongPass123');

      expect(managerMock.save).toHaveBeenCalled();
      expect(managerMock.update).toHaveBeenCalledWith(
        PasswordResetTokenEntity,
        'rt1',
        expect.objectContaining({ usedAt: expect.any(Date) }),
      );
      expect(managerMock.delete).toHaveBeenCalledWith(
        RefreshTokenEntity,
        { userId: 'u1' },
      );

      // Confirmation email is fire-and-forget; allow either call or skip.
      // We check it was at least invoked (not awaited).
      expect(mockMailService.sendPasswordChangedConfirmation).toHaveBeenCalledWith('a@b.com', 'Ana');
    });

    it('rejects when the token is unknown', async () => {
      mockResetTokenRepo.findOne.mockResolvedValue(null);

      await expect(service.resetPassword('bad', 'newStrongPass123')).rejects.toThrow(
        /inválido ou expirado/i,
      );
    });

    it('rejects when the token is already used', async () => {
      mockResetTokenRepo.findOne.mockResolvedValue(makeValidRecord({ usedAt: new Date() }));

      await expect(service.resetPassword('used', 'newStrongPass123')).rejects.toThrow(
        /inválido ou expirado/i,
      );
    });

    it('rejects when the token is expired', async () => {
      mockResetTokenRepo.findOne.mockResolvedValue(
        makeValidRecord({ expiresAt: new Date(Date.now() - 1000) }),
      );

      await expect(service.resetPassword('expired', 'newStrongPass123')).rejects.toThrow(
        /inválido ou expirado/i,
      );
    });
  });
```

E no topo do spec, adicionar imports:

```typescript
import { RefreshTokenEntity } from './refresh-token.entity';
```

(o `PasswordResetTokenEntity` já foi importado na Task 5.)

- [ ] **Step 3: Rodar testes — devem falhar**

Run: `source ~/.nvm/nvm.sh && nvm use 20 > /dev/null && pnpm --filter backend test -- auth.service.spec.ts -t "resetPassword"`
Expected: FAIL — `service.resetPassword is not a function`.

- [ ] **Step 4: Implementar `resetPassword`**

Em `apps/backend/src/modules/core/auth/auth.service.ts`, adicionar o método (próximo a `requestPasswordReset`):

```typescript
  async resetPassword(token: string, newPassword: string): Promise<void> {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const record = await this.resetTokenRepo.findOne({ where: { tokenHash } });

    const now = new Date();
    if (!record || record.usedAt !== null || record.expiresAt <= now) {
      throw new BadRequestException('Link inválido ou expirado.');
    }

    const user = await this.userRepo.findOne({ where: { id: record.userId } });
    if (!user) {
      throw new BadRequestException('Link inválido ou expirado.');
    }

    const newHash = await bcrypt.hash(newPassword, 10);

    await this.dataSource.transaction(async (manager) => {
      user.passwordHash = newHash;
      await manager.save(UserEntity, user);
      await manager.update(PasswordResetTokenEntity, record.id, { usedAt: new Date() });
      await manager.delete(RefreshTokenEntity, { userId: user.id });
    });

    // Fire-and-forget confirmation email (errors are logged inside MailService).
    void this.mail.sendPasswordChangedConfirmation(user.email, user.name);
  }
```

- [ ] **Step 5: Rodar todos os testes do auth — devem passar**

Run: `source ~/.nvm/nvm.sh && nvm use 20 > /dev/null && pnpm --filter backend test -- auth.service.spec.ts`
Expected: PASS, todos.

- [ ] **Step 6: NÃO commitar ainda.**

---

### Task 7: Endpoints no AuthController + commit backend

**Files:**
- Modify: `apps/backend/src/modules/core/auth/auth.controller.ts`

- [ ] **Step 1: Adicionar imports**

Em `apps/backend/src/modules/core/auth/auth.controller.ts`, adicionar aos imports:

```typescript
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
```

- [ ] **Step 2: Adicionar os 2 endpoints públicos**

Adicionar dentro da classe `AuthController`, após o método `refresh` (são endpoints públicos, não use `@UseGuards(JwtAuthGuard)`):

```typescript
  @Post('forgot-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async forgotPassword(@Body() dto: ForgotPasswordDto): Promise<void> {
    await this.authService.requestPasswordReset(dto.email);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async resetPassword(@Body() dto: ResetPasswordDto): Promise<void> {
    await this.authService.resetPassword(dto.token, dto.newPassword);
  }
```

- [ ] **Step 3: Verificações antes do commit**

Run typecheck:
```
source ~/.nvm/nvm.sh && nvm use 20 > /dev/null && pnpm --filter backend exec tsc --noEmit
```
Expected: zero errors.

Run suite completa do backend:
```
source ~/.nvm/nvm.sh && nvm use 20 > /dev/null && pnpm --filter backend test
```
Expected: todos passam (ao menos 248 + os novos: 2 mail tests + 6 auth tests = 256+).

- [ ] **Step 4: Commit backend completo (atômico)**

```bash
cd /home/vinicius/Projetos/vinicius/praktikus
git add apps/backend/src/modules/core/auth/password-reset-token.entity.ts \
        apps/backend/src/database/migrations/1747000000000-AddPasswordResetTokens.ts \
        apps/backend/src/modules/core/mail/ \
        apps/backend/src/modules/core/auth/dto/forgot-password.dto.ts \
        apps/backend/src/modules/core/auth/dto/reset-password.dto.ts \
        apps/backend/src/modules/core/auth/auth.module.ts \
        apps/backend/src/modules/core/auth/auth.service.ts \
        apps/backend/src/modules/core/auth/auth.service.spec.ts \
        apps/backend/src/modules/core/auth/auth.controller.ts \
        apps/backend/package.json apps/backend/pnpm-lock.yaml
git commit -m "feat(auth): password recovery via Resend (forgot/reset endpoints)"
```

(O `pnpm-lock.yaml` está na raiz — se foi atualizado lá, ajustar o `git add` para incluir `pnpm-lock.yaml` na raiz em vez do path acima.)

- [ ] **Step 5: NÃO rodar a migration ainda contra o banco — o usuário fará isso manualmente em ambiente apropriado.**

---

## Phase 2 — Frontend

### Task 8: authService.forgotPassword / resetPassword

**Files:**
- Modify: `apps/frontend/src/services/auth.service.ts`

- [ ] **Step 1: Adicionar os métodos**

Em `apps/frontend/src/services/auth.service.ts`, dentro do objeto `authService` (depois de `changePassword`):

```typescript
  async forgotPassword(email: string): Promise<void> {
    await api.post('/auth/forgot-password', { email });
  },

  async resetPassword(token: string, newPassword: string): Promise<void> {
    await api.post('/auth/reset-password', { token, newPassword });
  },
```

- [ ] **Step 2: Typecheck**

Run: `source ~/.nvm/nvm.sh && nvm use 20 > /dev/null && pnpm --filter frontend exec tsc --noEmit`
Expected: zero errors.

- [ ] **Step 3: NÃO commitar ainda — vai junto com Task 12.**

---

### Task 9: ForgotPasswordPage

**Files:**
- Create: `apps/frontend/src/pages/auth/ForgotPasswordPage.tsx`

- [ ] **Step 1: Criar a página**

Criar `apps/frontend/src/pages/auth/ForgotPasswordPage.tsx`:

```tsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  CAlert,
  CButton,
  CFormFeedback,
  CFormInput,
  CFormLabel,
  CSpinner,
} from '@coreui/react';
import { AuthShell } from '../../components/AuthShell';
import { authService } from '../../services/auth.service';

const schema = z.object({
  email: z.string().email('E-mail inválido'),
});

type FormData = z.infer<typeof schema>;

export function ForgotPasswordPage() {
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    setError(null);
    try {
      await authService.forgotPassword(data.email);
      setSubmitted(true);
    } catch {
      setError('Erro ao processar solicitação. Tente novamente.');
    }
  };

  if (submitted) {
    return (
      <AuthShell>
        <h1 style={{ margin: '0 0 6px', fontSize: 26, letterSpacing: '-0.02em', fontWeight: 600 }}>
          Confira seu e-mail
        </h1>
        <p style={{ margin: '0 0 28px', color: 'var(--cui-secondary-color)', lineHeight: 1.55 }}>
          Se essa conta existir, enviamos um link para recuperar sua senha. Verifique sua caixa de entrada e o spam.
        </p>
        <Link
          to="/login"
          style={{
            color: 'var(--cui-primary)',
            fontWeight: 500,
            textDecoration: 'none',
            fontSize: 13.5,
          }}
        >
          ← Voltar ao login
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <h1 style={{ margin: '0 0 6px', fontSize: 26, letterSpacing: '-0.02em', fontWeight: 600 }}>
        Recuperar senha
      </h1>
      <p style={{ margin: '0 0 28px', color: 'var(--cui-secondary-color)' }}>
        Informe seu e-mail e enviaremos um link para redefinir sua senha.
      </p>

      {error && <CAlert color="danger" className="mb-3">{error}</CAlert>}

      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
      >
        <div>
          <CFormLabel style={{ fontWeight: 500, fontSize: 13 }}>E-mail</CFormLabel>
          <CFormInput
            type="email"
            placeholder="voce@suaempresa.com.br"
            {...register('email')}
            invalid={!!errors.email}
            aria-label="E-mail"
          />
          {errors.email && <CFormFeedback invalid>{errors.email.message}</CFormFeedback>}
        </div>

        <CButton
          type="submit"
          color="primary"
          size="lg"
          style={{ width: '100%', marginTop: 4, borderRadius: 8 }}
          disabled={isSubmitting}
        >
          {isSubmitting ? <CSpinner size="sm" /> : 'Enviar link'}
        </CButton>
      </form>

      <p style={{ marginTop: 24, textAlign: 'center', fontSize: 13, color: 'var(--cui-secondary-color)' }}>
        Lembrou a senha?{' '}
        <Link to="/login" style={{ color: 'var(--cui-primary)', fontWeight: 500, textDecoration: 'none' }}>
          Voltar ao login
        </Link>
      </p>
    </AuthShell>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `source ~/.nvm/nvm.sh && nvm use 20 > /dev/null && pnpm --filter frontend exec tsc --noEmit`
Expected: zero errors.

- [ ] **Step 3: NÃO commitar ainda.**

---

### Task 10: ResetPasswordPage

**Files:**
- Create: `apps/frontend/src/pages/auth/ResetPasswordPage.tsx`

- [ ] **Step 1: Criar a página**

Criar `apps/frontend/src/pages/auth/ResetPasswordPage.tsx`:

```tsx
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  CAlert,
  CButton,
  CFormFeedback,
  CFormInput,
  CFormLabel,
  CSpinner,
} from '@coreui/react';
import { AuthShell } from '../../components/AuthShell';
import { authService } from '../../services/auth.service';

const schema = z
  .object({
    password: z.string().min(8, 'Senha deve ter no mínimo 8 caracteres'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Senhas não conferem',
    path: ['confirmPassword'],
  });

type FormData = z.infer<typeof schema>;

export function ResetPasswordPage() {
  const { token = '' } = useParams<{ token: string }>();
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    setError(null);
    try {
      await authService.resetPassword(token, data.password);
      setSuccess(true);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e?.response?.data?.message ?? 'Não foi possível redefinir a senha.');
    }
  };

  if (success) {
    return (
      <AuthShell>
        <h1 style={{ margin: '0 0 6px', fontSize: 26, letterSpacing: '-0.02em', fontWeight: 600 }}>
          Senha redefinida!
        </h1>
        <p style={{ margin: '0 0 28px', color: 'var(--cui-secondary-color)' }}>
          Você já pode entrar com a nova senha.
        </p>
        <Link
          to="/login"
          style={{
            display: 'inline-block',
            background: 'var(--cui-primary)',
            color: '#fff',
            padding: '10px 18px',
            borderRadius: 8,
            textDecoration: 'none',
            fontWeight: 600,
            fontSize: 14,
          }}
        >
          Ir para login
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <h1 style={{ margin: '0 0 6px', fontSize: 26, letterSpacing: '-0.02em', fontWeight: 600 }}>
        Definir nova senha
      </h1>
      <p style={{ margin: '0 0 28px', color: 'var(--cui-secondary-color)' }}>
        Escolha uma senha forte com pelo menos 8 caracteres.
      </p>

      {error && (
        <CAlert color="danger" className="mb-3">
          {error}
          {error.toLowerCase().includes('inválido') && (
            <>
              {' '}
              <Link
                to="/forgot-password"
                style={{ color: 'var(--cui-primary)', fontWeight: 600 }}
              >
                Pedir novo link
              </Link>
              .
            </>
          )}
        </CAlert>
      )}

      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
      >
        <div>
          <CFormLabel style={{ fontWeight: 500, fontSize: 13 }}>Nova senha</CFormLabel>
          <CFormInput
            type="password"
            placeholder="••••••••"
            {...register('password')}
            invalid={!!errors.password}
            aria-label="Nova senha"
          />
          {errors.password && <CFormFeedback invalid>{errors.password.message}</CFormFeedback>}
        </div>

        <div>
          <CFormLabel style={{ fontWeight: 500, fontSize: 13 }}>Confirmar senha</CFormLabel>
          <CFormInput
            type="password"
            placeholder="••••••••"
            {...register('confirmPassword')}
            invalid={!!errors.confirmPassword}
            aria-label="Confirmar senha"
          />
          {errors.confirmPassword && (
            <CFormFeedback invalid>{errors.confirmPassword.message}</CFormFeedback>
          )}
        </div>

        <CButton
          type="submit"
          color="primary"
          size="lg"
          style={{ width: '100%', marginTop: 4, borderRadius: 8 }}
          disabled={isSubmitting}
        >
          {isSubmitting ? <CSpinner size="sm" /> : 'Redefinir senha'}
        </CButton>
      </form>
    </AuthShell>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `source ~/.nvm/nvm.sh && nvm use 20 > /dev/null && pnpm --filter frontend exec tsc --noEmit`
Expected: zero errors.

- [ ] **Step 3: NÃO commitar ainda.**

---

### Task 11: LoginPage cleanup (remove "Lembrar de mim", conecta link)

**Files:**
- Modify: `apps/frontend/src/pages/auth/LoginPage.tsx`

- [ ] **Step 1: Substituir o bloco do checkbox + link**

Localizar em `apps/frontend/src/pages/auth/LoginPage.tsx` o bloco entre as linhas que começam com `<div style={{ display: 'flex', justifyContent: 'space-between', ... }}>` e termina logo após o `<a href="#" ...>Esqueci a senha</a></div>`.

Substituir o bloco completo:

```tsx
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: 2,
          }}
        >
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 13,
              color: 'var(--cui-secondary-color)',
              cursor: 'pointer',
            }}
          >
            <input type="checkbox" /> Lembrar de mim
          </label>
          <a
            href="#"
            style={{
              fontSize: 13,
              color: 'var(--cui-primary)',
              textDecoration: 'none',
              fontWeight: 500,
            }}
          >
            Esqueci a senha
          </a>
        </div>
```

por:

```tsx
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 2 }}>
          <Link
            to="/forgot-password"
            style={{
              fontSize: 13,
              color: 'var(--cui-primary)',
              textDecoration: 'none',
              fontWeight: 500,
            }}
          >
            Esqueci a senha
          </Link>
        </div>
```

(O `Link` de `react-router-dom` já está importado neste arquivo — usado no rodapé "Comece grátis".)

- [ ] **Step 2: Typecheck**

Run: `source ~/.nvm/nvm.sh && nvm use 20 > /dev/null && pnpm --filter frontend exec tsc --noEmit`
Expected: zero errors.

- [ ] **Step 3: Verificar se o teste de LoginPage continua passando** (existe `LoginPage.test.tsx`)

Run: `source ~/.nvm/nvm.sh && nvm use 20 > /dev/null && pnpm --filter frontend test -- LoginPage.test.tsx`
Expected: mesma quantidade de testes passando que antes (a falha pré-existente "navigates to dashboard after successful login" pode continuar; outros testes devem permanecer verdes).

- [ ] **Step 4: NÃO commitar ainda.**

---

### Task 12: App.tsx routes + commit frontend

**Files:**
- Modify: `apps/frontend/src/App.tsx`

- [ ] **Step 1: Adicionar imports**

Em `apps/frontend/src/App.tsx`, perto dos demais imports de `pages/auth/`, adicionar:

```tsx
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage';
```

- [ ] **Step 2: Adicionar as rotas públicas**

Localizar a linha `<Route path="/register/recycling" element={<RegisterRecyclingPage />} />` (ou outra rota pública próxima) e adicionar duas rotas logo abaixo:

```tsx
<Route path="/forgot-password" element={<ForgotPasswordPage />} />
<Route path="/reset-password/:token" element={<ResetPasswordPage />} />
```

- [ ] **Step 3: Build full**

Run: `source ~/.nvm/nvm.sh && nvm use 20 > /dev/null && pnpm --filter frontend build`
Expected: `✓ built in ...`. Sem erros TS.

- [ ] **Step 4: Tests**

Run: `source ~/.nvm/nvm.sh && nvm use 20 > /dev/null && pnpm --filter frontend test`
Expected: mesmo baseline (78/80 atual ou melhor; sem novas falhas introduzidas).

- [ ] **Step 5: Commit frontend completo (atômico)**

```bash
cd /home/vinicius/Projetos/vinicius/praktikus
git add apps/frontend/src/services/auth.service.ts \
        apps/frontend/src/pages/auth/ForgotPasswordPage.tsx \
        apps/frontend/src/pages/auth/ResetPasswordPage.tsx \
        apps/frontend/src/pages/auth/LoginPage.tsx \
        apps/frontend/src/App.tsx
git commit -m "feat(auth): forgot/reset password pages, drop 'lembrar de mim' from login"
```

---

## Phase 3 — Validação final

### Task 13: Smoke test manual

**Files:** (apenas execução)

- [ ] **Step 1: Subir backend + frontend localmente**

Backend (sem `RESEND_API_KEY` para forçar modo dev):
```
cd /home/vinicius/Projetos/vinicius/praktikus
docker-compose up -d  # garante Postgres
source ~/.nvm/nvm.sh && nvm use 20 > /dev/null
pnpm --filter backend migration:run
pnpm --filter backend dev
```

Frontend (em outro terminal):
```
source ~/.nvm/nvm.sh && nvm use 20 > /dev/null
pnpm --filter frontend dev
```

- [ ] **Step 2: Smoke do fluxo completo**

Abrir `http://localhost:5173/login`:
- Confirmar que o checkbox "Lembrar de mim" SUMIU.
- Clicar em "Esqueci a senha" → deve navegar para `/forgot-password`.

Em `/forgot-password`:
- Submeter um email **inexistente** (ex.: `nope@example.com`) → deve mostrar a tela "Confira seu e-mail" mesmo assim (anti-enumeration).
- Voltar e submeter um email **existente** (de uma conta cadastrada) → tela de sucesso.
- No terminal do backend, deve aparecer um log tipo: `[mail dev] password reset for X@Y.com: http://localhost:5173/reset-password/<token-hex-64-chars>`.

Copiar a URL do log e abrir no browser:
- `/reset-password/<token>` carrega a página com inputs de senha.
- Submeter senha < 8 chars → erro de validação.
- Submeter senha confirmação diferente → "Senhas não conferem".
- Submeter senhas válidas → tela "Senha redefinida!" + botão "Ir para login".

Login com a senha **antiga** → deve falhar (`Senha incorreta`).
Login com a senha **nova** → deve entrar normalmente.

Tentar usar a mesma URL de reset uma segunda vez → erro "Link inválido ou expirado." + botão "Pedir novo link".

- [ ] **Step 3: Lint final**

Run: `pnpm lint` (no root)
Expected: sem novos erros nos arquivos tocados (warnings pré-existentes em outros arquivos podem permanecer).

- [ ] **Step 4: Push (opcional)**

```bash
git push origin redesign/praktikus-v2
```

---

## Resumo de commits

1. `feat(auth): password recovery via Resend (forgot/reset endpoints)` — backend completo (entity + migration + mail + DTOs + service + controller + tests)
2. `feat(auth): forgot/reset password pages, drop 'lembrar de mim' from login` — frontend completo

---

## Pendências operacionais (fora do código)

- Em produção, configurar `RESEND_API_KEY`, `MAIL_FROM` (com domínio próprio verificado) e `APP_BASE_URL` nas variáveis de ambiente do backend.
- DNS: SPF + DKIM no domínio do `MAIL_FROM` para entregabilidade (configuração no provedor de DNS, fora do escopo de código).
- Migration `1747000000000-AddPasswordResetTokens` precisa rodar em cada ambiente (`pnpm --filter backend migration:run`).
