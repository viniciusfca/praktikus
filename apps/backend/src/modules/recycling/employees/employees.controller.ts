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
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  // Available for any authenticated tenant user (OWNER or EMPLOYEE).
  // Returns the current user's granular permissions. Used by the frontend
  // to hide sidebar items based on permission. Declared BEFORE the
  // `:id/permissions` route to avoid being matched as id="me".
  @Get('me/permissions')
  @UseGuards(JwtAuthGuard)
  async getMyPermissions(@Request() req: RequestWithUser) {
    if (req.user.role === UserRole.OWNER) {
      return {
        canManageSuppliers: true,
        canManageBuyers: true,
        canManageProducts: true,
        canOpenCloseCash: true,
        canViewStock: true,
        canViewReports: true,
        canRegisterPurchases: true,
        canRegisterSales: true,
        canManageColetas: true,
      };
    }
    return this.employeesService.getPermissions(
      req.user.tenantId,
      req.user.userId,
    );
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER)
  list(@Request() req: RequestWithUser) {
    return this.employeesService.list(req.user.tenantId);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER)
  create(@Request() req: RequestWithUser, @Body() dto: CreateEmployeeDto) {
    return this.employeesService.create(req.user.tenantId, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER)
  delete(
    @Request() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.employeesService.delete(req.user.tenantId, id);
  }

  @Get(':id/permissions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER)
  getPermissions(
    @Request() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.employeesService.getPermissions(req.user.tenantId, id);
  }

  @Patch(':id/permissions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER)
  updatePermissions(
    @Request() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePermissionsDto,
  ) {
    return this.employeesService.updatePermissions(req.user.tenantId, id, dto);
  }
}
