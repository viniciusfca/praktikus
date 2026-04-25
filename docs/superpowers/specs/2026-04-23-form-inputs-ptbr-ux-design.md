# Correção de UX em formulários — inputs pt-BR, máscaras e hora 24h

**Data:** 2026-04-23
**Branch:** redesign/praktikus-v2
**Escopo:** frontend + backend (módulo `buyers`)

---

## Contexto

Cinco formulários da SPA apresentam problemas de UX que causam fricção para o usuário brasileiro:

1. **Novo produto** — `CFormInput type="number"` (HTML5) aceita apenas ponto como separador decimal; usuário precisa digitar `0.40` em vez de `0,40`.
2. **Nova compra** — preço unitário com `step="0.0001"` exibe quatro casas decimais (`4.0000`); precisa de duas.
3. **Novo fornecedor** — campos CPF/CNPJ e telefone sem máscara durante a digitação.
4. **Novo comprador** — só aceita CNPJ; precisa aceitar CPF também. Documento e telefone sem máscara.
5. **Nova coleta** — `CFormInput type="time"` renderiza AM/PM conforme o SO do usuário; precisa ser 24h.

O primeiro bug (separador decimal) é generalizável: qualquer campo numérico que o usuário digite um valor deve aceitar vírgula em pt-BR. O mesmo vale para máscaras de documento/telefone, que devem funcionar em qualquer formulário futuro.

## Objetivo

Resolver os 5 bugs em uma única iteração, criando componentes de input reutilizáveis que encapsulem as convenções brasileiras. Formulários futuros devem conseguir adotar as mesmas convenções sem duplicar lógica.

## Decisões de design

Todas as decisões foram validadas com o usuário durante brainstorming:

- **Componentes próprios**, sem dependência externa — seguindo o padrão já existente em `utils/masks.ts`.
- **`<CurrencyInput>` é um wrapper de `<NumericInput>`** — evita duplicação. `NumericInput` é a primitiva genérica com `decimals` configurável; `CurrencyInput` é o preset de 2 casas com prefixo `R$`.
- **2 casas decimais em todo campo monetário** — produto, compra e futuros.
- **Escopo completo do Comprador PF/PJ** — renomear `cnpj` → `document` + adicionar `documentType`, igual ao Fornecedor. Inclui migration.
- **Máscaras aplicadas durante a digitação** (não no blur) — melhor feedback visual.
- **Time input em texto puro com máscara `HH:mm`** — funciona igual em qualquer SO/navegador, sem dependência externa.

## Arquitetura

### Novos utilitários — `apps/frontend/src/utils/masks.ts`

Expande o arquivo existente (já contém `stripDigits`, `formatCnpj`, `formatPhone`).

- `formatCpf(digits: string): string` — formata `12345678901` → `123.456.789-01`. Retorna string truncada quando `digits.length < 11`.
- `formatDocument(digits: string, type: 'CPF' | 'CNPJ'): string` — delega para `formatCpf` ou `formatCnpj`.
- `parseDecimal(input: string, decimals: number): number | null` — parseia string pt-BR (vírgula decimal, ponto agrupador opcional) para `number`, respeitando `decimals`. Retorna `null` para entrada vazia ou inválida.
- `formatDecimal(value: number, decimals: number): string` — formata número para string pt-BR (`1234.5`, 2 → `"1.234,50"`). Versão input-friendly, sem símbolo.

### Novos componentes — `apps/frontend/src/components/inputs/`

Todos expostos por um `index.ts` na pasta. Cada componente em seu próprio arquivo com teste ao lado (`*.spec.tsx`).

**`<NumericInput>`** — primitiva de input numérico pt-BR.

| Prop          | Tipo                                      | Descrição |
|---------------|-------------------------------------------|-----------|
| `value`       | `number \| null`                          | Valor controlado |
| `onChange`    | `(value: number \| null) => void`         | Chamado quando o valor numérico muda |
| `decimals`    | `number`                                  | Casas decimais aceitas (default 2) |
| `prefix`      | `string \| undefined`                     | Prefixo opcional renderizado via `CInputGroup` (ex.: `R$`) |
| `min`, `max`  | `number \| undefined`                     | Limites aplicados no onBlur (trunca dentro do range) |
| `...rest`     | `Omit<CFormInputProps, 'type' \| 'value' \| 'onChange'>` | Demais props do `CFormInput` |

Comportamento:
- Estado interno guarda a string do que o usuário digita.
- Aceita dígitos, vírgula (bloqueia ponto como decimal — ignora tecla), separador de milhar é formatado automaticamente no `onBlur`.
- `onChange(null)` quando string está vazia; `onChange(parseDecimal(...))` caso contrário.
- Quando `value` recebido muda de fora (ex.: reset do form), reformata a string exibida via `formatDecimal`.
- Integra com `react-hook-form` via `Controller`.

