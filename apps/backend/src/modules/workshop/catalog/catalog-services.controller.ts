import {
  Body, Controller, Delete, Get, HttpCode, Param,
  ParseUUIDPipe, Patch, Post, Query, Request, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { RolesGuard } from '../../core/auth/roles.guard';
import { Roles } from '../../core/auth/roles.decorator';
import { UserRole } from '../../core/auth/user.entity';
import { AuthUser } from '../../core/auth/jwt.strategy';
import { CatalogServicesService } from './catalog-services.service';
import { CreateCatalogServiceDto } from './dto/create-catalog-service.dto';
import { UpdateCatalogServiceDto } from './dto/update-catalog-service.dto';

interface RequestWithUser extends Request {
  user: AuthUser;
}

@Controller('workshop/catalog/services')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CatalogServicesController {
  constructor(private readonly catalogServicesService: CatalogServicesService) {}

  @Get()
  list(
    @Request() req: RequestWithUser,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('search') search?: string,
  ) {
    return this.catalogServicesService.list(req.user.tenantId, Number(page), Number(limit), search);
  }

  @Get(':id')
  getById(@Request() req: RequestWithUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.catalogServicesService.getById(req.user.tenantId, id);
  }

  @Post()
  create(@Request() req: RequestWithUser, @Body() dto: CreateCatalogServiceDto) {
    return this.catalogServicesService.create(req.user.tenantId, dto);
  }

  @Patch(':id')
  update(
    @Request() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCatalogServiceDto,
  ) {
    return this.catalogServicesService.update(req.user.tenantId, id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.OWNER)
  @HttpCode(204)
  delete(@Request() req: RequestWithUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.catalogServicesService.delete(req.user.tenantId, id);
  }
}
