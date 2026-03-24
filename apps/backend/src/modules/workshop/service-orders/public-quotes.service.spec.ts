import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, GoneException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { PublicQuotesService } from './public-quotes.service';
import { ServiceOrderEntity } from './service-order.entity';

const TENANT_ID = '00000000-0000-0000-0000-000000000001';
const SO_ID = '00000000-0000-0000-0000-000000000010';
const TOKEN = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

const futureDate = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
const pastDate = new Date(Date.now() - 1000).toISOString();

const mockSoRepo = {
  findOne: jest.fn(),
  save: jest.fn(),
};

const mockSoItemServiceRepo = { find: jest.fn().mockResolvedValue([]) };
const mockSoItemPartRepo = { find: jest.fn().mockResolvedValue([]) };

const mockQueryRunner = {
  connect: jest.fn().mockResolvedValue(undefined),
  query: jest.fn().mockResolvedValue([]),
  manager: {
    getRepository: jest.fn((entity: any) => {
      if (entity?.name === 'ServiceOrderEntity') return mockSoRepo;
      if (entity?.name === 'SoItemServiceEntity') return mockSoItemServiceRepo;
      return mockSoItemPartRepo;
    }),
  },
  release: jest.fn().mockResolvedValue(undefined),
};

const mockDataSource = {
  createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
  query: jest.fn(),
};

describe('PublicQuotesService', () => {
  let service: PublicQuotesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PublicQuotesService,
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();
    service = module.get<PublicQuotesService>(PublicQuotesService);
    jest.clearAllMocks();
    mockQueryRunner.query.mockResolvedValue([]);
    mockQueryRunner.manager.getRepository.mockImplementation((entity: any) => {
      if (entity?.name === 'ServiceOrderEntity') return mockSoRepo;
      if (entity?.name === 'SoItemServiceEntity') return mockSoItemServiceRepo;
      return mockSoItemPartRepo;
    });
    mockSoItemServiceRepo.find.mockResolvedValue([]);
    mockSoItemPartRepo.find.mockResolvedValue([]);
  });

  describe('getQuote', () => {
    it('should return quote data for valid token', async () => {
      const tokenRow = [{ tenant_id: TENANT_ID, so_id: SO_ID, expires_at: futureDate, used_at: null }];
      const so = { id: SO_ID, status: 'ORCAMENTO', clienteId: 'c1', veiculoId: 'v1', createdAt: new Date() };
      mockDataSource.query
        .mockResolvedValueOnce(tokenRow)                               // lookupToken SELECT
        .mockResolvedValueOnce([{ nome_fantasia: 'Oficina X' }]);      // tenants SELECT
      mockQueryRunner.query
        .mockResolvedValueOnce(undefined)                              // SET search_path
        .mockResolvedValueOnce([{ nome: 'João' }])                     // customers SELECT
        .mockResolvedValueOnce([{ placa: 'ABC1234' }]);                // vehicles SELECT
      mockSoRepo.findOne.mockResolvedValue(so);
      const result = await service.getQuote(TOKEN);
      expect(result).toHaveProperty('so');
      expect(result).toHaveProperty('total');
    });

    it('should throw NotFoundException for unknown token', async () => {
      mockDataSource.query.mockResolvedValue([]);
      await expect(service.getQuote(TOKEN)).rejects.toThrow(NotFoundException);
    });

    it('should throw GoneException for expired token', async () => {
      mockDataSource.query.mockResolvedValue([
        { tenant_id: TENANT_ID, so_id: SO_ID, expires_at: pastDate, used_at: null },
      ]);
      await expect(service.getQuote(TOKEN)).rejects.toThrow(GoneException);
    });

    it('should throw ConflictException for already used token', async () => {
      mockDataSource.query.mockResolvedValue([
        { tenant_id: TENANT_ID, so_id: SO_ID, expires_at: futureDate, used_at: new Date().toISOString() },
      ]);
      await expect(service.getQuote(TOKEN)).rejects.toThrow(ConflictException);
    });
  });

  describe('approve', () => {
    it('should set status APROVADO and mark token used', async () => {
      const tokenRow = [{ tenant_id: TENANT_ID, so_id: SO_ID, expires_at: futureDate, used_at: null }];
      const so = { id: SO_ID, status: 'ORCAMENTO', approvalToken: TOKEN, approvalExpiresAt: new Date() };
      mockDataSource.query
        .mockResolvedValueOnce(tokenRow)    // lookupToken SELECT
        .mockResolvedValueOnce(undefined);  // UPDATE used_at
      mockSoRepo.findOne.mockResolvedValue(so);
      mockSoRepo.save.mockResolvedValue({ ...so, status: 'APROVADO' });
      await service.approve(TOKEN);
      expect(mockSoRepo.save).toHaveBeenCalledWith(expect.objectContaining({ status: 'APROVADO' }));
    });
  });
});
