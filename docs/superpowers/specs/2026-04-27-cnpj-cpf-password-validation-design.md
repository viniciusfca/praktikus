# Validação de CNPJ/CPF e força de senha

**Data**: 2026-04-27
**Status**: Spec aprovado — aguardando plano de implementação

## Problema

Hoje as validações de documento e senha no Praktikus são frouxas:

- **CNPJ/CPF**: todos os formulários (registros de oficina e recicláveis, clientes da oficina, fornecedores e compradores recicláveis) checam apenas a contagem de dígitos via regex. Não há validação do algoritmo módulo 11. Um CNPJ como `12345678000199` (inválido pela Receita) é aceito.
- **Senha**: ambos os fluxos de registro exigem apenas `min(8)`. Sem requisitos de complexidade. Sem feedback visual ao usuário sobre força.
- **Reuso**: cada DTO/schema reescreve a regex; quando algo muda, é necessário tocar em N arquivos.

## Objetivo

Centralizar validação de CNPJ, CPF e força de senha em `@praktikus/shared` para reuso em qualquer lugar do código que aceite documento ou crie/altere senha. Aplicar política de senha rígida nos cadastros novos e no reset de senha. Mostrar ao usuário feedback visual de força com checklist de critérios faltantes.

## Decisões de design

### Política de senha
8+ caracteres, ao menos uma maiúscula, uma minúscula, um número, um caractere especial (5 critérios independentes).

### Escopo de aplicação
Retrofit completo backend + frontend:
- **Backend DTOs**: `register.dto.ts`, `reset-password.dto.ts` (se existir), `create-customer.dto.ts`/`update-customer.dto.ts` (workshop), `create-buyer.dto.ts`/`update-buyer.dto.ts`, `create-supplier.dto.ts`/`update-supplier.dto.ts` (recycling).
- **Frontend**: telas de registro de oficina e recicláveis, reset de senha, formulários de cliente (oficina), fornecedor e comprador (recicláveis).

### Aplicação da política de senha
Cadastros novos + reset de senha + troca de senha logado (`ChangePasswordDto`). Senhas antigas continuam funcionando até o usuário trocar — não há invalidação em massa.

> **Nota de revisão**: na Pergunta 3 a escolha foi "B" (cadastros + reset). Durante o self-review identifiquei que `apps/backend/src/modules/core/auth/dto/change-password.dto.ts` já existe (não era um fluxo futuro como eu assumi). Inclui-lo aqui é consistente com o princípio "toda senha **nova** atende à política". Confirmar na revisão do spec se concorda em estender ou se prefere manter apenas registros + reset.

### UI do medidor de força (comportamento "B")
- Campo de senha vazio → nada visível.
- Ao digitar a primeira letra → barra (3 níveis) + checklist (5 critérios) aparecem.
- Ao atender todos os 5 critérios → checklist some com transição suave; barra continua verde até o submit.

### Escala de força
- 0–2 critérios atendidos → fraca (vermelho)
- 3–4 atendidos → média (amarelo)
- 5 atendidos → forte (verde)

### Validação no backend
Decorators custom do `class-validator` (`@IsValidCnpj()`, `@IsValidCpf()`, `@IsValidDocument()`, `@IsStrongPassword()`) em `apps/backend/src/modules/core/validation/`, que delegam para as funções puras do `@praktikus/shared`. Sem duplicação de algoritmo.

### Empacotamento no shared
Funções puras + schemas Zod prontos. A CLAUDE.md já lista "Schemas Zod de validação reutilizáveis" como conteúdo válido para o pacote shared.

## Arquitetura

### `packages/shared/src/validators/` (novo)

```
validators/
├── cnpj.ts          isValidCnpj(value) + cnpjZodSchema
├── cpf.ts           isValidCpf(value) + cpfZodSchema
├── document.ts      isValidDocument(value) + cpfOrCnpjZodSchema
├── password.ts      evaluatePassword(value) + strongPasswordZodSchema + tipos
└── index.ts         barrel
```

