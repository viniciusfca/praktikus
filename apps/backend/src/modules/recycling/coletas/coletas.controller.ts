import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
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
import { ColetasService } from './coletas.service';
import { CreateColetaDto } from './dto/create-coleta.dto';
import { UpdateColetaDto } from './dto/update-coleta.dto';
import { UpdateColetaStatusDto } from './dto/update-status.dto';
import { ListColetasQueryDto } from './dto/list-coletas-query.dto';

interface RequestWithUser extends Request {
  user: AuthUser;
}

@Controller('recycling/coletas')
@UseGuards(JwtAuthGuard, EmployeePermissionsGuard)
@RequirePermission('canManageColetas')
export class ColetasController {
  constructor(private readonly coletasService: ColetasService) {}

  @Get()
  list(@Request() req: RequestWithUser, @Query() query: ListColetasQueryDto) {
    return this.coletasService.list(req.user.tenantId, query);
  }

  @Get('upcoming')
  upcoming(@Request() req: RequestWithUser, @Query('limit') limit?: string) {
    const parsed = limit ? parseInt(limit, 10) : 4;
    return this.coletasService.upcoming(
      req.user.tenantId,
      Number.isFinite(parsed) ? parsed : 4,
    );
  }

  @Get(':id')
  getById(
    @Request() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.coletasService.getById(req.user.tenantId, id);
  }

  @Post()
  create(@Request() req: RequestWithUser, @Body() dto: CreateColetaDto) {
    return this.coletasService.create(req.user.tenantId, dto);
  }

  @Put(':id')
  update(
    @Request() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateColetaDto,
  ) {
    return this.coletasService.update(req.user.tenantId, id, dto);
  }

  @Patch(':id/status')
  updateStatus(
    @Request() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateColetaStatusDto,
  ) {
    return this.coletasService.updateStatus(req.user.tenantId, id, dto.status);
  }

  @Delete(':id')
  @HttpCode(204)
  delete(
    @Request() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.coletasService.delete(req.user.tenantId, id);
  }
}
