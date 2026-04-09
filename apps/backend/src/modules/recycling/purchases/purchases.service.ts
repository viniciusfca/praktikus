import { Injectable, BadRequestException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { CashSessionStatus, TransactionType } from '@praktikus/shared';
import { PurchaseEntity } from './purchase.entity';
import { PurchaseItemEntity } from './purchase-item.entity';
import { StockMovementEntity, MovementType } from './stock-movement.entity';
import { CashSessionEntity } from '../cash-register/cash-session.entity';
import { CashTransactionEntity } from '../cash-register/cash-transaction.entity';
import { CreatePurchaseDto } from './dto/create-purchase.dto';

@Injectable()
export class PurchasesService {
  constructor(private readonly dataSource: DataSource) {}

  private getSchemaName(tenantId: string): string {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantId)) {
      throw new Error('Invalid tenantId');
    }
    return `tenant_${tenantId.replace(/-/g, '')}`;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async withSchema<T>(tenantId: string, fn: (manager: EntityManager, qr: any) => Promise<T>): Promise<T> {
    const schemaName = this.getSchemaName(tenantId);
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      await qr.query(`SET LOCAL search_path TO "${schemaName}", public`);
      const result = await fn(qr.manager, qr);
      await qr.commitTransaction();
      return result;
    } catch (err) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }
  }

  async list(
    tenantId: string,
    page: number,
    limit: number,
  ): Promise<{ data: PurchaseEntity[]; total: number; page: number; limit: number }> {
    return this.withSchema(tenantId, async (manager) => {
      const repo = manager.getRepository(PurchaseEntity);
      const [data, total] = await repo
        .createQueryBuilder('p')
        .orderBy('p.purchasedAt', 'DESC')
        .skip((page - 1) * limit)
        .take(limit)
        .getManyAndCount();
      return { data, total, page, limit };
    });
  }

  async create(tenantId: string, operatorId: string, dto: CreatePurchaseDto): Promise<PurchaseEntity> {
    return this.withSchema(tenantId, async (manager) => {
      const sessionRepo = manager.getRepository(CashSessionEntity);
      const purchaseRepo = manager.getRepository(PurchaseEntity);
      const itemRepo = manager.getRepository(PurchaseItemEntity);
      const movementRepo = manager.getRepository(StockMovementEntity);
      const txRepo = manager.getRepository(CashTransactionEntity);

      // 1. Validate open cash session
      const session = await sessionRepo.findOne({ where: { status: CashSessionStatus.OPEN } });
      if (!session) throw new BadRequestException('Abra o caixa antes de registrar uma compra.');

      // 2. Calculate total
      const totalAmount = Math.round(
        dto.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0) * 100
      ) / 100;

      // 3. Create purchase
      const purchase = purchaseRepo.create({
        supplierId: dto.supplierId,
        operatorId,
        cashSessionId: session.id,
        paymentMethod: dto.paymentMethod,
        totalAmount,
        notes: dto.notes ?? null,
        purchasedAt: new Date(),
      });
      const savedPurchase = await purchaseRepo.save(purchase);

      // 4. Create purchase_items + stock_movements (IN)
      for (const item of dto.items) {
        const subtotal = Math.round(item.quantity * item.unitPrice * 100) / 100;
        await itemRepo.save(
          itemRepo.create({
            purchaseId: savedPurchase.id,
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            subtotal,
          }),
        );
        await movementRepo.save(
          movementRepo.create({
            productId: item.productId,
            type: MovementType.IN,
            quantity: item.quantity,
            referenceId: savedPurchase.id,
            referenceType: 'PURCHASE',
            movedAt: new Date(),
          }),
        );
      }

      // 5. Create cash transaction (OUT — company pays supplier)
      await txRepo.save(
        txRepo.create({
          cashSessionId: session.id,
          type: TransactionType.OUT,
          paymentMethod: dto.paymentMethod,
          amount: totalAmount,
          description: 'Compra de materiais',
          referenceId: savedPurchase.id,
          referenceType: 'PURCHASE',
        }),
      );

      return savedPurchase;
    });
  }
}
