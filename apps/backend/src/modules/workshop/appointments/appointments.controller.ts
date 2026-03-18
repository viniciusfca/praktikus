import {
  Body, Controller, Delete, Get, HttpCode, Param,
  ParseUUIDPipe, Patch, Post, Query, Request, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { RolesGuard } from '../../core/auth/roles.guard';
import { Roles } from '../../core/auth/roles.decorator';
import { UserRole } from '../../core/auth/user.entity';
import { AuthUser } from '../../core/auth/jwt.strategy';
import { AppointmentsService } from './appointments.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';

interface RequestWithUser extends Request {
  user: AuthUser;
}

@Controller('workshop/appointments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Get()
  list(
    @Request() req: RequestWithUser,
    @Query('date_start') dateStart?: string,
    @Query('date_end') dateEnd?: string,
    @Query('status') status?: string,
  ) {
    return this.appointmentsService.list(req.user.tenantId, { dateStart, dateEnd, status });
  }

  @Get(':id')
  getById(@Request() req: RequestWithUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.appointmentsService.getById(req.user.tenantId, id);
  }

  @Post()
  create(@Request() req: RequestWithUser, @Body() dto: CreateAppointmentDto) {
    return this.appointmentsService.create(req.user.tenantId, dto);
  }

  @Patch(':id')
  update(
    @Request() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAppointmentDto,
  ) {
    return this.appointmentsService.update(req.user.tenantId, id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.OWNER)
  @HttpCode(204)
  delete(@Request() req: RequestWithUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.appointmentsService.delete(req.user.tenantId, id);
  }
}
