import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BillingEntity } from './billing.entity';
import { BillingService } from './billing.service';

@Module({
  imports: [TypeOrmModule.forFeature([BillingEntity])],
  providers: [BillingService],
  exports: [BillingService],
})
export class BillingModule {}