`packages/shared/src/index.ts` ganha `export * from './validators'`.

`stripDigits` é movido de `apps/frontend/src/utils/masks.ts` para `packages/shared/src/utils/strip-digits.ts` e re-exportado pelo shared, evitando duplicação. O frontend re-exporta de `masks.ts` para manter o caminho de import existente (ou atualiza os imports — escolha do plano).

### `apps/backend/src/modules/core/validation/` (novo)

```
validation/
├── validation.module.ts
├── is-valid-cnpj.decorator.ts
├── is-valid-cpf.decorator.ts
├── is-valid-document.decorator.ts
└── is-strong-password.decorator.ts
```

Cada decorator é um wrapper sobre `ValidatorConstraint` que chama a função pura do `@praktikus/shared`. Mensagem padrão em pt-BR.

### `apps/frontend/src/components/PasswordStrengthMeter.tsx` (novo)

Componente apresentacional puro. Recebe `password: string` como prop e renderiza barra + checklist conforme `evaluatePassword(password)`.

## Contratos

### Validadores de documento

**Algoritmo**: módulo 11 padrão da Receita Federal, com rejeição de sequências repetidas (`11111111111`, `00000000000000`) que matematicamente passam mas são inválidas.

**`isValidCnpj(value: string): boolean`**
- Limpa não-dígitos (aceita `"12.345.678/0001-95"` ou `"12345678000195"`)
- Retorna `false` se ≠ 14 dígitos, todos iguais, ou DVs incorretos
- Pesos: primeiros 12 dígitos `[5,4,3,2,9,8,7,6,5,4,3,2]`; segundo DV `[6,5,4,3,2,9,8,7,6,5,4,3,2]`

**`isValidCpf(value: string): boolean`**
- Limpa não-dígitos (aceita `"123.456.789-09"` ou `"12345678909"`)
- Retorna `false` se ≠ 11 dígitos, todos iguais, ou DVs incorretos
- Algoritmo módulo 11 padrão

**`isValidDocument(value: string): boolean`**
- Limpa não-dígitos. Se 11 → `isValidCpf`. Se 14 → `isValidCnpj`. Caso contrário → `false`.

**Schemas Zod (mensagens em pt-BR)**:

```ts
export const cnpjZodSchema = z.string()
  .transform(stripDigits)
  .refine(isValidCnpj, { message: 'CNPJ inválido' });

export const cpfZodSchema = z.string()
  .transform(stripDigits)
  .refine(isValidCpf, { message: 'CPF inválido' });

export const cpfOrCnpjZodSchema = z.string()
  .transform(stripDigits)
  .refine(isValidDocument, { message: 'CPF ou CNPJ inválido' });
```

Os schemas devolvem só dígitos após `transform`, alinhado com como banco e DTOs já armazenam.

### Avaliador de senha

```ts
type PasswordCriterion =
  | 'minLength'    // ≥ 8 caracteres
  | 'lowercase'    // ao menos 1 [a-z]
  | 'uppercase'    // ao menos 1 [A-Z]
  | 'number'       // ao menos 1 [0-9]
  | 'specialChar'; // ao menos 1 caractere não-alfanumérico

type PasswordStrength = 'weak' | 'medium' | 'strong';

interface PasswordEvaluation {
  criteria: Record<PasswordCriterion, boolean>;
  metCount: number;        // 0..5
  strength: PasswordStrength;
  isValid: boolean;        // true sse metCount === 5
}

function evaluatePassword(value: string): PasswordEvaluation;
```

`strongPasswordZodSchema`: `z.string().refine(v => evaluatePassword(v).isValid, { message: 'Senha não atende a todos os critérios' })`. A mensagem é genérica — feedback granular vem do componente visual.

### Componente `<PasswordStrengthMeter />`

```tsx
<PasswordStrengthMeter password={password} />
```

