# GAP-01 — Vendas geram movimento no Caixa (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Toda venda à vista (Dinheiro/PIX/Cartão) registrada no segmento Reciclagem deve criar automaticamente uma `cash_transaction` do tipo `IN` na sessão de caixa aberta, atomicamente com o registro da venda. Vendas a prazo são permitidas mesmo com caixa fechado, e não movimentam o caixa.

**Architecture:**
- Adiciona coluna `payment_method` em `sales` e o valor `ON_CREDIT` ao enum compartilhado `PaymentMethod`.
- `SalesService.create` passa a (a) bloquear vendas à vista quando não há `cash_session` aberta e (b) criar a `cash_transaction` dentro do mesmo `QueryRunner` que já controla a transação atômica do método (já existe rollback ao redor de `withSchema`).
- Frontend ganha campo "Forma de pagamento" no formulário de venda; em caso de erro 400 referente a caixa fechado, mostra CTA inline para `/recycling/cash-register`.

**Tech Stack:** NestJS + TypeORM (schema-per-tenant) · React 19 + react-hook-form + zod · CoreUI · Jest (`*.spec.ts`).

**Decisão de produto (resolvida no plano):** "a prazo" entra como mais um valor de `PaymentMethod` (`ON_CREDIT`). Quando selecionado, a venda é criada **sem** lançamento no caixa. Modelar contas a receber dedicado fica fora deste plano (tracker para follow-up: criar issue após a entrega).

---

## File Structure

**Backend — modificações:**
- `packages/shared/src/enums/cash-register.enums.ts` — adicionar `ON_CREDIT` ao enum.
- `apps/backend/src/database/migrations/1748000000000-AddPaymentMethodToSales.ts` — **criar**.
- `apps/backend/src/modules/recycling/sales/sale.entity.ts` — adicionar coluna `paymentMethod`.
- `apps/backend/src/modules/recycling/sales/dto/create-sale.dto.ts` — adicionar campo `paymentMethod` validado.
- `apps/backend/src/modules/recycling/sales/sales.service.ts` — checar caixa aberto + criar cash_transaction.
- `apps/backend/src/modules/recycling/sales/sales.service.spec.ts` — atualizar testes (substituir o de "no cash_transaction" por novos).
- `apps/backend/src/modules/recycling/sales/sales.module.ts` — sem mudança de código (já não precisa importar nada novo: cash entities são acessadas via repositório do `manager`).

**Frontend — modificações:**
- `apps/frontend/src/services/recycling/sales.service.ts` — adicionar `paymentMethod` em `CreateSalePayload` e tipo derivado.
- `apps/frontend/src/pages/recycling/sales/NewSalePage.tsx` — schema zod + select de forma de pagamento + tratamento de erro de caixa fechado com CTA.

**Sem novas dependências.**

---

## Convenções importantes (não esqueça)

1. **Commit por task** com mensagem `tipo(escopo): descrição` (ex: `feat(sales): persist payment method`).
2. Backend: rodar `pnpm --filter backend lint && pnpm --filter backend test sales` antes de cada commit.
3. Frontend: rodar `pnpm --filter frontend lint && pnpm --filter frontend test` antes do commit.
4. Migration: nunca usar `synchronize: true`. Sempre testar `up`/`down` localmente.
5. **TenantId vem do controller via `req.user.tenantId`** — já está correto em `sales.controller.ts:39`. Não tocar.
6. Em testes do `sales.service.spec.ts`: o repo de `CashSessionEntity` e `CashTransactionEntity` será resolvido via `mockQueryRunner.manager.getRepository`. O mock atual mapeia `SaleEntity`/`SaleItemEntity`/(default), e precisa ser estendido.

---

## Task 1: Adicionar valor `ON_CREDIT` ao enum `PaymentMethod`

**Files:**
- Modify: `packages/shared/src/enums/cash-register.enums.ts:11-15`

- [ ] **Step 1: Editar o enum**

Substituir as linhas 11–15 do arquivo por:

```ts
export enum PaymentMethod {
  CASH = 'CASH',
  PIX = 'PIX',
  CARD = 'CARD',
  ON_CREDIT = 'ON_CREDIT',
}
```

- [ ] **Step 2: Build do shared**

Run: `pnpm --filter @praktikus/shared build`
Expected: build passa sem erros (saída em `packages/shared/dist/`).

- [ ] **Step 3: Verificar consumidores existentes do enum**

