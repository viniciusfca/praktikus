# Busca de CEP com autopreenchimento de endereço

**Data:** 2026-04-27
**Branch:** redesign/praktikus-v2 (ou nova branch)
**Escopo:** backend (novo módulo `core/cep`) + shared (novo type) + frontend (hook, service, componente reutilizável, 2 formulários migrados)

---

## Contexto

Hoje há dois formulários com campos de endereço no projeto:

1. **Configurações da empresa** — `apps/frontend/src/components/settings/CompanyTab.tsx`, usado tanto em `apps/frontend/src/pages/workshop/settings/SettingsPage.tsx` quanto em `apps/frontend/src/pages/recycling/settings/SettingsPage.tsx`. Persiste em `tenants.endereco` (jsonb).
2. **Cadastro de fornecedor** — `SupplierFormDialog` dentro de `apps/frontend/src/pages/recycling/suppliers/SuppliersPage.tsx`. Persiste em `suppliers.address` (jsonb).

Os dois formulários têm o mesmo conjunto de campos: `street`, `number`, `complement`, `city`, `state`, `zip`. Hoje todos são preenchidos manualmente pelo usuário, sem qualquer integração com APIs de CEP. Não existe campo `bairro/neighborhood`.

## Objetivo

Adicionar busca automática de endereço por CEP nos dois formulários, compartilhando a mesma lógica:

- O CEP passa a ser o **primeiro campo da seção de endereço**.
- Ao digitar 8 dígitos, o sistema consulta uma API externa e preenche automaticamente rua, bairro, cidade e estado.
- Os campos preenchidos automaticamente continuam editáveis pelo usuário (correção manual).
- Falha de busca não bloqueia o formulário — usuário pode preencher manual.

## Decisões de design (validadas no brainstorming)

- **API primária:** `https://ceplite.com.br/cep/<8digitos>`.
- **API fallback:** `https://viacep.com.br/ws/<8digitos>/json/` quando ceplite falhar.
- **Onde executa a busca:** backend proxy autenticado (`GET /api/cep/:cep`). Centraliza fallback, evita CORS no front, mantém o endpoint observável via logs.
- **Cache:** **sem cache**. Toda chamada bate na API externa.
- **Trigger no front:** quando o campo CEP atinge 8 dígitos válidos (com debounce de 300ms via `use-debounce`).
- **Comportamento dos campos preenchidos:** **editáveis** — o usuário pode corrigir após o autopreenchimento.
- **Adição do campo `bairro` (neighborhood):** ambos os formulários, DTOs e tipos de endereço ganham o campo. Como `endereco`/`address` são `jsonb`, **não há migration** — registros antigos continuam funcionando sem o campo.
- **Compartilhamento no front:** componente `<AddressFields />` reutilizável, consumido pelos dois formulários.
- **Formato de erro:** mensagem discreta abaixo do campo CEP. Não bloqueia o submit do formulário.

## Arquitetura

### Backend: novo módulo `core/cep`

```
apps/backend/src/modules/core/cep/
├── cep.module.ts
├── cep.controller.ts
├── cep.service.ts
├── cep.service.spec.ts
└── dto/
    └── cep-lookup-response.dto.ts
```

**`CepController`:**

- `GET /api/cep/:cep` protegido por `JwtAuthGuard` (mesmo padrão dos outros controllers).
- Delega ao `CepService.lookup(cep)`.

**`CepService.lookup(cep: string): Promise<CepLookupResponse>`:**

1. Normaliza o CEP removendo qualquer caractere não numérico.
2. Se o resultado não tiver 8 dígitos → `BadRequestException('CEP inválido')`.
3. Tenta `GET https://ceplite.com.br/cep/<8digitos>` com timeout de 3s via `HttpService` do `@nestjs/axios`:
   - HTTP 200 com payload válido → normaliza e retorna.
   - HTTP 404 ou payload inválido → marca para confirmação via viacep antes de devolver 404.
   - Timeout/erro de rede/5xx → log warn e cai para o fallback.
