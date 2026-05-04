import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { AuthUser } from '../auth/jwt.strategy';

@Injectable()
export class WhatsappEnabledGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthUser | undefined;

    if (!user) {
      return true;
    }

    if (!user.whatsappEnabled) {
      throw new ForbiddenException('whatsapp_not_enabled');
    }

    return true;
  }
}
