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
      razaoSocial: 'Test Ltda',
      nomeFantasia: 'Test',
      email: 'a@b.com',
      password: 'pass1234',
      ownerName: 'Test User',
    };
    const result = await controller.register(dto as any);
    expect(mockAuthService.register).toHaveBeenCalledWith(dto);
    expect(result).toHaveProperty('access_token');
  });

  it('should call login and return tokens', async () => {
    const result = await controller.login({ email: 'a@b.com', password: 'pass1234' });
    expect(mockAuthService.login).toHaveBeenCalled();
    expect(result).toHaveProperty('access_token');
  });

  it('should call refresh with token and return new tokens', async () => {
    const result = await controller.refresh('refresh_tok');
    expect(mockAuthService.refresh).toHaveBeenCalledWith('refresh_tok');
    expect(result).toHaveProperty('access_token');
  });

  it('should call logout with refresh token', async () => {
    await controller.logout('refresh_tok');
    expect(mockAuthService.logout).toHaveBeenCalledWith('refresh_tok');
  });
});
