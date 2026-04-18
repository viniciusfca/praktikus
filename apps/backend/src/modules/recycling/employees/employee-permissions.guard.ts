import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../../core/auth/user.entity';
import { EmployeesService } from './employees.service';
import { EmployeePermissionsEntity } from './employee-permissions.entity';

export const PERMISSION_KEY = 'recycling_permission';
export const RequirePermission = (
  perm: keyof Omit<EmployeePermissionsEntity, 'userId' | 'updatedAt'>,
) => SetMetadata(PERMISSION_KEY, perm);

@Injectable()
export class EmployeePermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly employeesService: EmployeesService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const permKey = this.reflector.getAllAndOverride<string>(PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!permKey) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) return false;
    if (user.role === UserRole.OWNER) return true;

    try {
      const perms = await this.employeesService.getPermissions(user.tenantId, user.userId);
      return !!(perms as unknown as Record<string, unknown>)[permKey];
    } catch {
      throw new ForbiddenException('Sem permissão para esta ação.');
    }
  }
}
