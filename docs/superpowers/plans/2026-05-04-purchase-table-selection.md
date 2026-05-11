# Compra com seletor de tabela + auto-fill produto + PriceRow vírgula — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Três evoluções pequenas sobre o feature de múltiplas tabelas de preço: (1) Compras passa a ter um seletor de tabela no header e usa o preço da tabela escolhida ao adicionar item; (2) Cadastro de produto auto-preenche t2/t3 com o valor de t1 quando deixados em branco; (3) Inputs de preço do `PriceRow` aceitam vírgula como separador decimal e exibem em formato BR (`6,50`).

**Architecture:** Mudanças cirúrgicas — sem refactors. Backend ganha campo `priceTableId` em `Purchase` (NOT NULL, FK ON DELETE RESTRICT). Frontend reusa hooks/components existentes (`usePriceTables`, `parseDecimal`/`formatDecimal` de `utils/masks.ts`). Backend continua confiando no `unitPrice` enviado pelo client (preserva override manual).

**Tech Stack:** NestJS 11 + TypeORM 0.3 + class-validator 0.15 | React 19 + CoreUI 5.6 + react-hook-form 7.71 + zod 4.3 + @react-pdf | vitest + @testing-library/react

**Spec:** [`docs/superpowers/specs/2026-05-04-purchase-table-selection-design.md`](../specs/2026-05-04-purchase-table-selection-design.md)

---

## File Structure

| Camada | Caminho | Ação |
|---|---|---|
| Backend SQL | `apps/backend/src/database/tenant-migrations/price-tables.sql.ts` | Modificar — adicionar `buildPurchasesPriceTableSetupSql` |
| Backend SQL | `apps/backend/src/database/tenant-migrations/create-tenant-tables.ts` | Modificar — chamar o novo helper no branch RECYCLING |
| Backend migration | `apps/backend/src/database/migrations/1748300000000-AddPriceTableIdToPurchases.ts` | Criar |
| Backend entity | `apps/backend/src/modules/recycling/purchases/purchase.entity.ts` | Modificar — adicionar `priceTableId` + relation |
| Backend DTO | `apps/backend/src/modules/recycling/purchases/dto/create-purchase.dto.ts` | Modificar — adicionar `priceTableId` |
| Backend service | `apps/backend/src/modules/recycling/purchases/purchases.service.ts` | Modificar — validar `priceTableId` + persistir |
| Backend test | `apps/backend/src/modules/recycling/purchases/purchases.service.spec.ts` | Modificar — adaptar mocks + 4 novos testes |
| Frontend service | `apps/frontend/src/services/recycling/purchases.service.ts` | Modificar — `priceTableId` em payload |
| Frontend page | `apps/frontend/src/pages/recycling/purchases/NewPurchasePage.tsx` | Modificar — seletor + handlers |
| Frontend dialog | `apps/frontend/src/components/recycling/ProductDialog.tsx` | Modificar — `onSubmit` + callout |
| Frontend dialog test | `apps/frontend/src/components/recycling/ProductDialog.test.tsx` | Modificar — 1 teste atualizado, 1 novo |
| Frontend component | `apps/frontend/src/components/recycling/PriceRow.tsx` | Modificar — text-state + parse/format |
| Frontend component test | `apps/frontend/src/components/recycling/PriceRow.test.tsx` | Modificar — adaptar 4 + 3 novos |

---

## Convenções

- **Commits:** um por task. Mensagem em pt-BR no formato `tipo(escopo): descrição`.
- **Testes backend:** Jest, mock de `DataSource`/`QueryRunner` (mesmo padrão usado em `products.service.spec.ts` e `purchases.service.spec.ts` existente).
- **Testes frontend:** vitest + `@testing-library/react`. Use `nvm use 22` se o test runner reclamar de engine (>=20 requerido).
- **Migrations rodam automaticamente** na inicialização do backend (`migrationsRun: true` em `database.module.ts`).

---

## Task 1: SQL helper `buildPurchasesPriceTableSetupSql`

Adiciona a função idempotente que será reusada pelo `create-tenant-tables.ts` (Task 2) e pela migration TypeORM (Task 3).

**Files:**
- Modify: `apps/backend/src/database/tenant-migrations/price-tables.sql.ts`

- [ ] **Step 1: Adicionar a função no final do arquivo**

Após `buildProductPricesBackfillSql`, adicione:

```typescript
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
```

- [ ] **Step 2: Type-check**

Run: `pnpm --filter backend build`
Expected: build sem erros.

- [ ] **Step 3: Commit**

```bash
git add apps/backend/src/database/tenant-migrations/price-tables.sql.ts
git commit -m "feat(db): SQL helper p/ adicionar price_table_id em purchases"
```

---

## Task 2: Wire helper no `create-tenant-tables.ts`

