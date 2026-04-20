import { Controller, Get, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { AuthUser } from '../../core/auth/jwt.strategy';
import { RecyclingReportsService } from './reports.service';
import { PeriodQueryDto } from './dto/period-query.dto';
import { TopMaterialsQueryDto } from './dto/top-materials-query.dto';

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
  getPurchasesByPeriod(
    @Request() req: RequestWithUser,
    @Query() query: PeriodQueryDto,
  ) {
    return this.reportsService.getPurchasesByPeriod(req.user.tenantId, query.startDate, query.endDate);
  }

  @Get('top-materials')
  getTopMaterials(
    @Request() req: RequestWithUser,
    @Query() query: TopMaterialsQueryDto,
  ) {
    return this.reportsService.getTopMaterials(req.user.tenantId, query.month, query.limit);
  }
}
