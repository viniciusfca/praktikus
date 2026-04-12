import { Controller, Get, Param, ParseUUIDPipe, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { AuthUser } from '../../core/auth/jwt.strategy';
import { EmployeePermissionsGuard, RequirePermission } from '../employees/employee-permissions.guard';
import { StockService } from './stock.service';

interface RequestWithUser extends Request {
  user: AuthUser;
}

@Controller('recycling/stock')
@UseGuards(JwtAuthGuard, EmployeePermissionsGuard)
@RequirePermission('canViewStock')
export class StockController {
  constructor(private readonly stockService: StockService) {}

  @Get()
  getBalances(@Request() req: RequestWithUser) {
    return this.stockService.getBalances(req.user.tenantId);
  }

  @Get('daily')
  getDailyTotals(@Request() req: RequestWithUser, @Query('date') date?: string) {
    const d = date && /^\d{4}-\d{2}-\d{2}$/.test(date)
      ? date
      : new Date().toISOString().split('T')[0];
    return this.stockService.getDailyPurchaseTotals(req.user.tenantId, d);
  }

  @Get(':productId/movements')
  getMovements(
    @Request() req: RequestWithUser,
    @Param('productId', ParseUUIDPipe) productId: string,
  ) {
    return this.stockService.getMovements(req.user.tenantId, productId);
  }
}