Garante que tenants RECYCLING criados de agora em diante recebam a coluna no provisioning inicial.

**Files:**
- Modify: `apps/backend/src/database/tenant-migrations/create-tenant-tables.ts`

- [ ] **Step 1: Adicionar import**

No bloco de imports do helper de price-tables, adicione:

```typescript
import {
  buildPriceTablesSql,
  buildPriceTablesSeedSql,
  buildPurchasesPriceTableSetupSql,  // NOVO
} from './price-tables.sql';
```

- [ ] **Step 2: Adicionar chamada no branch RECYCLING**

Na função `createTenantTablesSql`, dentro do `if (segment === TenantSegment.RECYCLING)`, ajuste o array retornado para incluir o helper **após** os seeds e **antes** das whatsapp tables:

```typescript
// Antes:
return [...recyclingTables, ...priceTables, ...priceTablesSeed, ...whatsappTables];

// Depois:
return [
  ...recyclingTables,
  ...priceTables,
  ...priceTablesSeed,
  ...buildPurchasesPriceTableSetupSql(schemaName),  // NOVO
  ...whatsappTables,
];
```

A ordem importa: o helper depende de `price_tables` existir e estar seedada.

- [ ] **Step 3: Type-check + lint**

Run: `pnpm --filter backend build`
Expected: build sem erros.

- [ ] **Step 4: Commit**

```bash
git add apps/backend/src/database/tenant-migrations/create-tenant-tables.ts
git commit -m "feat(db): novo tenant recyclables ganha price_table_id em purchases"
```

---

## Task 3: Migration TypeORM para tenants existentes

Loop sobre tenants RECYCLING existentes aplicando o helper.

**Files:**
- Create: `apps/backend/src/database/migrations/1748300000000-AddPriceTableIdToPurchases.ts`

- [ ] **Step 1: Criar a migration**

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';
import { TenantSegment } from '@praktikus/shared';
import { buildPurchasesPriceTableSetupSql } from '../tenant-migrations/price-tables.sql';

export class AddPriceTableIdToPurchases1748300000000 implements MigrationInterface {
  name = 'AddPriceTableIdToPurchases1748300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const tenants: Array<{ id: string }> = await queryRunner.query(
      `SELECT id FROM "public"."tenants" WHERE segment = $1`,
      [TenantSegment.RECYCLING],
    );

    for (const tenant of tenants) {
      const schema = `tenant_${tenant.id.replace(/-/g, '')}`;
      for (const sql of buildPurchasesPriceTableSetupSql(schema)) {
        await queryRunner.query(sql);
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const tenants: Array<{ id: string }> = await queryRunner.query(
      `SELECT id FROM "public"."tenants" WHERE segment = $1`,
      [TenantSegment.RECYCLING],
    );

    for (const tenant of tenants) {
      const schema = `tenant_${tenant.id.replace(/-/g, '')}`;
      await queryRunner.query(
        `ALTER TABLE "${schema}".purchases DROP CONSTRAINT IF EXISTS fk_purchases_price_table`,
      );
      await queryRunner.query(
        `ALTER TABLE "${schema}".purchases DROP COLUMN IF EXISTS price_table_id`,
      );
    }
  }
}
```

- [ ] **Step 2: Build**

Run: `pnpm --filter backend build`
Expected: sem erros.

- [ ] **Step 3: Rodar migration localmente (se Postgres up)**

```bash
docker compose ps postgres 2>/dev/null | grep -q "Up" && pnpm --filter backend migration:run || echo "Postgres not up — skipping (will run on next backend start)"
```

Se rodou: confira logs `AddPriceTableIdToPurchases1748300000000 has been executed`.

- [ ] **Step 4: Validar contra Postgres (se aplicável)**

```bash
docker compose exec -T postgres psql -U praktikus -d praktikus -c "SELECT id FROM public.tenants WHERE segment = 'RECYCLING' LIMIT 1" 2>/dev/null
# Pega o primeiro id e rode:
docker compose exec -T postgres psql -U praktikus -d praktikus -c "\\d tenant_<id>.purchases"
```

Expected: coluna `price_table_id` listada como `NOT NULL` e a constraint `fk_purchases_price_table` aparece. Compras existentes (se houver) devem ter `price_table_id` apontando pra Padrão:

```bash
docker compose exec -T postgres psql -U praktikus -d praktikus -c "SELECT count(*), count(price_table_id) FROM tenant_<id>.purchases"
```

Os dois counts devem bater.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/database/migrations/1748300000000-AddPriceTableIdToPurchases.ts
git commit -m "feat(db): migration de price_table_id em purchases p/ tenants existentes"
```

---

## Task 4: Backend — entity + DTO + service + tests

Mudança coesa: a coluna do banco existe, agora a aplicação usa. Entity, DTO e service vão juntos pra evitar estado intermediário broken (NOT NULL violation em runtime).

