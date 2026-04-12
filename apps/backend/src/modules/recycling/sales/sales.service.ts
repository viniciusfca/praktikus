import { Injectable, BadRequestException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { SaleEntity } from './sale.entity';
import { SaleItemEntity } from './sale-item.entity';
import { StockMovementEntity, MovementType } from '../purchases/stock-movement.entity';
import { CreateSaleDto } from './dto/create-sale.dto';

@Injectable()
export class SalesService {
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
  ): Promise<{ data: SaleEntity[]; total: number; page: number; limit: number }> {
    return this.withSchema(tenantId, async (manager) => {
      const repo = manager.getRepository(SaleEntity);
      const [data, total] = await repo
        .createQueryBuilder('s')
        .orderBy('s.soldAt', 'DESC')
        .skip((page - 1) * limit)
        .take(limit)
        .getManyAndCount();
      return { data, total, page, limit };
    });
  }

  async create(tenantId: string, operatorId: string, dto: CreateSaleDto): Promise<SaleEntity> {
    const schemaName = this.getSchemaName(tenantId);
    return this.withSchema(tenantId, async (manager, qr) => {
      const saleRepo = manager.getRepository(SaleEntity);
      const itemRepo = manager.getRepository(SaleItemEntity);
      const movementRepo = manager.getRepository(StockMovementEntity);

      // 1. Validate stock for each item
      for (const item of dto.items) {
        const [{ balance }] = await qr.query(
          `SELECT COALESCE(
            SUM(CASE WHEN type = 'IN' THEN quantity ELSE -quantity END), 0
          ) as balance
          FROM "${schemaName}".stock_movements
          WHERE product_id = $1`,
          [item.productId],
        );
        const available = Number(balance);
        if (available < item.quantity) {
          throw new BadRequestException(
            `Estoque insuficiente para o produto ${item.productId}. Disponível: ${available}, Solicitado: ${item.quantity}`,
          );
        }
      }

      // 2. Create sale
      const sale = saleRepo.create({
        buyerId: dto.buyerId,
        operatorId,
        soldAt: new Date(),
        notes: dto.notes ?? null,
      });
      const savedSale = await saleRepo.save(sale);

      // 3. Create sale_items + stock_movements (OUT) — NO cash_transaction
      for (const item of dto.items) {
        const subtotal = Math.round(item.quantity * item.unitPrice * 100) / 100;
        await itemRepo.save(
          itemRepo.create({
            saleId: savedSale.id,
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            subtotal,
          }),
        );
        await movementRepo.save(
          movementRepo.create({
            productId: item.productId,
            type: MovementType.OUT,
            quantity: item.quantity,
            referenceId: savedSale.id,
            referenceType: 'SALE',
            movedAt: new Date(),
          }),
        );
      }

      return savedSale;
    });
  }
}
