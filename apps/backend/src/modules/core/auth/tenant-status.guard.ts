import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { TenantStatus } from '../tenancy/tenant.entity';

const ALLOWED_PREFIXES = ['/billing', '/auth'];

@Injectable()
export class TenantStatusGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const url: string = request.url ?? '';

    if (!user) return true; // rota pública — deixar outros guards agirem

    // Allow SUSPENDED tenants to access /billing and /auth endpoints
    if (ALLOWED_PREFIXES.some((p) => url.startsWith(p))) return true;

    if (user.tenantStatus === TenantStatus.SUSPENDED) {
      throw new ForbiddenException('conta_suspensa');
    }

    return true;
  }
}
