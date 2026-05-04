# Múltiplas tabelas de preço por produto — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cadastro de Produtos do segmento Recicláveis passa a aceitar N preços por produto (uma entrada por tabela de preço configurada). Tabelas seedadas: Tabela 1 — Padrão, Tabela 2, Tabela 3.

**Architecture:** Modelo relacional separado (`price_tables` + `product_prices` com PK composta). `Product.pricePerUnit` permanece como denormalização sincronizada com a Tabela 1, permitindo que Vendas/Compras/Caixa continuem funcionando sem mudança (estratégia gradual). Frontend redesenha lista de produtos (colunas dinâmicas), modal de cadastro (2 colunas com `PriceRow`) e modal de impressão (com seletor de tabela).

**Tech Stack:** NestJS 11 + TypeORM 0.3.28 + PostgreSQL multi-schema | React 19 + CoreUI 5.6 + react-hook-form 7.71 + zod 4.3 + @react-pdf/renderer 4.3 | vitest + @testing-library/react

**Spec:** [`docs/superpowers/specs/2026-05-03-multi-price-tables-design.md`](../specs/2026-05-03-multi-price-tables-design.md)

---

## Convenções deste plano

- **Padrão de migration de schema por tenant:** SQL builder (`*.sql.ts`) consumido tanto por `create-tenant-tables.ts` (novos tenants) quanto por uma migration TypeORM `MigrationInterface` (tenants existentes). Espelha o padrão de `whatsapp-tables.sql.ts` + `1748100000000-AddWhatsappSchema.ts`.
- **Testes backend:** unit em `*.spec.ts` ao lado do código (Jest, padrão NestJS). Mock de `DataSource`/`QueryRunner` quando necessário.
- **Testes frontend:** vitest + `@testing-library/react`. Arquivos `*.test.tsx` ou `*.spec.tsx` ao lado dos componentes.
- **Commits:** um por task. Mensagem em pt-BR no formato `tipo(escopo): descrição`.

---

## File Structure

| Camada | Caminho | Ação |
|---|---|---|
| **Shared** | `packages/shared/src/types/recycling.ts` | Criar — `PriceTable`, `ProductPriceMap`, `Product` |
| **Shared** | `packages/shared/src/index.ts` | Modificar — re-exportar types/recycling |
| **Backend SQL** | `apps/backend/src/database/tenant-migrations/price-tables.sql.ts` | Criar — builder com 2 tabelas + seeds + backfill |
| **Backend SQL** | `apps/backend/src/database/tenant-migrations/create-tenant-tables.ts` | Modificar — chamar builder novo p/ recycling |
| **Backend migration** | `apps/backend/src/database/migrations/1748200000000-AddPriceTablesSchema.ts` | Criar — backfill em tenants existentes |
| **Backend price-tables** | `apps/backend/src/modules/recycling/price-tables/price-table.entity.ts` | Criar |
| **Backend price-tables** | `apps/backend/src/modules/recycling/price-tables/price-tables.service.ts` | Criar |
| **Backend price-tables** | `apps/backend/src/modules/recycling/price-tables/price-tables.service.spec.ts` | Criar — testes unit |
| **Backend price-tables** | `apps/backend/src/modules/recycling/price-tables/price-tables.controller.ts` | Criar |
| **Backend price-tables** | `apps/backend/src/modules/recycling/price-tables/price-tables.module.ts` | Criar |
| **Backend price-tables** | `apps/backend/src/modules/recycling/recycling.module.ts` | Modificar — importar `PriceTablesModule` |
| **Backend products** | `apps/backend/src/modules/recycling/products/product-price.entity.ts` | Criar |
| **Backend products** | `apps/backend/src/modules/recycling/products/products.service.ts` | Modificar — refatorar create/update/list |
| **Backend products** | `apps/backend/src/modules/recycling/products/products.service.spec.ts` | Criar — testes unit |
| **Backend products** | `apps/backend/src/modules/recycling/products/dto/create-product.dto.ts` | Modificar — campo `prices` |
| **Backend products** | `apps/backend/src/modules/recycling/products/dto/update-product.dto.ts` | Modificar — campo `prices` opcional |
| **Backend validators** | `apps/backend/src/common/validators/price-map.validator.ts` | Criar — decorator `@IsPriceMap` |
| **Frontend types** | (consumido de `@praktikus/shared`) | — |
| **Frontend services** | `apps/frontend/src/services/recycling/price-tables.service.ts` | Criar |
| **Frontend services** | `apps/frontend/src/services/recycling/products.service.ts` | Modificar — campo `prices` |
| **Frontend hooks** | `apps/frontend/src/hooks/recycling/usePriceTables.ts` | Criar |
| **Frontend utils** | `apps/frontend/src/utils/format.ts` | Criar (ou modificar) — `formatBRL` |
| **Frontend components** | `apps/frontend/src/components/recycling/PriceRow.tsx` | Criar |
| **Frontend components** | `apps/frontend/src/components/recycling/PriceRow.test.tsx` | Criar |
| **Frontend components** | `apps/frontend/src/components/recycling/ProductDialog.tsx` | Criar |
| **Frontend components** | `apps/frontend/src/components/recycling/ProductDialog.test.tsx` | Criar |
| **Frontend components** | `apps/frontend/src/components/recycling/PriceListPdf.tsx` | Modificar — props refatoradas |
| **Frontend hooks** | `apps/frontend/src/hooks/recycling/usePrintTableForm.ts` | Criar |
| **Frontend hooks** | `apps/frontend/src/hooks/recycling/usePrintTableForm.test.ts` | Criar |
| **Frontend components** | `apps/frontend/src/components/recycling/PrintTableDialog.tsx` | Criar |
| **Frontend schemas** | `apps/frontend/src/schemas/recycling/product.schema.ts` | Criar |
| **Frontend page** | `apps/frontend/src/pages/recycling/products/ProductsPage.tsx` | Modificar — integra novos componentes |
| **Frontend styles** | `apps/frontend/src/styles/product-dialog.css` | Criar — classe `pk-product-dialog` |

---

## Task 1: Tipos compartilhados em `@praktikus/shared`

Esta task adiciona os tipos consumidos por backend e frontend. Sem testes — é apenas declaração de tipos.

**Files:**
- Create: `packages/shared/src/types/recycling.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Criar arquivo de tipos**

`packages/shared/src/types/recycling.ts`:

```typescript
export interface PriceTable {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
  isDefault: boolean;
}

export type ProductPriceMap = Record<string, number | null>;

export interface RecyclingProduct {
  id: string;
  name: string;
  unitId: string;
  unit?: { id: string; name: string; abbreviation: string };
  pricePerUnit: number;
  prices: ProductPriceMap;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}
```

- [ ] **Step 2: Re-exportar do index**

Edit `packages/shared/src/index.ts` to add line:

```typescript
export * from './types/recycling';
```

- [ ] **Step 3: Build do shared**

Run: `pnpm --filter @praktikus/shared build`
Expected: build sem erros, gera `dist/` atualizado.

- [ ] **Step 4: Verificar imports**

Run: `pnpm --filter backend type-check && pnpm --filter frontend type-check`
Expected: ambos sem erros (não usam os novos types ainda, mas valida que o pacote compila).

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/types/recycling.ts packages/shared/src/index.ts
git commit -m "feat(shared): tipos PriceTable e ProductPriceMap p/ recicláveis"
```

---

## Task 2: Builder SQL `price-tables.sql.ts`

Cria o helper consumido tanto pelo provisioning de novos tenants quanto pela migration de tenants existentes. Sem testes — é SQL declarativo.

**Files:**
- Create: `apps/backend/src/database/tenant-migrations/price-tables.sql.ts`

- [ ] **Step 1: Criar o builder**

`apps/backend/src/database/tenant-migrations/price-tables.sql.ts`:

```typescript
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
```

- [ ] **Step 2: Type-check**

Run: `pnpm --filter backend type-check`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add apps/backend/src/database/tenant-migrations/price-tables.sql.ts
git commit -m "feat(db): SQL builder p/ price_tables + product_prices + seeds"
```

---

## Task 3: Integrar SQL builder em `create-tenant-tables.ts`

Faz com que **novos** tenants do segmento Recicláveis recebam as duas tabelas + seeds no momento do signup.

**Files:**
- Modify: `apps/backend/src/database/tenant-migrations/create-tenant-tables.ts`

- [ ] **Step 1: Ler arquivo atual e localizar onde recyclingTables é montado**

Run: `grep -n "recyclingTables\|TenantSegment.RECYCLING" apps/backend/src/database/tenant-migrations/create-tenant-tables.ts`
Inspecione visualmente para saber onde adicionar imports e chamada.

- [ ] **Step 2: Adicionar imports e chamada**

No topo do arquivo, **adicione** o import:

```typescript
import {
  buildPriceTablesSql,
  buildPriceTablesSeedSql,
} from './price-tables.sql';
```

Localize o array que retorna SQL pra recycling (procure a chamada de `recyclingTables` ou similar). **Concatene** as novas tabelas após `products` ser definida e os seeds depois das tabelas:

```typescript
// dentro de createTenantTablesSql, na branch de RECYCLING, após recyclingTables
const sqls = [
  ...recyclingTables,                          // já existente: units, products, etc.
  ...buildPriceTablesSql(schemaName),          // NOVO: price_tables + product_prices
  ...buildPriceTablesSeedSql(schemaName),      // NOVO: seed de 3 tabelas
];
return sqls;
```

A ordem importa: `price_tables` deve vir **depois** de `products` (FK do `product_prices` referencia `products`).

- [ ] **Step 3: Type-check + lint**

Run: `pnpm --filter backend type-check && pnpm --filter backend lint`
Expected: sem erros.

- [ ] **Step 4: Smoke manual (opcional, se houver banco local)**

Subir o banco e criar um tenant novo via fluxo de signup (ou via SQL direto):

```bash
docker compose up -d postgres
# (criar tenant via API ou inserir manualmente)
psql -h localhost -U praktikus -d praktikus -c '\dt tenant_<id>.price_tables'
psql -h localhost -U praktikus -d praktikus -c 'SELECT name, sort_order, is_default FROM tenant_<id>.price_tables ORDER BY sort_order'
```
Expected: 3 linhas com Tabela 1 — Padrão (default=true), Tabela 2, Tabela 3.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/database/tenant-migrations/create-tenant-tables.ts
git commit -m "feat(db): novo tenant recyclables ganha price_tables + seeds"
```

---

## Task 4: Migration TypeORM para tenants existentes

Cria a migration que loop em todos os tenants e aplica `buildPriceTablesSql`, `buildPriceTablesSeedSql` e o backfill.

**Files:**
- Create: `apps/backend/src/database/migrations/1748200000000-AddPriceTablesSchema.ts`

- [ ] **Step 1: Criar a migration**

`apps/backend/src/database/migrations/1748200000000-AddPriceTablesSchema.ts`:

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';
import {
  buildPriceTablesSql,
  buildPriceTablesSeedSql,
  buildProductPricesBackfillSql,
} from '../tenant-migrations/price-tables.sql';
import { TenantSegment } from '@praktikus/shared';

export class AddPriceTablesSchema1748200000000 implements MigrationInterface {
  name = 'AddPriceTablesSchema1748200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const tenants: Array<{ id: string; segment: TenantSegment }> =
      await queryRunner.query(
        `SELECT id, segment FROM "public"."tenants" WHERE segment = 'RECYCLING'`,
      );

