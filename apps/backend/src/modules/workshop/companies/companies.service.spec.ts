import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CompaniesService } from './companies.service';
import { TenancyService } from '../../core/tenancy/tenancy.service';
import { TenantEntity, TenantStatus } from '../../core/tenancy/tenant.entity';

const mockTenantRepo = {
  save: jest.fn(),
};

const mockTenancyService = {
  findById: jest.fn(),
};

describe('CompaniesService', () => {
  let service: CompaniesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CompaniesService,
        { provide: TenancyService, useValue: mockTenancyService },
        { provide: getRepositoryToken(TenantEntity), useValue: mockTenantRepo },
      ],
    }).compile();

    service = module.get<CompaniesService>(CompaniesService);
    jest.clearAllMocks();
  });

  describe('getProfile', () => {
    it('should return tenant as company profile', async () => {
      const tenant = { id: 'tenant-1', nomeFantasia: 'Auto Center', status: TenantStatus.ACTIVE };
      mockTenancyService.findById.mockResolvedValue(tenant);

      const result = await service.getProfile('tenant-1');
      expect(result).toEqual(tenant);
      expect(mockTenancyService.findById).toHaveBeenCalledWith('tenant-1');
    });

    it('should throw NotFoundException when tenant not found', async () => {
      mockTenancyService.findById.mockResolvedValue(null);
      await expect(service.getProfile('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateProfile', () => {
    it('should update and return the updated tenant', async () => {
      const tenant = {
        id: 'tenant-1',
        nomeFantasia: 'Auto Center',
        telefone: '11999999999',
        status: TenantStatus.ACTIVE,
      };
      mockTenancyService.findById.mockResolvedValue(tenant);
      mockTenantRepo.save.mockResolvedValue({ ...tenant, nomeFantasia: 'Auto Center Novo' });

      const result = await service.updateProfile('tenant-1', { nomeFantasia: 'Auto Center Novo' });
      expect(result.nomeFantasia).toBe('Auto Center Novo');
      expect(mockTenantRepo.save).toHaveBeenCalled();
    });
  });

  describe('updateLogo', () => {
    it('should update logo URL and return updated tenant', async () => {
      const tenant = { id: 'tenant-1', nomeFantasia: 'Auto Center', logoUrl: null as string | null };
      mockTenancyService.findById.mockResolvedValue(tenant);
      mockTenantRepo.save.mockResolvedValue({ ...tenant, logoUrl: '/uploads/logos/test.png' });

      const result = await service.updateLogo('tenant-1', '/uploads/logos/test.png');
      expect(result.logoUrl).toBe('/uploads/logos/test.png');
    });
  });
});
