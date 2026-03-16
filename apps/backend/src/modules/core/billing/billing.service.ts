import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { BillingEntity } from './billing.entity';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  readonly isMock: boolean;

  constructor(
    @InjectRepository(BillingEntity)
    private readonly billingRepo: Repository<BillingEntity>,
    private readonly config: ConfigService,
  ) {
    const apiKey = this.config.get<string>('ASAAS_API_KEY');
    this.isMock = !apiKey || apiKey === 'mock';
    if (this.isMock) {
      this.logger.warn('Asaas em modo MOCK — nenhuma cobrança real será criada.');
    }
  }

  async setupTrial(tenantId: string, email: string, name: string): Promise<void> {
    let asaasCustomerId: string;
    let asaasSubscriptionId: string;

    if (this.isMock) {
      asaasCustomerId = `mock_customer_${tenantId}`;
      asaasSubscriptionId = `mock_subscription_${tenantId}`;
    } else {
      const apiKey = this.config.get<string>('ASAAS_API_KEY')!;
      const baseUrl = this.config.get<string>('ASAAS_API_URL', 'https://sandbox.asaas.com/api/v3');
      const planValue = parseFloat(this.config.get<string>('ASAAS_PLAN_VALUE', '69.90'));

      const customerRes = await fetch(`${baseUrl}/customers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', access_token: apiKey },
        body: JSON.stringify({ name, email }),
      });

      if (!customerRes.ok) {
        const body = await customerRes.text();
        throw new Error(`Asaas createCustomer failed: ${customerRes.status} ${body}`);
      }

      const customer = (await customerRes.json()) as { id: string };
      asaasCustomerId = customer.id;

      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 30);
      const dueDateStr = dueDate.toISOString().split('T')[0];

      const subRes = await fetch(`${baseUrl}/subscriptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', access_token: apiKey },
        body: JSON.stringify({
          customer: asaasCustomerId,
          billingType: 'CREDIT_CARD',
          value: planValue,
          nextDueDate: dueDateStr,
          cycle: 'MONTHLY',
          description: 'Plano Practicus — R$69,90/mês',
          trialPeriodDays: 30,
        }),
      });

      if (!subRes.ok) {
        const body = await subRes.text();
        throw new Error(`Asaas createSubscription failed: ${subRes.status} ${body}`);
      }

      const subscription = (await subRes.json()) as { id: string };
      asaasSubscriptionId = subscription.id;
    }

    await this.billingRepo.save(
      this.billingRepo.create({ tenantId, asaasCustomerId, asaasSubscriptionId }),
    );
  }
}
