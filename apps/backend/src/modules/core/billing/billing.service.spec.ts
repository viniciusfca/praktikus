import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { BillingService } from './billing.service';
import { BillingEntity } from './billing.entity';
import { TenancyService } from '../tenancy/tenancy.service';

const mockBillingRepo = { findOne: jest.fn(), save: jest.fn(), create: jest.fn(), find: jest.fn() };
const mockTenancyService = { findById: jest.fn(), updateStatus: jest.fn() };
const mockConfig = {
  get: jest.fn((key: string) => {
    const map: Record<string, string> = {
      ASAAS_API_KEY: 'mock',
      ASAAS_API_URL: 'https://sandbox.asaas.com/api/v3',
      ASAAS_PLAN_VALUE: '69.90',
    };
    return map[key];
  }),
};

describe('BillingService', () => {
  let service: BillingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillingService,
        { provide: getRepositoryToken(BillingEntity), useValue: mockBillingRepo },
        { provide: TenancyService, useValue: mockTenancyService },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();
    service = module.get<BillingService>(BillingService);
    jest.clearAllMocks();
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
      const fetchSpy = jest.spyOn(global, 'fetch' as any).mockResolvedValue({} as any);

      await service.applyAnnualAdjustment();

      expect(fetchSpy).not.toHaveBeenCalled();
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
      mockConfig.get.mockImplementation((key: string, def?: any) => {
        if (key === 'ASAAS_API_KEY') return 'mock'; // forces isMock = true
        if (key === 'ASAAS_PLAN_VALUE') return '69.90';
        return def;
      });

      const ibgeResponse = [{ resultados: [{ series: [{ serie: { '202303': '5.19' } }] }] }];
      const fetchSpy = jest.spyOn(global, 'fetch' as any).mockResolvedValue({
        ok: true,
        json: async () => ibgeResponse,
      } as any);

      const logSpy = jest.spyOn((service as any).logger, 'log');

      await service.applyAnnualAdjustment();

      expect(fetchSpy).toHaveBeenCalledTimes(1); // IBGE only, not Asaas
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
      mockConfig.get.mockImplementation((key: string, def?: any) => {
        if (key === 'ASAAS_API_KEY') return 'mock';
        if (key === 'ASAAS_PLAN_VALUE') return '69.90';
        return def;
      });

      const fetchSpy = jest.spyOn(global, 'fetch' as any).mockResolvedValue({
        ok: false,
        status: 503,
      } as any);

      const errorSpy = jest.spyOn((service as any).logger, 'error');

      await service.applyAnnualAdjustment();

      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('IBGE'));
      fetchSpy.mockRestore();
    });
  });

  describe('setupTrial', () => {
    it('should create billing record with mock IDs when ASAAS_API_KEY is "mock"', async () => {
      const billing = { id: 'billing-1', tenantId: 'tenant-1' };
      mockBillingRepo.create.mockReturnValue(billing);
      mockBillingRepo.save.mockResolvedValue(billing);

      await service.setupTrial('tenant-1', 'owner@test.com', 'Auto Center');

      expect(mockBillingRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: 'tenant-1' }),
      );
    });

    it('should set mock asaasCustomerId containing tenantId', async () => {
      const capturedArg: any = {};
      mockBillingRepo.create.mockImplementation((data: any) => {
        Object.assign(capturedArg, data);
        return data;
      });
      mockBillingRepo.save.mockResolvedValue({});

      await service.setupTrial('tenant-abc', 'owner@test.com', 'Auto Center');

      expect(capturedArg.asaasCustomerId).toContain('tenant-abc');
    });
  });

  describe('isMockMode', () => {
    it('should be in mock mode when ASAAS_API_KEY is "mock"', () => {
      expect((service as any).isMock).toBe(true);
    });
  });
});
