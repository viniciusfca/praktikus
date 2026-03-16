import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { UserRole } from './user.entity';
import { ROLES_KEY } from './roles.decorator';

const makeContext = (userRole: string | undefined, handlerRoles: UserRole[] | undefined) => ({
  switchToHttp: () => ({
    getRequest: () => ({ user: userRole ? { role: userRole } : undefined }),
  }),
  getHandler: () => ({}),
  getClass: () => ({}),
});

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RolesGuard, Reflector],
    }).compile();

    guard = module.get<RolesGuard>(RolesGuard);
    reflector = module.get<Reflector>(Reflector);
    jest.clearAllMocks();
  });

  it('should allow access when no roles are required', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    const ctx = makeContext('OWNER', undefined) as any;
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should allow OWNER when OWNER role is required', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.OWNER]);
    const ctx = makeContext('OWNER', [UserRole.OWNER]) as any;
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should throw ForbiddenException when EMPLOYEE tries to access OWNER-only route', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.OWNER]);
    const ctx = makeContext('EMPLOYEE', [UserRole.OWNER]) as any;
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('should allow EMPLOYEE when EMPLOYEE role is required', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.EMPLOYEE]);
    const ctx = makeContext('EMPLOYEE', [UserRole.EMPLOYEE]) as any;
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should allow when both roles are accepted and user has either one', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.OWNER, UserRole.EMPLOYEE]);
    const ctx = makeContext('EMPLOYEE', [UserRole.OWNER, UserRole.EMPLOYEE]) as any;
    expect(guard.canActivate(ctx)).toBe(true);
  });
});
