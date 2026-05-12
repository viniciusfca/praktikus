import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { AuthUser } from '../../core/auth/jwt.strategy';
import {
  EmployeePermissionsGuard,
  RequirePermission,
} from '../employees/employee-permissions.guard';
import { CashRegisterService } from './cash-register.service';
import { AddTransactionDto } from './dto/add-transaction.dto';
import { OpenCashSessionDto } from './dto/open-cash-session.dto';

interface RequestWithUser extends Request {
  user: AuthUser;
}

@Controller('recycling/cash-register')
@UseGuards(JwtAuthGuard, EmployeePermissionsGuard)
export class CashRegisterController {
  constructor(private readonly cashRegisterService: CashRegisterService) {}

  @Post('open')
  @RequirePermission('canOpenCloseCash')
  open(
    @Request() req: RequestWithUser,
    @Body() dto: OpenCashSessionDto,
  ) {
    return this.cashRegisterService.open(
      req.user.tenantId,
      req.user.userId,
      dto.openingBalance,
    );
  }

  @Post('close')
  @RequirePermission('canOpenCloseCash')
  close(@Request() req: RequestWithUser) {
    return this.cashRegisterService.close(req.user.tenantId, req.user.userId);
  }

  @Get('current')
  @RequirePermission('canOpenCloseCash')
  getCurrent(@Request() req: RequestWithUser) {
    return this.cashRegisterService.getCurrent(req.user.tenantId);
  }

  @Post('transactions')
  @RequirePermission('canOpenCloseCash')
  addTransaction(
    @Request() req: RequestWithUser,
    @Body() dto: AddTransactionDto,
  ) {
    return this.cashRegisterService.addTransaction(req.user.tenantId, dto);
  }

  @Get('sessions/:sessionId/transactions')
  @RequirePermission('canOpenCloseCash')
  getTransactions(
    @Request() req: RequestWithUser,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
  ) {
    return this.cashRegisterService.getTransactions(
      req.user.tenantId,
      sessionId,
    );
  }
}
