import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPlatformUsersAndAdminIndexes1749000000000 implements MigrationInterface {
  name = 'AddPlatformUsersAndAdminIndexes1749000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "public"."platform_users" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "email" varchar NOT NULL,
        "password_hash" varchar NOT NULL,
        "name" varchar NOT NULL,
        "role" varchar NOT NULL DEFAULT 'PLATFORM_OWNER',
        "last_login_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_platform_users" PRIMARY KEY ("id"),
        CONSTRAINT "uq_platform_users_email" UNIQUE ("email")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "public"."platform_refresh_tokens" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "platform_user_id" uuid NOT NULL,
        "token_hash" varchar NOT NULL,
        "expires_at" timestamptz NOT NULL,
        "revoked" boolean NOT NULL DEFAULT false,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_platform_refresh_tokens" PRIMARY KEY ("id"),
        CONSTRAINT "fk_platform_refresh_user"
          FOREIGN KEY ("platform_user_id")
          REFERENCES "public"."platform_users"("id")
          ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_platform_refresh_token_hash"
        ON "public"."platform_refresh_tokens" ("token_hash")
    `);

    // Performance — agregações de admin
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_tenants_status"
        ON "public"."tenants" ("status")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_tenants_segment_status"
        ON "public"."tenants" ("segment", "status")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_tenants_trial_ends_at"
        ON "public"."tenants" ("trial_ends_at")
        WHERE status = 'TRIAL'
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_tenants_endereco_state"
        ON "public"."tenants" ((endereco->>'state'))
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_tenants_whatsapp_enabled"
        ON "public"."tenants" ("whatsapp_enabled")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."idx_tenants_whatsapp_enabled"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."idx_tenants_endereco_state"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."idx_tenants_trial_ends_at"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."idx_tenants_segment_status"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."idx_tenants_status"`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "public"."platform_refresh_tokens"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "public"."platform_users"`);
  }
}
