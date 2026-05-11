import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Repository } from 'typeorm';
import { UserEntity } from './user.entity';
import { TenantStatus } from '../tenancy/tenant.entity';
import { TenantSegment } from '@praktikus/shared';

export interface JwtPayload {
  sub: string;
  tenant_id: string;
  role: string;
  name?: string;
  email?: string;
  tenant_status?: string;
  tenant_segment?: TenantSegment;
  whatsapp_enabled?: boolean;
  iat?: number;
  exp?: number;
}

export interface AuthUser {
  userId: string;
  tenantId: string;
  role: string;
  email: string;
  tenantStatus: TenantStatus;
  tenantSegment: TenantSegment;
  whatsappEnabled: boolean;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET')!,
    });
  }

  async validate(payload: JwtPayload): Promise<AuthUser> {
    // Defense in depth: platform JWTs must be rejected by the tenant strategy.
    if ((payload as any).is_platform_user === true) {
      throw new UnauthorizedException();
    }
    if (!payload.tenant_id) {
      throw new UnauthorizedException();
    }

    const user = await this.userRepo.findOne({ where: { id: payload.sub } });
    if (!user) {
      throw new UnauthorizedException();
    }
    return {
      userId: payload.sub,
      tenantId: payload.tenant_id,
      role: payload.role,
      email: user.email,
      tenantStatus:
        (payload.tenant_status as TenantStatus) ?? TenantStatus.ACTIVE,
      tenantSegment: payload.tenant_segment ?? TenantSegment.WORKSHOP,
      whatsappEnabled: payload.whatsapp_enabled ?? false,
    };
  }
}
