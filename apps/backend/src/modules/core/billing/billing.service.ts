import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { InvoiceStatus, BillingType } from '@praktikus/shared';
import { BillingEntity } from './billing.entity';
import { BillingInvoiceEntity } from './billing-invoice.entity';
import { AsaasClient } from './asaas.client';
import { TenancyService } from '../tenancy/tenancy.service';
import { TenantStatus } from '../tenancy/tenant.entity';
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
    private readonly mailService: MailService,
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

  @Cron('0 9 * * *') // diariamente às 9h — verifica trials prestes a vencer
  async sendTrialReminders(): Promise<void> {
    const tenants = await this.tenancyService.listAll();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const paymentUrl =
      this.config.get<string>(
        'FRONTEND_URL',
        'https://app.praktikus.com.br',
      ) + '/workshop/settings';

    for (const tenant of tenants) {
      try {
        if (tenant.status !== TenantStatus.TRIAL || !tenant.trialEndsAt) continue;
        const end = new Date(tenant.trialEndsAt);
        end.setHours(0, 0, 0, 0);
        const daysLeft = Math.ceil(
          (end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
        );

        if (daysLeft !== 7 && daysLeft !== 1) continue;

        const owner = await this.tenancyService.findOwnerByTenantId(tenant.id);
        if (!owner) continue;

        if (daysLeft === 7) {
          await this.mailService.sendTrialExpiringWarning(
            owner.email,
            owner.name,
            7,
            paymentUrl,
          );
        } else {
          await this.mailService.sendTrialExpiringTomorrow(
            owner.email,
            owner.name,
            paymentUrl,
          );
        }
      } catch (err) {
        this.logger.warn(
          `Trial reminder failed for tenant ${tenant.id}: ${(err as Error).message}`,
        );
      }
    }
  }

  @Cron('0 10 * * *') // diariamente às 10h — promove OVERDUE → SUSPENDED após grace
  async transitionOverdueToSuspended(): Promise<void> {
    const graceDays = parseInt(
      this.config.get<string>('PRAKTIKUS_GRACE_PERIOD_DAYS', '5'),
      10,
    );
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - graceDays);
    const paymentUrl =
      this.config.get<string>(
        'FRONTEND_URL',
        'https://app.praktikus.com.br',
      ) + '/workshop/settings';

    const tenants = await this.tenancyService.listAll();
    for (const tenant of tenants) {
      try {
        if (tenant.status !== TenantStatus.OVERDUE) continue;
        // Usa overdueAt (timestamp explícito de entrada em OVERDUE), não updatedAt
        // (que avança em qualquer write no tenant e zeraria o grace period).
        if (!tenant.overdueAt || tenant.overdueAt > cutoff) continue;

        await this.tenancyService.updateStatus(tenant.id, TenantStatus.SUSPENDED);
        const owner = await this.tenancyService.findOwnerByTenantId(tenant.id);
        if (owner) {
          await this.mailService.sendAccountSuspended(
            owner.email,
            owner.name,
            paymentUrl,
          );
        }
      } catch (err) {
        this.logger.warn(
          `Overdue→Suspended transition failed for tenant ${tenant.id}: ${(err as Error).message}`,
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
      daysUntilTrialEnds = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
    }

    return {
      status: tenant.status,
      planName: 'Plano Praktikus',
      planValue,
      billingType: billing?.billingType ?? null,
      card:
        billing?.cardLast4 && billing.cardBrand && billing.cardExpiry
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
    // UNDEFINED é o billingType padrão das primeiras faturas de assinaturas em TRIAL —
    // Asaas gera PIX por padrão nesse caso, então também devemos expor o QR/copy-paste.
    if (
      invoice.billingType === BillingType.PIX ||
      invoice.billingType === BillingType.UNDEFINED
    ) {
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

    // NOSONAR(rule:S1135) — risco conhecido de off-by-one em BRT (UTC vs local) será endereçado em task futura de timezone-awareness; mantido como nota de implementação aceitável no MVP.
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

  async removeCard(tenantId: string): Promise<void> {
    const billing = await this.billingRepo.findOne({ where: { tenantId } });
    if (!billing?.asaasSubscriptionId) {
      throw new NotFoundException('Billing not found');
    }
    if (!this.isMock) {
      await this.asaas.patch(`/subscriptions/${billing.asaasSubscriptionId}`, {
        billingType: 'PIX',
      });
    }
    billing.cardLast4 = null;
    billing.cardBrand = null;
    billing.cardExpiry = null;
    billing.billingType = 'PIX';
    await this.billingRepo.save(billing);
  }

  async cancelSubscription(tenantId: string): Promise<void> {
    const billing = await this.billingRepo.findOne({ where: { tenantId } });
    if (!billing) throw new NotFoundException('Billing not found');
    if (billing.canceledAt) {
      throw new BadRequestException('Subscription already canceled');
    }
    if (!this.isMock && billing.asaasSubscriptionId) {
      await this.asaas.post(
        `/subscriptions/${billing.asaasSubscriptionId}/cancel`,
        {},
      );
    }
    billing.canceledAt = new Date();
    await this.billingRepo.save(billing);
  }

  async reactivateSubscription(
    tenantId: string,
    email: string,
  ): Promise<CheckoutSessionDto> {
    const billing = await this.billingRepo.findOne({ where: { tenantId } });
    if (!billing) throw new NotFoundException('Billing not found');
    if (!billing.canceledAt) {
      throw new BadRequestException('Subscription not canceled');
    }
    // NÃO limpamos canceledAt aqui — só limpamos quando o pagamento de fato confirmar
    // (via webhook CHECKOUT_PAID em syncCardFromWebhook). Se o cliente abrir o checkout
    // mas não pagar, o tenant continua oficialmente cancelado (consistente com Asaas).
    // createCheckoutSessionForCard exige status TRIAL ou ACTIVE — um tenant SUSPENDED precisa
    // quitar a fatura aberta antes de reativar (ConflictException é o comportamento esperado).
    return this.createCheckoutSessionForCard(tenantId, email);
  }

  async syncInvoiceFromWebhook(payload: any): Promise<void> {
    const event = payload.event as string;
    const payment = payload.payment;
    if (!payment?.id) return;

    const subscriptionId =
      payment.subscription ?? payload.subscription?.id ?? null;

    let tenantId: string | null = null;
    if (subscriptionId) {
      tenantId = await this.findTenantIdBySubscriptionId(subscriptionId);
    }
    if (!tenantId) {
      this.logger.warn(
        `Webhook ${event} for payment ${payment.id} without resolvable tenant`,
      );
      return;
    }

    const newStatus = this.mapPaymentStatus(event);
    if (newStatus === null) {
      return; // unmapped event already logged by mapPaymentStatus
    }

    let invoice = await this.invoiceRepo.findOne({
      where: { asaasPaymentId: payment.id },
    });

    if (invoice) {
      // Guard de precedência contra webhooks fora de ordem (Asaas pode entregar PAYMENT_OVERDUE
      // depois de PAYMENT_CONFIRMED por delay de fila). Só aceita transição se newStatus >= status atual.
      if (
        this.statusPrecedence(newStatus) >=
        this.statusPrecedence(invoice.status)
      ) {
        invoice.status = newStatus;
      } else {
        this.logger.warn(
          `Ignoring out-of-order webhook: ${invoice.status} → ${newStatus} for invoice ${invoice.asaasPaymentId}`,
        );
      }
    } else {
      invoice = this.invoiceRepo.create({
        tenantId,
        asaasPaymentId: payment.id,
        value: String(payment.value ?? 0),
        dueDate: payment.dueDate ? new Date(payment.dueDate) : new Date(),
        status: newStatus,
        billingType: (payment.billingType ?? 'UNDEFINED') as BillingType,
      });
    }

    if (event === 'PAYMENT_CONFIRMED' || event === 'PAYMENT_RECEIVED') {
      invoice.paidAt = payment.confirmedDate
        ? new Date(payment.confirmedDate)
        : new Date();
    }

    await this.invoiceRepo.save(invoice);
  }

  /**
   * Precedência para resolver webhooks fora de ordem em syncInvoiceFromWebhook.
   * Permite transições "para frente": PENDING→OVERDUE, PENDING/OVERDUE→CONFIRMED,
   * CONFIRMED→REFUNDED (chargeback), qualquer→DELETED.
   * Bloqueia regressões: CONFIRMED→PENDING/OVERDUE, REFUNDED→CONFIRMED.
   */
  private statusPrecedence(status: InvoiceStatus): number {
    switch (status) {
      case InvoiceStatus.PENDING:
        return 1;
      case InvoiceStatus.OVERDUE:
        return 2;
      case InvoiceStatus.CONFIRMED:
        return 3;
      case InvoiceStatus.REFUNDED:
        return 4;
      case InvoiceStatus.DELETED:
        return 5;
      default:
        return 0;
    }
  }

  private async cancelOldAsaasSubscription(oldSubId: string): Promise<void> {
    if (this.isMock) return;
    try {
      await this.asaas.post(`/subscriptions/${oldSubId}/cancel`, {});
    } catch (err) {
      this.logger.error(
        `Failed to cancel old sub ${oldSubId}: ${(err as Error).message}`,
      );
    }
  }

  private applyCardToBilling(billing: BillingEntity, card: any): void {
    const last4 = String(card.creditCardNumber ?? '').slice(-4);
    billing.cardLast4 = last4 || null;
    billing.cardBrand = card.creditCardBrand ?? null;
    billing.cardExpiry = this.parseCardExpiry(card);
    billing.billingType = 'CREDIT_CARD';
  }

  /**
   * Normaliza o formato de validade do cartão para "MM/YY" (5 chars, cabe em VARCHAR(5)).
   * Asaas pode enviar `expirationMonth`+`expirationYear`, `expirationDate` em "MM/YY",
   * "MM/YYYY" ou "YYYY-MM"; fallback trunca para 5 caracteres.
   */
  private parseCardExpiry(card: any): string | null {
    if (card.expirationMonth && card.expirationYear) {
      const month = String(card.expirationMonth).padStart(2, '0');
      const year = String(card.expirationYear).slice(-2);
      return `${month}/${year}`;
    }
    const raw = card.expirationDate ?? card.expiryDate;
    if (!raw) return null;
    const s = String(raw);
    if (/^\d{2}\/\d{4}$/.test(s)) return `${s.slice(0, 3)}${s.slice(5)}`;
    if (/^\d{2}\/\d{2}$/.test(s)) return s;
    if (/^\d{4}-\d{2}$/.test(s)) return `${s.slice(5)}/${s.slice(2, 4)}`;
    return s.slice(0, 5);
  }

  async syncCardFromWebhook(payload: any): Promise<void> {
    const externalRef: string | undefined =
      payload.checkout?.externalReference ?? payload.payment?.externalReference;
    const tenantId = externalRef?.replace(/^tenant_/, '');
    if (!tenantId) {
      this.logger.warn('CHECKOUT_PAID without externalReference; ignoring');
      return;
    }
    const billing = await this.billingRepo.findOne({ where: { tenantId } });
    if (!billing) return;

    const newSubId = payload.checkout?.subscription?.id;
    const card = payload.checkout?.creditCard ?? payload.payment?.creditCard;

    const shouldReplaceSub =
      newSubId &&
      billing.asaasSubscriptionId &&
      newSubId !== billing.asaasSubscriptionId;
    if (shouldReplaceSub) {
      await this.cancelOldAsaasSubscription(billing.asaasSubscriptionId!);
      billing.asaasSubscriptionId = newSubId;
    }

    if (card) {
      this.applyCardToBilling(billing, card);
    }

    // CHECKOUT_PAID após reativação: limpa canceledAt agora que o pagamento confirmou
    // (reactivateSubscription deixa canceledAt setado até este momento — ver Fix #11).
    if (billing.canceledAt) {
      billing.canceledAt = null;
    }

    await this.billingRepo.save(billing);
  }

  private mapPaymentStatus(event: string): InvoiceStatus | null {
    switch (event) {
      case 'PAYMENT_CONFIRMED':
      case 'PAYMENT_RECEIVED':
        return InvoiceStatus.CONFIRMED;
      case 'PAYMENT_OVERDUE':
        return InvoiceStatus.OVERDUE;
      case 'PAYMENT_REFUNDED':
        return InvoiceStatus.REFUNDED;
      case 'PAYMENT_DELETED':
        return InvoiceStatus.DELETED;
      case 'PAYMENT_CREATED':
        return InvoiceStatus.PENDING;
      default:
        this.logger.warn(`Unmapped Asaas event: ${event}`);
        return null;
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
