import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  NotFoundException,
  Param,
  Post,
  RawBodyRequest,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import * as crypto from 'crypto';
import { BillingService } from './billing.service';
import { TenancyService } from '../tenancy/tenancy.service';
import { TenantStatus } from '../tenancy/tenant.entity';
import { MailService } from '../mail/mail.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../auth/user.entity';
import { BillingSummaryDto } from './dto/billing-summary.dto';
import { OpenInvoiceDto } from './dto/open-invoice.dto';
import { CheckoutSessionDto } from './dto/checkout-session.dto';

const INVOICE_EVENTS = new Set([
  'PAYMENT_CREATED',
  'PAYMENT_CONFIRMED',
  'PAYMENT_RECEIVED',
  'PAYMENT_OVERDUE',
  'PAYMENT_REFUNDED',
  'PAYMENT_DELETED',
]);

const EVENT_STATUS_MAP: Partial<Record<string, TenantStatus>> = {
  PAYMENT_RECEIVED: TenantStatus.ACTIVE,
  PAYMENT_CONFIRMED: TenantStatus.ACTIVE,
  PAYMENT_OVERDUE: TenantStatus.OVERDUE,
  PAYMENT_REFUNDED: TenantStatus.OVERDUE,
  SUBSCRIPTION_INACTIVATED: TenantStatus.SUSPENDED,
};

@Controller('billing')
export class BillingController {
  private readonly logger = new Logger(BillingController.name);

  constructor(
    private readonly billingService: BillingService,
    private readonly tenancyService: TenancyService,
    private readonly mailService: MailService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER)
  async getCurrent(@Req() req: any): Promise<BillingSummaryDto> {
    return this.billingService.getCurrentBilling(req.user.tenantId);
  }

