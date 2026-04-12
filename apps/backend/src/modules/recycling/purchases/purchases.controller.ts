import { Body, Controller, Get, Post, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { AuthUser } from '../../core/auth/jwt.strategy';
import { EmployeePermissionsGuard, RequirePermission } from '../employees/employee-permissions.guard';
import { PurchasesService } from './purchases.service';
import { CreatePurchaseDto } from './dto/create-purchase.dto';

interface RequestWithUser extends Request {
  user: AuthUser;
}

@Controller('recycling/purchases')
@UseGuards(JwtAuthGuard, EmployeePermissionsGuard)
export class PurchasesController {
  constructor(private readonly purchasesService: PurchasesService) {}

  @Get()
  @RequirePermission('canViewStock')
  list(
    @Request() req: RequestWithUser,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.purchasesService.list(req.user.tenantId, Number(page), Number(limit));
  }

  @Post()
  @RequirePermission('canRegisterPurchases')
  create(@Request() req: RequestWithUser, @Body() dto: CreatePurchaseDto) {
    return this.purchasesService.create(req.user.tenantId, req.user.userId, dto);
  }
}
