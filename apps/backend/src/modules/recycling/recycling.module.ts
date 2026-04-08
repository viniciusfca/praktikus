import { Module } from '@nestjs/common';
import { EmployeesModule } from './employees/employees.module';
import { UnitsModule } from './units/units.module';
import { ProductsModule } from './products/products.module';

@Module({
  imports: [EmployeesModule, UnitsModule, ProductsModule],
})
export class RecyclingModule {}
