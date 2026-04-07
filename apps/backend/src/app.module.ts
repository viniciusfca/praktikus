import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { HealthController } from './health/health.controller';
import { DatabaseModule } from './database/database.module';
import { TenancyModule } from './modules/core/tenancy/tenancy.module';
import { TenancyMiddleware } from './modules/core/tenancy/tenancy.middleware';
import { AuthModule } from './modules/core/auth/auth.module';
import { TenantStatusGuard } from './modules/core/auth/tenant-status.guard';
import { CompaniesModule } from './modules/workshop/companies/companies.module';
import { CustomersModule } from './modules/workshop/customers/customers.module';
import { VehiclesModule } from './modules/workshop/vehicles/vehicles.module';
import { CatalogModule } from './modules/workshop/catalog/catalog.module';
import { AppointmentsModule } from './modules/workshop/appointments/appointments.module';
import { ServiceOrdersModule } from './modules/workshop/service-orders/service-orders.module';
import { ReportsModule } from './modules/workshop/reports/reports.module';
import { BillingModule } from './modules/core/billing/billing.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    DatabaseModule,
    TenancyModule,
    AuthModule,
    BillingModule,
    CompaniesModule,
    CustomersModule,
    VehiclesModule,
    CatalogModule,
    AppointmentsModule,
    ServiceOrdersModule,
    ReportsModule,
  ],
  controllers: [HealthController],
  providers: [
    // Global guard — runs before per-route guards (JwtAuthGuard, RolesGuard).
    // Safely short-circuits when req.user is undefined (unauthenticated routes).
    // Guard chain: TenantStatusGuard (global) → JwtAuthGuard → RolesGuard (per route).
    { provide: APP_GUARD, useClass: TenantStatusGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(TenancyMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
