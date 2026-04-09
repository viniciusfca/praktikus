import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { PaymentMethod, CashSessionStatus, TransactionType } from '@praktikus/shared';
import { PurchasesService } from './purchases.service';
import { PurchaseEntity } from './purchase.entity';
import { PurchaseItemEntity } from './purchase-item.entity';
import { StockMovementEntity, MovementType } from './stock-movement.entity';
import { CashSessionEntity } from '../cash-register/cash-session.entity';
import { CashTransactionEntity } from '../cash-register/cash-transaction.entity';

const mockPurchaseRepo = { create: jest.fn(), save: jest.fn(), createQueryBuilder: jest.fn() };
const mockItemRepo = { create: jest.fn(), save: jest.fn() };
const mockMovementRepo = { create: jest.fn(), save: jest.fn() };
const mockSessionRepo = { findOne: jest.fn() };
const mockTxRepo = { create: jest.fn(), save: jest.fn() };

const mockQueryRunner = {
  connect: jest.fn().mockResolvedValue(undefined),
  query: jest.fn().mockResolvedValue(undefined),
  manager: {
    getRepository: jest.fn((entity) => {
      if (entity === PurchaseEntity) return mockPurchaseRepo;
      if (entity === PurchaseItemEntity) return mockItemRepo;
      if (entity === StockMovementEntity) return mockMovementRepo;
      if (entity === CashSessionEntity) return mockSessionRepo;
      return mockTxRepo;
    }),
  },
  release: jest.fn().mockResolvedValue(undefined),
};
const mockDataSource = { createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner) };

const TENANT = '00000000-0000-0000-0000-000000000001';
const OPERATOR = '00000000-0000-0000-0000-000000000002';

describe('PurchasesService', () => {
  let service: PurchasesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PurchasesService, { provide: DataSource, useValue: mockDataSource }],
    }).compile();
    service = module.get<PurchasesService>(PurchasesService);
    jest.clearAllMocks();
    mockQueryRunner.manager.getRepository.mockImplementation((entity) => {
      if (entity === PurchaseEntity) return mockPurchaseRepo;
      if (entity === PurchaseItemEntity) return mockItemRepo;
      if (entity === StockMovementEntity) return mockMovementRepo;
      if (entity === CashSessionEntity) return mockSessionRepo;
      return mockTxRepo;
    });
  });

  describe('create', () => {
    const dto = {
      supplierId: '00000000-0000-0000-0000-000000000010',
      paymentMethod: PaymentMethod.CASH,
      items: [
        { productId: '00000000-0000-0000-0000-000000000020', quantity: 2, unitPrice: 10 },
        { productId: '00000000-0000-0000-0000-000000000021', quantity: 3, unitPrice: 5 },
      ],
    };

    it('should throw BadRequestException when no open cash session', async () => {
      mockSessionRepo.findOne.mockResolvedValue(null);
      await expect(service.create(TENANT, OPERATOR, dto)).rejects.toThrow(BadRequestException);
    });

    it('should correctly calculate totalAmount as sum of quantity × unitPrice', async () => {
      const session = { id: 'session-1', status: CashSessionStatus.OPEN };
      mockSessionRepo.findOne.mockResolvedValue(session);

      const savedPurchase = { id: 'purchase-1', totalAmount: 35 };
      mockPurchaseRepo.create.mockReturnValue(savedPurchase);
      mockPurchaseRepo.save.mockResolvedValue(savedPurchase);

      mockItemRepo.create.mockImplementation((v) => v);
      mockItemRepo.save.mockResolvedValue({});
      mockMovementRepo.create.mockImplementation((v) => v);
      mockMovementRepo.save.mockResolvedValue({});
      mockTxRepo.create.mockImplementation((v) => v);
      mockTxRepo.save.mockResolvedValue({});

      await service.create(TENANT, OPERATOR, dto);

      // 2*10 + 3*5 = 35
      expect(mockPurchaseRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ totalAmount: 35 })
      );
    });

    it('should create stock_movement with type IN for each item', async () => {
      const session = { id: 'session-1', status: CashSessionStatus.OPEN };
      mockSessionRepo.findOne.mockResolvedValue(session);

      const savedPurchase = { id: 'purchase-1', totalAmount: 35 };
      mockPurchaseRepo.create.mockReturnValue(savedPurchase);
      mockPurchaseRepo.save.mockResolvedValue(savedPurchase);

      mockItemRepo.create.mockImplementation((v) => v);
      mockItemRepo.save.mockResolvedValue({});
      mockMovementRepo.create.mockImplementation((v) => v);
      mockMovementRepo.save.mockResolvedValue({});
      mockTxRepo.create.mockImplementation((v) => v);
      mockTxRepo.save.mockResolvedValue({});

      await service.create(TENANT, OPERATOR, dto);

      expect(mockMovementRepo.create).toHaveBeenCalledTimes(2);
      expect(mockMovementRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ type: MovementType.IN })
      );
    });

    it('should create cash_transaction with type OUT and amount = totalAmount', async () => {
      const session = { id: 'session-1', status: CashSessionStatus.OPEN };
      mockSessionRepo.findOne.mockResolvedValue(session);

      const savedPurchase = { id: 'purchase-1', totalAmount: 35 };
      mockPurchaseRepo.create.mockReturnValue(savedPurchase);
      mockPurchaseRepo.save.mockResolvedValue(savedPurchase);

      mockItemRepo.create.mockImplementation((v) => v);
      mockItemRepo.save.mockResolvedValue({});
      mockMovementRepo.create.mockImplementation((v) => v);
      mockMovementRepo.save.mockResolvedValue({});
      mockTxRepo.create.mockImplementation((v) => v);
      mockTxRepo.save.mockResolvedValue({});

      await service.create(TENANT, OPERATOR, dto);

      expect(mockTxRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ type: TransactionType.OUT, amount: 35 })
      );
    });

    it('should create cash_transaction with PIX paymentMethod when PIX is used', async () => {
      const pixDto = { ...dto, paymentMethod: PaymentMethod.PIX };
      const session = { id: 'session-1', status: CashSessionStatus.OPEN };
      mockSessionRepo.findOne.mockResolvedValue(session);

      const savedPurchase = { id: 'purchase-1', totalAmount: 35 };
      mockPurchaseRepo.create.mockReturnValue(savedPurchase);
      mockPurchaseRepo.save.mockResolvedValue(savedPurchase);

      mockItemRepo.create.mockImplementation((v) => v);
      mockItemRepo.save.mockResolvedValue({});
      mockMovementRepo.create.mockImplementation((v) => v);
      mockMovementRepo.save.mockResolvedValue({});
      mockTxRepo.create.mockImplementation((v) => v);
      mockTxRepo.save.mockResolvedValue({});

      await service.create(TENANT, OPERATOR, pixDto);

      expect(mockTxRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ paymentMethod: PaymentMethod.PIX })
      );
    });
  });
});
