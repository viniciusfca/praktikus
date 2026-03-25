import { BadRequestException, Controller, Get, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { RolesGuard } from '../../core/auth/roles.guard';
import { Roles } from '../../core/auth/roles.decorator';
import { UserRole } from '../../core/auth/user.entity';
import { AuthUser } from '../../core/auth/jwt.strategy';
import { ReportsService } from './reports.service';

interface RequestWithUser extends Request {
  user: AuthUser;
}

@Controller('workshop/reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.OWNER)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get()
  getReport(
    @Request() req: RequestWithUser,
    @Query('date_start') dateStart?: string,
    @Query('date_end') dateEnd?: string,
  ) {
    if (!dateStart || !dateEnd) {
      throw new BadRequestException('date_start e date_end são obrigatórios.');
    }
    return this.reportsService.getReport(req.user.tenantId, dateStart, dateEnd);
  }
}
