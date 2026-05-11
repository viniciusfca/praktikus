import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { BillingService } from './billing.service';
import { BillingEntity } from './billing.entity';
import { BillingInvoiceEntity } from './billing-invoice.entity';
import { AsaasClient } from './asaas.client';
import { TenancyService } from '../tenancy/tenancy.service';
import { MailService } from '../mail/mail.service';

const mockBillingRepo = {
  findOne: jest.fn(),
  save: jest.fn(),
  create: jest.fn(),
  find: jest.fn(),
};
const mockInvoiceRepo = {
  findOne: jest.fn(),
  save: jest.fn(),
  create: jest.fn(),
  find: jest.fn(),
  update: jest.fn(),
};
const mockTenancyService = { findById: jest.fn(), updateStatus: jest.fn() };
const mockAsaasClient = {
  isMock: true,
  post: jest.fn(),
  get: jest.fn(),
  patch: jest.fn(),
  delete: jest.fn(),
};
const mockMailService = {
  sendTrialExpiringWarning: jest.fn(),
  sendTrialExpiringTomorrow: jest.fn(),
  sendAccountSuspended: jest.fn(),
  sendAccountReactivated: jest.fn(),
  sendPaymentRefundIssue: jest.fn(),
};
const mockConfig = {
  get: jest.fn((key: string, def?: any) => {
    const map: Record<string, string> = {
      ASAAS_API_KEY: 'mock',
      ASAAS_API_URL: 'https://sandbox.asaas.com/api/v3',
      ASAAS_PLAN_VALUE: '89.90',
    };
    return map[key] ?? def;
  }),
};

