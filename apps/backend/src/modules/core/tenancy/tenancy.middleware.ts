import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

export interface TenantRequest extends Request {
  tenantId?: string;
  tenantSchemaName?: string;
}

@Injectable()
export class TenancyMiddleware implements NestMiddleware {
  use(req: TenantRequest, _res: Response, next: NextFunction): void {
    const authHeader = req.headers.authorization;

    if (authHeader?.startsWith('Bearer ')) {
      try {
        const token = authHeader.slice(7);
        const parts = token.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(
            Buffer.from(parts[1], 'base64url').toString('utf8'),
          );
          if (payload.tenant_id) {
            req.tenantId = payload.tenant_id;
            req.tenantSchemaName = `tenant_${(payload.tenant_id as string).replace(/-/g, '')}`;
          }
        }
      } catch {
        // Invalid token — JWT Guard will reject it at the controller level
      }
    }

    next();
  }
}
