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

const mockPurchaseRepo = { create: jest.fn(), save: jest.fn() };
const mockItemRepo = { create: jest.fn(), save: jest.fn() };
const mockMovementRepo = { create: jest.fn(), save: jest.fn() };
const mockSessionRepo = { findOne: jest.fn() };
const mockTxRepo = { create: jest.fn(), save: jest.fn() };

const mockQueryRunner = {
  connect: jest.fn().mockResolvedValue(undefined),
  startTransaction: jest.fn().mockResolvedValue(undefined),
  commitTransaction: jest.fn().mockResolvedValue(undefined),
  rollbackTransaction: jest.fn().mockResolvedValue(undefined),
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

  describe('list', () => {
    it('should return enriched purchases with supplier name, total and material summary', async () => {
      mockQueryRunner.query.mockImplementation(async (sql: string) => {
        if (sql.includes('SET LOCAL')) return undefined;
        // The main SELECT contains 'FROM "tenant_"' but not 'COUNT(*) as count'.
        // The count query contains both. Check the count query first so the main
        // SELECT falls through to the data branch.
        if (sql.includes('COUNT(*) as count')) return [{ count: '1' }];
        if (sql.includes('FROM "tenant_')) {
          return [
            {
              id: 'purchase1',
              purchased_at: new Date('2026-04-18T10:42:00Z'),
              supplier_id: 'supplier1',
              payment_method: 'CASH',
              total_amount: '480.00',
              notes: null,
              supplier_name: 'Sucata Santa Lúcia',
              item_count: '2',
              total_kg: '120.0000',
              first_product_name: 'PET',
            },
          ];
        }
        return [];
      });

      const result = await service.list(TENANT, 1, 20);
      expect(result.total).toBe(1);
      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toMatchObject({
        id: 'purchase1',
        supplierId: 'supplier1',
        supplierName: 'Sucata Santa Lúcia',
        paymentMethod: 'CASH',
        total: 480,
        itemCount: 2,
        totalKg: 120,
        firstProductName: 'PET',
        notes: null,
      });
    });

    it('should throw on invalid tenantId', async () => {
      await expect(service.list('bad-id', 1, 20)).rejects.toThrow('Invalid tenantId');
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

  describe('getById', () => {
    it('should throw NotFoundException when purchase does not exist', async () => {
      mockQueryRunner.query.mockImplementation(async (sql: string) => {
        if (sql.includes('SET LOCAL')) return undefined;
        if (sql.includes('FROM "tenant_') && sql.includes('purchases p')) return [];
        return [];
      });

      const { NotFoundException } = await import('@nestjs/common');
      await expect(service.getById(TENANT, 'missing')).rejects.toThrow(NotFoundException);
    });

    it('should return full purchase detail with items, supplier and operator', async () => {
      mockQueryRunner.query.mockImplementation(async (sql: string) => {
        if (sql.includes('SET LOCAL')) return undefined;
        if (sql.includes('FROM "tenant_') && sql.includes('purchases p') && sql.includes('LEFT JOIN')) {
          return [{
            id: 'purchase1',
            purchased_at: new Date('2026-04-18T10:42:00Z'),
            payment_method: 'PIX',
            notes: 'Entregue em 3 sacos',
            supplier_id: 'supplier1',
            supplier_name: 'Sucata Santa Lúcia',
            supplier_document: '11222333000181',
            supplier_document_type: 'CNPJ',
            operator_id: 'op1',
            operator_name: 'Vini Silva',
          }];
        }
        if (sql.includes('purchase_items pi')) {
          return [
            {
              id: 'item1',
              product_id: 'p1',
              product_name: 'PET',
              quantity: '120.0000',
              unit_price: '4.0000',
              subtotal: '480.00',
            },
          ];
        }
        return [];
      });

      const result = await service.getById(TENANT, 'purchase1');
      expect(result.id).toBe('purchase1');
      expect(result.supplier.name).toBe('Sucata Santa Lúcia');
      expect(result.supplier.document).toBe('11222333000181');
      expect(result.supplier.documentType).toBe('CNPJ');
      expect(result.operator.name).toBe('Vini Silva');
      expect(result.paymentMethod).toBe('PIX');
      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toMatchObject({
        productId: 'p1',
        productName: 'PET',
        quantity: 120,
        unitPrice: 4,
        subtotal: 480,
      });
      expect(result.total).toBe(480);
    });
  });
});
