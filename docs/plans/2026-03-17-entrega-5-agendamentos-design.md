# Entrega 5: Agendamentos — Design Document
**Date:** 2026-03-17
**Status:** Approved

---

## 1. Objetivo

Implementar CRUD de agendamentos com linha do tempo de comentários, alerta de conflito de horário (sem bloqueio), calendário semanal visual e lista paginada.

---

## 2. Modelo de Dados (tenant schema)

```sql
-- tenant_<uuid>.appointments
id             uuid          PK  DEFAULT gen_random_uuid()
cliente_id     uuid          NOT NULL  -- sem FK constraint (cross-schema)
veiculo_id     uuid          NOT NULL  -- sem FK constraint (cross-schema)
data_hora      timestamptz   NOT NULL
duracao_min    int           NOT NULL DEFAULT 60
tipo_servico   varchar       NULLABLE
status         varchar       NOT NULL DEFAULT 'PENDENTE'
created_at     timestamptz   DEFAULT now()
updated_at     timestamptz   DEFAULT now()

-- tenant_<uuid>.appointment_comments
id              uuid    PK  DEFAULT gen_random_uuid()
appointment_id  uuid    NOT NULL REFERENCES appointments(id) ON DELETE CASCADE
texto           varchar NOT NULL
created_by_id   uuid    NOT NULL  -- user ID, sem FK cross-schema
created_at      timestamptz DEFAULT now()
```

**Status:** `PENDENTE → CONFIRMADO → CONCLUIDO | CANCELADO`

Sem FK constraints para `cliente_id`/`veiculo_id` — isolamento garantido pelo schema per tenant.

---

## 3. Abordagem: AppointmentsModule único

Módulo `workshop/appointments/` com um controller principal e um sub-resource de comentários. Segue o mesmo padrão dos módulos anteriores (`withSchema<T>`, `getSchemaName` com UUID validation).

---

## 4. Backend API

Todos os endpoints requerem `JwtAuthGuard`. `tenantId` lido de `req.user.tenantId`. Deleção requer role `OWNER`.

### Agendamentos — `/api/workshop/appointments`

| Método | Rota  | Descrição                                                               | Roles      |
|--------|-------|-------------------------------------------------------------------------|------------|
| GET    | /     | Lista. Query: `date_start`, `date_end`, `status`                        | ALL        |
| GET    | /:id  | Detalhe com array de comments                                           | ALL        |
| POST   | /     | Criar. Retorna `{ data, conflicts: [] }` se há sobreposição de horário  | ALL        |
| PATCH  | /:id  | Editar campos + transição de status                                     | ALL        |
| DELETE | /:id  | Deletar agendamento                                                     | OWNER only |

### Comentários — `/api/workshop/appointments/:id/comments`

| Método | Rota          | Descrição            | Roles      |
|--------|---------------|----------------------|------------|
| POST   | /             | Adicionar comentário | ALL        |
| DELETE | /:commentId   | Deletar comentário   | OWNER only |

### Lógica de conflito

No `POST` e `PATCH`, verificar agendamentos com sobreposição temporal:
- `data_hora < new_data_hora + new_duracao_min minutes`
- `data_hora + duracao_min minutes > new_data_hora`
- `status NOT IN ('CANCELADO', 'CONCLUIDO')`

Se houver sobreposição: retornar `HTTP 201` normal com campo extra `conflicts: [{ id, data_hora, tipo_servico }]`.

---

## 5. Validações

| Campo         | Regra                                             |
|---------------|---------------------------------------------------|
| `cliente_id`  | `@IsUUID()` — obrigatório                         |
| `veiculo_id`  | `@IsUUID()` — obrigatório                         |
| `data_hora`   | `@IsDateString()` — obrigatório                   |
| `duracao_min` | `@IsInt()` `@Min(15)` — default 60                |
| `tipo_servico`| Opcional, sem validação                           |
| `status`      | `@IsIn(['PENDENTE','CONFIRMADO','CONCLUIDO','CANCELADO'])` |
| `texto`       | `@MinLength(1)` — obrigatório no comment          |

---

## 6. Frontend

### Página

| Componente         | Rota                    | Descrição                             |
|--------------------|-------------------------|---------------------------------------|
| `AppointmentsPage` | `/workshop/appointments`| Página com toggle calendário / lista  |

### Modos de Visualização

- **Calendário semanal** (padrão): grid MUI custom, horários 07:00–20:00, navegação por semana com setas. Cada agendamento = card colorido por status. Click → drawer lateral com detalhes + formulário de comentário.
- **Lista**: tabela paginada com colunas Data/Hora, Cliente, Veículo, Tipo de Serviço, Status, Ações (editar/deletar).

**Cores por status:**
- `PENDENTE` → laranja
- `CONFIRMADO` → azul
- `CONCLUIDO` → verde
- `CANCELADO` → cinza

### Formulário (modal MUI Dialog)

Campos: Cliente (autocomplete), Veículo (autocomplete filtrado pelo cliente selecionado), Data, Hora, Duração em minutos, Tipo de serviço (texto livre), Status.

Se conflito ao salvar → toast/alert amarelo de aviso (não bloqueia a criação).

### Drawer de Detalhe

- Dados do agendamento (cliente, veículo, data/hora, duração, tipo, status)
- Botões: Editar, Deletar (OWNER), Alterar status
- Timeline de comentários (lista com data/hora + texto)
- Campo + botão para adicionar novo comentário

### Serviço

`apps/frontend/src/services/appointments.service.ts`
- `appointmentsApi`: `list`, `getById`, `create`, `update`, `delete`
- `appointmentCommentsApi`: `create`, `delete`

---

## 7. Fora do Escopo (v2)

- Notificações/lembretes automáticos (WhatsApp/email)
- Recorrência de agendamentos
- Bloqueio de horários (agenda da oficina)
- Agendamento pelo cliente via link público
- Integração direta com OS na mesma tela (será na Entrega 6)
