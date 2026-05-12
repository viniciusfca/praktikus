import { Module } from '@nestjs/common';
import { PriceTablesController } from './price-tables.controller';
import { PriceTablesService } from './price-tables.service';
import { EmployeesModule } from '../employees/employees.module';

@Module({
  imports: [EmployeesModule],
  controllers: [PriceTablesController],
  providers: [PriceTablesService],
  exports: [PriceTablesService],
})
export class PriceTablesModule {}
