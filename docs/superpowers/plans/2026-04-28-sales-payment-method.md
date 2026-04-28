# Forma de Pagamento em Vendas (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Toda venda no segmento Reciclagem passa a registrar uma forma de pagamento (Dinheiro / PIX / Cartão / A prazo). O dado é persistido para histórico e relatórios. **A venda não interage com o caixa** — caixa é fluxo independente, com lançamentos manuais pelo operador.

**Architecture:**
- Adiciona valor `ON_CREDIT` ao enum compartilhado `PaymentMethod` (já feito em `b4e0f2c`).
- Adiciona coluna `payment_method` em `sales` (em todos os schemas RECYCLING).
- `SaleEntity`, `CreateSaleDto` e o payload do frontend ganham o campo. Form de venda mostra um select obrigatório.
- **Não** há criação de `cash_transaction`, **não** há validação de caixa aberto, **não** há CTA "Abrir caixa". O motivo: caixa é fluxo separado por decisão de produto (2026-04-28).

**Tech Stack:** NestJS + TypeORM (schema-per-tenant) · React 19 + react-hook-form + zod · CoreUI · Jest (`*.spec.ts`).

**Histórico do escopo:** este plano substitui uma versão anterior que automatizava lançamentos de caixa a partir de vendas. Após análise do modelo de negócio (caixa independente), o escopo foi reduzido para apenas registro do meio de pagamento. Ver nota em `docs/qa/reports/2026-04-28-recycling-e2e-report.md` (GAP-01).

---

## File Structure

**Backend — modificações:**
- `apps/backend/src/database/migrations/1748000000000-AddPaymentMethodToSales.ts` — **criar**.
- `apps/backend/src/modules/recycling/sales/sale.entity.ts` — adicionar coluna `paymentMethod`.
- `apps/backend/src/modules/recycling/sales/dto/create-sale.dto.ts` — adicionar campo `paymentMethod` validado.
- `apps/backend/src/modules/recycling/sales/sales.service.ts` — propagar `paymentMethod` no `create`. Sem nova lógica de caixa.
- `apps/backend/src/modules/recycling/sales/sales.service.spec.ts` — atualizar payloads de teste para incluir `paymentMethod` e adicionar 1-2 testes que verificam persistência.
- `apps/backend/src/modules/recycling/sales/dto/create-sale.dto.spec.ts` — **criar** (testes do DTO).

**Frontend — modificações:**
- `apps/frontend/src/services/recycling/sales.service.ts` — adicionar `paymentMethod` em `CreateSalePayload`.
- `apps/frontend/src/pages/recycling/sales/NewSalePage.tsx` — schema zod + select de forma de pagamento.

**Sem novas dependências.**

---

## Convenções (não esqueça)

1. Commit por task com mensagem `tipo(escopo): descrição` (ex: `feat(sales): persist payment method`).
2. Backend: rodar `pnpm --filter backend lint && pnpm --filter backend test sales` antes de cada commit.
3. Frontend: rodar `pnpm --filter frontend lint` antes do commit.
4. Migration: nunca usar `synchronize: true`. Sempre testar `up`/`down` localmente.
5. **TenantId vem do controller via `req.user.tenantId`** — já está correto em `sales.controller.ts:39`. Não tocar.

---

## Task 1: ✅ Já concluída — `ON_CREDIT` no enum `PaymentMethod`

Commit: `b4e0f2c8aa2c2098855f07bf23e9a461f0e4aae4` (`feat(shared): add ON_CREDIT to PaymentMethod enum`).

Nada a fazer aqui.

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
      // já foram registradas como dinheiro à vista; nenhum efeito retroativo no caixa
      // — esta migration só preenche a coluna).
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
Expected: log mostra `AddPaymentMethodToSales1748000000000` aplicada com sucesso.

Confirmar com:

```bash
docker exec -i $(docker ps --filter "name=postgres" --format "{{.Names}}" | head -1) psql -U postgres -d praktikus -c "SELECT table_schema, column_name, is_nullable FROM information_schema.columns WHERE column_name = 'payment_method' AND table_schema LIKE 'tenant_%';"
```

Expected: linhas mostrando `payment_method | varchar | NO` para cada schema RECYCLING. Se não há tenants RECYCLING ainda, a migration roda mas o loop é vazio — registre isso no relatório.

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

## Task 4: `CreateSaleDto` exige `paymentMethod` válido (TDD)

