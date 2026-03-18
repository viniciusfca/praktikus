import { Module } from '@nestjs/common';
import { AppointmentsController } from './appointments.controller';
import { AppointmentsService } from './appointments.service';
import { AppointmentCommentsController } from './appointment-comments.controller';
import { AppointmentCommentsService } from './appointment-comments.service';

@Module({
  controllers: [AppointmentsController, AppointmentCommentsController],
  providers: [AppointmentsService, AppointmentCommentsService],
})
export class AppointmentsModule {}
