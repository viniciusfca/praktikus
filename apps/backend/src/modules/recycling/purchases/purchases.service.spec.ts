import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  PaymentMethod,
  CashSessionStatus,
  TransactionType,
} from '@praktikus/shared';
import { PurchasesService } from './purchases.service';
import { PurchaseEntity } from './purchase.entity';
import { PurchaseItemEntity } from './purchase-item.entity';
import { StockMovementEntity, MovementType } from './stock-movement.entity';
import { CashSessionEntity } from '../cash-register/cash-session.entity';
import { CashTransactionEntity } from '../cash-register/cash-transaction.entity';
import { PriceTableEntity } from '../price-tables/price-table.entity';

const mockPurchaseRepo = { create: jest.fn(), save: jest.fn() };
const mockItemRepo = { create: jest.fn(), save: jest.fn() };
const mockMovementRepo = { create: jest.fn(), save: jest.fn() };
const mockSessionRepo = { findOne: jest.fn() };
const mockTxRepo = { create: jest.fn(), save: jest.fn() };
const mockPriceTableRepo = { findOne: jest.fn() };

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
      if (entity === PriceTableEntity) return mockPriceTableRepo;
      return mockTxRepo;
    }),
  },
  release: jest.fn().mockResolvedValue(undefined),
};
const mockDataSource = {
  createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
};

const TENANT = '00000000-0000-0000-0000-000000000001';
const OPERATOR = '00000000-0000-0000-0000-000000000002';

