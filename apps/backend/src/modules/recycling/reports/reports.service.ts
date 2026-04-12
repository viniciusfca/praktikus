import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class RecyclingReportsService {
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

  async getDashboardSummary(tenantId: string): Promise<{
    totalPurchasedToday: number;
    purchasesCountToday: number;
    cashSession: { status: string; openingBalance: number } | null;
  }> {
    const schemaName = this.getSchemaName(tenantId);
    return this.withQueryRunner(tenantId, async (qr) => {
      const [purchaseSummary] = await qr.query(`
        SELECT
          COALESCE(SUM(total_amount), 0) as total_today,
          COUNT(*) as purchases_count
        FROM "${schemaName}".purchases
        WHERE DATE(purchased_at) = CURRENT_DATE
      `);

      const cashSessions = await qr.query(`
        SELECT status, opening_balance
        FROM "${schemaName}".cash_sessions
        WHERE status = 'OPEN'
        LIMIT 1
      `);

      return {
        totalPurchasedToday: Number(purchaseSummary.total_today),
        purchasesCountToday: Number(purchaseSummary.purchases_count),
        cashSession: cashSessions.length > 0
          ? { status: cashSessions[0].status, openingBalance: Number(cashSessions[0].opening_balance) }
          : null,
      };
    });
  }

  async getPurchasesByPeriod(
    tenantId: string,
    startDate: string,
    endDate: string,
  ): Promise<Array<{ date: string; total: number; count: number }>> {
    const schemaName = this.getSchemaName(tenantId);
    return this.withQueryRunner(tenantId, async (qr) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rows = await qr.query(`
        SELECT
          DATE(purchased_at) as date,
          SUM(total_amount) as total,
          COUNT(*) as count
        FROM "${schemaName}".purchases
        WHERE DATE(purchased_at) BETWEEN $1 AND $2
        GROUP BY DATE(purchased_at)
        ORDER BY date ASC
      `, [startDate, endDate]);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return rows.map((r: any) => ({
        date: r.date,
        total: Number(r.total),
        count: Number(r.count),
      }));
    });
  }
}
