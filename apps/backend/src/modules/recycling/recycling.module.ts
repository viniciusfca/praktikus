import { Module } from '@nestjs/common';
import { EmployeesModule } from './employees/employees.module';
import { UnitsModule } from './units/units.module';
import { ProductsModule } from './products/products.module';
import { SuppliersModule } from './suppliers/suppliers.module';
import { CashRegisterModule } from './cash-register/cash-register.module';
import { PurchasesModule } from './purchases/purchases.module';

@Module({
  imports: [EmployeesModule, UnitsModule, ProductsModule, SuppliersModule, CashRegisterModule, PurchasesModule],
})
export class RecyclingModule {}