- `password === ''` → não renderiza nada
- Barra: 3 segmentos, preenchimento conforme `strength`
  - weak → vermelho (`--cui-danger`)
  - medium → amarelo (`--cui-warning`)
  - strong → verde (`--cui-success`)
- Label adjacente: "Fraca" / "Média" / "Forte"
- Checklist (5 linhas, ✓ verde quando atendido, ✗/círculo cinza quando não):
  - "Pelo menos 8 caracteres"
  - "Letra minúscula"
  - "Letra maiúscula"
  - "Número"
  - "Caractere especial (ex: !@#$%)"
- `isValid === true` → checklist desaparece com transição (~150ms); barra permanece verde
- Componente puramente apresentacional — não controla o input

### Decorators do backend

Exemplo `@IsValidCnpj()`:

```ts
@ValidatorConstraint({ name: 'isValidCnpj', async: false })
export class IsValidCnpjConstraint implements ValidatorConstraintInterface {
  validate(value: unknown) {
    return typeof value === 'string' && isValidCnpj(value);
  }
  defaultMessage() { return 'CNPJ inválido'; }
}

export function IsValidCnpj(options?: ValidationOptions): PropertyDecorator {
  return (object, propertyName) => {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName as string,
      options,
      constraints: [],
      validator: IsValidCnpjConstraint,
    });
  };
}
```

Análogo para `@IsValidCpf`, `@IsValidDocument`, `@IsStrongPassword`.

## Mudanças por arquivo

### Frontend

| Arquivo | Mudança |
|---------|---------|
| `apps/frontend/src/pages/auth/RegisterPage.tsx` | `cnpj`: regex → `cnpjZodSchema`; `password`: `min(8)` → `strongPasswordZodSchema`; render `<PasswordStrengthMeter password={form2.watch('password')} />` |
| `apps/frontend/src/pages/auth/RegisterRecyclingPage.tsx` | Idem |
| `apps/frontend/src/pages/auth/ResetPasswordPage.tsx` | `password`: → `strongPasswordZodSchema`; render `<PasswordStrengthMeter />` |
| Tela de troca de senha logado (se já houver UI; caso contrário só backend) | `password`: → `strongPasswordZodSchema`; render `<PasswordStrengthMeter />` |
| `apps/frontend/src/pages/workshop/customers/CustomerFormPage.tsx` | `cpfCnpj`: regex → `cpfOrCnpjZodSchema`; máscara `formatDocument` |
| `apps/frontend/src/pages/recycling/suppliers/SuppliersPage.tsx` | Idem (forma inline na página) |
| `apps/frontend/src/pages/recycling/buyers/BuyersPage.tsx` | Idem (forma inline na página) |
| `apps/frontend/src/components/PasswordStrengthMeter.tsx` | Novo componente |
| `apps/frontend/src/utils/masks.ts` | `stripDigits` movido para shared; re-exportar para preservar imports |

### Backend

| Arquivo | Mudança |
|---------|---------|
| `apps/backend/src/modules/core/validation/*.decorator.ts` | Novos decorators |
| `apps/backend/src/modules/core/validation/validation.module.ts` | Novo módulo (apenas agrupa) |
| `core/auth/dto/register.dto.ts` | `@Matches(/^\d{14}$/)` → `@IsValidCnpj()`; `@MinLength(8)` → `@IsStrongPassword()` |
| `core/auth/dto/reset-password.dto.ts` | `@MinLength(8)` no `newPassword` → `@IsStrongPassword()` |
| `core/auth/dto/change-password.dto.ts` | `@MinLength(8)` no `newPassword` → `@IsStrongPassword()` (currentPassword permanece sem alteração — só verifica match) |
| `workshop/customers/dto/create-customer.dto.ts` | `@Matches` → `@IsValidDocument()` |
| `workshop/customers/dto/update-customer.dto.ts` (se aplicável) | Idem |
| `recycling/buyers/dto/create-buyer.dto.ts` | `@Matches` → `@IsValidDocument()` |
| `recycling/buyers/dto/update-buyer.dto.ts` | Idem |
| `recycling/suppliers/dto/create-supplier.dto.ts` | `@Matches` → `@IsValidDocument()` |
| `recycling/suppliers/dto/update-supplier.dto.ts` | Idem |

