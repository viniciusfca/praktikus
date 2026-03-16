import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { TenancyService } from './tenancy.service';
import { TenantEntity, TenantStatus } from './tenant.entity';

const mockQueryRunner = {
  connect: jest.fn(),
  query: jest.fn(),
  release: jest.fn(),
};

const mockDataSource = {
  createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
};

const mockTenantRepo = {
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
};

describe('TenancyService', () => {
  let service: TenancyService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenancyService,
        { provide: getRepositoryToken(TenantEntity), useValue: mockTenantRepo },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<TenancyService>(TenancyService);
    jest.clearAllMocks();
  });

  describe('generateSchemaName', () => {
    it('should generate a valid schema name from tenant id', () => {
      const name = service.generateSchemaName('abc123-def456-ghi789');
      expect(name).toBe('tenant_abc123def456ghi789');
    });

    it('should remove all dashes from the uuid', () => {
      const name = service.generateSchemaName('00000000-0000-0000-0000-000000000000');
      expect(name).toBe('tenant_00000000000000000000000000000000');
    });
  });

  describe('generateSlug', () => {
    it('should generate a URL-safe slug from nome fantasia', () => {
      const slug = service.generateSlug('Auto Center João & Silva');
      expect(slug).toMatch(/^[a-z0-9-]+$/);
      expect(slug).toContain('auto');
      expect(slug).toContain('center');
    });

    it('should handle accented characters', () => {
      const slug = service.generateSlug('Oficina Mecânica');
      expect(slug).toBe('oficina-mecanica');
    });

    it('should trim leading/trailing dashes', () => {
      const slug = service.generateSlug('  Test  ');
      expect(slug).not.toMatch(/^-|-$/);
    });
  });

  describe('createTenant', () => {
    it('should create tenant with TRIAL status and trialEndsAt 30 days from now', async () => {
      const input = {
        cnpj: '12345678000199',
        razaoSocial: 'Auto Center Ltda',
        nomeFantasia: 'Auto Center',
        telefone: '11999999999',
      };

      const pendingTenant = {
        id: 'uuid-1',
        ...input,
        status: TenantStatus.TRIAL,
        schemaName: 'pending',
        trialEndsAt: (() => { const d = new Date(); d.setDate(d.getDate() + 30); return d; })(),
      };
      const savedTenant = { ...pendingTenant, schemaName: 'tenant_uuid1' };

      mockTenantRepo.create.mockReturnValue(pendingTenant);
      mockTenantRepo.save
        .mockResolvedValueOnce(pendingTenant)
        .mockResolvedValueOnce(savedTenant);

      const result = await service.createTenant(input);

      expect(mockTenantRepo.save).toHaveBeenCalledTimes(2);
      expect(result.status).toBe(TenantStatus.TRIAL);
      // trialEndsAt should be ~30 days from now (allow 1 minute tolerance)
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
      const diff = Math.abs(result.trialEndsAt!.getTime() - thirtyDaysFromNow.getTime());
      expect(diff).toBeLessThan(60_000); // within 1 minute
      expect(mockQueryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining('CREATE SCHEMA IF NOT EXISTS'),
      );
    });
  });

  describe('provisionSchema security', () => {
    it('createTenant throws if generateSchemaName produces an invalid name', async () => {
      // Force generateSchemaName to return something invalid by mocking it
      jest.spyOn(service, 'generateSchemaName').mockReturnValue('tenant_bad"name');
      mockTenantRepo.create.mockReturnValue({ id: 'uuid-1', status: TenantStatus.TRIAL, schemaName: 'pending', trialEndsAt: new Date() });
      mockTenantRepo.save.mockResolvedValue({ id: 'uuid-1', status: TenantStatus.TRIAL, schemaName: 'pending', trialEndsAt: new Date() });

      const input = { cnpj: '12345678000199', razaoSocial: 'Test', nomeFantasia: 'Test' };
      await expect(service.createTenant(input)).rejects.toThrow('Invalid schema name');
    });
  });

  describe('findById', () => {
    it('should return tenant when found', async () => {
      const tenant = { id: 'uuid-1', nomeFantasia: 'Auto Center', status: TenantStatus.ACTIVE };
      mockTenantRepo.findOne.mockResolvedValue(tenant);

      const result = await service.findById('uuid-1');
      expect(result).toEqual(tenant);
      expect(mockTenantRepo.findOne).toHaveBeenCalledWith({ where: { id: 'uuid-1' } });
    });

    it('should return null when tenant not found', async () => {
      mockTenantRepo.findOne.mockResolvedValue(null);
      const result = await service.findById('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('findByCnpj', () => {
    it('should return tenant when found by CNPJ', async () => {
      const tenant = { id: 'uuid-1', cnpj: '12345678000199' };
      mockTenantRepo.findOne.mockResolvedValue(tenant);

      const result = await service.findByCnpj('12345678000199');
      expect(result).toEqual(tenant);
    });

    it('should return null when CNPJ not found', async () => {
      mockTenantRepo.findOne.mockResolvedValue(null);
      const result = await service.findByCnpj('00000000000000');
      expect(result).toBeNull();
    });
  });
});