**Files:**
- Modify: `apps/backend/src/modules/recycling/purchases/purchase.entity.ts`
- Modify: `apps/backend/src/modules/recycling/purchases/dto/create-purchase.dto.ts`
- Modify: `apps/backend/src/modules/recycling/purchases/purchases.service.ts`
- Modify: `apps/backend/src/modules/recycling/purchases/purchases.service.spec.ts`

- [ ] **Step 1: Atualizar entity**

Edit `purchase.entity.ts` — adicionar import e dois novos blocos de coluna/relation:

```typescript
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,         // NOVO
  JoinColumn,        // NOVO
} from 'typeorm';
import { PaymentMethod } from '@praktikus/shared';
import { numericTransformer } from '../common/numeric-transformer';
import { PriceTableEntity } from '../price-tables/price-table.entity';  // NOVO

@Entity({ name: 'purchases' })
export class PurchaseEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'supplier_id', type: 'uuid' }) supplierId: string;
  @Column({ name: 'operator_id', type: 'uuid' }) operatorId: string;
  @Column({ name: 'cash_session_id', type: 'uuid', nullable: true })
  cashSessionId: string | null;

  // NOVO BLOCO ↓
  @Column({ name: 'price_table_id', type: 'uuid' })
  priceTableId: string;

  @ManyToOne(() => PriceTableEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'price_table_id' })
  priceTable: PriceTableEntity;
  // NOVO BLOCO ↑

  @Column({ name: 'payment_method', type: 'varchar' })
  paymentMethod: PaymentMethod;
  @Column({
    name: 'total_amount',
    type: 'numeric',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: numericTransformer,
  })
  totalAmount: number;
  @Column({ name: 'purchased_at', type: 'timestamptz', default: () => 'NOW()' })
  purchasedAt: Date;
  @Column({ type: 'varchar', nullable: true }) notes: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
```

- [ ] **Step 2: Atualizar DTO**

Edit `dto/create-purchase.dto.ts` — adicionar `priceTableId`:

```typescript
export class CreatePurchaseDto {
  @IsUUID()
  supplierId: string;

  @IsUUID()                  // NOVO
  priceTableId: string;      // NOVO

  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PurchaseItemDto)
  items: PurchaseItemDto[];

  @IsOptional()
  @IsString()
  notes?: string;
}
```

- [ ] **Step 3: Atualizar service**

Edit `purchases.service.ts` — adicionar import de `PriceTableEntity` e mudar `create` para validar e persistir o `priceTableId`. O resto do método permanece igual:

```typescript
import { PriceTableEntity } from '../price-tables/price-table.entity';
// ... outros imports

async create(
  tenantId: string,
  operatorId: string,
  dto: CreatePurchaseDto,
): Promise<PurchaseEntity> {
  return this.withSchema(tenantId, async (manager) => {
    // NOVO: validar priceTableId antes de qualquer outra coisa
    const priceTable = await manager
      .getRepository(PriceTableEntity)
      .findOne({ where: { id: dto.priceTableId, active: true } });
    if (!priceTable) {
      throw new BadRequestException('Tabela de preço inválida ou inativa');
    }

    const sessionRepo = manager.getRepository(CashSessionEntity);
    const purchaseRepo = manager.getRepository(PurchaseEntity);
    const itemRepo = manager.getRepository(PurchaseItemEntity);
    const movementRepo = manager.getRepository(StockMovementEntity);
    const txRepo = manager.getRepository(CashTransactionEntity);

    const session = await sessionRepo.findOne({
      where: { status: CashSessionStatus.OPEN },
    });
    if (!session)
      throw new BadRequestException(
        'Abra o caixa antes de registrar uma compra.',
      );

    const totalAmount =
      Math.round(
        dto.items.reduce(
          (sum, item) => sum + item.quantity * item.unitPrice,
          0,
        ) * 100,
      ) / 100;

    const purchase = purchaseRepo.create({
      supplierId: dto.supplierId,
      priceTableId: dto.priceTableId,    // NOVO
      operatorId,
      cashSessionId: session.id,
      paymentMethod: dto.paymentMethod,
      totalAmount,
      notes: dto.notes ?? null,
      purchasedAt: new Date(),
    });
    const savedPurchase = await purchaseRepo.save(purchase);

    // ... resto do método inalterado (purchase_items, stock_movements, cash_transaction)
    // (preservar o código existente daqui em diante)

    return savedPurchase;
  });
}
```

> Mantém todo o resto do método (loop de items, stock movements, cash transaction) sem mudança.

- [ ] **Step 4: Atualizar testes**

Edit `purchases.service.spec.ts`. Primeiro, adicionar mock de `PriceTableEntity` no switch do `manager.getRepository`:

