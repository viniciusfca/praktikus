import { Module } from '@nestjs/common';
import { EmployeesModule } from './employees/employees.module';
import { UnitsModule } from './units/units.module';
import { ProductsModule } from './products/products.module';
import { SuppliersModule } from './suppliers/suppliers.module';

@Module({
  imports: [EmployeesModule, UnitsModule, ProductsModule, SuppliersModule],
})
export class RecyclingModule {}
