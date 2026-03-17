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
    `CREATE TABLE IF NOT EXISTS "${schemaName}".catalog_services (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      nome VARCHAR NOT NULL,
      descricao VARCHAR,
      preco_padrao NUMERIC(10,2) NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS "${schemaName}".catalog_parts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      nome VARCHAR NOT NULL,
      codigo VARCHAR,
      preco_unitario NUMERIC(10,2) NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS "${schemaName}".appointments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      cliente_id UUID NOT NULL,
      veiculo_id UUID NOT NULL,
      data_hora TIMESTAMPTZ NOT NULL,
      duracao_min INT NOT NULL DEFAULT 60,
      tipo_servico VARCHAR,
      status VARCHAR NOT NULL DEFAULT 'PENDENTE',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS "${schemaName}".appointment_comments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      appointment_id UUID NOT NULL
        REFERENCES "${schemaName}".appointments(id) ON DELETE CASCADE,
      texto VARCHAR NOT NULL,
      created_by_id UUID NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
  ];
}
