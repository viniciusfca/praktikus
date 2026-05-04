/**
 * SQL para criar as 6 tabelas do módulo WhatsApp dentro de um schema de tenant.
 *
 * Compartilhado entre:
 * - `create-tenant-tables.ts` — provisiona schema de NOVOS tenants no signup.
 * - `1748100000000-AddWhatsappSchema.ts` — backfill em tenants existentes.
 *
 * Não modifique este arquivo após uma migration que o utilize ter sido executada
 * em produção; alterações em DDL futuras devem ser feitas via novas migrations
 * `ALTER TABLE`. Esse contrato mantém a migration estável e idempotente.
 */
export function buildWhatsappTablesSql(schemaName: string): string[] {
  return [
    `CREATE TABLE IF NOT EXISTS "${schemaName}".whatsapp_accounts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      phone_number_id VARCHAR NOT NULL,
      waba_id VARCHAR NOT NULL,
      display_phone VARCHAR NOT NULL,
      access_token TEXT NOT NULL,
      webhook_verify_token VARCHAR NOT NULL,
      status VARCHAR NOT NULL DEFAULT 'PENDING',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS "${schemaName}".whatsapp_departments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR NOT NULL,
      color VARCHAR(7) NOT NULL,
      business_hours JSONB,
      default_routing BOOLEAN NOT NULL DEFAULT false,
      routing_keywords TEXT[],
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS "${schemaName}".whatsapp_department_users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      department_id UUID NOT NULL REFERENCES "${schemaName}".whatsapp_departments(id) ON DELETE CASCADE,
      user_id UUID NOT NULL,
      role_in_dept VARCHAR NOT NULL DEFAULT 'AGENT',
      CONSTRAINT uq_dept_user UNIQUE (department_id, user_id)
    )`,
    `CREATE TABLE IF NOT EXISTS "${schemaName}".whatsapp_conversations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      contact_phone VARCHAR NOT NULL,
      contact_name VARCHAR,
      department_id UUID REFERENCES "${schemaName}".whatsapp_departments(id) ON DELETE SET NULL,
      assigned_user_id UUID,
      status VARCHAR NOT NULL DEFAULT 'OPEN',
      last_message_at TIMESTAMPTZ,
      window_expires_at TIMESTAMPTZ,
      linked_customer_id UUID,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_conversations_phone ON "${schemaName}".whatsapp_conversations(contact_phone)`,
    `CREATE INDEX IF NOT EXISTS idx_conversations_status ON "${schemaName}".whatsapp_conversations(status)`,
    `CREATE TABLE IF NOT EXISTS "${schemaName}".whatsapp_messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      conversation_id UUID NOT NULL REFERENCES "${schemaName}".whatsapp_conversations(id) ON DELETE CASCADE,
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
    )`,
    `CREATE INDEX IF NOT EXISTS idx_messages_conversation ON "${schemaName}".whatsapp_messages(conversation_id)`,
    `CREATE TABLE IF NOT EXISTS "${schemaName}".whatsapp_usage_counters (
      year_month CHAR(7) PRIMARY KEY,
      service_conversations INT NOT NULL DEFAULT 0,
      utility_conversations INT NOT NULL DEFAULT 0,
      marketing_conversations INT NOT NULL DEFAULT 0,
      authentication_conversations INT NOT NULL DEFAULT 0
    )`,
  ];
}
