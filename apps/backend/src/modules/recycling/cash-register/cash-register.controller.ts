import {
  Body, Controller, Get, Param, ParseUUIDPipe,
  Post, Request, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { AuthUser } from '../../core/auth/jwt.strategy';
import { CashRegisterService } from './cash-register.service';
import { AddTransactionDto } from './dto/add-transaction.dto';

interface RequestWithUser extends Request { user: AuthUser; }

@Controller('recycling/cash-register')
@UseGuards(JwtAuthGuard)
export class CashRegisterController {
  constructor(private readonly cashRegisterService: CashRegisterService) {}

  @Post('open')
  open(@Request() req: RequestWithUser) {
    return this.cashRegisterService.open(req.user.tenantId, req.user.userId);
  }

  @Post('close')
  close(@Request() req: RequestWithUser) {
    return this.cashRegisterService.close(req.user.tenantId, req.user.userId);
  }

  @Get('current')
  getCurrent(@Request() req: RequestWithUser) {
    return this.cashRegisterService.getCurrent(req.user.tenantId);
  }

  @Post('transactions')
  addTransaction(@Request() req: RequestWithUser, @Body() dto: AddTransactionDto) {
    return this.cashRegisterService.addTransaction(req.user.tenantId, dto);
  }

  @Get('sessions/:sessionId/transactions')
  getTransactions(
    @Request() req: RequestWithUser,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
  ) {
    return this.cashRegisterService.getTransactions(req.user.tenantId, sessionId);
  }
}