```typescript
import { PriceTableEntity } from '../price-tables/price-table.entity';
// ... outros imports

// Adicionar mock:
const mockPriceTableRepo = { findOne: jest.fn() };

// No mockQueryRunner.manager.getRepository:
manager: {
  getRepository: jest.fn((entity) => {
    if (entity === PurchaseEntity) return mockPurchaseRepo;
    if (entity === PurchaseItemEntity) return mockItemRepo;
    if (entity === StockMovementEntity) return mockMovementRepo;
    if (entity === CashSessionEntity) return mockSessionRepo;
    if (entity === PriceTableEntity) return mockPriceTableRepo;  // NOVO
    return mockTxRepo;
  }),
},

// Idem no `mockQueryRunner.manager.getRepository.mockImplementation` dentro do beforeEach.
```

Em seguida, no `beforeEach` (ou no início de cada teste de `create`), defina o default do `findOne`:

```typescript
mockPriceTableRepo.findOne.mockResolvedValue({
  id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  isDefault: true,
  active: true,
  sortOrder: 1,
});
```

E ajuste todos os DTOs em testes existentes (`create` deve receber `priceTableId`):

```typescript
const dto: CreatePurchaseDto = {
  supplierId: '...',
  priceTableId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',  // NOVO em todos os DTOs de teste existente
  paymentMethod: PaymentMethod.CASH,
  items: [{ productId: '...', quantity: 1, unitPrice: 5 }],
};
```

Em seguida, adicione 4 novos testes ao describe('PurchasesService') (ou subdescribe `describe('create — priceTableId')`):

```typescript
describe('create — priceTableId', () => {
  const TENANT = '11111111-1111-1111-1111-111111111111';
  const OPERATOR = '22222222-2222-2222-2222-222222222222';
  const TABLE = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const baseDto: CreatePurchaseDto = {
    supplierId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    priceTableId: TABLE,
    paymentMethod: PaymentMethod.CASH,
    items: [{
      productId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
      quantity: 1,
      unitPrice: 5,
    }],
  };

  it('rejeita priceTableId que não existe', async () => {
    mockPriceTableRepo.findOne.mockResolvedValue(null);
    await expect(
      service.create(TENANT, OPERATOR, baseDto),
    ).rejects.toThrow('Tabela de preço inválida ou inativa');
  });

  it('rejeita priceTableId de tabela inativa', async () => {
    // findOne retorna null porque o where { active: true } filtra
    mockPriceTableRepo.findOne.mockResolvedValue(null);
    await expect(
      service.create(TENANT, OPERATOR, baseDto),
    ).rejects.toThrow('Tabela de preço inválida ou inativa');
  });

  it('persiste priceTableId quando válido', async () => {
    mockPriceTableRepo.findOne.mockResolvedValue({
      id: TABLE,
      isDefault: true,
      active: true,
    });
    mockSessionRepo.findOne.mockResolvedValue({ id: 'session-1', status: 'OPEN' });
    mockPurchaseRepo.create.mockImplementation((p) => ({ ...p, id: 'purchase-1' }));
    mockPurchaseRepo.save.mockImplementation((p) => Promise.resolve(p));

    await service.create(TENANT, OPERATOR, baseDto);

    expect(mockPurchaseRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ priceTableId: TABLE }),
    );
  });

  it('continua trustando unitPrice do client (não revalida contra product.prices)', async () => {
    mockPriceTableRepo.findOne.mockResolvedValue({
      id: TABLE,
      isDefault: true,
      active: true,
    });
    mockSessionRepo.findOne.mockResolvedValue({ id: 'session-1', status: 'OPEN' });
    mockPurchaseRepo.create.mockImplementation((p) => ({ ...p, id: 'purchase-1' }));
    mockPurchaseRepo.save.mockImplementation((p) => Promise.resolve(p));
    mockItemRepo.create.mockImplementation((p) => p);
    mockItemRepo.save.mockImplementation((p) => Promise.resolve(p));

    const dto = { ...baseDto, items: [{ ...baseDto.items[0], unitPrice: 999 }] };
    await service.create(TENANT, OPERATOR, dto);

    expect(mockItemRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ unitPrice: 999 }),
    );
  });
});
```

- [ ] **Step 5: Rodar tests**

Run: `pnpm --filter backend test -- purchases.service.spec`
Expected: todos passando (testes existentes + 4 novos).

Se algum teste existente falhar, é porque o DTO não inclui `priceTableId`. Adicione em todos os DTOs de teste.

- [ ] **Step 6: Build completo**

Run: `pnpm --filter backend build`
Expected: build verde.

- [ ] **Step 7: Commit**

```bash
git add apps/backend/src/modules/recycling/purchases/
git commit -m "feat(api): purchase aceita e valida priceTableId"
```

---

## Task 5: Frontend — `purchases.service` types + `NewPurchasePage` integration

Mudança no service (1 linha) + integração da página (campo no header, schema, handlers).

