import {
  Body, Controller, Delete, Get, HttpCode,
  Param, ParseUUIDPipe, Patch, Post, Query, Request, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { RolesGuard } from '../../core/auth/roles.guard';
import { Roles } from '../../core/auth/roles.decorator';
import { UserRole } from '../../core/auth/user.entity';
import { EmployeePermissionsGuard, RequirePermission } from '../employees/employee-permissions.guard';
import { AuthUser } from '../../core/auth/jwt.strategy';
import { BuyersService } from './buyers.service';
import { CreateBuyerDto } from './dto/create-buyer.dto';
import { UpdateBuyerDto } from './dto/update-buyer.dto';

interface RequestWithUser extends Request { user: AuthUser; }

@Controller('recycling/buyers')
@UseGuards(JwtAuthGuard, EmployeePermissionsGuard)
export class BuyersController {
  constructor(private readonly buyersService: BuyersService) {}

  @Get()
  list(
    @Request() req: RequestWithUser,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('search') search?: string,
  ) {
    return this.buyersService.list(req.user.tenantId, Number(page), Number(limit), search);
  }

  @Get(':id')
  getById(@Request() req: RequestWithUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.buyersService.getById(req.user.tenantId, id);
  }

  @Post()
  @RequirePermission('canManageBuyers')
  create(@Request() req: RequestWithUser, @Body() dto: CreateBuyerDto) {
    return this.buyersService.create(req.user.tenantId, dto);
  }

  @Patch(':id')
  @RequirePermission('canManageBuyers')
  update(
    @Request() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBuyerDto,
  ) {
    return this.buyersService.update(req.user.tenantId, id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER)
  @HttpCode(204)
  delete(@Request() req: RequestWithUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.buyersService.delete(req.user.tenantId, id);
  }
}
