import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { RecyclingReportsService } from './reports.service';
import { EmployeesModule } from '../employees/employees.module';

@Module({
  imports: [EmployeesModule],
  controllers: [ReportsController],
  providers: [RecyclingReportsService],
  exports: [RecyclingReportsService],
})
export class ReportsModule {}
