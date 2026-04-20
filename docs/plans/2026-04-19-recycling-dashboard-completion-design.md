# Design — Dashboard de Recicláveis: Top Materiais + Coletas

**Data:** 2026-04-19
**Segmento:** Recicláveis
**Autor:** Vini Souza (via brainstorming)

---

## 1. Contexto

O dashboard de Recicláveis (`RecyclingDashboardPage`) possui hoje:

- KPIs: Compras (hoje), Caixa, Vendas (placeholder), Estoque (placeholder)
- Gráfico de fluxo de compras (7/30/90 dias)
- Card de caixa (status/saldo)

Faltam duas seções mostradas no mockup aprovado:

1. **Top materiais** — ranking mensal dos produtos mais comprados
2. **Próximas coletas** — lista das próximas coletas agendadas

A feature **Coletas** não existe como entidade. O endpoint de Top materiais também não existe — `RecyclingReportsService` hoje só calcula totais do dia e séries por período.

## 2. Meta

Fechar as duas seções ainda não implementadas do dashboard, entregando:

- Endpoint e widget de Top materiais (volume mensal, preço médio ponderado, variação vs mês anterior)
- Módulo completo de Coletas (CRUD, comentários, página dedicada com calendário semanal e lista, widget no dashboard)

## 3. Escopo e fases

A entrega é dividida em duas fases com PRs separados:

### Fase 1 — Top Materiais (quick win)

- Endpoint `GET /recycling/reports/top-materials`
- Extensão do `getDashboardSummary` para incluir `totalPurchasedMonth`
- Widget "Top materiais" no dashboard
- Renomear KPI "Compras (hoje)" → "Compras (mês)" usando o novo campo

### Fase 2 — Coletas

- Entidades `coletas` e `coleta_comments` no schema do tenant (segmento RECYCLING)
- Nova coluna `can_manage_coletas` em `employee_permissions` (default `true`)
- Módulo backend `modules/recycling/coletas/` com CRUD, transições de status e comentários
- Página `/recycling/coletas` com toggle Calendário semanal / Lista (paridade visual com `AppointmentsPage` de oficina)
- Drawer lateral com detalhes + comentários
- Form dialog para criar/editar
- Widget "Próximas coletas" no dashboard
- Item "Coletas" no sidebar

### Fora de escopo

- Visão de calendário mensal (apenas semanal no MVP)
- Integração automática coleta → compra
- View mobile dedicada para motorista
- Notificações (e-mail/push) ao fornecedor ou motorista
- Rotas/mapa
- Atualização dos outros KPIs do mockup (Vendas mês, Volume processado, Estoque em valor) — entram em spec separado

## 4. Modelo de dados

### 4.1 Entidade `coletas` (tenant schema, só segmento RECYCLING)

| Coluna | Tipo | Constraints |
|--------|------|-------------|
| `id` | UUID | PK, default `gen_random_uuid()` |
| `supplier_id` | UUID | NOT NULL, FK → `suppliers(id)` ON DELETE RESTRICT |
| `employee_id` | UUID | Nullable, FK → `users(id)` ON DELETE SET NULL |
| `scheduled_at` | TIMESTAMPTZ | NOT NULL |
| `status` | VARCHAR | NOT NULL, default `'AGENDADA'` |
| `notes` | VARCHAR | Nullable |
| `created_at` | TIMESTAMPTZ | default NOW() |
| `updated_at` | TIMESTAMPTZ | default NOW() |

Índices: `idx_coletas_scheduled_at`, `idx_coletas_status`.

**Status permitidos:** `AGENDADA` (default), `CONCLUIDA`, `CANCELADA`.

**Regras de transição:**
- `AGENDADA` → `CONCLUIDA` ou `CANCELADA` (permitido)
- Qualquer outra transição → `BadRequestException`
- `DELETE` bloqueado se status ≠ `AGENDADA` (use cancelar para estados terminais)

**Endereço da coleta:** derivado de `supplier.address` (JSONB). Não duplicado na tabela de coletas — se o fornecedor mudar de endereço, as coletas refletem automaticamente.

