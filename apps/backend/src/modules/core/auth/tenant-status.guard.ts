import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { TenantStatus } from '../tenancy/tenant.entity';

// URLs que tenants SUSPENDED ainda podem acessar (com o prefixo global /api).
const ALLOWED_PREFIXES = ['/api/billing', '/api/auth'];

interface JwtPayload {
  tenant_status?: string;
  // outros campos do payload são ignorados aqui
}

@Injectable()
export class TenantStatusGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const url: string = request.url ?? '';

    // Rotas whitelistadas (billing/auth) passam direto — SUSPENDED precisa pagar.
    if (ALLOWED_PREFIXES.some((p) => url.startsWith(p))) return true;

    // Sem Authorization header → deixar JwtAuthGuard rejeitar com 401 apropriado.
    const authHeader = request.headers?.authorization;
    if (!authHeader?.startsWith('Bearer ')) return true;
    const token = authHeader.slice(7);

    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify<JwtPayload>(token, {
        secret: this.config.get<string>('JWT_SECRET'),
      });
    } catch {
      // Token inválido/expirado: JwtAuthGuard lida com isso (401).
      return true;
    }

    if (payload.tenant_status === TenantStatus.SUSPENDED) {
      throw new ForbiddenException('conta_suspensa');
    }
    return true;
  }
}
