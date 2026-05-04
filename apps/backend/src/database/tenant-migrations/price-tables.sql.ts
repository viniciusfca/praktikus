/**
 * SQL para criar tabelas de preço e preços por tabela dentro do schema de um tenant.
 *
 * Compartilhado entre:
 * - `create-tenant-tables.ts` — provisiona schema de NOVOS tenants no signup.
 * - `1748200000000-AddPriceTablesSchema.ts` — backfill em tenants existentes.
 *
 * Não modifique este arquivo após uma migration que o utilize ter sido executada
 * em produção; alterações em DDL futuras devem ser feitas via novas migrations
 * `ALTER TABLE`.
 */
export function buildPriceTablesSql(schemaName: string): string[] {
  return [
    `CREATE TABLE IF NOT EXISTS "${schemaName}".price_tables (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR NOT NULL,
      description VARCHAR,
      sort_order INTEGER NOT NULL,
      is_default BOOLEAN NOT NULL DEFAULT false,
      active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS price_tables_one_default_idx
       ON "${schemaName}".price_tables (is_default) WHERE is_default = true`,
    `CREATE TABLE IF NOT EXISTS "${schemaName}".product_prices (
      product_id UUID NOT NULL REFERENCES "${schemaName}".products(id) ON DELETE CASCADE,
      price_table_id UUID NOT NULL REFERENCES "${schemaName}".price_tables(id) ON DELETE RESTRICT,
      price NUMERIC(10,4) NOT NULL,
      PRIMARY KEY (product_id, price_table_id)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_product_prices_table
       ON "${schemaName}".product_prices(price_table_id)`,
  ];
}

/**
 * Insere as 3 tabelas seedadas (idempotente). Roda após buildPriceTablesSql.
 * Tabela 1 é marcada como is_default=true.
 */
export function buildPriceTablesSeedSql(schemaName: string): string[] {
  return [
    `INSERT INTO "${schemaName}".price_tables (name, description, sort_order, is_default, active)
       SELECT 'Tabela 1 — Padrão', NULL, 1, true, true
       WHERE NOT EXISTS (
         SELECT 1 FROM "${schemaName}".price_tables WHERE sort_order = 1
       )`,
    `INSERT INTO "${schemaName}".price_tables (name, description, sort_order, is_default, active)
       SELECT 'Tabela 2', NULL, 2, false, true
       WHERE NOT EXISTS (
         SELECT 1 FROM "${schemaName}".price_tables WHERE sort_order = 2
       )`,
    `INSERT INTO "${schemaName}".price_tables (name, description, sort_order, is_default, active)
       SELECT 'Tabela 3', NULL, 3, false, true
       WHERE NOT EXISTS (
         SELECT 1 FROM "${schemaName}".price_tables WHERE sort_order = 3
       )`,
  ];
}

/**
 * Backfill: para cada produto existente com price_per_unit não-null,
 * cria uma entrada em product_prices apontando pra tabela padrão.
 */
export function buildProductPricesBackfillSql(schemaName: string): string {
  return `
    INSERT INTO "${schemaName}".product_prices (product_id, price_table_id, price)
    SELECT p.id, pt.id, p.price_per_unit
      FROM "${schemaName}".products p
      JOIN "${schemaName}".price_tables pt ON pt.is_default = true AND pt.active = true
     WHERE p.price_per_unit IS NOT NULL
    ON CONFLICT (product_id, price_table_id) DO NOTHING
  `;
}