**Files:**
- Modify: `apps/frontend/src/services/recycling/purchases.service.ts`
- Modify: `apps/frontend/src/pages/recycling/purchases/NewPurchasePage.tsx`

- [ ] **Step 1: Atualizar service types**

Edit `apps/frontend/src/services/recycling/purchases.service.ts` — adicionar `priceTableId` em `CreatePurchasePayload`:

```typescript
export interface CreatePurchasePayload {
  supplierId: string;
  priceTableId: string;       // NOVO
  paymentMethod: PaymentMethod;
  items: Array<{ productId: string; quantity: number; unitPrice: number }>;
  notes?: string;
}
```

E também em `Purchase` (para refletir o que o backend retorna):

```typescript
export interface Purchase {
  id: string;
  supplierId: string;
  priceTableId: string;       // NOVO
  operatorId: string;
  cashSessionId: string | null;
  paymentMethod: PaymentMethod;
  totalAmount: number;
  purchasedAt: string;
  notes: string | null;
  createdAt: string;
}
```

- [ ] **Step 2: NewPurchasePage — imports**

Edit `NewPurchasePage.tsx`. Adicionar imports:

```typescript
import { usePriceTables } from '../../../hooks/recycling/usePriceTables';
```

- [ ] **Step 3: NewPurchasePage — schema + defaultValues**

Atualizar o `schema` adicionando `priceTableId` e o `useForm` defaults para incluir uma string vazia (será preenchida quando `priceTables` carregar):

```typescript
const schema = z.object({
  supplierId: z.string().uuid('Selecione um fornecedor'),
  priceTableId: z.string().uuid('Selecione uma tabela'),     // NOVO
  paymentMethod: z.nativeEnum(PaymentMethod, { error: () => ({ message: 'Selecione a forma de pagamento' }) }),
  items: z.array(itemSchema).min(1, 'Adicione ao menos um item'),
  notes: z.string().optional(),
});

// ...

const { register, handleSubmit, control, watch, setValue, formState: { errors, isSubmitting } } = useForm<FormData>({
  resolver: zodResolver(schema),
  defaultValues: {
    supplierId: '',
    priceTableId: '',                                          // NOVO
    paymentMethod: PaymentMethod.CASH,
    items: [{ productId: '', quantity: 1, unitPrice: 0 }],
    notes: '',
  },
});
```

- [ ] **Step 4: NewPurchasePage — usePriceTables + auto-select default**

Adicionar logo abaixo do `usePurchaseFormData()`:

```typescript
const { priceTables, loading: loadingTables } = usePriceTables();

// Quando priceTables carregar, seleciona a Padrão se nenhuma estiver selecionada
useEffect(() => {
  if (!priceTables.length) return;
  if (watch('priceTableId')) return;
  const def = priceTables.find((t) => t.isDefault) ?? priceTables[0];
  if (def) setValue('priceTableId', def.id);
}, [priceTables, watch, setValue]);
```

Adicione `useEffect` ao import do react se não estiver lá.

Atualize o loading do skeleton para incluir `loadingTables`:

```typescript
if (loadingData || loadingTables) {
  return /* skeleton existente */;
}
```

- [ ] **Step 5: NewPurchasePage — atualizar `handleProductChange` e adicionar `handleTableChange`**

```typescript
const handleProductChange = (index: number, productId: string) => {
  const product = products.find((p) => p.id === productId);
  if (!product) return;
  const tableId = watch('priceTableId');
  // Sugere preço da tabela escolhida; fallback pra pricePerUnit (denorm da padrão) pra dados legados
  const suggested = product.prices?.[tableId] ?? product.pricePerUnit;
  setValue(`items.${index}.unitPrice`, suggested);
  requestAnimationFrame(() => {
    const el = document.getElementById(`item-quantity-${index}`) as HTMLInputElement | null;
    el?.focus();
    el?.select();
  });
};

const handleTableChange = (newTableId: string) => {
  const items = watch('items') ?? [];
  const hasItems = items.some((i) => i.productId);
  if (!hasItems) {
    setValue('priceTableId', newTableId);
    return;
  }
  const ok = window.confirm(
    'Trocar a tabela vai recalcular o preço sugerido dos itens já adicionados, ' +
    'sobrescrevendo edições manuais. Continuar?',
  );
  if (!ok) return; // mantém a seleção anterior
  setValue('priceTableId', newTableId);
  items.forEach((it, idx) => {
    if (!it.productId) return;
    const product = products.find((p) => p.id === it.productId);
    if (!product) return;
    const newPrice = product.prices?.[newTableId] ?? product.pricePerUnit;
    setValue(`items.${idx}.unitPrice`, newPrice);
  });
};
```

- [ ] **Step 6: NewPurchasePage — render do select de tabela no header**

No card "Dados da compra", localize o bloco que renderiza Fornecedor e Forma de pagamento. Adicione um terceiro `<CFormSelect>` para Tabela de preço.

