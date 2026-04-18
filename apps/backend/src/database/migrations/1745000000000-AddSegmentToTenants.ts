import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSegmentToTenants1745000000000 implements MigrationInterface {
  name = 'AddSegmentToTenants1745000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "public"."tenants"
        ADD COLUMN IF NOT EXISTS "segment" character varying NOT NULL DEFAULT 'WORKSHOP'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "public"."tenants" DROP COLUMN IF EXISTS "segment"
    `);
  }
}
