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

/**
 * Adiciona coluna `price_table_id` em `purchases`, faz backfill com a tabela
 * padrão e cria FK. Idempotente: pode rodar múltiplas vezes sem efeito.
 *
 * Compartilhado entre:
 * - `create-tenant-tables.ts` — provisioning de NOVOS tenants (após price_tables seedada).
 * - `1748300000000-AddPriceTableIdToPurchases.ts` — backfill em tenants existentes.
 *
 * Pré-condição: `price_tables` deve existir e ter pelo menos uma linha com `is_default=true AND active=true`.
 */
export function buildPurchasesPriceTableSetupSql(schemaName: string): string[] {
  return [
    // 1) Adiciona a coluna se não existir
    `ALTER TABLE "${schemaName}".purchases
       ADD COLUMN IF NOT EXISTS price_table_id UUID`,

    // 2) Backfill: linhas sem priceTableId recebem a tabela padrão
    `UPDATE "${schemaName}".purchases p
        SET price_table_id = pt.id
       FROM "${schemaName}".price_tables pt
      WHERE pt.is_default = true AND pt.active = true AND p.price_table_id IS NULL`,

    // 3) NOT NULL (idempotente — Postgres aceita SET NOT NULL em coluna já NOT NULL)
    `ALTER TABLE "${schemaName}".purchases
       ALTER COLUMN price_table_id SET NOT NULL`,

    // 4) FK condicional (Postgres não tem ADD CONSTRAINT IF NOT EXISTS)
    `DO $do$ BEGIN
       IF NOT EXISTS (
         SELECT 1 FROM information_schema.table_constraints
          WHERE table_schema = '${schemaName}'
            AND table_name = 'purchases'
            AND constraint_name = 'fk_purchases_price_table'
       ) THEN
         ALTER TABLE "${schemaName}".purchases
           ADD CONSTRAINT fk_purchases_price_table
           FOREIGN KEY (price_table_id)
           REFERENCES "${schemaName}".price_tables(id)
           ON DELETE RESTRICT;
       END IF;
     END $do$`,
  ];
}
