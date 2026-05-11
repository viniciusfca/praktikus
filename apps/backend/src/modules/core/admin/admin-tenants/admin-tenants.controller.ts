import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AdminTenantsService } from './admin-tenants.service';
import { ListTenantsQueryDto } from './dto/list-tenants-query.dto';
import { PlatformAuthGuard } from '../admin-auth/platform-auth.guard';
import { PlatformOnly } from '../admin-auth/platform.decorator';

@Controller('admin/tenants')
@UseGuards(PlatformAuthGuard)
@PlatformOnly()
export class AdminTenantsController {
  constructor(private readonly service: AdminTenantsService) {}

  @Get()
  list(@Query() query: ListTenantsQueryDto) {
    return this.service.list(query);
  }
}