    for (const tenant of tenants) {
      const schema = `tenant_${tenant.id.replace(/-/g, '')}`;
      // 1) Cria tabelas
      for (const sql of buildPriceTablesSql(schema)) {
        await queryRunner.query(sql);
      }
      // 2) Seedeia 3 tabelas (idempotente)
      for (const sql of buildPriceTablesSeedSql(schema)) {
        await queryRunner.query(sql);
      }
      // 3) Backfill: copia price_per_unit dos produtos pra Tabela 1
      await queryRunner.query(buildProductPricesBackfillSql(schema));
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const tenants: Array<{ id: string }> = await queryRunner.query(
      `SELECT id FROM "public"."tenants" WHERE segment = 'RECYCLING'`,
    );

    for (const tenant of tenants) {
      const schema = `tenant_${tenant.id.replace(/-/g, '')}`;
      await queryRunner.query(
        `DROP TABLE IF EXISTS "${schema}".product_prices CASCADE`,
      );
      await queryRunner.query(
        `DROP TABLE IF EXISTS "${schema}".price_tables CASCADE`,
      );
    }
  }
}
```

- [ ] **Step 2: Rodar migration localmente**

Run: `pnpm --filter backend migration:run`
Expected: log mencionando `AddPriceTablesSchema1748200000000` foi executada. Se não houver tenants RECYCLING, o loop não executa nada (sem erro).

- [ ] **Step 3: Validar via SQL (se houver tenant RECYCLING existente)**

```bash
psql -h localhost -U praktikus -d praktikus -c "SELECT id FROM public.tenants WHERE segment = 'RECYCLING'"
# Para o primeiro id, rodar:
psql -h localhost -U praktikus -d praktikus -c "SELECT count(*) FROM tenant_<id>.price_tables; SELECT count(*) FROM tenant_<id>.product_prices; SELECT count(*) FROM tenant_<id>.products WHERE price_per_unit IS NOT NULL"
```
Expected: `price_tables` = 3, `product_prices` = `products WHERE price_per_unit IS NOT NULL`.

- [ ] **Step 4: Testar reversão**

Run: `pnpm --filter backend migration:revert`
Expected: tabelas são dropadas. Confirme via SQL.

Re-rodar: `pnpm --filter backend migration:run` para deixar aplicada.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/database/migrations/1748200000000-AddPriceTablesSchema.ts
git commit -m "feat(db): migration de price_tables + backfill em tenants existentes"
```

---

## Task 5: Backend — entity `PriceTableEntity` + módulo read-only

Cria a entidade TypeORM, service, controller e módulo do `price-tables`. Endpoint público é `GET /recycling/price-tables`.

**Files:**
- Create: `apps/backend/src/modules/recycling/price-tables/price-table.entity.ts`
- Create: `apps/backend/src/modules/recycling/price-tables/price-tables.service.ts`
- Create: `apps/backend/src/modules/recycling/price-tables/price-tables.service.spec.ts`
- Create: `apps/backend/src/modules/recycling/price-tables/price-tables.controller.ts`
- Create: `apps/backend/src/modules/recycling/price-tables/price-tables.module.ts`
- Modify: `apps/backend/src/modules/recycling/recycling.module.ts`

- [ ] **Step 1: Criar a entity**

`apps/backend/src/modules/recycling/price-tables/price-table.entity.ts`:

```typescript
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'price_tables' })
export class PriceTableEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'varchar', nullable: true })
  description: string | null;

  @Column({ name: 'sort_order', type: 'integer' })
  sortOrder: number;

  @Column({ name: 'is_default', default: false })
  isDefault: boolean;

  @Column({ default: true })
  active: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
```

- [ ] **Step 2: Criar o service**

`apps/backend/src/modules/recycling/price-tables/price-tables.service.ts`:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { PriceTableEntity } from './price-table.entity';

@Injectable()
export class PriceTablesService {
  private readonly logger = new Logger(PriceTablesService.name);

  constructor(private readonly dataSource: DataSource) {}

  private getSchemaName(tenantId: string): string {
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        tenantId,
      )
    ) {
      throw new Error('Invalid tenantId');
    }
    return `tenant_${tenantId.replace(/-/g, '')}`;
  }

  private async withSchema<T>(
    tenantId: string,
    fn: (manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    const schemaName = this.getSchemaName(tenantId);
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    try {
      await qr.query(`SET search_path TO "${schemaName}", public`);
      return await fn(qr.manager);
    } finally {
      await qr.release();
    }
  }

  async list(tenantId: string): Promise<PriceTableEntity[]> {
    return this.withSchema(tenantId, (manager) =>
      manager
        .getRepository(PriceTableEntity)
        .createQueryBuilder('pt')
        .where('pt.active = :active', { active: true })
        .orderBy('pt.sortOrder', 'ASC')
        .getMany(),
    );
  }

  async getDefault(tenantId: string): Promise<PriceTableEntity> {
    return this.withSchema(tenantId, async (manager) => {
      const def = await manager.getRepository(PriceTableEntity).findOne({
        where: { isDefault: true, active: true },
      });
      if (!def) {
        throw new Error('Tabela padrão não encontrada para o tenant');
      }
      return def;
    });
  }
}
```

- [ ] **Step 3: Escrever os testes (failing)**

`apps/backend/src/modules/recycling/price-tables/price-tables.service.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { PriceTablesService } from './price-tables.service';

describe('PriceTablesService', () => {
  let service: PriceTablesService;
  let mockManager: { getRepository: jest.Mock };
  let mockQueryRunner: {
    connect: jest.Mock;
    query: jest.Mock;
    release: jest.Mock;
    manager: typeof mockManager;
  };

  beforeEach(async () => {
    mockManager = { getRepository: jest.fn() };
    mockQueryRunner = {
      connect: jest.fn().mockResolvedValue(undefined),
      query: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
      manager: mockManager,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PriceTablesService,
        {
          provide: DataSource,
          useValue: {
            createQueryRunner: () => mockQueryRunner,
          },
        },
      ],
    }).compile();

    service = module.get(PriceTablesService);
  });

  it('list() rejeita tenantId inválido', async () => {
    await expect(service.list('not-a-uuid')).rejects.toThrow('Invalid tenantId');
  });

  it('list() seta search_path e retorna tabelas ativas ordenadas', async () => {
    const tabelas = [
      { id: 't1', name: 'Tabela 1 — Padrão', sortOrder: 1, isDefault: true },
    ];
    const qb = {
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue(tabelas),
    };
    mockManager.getRepository.mockReturnValue({
      createQueryBuilder: () => qb,
    });

    const result = await service.list('11111111-1111-1111-1111-111111111111');

    expect(mockQueryRunner.query).toHaveBeenCalledWith(
      'SET search_path TO "tenant_11111111111111111111111111111111", public',
    );
    expect(qb.where).toHaveBeenCalledWith('pt.active = :active', {
      active: true,
    });
    expect(qb.orderBy).toHaveBeenCalledWith('pt.sortOrder', 'ASC');
    expect(result).toEqual(tabelas);
    expect(mockQueryRunner.release).toHaveBeenCalled();
  });

  it('getDefault() retorna a única tabela default ativa', async () => {
    const tabela = { id: 't1', isDefault: true, active: true };
    mockManager.getRepository.mockReturnValue({
      findOne: jest.fn().mockResolvedValue(tabela),
    });

    const result = await service.getDefault(
      '11111111-1111-1111-1111-111111111111',
    );
    expect(result).toBe(tabela);
  });

  it('getDefault() falha quando não há tabela default', async () => {
    mockManager.getRepository.mockReturnValue({
      findOne: jest.fn().mockResolvedValue(null),
    });
    await expect(
      service.getDefault('11111111-1111-1111-1111-111111111111'),
    ).rejects.toThrow('Tabela padrão não encontrada');
  });
});
```

- [ ] **Step 4: Rodar testes — esperar PASS (service já existe da Step 2)**

Run: `pnpm --filter backend test -- price-tables.service.spec`
Expected: 4 testes passando.

> Nota: a ordem aqui inverte o "fail-then-pass" porque o service e os testes vão no mesmo PR; o objetivo é garantir cobertura de comportamento, não literalmente o ciclo TDD.

- [ ] **Step 5: Criar controller**

`apps/backend/src/modules/recycling/price-tables/price-tables.controller.ts`:

```typescript
import { Controller, Get, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { AuthUser } from '../../core/auth/jwt.strategy';
import { PriceTablesService } from './price-tables.service';

interface RequestWithUser extends Request {
  user: AuthUser;
}

@Controller('recycling/price-tables')
@UseGuards(JwtAuthGuard)
export class PriceTablesController {
  constructor(private readonly priceTablesService: PriceTablesService) {}

  @Get()
  list(@Request() req: RequestWithUser) {
    return this.priceTablesService.list(req.user.tenantId);
  }
}
```

> Sem `EmployeePermissionsGuard` — listar tabelas de preço é leitura geral; qualquer usuário autenticado pode consultar (a página de Produtos exige isso pra renderizar).

- [ ] **Step 6: Criar módulo**

`apps/backend/src/modules/recycling/price-tables/price-tables.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { PriceTablesController } from './price-tables.controller';
import { PriceTablesService } from './price-tables.service';

@Module({
  controllers: [PriceTablesController],
  providers: [PriceTablesService],
  exports: [PriceTablesService],
})
export class PriceTablesModule {}
```

- [ ] **Step 7: Registrar no `recycling.module.ts`**

Edit `apps/backend/src/modules/recycling/recycling.module.ts` para adicionar `PriceTablesModule` em `imports`. Localize o arquivo via:

```bash
grep -n "imports" apps/backend/src/modules/recycling/recycling.module.ts
```

E adicione o import + entrada na lista (preserve módulos existentes).

- [ ] **Step 8: Build + testes completos**

Run: `pnpm --filter backend build && pnpm --filter backend test -- price-tables`
Expected: build OK, 4 testes passando.

- [ ] **Step 9: Commit**

```bash
git add apps/backend/src/modules/recycling/price-tables/ apps/backend/src/modules/recycling/recycling.module.ts
git commit -m "feat(api): GET /recycling/price-tables (read-only)"
```

---

## Task 6: Backend — entity `ProductPriceEntity` + validador `@IsPriceMap`

Cria a entidade de junção e o validador customizado para o DTO.

**Files:**
- Create: `apps/backend/src/modules/recycling/products/product-price.entity.ts`
- Create: `apps/backend/src/common/validators/price-map.validator.ts`

- [ ] **Step 1: Criar entity de junção**

`apps/backend/src/modules/recycling/products/product-price.entity.ts`:

```typescript
import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { ProductEntity } from './product.entity';
import { PriceTableEntity } from '../price-tables/price-table.entity';
import { numericTransformer } from '../common/numeric-transformer';

@Entity({ name: 'product_prices' })
export class ProductPriceEntity {
  @PrimaryColumn({ name: 'product_id', type: 'uuid' })
  productId: string;

  @PrimaryColumn({ name: 'price_table_id', type: 'uuid' })
  priceTableId: string;

  @Column({
    type: 'numeric',
    precision: 10,
    scale: 4,
    transformer: numericTransformer,
  })
  price: number;

  @ManyToOne(() => ProductEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product: ProductEntity;

  @ManyToOne(() => PriceTableEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'price_table_id' })
  priceTable: PriceTableEntity;
}
```

- [ ] **Step 2: Criar validador customizado de payload**

`apps/backend/src/common/validators/price-map.validator.ts`:

```typescript
import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Valida que o payload é um Record<UUID, number > 0 | null>.
 * NÃO valida regras de negócio (chave da tabela padrão presente,
 * IDs existem no banco) — isso fica no service.
 */
export function IsPriceMap(options?: ValidationOptions) {
  return function (target: object, propertyName: string) {
    registerDecorator({
      name: 'isPriceMap',
      target: target.constructor,
      propertyName,
      options: { message: 'Mapa de preços inválido', ...options },
      validator: {
        validate(value: unknown, _args: ValidationArguments) {
          if (typeof value !== 'object' || value === null || Array.isArray(value)) {
            return false;
          }
          for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
            if (!UUID_REGEX.test(k)) return false;
            if (v === null) continue;
            if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) {
              return false;
            }
          }
          return true;
        },
      },
    });
  };
}
```

- [ ] **Step 3: Type-check**

Run: `pnpm --filter backend type-check`
Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add apps/backend/src/modules/recycling/products/product-price.entity.ts apps/backend/src/common/validators/price-map.validator.ts
git commit -m "feat(api): entity ProductPrice + validator @IsPriceMap"
```

