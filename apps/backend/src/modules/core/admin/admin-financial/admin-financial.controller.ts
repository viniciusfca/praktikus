import { Controller, Get, UseGuards } from '@nestjs/common';
import { AdminFinancialService } from './admin-financial.service';
import { PlatformAuthGuard } from '../admin-auth/platform-auth.guard';
import { PlatformOnly } from '../admin-auth/platform.decorator';

@Controller('admin/financial')
@UseGuards(PlatformAuthGuard)
@PlatformOnly()
export class AdminFinancialController {
  constructor(private readonly service: AdminFinancialService) {}

  @Get()
  get() {
    return this.service.get();
  }
}
