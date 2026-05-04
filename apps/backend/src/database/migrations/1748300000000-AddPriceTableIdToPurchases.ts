import { MigrationInterface, QueryRunner } from 'typeorm';
import { TenantSegment } from '@praktikus/shared';
import { buildPurchasesPriceTableSetupSql } from '../tenant-migrations/price-tables.sql';

export class AddPriceTableIdToPurchases1748300000000 implements MigrationInterface {
  name = 'AddPriceTableIdToPurchases1748300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const tenants: Array<{ id: string }> = await queryRunner.query(
      `SELECT id FROM "public"."tenants" WHERE segment = $1`,
      [TenantSegment.RECYCLING],
    );

    for (const tenant of tenants) {
      const schema = `tenant_${tenant.id.replace(/-/g, '')}`;
      for (const sql of buildPurchasesPriceTableSetupSql(schema)) {
        await queryRunner.query(sql);
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const tenants: Array<{ id: string }> = await queryRunner.query(
      `SELECT id FROM "public"."tenants" WHERE segment = $1`,
      [TenantSegment.RECYCLING],
    );

    for (const tenant of tenants) {
      const schema = `tenant_${tenant.id.replace(/-/g, '')}`;
      await queryRunner.query(
        `ALTER TABLE "${schema}".purchases DROP CONSTRAINT IF EXISTS fk_purchases_price_table`,
      );
      await queryRunner.query(
        `ALTER TABLE "${schema}".purchases DROP COLUMN IF EXISTS price_table_id`,
      );
    }
  }
}