---

## Task 7: Backend — DTOs de produto com `prices`

Atualiza `CreateProductDto` e `UpdateProductDto`. `pricePerUnit` deixa de ser obrigatório no payload — vai ser computado pelo service a partir de `prices[default]`.

**Files:**
- Modify: `apps/backend/src/modules/recycling/products/dto/create-product.dto.ts`
- Modify: `apps/backend/src/modules/recycling/products/dto/update-product.dto.ts`

- [ ] **Step 1: Atualizar `CreateProductDto`**

`apps/backend/src/modules/recycling/products/dto/create-product.dto.ts`:

```typescript
import {
  IsBoolean,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { IsPriceMap } from '../../../../common/validators/price-map.validator';

export class CreateProductDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name: string;

  @IsUUID()
  unitId: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsObject()
  @IsPriceMap()
  prices: Record<string, number | null>;
}
```

- [ ] **Step 2: Atualizar `UpdateProductDto`**

`apps/backend/src/modules/recycling/products/dto/update-product.dto.ts`:

```typescript
import {
  IsBoolean,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { IsPriceMap } from '../../../../common/validators/price-map.validator';

export class UpdateProductDto {
  @IsOptional() @IsString() @MaxLength(120) name?: string;
  @IsOptional() @IsUUID() unitId?: string;
  @IsOptional() @IsBoolean() active?: boolean;

  @IsOptional()
  @IsObject()
  @IsPriceMap()
  prices?: Record<string, number | null>;
}
```

- [ ] **Step 3: Type-check**

Run: `pnpm --filter backend type-check`
Expected: erro nos arquivos `products.service.ts` (porque ainda lê `dto.pricePerUnit`). Isso é esperado — vamos refatorar na próxima task.

- [ ] **Step 4: Commit (mesmo com erro temporário no service)**

```bash
git add apps/backend/src/modules/recycling/products/dto/create-product.dto.ts apps/backend/src/modules/recycling/products/dto/update-product.dto.ts
git commit -m "feat(api): DTOs de produto recebem prices map"
```

> O build/teste do backend vai estar quebrado entre Task 7 e Task 8. Encadeie as duas no mesmo dia.

---

## Task 8: Backend — refatorar `ProductsService` para `prices` + sincronizar denorm

Mudança mais densa do backend. O service:
1. Carrega tabelas ativas no início.
2. Valida regras de negócio (tabela padrão obrigatória, IDs correspondem a tabelas ativas).
3. Faz upsert/delete em `product_prices` numa transação.
4. Atualiza `Product.pricePerUnit` com o preço da tabela padrão.
5. Retorna o produto enriquecido com o mapa `prices`.

**Files:**
- Modify: `apps/backend/src/modules/recycling/products/products.service.ts`
- Create: `apps/backend/src/modules/recycling/products/products.service.spec.ts`
- Modify: `apps/backend/src/modules/recycling/products/products.module.ts`

- [ ] **Step 1: Escrever testes (failing)**

`apps/backend/src/modules/recycling/products/products.service.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { BadRequestException } from '@nestjs/common';
import { ProductsService } from './products.service';

const TENANT = '11111111-1111-1111-1111-111111111111';
const T1 = '22222222-2222-2222-2222-222222222222';
const T2 = '33333333-3333-3333-3333-333333333333';
const T3 = '44444444-4444-4444-4444-444444444444';
const PRODUCT = '55555555-5555-5555-5555-555555555555';

describe('ProductsService.create', () => {
  let service: ProductsService;
  let priceTableRepo: { find: jest.Mock };
  let productRepo: { create: jest.Mock; save: jest.Mock };
  let productPriceRepo: { upsert: jest.Mock; delete: jest.Mock };
  let txManager: { getRepository: jest.Mock };
  let queryRunner: {
    connect: jest.Mock;
    startTransaction: jest.Mock;
    commitTransaction: jest.Mock;
    rollbackTransaction: jest.Mock;
    release: jest.Mock;
    query: jest.Mock;
    manager: typeof txManager;
  };

  beforeEach(async () => {
    priceTableRepo = {
      find: jest.fn().mockResolvedValue([
        { id: T1, isDefault: true, active: true, sortOrder: 1, name: 'Tabela 1 — Padrão' },
        { id: T2, isDefault: false, active: true, sortOrder: 2, name: 'Tabela 2' },
        { id: T3, isDefault: false, active: true, sortOrder: 3, name: 'Tabela 3' },
      ]),
    };
    productRepo = {
      create: jest.fn().mockImplementation((p) => ({ id: PRODUCT, ...p })),
      save: jest.fn().mockImplementation((p) => Promise.resolve(p)),
    };
    productPriceRepo = {
      upsert: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    txManager = {
      getRepository: jest.fn((entity) => {
        const name = (entity as { name: string }).name;
        if (name === 'PriceTableEntity') return priceTableRepo;
        if (name === 'ProductEntity') return productRepo;
        if (name === 'ProductPriceEntity') return productPriceRepo;
        throw new Error(`unexpected entity ${name}`);
      }),
    };
    queryRunner = {
      connect: jest.fn().mockResolvedValue(undefined),
      startTransaction: jest.fn().mockResolvedValue(undefined),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      rollbackTransaction: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
      query: jest.fn().mockResolvedValue(undefined),
      manager: txManager,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        {
          provide: DataSource,
          useValue: { createQueryRunner: () => queryRunner },
        },
      ],
    }).compile();
    service = module.get(ProductsService);
  });

  it('cria produto com 3 preços e sincroniza pricePerUnit com a Tabela 1', async () => {
    await service.create(TENANT, {
      name: 'Alumínio',
      unitId: 'unit-id-uuid-here-aaaaaaaaaaaa',
      prices: { [T1]: 8.0, [T2]: 8.5, [T3]: 9.0 },
    } as never);

    expect(productPriceRepo.upsert).toHaveBeenCalledTimes(3);
    expect(productRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ pricePerUnit: 8.0 }),
    );
    expect(queryRunner.commitTransaction).toHaveBeenCalled();
  });

  it('rejeita criação sem preço da tabela padrão', async () => {
    await expect(
      service.create(TENANT, {
        name: 'X',
        unitId: 'unit-id',
        prices: { [T2]: 5 },
      } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
  });

  it('rejeita IDs de tabela inexistentes', async () => {
    await expect(
      service.create(TENANT, {
        name: 'X',
        unitId: 'unit-id',
        prices: { [T1]: 5, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa': 1 },
      } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('null em t2 não cria entry pra t2', async () => {
    await service.create(TENANT, {
      name: 'X',
      unitId: 'unit-id',
      prices: { [T1]: 5, [T2]: null },
    } as never);

    const upsertCalls = productPriceRepo.upsert.mock.calls;
    const upsertedTableIds = upsertCalls.map(
      ([row]: [{ priceTableId: string }]) => row.priceTableId,
    );
    expect(upsertedTableIds).toEqual([T1]);
    expect(productPriceRepo.delete).not.toHaveBeenCalled();
  });
});

describe('ProductsService.update', () => {
  let service: ProductsService;
  let priceTableRepo: { find: jest.Mock };
  let productRepo: { findOne: jest.Mock; save: jest.Mock };
  let productPriceRepo: {
    upsert: jest.Mock;
    delete: jest.Mock;
    find: jest.Mock;
  };
  let txManager: { getRepository: jest.Mock };
  let queryRunner: {
    connect: jest.Mock;
    startTransaction: jest.Mock;
    commitTransaction: jest.Mock;
    rollbackTransaction: jest.Mock;
    release: jest.Mock;
    query: jest.Mock;
    manager: typeof txManager;
  };

  beforeEach(async () => {
    priceTableRepo = {
      find: jest.fn().mockResolvedValue([
        { id: T1, isDefault: true, active: true, sortOrder: 1 },
        { id: T2, isDefault: false, active: true, sortOrder: 2 },
        { id: T3, isDefault: false, active: true, sortOrder: 3 },
      ]),
    };
    productRepo = {
      findOne: jest.fn().mockResolvedValue({
        id: PRODUCT,
        name: 'Alumínio',
        unitId: 'u',
        pricePerUnit: 8,
        active: true,
      }),
      save: jest.fn().mockImplementation((p) => Promise.resolve(p)),
    };
    productPriceRepo = {
      upsert: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
      find: jest.fn().mockResolvedValue([]),
    };
    txManager = {
      getRepository: jest.fn((entity) => {
        const name = (entity as { name: string }).name;
        if (name === 'PriceTableEntity') return priceTableRepo;
        if (name === 'ProductEntity') return productRepo;
        if (name === 'ProductPriceEntity') return productPriceRepo;
        throw new Error(`unexpected entity ${name}`);
      }),
    };
    queryRunner = {
      connect: jest.fn().mockResolvedValue(undefined),
      startTransaction: jest.fn().mockResolvedValue(undefined),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      rollbackTransaction: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
      query: jest.fn().mockResolvedValue(undefined),
      manager: txManager,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        {
          provide: DataSource,
          useValue: { createQueryRunner: () => queryRunner },
        },
      ],
    }).compile();
    service = module.get(ProductsService);
  });

  it('PATCH com null em t2 deleta entry existente em t2', async () => {
    await service.update(TENANT, PRODUCT, {
      prices: { [T1]: 9, [T2]: null },
    } as never);

    const deleteCalls = productPriceRepo.delete.mock.calls;
    expect(deleteCalls).toContainEqual([
      { productId: PRODUCT, priceTableId: T2 },
    ]);

    const upsertCalls = productPriceRepo.upsert.mock.calls;
    const upsertedTableIds = upsertCalls.map(
      ([row]: [{ priceTableId: string }]) => row.priceTableId,
    );
    expect(upsertedTableIds).toContain(T1);

    expect(productRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ pricePerUnit: 9 }),
    );
    expect(queryRunner.commitTransaction).toHaveBeenCalled();
  });

  it('PATCH sem prices preserva entries existentes', async () => {
    await service.update(TENANT, PRODUCT, { name: 'Novo nome' } as never);

    expect(productPriceRepo.upsert).not.toHaveBeenCalled();
    expect(productPriceRepo.delete).not.toHaveBeenCalled();
    expect(productRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Novo nome', pricePerUnit: 8 }),
    );
  });

  it('PATCH com prices mas sem padrão presente é rejeitado', async () => {
    await expect(
      service.update(TENANT, PRODUCT, { prices: { [T2]: 5 } } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Rodar — todos os testes devem falhar**

Run: `pnpm --filter backend test -- products.service.spec`
Expected: erros porque `ProductsService.create` ainda só aceita `pricePerUnit`.

- [ ] **Step 3: Refatorar o service**

Substitua `apps/backend/src/modules/recycling/products/products.service.ts` por:

```typescript
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager, QueryRunner, In } from 'typeorm';
import { ProductEntity } from './product.entity';
import { ProductPriceEntity } from './product-price.entity';
import { PriceTableEntity } from '../price-tables/price-table.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