describe('BillingService', () => {
  let service: BillingService;

  beforeEach(async () => {
    // Reset mocks between tests
    mockBillingRepo.findOne.mockReset();
    mockBillingRepo.save.mockReset();
    mockBillingRepo.create.mockReset();
    mockBillingRepo.find.mockReset();
    mockInvoiceRepo.findOne.mockReset();
    mockInvoiceRepo.save.mockReset();
    mockInvoiceRepo.create.mockReset();
    mockInvoiceRepo.find.mockReset();
    mockInvoiceRepo.update.mockReset();
    mockTenancyService.findById.mockReset();
    mockTenancyService.updateStatus.mockReset();
    mockAsaasClient.post.mockReset();
    mockAsaasClient.get.mockReset();
    mockAsaasClient.patch.mockReset();
    mockAsaasClient.delete.mockReset();
    mockAsaasClient.isMock = true;
    mockMailService.sendTrialExpiringWarning.mockReset();
    mockMailService.sendTrialExpiringTomorrow.mockReset();
    mockMailService.sendAccountSuspended.mockReset();
    mockMailService.sendAccountReactivated.mockReset();
    mockMailService.sendPaymentRefundIssue.mockReset();
    mockConfig.get.mockImplementation((key: string, def?: any) => {
      const map: Record<string, string> = {
        ASAAS_API_KEY: 'mock',
        ASAAS_API_URL: 'https://sandbox.asaas.com/api/v3',
        ASAAS_PLAN_VALUE: '89.90',
      };
      return map[key] ?? def;
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillingService,
        {
          provide: getRepositoryToken(BillingEntity),
          useValue: mockBillingRepo,
        },
        {
          provide: getRepositoryToken(BillingInvoiceEntity),
          useValue: mockInvoiceRepo,
        },
        { provide: TenancyService, useValue: mockTenancyService },
        { provide: ConfigService, useValue: mockConfig },
        { provide: AsaasClient, useValue: mockAsaasClient },
        { provide: MailService, useValue: mockMailService },
      ],
    }).compile();
    service = module.get<BillingService>(BillingService);
  });

  describe('applyAnnualAdjustment', () => {
    it('should skip tenants whose billingAnchorDate does not match today', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      mockBillingRepo.find.mockResolvedValue([
        { tenantId: 'tenant-1', asaasSubscriptionId: 'sub-1' },
      ]);
      mockTenancyService.findById.mockResolvedValue({
        id: 'tenant-1',
        billingAnchorDate: yesterday,
        status: 'ACTIVE',
      });
      const fetchSpy = jest
        .spyOn(global, 'fetch' as any)
        .mockResolvedValue({} as any);

      await service.applyAnnualAdjustment();

      expect(fetchSpy).not.toHaveBeenCalled();
      expect(mockAsaasClient.patch).not.toHaveBeenCalled();
      fetchSpy.mockRestore();
    });

    it('should log MOCK adjustment when isMock is true and billingAnchorDate matches today', async () => {
      const today = new Date();

      mockBillingRepo.find.mockResolvedValue([
        { tenantId: 'tenant-1', asaasSubscriptionId: 'sub-1' },
      ]);
      mockTenancyService.findById.mockResolvedValue({
        id: 'tenant-1',
        billingAnchorDate: today,
        status: 'ACTIVE',
      });
      mockAsaasClient.isMock = true;

      const ibgeResponse = [
        { resultados: [{ series: [{ serie: { '202303': '5.19' } }] }] },
      ];
      const fetchSpy = jest.spyOn(global, 'fetch' as any).mockResolvedValue({
        ok: true,
        json: async () => ibgeResponse,
      } as any);

      const logSpy = jest.spyOn((service as any).logger, 'log');

      await service.applyAnnualAdjustment();

      expect(fetchSpy).toHaveBeenCalledTimes(1); // IBGE only, not Asaas
      expect(mockAsaasClient.patch).not.toHaveBeenCalled();
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('[MOCK]'));
      fetchSpy.mockRestore();
    });

    it('should skip adjustment and log error when IBGE API fails', async () => {
      const today = new Date();

      mockBillingRepo.find.mockResolvedValue([
        { tenantId: 'tenant-1', asaasSubscriptionId: 'sub-1' },
      ]);
      mockTenancyService.findById.mockResolvedValue({
        id: 'tenant-1',
        billingAnchorDate: today,
        status: 'ACTIVE',
      });
      mockAsaasClient.isMock = true;

      const fetchSpy = jest.spyOn(global, 'fetch' as any).mockResolvedValue({
        ok: false,
        status: 503,
      } as any);

      const errorSpy = jest.spyOn((service as any).logger, 'error');

      await service.applyAnnualAdjustment();

      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('IBGE'));
      fetchSpy.mockRestore();
    });

    it('skips tenant whose anchor month does not match current month', async () => {
      const realDateNow = Date.now;
      Date.now = () => new Date('2026-01-15T09:00:00Z').getTime();

      mockBillingRepo.find.mockResolvedValue([
        {
          tenantId: 't1',
          asaasSubscriptionId: 'sub_1',
        },
      ]);
      mockTenancyService.findById.mockResolvedValue({
        billingAnchorDate: new Date('2025-03-15'),
      });
      mockAsaasClient.isMock = false;

      await service.applyAnnualAdjustment();

      expect(mockAsaasClient.patch).not.toHaveBeenCalled();
      Date.now = realDateNow;
    });
  });

  describe('setupTrial', () => {
    beforeEach(() => {
      mockBillingRepo.create.mockImplementation((x: any) => x);
      mockBillingRepo.save.mockResolvedValue({});
    });

    it('passes cpfCnpj to Asaas customer creation', async () => {
      // ensure NOT mock mode for this test
      mockAsaasClient.isMock = false;
      mockConfig.get.mockImplementation((k: string, d?: string) => {
        const map: Record<string, string> = {
          ASAAS_API_KEY: 'real',
          ASAAS_API_URL: 'https://sandbox.asaas.com/api/v3',
          ASAAS_PLAN_VALUE: '89.90',
        };
        return map[k] ?? d;
      });
      mockAsaasClient.post
        .mockResolvedValueOnce({ id: 'cus_1' })
        .mockResolvedValueOnce({ id: 'sub_1' });

      await service.setupTrial(
        'tenant-1',
        'a@b.com',
        'Foo Ltda',
        '12345678901234',
      );

      expect(mockAsaasClient.post).toHaveBeenNthCalledWith(1, '/customers', {
        name: 'Foo Ltda',
        email: 'a@b.com',
        cpfCnpj: '12345678901234',
      });
    });

    it('creates subscription with billingType UNDEFINED and value from env', async () => {
      mockAsaasClient.isMock = false;
      mockConfig.get.mockImplementation((k: string, d?: string) => {
        const map: Record<string, string> = {
          ASAAS_API_KEY: 'real',
          ASAAS_API_URL: 'https://sandbox.asaas.com/api/v3',
          ASAAS_PLAN_VALUE: '89.90',
        };
        return map[k] ?? d;
      });
      mockAsaasClient.post
        .mockResolvedValueOnce({ id: 'cus_1' })
        .mockResolvedValueOnce({ id: 'sub_1' });

      await service.setupTrial(
        'tenant-1',
        'a@b.com',
        'Foo Ltda',
        '12345678901234',
      );

      expect(mockAsaasClient.post).toHaveBeenNthCalledWith(
        2,
        '/subscriptions',
        expect.objectContaining({
          customer: 'cus_1',
          billingType: 'UNDEFINED',
          value: 89.9,
          cycle: 'MONTHLY',
          description: 'Plano Praktikus — R$89,90/mês',
          trialPeriodDays: 30,
        }),
      );
    });

    it('uses mock IDs when AsaasClient is in mock mode', async () => {
      mockAsaasClient.isMock = true;
      await service.setupTrial(
        'tenant-1',
        'a@b.com',
        'Foo Ltda',
        '12345678901234',
      );
      expect(mockBillingRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-1',
          asaasCustomerId: 'mock_customer_tenant-1',
          asaasSubscriptionId: 'mock_subscription_tenant-1',
        }),
      );
    });
  });

  describe('isMockMode', () => {
    it('should be in mock mode when AsaasClient.isMock is true', () => {
      expect((service as any).isMock).toBe(true);
    });
  });

  describe('getCurrentBilling', () => {
    it('returns trial summary with daysUntilTrialEnds when status TRIAL', async () => {
      const trialEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      mockTenancyService.findById.mockResolvedValue({
        id: 't1',
        status: 'TRIAL',
        trialEndsAt: trialEnd,
        billingAnchorDate: null,
      });
      mockBillingRepo.findOne.mockResolvedValue({
        tenantId: 't1',
        billingType: null,
        cardLast4: null,
        cardBrand: null,
        cardExpiry: null,
        nextDueDate: null,
        canceledAt: null,
      });
      mockConfig.get.mockImplementation((k: string, d?: any) =>
        k === 'ASAAS_PLAN_VALUE' ? '89.90' : d,
      );

      const summary = await service.getCurrentBilling('t1');

      expect(summary.status).toBe('TRIAL');
      expect(summary.planValue).toBe(89.9);
      expect(summary.daysUntilTrialEnds).toBe(7);
      expect(summary.card).toBeNull();
    });

    it('returns card info when billingType is CREDIT_CARD', async () => {
      mockTenancyService.findById.mockResolvedValue({
        id: 't1',
        status: 'ACTIVE',
        trialEndsAt: null,
        billingAnchorDate: new Date(),
      });
      mockBillingRepo.findOne.mockResolvedValue({
        tenantId: 't1',
        billingType: 'CREDIT_CARD',
        cardLast4: '1234',
        cardBrand: 'VISA',
        cardExpiry: '12/29',
        nextDueDate: new Date('2026-06-15'),
        canceledAt: null,
      });
      mockConfig.get.mockImplementation((k: string, d?: any) =>
        k === 'ASAAS_PLAN_VALUE' ? '89.90' : d,
      );

      const summary = await service.getCurrentBilling('t1');

      expect(summary.card).toEqual({
        last4: '1234',
        brand: 'VISA',
        expiry: '12/29',
      });
    });
  });

  describe('getOpenInvoice', () => {
    it('returns null when no PENDING/OVERDUE invoice exists', async () => {
      mockInvoiceRepo.findOne.mockResolvedValue(null);
      expect(await service.getOpenInvoice('t1')).toBeNull();
    });

    it('returns invoice with cached PIX when valid', async () => {
      mockInvoiceRepo.findOne.mockResolvedValue({
        id: 'inv1',
        asaasPaymentId: 'pay_1',
        value: '89.90',
        dueDate: new Date(),
        status: 'PENDING',
        billingType: 'PIX',
        pixQrCode: 'BASE64',
        pixCopyPaste: '00020126',
        pixExpiresAt: new Date(Date.now() + 3600000),
      });
      const result = await service.getOpenInvoice('t1');
      expect(result?.pix).toEqual({
        qrCodeBase64: 'BASE64',
        copyPaste: '00020126',
      });
    });

    it('regenerates PIX when cache expired', async () => {
      mockAsaasClient.isMock = false;
      mockInvoiceRepo.findOne.mockResolvedValue({
        id: 'inv1',
        tenantId: 't1',
        asaasPaymentId: 'pay_1',
        value: '89.90',
        dueDate: new Date(),
        status: 'PENDING',
        billingType: 'PIX',
        pixQrCode: 'OLD',
        pixCopyPaste: 'OLD',
        pixExpiresAt: new Date(Date.now() - 1000),
      });
      mockAsaasClient.get.mockResolvedValue({
        encodedImage: 'NEW64',
        payload: '00020NEW',
        expirationDate: new Date(Date.now() + 86400000).toISOString(),
      });
      mockInvoiceRepo.save.mockImplementation((x: any) => x);

      const result = await service.getOpenInvoice('t1');
      expect(result?.pix?.qrCodeBase64).toBe('NEW64');
    });
  });

  describe('listPaidInvoices', () => {
    it('returns last 12 CONFIRMED invoices ordered by paidAt DESC', async () => {
      mockInvoiceRepo.find.mockResolvedValue([
        {
          id: 'a',
          value: '89.90',
          paidAt: new Date('2026-04-01'),
          billingType: 'PIX',
          status: 'CONFIRMED',
          asaasPaymentId: 'p1',
          dueDate: new Date(),
        },
      ]);
      const list = await service.listPaidInvoices('t1', 12);
      expect(mockInvoiceRepo.find).toHaveBeenCalledWith({
        where: { tenantId: 't1', status: 'CONFIRMED' },
        order: { paidAt: 'DESC' },
        take: 12,
      });
      expect(list).toHaveLength(1);
    });
  });

  describe('createCheckoutSessionForCard', () => {
    beforeEach(() => {
      mockAsaasClient.isMock = false;
      mockConfig.get.mockImplementation((k: string, d?: string) => {
        const map: Record<string, string> = {
          ASAAS_API_KEY: 'real',
          ASAAS_PLAN_VALUE: '89.90',
          ASAAS_CHECKOUT_SUCCESS_URL: 'https://app/success',
          ASAAS_CHECKOUT_CANCEL_URL: 'https://app/cancel',
          ASAAS_CHECKOUT_EXPIRED_URL: 'https://app/expired',
          ASAAS_CHECKOUT_EXPIRE_MINUTES: '30',
        };
        return map[k] ?? d;
      });
    });

    it('uses trialEndsAt as nextDueDate when tenant in TRIAL', async () => {
      const trialEnd = new Date('2026-06-04');
      mockTenancyService.findById.mockResolvedValue({
        id: 't1',
        status: 'TRIAL',
        trialEndsAt: trialEnd,
        cnpj: '12345678901234',
        nomeFantasia: 'Foo',
        razaoSocial: 'Foo Ltda',
      });
      mockBillingRepo.findOne.mockResolvedValue({ asaasCustomerId: 'cus_1' });
      mockAsaasClient.post.mockResolvedValue({
        id: 'chk_1',
        link: 'https://asaas/checkout/1',
      });

      await service.createCheckoutSessionForCard('t1', 'a@b.com');

      expect(mockAsaasClient.post).toHaveBeenCalledWith(
        '/checkouts',
        expect.objectContaining({
          billingTypes: ['CREDIT_CARD'],
          chargeTypes: ['RECURRENT'],
          subscription: expect.objectContaining({ nextDueDate: '2026-06-04' }),
          externalReference: 'tenant_t1',
        }),
      );
    });

    it('uses today+30 as nextDueDate when tenant ACTIVE', async () => {
      mockTenancyService.findById.mockResolvedValue({
        id: 't1',
        status: 'ACTIVE',
        trialEndsAt: null,
        cnpj: '12345678901234',
        nomeFantasia: 'Foo',
        razaoSocial: 'Foo Ltda',
      });
      mockBillingRepo.findOne.mockResolvedValue({ asaasCustomerId: 'cus_1' });
      mockAsaasClient.post.mockResolvedValue({
        id: 'chk_1',
        link: 'https://asaas/2',
      });

      await service.createCheckoutSessionForCard('t1', 'a@b.com');

      const call = mockAsaasClient.post.mock.calls[0][1] as any;
      const expected = new Date();
      expected.setDate(expected.getDate() + 30);
      expect(call.subscription.nextDueDate).toBe(
        expected.toISOString().split('T')[0],
      );
    });

    it('returns mock URL in mock mode', async () => {
      mockAsaasClient.isMock = true;
      mockTenancyService.findById.mockResolvedValue({
        id: 't1',
        status: 'TRIAL',
        trialEndsAt: new Date(),
        cnpj: '12345678901234',
        nomeFantasia: 'Foo',
        razaoSocial: 'Foo Ltda',
      });
      mockBillingRepo.findOne.mockResolvedValue({ asaasCustomerId: 'cus_1' });

      const result = await service.createCheckoutSessionForCard(
        't1',
        'a@b.com',
      );
      expect(result.checkoutUrl).toMatch(/mock-checkout/);
      expect(result.sessionId).toMatch(/^mock_chk_/);
    });

    it('throws ConflictException when tenant status is SUSPENDED', async () => {
      mockAsaasClient.isMock = false;
      mockTenancyService.findById.mockResolvedValue({
        id: 't1',
        status: 'SUSPENDED',
        trialEndsAt: null,
        cnpj: '12345678901234',
        nomeFantasia: 'Foo',
      });
      mockBillingRepo.findOne.mockResolvedValue({ asaasCustomerId: 'cus_1' });

      await expect(
        service.createCheckoutSessionForCard('t1', 'a@b.com'),
      ).rejects.toThrow(
        /Cannot create card checkout for tenant in status SUSPENDED/,
      );
    });
  });

  describe('createCheckoutSessionForInvoice', () => {
    it('calls checkoutPayment endpoint for given invoice', async () => {
      mockAsaasClient.isMock = false;
      mockInvoiceRepo.findOne.mockResolvedValue({
        id: 'inv1',
        asaasPaymentId: 'pay_1',
        tenantId: 't1',
      });
      mockAsaasClient.post.mockResolvedValue({
        link: 'https://asaas/inv-pay/1',
      });

      const result = await service.createCheckoutSessionForInvoice(
        't1',
        'inv1',
      );

      expect(mockAsaasClient.post).toHaveBeenCalledWith(
        '/payments/pay_1/checkoutPayment',
        {},
      );
      expect(result.checkoutUrl).toBe('https://asaas/inv-pay/1');
    });

    it('throws if invoice belongs to another tenant', async () => {
      mockInvoiceRepo.findOne.mockResolvedValue({
        id: 'inv1',
        asaasPaymentId: 'pay_1',
        tenantId: 'OTHER',
      });
      await expect(
        service.createCheckoutSessionForInvoice('t1', 'inv1'),
      ).rejects.toThrow(/not found/i);
    });
  });
});