4. Tenta `GET https://viacep.com.br/ws/<8digitos>/json/` com timeout de 3s:
   - HTTP 200 com payload válido (sem `erro: true`) → normaliza e retorna.
   - Payload `{ erro: true }` ou 404 → `NotFoundException('CEP não encontrado')`.
   - Timeout/erro de rede/5xx → `BadGatewayException('Falha ao consultar CEP')`.

**Normalização (mapeamento dos shapes externos para o shape comum):**

| Campo retornado | ceplite      | viacep       |
| --------------- | ------------ | ------------ |
| `cep`           | `cep`        | `cep`        |
| `street`        | `logradouro` | `logradouro` |
| `neighborhood`  | `bairro`     | `bairro`     |
| `city`          | `cidade`     | `localidade` |
| `state`         | `uf`         | `uf`         |

CEPs gerais (ex: `69900000`) podem retornar `logradouro` e `bairro` vazios — é comportamento esperado das APIs; nesse caso retornamos string vazia nesses campos e o usuário preenche manualmente.

**Logging:**

- Warn quando ceplite falha e o fallback é usado: `[CepService] ceplite failed for ${cep}, falling back to viacep. Reason: ${error.message}`.
- Error quando ambas APIs falham: `[CepService] both ceplite and viacep failed for ${cep}`.

**Dependências novas:** `@nestjs/axios` (e `axios`) precisam ser adicionados ao backend; o `HttpModule` é registrado no `CepModule`. `CepModule` é registrado em `AppModule`.

### Shared: novo type

`packages/shared/src/types/cep.ts`:

```typescript
export interface CepLookupResponse {
  cep: string;          // 8 dígitos sem hífen
  street: string;       // logradouro (pode vir vazio em CEPs gerais)
  neighborhood: string; // bairro (pode vir vazio)
  city: string;
  state: string;        // UF, 2 letras maiúsculas
}
```

Exportado a partir de `packages/shared/src/index.ts`. Backend usa como tipo de retorno do controller; frontend usa no service e no hook.

### Frontend: service, hook, componente

**`apps/frontend/src/services/cep.service.ts`:**

```typescript
import api from './api'
import type { CepLookupResponse } from '@praktikus/shared'

export async function lookupCep(cep: string): Promise<CepLookupResponse> {
  const clean = cep.replace(/\D/g, '')
  const { data } = await api.get<CepLookupResponse>(`/cep/${clean}`)
  return data
}
```

**`apps/frontend/src/hooks/useCepLookup.ts`:**

Recebe o `setValue` do react-hook-form e expõe `{ onCepChange, isLoading, error }`. Internamente:

- Usa `useDebouncedCallback` de `use-debounce` (300ms).
- Quando o CEP normalizado tem 8 dígitos, chama `lookupCep`, popula `street`, `neighborhood`, `city`, `state` via `setValue` (com `shouldDirty: true`).
- Diferencia erros: 404 → "CEP não encontrado"; demais → "Não foi possível consultar o CEP".
- Aceita uma opção `fields` para sobrescrever nomes dos campos (defensivo, não usado nos formulários atuais).

Nova dependência: `use-debounce` no `apps/frontend/package.json`.

**`apps/frontend/src/components/forms/AddressFields.tsx`:**

Componente reutilizável que renderiza os 7 campos de endereço, integrado com react-hook-form via `control`/`setValue`/`errors`.

Props:

```typescript
type Props = {
  control: Control<any>
  setValue: UseFormSetValue<any>
  errors?: FieldErrors<any>
  disabled?: boolean
}
```

Layout em grid de 12 colunas (consistente com o estilo do `SupplierFormDialog` atual), com CEP como primeiro campo:

