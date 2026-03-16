import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePublicSchema1700000000000 implements MigrationInterface {
  name = 'CreatePublicSchema1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Enable uuid-ossp extension (required for uuid_generate_v4)
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    // Create enum types
    await queryRunner.query(`
      CREATE TYPE "public"."tenants_status_enum" AS ENUM('TRIAL', 'ACTIVE', 'OVERDUE', 'SUSPENDED')
    `);

    await queryRunner.query(`
      CREATE TYPE "public"."users_role_enum" AS ENUM('OWNER', 'EMPLOYEE')
    `);

    // Create tenants table
    await queryRunner.query(`
      CREATE TABLE "public"."tenants" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "slug" character varying NOT NULL,
        "schema_name" character varying NOT NULL,
        "cnpj" character varying NOT NULL,
        "razao_social" character varying NOT NULL,
        "nome_fantasia" character varying NOT NULL,
        "endereco" jsonb,
        "telefone" character varying,
        "logo_url" character varying,
        "status" "public"."tenants_status_enum" NOT NULL DEFAULT 'TRIAL',
        "trial_ends_at" TIMESTAMP WITH TIME ZONE,
        "billing_anchor_date" date,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_tenants_slug" UNIQUE ("slug"),
        CONSTRAINT "UQ_tenants_schema_name" UNIQUE ("schema_name"),
        CONSTRAINT "UQ_tenants_cnpj" UNIQUE ("cnpj"),
        CONSTRAINT "PK_tenants" PRIMARY KEY ("id")
      )
    `);

    // Create users table
    await queryRunner.query(`
      CREATE TABLE "public"."users" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" character varying NOT NULL,
        "email" character varying NOT NULL,
        "password_hash" character varying NOT NULL,
        "name" character varying NOT NULL,
        "role" "public"."users_role_enum" NOT NULL DEFAULT 'OWNER',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_users_email" UNIQUE ("email"),
        CONSTRAINT "PK_users" PRIMARY KEY ("id")
      )
    `);

    // Create refresh_tokens table
    await queryRunner.query(`
      CREATE TABLE "public"."refresh_tokens" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" character varying NOT NULL,
        "token_hash" character varying NOT NULL,
        "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "revoked" boolean NOT NULL DEFAULT false,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_refresh_tokens_token_hash" UNIQUE ("token_hash"),
        CONSTRAINT "PK_refresh_tokens" PRIMARY KEY ("id")
      )
    `);

    // Create billing table
    await queryRunner.query(`
      CREATE TABLE "public"."billing" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" character varying NOT NULL,
        "asaas_customer_id" character varying,
        "asaas_subscription_id" character varying,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_billing_tenant_id" UNIQUE ("tenant_id"),
        CONSTRAINT "PK_billing" PRIMARY KEY ("id")
      )
    `);

    // Create indexes
    await queryRunner.query(`CREATE INDEX "IDX_tenants_slug" ON "public"."tenants" ("slug")`);
    await queryRunner.query(`CREATE INDEX "IDX_tenants_cnpj" ON "public"."tenants" ("cnpj")`);
    await queryRunner.query(`CREATE INDEX "IDX_users_email" ON "public"."users" ("email")`);
    await queryRunner.query(`CREATE INDEX "IDX_refresh_tokens_user_id" ON "public"."refresh_tokens" ("user_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_billing_tenant_id" ON "public"."billing" ("tenant_id")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "public"."billing"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "public"."refresh_tokens"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "public"."users"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "public"."tenants"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."users_role_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."tenants_status_enum"`);
  }
}
