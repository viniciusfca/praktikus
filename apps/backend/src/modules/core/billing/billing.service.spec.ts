import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BillingService } from './billing.service';
import { BillingEntity } from './billing.entity';

const mockBillingRepo = {
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
};

const mockConfigService = {
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
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<BillingService>(BillingService);
    jest.clearAllMocks();
  });

  describe('setupTrial', () => {
    it('should create billing record with mock IDs when ASAAS_API_KEY is "mock"', async () => {
      const billing = { id: 'billing-1', tenantId: 'tenant-1' };
      mockBillingRepo.create.mockReturnValue(billing);
      mockBillingRepo.save.mockResolvedValue(billing);

      await service.setupTrial('tenant-1', 'owner@test.com', 'Auto Center');

      expect(mockBillingRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-1',
        }),
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