Exemplo (ajuste ao layout exato da página atual — pode estar usando `CCol`/`CRow` ou grid CSS):

```tsx
<div>
  <CFormLabel htmlFor="purchase-pricetable">Tabela de preço *</CFormLabel>
  <Controller
    control={control}
    name="priceTableId"
    render={({ field }) => (
      <CFormSelect
        id="purchase-pricetable"
        value={field.value ?? ''}
        onChange={(e) => handleTableChange(e.target.value)}
        invalid={!!errors.priceTableId}
      >
        <option value="">Selecione...</option>
        {[...priceTables].sort((a, b) => a.sortOrder - b.sortOrder).map((t) => (
          <option key={t.id} value={t.id}>{t.name}</option>
        ))}
      </CFormSelect>
    )}
  />
  {errors.priceTableId && (
    <CFormFeedback invalid>{errors.priceTableId.message}</CFormFeedback>
  )}
</div>
```

> **Importante:** o handler `onChange` chama `handleTableChange(value)` (não `field.onChange` direto), porque queremos passar pelo confirm dialog.

- [ ] **Step 7: NewPurchasePage — atualizar `onSubmit` para enviar `priceTableId`**

```typescript
const onSubmit = async (data: FormData) => {
  setSubmitError(null);
  try {
    const created = await purchasesService.create({
      supplierId: data.supplierId,
      priceTableId: data.priceTableId,        // NOVO
      paymentMethod: data.paymentMethod,
      items: data.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      })),
      notes: data.notes || undefined,
    });
    setNewPurchaseId(created.id);
  } catch (err: unknown) {
    // ... tratamento existente
  }
};
```

- [ ] **Step 8: Build + smoke**

Run: `pnpm --filter frontend build`
Expected: build verde. Use `nvm use 22` se necessário.

(Smoke test manual depois, na Task 8 de Quality Gate ou quando rodar a app.)

- [ ] **Step 9: Commit**

```bash
git add apps/frontend/src/services/recycling/purchases.service.ts apps/frontend/src/pages/recycling/purchases/NewPurchasePage.tsx
git commit -m "feat(frontend): nova compra com seletor de tabela de preço"
```

---

## Task 6: Frontend — `ProductDialog` auto-fill no save + callout

**Files:**
- Modify: `apps/frontend/src/components/recycling/ProductDialog.tsx`
- Modify: `apps/frontend/src/components/recycling/ProductDialog.test.tsx`

- [ ] **Step 1: Atualizar `onSubmit`**

Localize o handler `onSubmit` em `ProductDialog.tsx`. Substitua a lógica de iteração das prices:

```typescript
const onSubmit = handleSubmit(async (data) => {
  const defaultTable = sorted.find((t) => t.isDefault);
  if (!defaultTable) throw new Error('Tabela padrão não configurada');
  const defaultRaw = data.prices[defaultTable.id];
  const defaultValue = Number(defaultRaw);

  const prices: Record<string, number | null> = {};
  for (const [k, v] of Object.entries(data.prices)) {
    const raw = v as number | string | null;
    if (raw == null || raw === '') {
      // Auto-fill: vazio em tabela não-padrão = valor da padrão
      prices[k] = k === defaultTable.id ? null : defaultValue;
    } else {
      prices[k] = Number(raw);
    }
  }
  await onSave({
    name: data.name,
    unitId: data.unitId,
    active: data.active,
    prices,
  });
});
```

- [ ] **Step 2: Atualizar texto do callout**

No JSX do callout (final da coluna direita), substitua o texto:

```tsx
<span>
  A Tabela 1 (Padrão) é obrigatória. <strong>Se você deixar as outras tabelas em branco, elas vão herdar o valor da Tabela 1 ao salvar.</strong>
</span>
```

(Substitui o texto que mencionava "Configurações → Tabelas de preço".)

- [ ] **Step 3: Atualizar teste existente**

Em `ProductDialog.test.tsx`, o teste `submit transforma string vazia em null nos preços` agora vai falhar — a expectativa muda. Renomeie e atualize:

```typescript
it('submit auto-preenche tabelas vazias com o valor da Tabela 1', async () => {
  const onSave = vi.fn();
  const user = userEvent.setup();
  render(<ProductDialog {...baseProps} onSave={onSave} />);

  await user.type(screen.getByLabelText(/Nome/i), 'Alumínio');
  const unitSelect = screen.getByLabelText(/Unidade/i);
  await user.selectOptions(unitSelect, '11111111-1111-1111-1111-111111111111');
  const inputs = screen.getAllByRole('spinbutton');
  await user.type(inputs[0], '8'); // só padrão

  await user.click(screen.getByRole('button', { name: /Salvar/i }));

  await waitFor(() => {
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Alumínio',
        prices: expect.objectContaining({
          t1: 8,
          t2: 8,                 // ← auto-filled (antes era null)
          t3: 8,                 // ← auto-filled (antes era null)
        }),
      }),
    );
  });
});
```

