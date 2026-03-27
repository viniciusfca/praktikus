# Design: Página de Configurações (`/workshop/settings`)

**Data:** 2026-03-27
**Status:** Aprovado

---

## Contexto

A sidebar do AppLayout já exibe um link "Configurações" apontando para `/workshop/settings`, mas a rota e a página não existem. O backend de perfil da empresa (`GET/PATCH /api/workshop/company`, `POST /api/workshop/company/logo`) já está implementado. Falta o endpoint de troca de senha e toda a camada frontend.

---

## Acesso

- Rota protegida: OWNER apenas
- Funcionários autenticados são redirecionados para `/workshop/dashboard`

---

## Backend

### Novo endpoint: `PATCH /auth/me/password`

- **Guard:** `JwtAuthGuard`
- **Body:** `{ currentPassword: string, newPassword: string }`
- **DTO:** `ChangePasswordDto` com `@IsString()` + `@MinLength(8)` em ambos os campos
- **Lógica (`AuthService.changePassword`):**
  1. Busca o usuário pelo `userId` extraído do JWT
  2. Compara `currentPassword` com o hash armazenado (`bcrypt.compare`)
  3. Se inválida → `UnauthorizedException('Senha atual incorreta')`
  4. Gera hash de `newPassword` e persiste

---

## Frontend

### Rota

```tsx
<Route path="settings" element={<SettingsPage />} />
```
Adicionada dentro do bloco `/workshop` em `App.tsx`.

### `SettingsPage.tsx`

- `CNav variant="tabs"` com duas abas: **Empresa** | **Minha Conta**
- Mesma estrutura de tabs já usada em `CatalogPage`

### Aba "Empresa"

- `GET /api/workshop/company` ao montar → preenche formulário
- Campos: Nome Fantasia, Razão Social, Telefone
- Endereço: Rua, Número, Complemento, Cidade, Estado, CEP
- Botão "Salvar" → `PATCH /api/workshop/company`
- Seção de logo separada: preview da logo atual + input `type="file"` (accept jpg/png, max 2MB) → `POST /api/workshop/company/logo`

### Aba "Minha Conta"

- Campos: Senha Atual, Nova Senha, Confirmar Nova Senha
- Validação Zod: `newPassword` mínimo 8 chars, confirmação deve bater
- Botão "Alterar senha" → `PATCH /api/auth/me/password`

### Services

- **Novo:** `apps/frontend/src/services/company.service.ts` — `getProfile`, `updateProfile`, `uploadLogo`
- **Existente:** `apps/frontend/src/services/auth.service.ts` — adicionar `changePassword`

---

## Fora do escopo

- Gerenciamento de funcionários (roles, convites)
- Configurações de notificação
- Preferências de tema (já existe no AppLayout)