type ProductWithPrices = ProductEntity & {
  prices: Record<string, number | null>;
};

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(private readonly dataSource: DataSource) {}

  private getSchemaName(tenantId: string): string {
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        tenantId,
      )
    ) {
      throw new Error('Invalid tenantId');
    }
    return `tenant_${tenantId.replace(/-/g, '')}`;
  }

  private async withSchema<T>(
    tenantId: string,
    fn: (manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    const schemaName = this.getSchemaName(tenantId);
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    try {
      await qr.query(`SET search_path TO "${schemaName}", public`);
      return await fn(qr.manager);
    } finally {
      await qr.release();
    }
  }

  private async withTransaction<T>(
    tenantId: string,
    fn: (qr: QueryRunner) => Promise<T>,
  ): Promise<T> {
    const schemaName = this.getSchemaName(tenantId);
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.query(`SET search_path TO "${schemaName}", public`);
    await qr.startTransaction();
    try {
      const result = await fn(qr);
      await qr.commitTransaction();
      return result;
    } catch (err) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }
  }

  /**
   * Carrega tabelas ativas e valida o mapa de preços do payload.
   * Retorna a tabela padrão para uso a seguir.
   */
  private async validatePriceMap(
    manager: EntityManager,
    prices: Record<string, number | null>,
  ): Promise<{ defaultTable: PriceTableEntity; tables: PriceTableEntity[] }> {
    const tables = await manager
      .getRepository(PriceTableEntity)
      .find({ where: { active: true } });
    const tablesById = new Map(tables.map((t) => [t.id, t]));
    const defaultTable = tables.find((t) => t.isDefault);
    if (!defaultTable) {
      throw new Error('Tabela padrão não configurada');
    }

    // Toda chave deve corresponder a uma tabela ativa.
    for (const id of Object.keys(prices)) {
      if (!tablesById.has(id)) {
        throw new BadRequestException(
          `Tabela de preço ${id} não existe ou está inativa`,
        );
      }
    }
    // Tabela padrão obrigatória com valor > 0.
    const defValue = prices[defaultTable.id];
    if (typeof defValue !== 'number' || defValue <= 0) {
      throw new BadRequestException(
        `Preço da Tabela 1 (Padrão) é obrigatório e deve ser maior que zero`,
      );
    }
    return { defaultTable, tables };
  }

  private async loadPricesMap(
    manager: EntityManager,
    productIds: string[],
  ): Promise<Map<string, Record<string, number | null>>> {
    if (productIds.length === 0) return new Map();
    const tables = await manager
      .getRepository(PriceTableEntity)
      .find({ where: { active: true } });
    const tableIds = tables.map((t) => t.id);

    const entries = await manager.getRepository(ProductPriceEntity).find({
      where: { productId: In(productIds) },
    });

    const result = new Map<string, Record<string, number | null>>();
    for (const pid of productIds) {
      const map: Record<string, number | null> = {};
      for (const tid of tableIds) map[tid] = null;
      result.set(pid, map);
    }
    for (const e of entries) {
      const map = result.get(e.productId);
      if (map) map[e.priceTableId] = Number(e.price);
    }
    return result;
  }

  async list(
    tenantId: string,
    includeInactive = false,
  ): Promise<ProductWithPrices[]> {
    return this.withSchema(tenantId, async (manager) => {
      const repo = manager.getRepository(ProductEntity);
      const qb = repo
        .createQueryBuilder('product')
        .orderBy('product.name', 'ASC');
      if (!includeInactive) {
        qb.where('product.active = :active', { active: true });
      }
      const products = await qb.getMany();
      const pricesByProduct = await this.loadPricesMap(
        manager,
        products.map((p) => p.id),
      );
      return products.map((p) => ({
        ...p,
        prices: pricesByProduct.get(p.id) ?? {},
      }));
    });
  }

  async getById(tenantId: string, id: string): Promise<ProductWithPrices> {
    return this.withSchema(tenantId, async (manager) => {
      const product = await manager
        .getRepository(ProductEntity)
        .findOne({ where: { id } });
      if (!product) throw new NotFoundException('Produto não encontrado.');
      const pricesByProduct = await this.loadPricesMap(manager, [id]);
      return { ...product, prices: pricesByProduct.get(id) ?? {} };
    });
  }

  async create(
    tenantId: string,
    dto: CreateProductDto,
  ): Promise<ProductWithPrices> {
    return this.withTransaction(tenantId, async (qr) => {
      const { manager } = qr;
      const { defaultTable } = await this.validatePriceMap(manager, dto.prices);

      const product = manager.getRepository(ProductEntity).create({
        name: dto.name,
        unitId: dto.unitId,
        pricePerUnit: dto.prices[defaultTable.id] as number,
        active: dto.active ?? true,
      });
      const saved = await manager.getRepository(ProductEntity).save(product);

      for (const [tableId, price] of Object.entries(dto.prices)) {
        if (price === null) continue;
        await manager.getRepository(ProductPriceEntity).upsert(
          {
            productId: saved.id,
            priceTableId: tableId,
            price: price,
          },
          ['productId', 'priceTableId'],
        );
      }

      const pricesByProduct = await this.loadPricesMap(manager, [saved.id]);
      return { ...saved, prices: pricesByProduct.get(saved.id) ?? {} };
    });
  }

  async update(
    tenantId: string,
    id: string,
    dto: UpdateProductDto,
  ): Promise<ProductWithPrices> {
    return this.withTransaction(tenantId, async (qr) => {
      const { manager } = qr;
      const productRepo = manager.getRepository(ProductEntity);
      const product = await productRepo.findOne({ where: { id } });
      if (!product) throw new NotFoundException('Produto não encontrado.');

      // Aplica campos simples
      if (dto.name !== undefined) product.name = dto.name;
      if (dto.unitId !== undefined) product.unitId = dto.unitId;
      if (dto.active !== undefined) product.active = dto.active;

      if (dto.prices !== undefined) {
        const { defaultTable } = await this.validatePriceMap(
          manager,
          dto.prices,
        );

        for (const [tableId, price] of Object.entries(dto.prices)) {
          if (price === null) {
            await manager
              .getRepository(ProductPriceEntity)
              .delete({ productId: id, priceTableId: tableId });
          } else {
            await manager.getRepository(ProductPriceEntity).upsert(
              { productId: id, priceTableId: tableId, price: price },
              ['productId', 'priceTableId'],
            );
          }
        }
        product.pricePerUnit = dto.prices[defaultTable.id] as number;
      }

      const saved = await productRepo.save(product);
      const pricesByProduct = await this.loadPricesMap(manager, [id]);
      return { ...saved, prices: pricesByProduct.get(id) ?? {} };
    });
  }
}
```

- [ ] **Step 4: Registrar entidades no módulo (se usar `forFeature`)**

Edit `apps/backend/src/modules/recycling/products/products.module.ts` — não precisa adicionar `forFeature` aqui (o pattern do projeto não usa `TypeOrmModule.forFeature` no service, usa `dataSource.createQueryRunner` direto). Se houver outras dependências (ex: `EmployeesModule` já importado), preserve.

- [ ] **Step 5: Rodar testes — esperar PASS**

Run: `pnpm --filter backend test -- products.service.spec`
Expected: 7 testes passando (4 em `create`, 3 em `update`).

- [ ] **Step 6: Build completo**

Run: `pnpm --filter backend build`
Expected: sem erros TypeScript.

- [ ] **Step 7: Commit**

```bash
git add apps/backend/src/modules/recycling/products/products.service.ts apps/backend/src/modules/recycling/products/products.service.spec.ts
git commit -m "feat(api): produtos com prices map + denorm pricePerUnit"
```

---

## Task 9: Frontend — service `price-tables.service.ts` + tipo `Product` atualizado

**Files:**
- Create: `apps/frontend/src/services/recycling/price-tables.service.ts`
- Modify: `apps/frontend/src/services/recycling/products.service.ts`

- [ ] **Step 1: Criar service de price-tables**

`apps/frontend/src/services/recycling/price-tables.service.ts`:

```typescript
import type { PriceTable } from '@praktikus/shared';
import { api } from '../api';

export type { PriceTable };

export const priceTablesService = {
  async list(): Promise<PriceTable[]> {
    const { data } = await api.get<PriceTable[]>('/recycling/price-tables');
    return data;
  },
};
```

- [ ] **Step 2: Atualizar `products.service.ts`**

`apps/frontend/src/services/recycling/products.service.ts`:

```typescript
import type { ProductPriceMap } from '@praktikus/shared';
import { api } from '../api';

export interface Product {
  id: string;
  name: string;
  unitId: string;
  pricePerUnit: number;
  prices: ProductPriceMap;
  active: boolean;
}

export interface CreateProductPayload {
  name: string;
  unitId: string;
  active?: boolean;
  prices: ProductPriceMap;
}

export type UpdateProductPayload = Partial<CreateProductPayload>;

export const productsService = {
  async list(includeInactive = false): Promise<Product[]> {
    const { data } = await api.get<Product[]>('/recycling/products', {
      params: includeInactive ? { includeInactive: 'true' } : {},
    });
    return data;
  },
  async getById(id: string): Promise<Product> {
    const { data } = await api.get<Product>(`/recycling/products/${id}`);
    return data;
  },
  async create(payload: CreateProductPayload): Promise<Product> {
    const { data } = await api.post<Product>('/recycling/products', payload);
    return data;
  },
  async update(id: string, payload: UpdateProductPayload): Promise<Product> {
    const { data } = await api.patch<Product>(
      `/recycling/products/${id}`,
      payload,
    );
    return data;
  },
};
```

- [ ] **Step 3: Type-check**

Run: `pnpm --filter frontend type-check`
Expected: erros em `ProductsPage.tsx` e `PriceListPdf.tsx` (esperados — vamos resolver mais à frente). Outros arquivos sem erro.

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/services/recycling/price-tables.service.ts apps/frontend/src/services/recycling/products.service.ts
git commit -m "feat(frontend): services com prices map (recicláveis)"
```

---

## Task 10: Frontend — hook `usePriceTables`

**Files:**
- Create: `apps/frontend/src/hooks/recycling/usePriceTables.ts`

- [ ] **Step 1: Criar o hook**

`apps/frontend/src/hooks/recycling/usePriceTables.ts`:

```typescript
import { useEffect, useState, useCallback } from 'react';
import {
  priceTablesService,
  type PriceTable,
} from '../../services/recycling/price-tables.service';

let cache: PriceTable[] | null = null;

export function usePriceTables() {
  const [priceTables, setPriceTables] = useState<PriceTable[]>(cache ?? []);
  const [loading, setLoading] = useState(cache == null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await priceTablesService.list();
      cache = data;
      setPriceTables(data);
      setError(null);
    } catch (e) {
      setError('Erro ao carregar tabelas de preço');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (cache == null) void load();
  }, [load]);

  return { priceTables, loading, error, reload: load };
}
```