- [ ] **Step 4: Adicionar novo teste**

Adicionar um teste novo que confirma que o auto-fill respeita valores explícitos:

```typescript
it('submit preserva valor explícito em tabelas não-padrão', async () => {
  const onSave = vi.fn();
  const user = userEvent.setup();
  render(<ProductDialog {...baseProps} onSave={onSave} />);

  await user.type(screen.getByLabelText(/Nome/i), 'Cobre');
  const unitSelect = screen.getByLabelText(/Unidade/i);
  await user.selectOptions(unitSelect, '11111111-1111-1111-1111-111111111111');
  const inputs = screen.getAllByRole('spinbutton');
  await user.type(inputs[0], '6');     // padrão
  await user.type(inputs[1], '7');     // t2 explícito
  // t3 fica vazio → auto-fill

  await user.click(screen.getByRole('button', { name: /Salvar/i }));

  await waitFor(() => {
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        prices: expect.objectContaining({
          t1: 6,
          t2: 7,                 // explícito mantido
          t3: 6,                 // auto-fill da padrão
        }),
      }),
    );
  });
});
```

> Nota: este teste depende dos selectors `getByRole('spinbutton')` que vão deixar de funcionar após Task 7 (PriceRow vira `type="text"`). Quando Task 7 for executada, atualize os selectors aqui também.

- [ ] **Step 5: Rodar tests**

Run: `pnpm --filter frontend test -- ProductDialog --run`
Expected: 5 testes passando (4 atualizados + 1 novo).

- [ ] **Step 6: Commit**

```bash
git add apps/frontend/src/components/recycling/ProductDialog.tsx apps/frontend/src/components/recycling/ProductDialog.test.tsx
git commit -m "feat(frontend): produto auto-preenche t2/t3 com valor da Tabela 1"
```

---

## Task 7: Frontend — `PriceRow` aceitar vírgula + formato BR

**Files:**
- Modify: `apps/frontend/src/components/recycling/PriceRow.tsx`
- Modify: `apps/frontend/src/components/recycling/PriceRow.test.tsx`

- [ ] **Step 1: Atualizar testes (alguns vão FALHAR primeiro)**

Edit `PriceRow.test.tsx`. Substituir o conteúdo todo por:

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

  it('chama onChange com ponto quando o usuário digita ponto', () => {
    const onChange = vi.fn();
    render(<PriceRow {...baseProps} onChange={onChange} />);
    const input = screen.getByPlaceholderText('0,00');
    fireEvent.change(input, { target: { value: '8.5' } });
    expect(onChange).toHaveBeenCalledWith('8.5');
  });

  it('chama onChange com ponto quando o usuário digita vírgula (normalização)', () => {
    const onChange = vi.fn();
    render(<PriceRow {...baseProps} onChange={onChange} />);
    const input = screen.getByPlaceholderText('0,00');
    fireEvent.change(input, { target: { value: '8,5' } });
    expect(onChange).toHaveBeenCalledWith('8.5');
  });

  it('ignora caracteres não-numéricos (não chama onChange)', () => {
    const onChange = vi.fn();
    render(<PriceRow {...baseProps} onChange={onChange} value="" />);
    const input = screen.getByPlaceholderText('0,00');
    fireEvent.change(input, { target: { value: 'abc' } });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('formata valor em formato BR após blur', () => {
    render(<PriceRow {...baseProps} value="8.5" />);
    const input = screen.getByPlaceholderText('0,00') as HTMLInputElement;
    fireEvent.blur(input);
    expect(input.value).toBe('8,50');
  });

  it('estado preenchido marca a linha como destacada (data-filled=true)', () => {
    const { container } = render(<PriceRow {...baseProps} value="8.5" />);
    const row = container.querySelector('[data-filled="true"]');
    expect(row).toBeInTheDocument();
  });

  it('estado vazio não marca destacada (data-filled=false)', () => {
    const { container } = render(<PriceRow {...baseProps} value="" />);
    const row = container.querySelector('[data-filled="false"]');
    expect(row).toBeInTheDocument();
  });
});
```

> Mudanças vs. testes anteriores:
> - `getByRole('spinbutton')` → `getByPlaceholderText('0,00')` (input vai ser `type="text"`).
> - 3 novos testes: vírgula é normalizada para ponto, caractere inválido é ignorado, blur formata para BR.

- [ ] **Step 2: Rodar tests — esperar FAIL**

Run: `pnpm --filter frontend test -- PriceRow --run`
Expected: vários testes falham porque o input ainda é `type="number"` e não tem lógica de blur/normalização.

- [ ] **Step 3: Refatorar `PriceRow.tsx`**

Substituir o conteúdo de `PriceRow.tsx`:

```typescript
import { useEffect, useState } from 'react';
import { CFormInput } from '@coreui/react';
import { formatDecimal, parseDecimal } from '../../utils/masks';

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

