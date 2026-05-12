import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import {
  CashSessionStatus,
  PaymentMethod,
  TransactionType,
} from '@praktikus/shared';
import { PurchaseEntity } from './purchase.entity';
import { PurchaseItemEntity } from './purchase-item.entity';
import { StockMovementEntity, MovementType } from './stock-movement.entity';
import { CashSessionEntity } from '../cash-register/cash-session.entity';
import { CashTransactionEntity } from '../cash-register/cash-transaction.entity';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { PriceTableEntity } from '../price-tables/price-table.entity';

@Injectable()
export class PurchasesService {
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
      purchasedAt: string;
      supplierId: string;
      supplierName: string;
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
        p.id,
        p.purchased_at,
        p.supplier_id,
        p.payment_method,
        p.total_amount,
        p.notes,
        s.name as supplier_name,
        COALESCE(agg.item_count, 0) as item_count,
        COALESCE(agg.total_kg, 0) as total_kg,
        agg.first_product_name
      FROM "${schemaName}".purchases p
      LEFT JOIN "${schemaName}".suppliers s ON s.id = p.supplier_id
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*) as item_count,
          COALESCE(SUM(pi.quantity), 0) as total_kg,
          (
            SELECT pr.name
            FROM "${schemaName}".purchase_items pi2
            JOIN "${schemaName}".products pr ON pr.id = pi2.product_id
            WHERE pi2.purchase_id = p.id
            LIMIT 1
          ) as first_product_name
        FROM "${schemaName}".purchase_items pi
        WHERE pi.purchase_id = p.id
      ) agg ON TRUE
      ORDER BY p.purchased_at DESC
      LIMIT $1 OFFSET $2
      `,
        [limit, offset],
      );

      const [{ count }] = await qr.query(
        `SELECT COUNT(*) as count FROM "${schemaName}".purchases`,
      );

      return {
        data: rows.map((r: any) => ({
          id: r.id,
          purchasedAt: new Date(r.purchased_at).toISOString(),
          supplierId: r.supplier_id,
          supplierName: r.supplier_name ?? '',
          paymentMethod: r.payment_method,
          total: Number(r.total_amount),
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
    dto: CreatePurchaseDto,
  ): Promise<PurchaseEntity> {
    return this.withSchema(tenantId, async (manager) => {
      const priceTable = await manager
        .getRepository(PriceTableEntity)
        .findOne({ where: { id: dto.priceTableId, active: true } });
      if (!priceTable) {
        throw new BadRequestException('Tabela de preço inválida ou inativa');
      }

      const sessionRepo = manager.getRepository(CashSessionEntity);
      const purchaseRepo = manager.getRepository(PurchaseEntity);
      const itemRepo = manager.getRepository(PurchaseItemEntity);
      const movementRepo = manager.getRepository(StockMovementEntity);
      const txRepo = manager.getRepository(CashTransactionEntity);

      // 1. Fetch open cash session (required for CASH purchases only).
      //    PIX/CARD/ON_CREDIT don't move physical cash, so they don't need
      //    an open session and don't generate a cash_transaction.
      const session = await sessionRepo.findOne({
        where: { status: CashSessionStatus.OPEN },
      });
      if (dto.paymentMethod === PaymentMethod.CASH && !session) {
        throw new BadRequestException(
          'Abra o caixa antes de registrar compras em dinheiro.',
        );
      }

      // 2. Calculate total
      const totalAmount =
        Math.round(
          dto.items.reduce(
            (sum, item) => sum + item.quantity * item.unitPrice,
            0,
          ) * 100,
        ) / 100;

      // 3. Create purchase
      const purchase = purchaseRepo.create({
        supplierId: dto.supplierId,
        priceTableId: dto.priceTableId,
        operatorId,
        cashSessionId: session?.id ?? null,
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

      // 5. Create cash transaction (OUT) — only for CASH purchases.
      //    PIX/CARD/ON_CREDIT don't affect the physical cash drawer.
      if (dto.paymentMethod === PaymentMethod.CASH && session) {
        await txRepo.save(
          txRepo.create({
            cashSessionId: session.id,
            type: TransactionType.OUT,
            paymentMethod: PaymentMethod.CASH,
            amount: totalAmount,
            description: 'Compra de materiais',
            referenceId: savedPurchase.id,
            referenceType: 'PURCHASE',
          }),
        );
      }

      return savedPurchase;
    });
  }

  async getById(
    tenantId: string,
    id: string,
  ): Promise<{
    id: string;
    purchasedAt: string;
    supplier: {
      id: string;
      name: string;
      document: string | null;
      documentType: 'CPF' | 'CNPJ' | null;
    };
    operator: { id: string; name: string };
    paymentMethod: string;
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
        p.id, p.purchased_at, p.payment_method, p.notes,
        s.id as supplier_id, s.name as supplier_name,
        s.document as supplier_document, s.document_type as supplier_document_type,
        u.id as operator_id, u.name as operator_name
      FROM "${schemaName}".purchases p
      LEFT JOIN "${schemaName}".suppliers s ON s.id = p.supplier_id
      LEFT JOIN public.users u ON u.id = p.operator_id
      WHERE p.id = $1
      `,
        [id],
      );
      if (rows.length === 0)
        throw new NotFoundException('Compra não encontrada.');
      const row = rows[0];

      const items = await qr.query(
        `
      SELECT
        pi.id, pi.product_id, pi.quantity, pi.unit_price, pi.subtotal,
        pr.name as product_name
      FROM "${schemaName}".purchase_items pi
      JOIN "${schemaName}".products pr ON pr.id = pi.product_id
      WHERE pi.purchase_id = $1
      ORDER BY pi.created_at ASC
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
        purchasedAt: new Date(row.purchased_at).toISOString(),
        supplier: {
          id: row.supplier_id ?? '',
          name: row.supplier_name ?? '',
          document: row.supplier_document ?? null,
          documentType: row.supplier_document_type ?? null,
        },
        operator: {
          id: row.operator_id ?? '',
          name: row.operator_name ?? '',
        },
        paymentMethod: row.payment_method,
        notes: row.notes,
        total,
        items: mappedItems,
      };
    });
  }
}
