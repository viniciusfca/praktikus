import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtStrategy } from './jwt.strategy';
import { UserEntity, UserRole } from './user.entity';

const mockUserRepo = {
  findOne: jest.fn(),
};

const mockConfigService = {
  get: jest.fn().mockReturnValue('test_secret_at_least_32_chars_long'),
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
    it('should return AuthUser when user exists', async () => {
      const user: Partial<UserEntity> = {
        id: 'user-uuid-1',
        tenantId: 'tenant-uuid-1',
        role: UserRole.OWNER,
        email: 'owner@test.com',
        name: 'Test Owner',
      };
      mockUserRepo.findOne.mockResolvedValue(user);

      const payload = { sub: 'user-uuid-1', tenant_id: 'tenant-uuid-1', role: 'OWNER' };
      const result = await strategy.validate(payload);

      expect(result).toEqual({
        userId: 'user-uuid-1',
        tenantId: 'tenant-uuid-1',
        role: 'OWNER',
        email: 'owner@test.com',
        tenantStatus: 'ACTIVE',
      });
      expect(mockUserRepo.findOne).toHaveBeenCalledWith({ where: { id: 'user-uuid-1' } });
    });

    it('should throw UnauthorizedException when user does not exist', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);

      const payload = { sub: 'nonexistent', tenant_id: 'tenant-1', role: 'OWNER' };
      await expect(strategy.validate(payload)).rejects.toThrow(UnauthorizedException);
    });

    it('should work for EMPLOYEE role', async () => {
      const user: Partial<UserEntity> = {
        id: 'emp-1',
        tenantId: 'tenant-1',
        role: UserRole.EMPLOYEE,
        email: 'emp@test.com',
        name: 'Employee',
      };
      mockUserRepo.findOne.mockResolvedValue(user);

      const payload = { sub: 'emp-1', tenant_id: 'tenant-1', role: 'EMPLOYEE' };
      const result = await strategy.validate(payload);

      expect(result.role).toBe('EMPLOYEE');
    });
  });
});
