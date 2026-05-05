import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBillingSelfServiceFields1750000000000 implements MigrationInterface {
  name = 'AddBillingSelfServiceFields1750000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1) public.billing — 6 colunas novas
    await queryRunner.query(`
      ALTER TABLE "public"."billing"
        ADD COLUMN IF NOT EXISTS "billing_type" VARCHAR(20),
        ADD COLUMN IF NOT EXISTS "card_last4" VARCHAR(4),
        ADD COLUMN IF NOT EXISTS "card_brand" VARCHAR(20),
        ADD COLUMN IF NOT EXISTS "card_expiry" VARCHAR(5),
        ADD COLUMN IF NOT EXISTS "next_due_date" DATE,
        ADD COLUMN IF NOT EXISTS "canceled_at" TIMESTAMPTZ
    `);

    // 2) public.billing_invoices — nova tabela
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "public"."billing_invoices" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id" UUID NOT NULL,
        "asaas_payment_id" VARCHAR(64) NOT NULL UNIQUE,
        "value" NUMERIC(10,2) NOT NULL,
        "due_date" DATE NOT NULL,
        "status" VARCHAR(20) NOT NULL,
        "paid_at" TIMESTAMPTZ,
        "billing_type" VARCHAR(20) NOT NULL,
        "pix_qr_code" TEXT,
        "pix_copy_paste" TEXT,
        "pix_expires_at" TIMESTAMPTZ,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT "fk_billing_invoices_tenant"
          FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_billing_invoices_tenant_status"
        ON "public"."billing_invoices" ("tenant_id", "status")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "public"."billing_invoices" CASCADE`);
    await queryRunner.query(`
      ALTER TABLE "public"."billing"
        DROP COLUMN IF EXISTS "canceled_at",
        DROP COLUMN IF EXISTS "next_due_date",
        DROP COLUMN IF EXISTS "card_expiry",
        DROP COLUMN IF EXISTS "card_brand",
        DROP COLUMN IF EXISTS "card_last4",
        DROP COLUMN IF EXISTS "billing_type"
    `);
  }
}
