import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class RecyclingReportsService {
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

  private async withQueryRunner<T>(
    tenantId: string,
    fn: (qr: any) => Promise<T>,
  ): Promise<T> {
    const schemaName = this.getSchemaName(tenantId);
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      await qr.query(`SET LOCAL search_path TO "${schemaName}", public`);
      const result = await fn(qr);
      await qr.commitTransaction();
      return result;
    } catch (err) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }
  }

  async getDashboardSummary(tenantId: string): Promise<{
    totalPurchasedToday: number;
    purchasesCountToday: number;
    totalPurchasedMonth: number;
    purchasesCountMonth: number;
    cashSession: {
      status: string;
      openingBalance: number;
      currentBalance: number;
    } | null;
  }> {
    const schemaName = this.getSchemaName(tenantId);
    return this.withQueryRunner(tenantId, async (qr) => {
      const [today] = await qr.query(`
        SELECT
          COALESCE(SUM(total_amount), 0) as total_today,
          COUNT(*) as purchases_count
        FROM "${schemaName}".purchases
        WHERE DATE(purchased_at) = CURRENT_DATE
      `);

      const [month] = await qr.query(`
        SELECT
          COALESCE(SUM(total_amount), 0) as total_month,
          COUNT(*) as purchases_count_month
        FROM "${schemaName}".purchases
        WHERE purchased_at >= date_trunc('month', CURRENT_DATE)
          AND purchased_at < date_trunc('month', CURRENT_DATE) + interval '1 month'
      `);

      const cashSessions = await qr.query(`
        SELECT id, status, opening_balance
        FROM "${schemaName}".cash_sessions
        WHERE status = 'OPEN'
        LIMIT 1
      `);

      let cashSession: {
        status: string;
        openingBalance: number;
        currentBalance: number;
      } | null = null;
      if (cashSessions.length > 0) {
        const session = cashSessions[0];
        const opening = Number(session.opening_balance);
        const [tx] = await qr.query(
          `
          SELECT
            COALESCE(SUM(CASE WHEN type = 'IN'  THEN amount ELSE 0 END), 0) as total_in,
            COALESCE(SUM(CASE WHEN type = 'OUT' THEN amount ELSE 0 END), 0) as total_out
          FROM "${schemaName}".cash_transactions
          WHERE cash_session_id = $1
            AND payment_method = 'CASH'
        `,
          [session.id],
        );
        const current = opening + Number(tx.total_in) - Number(tx.total_out);
        cashSession = {
          status: session.status,
          openingBalance: opening,
          currentBalance: current,
        };
      }

      return {
        totalPurchasedToday: Number(today.total_today),
        purchasesCountToday: Number(today.purchases_count),
        totalPurchasedMonth: Number(month.total_month),
        purchasesCountMonth: Number(month.purchases_count_month),
        cashSession,
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
      const rows = await qr.query(
        `
        SELECT
          DATE(purchased_at)::text as date,
          SUM(total_amount) as total,
          COUNT(*) as count
        FROM "${schemaName}".purchases
        WHERE DATE(purchased_at) BETWEEN $1 AND $2
        GROUP BY DATE(purchased_at)
        ORDER BY date ASC
      `,
        [startDate, endDate],
      );

      return rows.map((r: any) => ({
        date: r.date,
        total: Number(r.total),
        count: Number(r.count),
      }));
    });
  }

  async getTopMaterials(
    tenantId: string,
    month?: string,
    limit: number = 5,
  ): Promise<
    Array<{
      productId: string;
      name: string;
      volumeKg: number;
      avgPricePerKg: number;
      changePct: number | null;
    }>
  > {
    const schemaName = this.getSchemaName(tenantId);
    return this.withQueryRunner(tenantId, async (qr) => {
      const safeLimit = Math.max(1, Math.min(20, Math.floor(limit)));

      const monthStartExpr = month
        ? `'${month}-01'::date`
        : `date_trunc('month', CURRENT_DATE)`;
      const monthEndExpr = month
        ? `('${month}-01'::date + interval '1 month')`
        : `(date_trunc('month', CURRENT_DATE) + interval '1 month')`;
      const prevMonthStartExpr = month
        ? `('${month}-01'::date - interval '1 month')`
        : `(date_trunc('month', CURRENT_DATE) - interval '1 month')`;
      const prevMonthEndExpr = month
        ? `'${month}-01'::date`
        : `date_trunc('month', CURRENT_DATE)`;

      const currentRows: Array<{
        product_id: string;
        name: string;
        volume_kg: string;
        avg_price: string;
      }> = await qr.query(`
        SELECT
          p.id as product_id,
          p.name as name,
          SUM(pi.quantity) as volume_kg,
          CASE WHEN SUM(pi.quantity) > 0
               THEN SUM(pi.subtotal) / SUM(pi.quantity)
               ELSE 0
          END as avg_price
        FROM "${schemaName}".purchase_items pi
        JOIN "${schemaName}".purchases pu ON pu.id = pi.purchase_id
        JOIN "${schemaName}".products p ON p.id = pi.product_id
        WHERE pu.purchased_at >= ${monthStartExpr}
          AND pu.purchased_at < ${monthEndExpr}
        GROUP BY p.id, p.name
        ORDER BY SUM(pi.quantity) DESC
        LIMIT ${safeLimit}
      `);

      if (currentRows.length === 0) return [];

      const prevRows: Array<{ product_id: string; volume_kg: string }> =
        await qr.query(
          `
        SELECT pi.product_id as product_id, SUM(pi.quantity) as volume_kg
        FROM "${schemaName}".purchase_items pi
        JOIN "${schemaName}".purchases pu ON pu.id = pi.purchase_id
        WHERE pu.purchased_at >= ${prevMonthStartExpr}
          AND pu.purchased_at < ${prevMonthEndExpr}
          AND pi.product_id = ANY($1)
        GROUP BY pi.product_id
      `,
          [currentRows.map((r) => r.product_id)],
        );

      const prevMap = new Map(
        prevRows.map((r) => [r.product_id, Number(r.volume_kg)]),
      );

      return currentRows.map((r) => {
        const current = Number(r.volume_kg);
        const prev = prevMap.get(r.product_id);
        const changePct =
          prev && prev > 0
            ? Math.round(((current - prev) / prev) * 1000) / 10
            : null;
        return {
          productId: r.product_id,
          name: r.name,
          volumeKg: current,
          avgPricePerKg: Number(r.avg_price),
          changePct,
        };
      });
    });
  }

  async getSalesSummary(tenantId: string): Promise<{
    today: { total: number; count: number };
    week: { total: number; count: number };
    month: { total: number; count: number };
  }> {
    const schemaName = this.getSchemaName(tenantId);
    return this.withQueryRunner(tenantId, async (qr) => {
      const [today] = await qr.query(`
        SELECT
          COALESCE(SUM(si.subtotal), 0) as total,
          COUNT(DISTINCT s.id) as count
        FROM "${schemaName}".sales s
        JOIN "${schemaName}".sale_items si ON si.sale_id = s.id
        WHERE DATE(s.sold_at) = CURRENT_DATE
      `);

      const [week] = await qr.query(`
        SELECT
          COALESCE(SUM(si.subtotal), 0) as total,
          COUNT(DISTINCT s.id) as count
        FROM "${schemaName}".sales s
        JOIN "${schemaName}".sale_items si ON si.sale_id = s.id
        WHERE s.sold_at >= CURRENT_DATE - interval '7 days'
      `);

      const [month] = await qr.query(`
        SELECT
          COALESCE(SUM(si.subtotal), 0) as total,
          COUNT(DISTINCT s.id) as count
        FROM "${schemaName}".sales s
        JOIN "${schemaName}".sale_items si ON si.sale_id = s.id
        WHERE s.sold_at >= date_trunc('month', CURRENT_DATE)
          AND s.sold_at < date_trunc('month', CURRENT_DATE) + interval '1 month'
      `);

      return {
        today: { total: Number(today.total), count: Number(today.count) },
        week: { total: Number(week.total), count: Number(week.count) },
        month: { total: Number(month.total), count: Number(month.count) },
      };
    });
  }

  async getPurchasesSummary(tenantId: string): Promise<{
    today: { total: number; count: number };
    week: { total: number; count: number };
    month: { total: number; count: number };
  }> {
    const schemaName = this.getSchemaName(tenantId);
    return this.withQueryRunner(tenantId, async (qr) => {
      const [today] = await qr.query(`
        SELECT
          COALESCE(SUM(total_amount), 0) as total,
          COUNT(*) as count
        FROM "${schemaName}".purchases
        WHERE DATE(purchased_at) = CURRENT_DATE
      `);

      const [week] = await qr.query(`
        SELECT
          COALESCE(SUM(total_amount), 0) as total,
          COUNT(*) as count
        FROM "${schemaName}".purchases
        WHERE purchased_at >= CURRENT_DATE - interval '7 days'
      `);

      const [month] = await qr.query(`
        SELECT
          COALESCE(SUM(total_amount), 0) as total,
          COUNT(*) as count
        FROM "${schemaName}".purchases
        WHERE purchased_at >= date_trunc('month', CURRENT_DATE)
          AND purchased_at < date_trunc('month', CURRENT_DATE) + interval '1 month'
      `);

      return {
        today: { total: Number(today.total), count: Number(today.count) },
        week: { total: Number(week.total), count: Number(week.count) },
        month: { total: Number(month.total), count: Number(month.count) },
      };
    });
  }
}
