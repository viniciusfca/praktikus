import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { TenancyService } from '../tenancy/tenancy.service';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { TenantStatus } from '../tenancy/tenant.entity';

const mockBillingService = {
  findTenantIdBySubscriptionId: jest.fn(),
};
const mockTenancyService = {
  updateStatus: jest.fn(),
};
const mockConfigService = {
  get: jest.fn().mockImplementation((key: string, fallback?: string) => {
    if (key === 'ASAAS_WEBHOOK_TOKEN') return 'test-secret';
    return fallback;
  }),
};

function makeSignature(body: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(body).digest('hex');
}

function makeRawReq(rawBody: string): any {
  return { rawBody: Buffer.from(rawBody) };
}

describe('BillingController', () => {
  let controller: BillingController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BillingController],
      providers: [
        { provide: BillingService, useValue: mockBillingService },
        { provide: TenancyService, useValue: mockTenancyService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    controller = module.get<BillingController>(BillingController);
    jest.clearAllMocks();
  });

  it('should throw ForbiddenException for invalid signature', async () => {
    const rawBody = '{"event":"PAYMENT_RECEIVED"}';
    await expect(
      controller.handleWebhook('invalid-sig', makeRawReq(rawBody), {}),
    ).rejects.toThrow(ForbiddenException);
  });

  it('should update status to ACTIVE on PAYMENT_RECEIVED', async () => {
    const payload = { event: 'PAYMENT_RECEIVED', payment: { subscription: 'sub-1' } };
    const rawBody = JSON.stringify(payload);
    const sig = makeSignature(rawBody, 'test-secret');
    mockBillingService.findTenantIdBySubscriptionId.mockResolvedValue('tenant-1');

    await controller.handleWebhook(sig, makeRawReq(rawBody), payload);

    expect(mockTenancyService.updateStatus).toHaveBeenCalledWith('tenant-1', TenantStatus.ACTIVE);
  });

  it('should update status to ACTIVE on PAYMENT_CONFIRMED', async () => {
    const payload = { event: 'PAYMENT_CONFIRMED', payment: { subscription: 'sub-1' } };
    const rawBody = JSON.stringify(payload);
    const sig = makeSignature(rawBody, 'test-secret');
    mockBillingService.findTenantIdBySubscriptionId.mockResolvedValue('tenant-1');

    await controller.handleWebhook(sig, makeRawReq(rawBody), payload);

    expect(mockTenancyService.updateStatus).toHaveBeenCalledWith('tenant-1', TenantStatus.ACTIVE);
  });

  it('should update status to OVERDUE on PAYMENT_OVERDUE', async () => {
    const payload = { event: 'PAYMENT_OVERDUE', payment: { subscription: 'sub-1' } };
    const rawBody = JSON.stringify(payload);
    const sig = makeSignature(rawBody, 'test-secret');
    mockBillingService.findTenantIdBySubscriptionId.mockResolvedValue('tenant-1');

    await controller.handleWebhook(sig, makeRawReq(rawBody), payload);

    expect(mockTenancyService.updateStatus).toHaveBeenCalledWith('tenant-1', TenantStatus.OVERDUE);
  });

  it('should update status to SUSPENDED on SUBSCRIPTION_INACTIVATED', async () => {
    const payload = { event: 'SUBSCRIPTION_INACTIVATED', subscription: { id: 'sub-1' } };
    const rawBody = JSON.stringify(payload);
    const sig = makeSignature(rawBody, 'test-secret');
    mockBillingService.findTenantIdBySubscriptionId.mockResolvedValue('tenant-1');

    await controller.handleWebhook(sig, makeRawReq(rawBody), payload);

    expect(mockTenancyService.updateStatus).toHaveBeenCalledWith('tenant-1', TenantStatus.SUSPENDED);
  });

  it('should ignore unknown events without updating status', async () => {
    const payload = { event: 'UNKNOWN_EVENT' };
    const rawBody = JSON.stringify(payload);
    const sig = makeSignature(rawBody, 'test-secret');

    await expect(controller.handleWebhook(sig, makeRawReq(rawBody), payload)).resolves.toBeUndefined();
    expect(mockTenancyService.updateStatus).not.toHaveBeenCalled();
  });

  it('should return 200 and NOT call updateStatus when subscriptionId is not found in DB', async () => {
    const payload = { event: 'PAYMENT_RECEIVED', payment: { subscription: 'sub-unknown' } };
    const rawBody = JSON.stringify(payload);
    const sig = makeSignature(rawBody, 'test-secret');
    mockBillingService.findTenantIdBySubscriptionId.mockResolvedValue(null);

    await expect(controller.handleWebhook(sig, makeRawReq(rawBody), payload)).resolves.toBeUndefined();
    expect(mockBillingService.findTenantIdBySubscriptionId).toHaveBeenCalledWith('sub-unknown');
    expect(mockTenancyService.updateStatus).not.toHaveBeenCalled();
  });

  it('should return 200 and NOT call updateStatus when known event has no subscriptionId', async () => {
    const payload = { event: 'PAYMENT_RECEIVED' }; // no payment.subscription, no subscription.id
    const rawBody = JSON.stringify(payload);
    const sig = makeSignature(rawBody, 'test-secret');

    await expect(controller.handleWebhook(sig, makeRawReq(rawBody), payload)).resolves.toBeUndefined();
    expect(mockBillingService.findTenantIdBySubscriptionId).not.toHaveBeenCalled();
    expect(mockTenancyService.updateStatus).not.toHaveBeenCalled();
  });

  it('should throw ForbiddenException when rawBody is missing', async () => {
    const req = {}; // no rawBody property
    await expect(
      controller.handleWebhook('any-sig', req as any, {}),
    ).rejects.toThrow(ForbiddenException);
  });
});
