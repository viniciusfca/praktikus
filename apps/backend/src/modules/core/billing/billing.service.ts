import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { InvoiceStatus, BillingType, TenantStatus } from '@praktikus/shared';
import { BillingEntity } from './billing.entity';
import { BillingInvoiceEntity } from './billing-invoice.entity';
import { AsaasClient } from './asaas.client';
import { TenancyService } from '../tenancy/tenancy.service';
import { MailService } from '../mail/mail.service';
import { BillingSummaryDto } from './dto/billing-summary.dto';
import { OpenInvoiceDto } from './dto/open-invoice.dto';
import { CheckoutSessionDto } from './dto/checkout-session.dto';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    @InjectRepository(BillingEntity)
    private readonly billingRepo: Repository<BillingEntity>,
    @InjectRepository(BillingInvoiceEntity)
    private readonly invoiceRepo: Repository<BillingInvoiceEntity>,
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

  async getCurrentBilling(tenantId: string): Promise<BillingSummaryDto> {
    const tenant = await this.tenancyService.findById(tenantId);
    if (!tenant) throw new NotFoundException('Tenant not found');
    const billing = await this.billingRepo.findOne({ where: { tenantId } });

    const planValue = Number.parseFloat(
      this.config.get<string>('ASAAS_PLAN_VALUE', '89.90'),
    );
    let daysUntilTrialEnds: number | null = null;
    if (tenant.status === TenantStatus.TRIAL && tenant.trialEndsAt) {
      const diff = new Date(tenant.trialEndsAt).getTime() - Date.now();
      daysUntilTrialEnds = Math.max(
        0,
        Math.ceil(diff / (1000 * 60 * 60 * 24)),
      );
    }

    return {
      status: tenant.status,
      planName: 'Plano Praktikus',
      planValue,
      billingType: billing?.billingType ?? null,
      card: billing?.cardLast4 && billing.cardBrand && billing.cardExpiry
        ? {
            last4: billing.cardLast4,
            brand: billing.cardBrand,
            expiry: billing.cardExpiry,
          }
        : null,
      nextDueDate: billing?.nextDueDate?.toISOString() ?? null,
      trialEndsAt: tenant.trialEndsAt?.toISOString() ?? null,
      daysUntilTrialEnds,
      canceledAt: billing?.canceledAt?.toISOString() ?? null,
    };
  }

  async getOpenInvoice(tenantId: string): Promise<OpenInvoiceDto | null> {
    const invoice = await this.invoiceRepo.findOne({
      where: [
        { tenantId, status: InvoiceStatus.PENDING },
        { tenantId, status: InvoiceStatus.OVERDUE },
      ],
      order: { dueDate: 'DESC' },
    });
    if (!invoice) return null;

    let pix: { qrCodeBase64: string; copyPaste: string } | null = null;
    if (invoice.billingType === BillingType.PIX) {
      const expired =
        !invoice.pixExpiresAt || invoice.pixExpiresAt.getTime() < Date.now();
      if (!expired && invoice.pixQrCode && invoice.pixCopyPaste) {
        pix = {
          qrCodeBase64: invoice.pixQrCode,
          copyPaste: invoice.pixCopyPaste,
        };
      } else {
        pix = await this.generatePixForInvoice(invoice.id);
      }
    }

    return {
      id: invoice.id,
      asaasPaymentId: invoice.asaasPaymentId,
      value: Number.parseFloat(invoice.value),
      dueDate: invoice.dueDate.toISOString().split('T')[0],
      status: invoice.status,
      billingType: invoice.billingType,
      pix,
    };
  }

  async generatePixForInvoice(
    invoiceId: string,
    tenantId?: string,
  ): Promise<{ qrCodeBase64: string; copyPaste: string }> {
    const invoice = await this.invoiceRepo.findOne({
      where: { id: invoiceId },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    if (tenantId && invoice.tenantId !== tenantId) {
      throw new NotFoundException('Invoice not found');
    }

    if (this.isMock) {
      return { qrCodeBase64: 'MOCK_BASE64', copyPaste: 'MOCK_COPYPASTE' };
    }

    const res = await this.asaas.get<{
      encodedImage: string;
      payload: string;
      expirationDate: string;
    }>(`/payments/${invoice.asaasPaymentId}/pixQrCode`);

    invoice.pixQrCode = res.encodedImage;
    invoice.pixCopyPaste = res.payload;
    invoice.pixExpiresAt = new Date(res.expirationDate);
    await this.invoiceRepo.save(invoice);

    return { qrCodeBase64: res.encodedImage, copyPaste: res.payload };
  }

  async listPaidInvoices(
    tenantId: string,
    limit = 12,
  ): Promise<OpenInvoiceDto[]> {
    const invoices = await this.invoiceRepo.find({
      where: { tenantId, status: InvoiceStatus.CONFIRMED },
      order: { paidAt: 'DESC' },
      take: limit,
    });
    return invoices.map((i) => ({
      id: i.id,
      asaasPaymentId: i.asaasPaymentId,
      value: Number.parseFloat(i.value),
      dueDate: i.dueDate.toISOString().split('T')[0],
      status: i.status,
      billingType: i.billingType,
      pix: null,
    }));
  }

  async createCheckoutSessionForCard(
    tenantId: string,
    email: string,
  ): Promise<CheckoutSessionDto> {
    const tenant = await this.tenancyService.findById(tenantId);
    if (!tenant) throw new NotFoundException('Tenant not found');
    const billing = await this.billingRepo.findOne({ where: { tenantId } });
    if (!billing?.asaasCustomerId) {
      throw new ConflictException('Tenant billing not initialized');
    }

    if (this.isMock) {
      return {
        checkoutUrl: `https://mock-checkout.local/${tenantId}`,
        sessionId: `mock_chk_${tenantId}_${Date.now()}`,
      };
    }

    if (
      tenant.status !== TenantStatus.TRIAL &&
      tenant.status !== TenantStatus.ACTIVE
    ) {
      throw new ConflictException(
        `Cannot create card checkout for tenant in status ${tenant.status}. Pay open invoice first.`,
      );
    }

    const planValue = parseFloat(
      this.config.get<string>('ASAAS_PLAN_VALUE', '89.90'),
    );
    const expireMinutes = parseInt(
      this.config.get<string>('ASAAS_CHECKOUT_EXPIRE_MINUTES', '30'),
      10,
    );

    // TODO: nextDueDate uses local-time setDate() with UTC toISOString() — risk of off-by-one near midnight in BRT. Use timezone-aware formatter.
    let nextDueDate: string;
    if (tenant.status === TenantStatus.TRIAL && tenant.trialEndsAt) {
      nextDueDate = tenant.trialEndsAt.toISOString().split('T')[0];
    } else {
      const d = new Date();
      d.setDate(d.getDate() + 30);
      nextDueDate = d.toISOString().split('T')[0];
    }

    const res = await this.asaas.post<{ id: string; link: string }>(
      '/checkouts',
      {
        billingTypes: ['CREDIT_CARD'],
        chargeTypes: ['RECURRENT'],
        minutesToExpire: expireMinutes,
        callback: {
          successUrl: this.config.get<string>('ASAAS_CHECKOUT_SUCCESS_URL'),
          cancelUrl: this.config.get<string>('ASAAS_CHECKOUT_CANCEL_URL'),
          expiredUrl: this.config.get<string>('ASAAS_CHECKOUT_EXPIRED_URL'),
        },
        items: [{ name: 'Plano Praktikus', value: planValue, quantity: 1 }],
        customerData: {
          name: tenant.nomeFantasia,
          email,
          cpfCnpj: tenant.cnpj,
        },
        subscription: {
          cycle: 'MONTHLY',
          nextDueDate,
        },
        externalReference: `tenant_${tenantId}`,
      },
    );

    return { checkoutUrl: res.link, sessionId: res.id };
  }

  async createCheckoutSessionForInvoice(
    tenantId: string,
    invoiceId: string,
  ): Promise<CheckoutSessionDto> {
    const invoice = await this.invoiceRepo.findOne({
      where: { id: invoiceId },
    });
    if (!invoice || invoice.tenantId !== tenantId) {
      throw new NotFoundException('Invoice not found');
    }

    if (this.isMock) {
      return {
        checkoutUrl: `https://mock-checkout.local/inv/${invoiceId}`,
        sessionId: `mock_chk_inv_${invoiceId}`,
      };
    }

    const res = await this.asaas.post<{ link: string }>(
      `/payments/${invoice.asaasPaymentId}/checkoutPayment`,
      {},
    );
    return { checkoutUrl: res.link, sessionId: invoice.asaasPaymentId };
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