> Cache em variável de módulo é suficiente para o escopo A (catálogo fixo). Quando Configurações for adicionada (escopo B), substitua por invalidação explícita.

- [ ] **Step 2: Type-check**

Run: `pnpm --filter frontend type-check`
Expected: sem novos erros (os anteriores ainda existem).

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/hooks/recycling/usePriceTables.ts
git commit -m "feat(frontend): hook usePriceTables com cache de sessão"
```

---

## Task 11: Frontend — utilitário `formatBRL`

**Files:**
- Create or modify: `apps/frontend/src/utils/format.ts`

- [ ] **Step 1: Verificar se o arquivo existe**

Run: `ls apps/frontend/src/utils/format.ts 2>&1 || echo "not exists"`

Se existe, leia primeiro com Read e adicione a função preservando o restante. Se não existe, crie:

`apps/frontend/src/utils/format.ts`:

```typescript
export function formatBRL(value: number | null | undefined): string {
  if (value == null) return '—';
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
```

- [ ] **Step 2: Type-check**

Run: `pnpm --filter frontend type-check`
Expected: sem novos erros.

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/utils/format.ts
git commit -m "feat(frontend): util formatBRL"
```

---

## Task 12: Frontend — schema zod do produto

**Files:**
- Create: `apps/frontend/src/schemas/recycling/product.schema.ts`

- [ ] **Step 1: Criar o schema**

`apps/frontend/src/schemas/recycling/product.schema.ts`:

```typescript
import { z } from 'zod';
import type { PriceTable } from '@praktikus/shared';

const requiredPriceCell = z.preprocess(
  (v) => (v === '' || v === null || v === undefined ? NaN : Number(v)),
  z.number().positive('Preço obrigatório e maior que zero'),
);

const optionalPriceCell = z.preprocess(
  (v) => (v === '' || v === null || v === undefined ? null : Number(v)),
  z.number().positive('Use um valor maior que zero').nullable(),
);

export type ProductFormData = {
  name: string;
  unitId: string;
  active: boolean;
  prices: Record<string, number | string | null>;
};

export function buildProductSchema(priceTables: PriceTable[]) {
  const defaultTable = priceTables.find((t) => t.isDefault);
  if (!defaultTable) {
    throw new Error('Nenhuma tabela padrão configurada');
  }
  const pricesShape = Object.fromEntries(
    priceTables.map((t) => [
      t.id,
      t.id === defaultTable.id ? requiredPriceCell : optionalPriceCell,
    ]),
  );
  return z.object({
    name: z.string().min(1, 'Nome obrigatório').max(120),
    unitId: z.string().uuid('Selecione uma unidade'),
    active: z.boolean(),
    prices: z.object(pricesShape),
  });
}
```

- [ ] **Step 2: Type-check**

Run: `pnpm --filter frontend type-check`
Expected: sem novos erros.

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/schemas/recycling/product.schema.ts
git commit -m "feat(frontend): schema zod dinâmico p/ produto"
```

---

## Task 13: Frontend — componente `PriceRow` + testes

**Files:**
- Create: `apps/frontend/src/components/recycling/PriceRow.tsx`
- Create: `apps/frontend/src/components/recycling/PriceRow.test.tsx`

- [ ] **Step 1: Escrever testes (failing)**

`apps/frontend/src/components/recycling/PriceRow.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PriceRow } from './PriceRow';

