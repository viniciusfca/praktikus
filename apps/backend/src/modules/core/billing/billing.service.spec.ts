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
});
