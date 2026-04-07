import {
  Body,
  Controller,
  ForbiddenException,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Req,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { RawBodyRequest } from '@nestjs/common';
import * as crypto from 'crypto';
import { BillingService } from './billing.service';
import { TenancyService } from '../tenancy/tenancy.service';
import { TenantStatus } from '../tenancy/tenant.entity';

const EVENT_STATUS_MAP: Partial<Record<string, TenantStatus>> = {
  PAYMENT_RECEIVED: TenantStatus.ACTIVE,
  PAYMENT_CONFIRMED: TenantStatus.ACTIVE,
  PAYMENT_OVERDUE: TenantStatus.OVERDUE,
  SUBSCRIPTION_INACTIVATED: TenantStatus.SUSPENDED,
};

@Controller('billing')
export class BillingController {
  private readonly logger = new Logger(BillingController.name);

  constructor(
    private readonly billingService: BillingService,
    private readonly tenancyService: TenancyService,
    private readonly config: ConfigService,
  ) {}

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Headers('asaas-signature') signature: string,
    @Req() req: RawBodyRequest<Request>,
    @Body() payload: any,
  ): Promise<void> {
    const secret = this.config.get<string>('ASAAS_WEBHOOK_TOKEN', '');

    if (!secret || !req.rawBody) {
      throw new ForbiddenException('Assinatura de webhook inválida');
    }

    const rawBody = req.rawBody.toString();
    const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

    const sigBuffer = Buffer.from(signature ?? '', 'hex');
    const expBuffer = Buffer.from(expected, 'hex');
    const isValid =
      sigBuffer.length === expBuffer.length && crypto.timingSafeEqual(sigBuffer, expBuffer);

    if (!isValid) {
      throw new ForbiddenException('Assinatura de webhook inválida');
    }

    const targetStatus = EVENT_STATUS_MAP[payload?.event];
    if (targetStatus === undefined) {
      this.logger.debug(`Ignoring unknown Asaas event: ${payload?.event}`);
      return;
    }

    // subscriptionId varies by event type
    const subscriptionId: string | undefined =
      payload?.payment?.subscription ?? payload?.subscription?.id;

    if (!subscriptionId) {
      this.logger.warn(`Asaas event ${payload?.event} has no subscriptionId`);
      return;
    }

    const tenantId = await this.billingService.findTenantIdBySubscriptionId(subscriptionId);
    if (!tenantId) {
      this.logger.warn(`No tenant found for subscriptionId: ${subscriptionId}`);
      return;
    }

    await this.tenancyService.updateStatus(tenantId, targetStatus);
    this.logger.log(`Tenant ${tenantId} status updated to ${targetStatus} via ${payload.event}`);
  }
}
