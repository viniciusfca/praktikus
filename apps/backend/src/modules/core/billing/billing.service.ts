import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { BillingEntity } from './billing.entity';
import { TenancyService } from '../tenancy/tenancy.service';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  readonly isMock: boolean;

  constructor(
    @InjectRepository(BillingEntity)
    private readonly billingRepo: Repository<BillingEntity>,
    private readonly config: ConfigService,
    private readonly tenancyService: TenancyService,
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

  async findTenantIdBySubscriptionId(subscriptionId: string): Promise<string | null> {
    const billing = await this.billingRepo.findOne({
      where: { asaasSubscriptionId: subscriptionId },
    });
    return billing?.tenantId ?? null;
  }

  @Cron('0 9 1 * *') // dia 1 de cada mês às 9h
  async applyAnnualAdjustment(): Promise<void> {
    const today = new Date();
    const todayDay = today.getDate();
    const todayMonth = today.getMonth() + 1;

    const allBillings = await this.billingRepo.find();

    for (const billing of allBillings) {
      const tenant = await this.tenancyService.findById(billing.tenantId);
      if (!tenant?.billingAnchorDate) continue;

      const anchor = new Date(tenant.billingAnchorDate);
      if (anchor.getDate() !== todayDay) continue;

      let ipcaRate: number;
      try {
        ipcaRate = await this.fetchIpcaAccumulado12Months();
      } catch (err) {
        this.logger.error(`IBGE IPCA fetch failed for tenant ${billing.tenantId}: ${(err as Error).message}`);
        continue;
      }

      const currentValue = parseFloat(this.config.get<string>('ASAAS_PLAN_VALUE', '69.90'));
      const newValue = parseFloat((currentValue * (1 + ipcaRate)).toFixed(2));

      if (this.isMock) {
        this.logger.log(`[MOCK] Reajuste anual tenant ${billing.tenantId}: R$${currentValue} → R$${newValue} (IPCA ${(ipcaRate * 100).toFixed(2)}%)`);
        continue;
      }

      const apiKey = this.config.get<string>('ASAAS_API_KEY')!;
      const baseUrl = this.config.get<string>('ASAAS_API_URL', 'https://sandbox.asaas.com/api/v3');

      try {
        const patchRes = await fetch(`${baseUrl}/subscriptions/${billing.asaasSubscriptionId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', access_token: apiKey },
          body: JSON.stringify({ value: newValue }),
        });
        if (!patchRes.ok) {
          const body = await patchRes.text();
          this.logger.error(`Asaas PATCH failed for tenant ${billing.tenantId}: ${patchRes.status} ${body}`);
        } else {
          this.logger.log(`Reajuste anual aplicado tenant ${billing.tenantId}: R$${currentValue} → R$${newValue}`);
        }
      } catch (err) {
        this.logger.error(`Asaas PATCH subscription failed for tenant ${billing.tenantId}: ${(err as Error).message}`);
      }
    }
  }

  private async fetchIpcaAccumulado12Months(): Promise<number> {
    const now = new Date();
    const endPeriod = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const start = new Date(now);
    start.setMonth(start.getMonth() - 12);
    const startPeriod = `${start.getFullYear()}${String(start.getMonth() + 1).padStart(2, '0')}`;

    const url = `https://servicodados.ibge.gov.br/api/v3/agregados/6691/periodos/${startPeriod}-${endPeriod}/variaveis/63?localidades=N1[all]`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`IBGE API error: ${res.status}`);

    const data = (await res.json()) as any[];
    const series = data?.[0]?.resultados?.[0]?.series?.[0]?.serie ?? {};
    const values = Object.values(series) as string[];
    if (values.length === 0) throw new Error('IBGE returned empty series');

    const latest = parseFloat(values[values.length - 1]);
    if (isNaN(latest)) throw new Error('IBGE value is not a number');

    return latest / 100;
  }
}
