import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
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
        { provide: DataSource, useValue: mockDataSource },
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
});
