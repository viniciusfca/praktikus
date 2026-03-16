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

      let customerResponse: Response;
      try {
        customerResponse = await fetch(`${baseUrl}/customers`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', access_token: apiKey },
          body: JSON.stringify({ name, email }),
        });
      } catch (err) {
        throw new Error(`Asaas network error on createCustomer: ${(err as Error).message}`);
      }

      if (!customerResponse.ok) {
        const body = await customerResponse.text();
        throw new Error(`Asaas createCustomer failed: ${customerResponse.status} ${body}`);
      }

      const customer = (await customerResponse.json()) as { id?: string };
      if (!customer.id) {
        throw new Error('Asaas createCustomer returned no customer ID');
      }
      asaasCustomerId = customer.id;

      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 30);
      const dueDateStr = dueDate.toISOString().split('T')[0];

      let subscriptionResponse: Response;
      try {
        subscriptionResponse = await fetch(`${baseUrl}/subscriptions`, {
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
      } catch (err) {
        this.logger.error(`Asaas createSubscription network error. Orphaned customerId: ${asaasCustomerId}`);
        throw new Error(`Asaas network error on createSubscription: ${(err as Error).message}`);
      }

      if (!subscriptionResponse.ok) {
        const body = await subscriptionResponse.text();
        this.logger.error(`Asaas createSubscription failed. Orphaned customerId: ${asaasCustomerId}`);
        throw new Error(`Asaas createSubscription failed: ${subscriptionResponse.status} ${body}`);
      }

      const subscription = (await subscriptionResponse.json()) as { id?: string };
      if (!subscription.id) {
        this.logger.error(`Asaas createSubscription returned no ID. Orphaned customerId: ${asaasCustomerId}`);
        throw new Error('Asaas createSubscription returned no subscription ID');
      }
      asaasSubscriptionId = subscription.id;
    }

    await this.billingRepo.save(
      this.billingRepo.create({ tenantId, asaasCustomerId, asaasSubscriptionId }),
    );
  }
}
