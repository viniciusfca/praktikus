import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddApprovalTokensTable1742680000000 implements MigrationInterface {
  name = 'AddApprovalTokensTable1742680000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "public"."service_order_approval_tokens" (
        "token" uuid NOT NULL,
        "tenant_id" uuid NOT NULL,
        "so_id" uuid NOT NULL,
        "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "used_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_service_order_approval_tokens" PRIMARY KEY ("token")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_so_approval_tokens_tenant" ON "public"."service_order_approval_tokens" ("tenant_id")`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "public"."service_order_approval_tokens"`);
  }
}
