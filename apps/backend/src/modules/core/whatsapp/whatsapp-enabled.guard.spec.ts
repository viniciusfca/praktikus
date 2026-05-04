import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { WhatsappEnabledGuard } from './whatsapp-enabled.guard';

function ctxMock(user: unknown): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as unknown as ExecutionContext;
}

describe('WhatsappEnabledGuard', () => {
  let guard: WhatsappEnabledGuard;

  beforeEach(() => {
    guard = new WhatsappEnabledGuard();
  });

  it('permits when user.whatsappEnabled is true', () => {
    const ctx = ctxMock({ tenantId: 't1', whatsappEnabled: true });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('throws ForbiddenException when whatsappEnabled is false', () => {
    const ctx = ctxMock({ tenantId: 't1', whatsappEnabled: false });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    expect(() => guard.canActivate(ctx)).toThrow('whatsapp_not_enabled');
  });

  it('throws ForbiddenException when whatsappEnabled is undefined', () => {
    const ctx = ctxMock({ tenantId: 't1' });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('returns true when user is undefined (public route — JwtStrategy not applied)', () => {
    const ctx = ctxMock(undefined);
    expect(guard.canActivate(ctx)).toBe(true);
  });
});