function formatInitial(v: number | string | null | undefined): string {
  if (v == null || v === '') return '';
  const n = typeof v === 'number' ? v : parseDecimal(String(v), 2);
  return n == null ? '' : formatDecimal(n, 2);
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
  const [text, setText] = useState<string>(() => formatInitial(value));

  // Sincroniza com valor externo (form reset, replicar tabela 1, etc)
  useEffect(() => {
    const incoming = formatInitial(value);
    const parsedCurrent = parseDecimal(text, 2);
    const parsedIncoming = parseDecimal(incoming, 2);
    if (parsedCurrent !== parsedIncoming) {
      setText(incoming);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- text é estado interno; só re-sincroniza quando value externo muda
  }, [value]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    if (!/^[\d.,]*$/.test(raw)) return; // só dígitos, vírgula e ponto
    setText(raw);
    const normalized = raw.replace(',', '.');
    onChange(normalized);
  }

  function handleBlur() {
    const parsed = parseDecimal(text, 2);
    if (parsed === null) {
      setText('');
      onChange('');
      return;
    }
    setText(formatDecimal(parsed, 2));
    onChange(String(parsed));
  }

  const filled = text !== '';

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
          type="text"
          inputMode="decimal"
          placeholder="0,00"
          value={text}
          onChange={handleChange}
          onBlur={handleBlur}
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

> Diferenças principais:
> - `type="text"` (era `type="number"`).
> - Estado interno `text` mantém o que o usuário digita (com vírgula).
> - `onChange` propaga string normalizada (`,` → `.`) pra parent — schema zod do `ProductDialog` continua recebendo string.
> - `onBlur` formata pra `'8,50'` (BR) e propaga `'8.5'` pro parent.
> - `useEffect` sincroniza `text` quando `value` externo muda (Replicar Tabela 1, reset, etc).
> - `filled` agora deriva de `text` (não do `value` raw).

- [ ] **Step 4: Rodar tests do PriceRow — esperar PASS**

Run: `pnpm --filter frontend test -- PriceRow --run`
Expected: 7 testes passando.

- [ ] **Step 5: Atualizar selectors no `ProductDialog.test.tsx`**

Abra `ProductDialog.test.tsx`. Substituir todas as ocorrências de `getAllByRole('spinbutton')` por `getAllByPlaceholderText('0,00')`:

```typescript
// Antes:
const inputs = screen.getAllByRole('spinbutton');

// Depois:
const inputs = screen.getAllByPlaceholderText('0,00');
```

(Pode haver ~3-4 ocorrências.)

- [ ] **Step 6: Rodar todos os tests do frontend**

Run: `pnpm --filter frontend test --run`
Expected: todos os testes do `PriceRow` e `ProductDialog` passando.

- [ ] **Step 7: Build**

Run: `pnpm --filter frontend build`
Expected: build verde.

- [ ] **Step 8: Commit**

```bash
git add apps/frontend/src/components/recycling/PriceRow.tsx \
        apps/frontend/src/components/recycling/PriceRow.test.tsx \
        apps/frontend/src/components/recycling/ProductDialog.test.tsx
git commit -m "feat(frontend): PriceRow aceita vírgula e exibe formato BR"
```

---

## Task 8: Quality Gate (Sonar) — obrigatória, sempre última

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

- [ ] **Spec coverage:**
  - Decisão #1 (auto-fill no save, client-side) → Task 6.
  - Decisão #2 (persistir priceTableId em Purchase) → Tasks 1-4.
  - Decisão #3 (servidor não revalida unitPrice) → Task 4 Step 4 inclui um teste explícito disso.
  - Decisão #4 (confirm dialog ao trocar tabela) → Task 5 Step 5.
  - Decisão #5 (PriceRow aceita vírgula + formato BR) → Task 7.
  - Critérios de aceite (Seção 6 da spec) → todos cobertos por testes ou pelo smoke implícito da Task 8.

- [ ] **Placeholders:** nenhum "TBD"/"TODO". Cada step tem código completo. ✓

- [ ] **Type consistency:**
  - `PurchaseEntity.priceTableId: string` — Task 4.
  - `CreatePurchaseDto.priceTableId: string` — Task 4.
  - `CreatePurchasePayload.priceTableId: string` (frontend) — Task 5.
  - Todos batem.

- [ ] **Quality Gate** como última task. ✓ (Task 8)

- [ ] **Sequência de execução:** Tasks 1-3 são aditivas (schema). Task 4 muda entity+DTO+service em conjunto pra evitar build broken intermediário. Task 5-7 são frontend independente. Task 8 sempre por último.