### Shared

| Arquivo | Mudança |
|---------|---------|
| `packages/shared/src/validators/cnpj.ts` | Novo |
| `packages/shared/src/validators/cpf.ts` | Novo |
| `packages/shared/src/validators/document.ts` | Novo |
| `packages/shared/src/validators/password.ts` | Novo |
| `packages/shared/src/validators/index.ts` | Novo |
| `packages/shared/src/utils/strip-digits.ts` | Novo (movido de masks.ts) |
| `packages/shared/src/index.ts` | `export * from './validators'` + utils |
| `packages/shared/package.json` | Adicionar `zod` como dependência |

## Estratégia de testes

### Shared
- `cnpj.spec.ts`: válidos conhecidos, inválidos por DV errado, sequências repetidas, tamanho errado, com/sem máscara, vazio, null, não-string
- `cpf.spec.ts`: análogo
- `document.spec.ts`: roteamento por tamanho + casos limite (10, 12, 13, 15 dígitos → false)
- `password.spec.ts`: tabela de inputs vs `metCount`/`strength` esperados; cobre cada critério isolado; valida transições 2→3→4→5 e fronteira `isValid`

### Backend
- Para cada decorator, spec que instancia uma classe `class TestDto { @IsValidCnpj() field: string }`, roda `validate()` do class-validator com inputs válidos/inválidos e confere `errors[].constraints`
- Atualizar `auth.controller.spec.ts`, `auth.service.spec.ts`, `customers.service.spec.ts` e quaisquer outros que usavam fixtures inválidas (ex: `12345678000199`) para CNPJs válidos

### Frontend
- `PasswordStrengthMeter.test.tsx`: nada com password vazia; renderiza barra+checklist ao receber password; checklist some com `isValid`; barra muda de cor conforme `strength`
- `RegisterPage.test.tsx`, `RegisterRecyclingPage.test.tsx`, `ResetPasswordPage.test.tsx` (se houver): trocar fixtures inválidas por CNPJs válidos; adicionar caso "CNPJ com formato OK mas DV inválido → erro"
- Tests de `customers`/`buyers`/`suppliers`: sanear fixtures

### Verificação manual
- Rodar `pnpm dev` e testar visualmente os 3 fluxos de senha (registro oficina, registro reciclável, reset password) — confirmar comportamento "B" da barra/checklist
- Cadastrar com CNPJ `00000000000000` → deve falhar
- Cadastrar com CNPJ válido fictício → deve passar
- Tentar criar cliente/fornecedor/comprador com CPF/CNPJ inválido → deve falhar com mensagem clara

## Riscos e considerações

- **Dados antigos com máscara no banco**: graças ao `transform(stripDigits)` nos schemas, novos submits vão sempre como dígitos. Se houver registros antigos armazenados com máscara, pode ser necessária migration de normalização — investigar na fase de plano.
- **Fixtures de teste com CNPJs inválidos**: vários `*.spec.ts` provavelmente usam `12345678000199` (que falha pelo algoritmo). Substituir por CNPJs válidos é parte do trabalho.
- **Dependência do Zod no shared**: o pacote shared ganha `zod` como dependência. Backend continua sem importar Zod (usa decorators class-validator).
- **Sem invalidação de senhas antigas**: usuários com senha fraca pré-existente continuam logando normalmente. Não há fluxo forçado de troca — alinhado com a decisão da Pergunta 3.

## Fora de escopo

- Forçar troca de senha em massa para usuários existentes
- Verificação contra listas de senhas vazadas (haveibeenpwned, etc.)
- Validação de CNPJ contra a Receita Federal online (apenas algoritmo local)
- Validação de inscrição estadual ou outros documentos brasileiros
