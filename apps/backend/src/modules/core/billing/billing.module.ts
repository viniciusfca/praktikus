import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BillingEntity } from './billing.entity';
import { BillingInvoiceEntity } from './billing-invoice.entity';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { AsaasClient } from './asaas.client';
import { TenancyModule } from '../tenancy/tenancy.module';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([BillingEntity, BillingInvoiceEntity]),
    TenancyModule,
    MailModule,
  ],
  controllers: [BillingController],
  providers: [BillingService, AsaasClient],
  exports: [BillingService],
})
export class BillingModule {}
