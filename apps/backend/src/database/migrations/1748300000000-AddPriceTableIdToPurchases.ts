import { MigrationInterface, QueryRunner } from 'typeorm';
import { TenantSegment } from '@praktikus/shared';
import { buildPurchasesPriceTableSetupSql } from '../tenant-migrations/price-tables.sql';

export class AddPriceTableIdToPurchases1748300000000 implements MigrationInterface {
  name = 'AddPriceTableIdToPurchases1748300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Filtra tenants que têm schema realmente provisionado (defesa contra
    // dados sujos: linha em public.tenants sem schema correspondente).
    const tenants: Array<{ id: string }> = await queryRunner.query(
      `SELECT t.id FROM "public"."tenants" t
       WHERE t.segment = $1
         AND EXISTS (
           SELECT 1 FROM information_schema.schemata s
           WHERE s.schema_name = 'tenant_' || replace(t.id::text, '-', '')
         )`,
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
      `SELECT t.id FROM "public"."tenants" t
       WHERE t.segment = $1
         AND EXISTS (
           SELECT 1 FROM information_schema.schemata s
           WHERE s.schema_name = 'tenant_' || replace(t.id::text, '-', '')
         )`,
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
