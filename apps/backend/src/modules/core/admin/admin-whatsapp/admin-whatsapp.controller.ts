import { Controller, Get, UseGuards } from '@nestjs/common';
import { AdminWhatsappService } from './admin-whatsapp.service';
import { PlatformAuthGuard } from '../admin-auth/platform-auth.guard';
import { PlatformOnly } from '../admin-auth/platform.decorator';

@Controller('admin/whatsapp')
@UseGuards(PlatformAuthGuard)
@PlatformOnly()
export class AdminWhatsappController {
  constructor(private readonly service: AdminWhatsappService) {}

  @Get()
  list() {
    return this.service.list();
  }
}
