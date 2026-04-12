import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class StockService {
  constructor(private readonly dataSource: DataSource) {}

  private getSchemaName(tenantId: string): string {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantId)) {
      throw new Error('Invalid tenantId');
    }
    return `tenant_${tenantId.replace(/-/g, '')}`;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async withQueryRunner<T>(tenantId: string, fn: (qr: any) => Promise<T>): Promise<T> {
    const schemaName = this.getSchemaName(tenantId);
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    try {
      await qr.query(`SET LOCAL search_path TO "${schemaName}", public`);
      return await fn(qr);
    } finally {
      await qr.release();
    }
  }

  async getBalances(tenantId: string): Promise<Array<{
    productId: string;
    productName: string;
    unitAbbreviation: string;
    balance: number;
  }>> {
    const schemaName = this.getSchemaName(tenantId);
    return this.withQueryRunner(tenantId, async (qr) => {
      const rows = await qr.query(`
        SELECT
          p.id as product_id,
          p.name as product_name,
          u.abbreviation as unit_abbreviation,
          COALESCE(
            SUM(CASE WHEN sm.type = 'IN' THEN sm.quantity ELSE -sm.quantity END),
            0
          ) as balance
        FROM "${schemaName}".products p
        JOIN "${schemaName}".units u ON p.unit_id = u.id
        LEFT JOIN "${schemaName}".stock_movements sm ON sm.product_id = p.id
        WHERE p.active = true
        GROUP BY p.id, p.name, u.abbreviation
        ORDER BY p.name ASC
      `);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return rows.map((r: any) => ({
        productId: r.product_id,
        productName: r.product_name,
        unitAbbreviation: r.unit_abbreviation,
        balance: Number(r.balance),
      }));
    });
  }

  async getMovements(tenantId: string, productId: string): Promise<Array<{
    id: string;
    type: string;
    quantity: number;
    referenceType: string | null;
    movedAt: Date;
  }>> {
    const schemaName = this.getSchemaName(tenantId);
    return this.withQueryRunner(tenantId, async (qr) => {
      const rows = await qr.query(`
        SELECT id, type, quantity, reference_type, moved_at
        FROM "${schemaName}".stock_movements
        WHERE product_id = $1
        ORDER BY moved_at DESC
        LIMIT 100
      `, [productId]);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return rows.map((r: any) => ({
        id: r.id,
        type: r.type,
        quantity: Number(r.quantity),
        referenceType: r.reference_type,
        movedAt: r.moved_at,
      }));
    });
  }

  async getDailyPurchaseTotals(tenantId: string, date: string): Promise<Array<{
    productId: string;
    productName: string;
    unitAbbreviation: string;
    totalQuantity: number;
  }>> {
    const schemaName = this.getSchemaName(tenantId);
    return this.withQueryRunner(tenantId, async (qr) => {
      const rows = await qr.query(`
        SELECT
          p.id as product_id,
          p.name as product_name,
          u.abbreviation as unit_abbreviation,
          COALESCE(SUM(sm.quantity), 0) as total_quantity
        FROM "${schemaName}".stock_movements sm
        JOIN "${schemaName}".products p ON sm.product_id = p.id
        JOIN "${schemaName}".units u ON p.unit_id = u.id
        WHERE sm.type = 'IN'
          AND sm.reference_type = 'PURCHASE'
          AND DATE(sm.moved_at) = $1
        GROUP BY p.id, p.name, u.abbreviation
        ORDER BY total_quantity DESC
      `, [date]);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return rows.map((r: any) => ({
        productId: r.product_id,
        productName: r.product_name,
        unitAbbreviation: r.unit_abbreviation,
        totalQuantity: Number(r.total_quantity),
      }));
    });
  }
}
