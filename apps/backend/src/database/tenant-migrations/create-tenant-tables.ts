/**
 * Gera as instruções SQL para criar as tabelas de um novo tenant.
 * Usa CREATE TABLE IF NOT EXISTS para idempotência (pode ser re-executado).
 */
export function createTenantTablesSql(schemaName: string): string[] {
  return [
    `CREATE TABLE IF NOT EXISTS "${schemaName}".customers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      nome VARCHAR NOT NULL,
      cpf_cnpj VARCHAR(14) UNIQUE NOT NULL,
      whatsapp VARCHAR,
      email VARCHAR,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS "${schemaName}".vehicles (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      customer_id UUID NOT NULL
        REFERENCES "${schemaName}".customers(id) ON DELETE RESTRICT,
      placa VARCHAR(7) UNIQUE NOT NULL,
      marca VARCHAR NOT NULL,
      modelo VARCHAR NOT NULL,
      ano INTEGER NOT NULL,
      km INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,
  ];
}
