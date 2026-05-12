import { Controller, Get, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { AuthUser } from '../../core/auth/jwt.strategy';
import {
  EmployeePermissionsGuard,
  RequirePermission,
} from '../employees/employee-permissions.guard';
import { PriceTablesService } from './price-tables.service';

interface RequestWithUser extends Request {
  user: AuthUser;
}

@Controller('recycling/price-tables')
@UseGuards(JwtAuthGuard, EmployeePermissionsGuard)
export class PriceTablesController {
  constructor(private readonly priceTablesService: PriceTablesService) {}

  @Get()
  @RequirePermission('canManageProducts')
  list(@Request() req: RequestWithUser) {
    return this.priceTablesService.list(req.user.tenantId);
  }
}
