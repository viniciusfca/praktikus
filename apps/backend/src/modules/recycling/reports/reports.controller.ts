import { Controller, Get, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { RolesGuard } from '../../core/auth/roles.guard';
import { Roles } from '../../core/auth/roles.decorator';
import { UserRole } from '../../core/auth/user.entity';
import { AuthUser } from '../../core/auth/jwt.strategy';
import { RecyclingReportsService } from './reports.service';

interface RequestWithUser extends Request {
  user: AuthUser;
}

@Controller('recycling/reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly reportsService: RecyclingReportsService) {}

  @Get('dashboard')
  getDashboardSummary(@Request() req: RequestWithUser) {
    return this.reportsService.getDashboardSummary(req.user.tenantId);
  }

  @Get('purchases')
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER)
  getPurchasesByPeriod(
    @Request() req: RequestWithUser,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.reportsService.getPurchasesByPeriod(req.user.tenantId, startDate, endDate);
  }
}
