import { MigrationInterface, QueryRunner } from 'typeorm';

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

      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS "${schema}".whatsapp_accounts (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          phone_number_id VARCHAR NOT NULL,
          waba_id VARCHAR NOT NULL,
          display_phone VARCHAR NOT NULL,
          access_token TEXT NOT NULL,
          webhook_verify_token VARCHAR NOT NULL,
          status VARCHAR NOT NULL DEFAULT 'PENDING',
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);

      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS "${schema}".whatsapp_departments (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name VARCHAR NOT NULL,
          color VARCHAR(7) NOT NULL,
          business_hours JSONB,
          default_routing BOOLEAN NOT NULL DEFAULT false,
          routing_keywords TEXT[],
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);

      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS "${schema}".whatsapp_department_users (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          department_id UUID NOT NULL REFERENCES "${schema}".whatsapp_departments(id) ON DELETE CASCADE,
          user_id UUID NOT NULL,
          role_in_dept VARCHAR NOT NULL DEFAULT 'AGENT',
          CONSTRAINT uq_dept_user UNIQUE (department_id, user_id)
        )
      `);

      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS "${schema}".whatsapp_conversations (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          contact_phone VARCHAR NOT NULL,
          contact_name VARCHAR,
          department_id UUID REFERENCES "${schema}".whatsapp_departments(id) ON DELETE SET NULL,
          assigned_user_id UUID,
          status VARCHAR NOT NULL DEFAULT 'OPEN',
          last_message_at TIMESTAMPTZ,
          window_expires_at TIMESTAMPTZ,
          linked_customer_id UUID,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);
      await queryRunner.query(
        `CREATE INDEX IF NOT EXISTS idx_conversations_phone ON "${schema}".whatsapp_conversations(contact_phone)`,
      );
      await queryRunner.query(
        `CREATE INDEX IF NOT EXISTS idx_conversations_status ON "${schema}".whatsapp_conversations(status)`,
      );

      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS "${schema}".whatsapp_messages (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          conversation_id UUID NOT NULL REFERENCES "${schema}".whatsapp_conversations(id) ON DELETE CASCADE,
          wamid VARCHAR NOT NULL,
          direction VARCHAR NOT NULL,
          type VARCHAR NOT NULL,
          body TEXT,
          template_name VARCHAR,
          status VARCHAR NOT NULL DEFAULT 'SENT',
          billable_category VARCHAR,
          sent_at TIMESTAMPTZ,
          delivered_at TIMESTAMPTZ,
          read_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          CONSTRAINT uq_messages_wamid UNIQUE (wamid)
        )
      `);
      await queryRunner.query(
        `CREATE INDEX IF NOT EXISTS idx_messages_conversation ON "${schema}".whatsapp_messages(conversation_id)`,
      );

      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS "${schema}".whatsapp_usage_counters (
          year_month CHAR(7) PRIMARY KEY,
          service_conversations INT NOT NULL DEFAULT 0,
          utility_conversations INT NOT NULL DEFAULT 0,
          marketing_conversations INT NOT NULL DEFAULT 0,
          authentication_conversations INT NOT NULL DEFAULT 0
        )
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const tenants: Array<{ id: string }> = await queryRunner.query(
      `SELECT id FROM "public"."tenants"`,
    );

    for (const tenant of tenants) {
      const schema = `tenant_${tenant.id.replace(/-/g, '')}`;
      await queryRunner.query(`DROP TABLE IF EXISTS "${schema}".whatsapp_messages CASCADE`);
      await queryRunner.query(`DROP TABLE IF EXISTS "${schema}".whatsapp_conversations CASCADE`);
      await queryRunner.query(`DROP TABLE IF EXISTS "${schema}".whatsapp_department_users CASCADE`);
      await queryRunner.query(`DROP TABLE IF EXISTS "${schema}".whatsapp_departments CASCADE`);
      await queryRunner.query(`DROP TABLE IF EXISTS "${schema}".whatsapp_accounts CASCADE`);
      await queryRunner.query(`DROP TABLE IF EXISTS "${schema}".whatsapp_usage_counters CASCADE`);
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