```
┌──────────────┬─────────────────────────────────────────┐
│ CEP (4)      │ Rua / Logradouro (8)                    │
├────┬─────────┴───────────────┬────────────────────────┤
│ Nº │ Bairro (5)              │ Complemento (4)        │
│(3) │                         │                        │
├────┴───┬──────────────────┬──┴────┐
│ Cidade │ Estado (UF) (2)  │       │
│  (10)  │                  │       │
└────────┴──────────────────┴───────┘
```

Comportamento:

- O campo CEP usa `Controller` do RHF; o `onChange` chama tanto `field.onChange(e)` quanto `onCepChange(e.target.value)`.
- Spinner inline aparece dentro do campo CEP enquanto `isLoading === true`.
- Mensagem de erro renderizada como `<small>` abaixo do campo CEP quando `error !== null`.
- Demais campos são `Controller`s simples mapeados para os nomes do form.

### Atualização das entities, DTOs e formulários existentes

**Entities (campo opcional adicionado ao tipo `jsonb` — sem migration):**

`apps/backend/src/modules/core/tenancy/tenant.entity.ts`:

```typescript
export type TenantAddress = {
  street: string;
  number: string;
  neighborhood?: string;  // NOVO
  complement?: string;
  city: string;
  state: string;
  zip: string;
};
```

`apps/backend/src/modules/recycling/suppliers/supplier.entity.ts`:

```typescript
export type SupplierAddress = {
  street: string;
  number: string;
  neighborhood?: string;  // NOVO
  complement?: string;
  city: string;
  state: string;
  zip: string;
};
```

**DTOs:**

- `apps/backend/src/modules/workshop/companies/dto/update-company.dto.ts` → `AddressUpdateDto` ganha `@IsOptional() @IsString() neighborhood?: string`.
- `apps/backend/src/modules/recycling/suppliers/dto/create-supplier.dto.ts` → `address.neighborhood?: string` no shape opcional.
- `apps/backend/src/modules/recycling/suppliers/dto/update-supplier.dto.ts` herda automaticamente via `PartialType`.

**Formulários:**

`apps/frontend/src/components/settings/CompanyTab.tsx`:

- Schema `companySchema` ganha `neighborhood: z.string().optional()`.
- `defaultValues` recebe `neighborhood: data?.endereco?.neighborhood ?? ''`.
- O bloco JSX dos 6 campos de endereço atuais (CEP, Rua, Número, Complemento, Cidade, Estado) é substituído por `<AddressFields control={control} setValue={setValue} errors={errors} />`.
- Payload de submit envia `neighborhood` dentro de `endereco`.

`apps/frontend/src/services/company.service.ts`:

- Interface `CompanyAddress` ganha `neighborhood?: string`.

`apps/frontend/src/pages/recycling/suppliers/SuppliersPage.tsx` (`SupplierFormDialog` interno):

- Schema inline ganha `neighborhood: z.string().optional()`.
- `defaultValues` e payload de submit incluem `neighborhood`.
- Bloco JSX dos campos de endereço substituído por `<AddressFields control={control} setValue={setValue} errors={errors} />`.

`apps/frontend/src/services/recycling/suppliers.service.ts`:

- Type `Supplier.address` ganha `neighborhood?: string`.

### Listagens / leituras

Antes de finalizar, verificar se alguma página/componente exibe o endereço completo do fornecedor ou da empresa hoje. Se exibir, adicionar `bairro` na exibição quando presente. Se não exibir, nada a fazer (o campo só aparece nos forms).

## Edge cases

- **CEP geral de cidade** (ex: `69900000`): `street` e/ou `neighborhood` podem vir vazios. O autopreenchimento popula com string vazia e o usuário digita manualmente.
- **Usuário redigita o CEP após preenchimento:** ao atingir 8 dígitos novamente, os campos são sobrescritos com os novos dados (comportamento esperado).
- **Edição manual de cidade/rua antes de mudar o CEP:** o autopreenchimento sobrescreve a edição manual. Documentado como comportamento esperado — quem mexe no CEP por último ganha.
- **CEP com menos de 8 dígitos:** nada acontece (não dispara busca).
- **CEP com formato inválido:** o backend retorna 400; o hook trata como erro genérico.

