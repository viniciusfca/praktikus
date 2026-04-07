import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { TenantStatus } from '../tenancy/tenant.entity';

@Injectable()
export class TenantStatusGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) return true; // rota pública — deixar outros guards agirem

    if (user.tenantStatus === TenantStatus.SUSPENDED) {
      throw new ForbiddenException('conta_suspensa');
    }

    return true;
  }
}