Run: `grep -rn "PaymentMethod\." apps/backend/src apps/frontend/src 2>/dev/null`
Expected: nenhum `switch` exaustivo sobre `PaymentMethod` que precise tratar o novo valor (esperado: zero matches problemáticos hoje, já que ele só é referenciado como tipo). Se houver `switch` sem `default`, abrir um TODO inline naquele arquivo.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/enums/cash-register.enums.ts
git commit -m "feat(shared): add ON_CREDIT to PaymentMethod enum"
```

---

## Task 2: Migration — adicionar coluna `payment_method` em `sales`

**Files:**
- Create: `apps/backend/src/database/migrations/1748000000000-AddPaymentMethodToSales.ts`

- [ ] **Step 1: Criar a migration**

```ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPaymentMethodToSales1748000000000 implements MigrationInterface {
  name = 'AddPaymentMethodToSales1748000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const tenants: Array<{ id: string }> = await queryRunner.query(
      `SELECT id FROM "public"."tenants" WHERE segment = 'RECYCLING'`,
    );

    for (const tenant of tenants) {
      const schemaName = `tenant_${tenant.id.replace(/-/g, '')}`;

      await queryRunner.query(`
        ALTER TABLE "${schemaName}"."sales"
        ADD COLUMN IF NOT EXISTS "payment_method" varchar
      `);

      // Backfill: vendas existentes ficam como CASH (assumimos que vendas anteriores
      // já foram registradas como dinheiro à vista; nenhum movimento de caixa será
      // criado retroativamente — esta migration só preenche a coluna).
      await queryRunner.query(`
        UPDATE "${schemaName}"."sales"
        SET "payment_method" = 'CASH'
        WHERE "payment_method" IS NULL
      `);

      await queryRunner.query(`
        ALTER TABLE "${schemaName}"."sales"
        ALTER COLUMN "payment_method" SET NOT NULL
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const tenants: Array<{ id: string }> = await queryRunner.query(
      `SELECT id FROM "public"."tenants" WHERE segment = 'RECYCLING'`,
    );

    for (const tenant of tenants) {
      const schemaName = `tenant_${tenant.id.replace(/-/g, '')}`;
      await queryRunner.query(`
        ALTER TABLE "${schemaName}"."sales"
        DROP COLUMN IF EXISTS "payment_method"
      `);
    }
  }
}
```

- [ ] **Step 2: Rodar a migration localmente**

Run: `pnpm --filter backend migration:run`
Expected: log mostra `AddPaymentMethodToSales1748000000000` aplicada com sucesso. Confirme com:

```bash
docker exec -it praktikus-postgres-1 psql -U postgres -d praktikus -c "\d \"tenant_<algum_id>\".sales" | grep payment_method
```

Expected: linha `payment_method | character varying | not null` aparece.

- [ ] **Step 3: Testar `down`**

Run: `pnpm --filter backend migration:revert`
Expected: coluna some. Rodar `migration:run` de novo para deixar aplicada antes do commit.

- [ ] **Step 4: Commit**

```bash
git add apps/backend/src/database/migrations/1748000000000-AddPaymentMethodToSales.ts
git commit -m "feat(sales): add payment_method column to sales table"
```

---

## Task 3: SaleEntity ganha campo `paymentMethod`

**Files:**
- Modify: `apps/backend/src/modules/recycling/sales/sale.entity.ts`

- [ ] **Step 1: Atualizar a entity**

Substituir o conteúdo completo de `sale.entity.ts` por:

```ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';
import { PaymentMethod } from '@praktikus/shared';

@Entity({ name: 'sales' })
export class SaleEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'buyer_id', type: 'uuid' }) buyerId: string;
  @Column({ name: 'operator_id', type: 'uuid' }) operatorId: string;
  @Column({ name: 'sold_at', type: 'timestamptz', default: () => 'NOW()' }) soldAt: Date;
  @Column({ name: 'payment_method', type: 'varchar' }) paymentMethod: PaymentMethod;
  @Column({ type: 'varchar', nullable: true }) notes: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
}
```

- [ ] **Step 2: Compilar e verificar**

Run: `pnpm --filter backend build`
Expected: build passa.

- [ ] **Step 3: Commit**

```bash
git add apps/backend/src/modules/recycling/sales/sale.entity.ts
git commit -m "feat(sales): add paymentMethod field to SaleEntity"
```

---

## Task 4: `CreateSaleDto` exige `paymentMethod` válido

**Files:**
- Modify: `apps/backend/src/modules/recycling/sales/dto/create-sale.dto.ts`

- [ ] **Step 1: Escrever teste falhando**

Criar arquivo de teste `apps/backend/src/modules/recycling/sales/dto/create-sale.dto.spec.ts`:

```ts
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { PaymentMethod } from '@praktikus/shared';
import { CreateSaleDto } from './create-sale.dto';

describe('CreateSaleDto', () => {
  const validBase = {
    buyerId: '00000000-0000-0000-0000-000000000001',
    items: [{ productId: '00000000-0000-0000-0000-000000000002', quantity: 1, unitPrice: 1 }],
  };

  it('rejects payload without paymentMethod', async () => {
    const dto = plainToInstance(CreateSaleDto, { ...validBase });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'paymentMethod')).toBe(true);
  });

  it('rejects paymentMethod not in enum', async () => {
    const dto = plainToInstance(CreateSaleDto, { ...validBase, paymentMethod: 'BITCOIN' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'paymentMethod')).toBe(true);
  });

  it('accepts each PaymentMethod value', async () => {
    for (const m of Object.values(PaymentMethod)) {
      const dto = plainToInstance(CreateSaleDto, { ...validBase, paymentMethod: m });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'paymentMethod')).toBe(false);
    }
  });
});
```

- [ ] **Step 2: Rodar — espera-se falha**

Run: `pnpm --filter backend test create-sale.dto`
Expected: 3 testes falhando com erro tipo "property paymentMethod does not exist on CreateSaleDto" (TypeScript) ou validação não acionando.

- [ ] **Step 3: Implementar campo no DTO**

Substituir o conteúdo de `apps/backend/src/modules/recycling/sales/dto/create-sale.dto.ts` por:

```ts
import { IsArray, ArrayMinSize, IsEnum, IsOptional, IsPositive, IsNumber, IsString, IsUUID, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentMethod } from '@praktikus/shared';

export class SaleItemDto {
  @IsUUID() productId: string;
  @IsNumber({ maxDecimalPlaces: 4 }) @IsPositive() quantity: number;
  @IsNumber({ maxDecimalPlaces: 4 }) @IsPositive() unitPrice: number;
}

export class CreateSaleDto {
  @IsUUID() buyerId: string;
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => SaleItemDto) items: SaleItemDto[];
  @IsEnum(PaymentMethod) paymentMethod: PaymentMethod;
  @IsOptional() @IsString() notes?: string;
}
```

- [ ] **Step 4: Rodar — espera-se passar**

Run: `pnpm --filter backend test create-sale.dto`
Expected: 3 testes verdes.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/recycling/sales/dto/create-sale.dto.ts apps/backend/src/modules/recycling/sales/dto/create-sale.dto.spec.ts
git commit -m "feat(sales): require paymentMethod in CreateSaleDto"
```

---

## Task 5: Bloquear venda à vista quando caixa está fechado

**Files:**
- Modify: `apps/backend/src/modules/recycling/sales/sales.service.spec.ts`
- Modify: `apps/backend/src/modules/recycling/sales/sales.service.ts`

> **Contexto importante:** o teste atual `'should NOT create any cash_transaction'` (linhas 140–163 do spec) descreve o comportamento errado e será substituído nos próximos passos. Esta task introduz a primeira regra nova: rejeitar venda à vista sem cash_session aberta.

- [ ] **Step 1: Estender o mock para cobrir CashSessionEntity**

No topo de `sales.service.spec.ts`, logo abaixo de `const mockMovementRepo`, adicionar:

```ts
const mockCashSessionRepo = { findOne: jest.fn() };
const mockCashTxRepo = { create: jest.fn(), save: jest.fn() };
```

E substituir o bloco `mockQueryRunner.manager.getRepository.mockImplementation` em `beforeEach` por:

```ts
mockQueryRunner.manager.getRepository.mockImplementation((entity: { name?: string }) => {
  if (entity === SaleEntity) return mockSaleRepo;
  if (entity === SaleItemEntity) return mockItemRepo;
  if (entity?.name === 'CashSessionEntity') return mockCashSessionRepo;
  if (entity?.name === 'CashTransactionEntity') return mockCashTxRepo;
  return mockMovementRepo;
});
```

E adicionar imports no topo do arquivo:

```ts
import { CashSessionEntity } from '../cash-register/cash-session.entity';
import { CashTransactionEntity } from '../cash-register/cash-transaction.entity';
import { PaymentMethod } from '@praktikus/shared';
```

- [ ] **Step 2: Adicionar teste falhando — venda à vista sem caixa**

Dentro do `describe('create', () => { ... })`, adicionar este teste **antes** do teste atual `'should create sale with stock OUT movements when stock is sufficient'`:

```ts
it('should reject CASH sale when no open cash session', async () => {
  mockQueryRunner.query.mockImplementation(async (sql: string) => {
    if (sql.includes('SET LOCAL')) return undefined;
    if (sql.includes('stock_movements')) return [{ balance: '50.0000' }];
    return undefined;
  });
  mockCashSessionRepo.findOne.mockResolvedValue(null);

  await expect(
    service.create(TENANT, OPERATOR, {
      buyerId: 'b1',
      paymentMethod: PaymentMethod.CASH,
      items: [{ productId: 'p1', quantity: 1, unitPrice: 1 }],
    })
  ).rejects.toThrow(/caixa.*aberta/i);
});

it('should accept ON_CREDIT sale even without open cash session', async () => {
  mockQueryRunner.query.mockImplementation(async (sql: string) => {
    if (sql.includes('SET LOCAL')) return undefined;
    if (sql.includes('stock_movements')) return [{ balance: '50.0000' }];
    return undefined;
  });
  mockCashSessionRepo.findOne.mockResolvedValue(null);
  mockSaleRepo.create.mockReturnValue({ id: 'sale1' });
  mockSaleRepo.save.mockResolvedValue({ id: 'sale1' });
  mockItemRepo.create.mockReturnValue({});
  mockItemRepo.save.mockResolvedValue({});
  mockMovementRepo.create.mockReturnValue({});
  mockMovementRepo.save.mockResolvedValue({});

  await expect(
    service.create(TENANT, OPERATOR, {
      buyerId: 'b1',
      paymentMethod: PaymentMethod.ON_CREDIT,
      items: [{ productId: 'p1', quantity: 1, unitPrice: 1 }],
    })
  ).resolves.toEqual({ id: 'sale1' });
});
```

Atualizar também os 3 testes pré-existentes em `describe('create')` (`should throw on invalid tenantId`, `should throw BadRequestException when stock is insufficient`, `should create sale with stock OUT movements when stock is sufficient`) para incluir `paymentMethod: PaymentMethod.CASH` no payload — sem isso eles falharão por validação ausente. Para o teste `'should create sale with stock OUT movements when stock is sufficient'`, também adicionar `mockCashSessionRepo.findOne.mockResolvedValue({ id: 'session1' })` no setup do teste para representar caixa aberto.

- [ ] **Step 3: Rodar — espera-se falha nos testes novos**

Run: `pnpm --filter backend test sales.service`
Expected: 2 testes novos vermelhos com algo do tipo "expected throw" ou "no findOne registered".

- [ ] **Step 4: Implementar a regra**

Em `apps/backend/src/modules/recycling/sales/sales.service.ts`:

(a) Adicionar imports no topo, junto aos existentes:

```ts
import { CashSessionEntity } from '../cash-register/cash-session.entity';
import { CashSessionStatus, PaymentMethod } from '@praktikus/shared';
```

(b) Substituir o método `create` por:

```ts
async create(tenantId: string, operatorId: string, dto: CreateSaleDto): Promise<SaleEntity> {
  const schemaName = this.getSchemaName(tenantId);
  return this.withSchema(tenantId, async (manager, qr) => {
    const saleRepo = manager.getRepository(SaleEntity);
    const itemRepo = manager.getRepository(SaleItemEntity);
    const movementRepo = manager.getRepository(StockMovementEntity);
    const sessionRepo = manager.getRepository(CashSessionEntity);

    const isPaidUpfront = dto.paymentMethod !== PaymentMethod.ON_CREDIT;

    // 1. Validar estoque por item
    for (const item of dto.items) {
      const [{ balance }] = await qr.query(
        `SELECT COALESCE(
          SUM(CASE WHEN type = 'IN' THEN quantity ELSE -quantity END), 0
        ) as balance
        FROM "${schemaName}".stock_movements
        WHERE product_id = $1`,
        [item.productId],
      );
      const available = Number(balance);
      if (available < item.quantity) {
        throw new BadRequestException(
          `Estoque insuficiente para o produto ${item.productId}. Disponível: ${available}, Solicitado: ${item.quantity}`,
        );
      }
    }

    // 2. Para vendas à vista, exigir caixa aberto
    let openSession: CashSessionEntity | null = null;
    if (isPaidUpfront) {
      openSession = await sessionRepo.findOne({ where: { status: CashSessionStatus.OPEN } });
      if (!openSession) {
        throw new BadRequestException('Não há sessão de caixa aberta. Abra o caixa antes de registrar uma venda à vista.');
      }
    }

    // 3. Criar venda
    const sale = saleRepo.create({
      buyerId: dto.buyerId,
      operatorId,
      soldAt: new Date(),
      paymentMethod: dto.paymentMethod,
      notes: dto.notes ?? null,
    });
    const savedSale = await saleRepo.save(sale);

    // 4. Itens + stock_movements (OUT)
    for (const item of dto.items) {
      const subtotal = Math.round(item.quantity * item.unitPrice * 100) / 100;
      await itemRepo.save(
        itemRepo.create({
          saleId: savedSale.id,
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          subtotal,
        }),
      );
      await movementRepo.save(
        movementRepo.create({
          productId: item.productId,
          type: MovementType.OUT,
          quantity: item.quantity,
          referenceId: savedSale.id,
          referenceType: 'SALE',
          movedAt: new Date(),
        }),
      );
    }

    return savedSale;
  });
}
```

> Nota: a criação da `cash_transaction` será adicionada em **Task 6**. Esta task só introduz a verificação de caixa aberto.

- [ ] **Step 5: Rodar — espera-se passar**

Run: `pnpm --filter backend test sales.service`
Expected: todos os testes do `describe('create')` verdes (incluindo os 2 novos e os 3 atualizados).

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/modules/recycling/sales/sales.service.ts apps/backend/src/modules/recycling/sales/sales.service.spec.ts
git commit -m "feat(sales): require open cash session for upfront-paid sales"
```

---

## Task 6: Vendas à vista criam `cash_transaction` atomicamente

**Files:**
- Modify: `apps/backend/src/modules/recycling/sales/sales.service.spec.ts`
- Modify: `apps/backend/src/modules/recycling/sales/sales.service.ts`

- [ ] **Step 1: Substituir o teste antigo "should NOT create any cash_transaction"**

No `sales.service.spec.ts`, **remover** o teste atual `'should NOT create any cash_transaction'` (linhas 140–163) e adicionar **três** novos testes em seu lugar, dentro do mesmo `describe('create')`:

```ts
it('should create cash_transaction IN with sale total for CASH payment', async () => {
  mockQueryRunner.query.mockImplementation(async (sql: string) => {
    if (sql.includes('SET LOCAL')) return undefined;
    if (sql.includes('stock_movements')) return [{ balance: '50.0000' }];
    return undefined;
  });
  mockCashSessionRepo.findOne.mockResolvedValue({ id: 'session1' });

  const sale = { id: 'sale1' };
  mockSaleRepo.create.mockReturnValue(sale);
  mockSaleRepo.save.mockResolvedValue(sale);
  mockItemRepo.create.mockReturnValue({});
  mockItemRepo.save.mockResolvedValue({});
  mockMovementRepo.create.mockReturnValue({});
  mockMovementRepo.save.mockResolvedValue({});
  mockCashTxRepo.create.mockImplementation((x) => x);
  mockCashTxRepo.save.mockResolvedValue({});

  await service.create(TENANT, OPERATOR, {
    buyerId: 'b1',
    paymentMethod: PaymentMethod.CASH,
    items: [
      { productId: 'p1', quantity: 10, unitPrice: 5 }, // 50
      { productId: 'p2', quantity: 4, unitPrice: 2.5 }, // 10
    ],
  });

  expect(mockCashTxRepo.create).toHaveBeenCalledTimes(1);
  expect(mockCashTxRepo.create).toHaveBeenCalledWith(
    expect.objectContaining({
      cashSessionId: 'session1',
      type: 'IN',
      paymentMethod: PaymentMethod.CASH,
      amount: 60,
      referenceId: 'sale1',
      referenceType: 'SALE',
    }),
  );
});

it('should NOT create cash_transaction for ON_CREDIT sale', async () => {
  mockQueryRunner.query.mockImplementation(async (sql: string) => {
    if (sql.includes('SET LOCAL')) return undefined;
    if (sql.includes('stock_movements')) return [{ balance: '50.0000' }];
    return undefined;
  });
  mockCashSessionRepo.findOne.mockResolvedValue(null);
  mockSaleRepo.create.mockReturnValue({ id: 'sale2' });
  mockSaleRepo.save.mockResolvedValue({ id: 'sale2' });
  mockItemRepo.create.mockReturnValue({});
  mockItemRepo.save.mockResolvedValue({});
  mockMovementRepo.create.mockReturnValue({});
  mockMovementRepo.save.mockResolvedValue({});

  await service.create(TENANT, OPERATOR, {
    buyerId: 'b1',
    paymentMethod: PaymentMethod.ON_CREDIT,
    items: [{ productId: 'p1', quantity: 1, unitPrice: 1 }],
  });

  expect(mockCashTxRepo.create).not.toHaveBeenCalled();
  expect(mockCashTxRepo.save).not.toHaveBeenCalled();
});

it('should rollback the entire transaction if cash_transaction save fails', async () => {
  mockQueryRunner.query.mockImplementation(async (sql: string) => {
    if (sql.includes('SET LOCAL')) return undefined;
    if (sql.includes('stock_movements')) return [{ balance: '50.0000' }];
    return undefined;
  });
  mockCashSessionRepo.findOne.mockResolvedValue({ id: 'session1' });
  mockSaleRepo.create.mockReturnValue({ id: 'sale3' });
  mockSaleRepo.save.mockResolvedValue({ id: 'sale3' });
  mockItemRepo.create.mockReturnValue({});
  mockItemRepo.save.mockResolvedValue({});
  mockMovementRepo.create.mockReturnValue({});
  mockMovementRepo.save.mockResolvedValue({});
  mockCashTxRepo.create.mockImplementation((x) => x);
  mockCashTxRepo.save.mockRejectedValue(new Error('db down'));

  await expect(
    service.create(TENANT, OPERATOR, {
      buyerId: 'b1',
      paymentMethod: PaymentMethod.CASH,
      items: [{ productId: 'p1', quantity: 1, unitPrice: 1 }],
    }),
  ).rejects.toThrow('db down');

  expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
  expect(mockQueryRunner.commitTransaction).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Rodar — espera-se falha**

Run: `pnpm --filter backend test sales.service`
Expected: os 3 testes novos falham (cash_tx não é chamado).

- [ ] **Step 3: Implementar criação de cash_transaction no service**

Em `sales.service.ts`, adicionar import:

```ts
import { CashTransactionEntity } from '../cash-register/cash-transaction.entity';
import { TransactionType } from '@praktikus/shared';
```

(`CashSessionEntity`, `CashSessionStatus`, `PaymentMethod` já foram importados na Task 5.)

Substituir o final do método `create` (a partir do `// 4. Itens + stock_movements (OUT)`) pelo bloco abaixo, mantendo o bloco superior intacto:

```ts
    // 4. Itens + stock_movements (OUT) — calcular total no caminho
    let totalAmount = 0;
    for (const item of dto.items) {
      const subtotal = Math.round(item.quantity * item.unitPrice * 100) / 100;
      totalAmount += subtotal;
      await itemRepo.save(
        itemRepo.create({
          saleId: savedSale.id,
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          subtotal,
        }),
      );
      await movementRepo.save(
        movementRepo.create({
          productId: item.productId,
          type: MovementType.OUT,
          quantity: item.quantity,
          referenceId: savedSale.id,
          referenceType: 'SALE',
          movedAt: new Date(),
        }),
      );
    }

    // 5. Vendas pagas à vista geram cash_transaction IN
    if (isPaidUpfront && openSession) {
      const txRepo = manager.getRepository(CashTransactionEntity);
      const tx = txRepo.create({
        cashSessionId: openSession.id,
        type: TransactionType.IN,
        paymentMethod: dto.paymentMethod,
        amount: Math.round(totalAmount * 100) / 100,
        description: null,
        referenceId: savedSale.id,
        referenceType: 'SALE',
      });
      await txRepo.save(tx);
    }

    return savedSale;
  });
}
```

- [ ] **Step 4: Rodar — espera-se passar**

Run: `pnpm --filter backend test sales.service`
Expected: todos os testes verdes — incluindo os 3 novos e os atualizados da Task 5.

- [ ] **Step 5: Lint**

Run: `pnpm --filter backend lint`
Expected: passa sem erros.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/modules/recycling/sales/sales.service.ts apps/backend/src/modules/recycling/sales/sales.service.spec.ts
git commit -m "feat(sales): create cash_transaction for upfront-paid sales"
```

---

## Task 7: Frontend service — propagar `paymentMethod` no payload

**Files:**
- Modify: `apps/frontend/src/services/recycling/sales.service.ts`

- [ ] **Step 1: Atualizar tipos**

Adicionar import no topo do arquivo:

```ts
import { PaymentMethod } from '@praktikus/shared';
```

Substituir a interface `CreateSalePayload` (linhas 54–58) por:

```ts
export interface CreateSalePayload {
  buyerId: string;
  items: SaleItemPayload[];
  paymentMethod: PaymentMethod;
  notes?: string;
}
```

> O método `create` já passa `payload` direto para `api.post`, então não precisa mudar — só o tipo.

- [ ] **Step 2: Build do frontend**

Run: `pnpm --filter frontend build`
Expected: build pode falhar por consumidores antigos do `CreateSalePayload`. Esse erro é esperado e será resolvido na Task 8. Confirme que a única falha é no `NewSalePage.tsx`.

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/services/recycling/sales.service.ts
git commit -m "feat(sales): require paymentMethod in CreateSalePayload"
```

---

## Task 8: Frontend — campo "Forma de pagamento" no formulário de venda

**Files:**
- Modify: `apps/frontend/src/pages/recycling/sales/NewSalePage.tsx`

- [ ] **Step 1: Atualizar imports**

No topo do arquivo (junto aos imports existentes), adicionar:

```ts
import { PaymentMethod } from '@praktikus/shared';
```

- [ ] **Step 2: Atualizar o schema zod**

Substituir o bloco `const schema = z.object({ ... })` por:

```ts
const schema = z.object({
  buyerId: z.string().uuid('Selecione um comprador'),
  items: z.array(itemSchema).min(1, 'Adicione ao menos um item'),
  paymentMethod: z.nativeEnum(PaymentMethod, {
    errorMap: () => ({ message: 'Selecione a forma de pagamento' }),
  }),
  notes: z.string().optional(),
});
```

- [ ] **Step 3: Atualizar `defaultValues`**

No `useForm` (procurar `defaultValues: {`), substituir o bloco por:

```ts
defaultValues: {
  buyerId: '',
  items: [{ productId: '', quantity: 1, unitPrice: 0 }],
  paymentMethod: PaymentMethod.CASH,
  notes: '',
},
```

- [ ] **Step 4: Adicionar select no card "Dados da venda"**

Localizar o `<Card header={<CardTitle title="Dados da venda" .../>}` (procurar `Dados da venda`). Dentro dele, **antes** do bloco `<div style={{ marginTop: 14 }}> ... Observações ... </div>`, inserir:

```tsx
<div style={{ marginTop: 14 }}>
  <CFormLabel style={labelStyle}>Forma de pagamento *</CFormLabel>
  <CFormSelect {...register('paymentMethod')} invalid={!!errors.paymentMethod}>
    <option value={PaymentMethod.CASH}>Dinheiro</option>
    <option value={PaymentMethod.PIX}>PIX</option>
    <option value={PaymentMethod.CARD}>Cartão</option>
    <option value={PaymentMethod.ON_CREDIT}>A prazo (sem caixa)</option>
  </CFormSelect>
  {errors.paymentMethod && (
    <CFormFeedback invalid>{errors.paymentMethod.message}</CFormFeedback>
  )}
</div>
```

- [ ] **Step 5: Atualizar `onSubmit`**

Substituir o bloco `const created = await salesService.create({ ... })` por:

```tsx
const created = await salesService.create({
  buyerId: data.buyerId,
  items: data.items.map((item) => ({
    productId: item.productId,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
  })),
  paymentMethod: data.paymentMethod,
  notes: data.notes || undefined,
});
```

- [ ] **Step 6: Verificar manualmente no dev server**

Run (separado, em outro terminal):

```bash
pnpm dev
```

Abra `http://localhost:5173/recycling/sales/new`. Verifique:
- Select aparece com 4 opções, default "Dinheiro".
- Submit envia `paymentMethod` no payload (DevTools → Network).

Expected: nada quebra; build do frontend (`pnpm --filter frontend build`) passa.

- [ ] **Step 7: Lint**

Run: `pnpm --filter frontend lint`
Expected: passa.

- [ ] **Step 8: Commit**

```bash
git add apps/frontend/src/pages/recycling/sales/NewSalePage.tsx
git commit -m "feat(sales): add payment method select to new sale form"
```

---

## Task 9: Frontend — CTA "Abrir caixa" quando venda à vista falha por caixa fechado

**Files:**
- Modify: `apps/frontend/src/pages/recycling/sales/NewSalePage.tsx`

- [ ] **Step 1: Detectar erro específico**

Substituir o bloco `catch (err: unknown) { ... }` dentro de `onSubmit` por:

```tsx
} catch (err: unknown) {
  const anyErr = err as { response?: { status?: number; data?: { message?: string | string[] } } };
  const raw = anyErr?.response?.data?.message;
  const msg = Array.isArray(raw) ? raw.join(', ') : (raw ?? 'Erro ao registrar venda.');
  setSubmitError(msg);
  setCashClosedError(/sess[ãa]o de caixa aberta/i.test(msg));
}
```

E acima de `const onSubmit`, adicionar o novo state:

```tsx
const [cashClosedError, setCashClosedError] = useState(false);
```

- [ ] **Step 2: Substituir o `<CAlert>` de erro por uma versão com CTA**

Localizar o bloco `{(loadError || submitError) && (<CAlert color="danger" .../>)}` e substituir por:

```tsx
{(loadError || submitError) && (
  <CAlert color="danger" className="mb-0" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
    <span>{loadError ?? submitError}</span>
    {cashClosedError && (
      <CButton
        color="danger"
        variant="outline"
        size="sm"
        onClick={() => navigate('/recycling/cash-register')}
      >
        Abrir caixa
      </CButton>
    )}
  </CAlert>
)}
```

- [ ] **Step 3: Verificar manualmente**

Run: `pnpm dev`
Cenário 1 (caixa aberto): registrar venda à vista deve funcionar e ir pro modal de impressão.
Cenário 2 (caixa fechado): fechar caixa em outra aba; tentar registrar venda à vista; alerta vermelho deve mostrar mensagem em pt-BR + botão "Abrir caixa" que navega para `/recycling/cash-register`.
Cenário 3 (a prazo): com caixa fechado, escolher "A prazo (sem caixa)" e submeter — deve passar.

- [ ] **Step 4: Lint**

Run: `pnpm --filter frontend lint`
Expected: passa.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/pages/recycling/sales/NewSalePage.tsx
git commit -m "feat(sales): inline 'Abrir caixa' CTA when cash session is closed"
```

---

## Task 10: Re-validação E2E — rodar J9 → J14 do roteiro do plugin

**Files:** N/A — execução manual.

- [ ] **Step 1: Subir staging com a feature**

Garantir que todas as migrations rodaram, frontend foi buildado, backend está no ar.

- [ ] **Step 2: Rodar parcial do roteiro**

Reabrir [docs/superpowers/specs/2026-04-28-recycling-e2e-test-script-design.md](../specs/2026-04-28-recycling-e2e-test-script-design.md) no plugin do Claude no Chrome e instruir:

> "Execute apenas Jornadas 9 a 14 do roteiro abaixo, num tenant novo (signup rápido permitido). No relatório final, foque em validar a tabela 3.3 (Caixa) e a tabela 3.2 (Estoque pós-venda)."

- [ ] **Step 3: Conferir resultado**

Cross-check esperado (após registrar a mesma sequência do roteiro original — compra Al 100kg + Cu 30kg, venda Al 40kg à vista):

| Movimento | Esperado |
|---|---|
| Saída do caixa (compra) | R$ 1.410,00 |
| Entrada do caixa (venda 40kg Al @ R$ 9,80) | R$ 392,00 |
| Saldo do dia | -R$ 1.018,00 |

Se o resultado bater, GAP-01 está resolvido. Se não, abrir issue com diff entre esperado e observado.

- [ ] **Step 4: Atualizar relatório E2E original**

Em `docs/qa/reports/2026-04-28-recycling-e2e-report.md`, adicionar nota no GAP-01 marcando como **Resolvido em <PR>** e referenciando a re-validação.

```bash
git add docs/qa/reports/2026-04-28-recycling-e2e-report.md
git commit -m "docs(qa): mark GAP-01 as resolved after re-validation"
```

---

## Self-Review Checklist (executado pelo autor do plano)

- [x] **Spec coverage:** Cobre os 5 itens do escopo do brief: campo paymentMethod (T4/T7/T8), criação de cash_tx em mesma transação (T6), caixa fechado → erro claro (T5/T9), testes (T4/T5/T6), decisão de produto sobre "a prazo" (Task 1 + decisão na intro).
- [x] **Sem placeholders:** Toda ação tem código completo. Nada de "implementar X" sem mostrar como.
- [x] **Type consistency:** `paymentMethod`, `PaymentMethod`, `CashSessionEntity`, `CashTransactionEntity`, `TransactionType.IN`, `MovementType.OUT`, `referenceType: 'SALE'` consistentes em todas as tasks.
- [x] **Frequent commits:** 9 commits ao longo do plano (1 por task funcional, mais um final de docs).
- [x] **TDD:** Tasks 4, 5, 6 escrevem teste falhando primeiro, depois implementam, depois validam verde.
- [x] **CLAUDE.md:** Lógica fica no service; DTOs validados via class-validator; migration TypeORM (sem `synchronize`); tenantId vem do controller (já está); frontend usa react-hook-form + zod; sem useState para campos de form (paymentMethod via register).

---

**Plano salvo em `docs/superpowers/plans/2026-04-28-sales-cash-transaction.md`.**
