import { Controller, Get, UseGuards } from '@nestjs/common';
import { AdminSegmentsService } from './admin-segments.service';
import { PlatformAuthGuard } from '../admin-auth/platform-auth.guard';
import { PlatformOnly } from '../admin-auth/platform.decorator';

@Controller('admin/segments')
@UseGuards(PlatformAuthGuard)
@PlatformOnly()
export class AdminSegmentsController {
  constructor(private readonly service: AdminSegmentsService) {}

  @Get()
  list() {
    return this.service.list();
  }
}