**Motorista:** `UserEntity` com `role = EMPLOYEE`. Validação no service: se `employee_id` for enviado, conferir que o usuário existe e tem role `EMPLOYEE`.

### 4.2 Entidade `coleta_comments`

| Coluna | Tipo | Constraints |
|--------|------|-------------|
| `id` | UUID | PK |
| `coleta_id` | UUID | NOT NULL, FK → `coletas(id)` ON DELETE CASCADE |
| `texto` | VARCHAR | NOT NULL |
| `created_by_id` | UUID | NOT NULL (user) |
| `created_at` | TIMESTAMPTZ | default NOW() |

Mesmo modelo de `appointment_comments` de oficina.

### 4.3 Extensão de `employee_permissions`

Nova coluna:

```sql
can_manage_coletas BOOLEAN NOT NULL DEFAULT true
```

### 4.4 Enum compartilhado

Adicionar em `packages/shared/src/`:

```ts
export enum ColetaStatus {
  AGENDADA = 'AGENDADA',
  CONCLUIDA = 'CONCLUIDA',
  CANCELADA = 'CANCELADA',
}

export type Coleta = {
  id: string;
  supplierId: string;
  employeeId: string | null;
  scheduledAt: string;       // ISO
  status: ColetaStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ColetaComment = {
  id: string;
  coletaId: string;
  texto: string;
  createdById: string;
  createdAt: string;
};

export type TopMaterial = {
  productId: string;
  name: string;
  volumeKg: number;
  avgPricePerKg: number;
  changePct: number | null;
};
```

## 5. Backend — Fase 1 (Top Materiais)

### 5.1 Endpoint

```
GET /recycling/reports/top-materials?month=YYYY-MM&limit=5
```

- **Guards:** `JwtAuthGuard` + `RolesGuard` + `@Roles(UserRole.OWNER)` (consistente com `getPurchasesByPeriod`)
- **Query params:** `month` opcional (default = mês atual do servidor), `limit` opcional (default 5, max 20)
- **Validação:** DTO `TopMaterialsQueryDto` com `class-validator` (`month` regex `^\d{4}-\d{2}$`, `limit` int 1–20)

### 5.2 Resposta

```ts
TopMaterial[]
```

Ordenado por `volumeKg DESC`.

### 5.3 Implementação em `RecyclingReportsService.getTopMaterials`

No mesmo `withQueryRunner(tenantId, ...)`:

1. **Query do mês corrente** — JOIN `purchase_items` × `purchases` × `products`, filtro por `purchased_at` entre primeiro e último dia do mês (via `date_trunc('month', ...)`), `GROUP BY product_id, name`, `ORDER BY SUM(quantity) DESC`, `LIMIT :limit`.
   - `volumeKg` = `SUM(quantity)`
   - `avgPricePerKg` = `SUM(subtotal) / SUM(quantity)`

2. **Query do mês anterior** — mesma lógica, retornando `{ productId, volumeKg }` apenas para cálculo de `changePct`. Produtos no top do mês atual que não existiam no anterior: `changePct = null`. Cálculo: `((atual - anterior) / anterior) * 100`, arredondado para 1 casa.

### 5.4 Extensão do `getDashboardSummary`

Novo campo na resposta: `totalPurchasedMonth: number` — soma de `total_amount` em `purchases` onde `purchased_at` está no mês corrente.

### 5.5 Testes

`reports.service.spec.ts`:
- `getTopMaterials` — caso normal, mês sem dados, produto novo (sem referência anterior)
- `getDashboardSummary` — cobertura atualizada para incluir `totalPurchasedMonth`

## 6. Backend — Fase 2 (Coletas)

### 6.1 Mudanças no schema do tenant

**Alterar** `apps/backend/src/database/tenant-migrations/create-tenant-tables.ts`, dentro do array `recyclingTables`: adicionar `CREATE TABLE` para `coletas` e `coleta_comments`, e incluir a coluna `can_manage_coletas` na criação de `employee_permissions`.

