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
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { RolesGuard } from '../../core/auth/roles.guard';
import { Roles } from '../../core/auth/roles.decorator';
import { UserRole } from '../../core/auth/user.entity';
import { AuthUser } from '../../core/auth/jwt.strategy';
import { EmployeesService } from './employees.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdatePermissionsDto } from './dto/update-permissions.dto';

interface RequestWithUser extends Request {
  user: AuthUser;
}

@Controller('recycling/employees')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.OWNER)
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Get()
  list(@Request() req: RequestWithUser) {
    return this.employeesService.list(req.user.tenantId);
  }

  @Post()
  create(@Request() req: RequestWithUser, @Body() dto: CreateEmployeeDto) {
    return this.employeesService.create(req.user.tenantId, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  delete(
    @Request() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.employeesService.delete(req.user.tenantId, id);
  }

  @Get(':id/permissions')
  getPermissions(
    @Request() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.employeesService.getPermissions(req.user.tenantId, id);
  }

  @Patch(':id/permissions')
  updatePermissions(
    @Request() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePermissionsDto,
  ) {
    return this.employeesService.updatePermissions(req.user.tenantId, id, dto);
  }
}
