import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, IsNull } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { UserEntity, UserRole } from './user.entity';
import { RefreshTokenEntity } from './refresh-token.entity';
import { PasswordResetTokenEntity } from './password-reset-token.entity';
import { MailService } from '../mail/mail.service';
import { TenancyService } from '../tenancy/tenancy.service';
import { BillingService } from '../billing/billing.service';
import { TenantStatus } from '../tenancy/tenant.entity';

const mockUserRepo = {
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  update: jest.fn(),
};

const mockRefreshTokenRepo = {
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
};

const mockTenancyService = {
  createTenant: jest.fn(),
  createTenantWithManager: jest.fn().mockResolvedValue({ id: 'tenant-1', schemaName: 'tenant_1', status: TenantStatus.TRIAL }),
  findByCnpj: jest.fn(),
  findById: jest.fn(),
};

const mockDataSource = {
  transaction: jest.fn().mockImplementation(async (cb: (manager: any) => any) => {
    const mockManager = {
      create: jest.fn((_entity: any, data: any) => data),
      save: jest.fn().mockResolvedValue({ id: 'user-1', tenantId: 'tenant-1', role: UserRole.OWNER }),
    };
    return cb(mockManager);
  }),
};

const mockBillingService = {
  setupTrial: jest.fn(),
};

const mockJwtService = {
  sign: jest.fn().mockReturnValue('mock_access_token'),
};

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

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(UserEntity), useValue: mockUserRepo },
        { provide: getRepositoryToken(RefreshTokenEntity), useValue: mockRefreshTokenRepo },
        { provide: getRepositoryToken(PasswordResetTokenEntity), useValue: mockResetTokenRepo },
        { provide: TenancyService, useValue: mockTenancyService },
        { provide: BillingService, useValue: mockBillingService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: MailService, useValue: mockMailService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  describe('register', () => {
    const dto = {
      cnpj: '11222333000181',
      razaoSocial: 'Auto Center Ltda',
      nomeFantasia: 'Auto Center',
      email: 'owner@autocenter.com',
      password: 'senha1234',
      ownerName: 'João Silva',
    };

    it('should create tenant + user and return tokens', async () => {
      mockTenancyService.findByCnpj.mockResolvedValue(null);
      mockUserRepo.findOne.mockResolvedValue(null);

      mockRefreshTokenRepo.create.mockReturnValue({});
      mockRefreshTokenRepo.save.mockResolvedValue({});
      mockBillingService.setupTrial.mockResolvedValue(undefined);

      const result = await service.register(dto);

      expect(mockTenancyService.createTenantWithManager).toHaveBeenCalledWith(
        expect.objectContaining({ cnpj: dto.cnpj }),
        expect.any(Object),
      );
      expect(result).toHaveProperty('access_token');
      expect(result).toHaveProperty('refresh_token');
    });

    it('should throw ConflictException when CNPJ already registered', async () => {
      mockTenancyService.findByCnpj.mockResolvedValue({ id: 'existing-tenant' });
      await expect(service.register(dto)).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException when email already registered in same tenant scope', async () => {
      mockTenancyService.findByCnpj.mockResolvedValue(null);
      mockUserRepo.findOne.mockResolvedValue({ id: 'existing-user' });
      await expect(service.register(dto)).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    it('should return tokens on valid credentials', async () => {
      const user = {
        id: 'user-1',
        tenantId: 'tenant-1',
        role: UserRole.OWNER,
        email: 'owner@test.com',
        // bcrypt hash of 'senha1234'
        passwordHash: '$2b$10$somehashedpassword',
      };
      mockUserRepo.findOne.mockResolvedValue(user);
      mockRefreshTokenRepo.create.mockReturnValue({});
      mockRefreshTokenRepo.save.mockResolvedValue({});

      // Mock bcrypt.compare to return true
      jest.spyOn(require('bcrypt'), 'compare').mockResolvedValue(true as never);

      const result = await service.login({ email: 'owner@test.com', password: 'senha1234' });
      expect(result).toHaveProperty('access_token');
      expect(result).toHaveProperty('refresh_token');
    });

    it('should throw UnauthorizedException when user not found', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);
      await expect(
        service.login({ email: 'notfound@test.com', password: 'senha1234' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when password is wrong', async () => {
      mockUserRepo.findOne.mockResolvedValue({ id: 'u1', passwordHash: 'hash' });
      jest.spyOn(require('bcrypt'), 'compare').mockResolvedValue(false as never);
      await expect(
        service.login({ email: 'owner@test.com', password: 'wrongpass' }),
      ).rejects.toThrow(UnauthorizedException);
    });

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
      mockTenancyService.findById.mockResolvedValue({
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
  });

  describe('refresh', () => {
    it('should throw UnauthorizedException for invalid/expired refresh token', async () => {
      mockRefreshTokenRepo.findOne.mockResolvedValue(null);
      await expect(service.refresh('invalid_token')).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for expired token', async () => {
      const expiredDate = new Date(Date.now() - 1000);
      mockRefreshTokenRepo.findOne.mockResolvedValue({
        userId: 'u1',
        tokenHash: 'hash',
        revoked: false,
        expiresAt: expiredDate,
      });
      await expect(service.refresh('some_token')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('logout', () => {
    it('should revoke refresh token', async () => {
      mockRefreshTokenRepo.update.mockResolvedValue({ affected: 1 });
      await service.logout('some_refresh_token');
      expect(mockRefreshTokenRepo.update).toHaveBeenCalledWith(
        { tokenHash: expect.any(String) },
        { revoked: true },
      );
    });
  });

  describe('changePassword', () => {
    it('should update passwordHash when currentPassword is correct', async () => {
      const user = { id: 'u1', passwordHash: 'old_hash' };
      mockUserRepo.findOne.mockResolvedValue(user);
      jest.spyOn(require('bcrypt'), 'compare').mockResolvedValue(true as never);
      jest.spyOn(require('bcrypt'), 'hash').mockResolvedValue('new_hash' as never);
      mockUserRepo.save.mockResolvedValue({ ...user, passwordHash: 'new_hash' });

      await service.changePassword('u1', 'oldPass', 'newPass12');

      expect(mockUserRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ passwordHash: 'new_hash' }),
      );
    });

    it('should throw UnauthorizedException when currentPassword is wrong', async () => {
      mockUserRepo.findOne.mockResolvedValue({ id: 'u1', passwordHash: 'hash' });
      jest.spyOn(require('bcrypt'), 'compare').mockResolvedValue(false as never);

      await expect(service.changePassword('u1', 'wrong', 'newPass12')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when user not found', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);

      await expect(service.changePassword('u1', 'any', 'newPass12')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

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
});
