import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTenantOverdueAt1750100000000 implements MigrationInterface {
  name = 'AddTenantOverdueAt1750100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "public"."tenants"
        ADD COLUMN IF NOT EXISTS "overdue_at" TIMESTAMPTZ
    `);

    // Backfill: tenants currently OVERDUE → set overdue_at = updated_at (best estimate)
    await queryRunner.query(`
      UPDATE "public"."tenants"
      SET "overdue_at" = "updated_at"
      WHERE "status" = 'OVERDUE' AND "overdue_at" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "public"."tenants" DROP COLUMN IF EXISTS "overdue_at"
    `);
  }
}
