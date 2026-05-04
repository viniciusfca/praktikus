import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantEntity } from '../tenancy/tenant.entity';
import { WhatsappAccountEntity } from './entities/whatsapp-account.entity';
import { WhatsappDepartmentEntity } from './entities/whatsapp-department.entity';
import { WhatsappDepartmentUserEntity } from './entities/whatsapp-department-user.entity';
import { WhatsappConversationEntity } from './entities/whatsapp-conversation.entity';
import { WhatsappMessageEntity } from './entities/whatsapp-message.entity';
import { WhatsappUsageCounterEntity } from './entities/whatsapp-usage-counter.entity';
import { WhatsappEnabledGuard } from './whatsapp-enabled.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TenantEntity,
      WhatsappAccountEntity,
      WhatsappDepartmentEntity,
      WhatsappDepartmentUserEntity,
      WhatsappConversationEntity,
      WhatsappMessageEntity,
      WhatsappUsageCounterEntity,
    ]),
  ],
  providers: [WhatsappEnabledGuard],
  exports: [WhatsappEnabledGuard, TypeOrmModule],
})
export class WhatsappModule {}
