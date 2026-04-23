# Configurações do Recycling — Design Document

**Date:** 2026-04-18
**Status:** Approved

---

## 1. Problema

A sidebar de `RecyclingLayout` tem um item de navegação apontando para `/recycling/settings`, mas essa rota **não está registrada em `App.tsx`**. Ao clicar, o React Router renderiza uma tela em branco com o erro:

> No routes matched location "/recycling/settings"

A tela de Configurações é necessária para o segmento de reciclagem seguir o mesmo padrão do workshop (gerenciar dados da empresa, senha e assinatura) **e** para administrar as **unidades de medida** dos produtos recicláveis (item previsto na seção 7 do design `2026-04-07-recycling-segment-design.md`).

---

## 2. Escopo

Criar `/recycling/settings` com 4 tabs:

1. **Empresa** — idêntico ao workshop (razão/fantasia, telefone, endereço, logo)
2. **Unidades de medida** — exclusivo do recycling (CRUD de `units`)
3. **Minha conta** — idêntico ao workshop (alterar senha)
4. **Assinatura** — idêntico ao workshop (status banner + informações de cobrança)

Aproveitar a implementação para **extrair as 3 tabs compartilhadas** de dentro do arquivo monolítico `pages/workshop/settings/SettingsPage.tsx` (atual: 614 linhas) para componentes reutilizáveis em `components/settings/`.

---

## 3. Arquitetura

### Abordagem escolhida

**Extrair tabs compartilhadas** para `components/settings/`, e compor cada `SettingsPage` por segmento. Descartadas:

- *Duplicar `SettingsPage.tsx` inteiro* — 400 linhas duplicadas de Empresa/Conta/Assinatura
- *Prop `extraTabs` no `SettingsPage` atual* — acopla o workshop a saber de extras e mantém o arquivo monolítico

### Estrutura final

```
src/components/settings/
├── Card.tsx              # Wrapper de card + helper CardTitle (atualmente inline no SettingsPage)
├── CompanyTab.tsx        # Form de dados da empresa + upload de logo + endereço
├── AccountTab.tsx        # Form de alteração de senha
└── SubscriptionTab.tsx   # Banner de status + informações de cobrança

src/pages/workshop/settings/
└── SettingsPage.tsx      # PageHead + tabs: [Empresa, Conta, Assinatura]

src/pages/recycling/settings/
├── SettingsPage.tsx      # PageHead + tabs: [Empresa, Unidades, Conta, Assinatura]
└── UnitsTab.tsx          # CRUD de unidades (novo)

src/App.tsx               # Nova rota: <Route path="settings" element={<RecyclingSettingsPage />} />
```

### Responsabilidades

**Shared tabs (`components/settings/`):**
- Self-contained state (useForm, useEffect de load, alerts de success/error)
- Operam no tenant atual via `companyService` e `authService` — agnósticas de segmento
- Card/CardTitle como helpers de apresentação internos

**Per-segment SettingsPage:**
- Guard de role: se `user.role !== 'OWNER'`, redireciona para **o dashboard do seu próprio segmento** (`/workshop/dashboard` ou `/recycling/dashboard`)
- `PageHead` com título e subtítulo
- Lista de tabs (array de `{ label, icon, content }`)
- Renderização dos tabs via `CNav` + `CTabContent`

---

## 4. UnitsTab (novo)

### UX

Mesmo padrão visual da `CatalogPage`:

- **Card `pk-table-card`** com toolbar + tabela + rodapé
- **Toolbar:** busca client-side (filtra por nome ou abreviação) + botão primary "Nova unidade"
- **Tabela** com 3 colunas:
  - Nome (regular)
  - Abreviação (JetBrains Mono, cinza)
  - Ações (editar ghost + excluir danger ghost)
- **Empty state** com ícone em círculo teal-soft + mensagem contextual
- **Modal** (CModal size sm) para criar/editar

### Schema de validação

```ts
const unitSchema = z.object({
  name: z.string().min(2, 'Mínimo 2 caracteres'),
  abbreviation: z.string().min(1, 'Obrigatório').max(10, 'Máximo 10 caracteres'),
});
```

### API

Reutiliza o `unitsService` existente em `src/services/recycling/units.service.ts`:

- `unitsService.list()` → carrega lista
- `unitsService.create({ name, abbreviation })` → cria
- `unitsService.update(id, payload)` → atualiza
- `unitsService.delete(id)` → exclui (com `confirm()` antes)

### Erros de backend

Exibir mensagem retornada pelo servidor. Exemplo comum: tentativa de excluir uma unidade referenciada por produtos (erro 409 ou 400 conforme a implementação do backend — tratar genericamente via `err.response.data.message`).

---

## 5. Fix colateral — redirect segment-aware

O workshop `SettingsPage` hoje tem:

```tsx
if (user && user.role !== 'OWNER') {
  navigate('/workshop/dashboard', { replace: true });
}
```

Com a extração, cada `SettingsPage` vira segmento-específico e redireciona para o dashboard do seu próprio segmento — sem necessidade de lógica condicional nas tabs compartilhadas.

---

## 6. Rota no `App.tsx`

Adicionar dentro do bloco `/recycling/*` (após a rota `reports`):

```tsx
<Route path="settings" element={<RecyclingSettingsPage />} />
```

Novo import:

```tsx
import { SettingsPage as RecyclingSettingsPage } from './pages/recycling/settings/SettingsPage';
```

---

## 7. Escopo explícito do que **não** será feito

- Não extrair `Card`/`CardTitle` inline de Dashboard/Reports/ServiceOrderDetail para um shared comum — scope creep
- Não alterar permissões (continua OWNER-only para a página inteira — idêntico ao workshop)
- Não mexer no backend — `unitsService` já existe e é funcional
- Não adicionar tab de "Funcionários" no Settings do recycling (Funcionários já tem página dedicada em `/recycling/employees`)

---

## 8. Ordem de implementação

1. Criar `src/components/settings/Card.tsx` com `Card` + `CardTitle` extraídos
2. Mover `CompanyTab`, `AccountTab`, `SubscriptionTab` para `src/components/settings/`
3. Reescrever `pages/workshop/settings/SettingsPage.tsx` como composição slim (3 tabs)
4. Criar `pages/recycling/settings/UnitsTab.tsx` (CRUD novo)
5. Criar `pages/recycling/settings/SettingsPage.tsx` (4 tabs)
6. Registrar rota em `App.tsx`
7. Validar manualmente: workshop settings continua idêntico; recycling settings funciona com as 4 tabs

---

## 9. Testes

- Type-check deve passar (`tsc --noEmit`) sem novos erros
- Teste manual: navegar para `/recycling/settings` como OWNER do recycling — 4 tabs visíveis, cada uma carrega/salva
- Teste manual: navegar para `/workshop/settings` como OWNER do workshop — continua funcionando igual
- Teste manual: usuário não-OWNER do recycling → redireciona para `/recycling/dashboard`
- Teste manual: usuário não-OWNER do workshop → redireciona para `/workshop/dashboard`
