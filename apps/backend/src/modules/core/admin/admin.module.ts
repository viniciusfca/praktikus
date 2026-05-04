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
import { AdminOverviewController } from './admin-overview/admin-overview.controller';
import { AdminOverviewService } from './admin-overview/admin-overview.service';
import { AdminTenantsController } from './admin-tenants/admin-tenants.controller';
import { AdminTenantsService } from './admin-tenants/admin-tenants.service';
import { AdminSegmentsController } from './admin-segments/admin-segments.controller';
import { AdminSegmentsService } from './admin-segments/admin-segments.service';
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
  controllers: [PlatformAuthController, AdminOverviewController, AdminTenantsController, AdminSegmentsController],
  providers: [
    PlatformAuthService,
    PlatformJwtStrategy,
    AdminOverviewService,
    AdminTenantsService,
    AdminSegmentsService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
  exports: [PlatformAuthService],
})
export class AdminModule {}
