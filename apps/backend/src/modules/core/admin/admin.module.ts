import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { PlatformUserEntity } from './admin-auth/platform-user.entity';
import { PlatformRefreshTokenEntity } from './admin-auth/platform-refresh-token.entity';
import { PlatformAuthService } from './admin-auth/platform-auth.service';
import { PlatformAuthController } from './admin-auth/platform-auth.controller';
import { PlatformJwtStrategy } from './admin-auth/platform-jwt.strategy';
import { TenantEntity } from '../tenancy/tenant.entity';
import { BillingEntity } from '../billing/billing.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PlatformUserEntity,
      PlatformRefreshTokenEntity,
      TenantEntity,
      BillingEntity,
    ]),
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('PLATFORM_JWT_SECRET'),
        signOptions: {
          expiresIn: config.get('PLATFORM_JWT_EXPIRES_IN', '8h'),
        },
      }),
    }),
    ThrottlerModule.forRoot([
      { name: 'default', ttl: 15 * 60 * 1000, limit: 1000 },
    ]),
  ],
  controllers: [PlatformAuthController],
  providers: [
    PlatformAuthService,
    PlatformJwtStrategy,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
  exports: [PlatformAuthService],
})
export class AdminModule {}
