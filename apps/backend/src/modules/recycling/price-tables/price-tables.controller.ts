import { Controller, Get, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { AuthUser } from '../../core/auth/jwt.strategy';
import { PriceTablesService } from './price-tables.service';

interface RequestWithUser extends Request {
  user: AuthUser;
}

@Controller('recycling/price-tables')
@UseGuards(JwtAuthGuard)
export class PriceTablesController {
  constructor(private readonly priceTablesService: PriceTablesService) {}

  @Get()
  list(@Request() req: RequestWithUser) {
    return this.priceTablesService.list(req.user.tenantId);
  }
}