**Nova migration global** `apps/backend/src/database/migrations/1746000000000-AddColetasToRecyclingTenants.ts`:

- `up()`: consulta `public.tenants WHERE segment = 'RECYCLING'`, para cada tenant executa os CREATE TABLE + ALTER COLUMN no schema `tenant_<uuid>`
- `down()`: DROP das tabelas novas + DROP da coluna

Padrão já usado em migrations anteriores do projeto.

### 6.2 Módulo `coletas/`

Estrutura em `apps/backend/src/modules/recycling/coletas/`:

```
coletas/
├── coletas.module.ts
├── coletas.controller.ts
├── coletas.service.ts
├── coletas.service.spec.ts
├── coleta.entity.ts
├── coleta-comment.entity.ts
├── coleta-comments.controller.ts
├── coleta-comments.service.ts
├── coleta-comments.service.spec.ts
└── dto/
    ├── create-coleta.dto.ts
    ├── update-coleta.dto.ts
    ├── update-status.dto.ts
    ├── list-coletas-query.dto.ts
    └── create-comment.dto.ts
```

Registrar o módulo em `recycling.module.ts`.

### 6.3 Endpoints

Todos com `@UseGuards(JwtAuthGuard, EmployeePermissionsGuard)` e decorator `@RequirePermission('canManageColetas')` (padrão dos outros controllers do módulo). Guard já aceita `OWNER` como bypass automático.

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/recycling/coletas?start=&end=&status=` | Lista por janela de datas (usado pelo calendário/lista) |
| GET | `/recycling/coletas/upcoming?limit=4` | Próximas AGENDADAS ordenadas por `scheduled_at ASC` |
| GET | `/recycling/coletas/:id` | Detalhe com supplier e employee expandidos |
| POST | `/recycling/coletas` | Cria coleta |
| PUT | `/recycling/coletas/:id` | Atualiza campos (não muda status) |
| PATCH | `/recycling/coletas/:id/status` | Transição de status |
| DELETE | `/recycling/coletas/:id` | Remove (apenas se status `AGENDADA`) |
| GET | `/recycling/coletas/:id/comments` | Lista comentários |
| POST | `/recycling/coletas/:id/comments` | Cria comentário (autor do JWT) |
| DELETE | `/recycling/coletas/:id/comments/:commentId` | Remove (autor ou OWNER) |

### 6.4 Regras de serviço

- `tenantId` extraído de `req.user.tenantId` no controller, passado explicitamente para o service
- Padrão `withSchema(tenantId, fn)` para escopo de schema (igual ao resto do módulo)
- Validação de `supplier_id` no `create` (deve existir no tenant)
- Validação de `employee_id`, se presente, deve referenciar user com `role=EMPLOYEE`
- Transições de status validadas no service (não confiar no cliente)
- Listagem por janela aceita `status` opcional para filtrar

### 6.5 Testes

- `coletas.service.spec.ts`: criar, atualizar, transições válidas e inválidas, delete bloqueado em status terminal, listagem por janela, upcoming
- `coleta-comments.service.spec.ts`: criar, listar, delete por autor vs delete por OWNER vs 403

## 7. Frontend — Fase 1 (Top Materiais widget)

### 7.1 Serviço

Adicionar em `src/services/recycling/reports.service.ts`:

```ts
async getTopMaterials(month?: string, limit = 5): Promise<TopMaterial[]>
```

Exportar tipo `TopMaterial` (do shared).

### 7.2 Hook

Adicionar em `src/hooks/recycling/useReports.ts`:

```ts
export function useTopMaterials(month?: string, limit = 5)
// retorna { materials, loading, error, refetch }
```

### 7.3 Widget no dashboard

Componente inline em `pages/recycling/DashboardPage.tsx` (mesma convenção dos outros widgets do arquivo, sem componentização prematura).

Estrutura:
- Card com `CardHeader` título "Top materiais", descrição "volume comprado no mês", ação: link "Ver estoque →" para `/recycling/stock`
- 5 linhas, cada uma:
  - Barra horizontal fina no topo, largura proporcional ao `volumeKg` do maior da lista
  - Nome do produto à esquerda
  - `R$ X,YY/kg` em cinza suave (texto secundário)
  - Peso (ex.: `820 kg`) em negrito
  - Delta: `+14%` em verde, `-2%` em vermelho, `—` se `null`
- Cor da barra: paleta de 5 tons primários do tema, cíclica por posição

**Estados:**
- Loading: `CSpinner` centralizado
- Erro: `CAlert` color="danger" (mesmo padrão do `useDashboardSummary`)
- Vazio: "Sem compras no mês ainda — registre uma compra para ver o ranking."

### 7.4 KPI "Compras (mês)"

Renomear label e usar `summary.totalPurchasedMonth` (novo campo do endpoint) em vez de `totalPurchasedToday`. Sub-label muda para algo como "X operações no mês".

## 8. Frontend — Fase 2 (Coletas)

### 8.1 Sidebar

Em `RecyclingLayout.tsx` navItems, adicionar entre "Vendas" e "Fornecedores":

```ts
{ label: 'Coletas', icon: cilTruck, path: '/recycling/coletas', ownerOnly: false }
```

### 8.2 Rota

Em `App.tsx`, dentro do bloco `/recycling`:

```tsx
<Route path="coletas" element={<ColetasPage />} />
```

Criar/editar acontecem via dialog/drawer na própria página — sem rota dedicada, igual a Agendamentos.

### 8.3 Estrutura frontend

`src/pages/recycling/coletas/`:

```
coletas/
├── ColetasPage.tsx          # página principal (calendário/lista + dialog + drawer)
├── ColetaFormDialog.tsx     # form de criar/editar
├── ColetaDrawer.tsx         # drawer de detalhes + comentários
└── ColetaCalendar.tsx       # visão semanal (componente interno da página)
```

`ColetasPage` espelha `AppointmentsPage` do workshop: helpers `getWeekDates`, `StatusPill`, grid `HOURS × DAYS`, toggle view, navegação `< Hoje >`.

### 8.4 Serviço e hooks

- `src/services/recycling/coletas.service.ts` — CRUD + comments (padrão de `appointments.service.ts`)
- `src/hooks/recycling/useColetas.ts`:
  - `useColetasByWeek(referenceDate)`
  - `useUpcomingColetas(limit)`
  - `useColetaComments(coletaId)`

### 8.5 ColetaFormDialog

Campos:
- **Fornecedor** (obrigatório) — autocomplete com busca (`suppliersService.list` com `?search=`)
- **Data e hora** (obrigatório) — dois inputs (`type="date"` + `type="time"`), combinados em ISO no submit
- **Motorista** (opcional) — select carregado de `employeesService.list()`, com opção "— Sem motorista vinculado —"
- **Observações** (opcional) — textarea

Validação via `react-hook-form` + `zod`.

### 8.6 ColetaDrawer

- Topo: `StatusPill` grande com cor do status
- Info (labeled):
  - Fornecedor (nome)
  - Endereço (formatado de `supplier.address`; "Endereço não cadastrado" se `null`)
  - Telefone do fornecedor (se existir)
  - Motorista (nome ou "—")
  - Data/Hora
- Ações:
  - `Editar` — abre `ColetaFormDialog` pré-preenchido
  - `Concluir` — só se status AGENDADA, com confirmação
  - `Cancelar` — só se AGENDADA, com confirmação
  - `Deletar` — só se AGENDADA, com confirmação
- Seção "Comentários": lista com autor + timestamp, input no rodapé, submit cria via `POST /comments`

### 8.7 Card do calendário

Altura fixa 30 min (sem campo de duração):
- `HH:MM` em negrito pequeno
- Nome do fornecedor truncado
- Borda esquerda grossa com cor do status
- Click abre drawer

### 8.8 Widget "Próximas coletas" no dashboard

Componente inline em `DashboardPage.tsx`. Consome `useUpcomingColetas(4)`.

Layout por linha (4 linhas):
- Coluna esquerda: horário (`HH:MM`) em negrito + label relativa (`HOJE` / `AMANHÃ` / `seg, 22 abr`) em cinza
- Coluna central: nome do fornecedor em negrito + endereço abreviado em cinza
- Coluna direita: `StatusPill`

Link "Ver todas →" no header navega para `/recycling/coletas`.

**Estados:**
- Loading: `CSpinner`
- Vazio: "Nenhuma coleta agendada." + botão "Nova coleta" que navega para `/recycling/coletas`
- Sem coletas em 48h: exibe as próximas 4 de qualquer data com o label relativo correto

## 9. Permissões e segurança

- Não existe hoje um `SegmentGuard` no backend que restrinja rotas `/recycling/*` apenas a tenants com `segment=RECYCLING`. A separação de segmentos é feita no frontend via `PrivateRoute requiredSegment="RECYCLING"`. Esta spec **não** introduz um guard novo para isso — fora do escopo; documentado como gap conhecido
- Rotas de Coletas usam `JwtAuthGuard` + `EmployeePermissionsGuard` verificando `can_manage_coletas` (padrão dos outros módulos de recycling)
- OWNER tem acesso implícito via checagem de role no guard de permissões (não precisa da flag)
- Endpoint de Top Materiais segue `@Roles(UserRole.OWNER)` (consistente com outros reports)

## 10. Riscos e mitigação

| Risco | Mitigação |
|-------|-----------|
| Migration em múltiplos schemas falha parcialmente | Testar em local com ≥2 tenants RECYCLING antes do deploy; envolver cada schema em transação separada |
| Timezone do `scheduled_at` / "mês atual" ambíguo | `date_trunc('month', ...)` usa timezone do servidor; tenant multi-fuso não é requisito. Documentar no spec |
| `supplier.address` pode ser `null` | Drawer e widget exibem "Endereço não cadastrado" |
| Delete de coleta com comentários | `ON DELETE CASCADE` nos comments resolve |
| OWNER deleta funcionário vinculado a coletas existentes | `ON DELETE SET NULL` em `employee_id` preserva histórico |

## 11. Rollout sugerido (entrada do plano)

### Fase 1 (um PR)
1. Backend: endpoint `getTopMaterials` + DTO + teste
2. Backend: ajustar `getDashboardSummary` para incluir `totalPurchasedMonth`
3. Frontend: serviço + hook + widget "Top materiais"
4. Frontend: renomear KPI "Compras (hoje)" → "Compras (mês)"

### Fase 2 (outro PR — pode subdividir)
5. Shared: enum `ColetaStatus` + tipos `Coleta`, `ColetaComment`, `TopMaterial`
6. Backend: entities + migration global + alteração em `create-tenant-tables.ts`
7. Backend: módulo Coletas (CRUD + status) + testes
8. Backend: módulo de comentários + testes
9. Backend: flag `can_manage_coletas` + integração no guard
10. Frontend: serviço + hooks
11. Frontend: `ColetasPage` (lista + calendário + toggle + navegação)
12. Frontend: `ColetaFormDialog`
13. Frontend: `ColetaDrawer` + comentários
14. Frontend: widget "Próximas coletas" no dashboard
15. Frontend: item de sidebar + rota

## 12. Testes manuais de aceitação

**Fase 1:**
- Dashboard mostra top 5 materiais do mês corrente
- Materiais sem compras no mês anterior exibem `—` em vez de %
- KPI "Compras (mês)" bate com soma das compras do mês

**Fase 2:**
- Criar coleta com fornecedor e data: aparece no calendário na semana certa
- Criar coleta sem motorista: salva com sucesso, drawer mostra "—" em motorista
- Concluir e cancelar coleta: status muda, card muda de cor, coleta some do widget "Próximas coletas"
- Tentar deletar coleta concluída: erro 400
- Adicionar e remover comentários no drawer
- Funcionário sem `can_manage_coletas`: 403 nas rotas
- Widget de dashboard mostra 4 próximas coletas corretas com labels HOJE/AMANHÃ/data
