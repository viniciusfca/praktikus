import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPaymentMethodToSales1748000000000 implements MigrationInterface {
  name = 'AddPaymentMethodToSales1748000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const tenants: Array<{ id: string }> = await queryRunner.query(
      `SELECT id FROM "public"."tenants" WHERE segment = 'RECYCLING'`,
    );

    for (const tenant of tenants) {
      const schemaName = `tenant_${tenant.id.replace(/-/g, '')}`;

      await queryRunner.query(`
        ALTER TABLE "${schemaName}"."sales"
        ADD COLUMN IF NOT EXISTS "payment_method" varchar
      `);

      // Backfill: existing sales become CASH (assume past sales were upfront-paid;
      // no retroactive cash_transaction will be created — this migration only fills
      // the column).
      await queryRunner.query(`
        UPDATE "${schemaName}"."sales"
        SET "payment_method" = 'CASH'
        WHERE "payment_method" IS NULL
      `);

      await queryRunner.query(`
        ALTER TABLE "${schemaName}"."sales"
        ALTER COLUMN "payment_method" SET NOT NULL
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const tenants: Array<{ id: string }> = await queryRunner.query(
      `SELECT id FROM "public"."tenants" WHERE segment = 'RECYCLING'`,
    );

    for (const tenant of tenants) {
      const schemaName = `tenant_${tenant.id.replace(/-/g, '')}`;
      await queryRunner.query(`
        ALTER TABLE "${schemaName}"."sales"
        DROP COLUMN IF EXISTS "payment_method"
      `);
    }
  }
}