**Files:**
- Create: `apps/backend/src/modules/recycling/sales/dto/create-sale.dto.spec.ts`
- Modify: `apps/backend/src/modules/recycling/sales/dto/create-sale.dto.ts`

- [ ] **Step 1: Escrever teste falhando**

Criar `apps/backend/src/modules/recycling/sales/dto/create-sale.dto.spec.ts`:

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
Expected: 3 testes falhando (validação ainda não exige `paymentMethod`).

- [ ] **Step 3: Implementar**

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

## Task 5: `SalesService.create` persiste `paymentMethod` (TDD)

**Files:**
- Modify: `apps/backend/src/modules/recycling/sales/sales.service.spec.ts`
- Modify: `apps/backend/src/modules/recycling/sales/sales.service.ts`

> **Importante:** o teste atual `'should NOT create any cash_transaction'` (linhas 140–163 do spec) descreve um comportamento que continua válido (vendas não tocam o caixa). Mantenha o teste — ele agora documenta a decisão de produto, não um bug. Apenas atualize o payload para incluir `paymentMethod`.

- [ ] **Step 1: Atualizar testes existentes para incluir `paymentMethod` no payload**

Em `sales.service.spec.ts`, adicionar import:

```ts
import { PaymentMethod } from '@praktikus/shared';
```

Adicionar `paymentMethod: PaymentMethod.CASH` ao payload de cada `service.create(...)` em todos os testes do `describe('create')`. Por exemplo, o teste `'should throw on invalid tenantId'` passa a ser:

```ts
it('should throw on invalid tenantId', async () => {
  await expect(
    service.create('bad-id', OPERATOR, {
      buyerId: 'b1',
      paymentMethod: PaymentMethod.CASH,
      items: [{ productId: 'p1', quantity: 1, unitPrice: 1 }],
    })
  ).rejects.toThrow('Invalid tenantId');
});
```

Aplicar a mesma adição (`paymentMethod: PaymentMethod.CASH`) nos demais testes de `describe('create')`: `'should throw BadRequestException when stock is insufficient'`, `'should create sale with stock OUT movements when stock is sufficient'`, `'should NOT create any cash_transaction'`.

- [ ] **Step 2: Adicionar teste novo — paymentMethod é persistido**

Dentro do mesmo `describe('create')`, adicionar:

```ts
it('should persist paymentMethod on sale entity', async () => {
  mockQueryRunner.query.mockImplementation(async (sql: string) => {
    if (sql.includes('SET LOCAL')) return undefined;
    if (sql.includes('stock_movements')) return [{ balance: '50.0000' }];
    return undefined;
  });

  const sale = { id: 'sale1' };
  mockSaleRepo.create.mockReturnValue(sale);
  mockSaleRepo.save.mockResolvedValue(sale);
  mockItemRepo.create.mockReturnValue({});
  mockItemRepo.save.mockResolvedValue({});
  mockMovementRepo.create.mockReturnValue({});
  mockMovementRepo.save.mockResolvedValue({});

  await service.create(TENANT, OPERATOR, {
    buyerId: 'b1',
    paymentMethod: PaymentMethod.PIX,
    items: [{ productId: 'p1', quantity: 1, unitPrice: 1 }],
  });

  expect(mockSaleRepo.create).toHaveBeenCalledWith(
    expect.objectContaining({ paymentMethod: PaymentMethod.PIX }),
  );
});
```

- [ ] **Step 3: Rodar — espera-se que o teste novo falhe**

Run: `pnpm --filter backend test sales.service`
Expected: o teste novo `'should persist paymentMethod on sale entity'` falha (service ainda não passa o campo). Os demais devem passar (já que só adicionaram um campo no payload, sem mudar comportamento esperado).

- [ ] **Step 4: Implementar persistência no service**

Em `sales.service.ts`, no método `create` (procurar `// 2. Create sale` no código atual — linhas 145-152), substituir o bloco que cria a sale por:

```ts
// 2. Create sale
const sale = saleRepo.create({
  buyerId: dto.buyerId,
  operatorId,
  soldAt: new Date(),
  paymentMethod: dto.paymentMethod,
  notes: dto.notes ?? null,
});
const savedSale = await saleRepo.save(sale);
```

- [ ] **Step 5: Rodar — espera-se passar**

Run: `pnpm --filter backend test sales.service`
Expected: todos os testes verdes.

- [ ] **Step 6: Lint**

Run: `pnpm --filter backend lint`
Expected: passa.

- [ ] **Step 7: Commit**

