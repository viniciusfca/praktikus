import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { TenancyService } from '../tenancy/tenancy.service';
import { MailService } from '../mail/mail.service';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'node:crypto';
import { TenantStatus } from '../tenancy/tenant.entity';

const WEBHOOK_SECRET = 'test-secret';

const mockBillingService = {
  findTenantIdBySubscriptionId: jest.fn(),
  syncInvoiceFromWebhook: jest.fn(),
  syncCardFromWebhook: jest.fn(),
  getCurrentBilling: jest.fn(),
  listPaidInvoices: jest.fn(),
  getOpenInvoice: jest.fn(),
  generatePixForInvoice: jest.fn(),
  createCheckoutSessionForCard: jest.fn(),
  createCheckoutSessionForInvoice: jest.fn(),
  removeCard: jest.fn(),
  cancelSubscription: jest.fn(),
  reactivateSubscription: jest.fn(),
};
const mockTenancyService = {
  updateStatus: jest.fn(),
  findById: jest.fn(),
  findOwnerByTenantId: jest.fn(),
};
const mockMailService = {
  sendAccountReactivated: jest.fn(),
};
const mockConfigService = {
  get: jest.fn().mockImplementation((key: string, fallback?: string) => {
    if (key === 'ASAAS_WEBHOOK_TOKEN') return WEBHOOK_SECRET;
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
        { provide: MailService, useValue: mockMailService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    controller = module.get<BillingController>(BillingController);
    jest.clearAllMocks();
  });

  describe('webhook signature validation', () => {
    it('should throw ForbiddenException for invalid signature', async () => {
      const rawBody = '{"event":"PAYMENT_RECEIVED"}';
      await expect(
        controller.webhook('00', JSON.parse(rawBody), makeRawReq(rawBody)),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when rawBody is missing', async () => {
      const req = {}; // no rawBody property
      await expect(
        controller.webhook('any-sig', {}, req as any),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when signature header is missing', async () => {
      const rawBody = '{"event":"PAYMENT_RECEIVED"}';
      await expect(
        controller.webhook(undefined, JSON.parse(rawBody), makeRawReq(rawBody)),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('webhook status events', () => {
    it('should update status to ACTIVE on PAYMENT_RECEIVED', async () => {
      const payload = {
        event: 'PAYMENT_RECEIVED',
        payment: { id: 'pay-1', subscription: 'sub-1' },
      };
      const rawBody = JSON.stringify(payload);
      const sig = makeSignature(rawBody, WEBHOOK_SECRET);
      mockBillingService.findTenantIdBySubscriptionId.mockResolvedValue(
        'tenant-1',
      );
      mockTenancyService.findById.mockResolvedValue({
        id: 'tenant-1',
        status: TenantStatus.ACTIVE,
      });

      await controller.webhook(sig, payload, makeRawReq(rawBody));

      expect(mockTenancyService.updateStatus).toHaveBeenCalledWith(
        'tenant-1',
        TenantStatus.ACTIVE,
      );
    });

    it('should update status to ACTIVE on PAYMENT_CONFIRMED', async () => {
      const payload = {
        event: 'PAYMENT_CONFIRMED',
        payment: { id: 'pay-1', subscription: 'sub-1' },
      };
      const rawBody = JSON.stringify(payload);
      const sig = makeSignature(rawBody, WEBHOOK_SECRET);
      mockBillingService.findTenantIdBySubscriptionId.mockResolvedValue(
        'tenant-1',
      );
      mockTenancyService.findById.mockResolvedValue({
        id: 'tenant-1',
        status: TenantStatus.ACTIVE,
      });

      await controller.webhook(sig, payload, makeRawReq(rawBody));

      expect(mockTenancyService.updateStatus).toHaveBeenCalledWith(
        'tenant-1',
        TenantStatus.ACTIVE,
      );
    });

    it('should update status to OVERDUE on PAYMENT_OVERDUE', async () => {
      const payload = {
        event: 'PAYMENT_OVERDUE',
        payment: { id: 'pay-1', subscription: 'sub-1' },
      };
      const rawBody = JSON.stringify(payload);
      const sig = makeSignature(rawBody, WEBHOOK_SECRET);
      mockBillingService.findTenantIdBySubscriptionId.mockResolvedValue(
        'tenant-1',
      );
      mockTenancyService.findById.mockResolvedValue({
        id: 'tenant-1',
        status: TenantStatus.ACTIVE,
      });

      await controller.webhook(sig, payload, makeRawReq(rawBody));

      expect(mockTenancyService.updateStatus).toHaveBeenCalledWith(
        'tenant-1',
        TenantStatus.OVERDUE,
      );
    });

    it('should update status to SUSPENDED on SUBSCRIPTION_INACTIVATED', async () => {
      const payload = {
        event: 'SUBSCRIPTION_INACTIVATED',
        subscription: { id: 'sub-1' },
      };
      const rawBody = JSON.stringify(payload);
      const sig = makeSignature(rawBody, WEBHOOK_SECRET);
      mockBillingService.findTenantIdBySubscriptionId.mockResolvedValue(
        'tenant-1',
      );
      mockTenancyService.findById.mockResolvedValue({
        id: 'tenant-1',
        status: TenantStatus.ACTIVE,
      });

      await controller.webhook(sig, payload, makeRawReq(rawBody));

      expect(mockTenancyService.updateStatus).toHaveBeenCalledWith(
        'tenant-1',
        TenantStatus.SUSPENDED,
      );
    });

    it('should ignore unknown events without updating status', async () => {
      const payload = { event: 'UNKNOWN_EVENT' };
      const rawBody = JSON.stringify(payload);
      const sig = makeSignature(rawBody, WEBHOOK_SECRET);

      await expect(
        controller.webhook(sig, payload, makeRawReq(rawBody)),
      ).resolves.toBeUndefined();
      expect(mockTenancyService.updateStatus).not.toHaveBeenCalled();
      expect(mockBillingService.syncInvoiceFromWebhook).not.toHaveBeenCalled();
    });

    it('should NOT call updateStatus when subscription is unknown', async () => {
      const payload = {
        event: 'PAYMENT_RECEIVED',
        payment: { id: 'pay-1', subscription: 'sub-unknown' },
      };
      const rawBody = JSON.stringify(payload);
      const sig = makeSignature(rawBody, WEBHOOK_SECRET);
      mockBillingService.findTenantIdBySubscriptionId.mockResolvedValue(null);

      await expect(
        controller.webhook(sig, payload, makeRawReq(rawBody)),
      ).resolves.toBeUndefined();
      expect(mockTenancyService.updateStatus).not.toHaveBeenCalled();
    });

    it('should NOT call findTenantId when status event has no subscriptionId', async () => {
      const payload = { event: 'PAYMENT_RECEIVED', payment: { id: 'pay-1' } };
      const rawBody = JSON.stringify(payload);
      const sig = makeSignature(rawBody, WEBHOOK_SECRET);

      await expect(
        controller.webhook(sig, payload, makeRawReq(rawBody)),
      ).resolves.toBeUndefined();
      // syncInvoiceFromWebhook should still run (event is in INVOICE_EVENTS)
      expect(mockBillingService.syncInvoiceFromWebhook).toHaveBeenCalled();
      expect(
        mockBillingService.findTenantIdBySubscriptionId,
      ).not.toHaveBeenCalled();
      expect(mockTenancyService.updateStatus).not.toHaveBeenCalled();
    });
  });

  describe('webhook invoice events', () => {
    it('handles PAYMENT_CREATED — calls syncInvoiceFromWebhook and not updateStatus', async () => {
      const payload = {
        event: 'PAYMENT_CREATED',
        payment: {
          id: 'pay-1',
          subscription: 'sub-1',
          value: 89.9,
          dueDate: '2026-06-15',
          status: 'PENDING',
          billingType: 'PIX',
        },
      };
      const rawBody = JSON.stringify(payload);
      const sig = makeSignature(rawBody, WEBHOOK_SECRET);

      await controller.webhook(sig, payload, makeRawReq(rawBody));

      expect(mockBillingService.syncInvoiceFromWebhook).toHaveBeenCalledWith(
        payload,
      );
      expect(mockTenancyService.updateStatus).not.toHaveBeenCalled();
    });

    it('handles PAYMENT_REFUNDED — invoice synced and tenant goes OVERDUE', async () => {
      mockBillingService.findTenantIdBySubscriptionId.mockResolvedValue('t1');
      mockTenancyService.findById.mockResolvedValue({
        id: 't1',
        status: TenantStatus.ACTIVE,
      });
      const payload = {
        event: 'PAYMENT_REFUNDED',
        payment: { id: 'pay-1', subscription: 'sub-1', status: 'REFUNDED' },
      };
      const rawBody = JSON.stringify(payload);
      const sig = makeSignature(rawBody, WEBHOOK_SECRET);

      await controller.webhook(sig, payload, makeRawReq(rawBody));

      expect(mockBillingService.syncInvoiceFromWebhook).toHaveBeenCalled();
      expect(mockTenancyService.updateStatus).toHaveBeenCalledWith(
        't1',
        TenantStatus.OVERDUE,
      );
    });

    it('handles PAYMENT_DELETED — invoice synced, no status change', async () => {
      const payload = {
        event: 'PAYMENT_DELETED',
        payment: { id: 'pay-1', subscription: 'sub-1' },
      };
      const rawBody = JSON.stringify(payload);
      const sig = makeSignature(rawBody, WEBHOOK_SECRET);

      await controller.webhook(sig, payload, makeRawReq(rawBody));

      expect(mockBillingService.syncInvoiceFromWebhook).toHaveBeenCalledWith(
        payload,
      );
      expect(mockTenancyService.updateStatus).not.toHaveBeenCalled();
    });
  });

  describe('webhook checkout events', () => {
    it('handles CHECKOUT_PAID — syncs card', async () => {
      const payload = {
        event: 'CHECKOUT_PAID',
        checkout: {
          externalReference: 'tenant_t1',
          subscription: { id: 'sub_new' },
          creditCard: {
            creditCardNumber: '1234',
            creditCardBrand: 'VISA',
            expirationDate: '12/29',
          },
        },
      };
      const rawBody = JSON.stringify(payload);
      const sig = makeSignature(rawBody, WEBHOOK_SECRET);

      await controller.webhook(sig, payload, makeRawReq(rawBody));

      expect(mockBillingService.syncCardFromWebhook).toHaveBeenCalledWith(
        payload,
      );
    });

    it('handles CHECKOUT_EXPIRED — only logs, no state change', async () => {
      const payload = { event: 'CHECKOUT_EXPIRED', checkout: { id: 'chk_1' } };
      const rawBody = JSON.stringify(payload);
      const sig = makeSignature(rawBody, WEBHOOK_SECRET);

      await controller.webhook(sig, payload, makeRawReq(rawBody));

      expect(mockBillingService.syncInvoiceFromWebhook).not.toHaveBeenCalled();
      expect(mockBillingService.syncCardFromWebhook).not.toHaveBeenCalled();
      expect(mockTenancyService.updateStatus).not.toHaveBeenCalled();
    });
  });

  describe('reactivation email', () => {
    it('triggers reactivation email when PAYMENT_CONFIRMED for SUSPENDED tenant', async () => {
      mockBillingService.findTenantIdBySubscriptionId.mockResolvedValue('t1');
      mockTenancyService.findById.mockResolvedValue({
        id: 't1',
        status: TenantStatus.SUSPENDED,
      });
      mockTenancyService.findOwnerByTenantId.mockResolvedValue({
        email: 'owner@example.com',
        name: 'Owner Foo',
      });
      const payload = {
        event: 'PAYMENT_CONFIRMED',
        payment: { id: 'pay-1', subscription: 'sub-1' },
      };
      const rawBody = JSON.stringify(payload);
      const sig = makeSignature(rawBody, WEBHOOK_SECRET);

      await controller.webhook(sig, payload, makeRawReq(rawBody));

      expect(mockMailService.sendAccountReactivated).toHaveBeenCalledWith(
        'owner@example.com',
        'Owner Foo',
      );
    });

    it('triggers reactivation email when PAYMENT_RECEIVED for OVERDUE tenant', async () => {
      mockBillingService.findTenantIdBySubscriptionId.mockResolvedValue('t1');
      mockTenancyService.findById.mockResolvedValue({
        id: 't1',
        status: TenantStatus.OVERDUE,
      });
      mockTenancyService.findOwnerByTenantId.mockResolvedValue({
        email: 'owner@example.com',
        name: 'Owner Foo',
      });
      const payload = {
        event: 'PAYMENT_RECEIVED',
        payment: { id: 'pay-1', subscription: 'sub-1' },
      };
      const rawBody = JSON.stringify(payload);
      const sig = makeSignature(rawBody, WEBHOOK_SECRET);

      await controller.webhook(sig, payload, makeRawReq(rawBody));

      expect(mockMailService.sendAccountReactivated).toHaveBeenCalled();
    });

    it('does NOT send reactivation email when tenant was already ACTIVE', async () => {
      mockBillingService.findTenantIdBySubscriptionId.mockResolvedValue('t1');
      mockTenancyService.findById.mockResolvedValue({
        id: 't1',
        status: TenantStatus.ACTIVE,
      });
      const payload = {
        event: 'PAYMENT_CONFIRMED',
        payment: { id: 'pay-1', subscription: 'sub-1' },
      };
      const rawBody = JSON.stringify(payload);
      const sig = makeSignature(rawBody, WEBHOOK_SECRET);

      await controller.webhook(sig, payload, makeRawReq(rawBody));

      expect(mockMailService.sendAccountReactivated).not.toHaveBeenCalled();
    });
  });

  // ---------- REST endpoints (smoke tests) ----------

  describe('GET /billing', () => {
    it('returns billing summary for tenant', async () => {
      mockBillingService.getCurrentBilling.mockResolvedValue({
        status: 'TRIAL',
        planName: 'Plano Praktikus',
        planValue: 89.9,
        billingType: null,
        card: null,
        nextDueDate: null,
        trialEndsAt: '2026-06-04',
        daysUntilTrialEnds: 7,
        canceledAt: null,
      });
      const result = await controller.getCurrent({
        user: { tenantId: 't1', email: 'a@b.com' },
      } as any);
      expect(result.daysUntilTrialEnds).toBe(7);
      expect(mockBillingService.getCurrentBilling).toHaveBeenCalledWith('t1');
    });
  });

  describe('GET /billing/invoices', () => {
    it('returns paid invoices for tenant', async () => {
      mockBillingService.listPaidInvoices.mockResolvedValue([
        {
          id: 'inv-1',
          asaasPaymentId: 'pay-1',
          value: 89.9,
          dueDate: '2026-05-01',
          status: 'CONFIRMED',
          billingType: 'PIX',
          pix: null,
        },
      ]);
      const result = await controller.listInvoices({
        user: { tenantId: 't1' },
      } as any);
      expect(result).toHaveLength(1);
      expect(mockBillingService.listPaidInvoices).toHaveBeenCalledWith('t1');
    });
  });

  describe('GET /billing/invoices/open', () => {
    it('returns the open invoice if any', async () => {
      mockBillingService.getOpenInvoice.mockResolvedValue({
        id: 'inv-2',
        asaasPaymentId: 'pay-2',
        value: 89.9,
        dueDate: '2026-06-01',
        status: 'PENDING',
        billingType: 'PIX',
        pix: { qrCodeBase64: 'qr', copyPaste: 'cp' },
      });
      const result = await controller.openInvoice({
        user: { tenantId: 't1' },
      } as any);
      expect(result?.id).toBe('inv-2');
    });

    it('returns null when no open invoice', async () => {
      mockBillingService.getOpenInvoice.mockResolvedValue(null);
      const result = await controller.openInvoice({
        user: { tenantId: 't1' },
      } as any);
      expect(result).toBeNull();
    });
  });

  describe('POST /billing/invoices/:id/pix', () => {
    it('regenerates PIX for invoice (passing tenantId for ownership check)', async () => {
      mockBillingService.generatePixForInvoice.mockResolvedValue({
        qrCodeBase64: 'QR',
        copyPaste: 'CP',
      });
      const result = await controller.regeneratePix('inv-1', {
        user: { tenantId: 't1' },
      } as any);
      expect(result.qrCodeBase64).toBe('QR');
      expect(mockBillingService.generatePixForInvoice).toHaveBeenCalledWith(
        'inv-1',
        't1',
      );
    });
  });

  describe('POST /billing/checkout-session', () => {
    it('creates checkout session for card', async () => {
      mockBillingService.createCheckoutSessionForCard.mockResolvedValue({
        checkoutUrl: 'https://chk/abc',
        sessionId: 'sess-1',
      });
      const result = await controller.checkoutCard({
        user: { tenantId: 't1', email: 'a@b.com' },
      } as any);
      expect(result.sessionId).toBe('sess-1');
      expect(
        mockBillingService.createCheckoutSessionForCard,
      ).toHaveBeenCalledWith('t1', 'a@b.com');
    });
  });

  describe('POST /billing/invoices/:id/checkout', () => {
    it('creates checkout session for invoice', async () => {
      mockBillingService.createCheckoutSessionForInvoice.mockResolvedValue({
        checkoutUrl: 'https://chk/inv/abc',
        sessionId: 'pay-1',
      });
      const result = await controller.checkoutInvoice('inv-1', {
        user: { tenantId: 't1' },
      } as any);
      expect(result.checkoutUrl).toBe('https://chk/inv/abc');
      expect(
        mockBillingService.createCheckoutSessionForInvoice,
      ).toHaveBeenCalledWith('t1', 'inv-1');
    });
  });

  describe('DELETE /billing/card', () => {
    it('removes card and returns nothing', async () => {
      mockBillingService.removeCard.mockResolvedValue(undefined);
      const result = await controller.removeCard({
        user: { tenantId: 't1' },
      } as any);
      expect(result).toBeUndefined();
      expect(mockBillingService.removeCard).toHaveBeenCalledWith('t1');
    });
  });

  describe('POST /billing/cancel', () => {
    it('cancels subscription', async () => {
      mockBillingService.cancelSubscription.mockResolvedValue(undefined);
      const result = await controller.cancel({
        user: { tenantId: 't1' },
      } as any);
      expect(result).toBeUndefined();
      expect(mockBillingService.cancelSubscription).toHaveBeenCalledWith('t1');
    });
  });

  describe('POST /billing/reactivate', () => {
    it('reactivates subscription and returns checkout session', async () => {
      mockBillingService.reactivateSubscription.mockResolvedValue({
        checkoutUrl: 'https://chk/reactivate',
        sessionId: 'sess-2',
      });
      const result = await controller.reactivate({
        user: { tenantId: 't1', email: 'a@b.com' },
      } as any);
      expect(result.sessionId).toBe('sess-2');
      expect(mockBillingService.reactivateSubscription).toHaveBeenCalledWith(
        't1',
        'a@b.com',
      );
    });
  });
});
