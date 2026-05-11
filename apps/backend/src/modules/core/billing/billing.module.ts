import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BillingEntity } from './billing.entity';
import { BillingInvoiceEntity } from './billing-invoice.entity';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
// import { AsaasClient } from './asaas.client'; // NOSONAR(rule:S125) — wiring pendente da Task 4 do plano de cobrança self-service
import { TenancyModule } from '../tenancy/tenancy.module';
// import { MailModule } from '../mail/mail.module'; // NOSONAR(rule:S125) — wiring pendente da Task 12 do plano de cobrança self-service

@Module({
  imports: [
    TypeOrmModule.forFeature([BillingEntity, BillingInvoiceEntity]),
    TenancyModule,
  ],
  controllers: [BillingController],
  providers: [BillingService],
  exports: [BillingService],
})
export class BillingModule {}