describe('<PriceRow />', () => {
  const baseProps = {
    index: 1,
    name: 'Tabela 1 — Padrão',
    description: null as string | null,
    unitSymbol: 'kg',
    required: true,
    value: '',
    onChange: vi.fn(),
  };

  it('mostra asterisco quando required', () => {
    render(<PriceRow {...baseProps} />);
    expect(screen.getByText(/Tabela 1/i).textContent).toContain('*');
  });

  it('chama onChange quando o input muda', () => {
    const onChange = vi.fn();
    render(<PriceRow {...baseProps} onChange={onChange} />);
    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '8.5' } });
    expect(onChange).toHaveBeenCalledWith('8.5');
  });

  it('estado preenchido marca a linha como destacada (aria-selected ou class)', () => {
    const { container } = render(<PriceRow {...baseProps} value="8.5" />);
    const row = container.querySelector('[data-filled="true"]');
    expect(row).toBeInTheDocument();
  });

  it('estado vazio não marca destacada', () => {
    const { container } = render(<PriceRow {...baseProps} value="" />);
    const row = container.querySelector('[data-filled="false"]');
    expect(row).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Rodar — esperar FAIL**

Run: `pnpm --filter frontend test -- PriceRow`
Expected: módulo não encontrado.

- [ ] **Step 3: Implementar o componente**

`apps/frontend/src/components/recycling/PriceRow.tsx`:

```typescript
import { CFormInput } from '@coreui/react';

export interface PriceRowProps {
  index: number;
  name: string;
  description: string | null;
  unitSymbol: string;
  required: boolean;
  value: number | string | null | undefined;
  onChange: (value: string) => void;
  error?: string;
}

export function PriceRow({
  index,
  name,
  description,
  unitSymbol,
  required,
  value,
  onChange,
  error,
}: PriceRowProps) {
  const filled = value !== '' && value !== null && value !== undefined;
  return (
    <div
      data-filled={filled}
      style={{
        display: 'grid',
        gridTemplateColumns: '28px 1fr 160px',
        alignItems: 'center',
        gap: 12,
        padding: '10px 12px',
        border: `1px solid ${filled ? 'var(--cui-primary)' : 'var(--cui-border-color)'}`,
        borderRadius: 6,
        background: filled
          ? 'var(--cui-primary-bg-subtle, rgba(50,108,114,0.08))'
          : 'var(--cui-body-bg)',
        transition: 'border-color 150ms, background 150ms',
      }}
    >
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: 6,
          background: filled ? 'var(--cui-primary)' : 'var(--cui-tertiary-bg)',
          color: filled ? '#fff' : 'var(--cui-secondary-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 12,
          fontWeight: 600,
        }}
      >
        {index}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 540, lineHeight: 1.2 }}>
          {name}
          {required && (
            <span
              style={{ color: 'var(--cui-danger, #b34244)', marginLeft: 4 }}
            >
              *
            </span>
          )}
        </span>
        {description && (
          <span style={{ fontSize: 12, color: 'var(--cui-secondary-color)' }}>
            {description}
          </span>
        )}
      </div>

      <div style={{ position: 'relative' }}>
        <span
          style={{
            position: 'absolute',
            left: 10,
            top: '50%',
            transform: 'translateY(-50%)',
            fontSize: 12,
            color: 'var(--cui-secondary-color)',
            pointerEvents: 'none',
            fontWeight: 500,
          }}
        >
          R$
        </span>
        <CFormInput
          type="number"
          step="0.01"
          min="0"
          inputMode="decimal"
          placeholder="0,00"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          invalid={!!error}
          style={{
            paddingLeft: 36,
            paddingRight: 44,
            textAlign: 'right',
            fontFeatureSettings: "'tnum'",
            fontWeight: 540,
          }}
        />
        <span
          style={{
            position: 'absolute',
            right: 10,
            top: '50%',
            transform: 'translateY(-50%)',
            fontSize: 11,
            color: 'var(--cui-secondary-color)',
            pointerEvents: 'none',
          }}
        >
          /{unitSymbol}
        </span>
      </div>

      {error && (
        <span
          style={{
            gridColumn: '1 / -1',
            fontSize: 12,
            color: 'var(--cui-danger, #b34244)',
            marginTop: -4,
          }}
        >
          {error}
        </span>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Rodar — esperar PASS**

Run: `pnpm --filter frontend test -- PriceRow`
Expected: 4 testes passando.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/components/recycling/PriceRow.tsx apps/frontend/src/components/recycling/PriceRow.test.tsx
git commit -m "feat(frontend): componente PriceRow"
```

---

## Task 14: Frontend — `ProductDialog` + testes

**Files:**
- Create: `apps/frontend/src/components/recycling/ProductDialog.tsx`
- Create: `apps/frontend/src/components/recycling/ProductDialog.test.tsx`
- Create: `apps/frontend/src/styles/product-dialog.css`

- [ ] **Step 1: CSS responsivo**

`apps/frontend/src/styles/product-dialog.css`:

```css
.pk-product-dialog .pk-product-grid {
  display: grid;
  grid-template-columns: 1fr 1.4fr;
  gap: 24px;
}
@media (max-width: 720px) {
  .pk-product-dialog .pk-product-grid {
    grid-template-columns: 1fr;
  }
}
```

Importe no entrypoint que carrega CSS — geralmente `apps/frontend/src/main.tsx` ou `apps/frontend/src/App.tsx`. Localize com:

```bash
grep -rn "import.*\.css" apps/frontend/src/main.tsx apps/frontend/src/App.tsx 2>&1 | head
```

E adicione `import './styles/product-dialog.css'` no mesmo lugar onde outros estilos globais são importados.

- [ ] **Step 2: Escrever testes (failing)**

`apps/frontend/src/components/recycling/ProductDialog.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProductDialog } from './ProductDialog';
import type { PriceTable } from '@praktikus/shared';

const tables: PriceTable[] = [
  { id: 't1', name: 'Tabela 1 — Padrão', description: null, sortOrder: 1, isDefault: true },
  { id: 't2', name: 'Tabela 2', description: null, sortOrder: 2, isDefault: false },
  { id: 't3', name: 'Tabela 3', description: null, sortOrder: 3, isDefault: false },
];

const units = [{ id: 'unit-uuid-aaaa-aaaa-aaaa-aaaaaaaaaaaa', name: 'Quilograma', abbreviation: 'kg' }];

const baseProps = {
  open: true,
  onClose: vi.fn(),
  onSave: vi.fn(),
  priceTables: tables,
  units,
  product: null,
};

describe('<ProductDialog />', () => {
  it('botão Salvar fica disabled enquanto Tabela 1 está vazia', async () => {
    render(<ProductDialog {...baseProps} />);
    const save = screen.getByRole('button', { name: /Salvar/i });
    expect(save).toBeDisabled();
  });

  it('Replicar Tabela 1 copia o valor para t2 e t3', async () => {
    const user = userEvent.setup();
    render(<ProductDialog {...baseProps} />);
    const inputs = screen.getAllByRole('spinbutton');
    await user.clear(inputs[0]);
    await user.type(inputs[0], '8.5');

    const replicar = screen.getByRole('button', { name: /Replicar Tabela 1/i });
    expect(replicar).not.toBeDisabled();
    await user.click(replicar);

    await waitFor(() => {
      expect((inputs[1] as HTMLInputElement).value).toBe('8.5');
      expect((inputs[2] as HTMLInputElement).value).toBe('8.5');
    });
  });

  it('Replicar fica disabled quando Tabela 1 está vazia', () => {
    render(<ProductDialog {...baseProps} />);
    const replicar = screen.getByRole('button', { name: /Replicar Tabela 1/i });
    expect(replicar).toBeDisabled();
  });

  it('submit transforma string vazia em null nos preços', async () => {
    const onSave = vi.fn();
    const user = userEvent.setup();
    render(<ProductDialog {...baseProps} onSave={onSave} />);

    await user.type(screen.getByLabelText(/Nome/i), 'Alumínio');
    const inputs = screen.getAllByRole('spinbutton');
    await user.type(inputs[0], '8'); // só padrão

    await user.click(screen.getByRole('button', { name: /Salvar/i }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Alumínio',
          prices: expect.objectContaining({
            t1: 8,
            t2: null,
            t3: null,
          }),
        }),
      );
    });
  });
});
```

- [ ] **Step 3: Rodar — esperar FAIL**

Run: `pnpm --filter frontend test -- ProductDialog`
Expected: módulo não encontrado.

- [ ] **Step 4: Implementar `ProductDialog.tsx`**

`apps/frontend/src/components/recycling/ProductDialog.tsx`:

```typescript
import { useEffect, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  CModal,
  CModalHeader,
  CModalTitle,
  CModalBody,
  CModalFooter,
  CButton,
  CFormInput,
  CFormSelect,
  CFormSwitch,
  CFormLabel,
} from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilCheck, cilLayers } from '@coreui/icons';
import type { PriceTable } from '@praktikus/shared';
import type { Unit } from '../../services/recycling/units.service';
import type { Product } from '../../services/recycling/products.service';
import { buildProductSchema } from '../../schemas/recycling/product.schema';
import { PriceRow } from './PriceRow';

export interface ProductDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: {
    name: string;
    unitId: string;
    active: boolean;
    prices: Record<string, number | null>;
  }) => Promise<void> | void;
  priceTables: PriceTable[];
  units: Unit[];
  product: Product | null;
}

export function ProductDialog({
  open,
  onClose,
  onSave,
  priceTables,
  units,
  product,
}: ProductDialogProps) {
  const sorted = useMemo(
    () => [...priceTables].sort((a, b) => a.sortOrder - b.sortOrder),
    [priceTables],
  );
  const defaultTable = sorted.find((t) => t.isDefault);
  const schema = useMemo(() => buildProductSchema(sorted), [sorted]);

  const initialPrices = useMemo(() => {
    const obj: Record<string, string> = {};
    for (const t of sorted) {
      const v = product?.prices?.[t.id];
      obj[t.id] = v == null ? '' : String(v);
    }
    return obj;
  }, [sorted, product]);

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { isValid, isSubmitting, errors },
  } = useForm({
    resolver: zodResolver(schema),
    mode: 'onChange',
    defaultValues: {
      name: product?.name ?? '',
      unitId: product?.unitId ?? '',
      active: product?.active ?? true,
      prices: initialPrices,
    },
  });

  // se o produto/tabelas mudarem, reseta com novos valores
  // (escopo A não tem mudança de tabelas durante a edição, mas mantém safety)
  useEffect(() => {
    if (open) {
      // noop — defaultValues já é recalculado na próxima abertura via key
    }
  }, [open]);

  const defaultValue = defaultTable
    ? watch(`prices.${defaultTable.id}` as const)
    : '';
  const canReplicate = !!defaultValue;

  const replicate = () => {
    if (!defaultTable || !canReplicate) return;
    for (const t of sorted) {
      if (t.id === defaultTable.id) continue;
      setValue(`prices.${t.id}` as const, defaultValue, {
        shouldValidate: true,
        shouldDirty: true,
      });
    }
  };

  const onSubmit = handleSubmit(async (data) => {
    const prices: Record<string, number | null> = {};
    for (const [k, v] of Object.entries(data.prices)) {
      prices[k] = v == null || v === '' ? null : Number(v);
    }
    await onSave({
      name: data.name,
      unitId: data.unitId,
      active: data.active,
      prices,
    });
  });

  const isNew = product == null;
  const unit = units.find((u) => u.id === watch('unitId'));
  const unitSymbol = unit?.abbreviation ?? 'un';

  return (
    <CModal
      visible={open}
      onClose={onClose}
      size="xl"
      className="pk-product-dialog"
    >
      <CModalHeader>
        <CModalTitle>{isNew ? 'Novo produto' : 'Editar produto'}</CModalTitle>
      </CModalHeader>
      <CModalBody>
        <form onSubmit={onSubmit} id="product-form">
          <div className="pk-product-grid">
            {/* Coluna esquerda */}
            <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <SectionLabel icon={cilLayers}>Informações do material</SectionLabel>

              <div>
                <CFormLabel htmlFor="product-name">Nome *</CFormLabel>
                <Controller
                  control={control}
                  name="name"
                  render={({ field }) => (
                    <CFormInput
                      id="product-name"
                      placeholder="Ex.: Alumínio latinha"
                      {...field}
                      invalid={!!errors.name}
                    />
                  )}
                />
                {errors.name && (
                  <small style={{ color: 'var(--cui-danger)' }}>
                    {errors.name.message as string}
                  </small>
                )}
              </div>

              <div>
                <CFormLabel htmlFor="product-unit">Unidade de medida *</CFormLabel>
                <Controller
                  control={control}
                  name="unitId"
                  render={({ field }) => (
                    <CFormSelect id="product-unit" {...field} invalid={!!errors.unitId}>
                      <option value="">Selecione...</option>
                      {units.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name} ({u.abbreviation})
                        </option>
                      ))}
                    </CFormSelect>
                  )}
                />
              </div>

              <div>
                <CFormLabel>Status</CFormLabel>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '10px 12px',
                    border: '1px solid var(--cui-border-color)',
                    borderRadius: 6,
                    background: 'var(--cui-tertiary-bg)',
                  }}
                >
                  <Controller
                    control={control}
                    name="active"
                    render={({ field }) => (
                      <CFormSwitch
                        checked={field.value}
                        onChange={(e) => field.onChange(e.target.checked)}
                      />
                    )}
                  />
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: 13, fontWeight: 540 }}>
                      {watch('active') ? 'Ativo' : 'Inativo'}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--cui-secondary-color)' }}>
                      {watch('active')
                        ? 'Disponível para compra e venda.'
                        : 'Oculto nas operações de caixa.'}
                    </span>
                  </div>
                </div>
              </div>
            </section>

            {/* Coluna direita */}
            <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                }}
              >
                <SectionLabel>Preços por tabela</SectionLabel>
                <CButton
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={!canReplicate}
                  onClick={replicate}
                  aria-label="Replica o valor da Tabela 1 nas demais tabelas"
                >
                  Replicar Tabela 1
                </CButton>
              </div>

              <p style={{ margin: 0, fontSize: 12, color: 'var(--cui-secondary-color)' }}>
                Defina o preço deste material em cada tabela. A Tabela 1 (Padrão) é
                obrigatória; as demais são opcionais.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                {sorted.map((t, idx) => (
                  <Controller
                    key={t.id}
                    control={control}
                    name={`prices.${t.id}` as const}
                    render={({ field }) => (
                      <PriceRow
                        index={idx + 1}
                        name={t.name}
                        description={t.description}
                        unitSymbol={unitSymbol}
                        required={t.isDefault}
                        value={field.value as string | null}
                        onChange={field.onChange}
                        error={
                          (errors.prices as Record<string, { message?: string }> | undefined)?.[t.id]
                            ?.message as string | undefined
                        }
                      />
                    )}
                  />
                ))}
              </div>

              <div
                style={{
                  marginTop: 4,
                  padding: '10px 12px',
                  background:
                    'var(--cui-primary-bg-subtle, rgba(50,108,114,0.08))',
                  borderRadius: 6,
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 8,
                  fontSize: 12,
                }}
              >
                <CIcon icon={cilCheck} size="sm" style={{ marginTop: 2, flexShrink: 0 }} />
                <span>
                  As tabelas são gerenciadas em{' '}
                  <strong>Configurações → Tabelas de preço</strong>. Tabelas em
                  branco aparecerão como "—" na listagem.
                </span>
              </div>
            </section>
          </div>
        </form>
      </CModalBody>
      <CModalFooter>
        <CButton variant="ghost" onClick={onClose}>
          Cancelar
        </CButton>
        <CButton
          type="submit"
          form="product-form"
          color="primary"
          disabled={!isValid || isSubmitting}
        >
          <CIcon icon={cilCheck} size="sm" style={{ marginRight: 6 }} />
          {isNew ? 'Salvar produto' : 'Salvar alterações'}
        </CButton>
      </CModalFooter>
    </CModal>
  );
}

function SectionLabel({
  icon,
  children,
}: {
  icon?: string[] | undefined;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 12,
        fontWeight: 600,
        color: 'var(--cui-secondary-color)',
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
      }}
    >
      {icon && <CIcon icon={icon} size="sm" />}
      {children}
    </div>
  );
}
```

- [ ] **Step 5: Rodar — esperar PASS**

Run: `pnpm --filter frontend test -- ProductDialog`
Expected: 4 testes passando. Se algum não passar (especialmente o de "Replicar"), inspecione e ajuste — pode precisar de `act()` ao redor de `setValue`.

- [ ] **Step 6: Commit**

```bash
git add apps/frontend/src/components/recycling/ProductDialog.tsx apps/frontend/src/components/recycling/ProductDialog.test.tsx apps/frontend/src/styles/product-dialog.css
# também o arquivo onde você adicionou o import do CSS (main.tsx ou App.tsx)
git commit -m "feat(frontend): ProductDialog 2 colunas com PriceRow e replicação"
```

---

## Task 15: Frontend — refatorar `PriceListPdf` para receber tabela escolhida

A assinatura atual do `PriceListPdf` (`{ rows, empresa, printedAt }`) precisa de:
- Adicionar `table: { name: string }` para mostrar qual tabela está sendo impressa.
- Adicionar `layout: 'full' | 'compact'`.

**Files:**
- Modify: `apps/frontend/src/components/recycling/PriceListPdf.tsx`

- [ ] **Step 1: Ler arquivo atual**

```bash
cat apps/frontend/src/components/recycling/PriceListPdf.tsx
```

- [ ] **Step 2: Adicionar props e renderizações condicionais**

Modifique o tipo `PriceListPdfProps`:

```typescript
export interface PriceListPdfProps {
  rows: PriceListPdfRow[];
  empresa: { nomeFantasia: string; cnpj: string };
  printedAt: Date;
  table: { name: string };          // NOVO
  layout: 'full' | 'compact';       // NOVO
}
```

No header do `<Page>`, adicione abaixo do nome da empresa:

```tsx
<Text style={s.tableName}>{table.name}</Text>
```

Defina `s.tableName` no `StyleSheet`:

```typescript
tableName: { fontSize: 11, color: '#6b7280', marginTop: 2 },
```

No corpo da tabela, **só renderiza coluna `Un.` quando `layout === 'full'`**:

```tsx
<View style={s.tableHeader}>
  <Text style={s.colProduto}>Produto</Text>
  {layout === 'full' && <Text style={s.colUnidade}>Un.</Text>}
  <Text style={s.colPreco}>
    Preço{layout === 'full' ? ' por unidade' : ''}
  </Text>
</View>
{rows.map((r, i) => (
  <View key={i} style={s.row}>
    <Text style={s.colProduto}>{r.name}</Text>
    {layout === 'full' && <Text style={s.colUnidade}>{r.unitSymbol}</Text>}
    <Text style={s.colPreco}>{fmtMoney(r.pricePerUnit)}</Text>
  </View>
))}
```

> Adapte os estilos `colProduto`, `colUnidade`, `colPreco` se já existirem; senão crie. A largura das colunas em "compact" pode redistribuir 100% entre Produto e Preço (ex.: 70/30).

- [ ] **Step 3: Type-check**

Run: `pnpm --filter frontend type-check`
Expected: erros nos pontos onde `PriceListPdf` é usado (no `ProductsPage.tsx`). Esperado — vamos resolver na Task 18.

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/components/recycling/PriceListPdf.tsx
git commit -m "feat(frontend): PriceListPdf recebe table e layout"
```

---

## Task 16: Frontend — hook `usePrintTableForm` + testes

**Files:**
- Create: `apps/frontend/src/hooks/recycling/usePrintTableForm.ts`
- Create: `apps/frontend/src/hooks/recycling/usePrintTableForm.test.ts`

- [ ] **Step 1: Escrever testes (failing)**

`apps/frontend/src/hooks/recycling/usePrintTableForm.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { PriceTable } from '@praktikus/shared';
import type { Product } from '../../services/recycling/products.service';
import { usePrintTableForm } from './usePrintTableForm';

const tables: PriceTable[] = [
  { id: 't1', name: 'Tabela 1 — Padrão', description: null, sortOrder: 1, isDefault: true },
  { id: 't2', name: 'Tabela 2', description: null, sortOrder: 2, isDefault: false },
];

const products: Product[] = [
  {
    id: 'p1', name: 'Alumínio', unitId: 'u', pricePerUnit: 8,
    prices: { t1: 8, t2: 9 }, active: true,
  },
  {
    id: 'p2', name: 'Cobre', unitId: 'u', pricePerUnit: 26,
    prices: { t1: 26, t2: null }, active: true,
  },
  {
    id: 'p3', name: 'Vidro', unitId: 'u', pricePerUnit: 0.25,
    prices: { t1: 0.25, t2: 0.30 }, active: false,
  },
];

describe('usePrintTableForm', () => {
  it('default seleciona a tabela padrão', () => {
    const { result } = renderHook(() => usePrintTableForm(tables, products));
    expect(result.current.tableId).toBe('t1');
    expect(result.current.layout).toBe('full');
    expect(result.current.includeInactive).toBe(false);
  });

  it('filtra inativos por padrão', () => {
    const { result } = renderHook(() => usePrintTableForm(tables, products));
    expect(result.current.filteredProducts.map((p) => p.id)).toEqual(['p1', 'p2']);
  });

  it('inclui inativos quando includeInactive=true', () => {
    const { result } = renderHook(() => usePrintTableForm(tables, products));
    act(() => result.current.setIncludeInactive(true));
    expect(result.current.filteredProducts.map((p) => p.id)).toEqual(['p1', 'p2', 'p3']);
  });

  it('omite produtos sem preço na tabela escolhida', () => {
    const { result } = renderHook(() => usePrintTableForm(tables, products));
    act(() => result.current.setTableId('t2'));
    expect(result.current.filteredProducts.map((p) => p.id)).toEqual(['p1']);
  });

  it('canDownload é false quando lista filtrada está vazia', () => {
    const { result } = renderHook(() =>
      usePrintTableForm(tables, [{ ...products[0], prices: { t1: null, t2: null } }]),
    );
    expect(result.current.canDownload).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar — esperar FAIL**

Run: `pnpm --filter frontend test -- usePrintTableForm`
Expected: módulo não encontrado.

- [ ] **Step 3: Implementar o hook**

`apps/frontend/src/hooks/recycling/usePrintTableForm.ts`:

```typescript
import { useMemo, useState } from 'react';
import type { PriceTable } from '@praktikus/shared';
import type { Product } from '../../services/recycling/products.service';

export type PrintLayout = 'full' | 'compact';

export function usePrintTableForm(
  priceTables: PriceTable[],
  products: Product[],
) {
  const defaultTable = priceTables.find((t) => t.isDefault) ?? priceTables[0];
  const [tableId, setTableId] = useState<string>(defaultTable?.id ?? '');
  const [layout, setLayout] = useState<PrintLayout>('full');
  const [includeInactive, setIncludeInactive] = useState(false);

  const selectedTable = useMemo(
    () => priceTables.find((t) => t.id === tableId) ?? defaultTable,
    [priceTables, tableId, defaultTable],
  );

  const filteredProducts = useMemo(() => {
    return products
      .filter((p) => (includeInactive ? true : p.active))
      .filter((p) => p.prices[tableId] != null)
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [products, tableId, includeInactive]);

  const canDownload = filteredProducts.length > 0;

  return {
    tableId,
    setTableId,
    layout,
    setLayout,
    includeInactive,
    setIncludeInactive,
    selectedTable,
    filteredProducts,
    canDownload,
  };
}
```

- [ ] **Step 4: Rodar — esperar PASS**

Run: `pnpm --filter frontend test -- usePrintTableForm`
Expected: 5 testes passando.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/hooks/recycling/usePrintTableForm.ts apps/frontend/src/hooks/recycling/usePrintTableForm.test.ts
git commit -m "feat(frontend): hook usePrintTableForm com filtros e layout"
```

---

## Task 17: Frontend — `PrintTableDialog`

**Files:**
- Create: `apps/frontend/src/components/recycling/PrintTableDialog.tsx`

- [ ] **Step 1: Implementar o componente**

`apps/frontend/src/components/recycling/PrintTableDialog.tsx`:

```typescript
import {
  CModal,
  CModalHeader,
  CModalTitle,
  CModalBody,
  CModalFooter,
  CButton,
  CFormSwitch,
} from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilCloudDownload, cilSettings, cilFile } from '@coreui/icons';
import type { PriceTable } from '@praktikus/shared';
import type { Product } from '../../services/recycling/products.service';
import { usePrintTableForm } from '../../hooks/recycling/usePrintTableForm';
import { downloadPdf } from '../../utils/downloadPdf';
import { PriceListPdf } from './PriceListPdf';
import { formatBRL } from '../../utils/format';

const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

export interface PrintTableDialogProps {
  open: boolean;
  onClose: () => void;
  priceTables: PriceTable[];
  products: Product[];
  units: Array<{ id: string; abbreviation: string }>;
  empresa: { nomeFantasia: string; cnpj: string };
}

export function PrintTableDialog({
  open,
  onClose,
  priceTables,
  products,
  units,
  empresa,
}: PrintTableDialogProps) {
  const {
    tableId,
    setTableId,
    layout,
    setLayout,
    includeInactive,
    setIncludeInactive,
    selectedTable,
    filteredProducts,
    canDownload,
  } = usePrintTableForm(priceTables, products);

  const sortedTables = [...priceTables].sort((a, b) => a.sortOrder - b.sortOrder);
  const visiblePreview = filteredProducts.slice(0, 8);
  const overflow = filteredProducts.length - visiblePreview.length;

  const handleDownload = async () => {
    if (!selectedTable) return;
    const rows = filteredProducts.map((p) => {
      const unit = units.find((u) => u.id === p.unitId);
      return {
        name: p.name,
        unitSymbol: unit?.abbreviation ?? '',
        pricePerUnit: p.prices[selectedTable.id] ?? 0,
      };
    });
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10);
    await downloadPdf(
      <PriceListPdf
        rows={rows}
        empresa={empresa}
        printedAt={date}
        table={{ name: selectedTable.name }}
        layout={layout}
      />,
      `tabela-precos-${slug(selectedTable.name)}-${dateStr}.pdf`,
    );
  };

  return (
    <CModal visible={open} onClose={onClose} size="lg">
      <CModalHeader>
        <CModalTitle>Imprimir tabela de preços</CModalTitle>
      </CModalHeader>
      <CModalBody>
        <p style={{ fontSize: 13, color: 'var(--cui-secondary-color)' }}>
          Escolha qual tabela será impressa e ajuste o que aparece no documento.
        </p>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 20,
            marginTop: 12,
          }}
        >
          {/* Configurações */}
          <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <SectionLabel icon={cilSettings}>Configurações</SectionLabel>

            <div>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: 'var(--cui-secondary-color)',
                  marginBottom: 6,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                Tabela de preço *
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {sortedTables.map((t) => (
                  <label
                    key={t.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '10px 12px',
                      cursor: 'pointer',
                      border: `1px solid ${
                        tableId === t.id
                          ? 'var(--cui-primary)'
                          : 'var(--cui-border-color)'
                      }`,
                      borderRadius: 6,
                      background:
                        tableId === t.id
                          ? 'var(--cui-primary-bg-subtle, rgba(50,108,114,0.08))'
                          : 'var(--cui-body-bg)',
                    }}
                  >
                    <input
                      type="radio"
                      name="ptable"
                      checked={tableId === t.id}
                      onChange={() => setTableId(t.id)}
                    />
                    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                      <span style={{ fontSize: 13, fontWeight: 540 }}>{t.name}</span>
                      {t.description && (
                        <span style={{ fontSize: 12, color: 'var(--cui-secondary-color)' }}>
                          {t.description}
                        </span>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: 'var(--cui-secondary-color)',
                  marginBottom: 6,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                Layout
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <CButton
                  variant={layout === 'full' ? undefined : 'outline'}
                  color="primary"
                  size="sm"
                  onClick={() => setLayout('full')}
                >
                  Completo
                </CButton>
                <CButton
                  variant={layout === 'compact' ? undefined : 'outline'}
                  color="primary"
                  size="sm"
                  onClick={() => setLayout('compact')}
                >
                  Compacto
                </CButton>
              </div>
            </div>

            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 12px',
                border: '1px solid var(--cui-border-color)',
                borderRadius: 6,
                background: 'var(--cui-tertiary-bg)',
                cursor: 'pointer',
              }}
            >
              <CFormSwitch
                checked={includeInactive}
                onChange={(e) => setIncludeInactive(e.target.checked)}
              />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: 13, fontWeight: 540 }}>
                  Incluir produtos inativos
                </span>
                <span style={{ fontSize: 12, color: 'var(--cui-secondary-color)' }}>
                  Por padrão, apenas ativos.
                </span>
              </div>
            </label>
          </section>

          {/* Pré-visualização */}
          <section style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
            <SectionLabel icon={cilFile}>Pré-visualização</SectionLabel>
            <div
              style={{
                background: '#fff',
                color: '#0F1414',
                border: '1px solid var(--cui-border-color)',
                borderRadius: 6,
                padding: 16,
                fontSize: 11,
                minHeight: 320,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: 8,
                  paddingBottom: 10,
                  borderBottom: '1px solid #e5e7eb',
                }}
              >
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{empresa.nomeFantasia}</div>
                  <div style={{ fontSize: 10, color: '#6b7280' }}>
                    {selectedTable?.name}
                  </div>
                </div>
                <div style={{ fontSize: 10, color: '#6b7280', textAlign: 'right' }}>
                  Emitida em
                  <br />
                  {new Date().toLocaleString('pt-BR', {
                    dateStyle: 'short',
                    timeStyle: 'short',
                  })}
                </div>
              </div>

              {filteredProducts.length === 0 ? (
                <div
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#9ca3af',
                    fontSize: 12,
                    padding: '20px 4px',
                    textAlign: 'center',
                  }}
                >
                  Nenhum produto com preço nesta tabela. Cadastre preços em{' '}
                  {selectedTable?.name} primeiro.
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                      <th style={{ textAlign: 'left', padding: '6px 4px' }}>Produto</th>
                      {layout === 'full' && (
                        <th style={{ textAlign: 'left', padding: '6px 4px' }}>Un.</th>
                      )}
                      <th style={{ textAlign: 'right', padding: '6px 4px' }}>
                        Preço{layout === 'full' ? ' por unidade' : ''}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {visiblePreview.map((p) => {
                      const u = units.find((x) => x.id === p.unitId);
                      return (
                        <tr key={p.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                          <td style={{ padding: '6px 4px' }}>{p.name}</td>
                          {layout === 'full' && (
                            <td style={{ padding: '6px 4px', color: '#6b7280' }}>
                              {u?.abbreviation ?? ''}
                            </td>
                          )}
                          <td
                            style={{
                              padding: '6px 4px',
                              textAlign: 'right',
                              fontFeatureSettings: "'tnum'",
                              fontWeight: 600,
                            }}
                          >
                            {formatBRL(p.prices[selectedTable?.id ?? ''])}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}

              {overflow > 0 && (
                <div style={{ fontSize: 10, color: '#9ca3af', textAlign: 'center' }}>
                  + {overflow} outros produtos
                </div>
              )}
            </div>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--cui-secondary-color)' }}>
              {filteredProducts.length} produto(s) com preço definido nesta tabela.
            </p>
          </section>
        </div>
      </CModalBody>
      <CModalFooter>
        <CButton variant="ghost" onClick={onClose}>
          Cancelar
        </CButton>
        <CButton color="primary" onClick={handleDownload} disabled={!canDownload}>
          <CIcon icon={cilCloudDownload} size="sm" style={{ marginRight: 6 }} />
          Baixar PDF
        </CButton>
      </CModalFooter>
    </CModal>
  );
}

function SectionLabel({
  icon,
  children,
}: {
  icon?: string[];
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 12,
        fontWeight: 600,
        color: 'var(--cui-secondary-color)',
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
      }}
    >
      {icon && <CIcon icon={icon} size="sm" />}
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `pnpm --filter frontend type-check`
Expected: erros restantes só em `ProductsPage.tsx` (Task 18).

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/components/recycling/PrintTableDialog.tsx
git commit -m "feat(frontend): PrintTableDialog com seletor de tabela e preview"
```

---

## Task 18: Frontend — integrar `ProductsPage`

Refatora a página existente:
- Carrega `priceTables` via novo hook.
- Lista mostra colunas dinâmicas por tabela.
- Substitui o modal antigo por `<ProductDialog>`.
- Substitui "baixar PDF direto" por `<PrintTableDialog>`.

**Files:**
- Modify: `apps/frontend/src/pages/recycling/products/ProductsPage.tsx`

- [ ] **Step 1: Ler arquivo atual**

```bash
cat apps/frontend/src/pages/recycling/products/ProductsPage.tsx | head -120
```

- [ ] **Step 2: Reescrever a página**

Remove o schema/dialog inline antigos. A nova página:

```typescript
import { useEffect, useState } from 'react';
import {
  CButton,
  CCard,
  CCardBody,
  CTable,
  CTableHead,
  CTableRow,
  CTableHeaderCell,
  CTableBody,
  CTableDataCell,
  CBadge,
} from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilPlus, cilPrint, cilPencil, cilTrash } from '@coreui/icons';
import {
  productsService,
  type Product,
} from '../../../services/recycling/products.service';
import {
  unitsService,
  type Unit,
} from '../../../services/recycling/units.service';
import { usePriceTables } from '../../../hooks/recycling/usePriceTables';
import { ProductDialog } from '../../../components/recycling/ProductDialog';
import { PrintTableDialog } from '../../../components/recycling/PrintTableDialog';
import { companyService, type CompanyProfile } from '../../../services/company.service';
import { formatBRL } from '../../../utils/format';

export function ProductsPage() {
  const { priceTables, loading: ptLoading } = usePriceTables();
  const [products, setProducts] = useState<Product[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [empresa, setEmpresa] = useState<CompanyProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState<Product | null | 'new'>(null);
  const [printOpen, setPrintOpen] = useState(false);

  const sortedTables = [...priceTables].sort((a, b) => a.sortOrder - b.sortOrder);

  const reload = async () => {
    setLoading(true);
    try {
      const [p, u, e] = await Promise.all([
        productsService.list(true),
        unitsService.list(),
        companyService.getProfile(),
      ]);
      setProducts(p);
      setUnits(u);
      setEmpresa(e);
      setError(null);
    } catch {
      setError('Erro ao carregar produtos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
  }, []);

  const handleSave = async (data: {
    name: string;
    unitId: string;
    active: boolean;
    prices: Record<string, number | null>;
  }) => {
    if (editing && editing !== 'new') {
      await productsService.update(editing.id, data);
    } else {
      await productsService.create(data);
    }
    setEditing(null);
    await reload();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir produto?')) return;
    await productsService.update(id, { active: false });
    await reload();
  };

  const isLoading = loading || ptLoading;

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          marginBottom: 16,
        }}
      >
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 600, margin: 0 }}>Produtos</h1>
          <p style={{ margin: 0, color: 'var(--cui-secondary-color)' }}>
            {products.length} produtos · {sortedTables.length} tabelas de preço
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <CButton
            variant="outline"
            color="primary"
            disabled={!products.length}
            onClick={() => setPrintOpen(true)}
          >
            <CIcon icon={cilPrint} size="sm" style={{ marginRight: 6 }} />
            Imprimir tabela
          </CButton>
          <CButton color="primary" onClick={() => setEditing('new')}>
            <CIcon icon={cilPlus} size="sm" style={{ marginRight: 6 }} />
            Novo produto
          </CButton>
        </div>
      </div>

      {error && <div style={{ color: 'var(--cui-danger)' }}>{error}</div>}

      <CCard>
        <CCardBody style={{ padding: 0 }}>
          <CTable responsive hover>
            <CTableHead>
              <CTableRow>
                <CTableHeaderCell>Produto</CTableHeaderCell>
                <CTableHeaderCell>Unidade</CTableHeaderCell>
                {sortedTables.map((t) => (
                  <CTableHeaderCell
                    key={t.id}
                    style={{ textAlign: 'right', whiteSpace: 'nowrap' }}
                  >
                    {t.name}
                  </CTableHeaderCell>
                ))}
                <CTableHeaderCell>Status</CTableHeaderCell>
                <CTableHeaderCell style={{ textAlign: 'right' }}>
                  Ações
                </CTableHeaderCell>
              </CTableRow>
            </CTableHead>
            <CTableBody>
              {isLoading ? (
                <CTableRow>
                  <CTableDataCell colSpan={4 + sortedTables.length}>
                    Carregando…
                  </CTableDataCell>
                </CTableRow>
              ) : (
                products.map((p) => {
                  const unit = units.find((u) => u.id === p.unitId);
                  return (
                    <CTableRow key={p.id}>
                      <CTableDataCell style={{ fontWeight: 540 }}>
                        {p.name}
                      </CTableDataCell>
                      <CTableDataCell>{unit?.abbreviation ?? '—'}</CTableDataCell>
                      {sortedTables.map((t) => (
                        <CTableDataCell
                          key={t.id}
                          style={{
                            textAlign: 'right',
                            fontFeatureSettings: "'tnum'",
                            fontWeight: 540,
                          }}
                        >
                          {formatBRL(p.prices[t.id])}
                        </CTableDataCell>
                      ))}
                      <CTableDataCell>
                        <CBadge color={p.active ? 'success' : 'secondary'}>
                          {p.active ? 'Ativo' : 'Inativo'}
                        </CBadge>
                      </CTableDataCell>
                      <CTableDataCell style={{ textAlign: 'right' }}>
                        <CButton
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditing(p)}
                          aria-label="Editar"
                        >
                          <CIcon icon={cilPencil} size="sm" />
                        </CButton>
                        <CButton
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(p.id)}
                          aria-label="Excluir"
                        >
                          <CIcon icon={cilTrash} size="sm" />
                        </CButton>
                      </CTableDataCell>
                    </CTableRow>
                  );
                })
              )}
            </CTableBody>
          </CTable>
        </CCardBody>
      </CCard>

      {editing !== null && sortedTables.length > 0 && (
        <ProductDialog
          key={editing === 'new' ? 'new' : editing.id}
          open={true}
          onClose={() => setEditing(null)}
          onSave={handleSave}
          priceTables={sortedTables}
          units={units}
          product={editing === 'new' ? null : editing}
        />
      )}

      {printOpen && empresa && (
        <PrintTableDialog
          open={printOpen}
          onClose={() => setPrintOpen(false)}
          priceTables={sortedTables}
          products={products}
          units={units}
          empresa={{ nomeFantasia: empresa.nomeFantasia, cnpj: empresa.cnpj }}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 3: Build + lint + type-check**

Run: `pnpm --filter frontend type-check && pnpm --filter frontend build`
Expected: build sem erros.

- [ ] **Step 4: Smoke manual**

```bash
docker compose up -d postgres redis
pnpm --filter backend start:dev &
pnpm --filter frontend dev
```

Acesse a página de Produtos como tenant RECYCLING. Valide:
- Listagem mostra colunas Tabela 1 — Padrão / Tabela 2 / Tabela 3.
- Clicar em "Novo produto" abre o modal redesenhado de 2 colunas.
- Salvar com só Tabela 1 preenchida cria o produto.
- Editar produto e apagar valor da Tabela 2 → célula vira "—" após save.
- "Imprimir tabela" abre o novo modal com pré-visualização ao vivo.
- Baixar PDF gera arquivo com nome `tabela-precos-tabela-1-padrao-2026-05-03.pdf`.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/pages/recycling/products/ProductsPage.tsx
git commit -m "feat(frontend): ProductsPage com colunas dinâmicas + novos modais"
```

---

## Task 19: Quality Gate (Sonar) — obrigatória, sempre última

**Files:** N/A — esta task valida o trabalho das tasks anteriores.

- [ ] **Step 1: Garantir SonarQube de pé**

Run: `docker compose --profile sonar up -d`
Verificar: `curl -sf http://localhost:9000/api/system/status | grep '"status":"UP"'`
Expected: `"status":"UP"`. Se demorar, aguardar até 60s.

- [ ] **Step 2: Rodar coverage + scanner + aguardar gate**

Run: `pnpm sonar:check`
Expected: gate verde com mensagem `✅ Quality gate verde.`

- [ ] **Step 3: Se gate falhou, listar issues new-code**

Run: `curl -s -u "$SONAR_TOKEN:" "http://localhost:9000/api/issues/search?componentKeys=praktikus&resolved=false&inNewCodePeriod=true&ps=500" | jq '.issues[] | {key, rule, severity, message, component, line}'`

- [ ] **Step 4: Para cada issue, corrigir ou suprimir com justificativa**

- **Bug/vuln/duplicação real:** corrigir o código.
- **Falso positivo legítimo:** suprimir inline com `// NOSONAR(rule:S####) — <razão em pt-BR>`.

Re-rodar Step 2 até gate verde.

- [ ] **Step 5: Push autorizado**

Run: `git push`
Expected: pre-push hook valida silenciosamente e libera.

---

## Self-review checklist

Antes de iniciar a execução do plano, valide:

- [ ] Spec coverage: cada decisão da tabela "Decisões alinhadas com o usuário" tem uma task que a implementa? (1: scope=A → tasks 5-18 evitam tocar Vendas/Compras; 2: 3 tabelas seedadas → Task 2; 3: gradual → Task 8 sincroniza pricePerUnit; 4: relacional → Tasks 1-2; 5: só Baixar PDF → Task 17.) ✓
- [ ] Critérios de aceite QA da Seção 8 da spec: validados na Task 18 Step 4. ✓
- [ ] Quality Gate como última task. ✓ (Task 19)
- [ ] Sem placeholders ("TBD", "TODO", "implement later"). ✓
- [ ] Type consistency: `ProductEntity`, `PriceTableEntity`, `ProductPriceEntity`, `PriceTable` (interface shared), `ProductPriceMap`, `Product` (frontend), `RecyclingProduct` (shared opcional). Nenhum drift entre tasks.
- [ ] Tasks têm caminhos absolutos exatos a partir da raiz do repo. ✓
