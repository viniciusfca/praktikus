import { Module } from '@nestjs/common';
import { BuyersController } from './buyers.controller';
import { BuyersService } from './buyers.service';
import { EmployeesModule } from '../employees/employees.module';

@Module({
  imports: [EmployeesModule],
  controllers: [BuyersController],
  providers: [BuyersService],
  exports: [BuyersService],
})
export class BuyersModule {}
