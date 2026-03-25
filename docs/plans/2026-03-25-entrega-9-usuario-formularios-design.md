# Entrega 9 — Usuário, Sessão e Formulários

**Data:** 2026-03-25

## Objetivo

Quatro melhorias independentes:

1. Exibir nome e e-mail do usuário logado no avatar/dropdown
2. Contador regressivo de sessão no AppBar
3. Dialog pós-cadastro de cliente para adicionar veículo
4. Busca de cliente por CPF no cadastro de veículo

---

## Feature 1 — Nome/e-mail no JWT

### Problema

O JWT payload atual só contém `{ sub, tenant_id, role }`. O avatar exibe "?" e o dropdown exibe "—".

### Solução

**Backend — `apps/backend/src/modules/core/auth/auth.service.ts`**

Adicionar `name` e `email` ao payload em `generateTokens()`:

```typescript
const payload = {
  sub: user.id,
  tenant_id: user.tenantId,
  role: user.role,
  name: user.name,
  email: user.email,
};
```

**Frontend — `apps/frontend/src/store/auth.store.ts`**

Tornar `name` e `email` campos requeridos em `JwtUser` (atualmente estão como `string | undefined`):

```typescript
interface JwtUser {
  sub: string;
  tenant_id: string;
  role: 'OWNER' | 'EMPLOYEE';
  name: string;
  email: string;
  exp: number;
}
```

O avatar e dropdown passam a exibir dados reais automaticamente sem mudanças no `AppLayout`.

---

## Feature 2 — Contador regressivo de sessão

### Comportamento

- Aparece no AppBar à esquerda do avatar
- Formato: `MM:SS` (ex: `14:32`)
- Cor padrão (text.secondary) durante os primeiros 12 minutos
- Cor laranja (`warning.main`) quando restar < 3 minutos
- Quando chega a 0, o refresh token renova silenciosamente (mecanismo já existente)

### Implementação

**Novo hook — `apps/frontend/src/hooks/useSessionCountdown.ts`**

```typescript
export function useSessionCountdown(exp: number | undefined) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (!exp) return;
    const tick = () => setRemaining(Math.max(0, exp * 1000 - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [exp]);

  const minutes = Math.floor(remaining / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1000);
  const isWarning = remaining > 0 && remaining < 3 * 60_000;
  return { minutes, seconds, isWarning, expired: remaining === 0 };
}
```

**AppLayout (`apps/frontend/src/layouts/AppLayout.tsx`)**

