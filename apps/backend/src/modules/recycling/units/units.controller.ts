import {
  Body, Controller, Delete, Get, HttpCode,
  Param, ParseUUIDPipe, Patch, Post, Request, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { RolesGuard } from '../../core/auth/roles.guard';
import { Roles } from '../../core/auth/roles.decorator';
import { UserRole } from '../../core/auth/user.entity';
import { AuthUser } from '../../core/auth/jwt.strategy';
import { UnitsService } from './units.service';
import { CreateUnitDto } from './dto/create-unit.dto';

interface RequestWithUser extends Request { user: AuthUser; }

@Controller('recycling/units')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.OWNER)
export class UnitsController {
  constructor(private readonly unitsService: UnitsService) {}

  @Get()
  list(@Request() req: RequestWithUser) {
    return this.unitsService.list(req.user.tenantId);
  }

  @Post()
  create(@Request() req: RequestWithUser, @Body() dto: CreateUnitDto) {
    return this.unitsService.create(req.user.tenantId, dto);
  }

  @Patch(':id')
  update(
    @Request() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: Partial<CreateUnitDto>,
  ) {
    return this.unitsService.update(req.user.tenantId, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  delete(
    @Request() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.unitsService.delete(req.user.tenantId, id);
  }
}
