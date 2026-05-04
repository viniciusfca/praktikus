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
