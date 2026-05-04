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
