import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CashRegisterService } from './cash-register.service';
import { CashSessionEntity, CashSessionStatus } from './cash-session.entity';
import { CashTransactionEntity, TransactionType, PaymentMethod } from './cash-transaction.entity';

const mockSessionRepo = { findOne: jest.fn(), create: jest.fn(), save: jest.fn() };
const mockTxRepo = { create: jest.fn(), save: jest.fn(), find: jest.fn() };

const mockQueryRunner = {
  connect: jest.fn().mockResolvedValue(undefined),
  startTransaction: jest.fn().mockResolvedValue(undefined),
  commitTransaction: jest.fn().mockResolvedValue(undefined),
  rollbackTransaction: jest.fn().mockResolvedValue(undefined),
  query: jest.fn().mockResolvedValue(undefined),
  manager: {
    getRepository: jest.fn((entity) => {
      if (entity === CashSessionEntity) return mockSessionRepo;
      return mockTxRepo;
    }),
  },
  release: jest.fn().mockResolvedValue(undefined),
};
const mockDataSource = { createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner) };

const TENANT = '00000000-0000-0000-0000-000000000001';
const OPERATOR = '00000000-0000-0000-0000-000000000002';

describe('CashRegisterService', () => {
  let service: CashRegisterService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CashRegisterService, { provide: DataSource, useValue: mockDataSource }],
    }).compile();
    service = module.get<CashRegisterService>(CashRegisterService);
    jest.clearAllMocks();
    mockQueryRunner.manager.getRepository.mockImplementation((entity) => {
      if (entity === CashSessionEntity) return mockSessionRepo;
      return mockTxRepo;
    });
  });

  describe('open', () => {
    it('should open session with opening_balance = 0 when no previous session', async () => {
      mockSessionRepo.findOne
        .mockResolvedValueOnce(null)  // no open session
        .mockResolvedValueOnce(null); // no last closed session
      const newSession = { id: 's1', openingBalance: 0, status: CashSessionStatus.OPEN };
      mockSessionRepo.create.mockReturnValue(newSession);
      mockSessionRepo.save.mockResolvedValue(newSession);

      const result = await service.open(TENANT, OPERATOR);
      expect(result.openingBalance).toBe(0);
    });

    it('should throw BadRequestException when session already open', async () => {
      mockSessionRepo.findOne.mockResolvedValueOnce({ id: 's1', status: CashSessionStatus.OPEN });
      await expect(service.open(TENANT, OPERATOR)).rejects.toThrow(BadRequestException);
    });

    it('should set opening_balance from last closed session closing_balance', async () => {
      mockSessionRepo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ closingBalance: 150.00 });
      const newSession = { id: 's2', openingBalance: 150.00, status: CashSessionStatus.OPEN };
      mockSessionRepo.create.mockReturnValue(newSession);
      mockSessionRepo.save.mockResolvedValue(newSession);

      const result = await service.open(TENANT, OPERATOR);
      expect(result.openingBalance).toBe(150.00);
    });
  });

  describe('close', () => {
    it('should throw BadRequestException when no open session', async () => {
      mockSessionRepo.findOne.mockResolvedValue(null);
      await expect(service.close(TENANT, OPERATOR)).rejects.toThrow(BadRequestException);
    });

    it('should calculate closing_balance using only CASH transactions', async () => {
      const openSession = { id: 's1', openingBalance: 100, status: CashSessionStatus.OPEN };
      mockSessionRepo.findOne.mockResolvedValue(openSession);

      mockQueryRunner.query.mockImplementation(async (sql: string) => {
        if (sql.includes('SET search_path')) return undefined;
        if (sql.includes("type = 'IN'")) return [{ sum: '200.00' }];
        if (sql.includes("type = 'OUT'")) return [{ sum: '50.00' }];
        return undefined;
      });

      mockSessionRepo.save.mockResolvedValue({
        ...openSession,
        status: CashSessionStatus.CLOSED,
        closingBalance: 250,
      });

      const result = await service.close(TENANT, OPERATOR);
      expect(result.closingBalance).toBe(250);
      expect(result.status).toBe(CashSessionStatus.CLOSED);
      expect(mockQueryRunner.startTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });
  });

  describe('getCurrent', () => {
    it('should return null when no open session', async () => {
      mockSessionRepo.findOne.mockResolvedValue(null);
      const result = await service.getCurrent(TENANT);
      expect(result).toBeNull();
    });

    it('should return open session', async () => {
      const session = { id: 's1', status: CashSessionStatus.OPEN };
      mockSessionRepo.findOne.mockResolvedValue(session);
      const result = await service.getCurrent(TENANT);
      expect(result).toEqual(session);
    });
  });

  describe('addTransaction', () => {
    it('should throw BadRequestException when no open session', async () => {
      mockSessionRepo.findOne.mockResolvedValue(null);
      await expect(
        service.addTransaction(TENANT, {
          type: TransactionType.IN,
          paymentMethod: PaymentMethod.CASH,
          amount: 50,
        })
      ).rejects.toThrow(BadRequestException);
    });

    it('should create transaction when session is open', async () => {
      const session = { id: 's1', status: CashSessionStatus.OPEN };
      mockSessionRepo.findOne.mockResolvedValue(session);
      const tx = { id: 'tx1', cashSessionId: 's1', amount: 50 };
      mockTxRepo.create.mockReturnValue(tx);
      mockTxRepo.save.mockResolvedValue(tx);

      const result = await service.addTransaction(TENANT, {
        type: TransactionType.IN,
        paymentMethod: PaymentMethod.CASH,
        amount: 50,
        description: 'Entrada manual',
      });
      expect(result).toEqual(tx);
    });
  });

  describe('getTransactions', () => {
    it('should throw NotFoundException when session not found', async () => {
      mockSessionRepo.findOne.mockResolvedValue(null);
      await expect(service.getTransactions(TENANT, 'non-existent-id')).rejects.toThrow(NotFoundException);
    });

    it('should return transactions for a valid session', async () => {
      const session = { id: 's1', status: CashSessionStatus.OPEN };
      mockSessionRepo.findOne.mockResolvedValue(session);
      const txs = [{ id: 't1', cashSessionId: 's1', type: TransactionType.IN, amount: 50 }];
      mockTxRepo.find.mockResolvedValue(txs);
      const result = await service.getTransactions(TENANT, 's1');
      expect(result).toHaveLength(1);
    });
  });
});
