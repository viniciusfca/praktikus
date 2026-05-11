import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { TenantStatusGuard } from './tenant-status.guard';

function makeCtx(user: any): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user, url: '/' }) }),
  } as any;
}

function makeCtxWithUrl(user: any, url: string): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user, url }) }),
  } as any;
}

describe('TenantStatusGuard', () => {
  let guard: TenantStatusGuard;

  beforeEach(() => {
    guard = new TenantStatusGuard();
  });

  it('should allow ACTIVE tenants', () => {
    expect(guard.canActivate(makeCtx({ tenantStatus: 'ACTIVE' }))).toBe(true);
  });

  it('should allow TRIAL tenants', () => {
    expect(guard.canActivate(makeCtx({ tenantStatus: 'TRIAL' }))).toBe(true);
  });

  it('should allow OVERDUE tenants (warning only, not blocked)', () => {
    expect(guard.canActivate(makeCtx({ tenantStatus: 'OVERDUE' }))).toBe(true);
  });

  it('should throw ForbiddenException for SUSPENDED tenants', () => {
    expect(() =>
      guard.canActivate(makeCtx({ tenantStatus: 'SUSPENDED' })),
    ).toThrow(ForbiddenException);
  });

  it('should allow requests without user (unauthenticated routes)', () => {
    expect(guard.canActivate(makeCtx(undefined))).toBe(true);
  });

  it('lets SUSPENDED tenant access /billing endpoints', () => {
    expect(
      guard.canActivate(makeCtxWithUrl({ tenantStatus: 'SUSPENDED' }, '/billing')),
    ).toBe(true);
    expect(
      guard.canActivate(makeCtxWithUrl({ tenantStatus: 'SUSPENDED' }, '/billing/invoices/open')),
    ).toBe(true);
  });

  it('lets SUSPENDED tenant access /auth endpoints', () => {
    expect(
      guard.canActivate(makeCtxWithUrl({ tenantStatus: 'SUSPENDED' }, '/auth/refresh')),
    ).toBe(true);
  });

  it('blocks SUSPENDED tenant on other paths', () => {
    expect(() =>
      guard.canActivate(makeCtxWithUrl({ tenantStatus: 'SUSPENDED' }, '/orders')),
    ).toThrow(/conta_suspensa/);
  });
});