describe('PurchasesService', () => {
  let service: PurchasesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PurchasesService,
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();
    service = module.get<PurchasesService>(PurchasesService);
    jest.clearAllMocks();
    mockQueryRunner.manager.getRepository.mockImplementation((entity) => {
      if (entity === PurchaseEntity) return mockPurchaseRepo;
      if (entity === PurchaseItemEntity) return mockItemRepo;
      if (entity === StockMovementEntity) return mockMovementRepo;
      if (entity === CashSessionEntity) return mockSessionRepo;
      if (entity === PriceTableEntity) return mockPriceTableRepo;
      return mockTxRepo;
    });
    mockPriceTableRepo.findOne.mockResolvedValue({
      id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      isDefault: true,
      active: true,
      sortOrder: 1,
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
      await expect(service.list('bad-id', 1, 20)).rejects.toThrow(
        'Invalid tenantId',
      );
    });
  });

  describe('create', () => {
    const dto = {
      supplierId: '00000000-0000-0000-0000-000000000010',
      priceTableId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      paymentMethod: PaymentMethod.CASH,
      items: [
        {
          productId: '00000000-0000-0000-0000-000000000020',
          quantity: 2,
          unitPrice: 10,
        },
        {
          productId: '00000000-0000-0000-0000-000000000021',
          quantity: 3,
          unitPrice: 5,
        },
      ],
    };

    it('should throw BadRequestException when no open cash session for CASH purchase', async () => {
      mockSessionRepo.findOne.mockResolvedValue(null);
      await expect(service.create(TENANT, OPERATOR, dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should allow PIX purchase without open cash session', async () => {
      const pixDto = { ...dto, paymentMethod: PaymentMethod.PIX };
      mockSessionRepo.findOne.mockResolvedValue(null);

      const savedPurchase = { id: 'purchase-1', totalAmount: 35 };
      mockPurchaseRepo.create.mockReturnValue(savedPurchase);
      mockPurchaseRepo.save.mockResolvedValue(savedPurchase);
      mockItemRepo.create.mockImplementation((v) => v);
      mockItemRepo.save.mockResolvedValue({});
      mockMovementRepo.create.mockImplementation((v) => v);
      mockMovementRepo.save.mockResolvedValue({});
      mockTxRepo.create.mockImplementation((v) => v);
      mockTxRepo.save.mockResolvedValue({});

      await expect(
        service.create(TENANT, OPERATOR, pixDto),
      ).resolves.toBeDefined();

      // No cash transaction should be created for PIX
      expect(mockTxRepo.save).not.toHaveBeenCalled();
      expect(mockTxRepo.create).not.toHaveBeenCalled();
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
        expect.objectContaining({ totalAmount: 35 }),
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
        expect.objectContaining({ type: MovementType.IN }),
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
        expect.objectContaining({ type: TransactionType.OUT, amount: 35 }),
      );
    });

    it('should NOT create cash_transaction for PIX purchase', async () => {
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

      expect(mockTxRepo.create).not.toHaveBeenCalled();
      expect(mockTxRepo.save).not.toHaveBeenCalled();
    });

    it('should NOT create cash_transaction for CARD purchase', async () => {
      const cardDto = { ...dto, paymentMethod: PaymentMethod.CARD };
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

      await service.create(TENANT, OPERATOR, cardDto);

      expect(mockTxRepo.create).not.toHaveBeenCalled();
      expect(mockTxRepo.save).not.toHaveBeenCalled();
    });

    it('should NOT create cash_transaction for ON_CREDIT purchase', async () => {
      const onCreditDto = { ...dto, paymentMethod: PaymentMethod.ON_CREDIT };
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

      await service.create(TENANT, OPERATOR, onCreditDto);

      expect(mockTxRepo.create).not.toHaveBeenCalled();
      expect(mockTxRepo.save).not.toHaveBeenCalled();
    });

    it('should create cash_transaction with paymentMethod CASH for CASH purchase', async () => {
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
        expect.objectContaining({
          paymentMethod: PaymentMethod.CASH,
          type: TransactionType.OUT,
          amount: 35,
        }),
      );
      expect(mockTxRepo.save).toHaveBeenCalled();
    });
  });

  describe('create — priceTableId', () => {
    const TENANT2 = '11111111-1111-1111-1111-111111111111';
    const OPERATOR2 = '22222222-2222-2222-2222-222222222222';
    const TABLE = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    const baseDto = {
      supplierId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      priceTableId: TABLE,
      paymentMethod: PaymentMethod.CASH,
      items: [
        {
          productId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
          quantity: 1,
          unitPrice: 5,
        },
      ],
    };

    it('rejeita priceTableId que não existe', async () => {
      mockPriceTableRepo.findOne.mockResolvedValue(null);
      await expect(service.create(TENANT2, OPERATOR2, baseDto)).rejects.toThrow(
        'Tabela de preço inválida ou inativa',
      );
    });

    it('rejeita priceTableId de tabela inativa (query filtra por active=true)', async () => {
      mockPriceTableRepo.findOne.mockResolvedValue(null);
      await expect(service.create(TENANT2, OPERATOR2, baseDto)).rejects.toThrow(
        'Tabela de preço inválida ou inativa',
      );
      expect(mockPriceTableRepo.findOne).toHaveBeenCalledWith({
        where: { id: TABLE, active: true },
      });
    });

    it('persiste priceTableId quando válido', async () => {
      mockPriceTableRepo.findOne.mockResolvedValue({
        id: TABLE,
        isDefault: true,
        active: true,
      });
      mockSessionRepo.findOne.mockResolvedValue({
        id: 'session-1',
        status: 'OPEN',
      });
      mockPurchaseRepo.create.mockImplementation((p) => ({
        ...p,
        id: 'purchase-1',
      }));
      mockPurchaseRepo.save.mockImplementation((p) => Promise.resolve(p));

      await service.create(TENANT2, OPERATOR2, baseDto);

      expect(mockPurchaseRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ priceTableId: TABLE }),
      );
    });

    it('continua trustando unitPrice do client (não revalida contra product.prices)', async () => {
      mockPriceTableRepo.findOne.mockResolvedValue({
        id: TABLE,
        isDefault: true,
        active: true,
      });
      mockSessionRepo.findOne.mockResolvedValue({
        id: 'session-1',
        status: 'OPEN',
      });
      mockPurchaseRepo.create.mockImplementation((p) => ({
        ...p,
        id: 'purchase-1',
      }));
      mockPurchaseRepo.save.mockImplementation((p) => Promise.resolve(p));
      mockItemRepo.create.mockImplementation((p) => p);
      mockItemRepo.save.mockImplementation((p) => Promise.resolve(p));

      const dto = {
        ...baseDto,
        items: [{ ...baseDto.items[0], unitPrice: 999 }],
      };
      await service.create(TENANT2, OPERATOR2, dto);

      expect(mockItemRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ unitPrice: 999 }),
      );

      // Assert NO product-prices lookup happened during create
      const allCalls = mockQueryRunner.manager.getRepository.mock.calls.map(
        ([entity]) => (entity as { name: string }).name,
      );
      expect(allCalls).not.toContain('ProductEntity');
      expect(allCalls).not.toContain('ProductPriceEntity');
    });
  });

  describe('getById', () => {
    it('should throw NotFoundException when purchase does not exist', async () => {
      mockQueryRunner.query.mockImplementation(async (sql: string) => {
        if (sql.includes('SET LOCAL')) return undefined;
        if (sql.includes('FROM "tenant_') && sql.includes('purchases p'))
          return [];
        return [];
      });

      const { NotFoundException } = await import('@nestjs/common');
      await expect(service.getById(TENANT, 'missing')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return full purchase detail with items, supplier and operator', async () => {
      mockQueryRunner.query.mockImplementation(async (sql: string) => {
        if (sql.includes('SET LOCAL')) return undefined;
        if (
          sql.includes('FROM "tenant_') &&
          sql.includes('purchases p') &&
          sql.includes('LEFT JOIN')
        ) {
          return [
            {
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
            },
          ];
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
