import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { SaleEntity } from './sale.entity';
import { SaleItemEntity } from './sale-item.entity';
import {
  StockMovementEntity,
  MovementType,
} from '../purchases/stock-movement.entity';
import { CreateSaleDto } from './dto/create-sale.dto';

@Injectable()
export class SalesService {
  constructor(private readonly dataSource: DataSource) {}

  private getSchemaName(tenantId: string): string {
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        tenantId,
      )
    ) {
      throw new Error('Invalid tenantId');
    }
    return `tenant_${tenantId.replace(/-/g, '')}`;
  }

  private async withSchema<T>(
    tenantId: string,
    fn: (manager: EntityManager, qr: any) => Promise<T>,
  ): Promise<T> {
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
  ): Promise<{
    data: Array<{
      id: string;
      soldAt: string;
      buyerId: string;
      buyerName: string;
      paymentMethod: string;
      total: number;
      itemCount: number;
      firstProductName: string | null;
      totalKg: number;
      notes: string | null;
    }>;
    total: number;
    page: number;
    limit: number;
  }> {
    const schemaName = this.getSchemaName(tenantId);
    const offset = (page - 1) * limit;
    return this.withSchema(tenantId, async (_manager, qr) => {
      const rows = await qr.query(
        `
        SELECT
          s.id,
          s.sold_at,
          s.buyer_id,
          s.payment_method,
          s.notes,
          b.name as buyer_name,
          COALESCE(agg.total, 0) as total,
          COALESCE(agg.item_count, 0) as item_count,
          COALESCE(agg.total_kg, 0) as total_kg,
          agg.first_product_name
        FROM "${schemaName}".sales s
        LEFT JOIN "${schemaName}".buyers b ON b.id = s.buyer_id
        LEFT JOIN LATERAL (
          SELECT
            COALESCE(SUM(si.subtotal), 0) as total,
            COUNT(*) as item_count,
            COALESCE(SUM(si.quantity), 0) as total_kg,
            (
              SELECT p.name
              FROM "${schemaName}".sale_items si2
              JOIN "${schemaName}".products p ON p.id = si2.product_id
              WHERE si2.sale_id = s.id
              LIMIT 1
            ) as first_product_name
          FROM "${schemaName}".sale_items si
          WHERE si.sale_id = s.id
        ) agg ON TRUE
        ORDER BY s.sold_at DESC
        LIMIT $1 OFFSET $2
        `,
        [limit, offset],
      );

      const [{ count }] = await qr.query(
        `SELECT COUNT(*) as count FROM "${schemaName}".sales`,
      );

      return {
        data: rows.map((r: any) => ({
          id: r.id,
          soldAt: new Date(r.sold_at).toISOString(),
          buyerId: r.buyer_id,
          buyerName: r.buyer_name ?? '',
          paymentMethod: r.payment_method,
          total: Number(r.total),
          itemCount: Number(r.item_count),
          firstProductName: r.first_product_name ?? null,
          totalKg: Number(r.total_kg),
          notes: r.notes,
        })),
        total: Number(count),
        page,
        limit,
      };
    });
  }

  async create(
    tenantId: string,
    operatorId: string,
    dto: CreateSaleDto,
  ): Promise<SaleEntity> {
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
        paymentMethod: dto.paymentMethod,
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

  async getById(
    tenantId: string,
    id: string,
  ): Promise<{
    id: string;
    soldAt: string;
    buyer: {
      id: string;
      name: string;
      document: string | null;
      documentType: 'CPF' | 'CNPJ' | null;
    };
    operator: { id: string; name: string };
    notes: string | null;
    total: number;
    items: Array<{
      id: string;
      productId: string;
      productName: string;
      quantity: number;
      unitPrice: number;
      subtotal: number;
    }>;
  }> {
    const schemaName = this.getSchemaName(tenantId);
    return this.withSchema(tenantId, async (_manager, qr) => {
      const rows = await qr.query(
        `
        SELECT
          s.id, s.sold_at, s.notes,
          b.id as buyer_id, b.name as buyer_name,
          b.document as buyer_document, b.document_type as buyer_document_type,
          u.id as operator_id, u.name as operator_name
        FROM "${schemaName}".sales s
        LEFT JOIN "${schemaName}".buyers b ON b.id = s.buyer_id
        LEFT JOIN public.users u ON u.id = s.operator_id
        WHERE s.id = $1
        `,
        [id],
      );
      if (rows.length === 0)
        throw new NotFoundException('Venda não encontrada.');
      const row = rows[0];

      const items = await qr.query(
        `
        SELECT
          si.id, si.product_id, si.quantity, si.unit_price, si.subtotal,
          p.name as product_name
        FROM "${schemaName}".sale_items si
        JOIN "${schemaName}".products p ON p.id = si.product_id
        WHERE si.sale_id = $1
        ORDER BY si.created_at ASC
        `,
        [id],
      );

      let total = 0;

      const mappedItems = items.map((it: any) => {
        const subtotal = Number(it.subtotal);
        total += subtotal;
        return {
          id: it.id,
          productId: it.product_id,
          productName: it.product_name,
          quantity: Number(it.quantity),
          unitPrice: Number(it.unit_price),
          subtotal,
        };
      });

      return {
        id: row.id,
        soldAt: new Date(row.sold_at).toISOString(),
        buyer: {
          id: row.buyer_id ?? '',
          name: row.buyer_name ?? '',
          document: row.buyer_document ?? null,
          documentType: row.buyer_document_type ?? null,
        },
        operator: {
          id: row.operator_id ?? '',
          name: row.operator_name ?? '',
        },
        notes: row.notes,
        total,
        items: mappedItems,
      };
    });
  }
}
