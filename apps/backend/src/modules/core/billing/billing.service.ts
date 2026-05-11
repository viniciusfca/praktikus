import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { BillingEntity } from './billing.entity';
import { BillingInvoiceEntity } from './billing-invoice.entity';
import { AsaasClient } from './asaas.client';
import { TenancyService } from '../tenancy/tenancy.service';
import { MailService } from '../mail/mail.service';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    @InjectRepository(BillingEntity)
    private readonly billingRepo: Repository<BillingEntity>,
    @InjectRepository(BillingInvoiceEntity)
    private readonly invoiceRepo: Repository<BillingInvoiceEntity>, // NOSONAR(rule:S1068) — usado nas tasks 6-10 do plano de cobrança self-service
    private readonly config: ConfigService,
    private readonly tenancyService: TenancyService,
    private readonly asaas: AsaasClient,
    private readonly mailService: MailService, // NOSONAR(rule:S1068) — usado nas tasks 9-10 do plano de cobrança self-service
  ) {}

  /** Getter (not captured) so tests can flip mockAsaasClient.isMock; in production AsaasClient.isMock is itself readonly. */
  get isMock(): boolean {
    return this.asaas.isMock;
  }

  async setupTrial(
    tenantId: string,
    email: string,
    name: string,
    cnpj: string,
  ): Promise<void> {
    let asaasCustomerId: string;
    let asaasSubscriptionId: string;

    if (this.isMock) {
      asaasCustomerId = `mock_customer_${tenantId}`;
      asaasSubscriptionId = `mock_subscription_${tenantId}`;
    } else {
      const planValue = parseFloat(
        this.config.get<string>('ASAAS_PLAN_VALUE', '89.90'),
      );

      const customer = await this.asaas.post<{ id: string }>('/customers', {
        name,
        email,
        cpfCnpj: cnpj,
      });
      asaasCustomerId = customer.id;

      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 30);
      const dueDateStr = dueDate.toISOString().split('T')[0];

      try {
        const sub = await this.asaas.post<{ id: string }>('/subscriptions', {
          customer: asaasCustomerId,
          billingType: 'UNDEFINED',
          value: planValue,
          nextDueDate: dueDateStr,
          cycle: 'MONTHLY',
          description: `Plano Praktikus — R$${planValue.toFixed(2).replace('.', ',')}/mês`,
          trialPeriodDays: 30,
        });
        asaasSubscriptionId = sub.id;
      } catch (err) {
        this.logger.error(
          `Asaas createSubscription failed. Orphaned customerId: ${asaasCustomerId}. Error: ${(err as Error).message}`,
        );
        throw err;
      }
    }

    await this.billingRepo.save(
      this.billingRepo.create({
        tenantId,
        asaasCustomerId,
        asaasSubscriptionId,
        billingType: null,
      }),
    );
  }

  async findTenantIdBySubscriptionId(
    subscriptionId: string,
  ): Promise<string | null> {
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
      if (anchor.getMonth() + 1 !== todayMonth) continue;

      let ipcaRate: number;
      try {
        ipcaRate = await this.fetchIpcaAccumulado12Months();
      } catch (err) {
        this.logger.error(
          `IBGE IPCA fetch failed for tenant ${billing.tenantId}: ${(err as Error).message}`,
        );
        continue;
      }

      const currentValue = parseFloat(
        this.config.get<string>('ASAAS_PLAN_VALUE', '89.90'),
      );
      const newValue = parseFloat((currentValue * (1 + ipcaRate)).toFixed(2));

      if (this.isMock) {
        this.logger.log(
          `[MOCK] Reajuste anual tenant ${billing.tenantId}: R$${currentValue} → R$${newValue} (IPCA ${(ipcaRate * 100).toFixed(2)}%)`,
        );
        continue;
      }

      try {
        await this.asaas.patch(
          `/subscriptions/${billing.asaasSubscriptionId}`,
          { value: newValue },
        );
        this.logger.log(
          `Reajuste anual aplicado tenant ${billing.tenantId}: R$${currentValue} → R$${newValue}`,
        );
      } catch (err) {
        this.logger.error(
          `Asaas PATCH subscription failed for tenant ${billing.tenantId}: ${(err as Error).message}`,
        );
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
    const values = Object.values(series);
    if (values.length === 0) throw new Error('IBGE returned empty series');

    const latest = parseFloat(String(values[values.length - 1]));
    if (isNaN(latest)) throw new Error('IBGE value is not a number');

    return latest / 100;
  }
}