## Testes

### Backend

`cep.service.spec.ts` — unit com `HttpService` mockado:

- ✅ CEP com hífen/espaços é normalizado e a URL externa correta é chamada.
- ✅ ceplite responde 200 → retorna shape normalizado, viacep não é chamado.
- ✅ ceplite falha (timeout/5xx/erro de rede) → cai pro viacep, retorna shape normalizado, log warn.
- ✅ ceplite retorna 404 → tenta viacep; se viacep também 404 (ou `{ erro: true }`) → `NotFoundException`.
- ✅ ambos timeout/erro de rede → `BadGatewayException`.
- ✅ CEP malformado (≠ 8 dígitos após normalizar) → `BadRequestException`.
- ✅ ceplite retorna payload com formato inesperado → cai pro viacep.

`cep.controller.spec.ts` — unit:

- ✅ rota protegida por `JwtAuthGuard`.
- ✅ controller delega ao service e retorna o resultado.

E2E em `apps/backend/test/integration/`:

- ✅ requisição sem JWT → 401.
- ✅ requisição com JWT válido + `HttpService` mockado no nível do módulo → 200 com shape esperado.

### Frontend

`apps/frontend/src/hooks/useCepLookup.spec.ts` — vitest:

- ✅ `onCepChange` com menos de 8 dígitos → não chama o service.
- ✅ `onCepChange` com 8 dígitos (após debounce) → chama service e popula campos via `setValue`.
- ✅ erro 404 → `error` vira "CEP não encontrado", campos não mexidos.
- ✅ erro genérico (5xx/network) → `error` vira mensagem genérica.
- ✅ `isLoading` alterna corretamente em torno da chamada.

`AddressFields.spec.tsx` — react-testing-library:

- ✅ renderiza os 7 campos (CEP, rua, número, bairro, complemento, cidade, estado).
- ✅ digitar 8 dígitos no CEP dispara busca e preenche os outros campos.
- ✅ erro de busca exibe mensagem abaixo do CEP; demais campos permanecem editáveis e o submit do form não é bloqueado.
- ✅ campos preenchidos automaticamente podem ser editados manualmente após o preenchimento.

### Smoke manual

- 🔍 `Configurações da empresa` (workshop): preencher CEP real → verificar autopreenchimento.
- 🔍 `Configurações da empresa` (recycling): mesma verificação.
- 🔍 Modal `Novo fornecedor`: mesma verificação.
- 🔍 Salvar e recarregar a página: confirmar que `neighborhood` persiste no banco e é exibido ao reabrir o formulário.

## Observabilidade

- Logs descritos na seção do `CepService` (warn quando fallback é acionado, error quando ambas falham).
- Sem dashboards ou alertas dedicados na primeira versão. Se o fallback ficar frequente nos logs, escalamos depois.

## Riscos e considerações

- **Dependência externa:** o sistema fica dependente da disponibilidade de pelo menos uma das duas APIs. O fallback mitiga, mas se ambas caírem, o usuário precisa preencher manualmente — comportamento aceitável (não bloqueia o form).
- **Custo/rate limit:** ambas APIs são gratuitas e públicas; sem rate limit declarado. Como não há cache, picos de uso na nossa aplicação se traduzem em picos nas APIs externas. Aceitável para o volume atual.
- **Endpoint autenticado:** evita que o backend seja usado como proxy aberto por terceiros.

## Fora de escopo

- Cache de CEP (Redis ou em memória).
- Validação semântica de CEP (verificar se o CEP existe antes de buscar).
- Histórico ou log de buscas por usuário.
- Página administrativa para inspecionar falhas de busca.
- Atualização de endereços já cadastrados em massa (backfill de `neighborhood` em registros existentes).
