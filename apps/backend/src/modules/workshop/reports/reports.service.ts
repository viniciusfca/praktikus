import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';

@Injectable()
export class ReportsService {
  constructor(private readonly dataSource: DataSource) {}

  private getSchemaName(tenantId: string): string {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantId)) {
      throw new Error('Invalid tenantId');
    }
    return `tenant_${tenantId.replace(/-/g, '')}`;
  }

  private async withSchema<T>(
    tenantId: string,
    fn: (manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    const schemaName = this.getSchemaName(tenantId);
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    try {
      await qr.query(`SET search_path TO "${schemaName}", public`);
      return await fn(qr.manager);
    } finally {
      await qr.release();
    }
  }

  async getReport(tenantId: string, dateStart: string, dateEnd: string) {
    if (new Date(dateStart) > new Date(dateEnd)) {
      throw new BadRequestException('date_start não pode ser maior que date_end.');
    }

    return this.withSchema(tenantId, async (manager) => {
      const [kpi] = await manager.query<any[]>(
        `SELECT
           COUNT(*)                                               AS "totalOs",
           COUNT(CASE WHEN status_pagamento = 'PAGO' THEN 1 END) AS "osPagas"
         FROM service_orders
         WHERE status != 'ORCAMENTO'
           AND created_at::date >= $1::date
           AND created_at::date <= $2::date`,
        [dateStart, dateEnd],
      );

      const [svRow] = await manager.query<any[]>(
        `SELECT COALESCE(SUM(s.valor), 0) AS "faturamentoServicos"
         FROM so_items_services s
         JOIN service_orders so ON so.id = s.so_id
         WHERE so.status != 'ORCAMENTO'
           AND so.created_at::date >= $1::date
           AND so.created_at::date <= $2::date`,
        [dateStart, dateEnd],
      );

      const [pvRow] = await manager.query<any[]>(
        `SELECT COALESCE(SUM(p.quantidade * p.valor_unitario), 0) AS "faturamentoPecas"
         FROM so_items_parts p
         JOIN service_orders so ON so.id = p.so_id
         WHERE so.status != 'ORCAMENTO'
           AND so.created_at::date >= $1::date
           AND so.created_at::date <= $2::date`,
        [dateStart, dateEnd],
      );

      const statusRows = await manager.query<any[]>(
        `SELECT status, COUNT(*) AS count
         FROM service_orders
         WHERE status != 'ORCAMENTO'
           AND created_at::date >= $1::date
           AND created_at::date <= $2::date
         GROUP BY status
         ORDER BY count DESC`,
        [dateStart, dateEnd],
      );

      const mesRows = await manager.query<any[]>(
        `SELECT
           TO_CHAR(so.created_at, 'YYYY-MM')                        AS mes,
           COALESCE(SUM(sv.total_servicos), 0)                      AS servicos,
           COALESCE(SUM(pv.total_pecas), 0)                         AS pecas,
           COALESCE(SUM(sv.total_servicos), 0) + COALESCE(SUM(pv.total_pecas), 0) AS total
         FROM service_orders so
         LEFT JOIN (
           SELECT so_id, SUM(valor) AS total_servicos
           FROM so_items_services GROUP BY so_id
         ) sv ON sv.so_id = so.id
         LEFT JOIN (
           SELECT so_id, SUM(quantidade * valor_unitario) AS total_pecas
           FROM so_items_parts GROUP BY so_id
         ) pv ON pv.so_id = so.id
         WHERE so.status != 'ORCAMENTO'
           AND so.created_at::date >= $1::date
           AND so.created_at::date <= $2::date
         GROUP BY mes
         ORDER BY mes ASC`,
        [dateStart, dateEnd],
      );

      const topRows = await manager.query<any[]>(
        `SELECT
           s.nome_servico AS "nomeServico",
           COUNT(*)       AS quantidade,
           SUM(s.valor)   AS receita
         FROM so_items_services s
         JOIN service_orders so ON so.id = s.so_id
         WHERE so.status != 'ORCAMENTO'
           AND so.created_at::date >= $1::date
           AND so.created_at::date <= $2::date
         GROUP BY s.nome_servico
         ORDER BY quantidade DESC
         LIMIT 10`,
        [dateStart, dateEnd],
      );

      const faturamentoServicos = Math.round(Number(svRow.faturamentoServicos ?? 0) * 100) / 100;
      const faturamentoPecas = Math.round(Number(pvRow.faturamentoPecas ?? 0) * 100) / 100;

      return {
        periodo: { dateStart, dateEnd },
        faturamentoTotal: Math.round((faturamentoServicos + faturamentoPecas) * 100) / 100,
        faturamentoServicos,
        faturamentoPecas,
        totalOs: Number(kpi.totalOs),
        osPagas: Number(kpi.osPagas),
        osPorStatus: statusRows.map((r) => ({ status: r.status, count: Number(r.count) })),
        faturamentoPorMes: mesRows.map((r) => ({
          mes: r.mes,
          servicos: Math.round(Number(r.servicos) * 100) / 100,
          pecas: Math.round(Number(r.pecas) * 100) / 100,
          total: Math.round(Number(r.total) * 100) / 100,
        })),
        topServicos: topRows.map((r) => ({
          nomeServico: r.nomeServico,
          quantidade: Number(r.quantidade),
          receita: Math.round(Number(r.receita) * 100) / 100,
        })),
      };
    });
  }
}
