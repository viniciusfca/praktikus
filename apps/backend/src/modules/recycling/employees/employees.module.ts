import { Module } from '@nestjs/common';
import { EmployeesController } from './employees.controller';
import { EmployeesService } from './employees.service';
import { EmployeePermissionsGuard } from './employee-permissions.guard';

@Module({
  controllers: [EmployeesController],
  providers: [EmployeesService, EmployeePermissionsGuard],
  exports: [EmployeesService, EmployeePermissionsGuard],
})
export class EmployeesModule {}
