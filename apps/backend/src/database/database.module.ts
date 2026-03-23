import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TenantEntity } from '../modules/core/tenancy/tenant.entity';
import { UserEntity } from '../modules/core/auth/user.entity';
import { RefreshTokenEntity } from '../modules/core/auth/refresh-token.entity';
import { BillingEntity } from '../modules/core/billing/billing.entity';
import { CustomerEntity } from '../modules/workshop/customers/customer.entity';
import { VehicleEntity } from '../modules/workshop/vehicles/vehicle.entity';
import { CatalogServiceEntity } from '../modules/workshop/catalog/catalog-service.entity';
import { CatalogPartEntity } from '../modules/workshop/catalog/catalog-part.entity';
import { AppointmentEntity } from '../modules/workshop/appointments/appointment.entity';
import { AppointmentCommentEntity } from '../modules/workshop/appointments/appointment-comment.entity';
import { ServiceOrderEntity } from '../modules/workshop/service-orders/service-order.entity';
import { SoItemServiceEntity } from '../modules/workshop/service-orders/so-item-service.entity';
import { SoItemPartEntity } from '../modules/workshop/service-orders/so-item-part.entity';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('DB_HOST'),
        port: config.get<number>('DB_PORT'),
        username: config.get<string>('DB_USER'),
        password: config.get<string>('DB_PASS'),
        database: config.get<string>('DB_NAME'),
        entities: [TenantEntity, UserEntity, RefreshTokenEntity, BillingEntity, CustomerEntity, VehicleEntity, CatalogServiceEntity, CatalogPartEntity, AppointmentEntity, AppointmentCommentEntity, ServiceOrderEntity, SoItemServiceEntity, SoItemPartEntity],
        synchronize: false,
        logging: config.get('NODE_ENV') === 'development',
        migrations: [__dirname + '/migrations/*.{ts,js}'],
        migrationsRun: true,
      }),
    }),
  ],
})
export class DatabaseModule {}