**`<CurrencyInput>`** — preset de `<NumericInput decimals={2} prefix="R$">`. Aceita o mesmo contrato de `value: number | null`, `onChange`.

**`<DocumentInput>`**

| Prop        | Tipo                         | Descrição |
|-------------|------------------------------|-----------|
| `type`      | `'CPF' \| 'CNPJ'`            | Determina formatação e limite de dígitos |
| `value`     | `string`                     | Dígitos puros (não formatados) |
| `onChange`  | `(digits: string) => void`   | Chamado com dígitos puros |
| `...rest`   | `Omit<CFormInputProps, ...>` | Demais props |

Comportamento: formata via `formatDocument(stripDigits(input), type)`, trunca em 11 ou 14 dígitos, armazena apenas dígitos no form. Se `type` mudar em runtime e `value.length` exceder o novo limite, trunca.

**`<PhoneInput>`** — `value: string` (dígitos), `onChange: (digits: string) => void`. Usa `formatPhone`, trunca em 11 dígitos.

**`<TimeInput>`** — `value: string` (formato `HH:mm` ou string vazia), `onChange: (value: string) => void`.

Comportamento:
- Aceita apenas dígitos; insere `:` automaticamente após dois dígitos; trunca em 4 dígitos.
- Valida no `onBlur`: hora 00-23, minuto 00-59. Se inválido, dispara callback `onBlur` do form (o Zod acusa); não auto-corrige.
- Schema Zod associado: `z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Hora inválida')`.

### Integração com `react-hook-form`

Todos os componentes são usados via `<Controller>`, porque armazenam o valor em um tipo (`number`, string de dígitos, string `HH:mm`) diferente do `ChangeEvent` padrão. Padrão adotado nos 5 formulários.

## Mudanças no backend — módulo `buyers`

### Entity

Em `apps/backend/src/modules/workshop/buyers/buyer.entity.ts`:

- Remover coluna `cnpj`.
- Adicionar `document: string | null` (varchar 14, nullable).
- Adicionar `document_type: 'CPF' | 'CNPJ' | null`, com o mesmo tipo de coluna que o `Supplier.document_type` usa hoje (garantir consistência entre os dois módulos).

Hoje o `Supplier` declara `documentType: 'CPF' | 'CNPJ' | null` como string literal inline (não há enum). O `Buyer` adota o mesmo padrão para consistência. Extrair o tipo para `@praktikus/shared` fica fora de escopo desta iteração — é uma melhoria incremental que pode ser feita em follow-up sem bloquear este trabalho.

### Migration

Nova migration em `apps/backend/src/database/migrations/`:

1. Verificar pré-condição: contar `buyers WHERE cnpj IS NOT NULL AND LENGTH(cnpj) != 14`. Se > 0, falhar com mensagem clara listando os IDs.
2. `ALTER TABLE buyers RENAME COLUMN cnpj TO document`.
3. `ALTER TABLE buyers ADD COLUMN document_type VARCHAR NULL`.
4. `UPDATE buyers SET document_type = 'CNPJ' WHERE document IS NOT NULL`.

Down: reverse (rename back, drop `document_type`).

### DTOs

`CreateBuyerDto` e `UpdateBuyerDto`:

- Substituir `cnpj` por `document: string` + `documentType: 'CPF' | 'CNPJ'`.
- Usar validação equivalente ao Supplier: se `documentType === 'CPF'` exigir regex `/^\d{11}$/`; se `'CNPJ'`, `/^\d{14}$/`; se ambos ausentes, aceitar (comprador sem documento é válido).

### Service e controller

- `buyers.service.ts` — `create`, `update`, `list`, `findById` ajustados para os novos campos.
- Controller — sem mudança de assinatura além do DTO.

### Shared

Em `packages/shared/src/`: atualizar tipo `Buyer` (ou o nome que for). Substituir `cnpj` por `document` + `documentType`. Reaproveitar ou criar enum `DocumentType`.

### Testes

- Unit tests do service: adicionar caso PF (CPF 11 dígitos).
- e2e do controller: criar/atualizar comprador como PF.

## Mudanças por formulário (frontend)

### Novo produto — `ProductsPage.tsx`

- Campo `pricePerUnit`: trocar `CFormInput type="number"` por `<CurrencyInput>` via `Controller`.
- Schema: `pricePerUnit: z.number().positive().multipleOf(0.01)`.

### Nova compra — `NewPurchasePage.tsx`

