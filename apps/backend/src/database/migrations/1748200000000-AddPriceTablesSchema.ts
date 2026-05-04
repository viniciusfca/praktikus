import { MigrationInterface, QueryRunner } from 'typeorm';
import {
  buildPriceTablesSql,
  buildPriceTablesSeedSql,
  buildProductPricesBackfillSql,
} from '../tenant-migrations/price-tables.sql';
import { TenantSegment } from '@praktikus/shared';

export class AddPriceTablesSchema1748200000000 implements MigrationInterface {
  name = 'AddPriceTablesSchema1748200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const tenants: Array<{ id: string; segment: TenantSegment }> =
      await queryRunner.query(
        `SELECT id, segment FROM "public"."tenants" WHERE segment = 'RECYCLING'`,
      );

    for (const tenant of tenants) {
      const schema = `tenant_${tenant.id.replace(/-/g, '')}`;
      // 1) Create tables
      for (const sql of buildPriceTablesSql(schema)) {
        await queryRunner.query(sql);
      }
      // 2) Seed 3 tables (idempotent)
      for (const sql of buildPriceTablesSeedSql(schema)) {
        await queryRunner.query(sql);
      }
      // 3) Backfill: copy price_per_unit from products to default table
      await queryRunner.query(buildProductPricesBackfillSql(schema));
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const tenants: Array<{ id: string }> = await queryRunner.query(
      `SELECT id FROM "public"."tenants" WHERE segment = 'RECYCLING'`,
    );

    for (const tenant of tenants) {
      const schema = `tenant_${tenant.id.replace(/-/g, '')}`;
      await queryRunner.query(
        `DROP TABLE IF EXISTS "${schema}".product_prices CASCADE`,
      );
      await queryRunner.query(
        `DROP TABLE IF EXISTS "${schema}".price_tables CASCADE`,
      );
    }
  }
}
