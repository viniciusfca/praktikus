import { Controller, Get, UseGuards } from '@nestjs/common';
import { AdminOverviewService } from './admin-overview.service';
import { PlatformAuthGuard } from '../admin-auth/platform-auth.guard';
import { PlatformOnly } from '../admin-auth/platform.decorator';

@Controller('admin/overview')
@UseGuards(PlatformAuthGuard)
@PlatformOnly()
export class AdminOverviewController {
  constructor(private readonly service: AdminOverviewService) {}

  @Get()
  getOverview() {
    return this.service.getOverview();
  }
}