```bash
git add apps/backend/src/modules/recycling/sales/sales.service.ts apps/backend/src/modules/recycling/sales/sales.service.spec.ts
git commit -m "feat(sales): persist paymentMethod on sale creation"
```

---

## Task 6: Frontend service — `paymentMethod` em `CreateSalePayload`

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

> O método `create` já passa `payload` direto pra `api.post`, então não muda. Só o tipo.

- [ ] **Step 2: Build do frontend**

Run: `pnpm --filter frontend build`
Expected: build pode falhar por consumidores antigos do `CreateSalePayload`. Esse erro é esperado e será resolvido na Task 7. Confirme que a única falha é em `NewSalePage.tsx`.

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/services/recycling/sales.service.ts
git commit -m "feat(sales): require paymentMethod in CreateSalePayload"
```

---

## Task 7: Frontend — campo "Forma de pagamento" no formulário

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
    <option value={PaymentMethod.ON_CREDIT}>A prazo</option>
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

- [ ] **Step 6: Build + verificação manual**

Run: `pnpm --filter frontend build`
Expected: passa.

Em outro terminal: `pnpm dev`. Abrir `http://localhost:5173/recycling/sales/new`. Verificar:
- Select "Forma de pagamento" aparece com 4 opções, default "Dinheiro".
- Submit envia `paymentMethod` no payload (DevTools → Network → request body).
- Submit sem alterar nada deve registrar a venda com `paymentMethod=CASH`.

- [ ] **Step 7: Lint**

Run: `pnpm --filter frontend lint`
Expected: passa.

- [ ] **Step 8: Commit**

```bash
git add apps/frontend/src/pages/recycling/sales/NewSalePage.tsx
git commit -m "feat(sales): add payment method select to new sale form"
```

---

## Task 8: Re-validação E2E — rodar Jornadas 9 e 12 do roteiro

**Files:** N/A — execução manual.

- [ ] **Step 1: Subir staging com a feature**

Garantir que migration rodou, frontend foi buildado, backend está no ar.

- [ ] **Step 2: Rodar parcial do roteiro**

Reabrir [docs/superpowers/specs/2026-04-28-recycling-e2e-test-script-design.md](../specs/2026-04-28-recycling-e2e-test-script-design.md) no plugin do Claude no Chrome e instruir:

> "Execute apenas Jornadas 9 e 12 do roteiro num tenant novo. Foque em validar que o select 'Forma de pagamento' aparece no form de venda, que o valor é persistido, e que **nenhum movimento de caixa é criado automaticamente** (essa é a expectativa correta — caixa é fluxo separado)."

- [ ] **Step 3: Conferir resultado esperado**

| Item | Esperado |
|---|---|
| Form de venda mostra select "Forma de pagamento" | sim, com 4 opções |
| Valor selecionado é persistido | sim (visível no detalhe da venda ou via DB) |
| Caixa NÃO ganhou entrada automática | correto — confirmar saldo do dia inalterado após a venda |

- [ ] **Step 4: Atualizar relatório E2E**

Em `docs/qa/reports/2026-04-28-recycling-e2e-report.md`, marcar GAP-01 como **Reclassificado: decisão de produto / não é bug**, e marcar a entrega de `paymentMethod` em sales como **Resolvido em <SHA>**. Commit.

```bash
git add docs/qa/reports/2026-04-28-recycling-e2e-report.md
git commit -m "docs(qa): mark GAP-01 as product decision (cash is independent flow)"
```

---

## Self-Review Checklist (executado pelo autor do plano)

- [x] **Spec coverage:** Cobre o novo escopo: `paymentMethod` em DB, entity, DTO, service, frontend service e form. **Não** cobre cash_transaction (intencional, decisão de produto).
- [x] **Sem placeholders:** Toda ação tem código completo.
- [x] **Type consistency:** `paymentMethod`, `PaymentMethod`, valores do enum (CASH/PIX/CARD/ON_CREDIT) consistentes em todas as tasks.
- [x] **Frequent commits:** 7 commits ao longo do plano (1 por task funcional + final de docs). Task 1 já está em `b4e0f2c`.
- [x] **TDD:** Tasks 4 e 5 escrevem teste falhando antes de implementar.
- [x] **CLAUDE.md:** Lógica fica no service; DTOs validados via class-validator; migration TypeORM (sem `synchronize`); tenantId vem do controller (não tocar); frontend usa react-hook-form + zod; sem useState para campos de form.

---

**Plano salvo em `docs/superpowers/plans/2026-04-28-sales-payment-method.md`.**
