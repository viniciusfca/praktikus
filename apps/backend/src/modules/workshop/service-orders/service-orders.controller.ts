import {
  Body, Controller, Delete, Get, HttpCode, Param,
  ParseUUIDPipe, Patch, Post, Query, Request, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { RolesGuard } from '../../core/auth/roles.guard';
import { Roles } from '../../core/auth/roles.decorator';
import { UserRole } from '../../core/auth/user.entity';
import { AuthUser } from '../../core/auth/jwt.strategy';
import { ServiceOrdersService } from './service-orders.service';
import { CreateServiceOrderDto } from './dto/create-service-order.dto';
import { PatchStatusDto } from './dto/patch-status.dto';
import { PatchPaymentStatusDto } from './dto/patch-payment-status.dto';
import { CreateSoItemServiceDto } from './dto/create-so-item-service.dto';
import { CreateSoItemPartDto } from './dto/create-so-item-part.dto';

interface RequestWithUser extends Request {
  user: AuthUser;
}

@Controller('workshop/service-orders')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ServiceOrdersController {
  constructor(private readonly soService: ServiceOrdersService) {}

  @Get()
  list(
    @Request() req: RequestWithUser,
    @Query('status') status?: string,
    @Query('date_start') dateStart?: string,
    @Query('date_end') dateEnd?: string,
  ) {
    return this.soService.list(req.user.tenantId, { status, dateStart, dateEnd });
  }

  @Get(':id')
  getById(@Request() req: RequestWithUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.soService.getById(req.user.tenantId, id);
  }

  @Post()
  create(@Request() req: RequestWithUser, @Body() dto: CreateServiceOrderDto) {
    return this.soService.create(req.user.tenantId, dto);
  }

  @Patch(':id')
  update(
    @Request() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: Partial<CreateServiceOrderDto>,
  ) {
    return this.soService.update(req.user.tenantId, id, dto);
  }

  @Patch(':id/status')
  patchStatus(
    @Request() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PatchStatusDto,
  ) {
    return this.soService.patchStatus(req.user.tenantId, id, dto.status, req.user.role);
  }

  @Patch(':id/payment-status')
  @Roles(UserRole.OWNER)
  patchPaymentStatus(
    @Request() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PatchPaymentStatusDto,
  ) {
    return this.soService.patchPaymentStatus(req.user.tenantId, id, dto.statusPagamento);
  }

  @Post(':id/approval-token')
  generateApprovalToken(@Request() req: RequestWithUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.soService.generateApprovalToken(req.user.tenantId, id);
  }

  @Post(':soId/items/services')
  addItemService(
    @Request() req: RequestWithUser,
    @Param('soId', ParseUUIDPipe) soId: string,
    @Body() dto: CreateSoItemServiceDto,
  ) {
    return this.soService.addItemService(req.user.tenantId, soId, dto);
  }

  @Delete(':soId/items/services/:itemId')
  @HttpCode(204)
  removeItemService(
    @Request() req: RequestWithUser,
    @Param('soId', ParseUUIDPipe) soId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
  ) {
    return this.soService.removeItemService(req.user.tenantId, soId, itemId);
  }

  @Post(':soId/items/parts')
  addItemPart(
    @Request() req: RequestWithUser,
    @Param('soId', ParseUUIDPipe) soId: string,
    @Body() dto: CreateSoItemPartDto,
  ) {
    return this.soService.addItemPart(req.user.tenantId, soId, dto);
  }

  @Delete(':soId/items/parts/:itemId')
  @HttpCode(204)
  removeItemPart(
    @Request() req: RequestWithUser,
    @Param('soId', ParseUUIDPipe) soId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
  ) {
    return this.soService.removeItemPart(req.user.tenantId, soId, itemId);
  }

  @Delete(':id')
  @Roles(UserRole.OWNER)
  @HttpCode(204)
  delete(@Request() req: RequestWithUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.soService.delete(req.user.tenantId, id);
  }
}