- Coluna **Preço unit. (R$)**: trocar por `<CurrencyInput>` via `Controller`.
- Coluna **Qtd (kg)**: trocar por `<NumericInput decimals={3}>` via `Controller` (peso tem mais granularidade; vírgula pt-BR também).
- Schema: `unitPrice: z.number().positive().multipleOf(0.01).max(999999.99)`; `quantity: z.number().positive().multipleOf(0.001)`.
- Subtotal (`formatCurrency`) já está correto — sem mudança.

### Novo fornecedor — `SuppliersPage.tsx`

- Campo documento: `<DocumentInput type={documentType}>` via `Controller`. Quando o select `documentType` muda, o valor é truncado se exceder novo limite.
- Campo telefone: `<PhoneInput>` via `Controller`.
- Schema: inalterado (já valida dígitos puros).

### Novo comprador — `BuyersPage.tsx`

- Substituir campo único `cnpj` por par: select `documentType` (CPF/CNPJ) + `<DocumentInput>`.
- Campo telefone: `<PhoneInput>`.
- Schema: copiar estrutura `superRefine` do Fornecedor, adaptada para os nomes `document` / `documentType`.
- Função local `formatCnpj` removida; usar `formatDocument(digits, type)` de `utils/masks.ts` nas listagens.

### Nova coleta — `ColetaFormDialog.tsx`

- Campo `scheduledTime`: `<TimeInput>` via `Controller`.
- Schema: `scheduledTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Hora inválida')`.
- Linha ~145 (`new Date(\`${date}T${time}:00\`)`) fica igual — input continua expondo `"HH:mm"`.

## Testes

### Unit tests dos novos componentes

Cada componente em `apps/frontend/src/components/inputs/*.spec.tsx`:

- **`NumericInput`**: rejeita ponto quando decimais esperados; formata separador de milhar no blur; `onChange` expõe `number | null`; truncamento de decimais excedentes; reset via nova `value` prop.
- **`CurrencyInput`**: renderiza prefixo `R$`; herda comportamento de `NumericInput`.
- **`DocumentInput`**: formata CPF/CNPJ durante digitação; armazena só dígitos; trunca ao limite; trata mudança de `type` em runtime.
- **`PhoneInput`**: formata telefone durante digitação; trunca em 11.
- **`TimeInput`**: insere `:` automático; trunca além de 4 dígitos; strip de não-dígitos. Validação de hora/minuto fica no schema Zod do form.

Também um teste dedicado para os novos helpers de `utils/masks.ts` (`formatCpf`, `formatDocument`, `parseDecimal`, `formatDecimal`).

### Integração por página

As páginas alteradas mudam apenas a wiring para os componentes novos — a lógica crítica (parsing, formatting, truncation) já é coberta pelos unit tests acima. A verificação end-to-end é feita por smoke test manual (Task 20 do plano), validando cada um dos 5 fluxos no browser contra o backend real. Isso evita o custo de 5 testes RTL de formulário sem ganho proporcional de cobertura.

### Backend

- Unit test `buyers.service`: criar comprador PF (CPF 11 dígitos) e PJ (CNPJ 14 dígitos).
- e2e controller: mesmos cenários via HTTP.
- Migration: rodar em ambiente de teste com seed contendo comprador PJ pré-existente; verificar backfill.

## Riscos e mitigações

- **Migration falha em prod se houver CNPJs inválidos.** Pré-check com mensagem clara listando IDs inconsistentes; usuário corrige manualmente antes de re-rodar.
- **Usuário copia-cola valor com ponto (ex.: "1234.56")** em `<NumericInput>` pt-BR. Decisão: `parseDecimal` aplica convenção pt-BR estrita — vírgula é decimal, ponto é separador de milhar. Durante a digitação, tecla `.` é ignorada (só aceita vírgula). Para copy-paste de fontes en-US, o usuário precisa ajustar manualmente — não é um caso primário (planilhas pt-BR já usam vírgula).
- **Mudança dinâmica do `documentType` no form do Fornecedor** pode invalidar o documento já digitado. Mitigação: ao mudar o select, truncar o `document` para o novo limite (não limpar, preservar o que couber).
- **Integrações externas (Asaas, relatórios) que referenciem `buyer.cnpj`.** Durante implementação, `grep buyer.cnpj` no backend + shared antes de fazer o rename final. Qualquer ocorrência é atualizada na mesma PR.

## Fora de escopo

- Máscara de CEP (existe no endereço do Fornecedor).
- Máscara de placa de veículo.
- Internacionalização (hoje o app é só pt-BR; quando virar multi-locale, os componentes recebem prop `locale`).
- Substituir `<CFormInput type="number">` em campos que não são valores monetários (ex.: contagem de itens em filtros).
