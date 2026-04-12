import {
  Body, Controller, Get, Param, ParseUUIDPipe,
  Patch, Post, Query, Request, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { RolesGuard } from '../../core/auth/roles.guard';
import { Roles } from '../../core/auth/roles.decorator';
import { UserRole } from '../../core/auth/user.entity';
import { AuthUser } from '../../core/auth/jwt.strategy';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

interface RequestWithUser extends Request { user: AuthUser; }

@Controller('recycling/products')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.OWNER)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  list(
    @Request() req: RequestWithUser,
    @Query('includeInactive') includeInactive?: string,
  ) {
    return this.productsService.list(req.user.tenantId, includeInactive === 'true');
  }

  @Get(':id')
  getById(@Request() req: RequestWithUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.productsService.getById(req.user.tenantId, id);
  }

  @Post()
  create(@Request() req: RequestWithUser, @Body() dto: CreateProductDto) {
    return this.productsService.create(req.user.tenantId, dto);
  }

  @Patch(':id')
  update(
    @Request() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.productsService.update(req.user.tenantId, id, dto);
  }
}
