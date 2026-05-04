import { Test } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PlatformJwtStrategy, PlatformJwtPayload } from './platform-jwt.strategy';
import { PlatformUserEntity } from './platform-user.entity';

describe('PlatformJwtStrategy', () => {
  let strategy: PlatformJwtStrategy;
  let userRepo: { findOne: jest.Mock };

  beforeEach(async () => {
    userRepo = { findOne: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        PlatformJwtStrategy,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((k: string) =>
              k === 'PLATFORM_JWT_SECRET' ? 'test-secret' : undefined,
            ),
          },
        },
        {
          provide: getRepositoryToken(PlatformUserEntity),
          useValue: userRepo,
        },
      ],
    }).compile();

    strategy = module.get(PlatformJwtStrategy);
  });

  const basePayload: PlatformJwtPayload = {
    sub: 'user-uuid',
    email: 'admin@praktikus.com.br',
    name: 'Admin',
    is_platform_user: true,
  };

  it('retorna PlatformAuthUser quando payload e usuário são válidos', async () => {
    const entity = {
      id: 'user-uuid',
      email: 'admin@praktikus.com.br',
      name: 'Admin',
      role: 'OWNER',
    } as PlatformUserEntity;
    userRepo.findOne.mockResolvedValue(entity);

    const result = await strategy.validate(basePayload);

    expect(result).toEqual({
      userId: 'user-uuid',
      email: 'admin@praktikus.com.br',
      name: 'Admin',
      role: 'OWNER',
    });
  });

  it('lança UnauthorizedException quando is_platform_user não é true', async () => {
    const payload = { ...basePayload, is_platform_user: false } as unknown as PlatformJwtPayload;
    await expect(strategy.validate(payload)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(userRepo.findOne).not.toHaveBeenCalled();
  });

  it('lança UnauthorizedException quando usuário não existe no banco', async () => {
    userRepo.findOne.mockResolvedValue(null);
    await expect(strategy.validate(basePayload)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
