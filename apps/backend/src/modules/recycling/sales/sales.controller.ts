import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { AuthUser } from '../../core/auth/jwt.strategy';
import {
  EmployeePermissionsGuard,
  RequirePermission,
} from '../employees/employee-permissions.guard';
import { SalesService } from './sales.service';
import { CreateSaleDto } from './dto/create-sale.dto';

interface RequestWithUser extends Request {
  user: AuthUser;
}

@Controller('recycling/sales')
@UseGuards(JwtAuthGuard, EmployeePermissionsGuard)
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Get()
  @RequirePermission('canRegisterSales')
  list(
    @Request() req: RequestWithUser,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.salesService.list(
      req.user.tenantId,
      Number(page),
      Number(limit),
    );
  }

  @Get(':id')
  @RequirePermission('canRegisterSales')
  getById(
    @Request() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.salesService.getById(req.user.tenantId, id);
  }

  @Post()
  @RequirePermission('canRegisterSales')
  create(@Request() req: RequestWithUser, @Body() dto: CreateSaleDto) {
    return this.salesService.create(req.user.tenantId, req.user.userId, dto);
  }
}
