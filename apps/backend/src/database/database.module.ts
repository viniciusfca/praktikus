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
import { BuyerEntity } from '../modules/recycling/buyers/buyer.entity';
import { CashSessionEntity } from '../modules/recycling/cash-register/cash-session.entity';
import { CashTransactionEntity } from '../modules/recycling/cash-register/cash-transaction.entity';
import { EmployeePermissionsEntity } from '../modules/recycling/employees/employee-permissions.entity';
import { ProductEntity } from '../modules/recycling/products/product.entity';
import { PurchaseEntity } from '../modules/recycling/purchases/purchase.entity';
import { PurchaseItemEntity } from '../modules/recycling/purchases/purchase-item.entity';
import { StockMovementEntity } from '../modules/recycling/purchases/stock-movement.entity';
import { SaleEntity } from '../modules/recycling/sales/sale.entity';
import { SaleItemEntity } from '../modules/recycling/sales/sale-item.entity';
import { SupplierEntity } from '../modules/recycling/suppliers/supplier.entity';
import { UnitEntity } from '../modules/recycling/units/unit.entity';

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
        entities: [TenantEntity, UserEntity, RefreshTokenEntity, BillingEntity, CustomerEntity, VehicleEntity, CatalogServiceEntity, CatalogPartEntity, AppointmentEntity, AppointmentCommentEntity, ServiceOrderEntity, SoItemServiceEntity, SoItemPartEntity, BuyerEntity, CashSessionEntity, CashTransactionEntity, EmployeePermissionsEntity, ProductEntity, PurchaseEntity, PurchaseItemEntity, StockMovementEntity, SaleEntity, SaleItemEntity, SupplierEntity, UnitEntity],
        synchronize: false,
        logging: config.get('NODE_ENV') === 'development',
        migrations: [__dirname + '/migrations/*.{ts,js}'],
        migrationsRun: true,
      }),
    }),
  ],
})
export class DatabaseModule {}
