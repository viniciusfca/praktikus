import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { BillingEntity } from './billing.entity';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private readonly isMock: boolean;

  constructor(
    @InjectRepository(BillingEntity)
    private readonly billingRepo: Repository<BillingEntity>,
    private readonly config: ConfigService,
  ) {
    this.isMock = this.config.get<string>('ASAAS_API_KEY') === 'mock'
      || !this.config.get<string>('ASAAS_API_KEY');
    if (this.isMock) {
      this.logger.warn('Asaas em modo MOCK — nenhuma cobrança real será criada.');
    }
  }

  async setupTrial(tenantId: string, _email: string, _name: string): Promise<void> {
    const asaasCustomerId = `mock_customer_${tenantId}`;
    const asaasSubscriptionId = `mock_subscription_${tenantId}`;

    await this.billingRepo.save(
      this.billingRepo.create({ tenantId, asaasCustomerId, asaasSubscriptionId }),
    );
  }
}