  @Get('invoices')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER)
  async listInvoices(@Req() req: any): Promise<OpenInvoiceDto[]> {
    return this.billingService.listPaidInvoices(req.user.tenantId);
  }

  @Get('invoices/open')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER)
  async openInvoice(@Req() req: any): Promise<OpenInvoiceDto | null> {
    return this.billingService.getOpenInvoice(req.user.tenantId);
  }

  @Post('invoices/:id/pix')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER)
  async regeneratePix(
    @Param('id') invoiceId: string,
    @Req() req: any,
  ): Promise<{ qrCodeBase64: string; copyPaste: string }> {
    return this.billingService.generatePixForInvoice(
      invoiceId,
      req.user.tenantId,
    );
  }

  @Post('checkout-session')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER)
  async checkoutCard(@Req() req: any): Promise<CheckoutSessionDto> {
    return this.billingService.createCheckoutSessionForCard(
      req.user.tenantId,
      req.user.email,
    );
  }

  @Post('invoices/:id/checkout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER)
  async checkoutInvoice(
    @Param('id') invoiceId: string,
    @Req() req: any,
  ): Promise<CheckoutSessionDto> {
    return this.billingService.createCheckoutSessionForInvoice(
      req.user.tenantId,
      invoiceId,
    );
  }

  @Delete('card')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER)
  async removeCard(@Req() req: any): Promise<void> {
    await this.billingService.removeCard(req.user.tenantId);
  }

  @Post('cancel')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER)
  async cancel(@Req() req: any): Promise<void> {
    await this.billingService.cancelSubscription(req.user.tenantId);
  }

  @Post('reactivate')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER)
  async reactivate(@Req() req: any): Promise<CheckoutSessionDto> {
    return this.billingService.reactivateSubscription(
      req.user.tenantId,
      req.user.email,
    );
  }

  @Post('dev/simulate-card-checkout')
  @HttpCode(HttpStatus.OK)
  async devSimulateCardCheckout(
    @Body() body: { tenantId: string },
  ): Promise<{ ok: true }> {
    if (this.config.get<string>('NODE_ENV') === 'production') {
      throw new NotFoundException();
    }
    await this.billingService.syncCardFromWebhook({
      event: 'CHECKOUT_PAID',
      checkout: {
        externalReference: `tenant_${body.tenantId}`,
        subscription: { id: `mock_new_sub_${body.tenantId}_${Date.now()}` },
        creditCard: {
          creditCardNumber: '************1234',
          creditCardBrand: 'VISA',
          expirationDate: '12/29',
        },
      },
    });
    return { ok: true };
  }

  @Post('dev/simulate-invoice-checkout/:invoiceId')
  @HttpCode(HttpStatus.OK)
  async devSimulateInvoiceCheckout(
    @Param('invoiceId') invoiceId: string,
  ): Promise<{ ok: true }> {
    if (this.config.get<string>('NODE_ENV') === 'production') {
      throw new NotFoundException();
    }
    const invoice = await this.billingService.getInvoiceById(invoiceId);
    if (!invoice) throw new NotFoundException();

    await this.billingService.syncInvoiceFromWebhook({
      event: 'PAYMENT_CONFIRMED',
      payment: {
        id: invoice.asaasPaymentId,
        subscription: 'mock_sub',
        status: 'CONFIRMED',
        confirmedDate: new Date().toISOString(),
      },
    });
    return { ok: true };
  }

  private verifyWebhookSignature(
    signature: string | undefined,
    rawBody: Buffer | undefined,
  ): void {
    const secret = this.config.get<string>('ASAAS_WEBHOOK_TOKEN', '');

    if (!secret || !signature || !rawBody) {
      throw new ForbiddenException('Assinatura de webhook inválida');
    }

    const expected = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');

    const sigBuf = Buffer.from(signature, 'hex');
    const expBuf = Buffer.from(expected, 'hex');
    if (
      sigBuf.length !== expBuf.length ||
      !crypto.timingSafeEqual(sigBuf, expBuf)
    ) {
      throw new ForbiddenException('Assinatura de webhook inválida');
    }
  }

  private async maybeSendReactivationEmail(
    tenantId: string,
    previousStatus: TenantStatus | undefined,
    targetStatus: TenantStatus,
  ): Promise<void> {
    const wasSuspendedOrOverdue =
      previousStatus === TenantStatus.SUSPENDED ||
      previousStatus === TenantStatus.OVERDUE;
    if (targetStatus !== TenantStatus.ACTIVE || !wasSuspendedOrOverdue) return;

    const owner = await this.tenancyService.findOwnerByTenantId(tenantId);
    if (!owner) return;

    try {
      await this.mailService.sendAccountReactivated(owner.email, owner.name);
    } catch (err) {
      this.logger.warn(
        `Failed to send reactivation email for tenant ${tenantId}: ${(err as Error).message}`,
      );
    }
  }

  private async maybeSendRefundEmail(
    event: string,
    tenantId: string,
  ): Promise<void> {
    if (event !== 'PAYMENT_REFUNDED') return;
    const owner = await this.tenancyService.findOwnerByTenantId(tenantId);
    if (!owner) return;

    const paymentUrl =
      (this.config.get<string>('FRONTEND_URL') ??
        'https://app.praktikus.com.br') + '/workshop/settings';
    try {
      await this.mailService.sendPaymentRefundIssue(
        owner.email,
        owner.name,
        paymentUrl,
      );
    } catch (err) {
      this.logger.warn(
        `Failed to send refund email for tenant ${tenantId}: ${(err as Error).message}`,
      );
    }
  }

  private async handleStatusEvent(
    event: string,
    payload: any,
    targetStatus: TenantStatus,
  ): Promise<void> {
    const subscriptionId: string | undefined =
      payload?.payment?.subscription ?? payload?.subscription?.id;

    if (!subscriptionId) {
      this.logger.warn(`Asaas event ${event} has no subscriptionId`);
      return;
    }

    const tenantId =
      await this.billingService.findTenantIdBySubscriptionId(subscriptionId);
    if (!tenantId) {
      this.logger.warn(`No tenant found for subscriptionId: ${subscriptionId}`);
      return;
    }

    const tenantBefore = await this.tenancyService.findById(tenantId);
    await this.tenancyService.updateStatus(tenantId, targetStatus);
    await this.maybeSendReactivationEmail(
      tenantId,
      tenantBefore?.status,
      targetStatus,
    );
    await this.maybeSendRefundEmail(event, tenantId);

    this.logger.log(
      `Tenant ${tenantId} status updated to ${targetStatus} via ${event}`,
    );
  }

  @Post('webhook')
  @HttpCode(HttpStatus.NO_CONTENT)
  async webhook(
    @Headers('asaas-signature') signature: string | undefined,
    @Body() payload: any,
    @Req() req: RawBodyRequest<Request>,
  ): Promise<void> {
    this.verifyWebhookSignature(signature, req.rawBody);

    const event: string = payload?.event ?? '';

    if (INVOICE_EVENTS.has(event)) {
      await this.billingService.syncInvoiceFromWebhook(payload);
    }

    const targetStatus = EVENT_STATUS_MAP[event];
    if (targetStatus) {
      await this.handleStatusEvent(event, payload, targetStatus);
    }

    if (event === 'CHECKOUT_PAID') {
      await this.billingService.syncCardFromWebhook(payload);
    }
    if (event === 'CHECKOUT_EXPIRED') {
      this.logger.log(
        `CHECKOUT_EXPIRED: ${JSON.stringify(payload?.checkout?.id ?? '?')}`,
      );
    }
  }
}
