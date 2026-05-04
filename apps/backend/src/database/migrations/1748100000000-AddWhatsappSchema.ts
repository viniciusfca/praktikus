import { MigrationInterface, QueryRunner } from 'typeorm';
import { buildWhatsappTablesSql } from '../tenant-migrations/whatsapp-tables.sql';

export class AddWhatsappSchema1748100000000 implements MigrationInterface {
  name = 'AddWhatsappSchema1748100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1) public.tenants — add 4 WhatsApp columns
    await queryRunner.query(`
      ALTER TABLE "public"."tenants"
        ADD COLUMN IF NOT EXISTS "whatsapp_enabled" BOOLEAN NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "whatsapp_plan" VARCHAR,
        ADD COLUMN IF NOT EXISTS "whatsapp_asaas_subscription_id" VARCHAR,
        ADD COLUMN IF NOT EXISTS "whatsapp_agent_limit_override" INTEGER
    `);

    // 2) Existing tenant schemas — create 6 WhatsApp tables in each
    const tenants: Array<{ id: string }> = await queryRunner.query(
      `SELECT id FROM "public"."tenants"`,
    );

    for (const tenant of tenants) {
      const schema = `tenant_${tenant.id.replace(/-/g, '')}`;
      for (const sql of buildWhatsappTablesSql(schema)) {
        await queryRunner.query(sql);
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const tenants: Array<{ id: string }> = await queryRunner.query(
      `SELECT id FROM "public"."tenants"`,
    );

    for (const tenant of tenants) {
      const schema = `tenant_${tenant.id.replace(/-/g, '')}`;
      await queryRunner.query(
        `DROP TABLE IF EXISTS "${schema}".whatsapp_messages CASCADE`,
      );
      await queryRunner.query(
        `DROP TABLE IF EXISTS "${schema}".whatsapp_conversations CASCADE`,
      );
      await queryRunner.query(
        `DROP TABLE IF EXISTS "${schema}".whatsapp_department_users CASCADE`,
      );
      await queryRunner.query(
        `DROP TABLE IF EXISTS "${schema}".whatsapp_departments CASCADE`,
      );
      await queryRunner.query(
        `DROP TABLE IF EXISTS "${schema}".whatsapp_accounts CASCADE`,
      );
      await queryRunner.query(
        `DROP TABLE IF EXISTS "${schema}".whatsapp_usage_counters CASCADE`,
      );
    }

    await queryRunner.query(`
      ALTER TABLE "public"."tenants"
        DROP COLUMN IF EXISTS "whatsapp_agent_limit_override",
        DROP COLUMN IF EXISTS "whatsapp_asaas_subscription_id",
        DROP COLUMN IF EXISTS "whatsapp_plan",
        DROP COLUMN IF EXISTS "whatsapp_enabled"
    `);
  }
}
