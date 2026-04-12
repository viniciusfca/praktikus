import { TenantSegment } from '@praktikus/shared';

/**
 * Gera as instruções SQL para criar as tabelas de um novo tenant.
 * Usa CREATE TABLE IF NOT EXISTS para idempotência (pode ser re-executado).
 */
export function createTenantTablesSql(schemaName: string, segment: TenantSegment = TenantSegment.WORKSHOP): string[] {
  const workshopTables = [
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
    `CREATE TABLE IF NOT EXISTS "${schemaName}".service_orders (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      appointment_id UUID,
      cliente_id UUID NOT NULL,
      veiculo_id UUID NOT NULL,
      status VARCHAR NOT NULL DEFAULT 'ORCAMENTO',
      status_pagamento VARCHAR NOT NULL DEFAULT 'PENDENTE',
      km_entrada VARCHAR,
      combustivel VARCHAR,
      observacoes_entrada TEXT,
      approval_token UUID,
      approval_expires_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS "${schemaName}".so_items_services (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      so_id UUID NOT NULL REFERENCES "${schemaName}".service_orders(id) ON DELETE CASCADE,
      catalog_service_id UUID NOT NULL REFERENCES "${schemaName}".catalog_services(id) ON DELETE RESTRICT,
      nome_servico VARCHAR NOT NULL,
      valor NUMERIC(10,2) NOT NULL,
      mecanico_id UUID,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS "${schemaName}".so_items_parts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      so_id UUID NOT NULL REFERENCES "${schemaName}".service_orders(id) ON DELETE CASCADE,
      catalog_part_id UUID NOT NULL REFERENCES "${schemaName}".catalog_parts(id) ON DELETE RESTRICT,
      nome_peca VARCHAR NOT NULL,
      quantidade INT NOT NULL DEFAULT 1,
      valor_unitario NUMERIC(10,2) NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
  ];

  const recyclingTables = [
    `CREATE TABLE IF NOT EXISTS "${schemaName}".units (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR NOT NULL,
      abbreviation VARCHAR NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS "${schemaName}".products (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR NOT NULL,
      unit_id UUID NOT NULL REFERENCES "${schemaName}".units(id) ON DELETE RESTRICT,
      price_per_unit NUMERIC(10,4) NOT NULL DEFAULT 0,
      active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS "${schemaName}".suppliers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR NOT NULL,
      document VARCHAR(18),
      document_type VARCHAR(4),
      phone VARCHAR,
      address JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS "${schemaName}".buyers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR NOT NULL,
      cnpj VARCHAR(14),
      phone VARCHAR,
      contact_name VARCHAR,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS "${schemaName}".cash_sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      operator_id UUID NOT NULL,
      closed_by UUID,
      opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      closed_at TIMESTAMPTZ,
      opening_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
      closing_balance NUMERIC(12,2),
      status VARCHAR NOT NULL DEFAULT 'OPEN'
    )`,
    `CREATE TABLE IF NOT EXISTS "${schemaName}".cash_transactions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      cash_session_id UUID NOT NULL REFERENCES "${schemaName}".cash_sessions(id) ON DELETE RESTRICT,
      type VARCHAR NOT NULL,
      payment_method VARCHAR NOT NULL,
      amount NUMERIC(12,2) NOT NULL,
      description VARCHAR,
      reference_id UUID,
      reference_type VARCHAR,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS "${schemaName}".purchases (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      supplier_id UUID NOT NULL REFERENCES "${schemaName}".suppliers(id) ON DELETE RESTRICT,
      operator_id UUID NOT NULL,
      cash_session_id UUID REFERENCES "${schemaName}".cash_sessions(id) ON DELETE RESTRICT,
      payment_method VARCHAR NOT NULL,
      total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
      purchased_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      notes VARCHAR,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS "${schemaName}".purchase_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      purchase_id UUID NOT NULL REFERENCES "${schemaName}".purchases(id) ON DELETE CASCADE,
      product_id UUID NOT NULL REFERENCES "${schemaName}".products(id) ON DELETE RESTRICT,
      quantity NUMERIC(10,4) NOT NULL,
      unit_price NUMERIC(10,4) NOT NULL,
      subtotal NUMERIC(12,2) NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS "${schemaName}".stock_movements (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      product_id UUID NOT NULL REFERENCES "${schemaName}".products(id) ON DELETE RESTRICT,
      type VARCHAR NOT NULL,
      quantity NUMERIC(10,4) NOT NULL,
      reference_id UUID,
      reference_type VARCHAR,
      moved_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS "${schemaName}".sales (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      buyer_id UUID NOT NULL REFERENCES "${schemaName}".buyers(id) ON DELETE RESTRICT,
      operator_id UUID NOT NULL,
      sold_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      notes VARCHAR,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS "${schemaName}".sale_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      sale_id UUID NOT NULL REFERENCES "${schemaName}".sales(id) ON DELETE CASCADE,
      product_id UUID NOT NULL REFERENCES "${schemaName}".products(id) ON DELETE RESTRICT,
      quantity NUMERIC(10,4) NOT NULL,
      unit_price NUMERIC(10,4) NOT NULL,
      subtotal NUMERIC(12,2) NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS "${schemaName}".employee_permissions (
      user_id UUID PRIMARY KEY,
      can_manage_suppliers BOOLEAN NOT NULL DEFAULT true,
      can_manage_buyers BOOLEAN NOT NULL DEFAULT false,
      can_manage_products BOOLEAN NOT NULL DEFAULT false,
      can_open_close_cash BOOLEAN NOT NULL DEFAULT true,
      can_view_stock BOOLEAN NOT NULL DEFAULT true,
      can_view_reports BOOLEAN NOT NULL DEFAULT false,
      can_register_purchases BOOLEAN NOT NULL DEFAULT true,
      can_register_sales BOOLEAN NOT NULL DEFAULT true,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,
  ];

  if (segment === TenantSegment.RECYCLING) {
    return recyclingTables;
  }
  return workshopTables;
}
