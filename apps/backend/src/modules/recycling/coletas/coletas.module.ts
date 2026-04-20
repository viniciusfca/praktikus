import { Module } from '@nestjs/common';
import { ColetasController } from './coletas.controller';
import { ColetasService } from './coletas.service';
import { ColetaCommentsController } from './coleta-comments.controller';
import { ColetaCommentsService } from './coleta-comments.service';
import { EmployeesModule } from '../employees/employees.module';

@Module({
  imports: [EmployeesModule],
  controllers: [ColetasController, ColetaCommentsController],
  providers: [ColetasService, ColetaCommentsService],
})
export class ColetasModule {}
