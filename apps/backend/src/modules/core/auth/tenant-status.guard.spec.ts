import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { TenantStatusGuard } from './tenant-status.guard';

function makeCtx(
  url: string,
  headers: Record<string, string> = {},
): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ url, headers }),
    }),
  } as any;
}

function bearer(token = 'fake.token.here'): Record<string, string> {
  return { authorization: `Bearer ${token}` };
}

describe('TenantStatusGuard', () => {
  let guard: TenantStatusGuard;
  const mockJwtService = { verify: jest.fn() };
  const mockConfig = { get: jest.fn().mockReturnValue('test-secret') };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantStatusGuard,
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();
    guard = module.get(TenantStatusGuard);
    jest.clearAllMocks();
  });

  it('throws ForbiddenException for SUSPENDED token on non-whitelisted URL', () => {
    mockJwtService.verify.mockReturnValue({ tenant_status: 'SUSPENDED' });
    expect(() => guard.canActivate(makeCtx('/api/orders', bearer()))).toThrow(
      ForbiddenException,
    );
    expect(() => guard.canActivate(makeCtx('/api/orders', bearer()))).toThrow(
      /conta_suspensa/,
    );
  });

  it('lets SUSPENDED tenant access /api/billing endpoints', () => {
    mockJwtService.verify.mockReturnValue({ tenant_status: 'SUSPENDED' });
    expect(guard.canActivate(makeCtx('/api/billing', bearer()))).toBe(true);
  });

  it('lets SUSPENDED tenant access /api/billing/invoices/open', () => {
    mockJwtService.verify.mockReturnValue({ tenant_status: 'SUSPENDED' });
    expect(
      guard.canActivate(makeCtx('/api/billing/invoices/open', bearer())),
    ).toBe(true);
  });

  it('lets SUSPENDED tenant access /api/auth/refresh', () => {
    mockJwtService.verify.mockReturnValue({ tenant_status: 'SUSPENDED' });
    expect(guard.canActivate(makeCtx('/api/auth/refresh', bearer()))).toBe(
      true,
    );
  });

  it('blocks SUSPENDED tenant on /api/orders', () => {
    mockJwtService.verify.mockReturnValueOnce({ tenant_status: 'SUSPENDED' });
    expect(() => guard.canActivate(makeCtx('/api/orders', bearer()))).toThrow(
      ForbiddenException,
    );
  });

  it('allows ACTIVE tenant on /api/orders', () => {
    mockJwtService.verify.mockReturnValueOnce({ tenant_status: 'ACTIVE' });
    expect(guard.canActivate(makeCtx('/api/orders', bearer()))).toBe(true);
  });

  it('allows TRIAL tenant on /api/orders', () => {
    mockJwtService.verify.mockReturnValueOnce({ tenant_status: 'TRIAL' });
    expect(guard.canActivate(makeCtx('/api/orders', bearer()))).toBe(true);
  });

  it('allows OVERDUE tenant on /api/orders (warning only, not blocked)', () => {
    mockJwtService.verify.mockReturnValueOnce({ tenant_status: 'OVERDUE' });
    expect(guard.canActivate(makeCtx('/api/orders', bearer()))).toBe(true);
  });

  it('allows request without Authorization header (downstream handles auth)', () => {
    expect(guard.canActivate(makeCtx('/api/orders'))).toBe(true);
    expect(mockJwtService.verify).not.toHaveBeenCalled();
  });

  it('allows request when JWT verification fails (downstream handles 401)', () => {
    mockJwtService.verify.mockImplementationOnce(() => {
      throw new Error('invalid token');
    });
    expect(guard.canActivate(makeCtx('/api/orders', bearer('bad')))).toBe(
      true,
    );
  });

  it('allows whitelisted URL without verifying the token at all', () => {
    expect(guard.canActivate(makeCtx('/api/billing', bearer()))).toBe(true);
    expect(mockJwtService.verify).not.toHaveBeenCalled();
  });

  it('allows whitelisted URL with no auth header', () => {
    expect(guard.canActivate(makeCtx('/api/auth/login'))).toBe(true);
  });
});
