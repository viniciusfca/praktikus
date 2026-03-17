import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './health/health.controller';
import { DatabaseModule } from './database/database.module';
import { TenancyModule } from './modules/core/tenancy/tenancy.module';
import { TenancyMiddleware } from './modules/core/tenancy/tenancy.middleware';
import { AuthModule } from './modules/core/auth/auth.module';
import { CompaniesModule } from './modules/workshop/companies/companies.module';
import { CustomersModule } from './modules/workshop/customers/customers.module';
import { VehiclesModule } from './modules/workshop/vehicles/vehicles.module';
import { CatalogModule } from './modules/workshop/catalog/catalog.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    DatabaseModule,
    TenancyModule,
    AuthModule,
    CompaniesModule,
    CustomersModule,
    VehiclesModule,
    CatalogModule,
  ],
  controllers: [HealthController],
  providers: [],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(TenancyMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
