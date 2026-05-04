import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Repository } from 'typeorm';
import { PlatformUserEntity } from './platform-user.entity';

export interface PlatformJwtPayload {
  sub: string;
  email: string;
  name: string;
  is_platform_user: true;
  iat?: number;
  exp?: number;
}

export interface PlatformAuthUser {
  userId: string;
  email: string;
  name: string;
  role: string;
}

@Injectable()
export class PlatformJwtStrategy extends PassportStrategy(
  Strategy,
  'platform-jwt',
) {
  constructor(
    config: ConfigService,
    @InjectRepository(PlatformUserEntity)
    private readonly userRepo: Repository<PlatformUserEntity>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('PLATFORM_JWT_SECRET')!,
    });
  }

  async validate(payload: PlatformJwtPayload): Promise<PlatformAuthUser> {
    if (payload.is_platform_user !== true) {
      throw new UnauthorizedException();
    }
    const user = await this.userRepo.findOne({ where: { id: payload.sub } });
    if (!user) {
      throw new UnauthorizedException();
    }
    return {
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    };
  }
}