```tsx
const { minutes, seconds, isWarning } = useSessionCountdown(user?.exp);

// No Toolbar, antes do avatar:
<Typography
  variant="caption"
  sx={{ color: isWarning ? 'warning.main' : 'text.secondary', fontVariantNumeric: 'tabular-nums' }}
>
  {`${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`}
</Typography>
```

---

## Feature 3 — Dialog pós-cadastro de cliente

### Comportamento

- Só aparece ao **criar** um novo cliente (não na edição)
- Após `customersService.create()` bem-sucedido, armazena `{ id, nome }` do cliente salvo
- Exibe `Dialog` com título "Cadastrar veículo?" e mensagem "Deseja cadastrar um veículo para **[Nome]**?"
- Botão **Não** → navega para `/workshop/customers`
- Botão **Sim** → navega para `/workshop/vehicles/new?customerId=<id>`

### Implementação

**`apps/frontend/src/pages/workshop/customers/CustomerFormPage.tsx`**

Adicionar estado:
```typescript
const [savedCustomer, setSavedCustomer] = useState<{ id: string; nome: string } | null>(null);
```

No `onSubmit`, ao criar:
```typescript
const created = await customersService.create(payload);
setSavedCustomer({ id: created.id, nome: created.nome });
// não navegar ainda
```

Dialog ao final do JSX:
```tsx
<Dialog open={Boolean(savedCustomer)} onClose={() => navigate('/workshop/customers')}>
  <DialogTitle>Cadastrar veículo?</DialogTitle>
  <DialogContent>
    <DialogContentText>
      Deseja cadastrar um veículo para <strong>{savedCustomer?.nome}</strong>?
    </DialogContentText>
  </DialogContent>
  <DialogActions>
    <Button onClick={() => navigate('/workshop/customers')}>Não</Button>
    <Button variant="contained" onClick={() => navigate(`/workshop/vehicles/new?customerId=${savedCustomer?.id}`)}>
      Sim
    </Button>
  </DialogActions>
</Dialog>
```

---

## Feature 4 — Busca de cliente por CPF no cadastro de veículo

### Comportamento

- Substitui o campo "ID do Cliente" (UUID manual) por dois elementos:
  1. TextField "CPF do Cliente" com máscara de dígitos
  2. Botão "Buscar" (também dispara no `onBlur`)
- Ao buscar: chama `GET /workshop/customers?search=<cpf>&limit=1`
  - Encontrado → chip/texto verde com nome do cliente; `customerId` preenchido internamente no RHF
  - Não encontrado → alerta vermelho "Cliente não encontrado para o CPF informado"
- O campo `customerId` permanece no schema Zod como `z.string().uuid(...)` (hidden), validado normalmente
- Se o formulário foi aberto via `?customerId=<uuid>` (vindo do dialog do cliente), a busca reversa deve exibir o nome do cliente pré-selecionado

### Implementação

**`apps/frontend/src/pages/workshop/vehicles/VehicleFormPage.tsx`**

Schema Zod sem mudança (mantém `customerId: z.string().uuid()`).

Estado adicional:
```typescript
const [cpfInput, setCpfInput] = useState('');
const [customerName, setCustomerName] = useState<string | null>(null);
const [cpfError, setCpfError] = useState<string | null>(null);
const [searching, setSearching] = useState(false);
```

Função de busca:
```typescript
const handleCpfSearch = async () => {
  if (!cpfInput.trim()) return;
  setSearching(true);
  setCpfError(null);
  try {
    const result = await customersService.list({ search: cpfInput.trim(), limit: 1 });
    const found = result.data.find((c) => c.cpfCnpj === cpfInput.trim());
    if (found) {
      setValue('customerId', found.id);
      setCustomerName(found.nome);
    } else {
      setValue('customerId', '');
      setCustomerName(null);
      setCpfError('Cliente não encontrado para o CPF informado.');
    }
  } finally {
    setSearching(false);
  }
};
```

Quando carregado com `?customerId=<uuid>` (via pre-fill), faz busca reversa:
```typescript
// No useEffect de pre-fill:
if (prefilledCustomerId) {
  customersService.getById(prefilledCustomerId).then((c) => {
    setValue('customerId', c.id);
    setCpfInput(c.cpfCnpj);
    setCustomerName(c.nome);
  });
}
```

JSX substitui o campo UUID por:
```tsx
<Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
  <TextField
    label="CPF do Cliente"
    value={cpfInput}
    onChange={(e) => setCpfInput(e.target.value.replace(/\D/g, ''))}
    onBlur={handleCpfSearch}
    inputProps={{ maxLength: 14 }}
    sx={{ flex: 1 }}
  />
  <Button variant="outlined" onClick={handleCpfSearch} disabled={searching} sx={{ mt: 0.5 }}>
    {searching ? <CircularProgress size={20} /> : 'Buscar'}
  </Button>
</Box>
{customerName && <Typography color="success.main" variant="body2">✓ {customerName}</Typography>}
{cpfError && <Alert severity="error" sx={{ mt: 1 }}>{cpfError}</Alert>}
{errors.customerId && <FormHelperText error>{errors.customerId.message}</FormHelperText>}
```

---

## Arquivos alterados

| Arquivo | Operação |
|---------|----------|
| `apps/backend/src/modules/core/auth/auth.service.ts` | Modificar — adicionar name/email ao payload |
| `apps/frontend/src/store/auth.store.ts` | Modificar — tornar name/email required em JwtUser |
| `apps/frontend/src/hooks/useSessionCountdown.ts` | Criar — hook countdown |
| `apps/frontend/src/layouts/AppLayout.tsx` | Modificar — exibir countdown no Toolbar |
| `apps/frontend/src/pages/workshop/customers/CustomerFormPage.tsx` | Modificar — dialog pós-criação |
| `apps/frontend/src/pages/workshop/vehicles/VehicleFormPage.tsx` | Modificar — busca por CPF |
