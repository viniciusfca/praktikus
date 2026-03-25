# Entrega 9 — Usuário, Sessão e Formulários Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Exibir nome/e-mail do usuário no avatar, contador de sessão no AppBar, dialog pós-cadastro de cliente e busca de cliente por CPF no cadastro de veículo.

**Architecture:** Quatro mudanças independentes. Feature 1 é backend + frontend store (sem nova tela). Features 2-4 são puramente frontend. Nenhum novo endpoint de backend é necessário — `GET /workshop/customers?search=<cpf>` já existe.

**Tech Stack:** React 18, MUI v6, TypeScript, Zustand, NestJS, react-hook-form, Zod

---

### Task 1: Adicionar name e email ao JWT (backend + frontend store)

**Files:**
- Modify: `apps/backend/src/modules/core/auth/auth.service.ts` (linha ~131)
- Modify: `apps/frontend/src/store/auth.store.ts` (interface JwtUser)

**Step 1: Modificar o payload do JWT no backend**

Em `apps/backend/src/modules/core/auth/auth.service.ts`, localizar o método `generateTokens` (linha ~130):

```typescript
// ANTES:
const payload = {
  sub: user.id,
  tenant_id: user.tenantId,
  role: user.role,
};

// DEPOIS:
const payload = {
  sub: user.id,
  tenant_id: user.tenantId,
  role: user.role,
  name: user.name,
  email: user.email,
};
```

**Step 2: Atualizar a interface JwtUser no frontend**

Em `apps/frontend/src/store/auth.store.ts`, tornar `name`, `email` e `exp` campos requeridos (remover `?`):

```typescript
// ANTES:
interface JwtUser {
  sub: string;
  tenant_id: string;
  role: 'OWNER' | 'EMPLOYEE';
  name?: string;
  email?: string;
  exp?: number;
}

// DEPOIS:
interface JwtUser {
  sub: string;
  tenant_id: string;
  role: 'OWNER' | 'EMPLOYEE';
  name: string;
  email: string;
  exp: number;
}
```

**Step 3: Verificar TypeScript**

```bash
cd apps/frontend && npx tsc -b 2>&1
```

Expected: zero errors. Se aparecer erro em `AppLayout.tsx` sobre `user?.name` ou `user?.exp`, verifique se ainda estão com `?.` — com os campos required, o `?.` continua funcional e não causa erro.

**Step 4: Verificar backend**

```bash
cd apps/backend && npx tsc --noEmit 2>&1
```

Expected: zero errors.

**Step 5: Commit**

```bash
git add apps/backend/src/modules/core/auth/auth.service.ts \
        apps/frontend/src/store/auth.store.ts
git commit -m "feat(auth): include name and email in JWT payload

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 2: Hook useSessionCountdown + contador no AppBar

**Files:**
- Create: `apps/frontend/src/hooks/useSessionCountdown.ts`
- Modify: `apps/frontend/src/layouts/AppLayout.tsx`

**Step 1: Criar o hook**

Criar `apps/frontend/src/hooks/useSessionCountdown.ts`:

```typescript
import { useEffect, useState } from 'react';

interface SessionCountdown {
  minutes: number;
  seconds: number;
  isWarning: boolean;
  expired: boolean;
}

export function useSessionCountdown(exp: number | undefined): SessionCountdown {
  const [remaining, setRemaining] = useState(() => {
    if (!exp) return 0;
    return Math.max(0, exp * 1000 - Date.now());
  });

  useEffect(() => {
    if (!exp) return;
    const tick = () => setRemaining(Math.max(0, exp * 1000 - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [exp]);

  const minutes = Math.floor(remaining / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1000);

  return {
    minutes,
    seconds,
    isWarning: remaining > 0 && remaining < 3 * 60_000,
    expired: remaining === 0,
  };
}
```

**Step 2: Adicionar o contador ao AppBar em AppLayout.tsx**

Em `apps/frontend/src/layouts/AppLayout.tsx`:

Adicionar import do hook (depois dos outros imports do projeto):
```typescript
import { useSessionCountdown } from '../hooks/useSessionCountdown';
```

Dentro do componente `AppLayout`, após as declarações de estado existentes, adicionar:
```typescript
const { minutes, seconds, isWarning } = useSessionCountdown(user?.exp);
```

No `Toolbar` do AppBar, logo após `<Box sx={{ flexGrow: 1 }} />` e antes do `{/* Theme toggle */}`:
```tsx
{/* Session countdown */}
{user && (
  <Typography
    variant="caption"
    sx={{
      color: isWarning ? 'warning.main' : 'text.disabled',
      fontVariantNumeric: 'tabular-nums',
      mr: 0.5,
    }}
  >
    {`${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`}
  </Typography>
)}
```

**Step 3: Verificar TypeScript**

```bash
cd apps/frontend && npx tsc -b 2>&1
```

Expected: zero errors.

**Step 4: Commit**

```bash
git add apps/frontend/src/hooks/useSessionCountdown.ts \
        apps/frontend/src/layouts/AppLayout.tsx
git commit -m "feat(layout): add session countdown timer to AppBar

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 3: Dialog pós-cadastro de cliente → cadastrar veículo

**Files:**
- Modify: `apps/frontend/src/pages/workshop/customers/CustomerFormPage.tsx`

**Step 1: Adicionar imports necessários**

Adicionar ao bloco de imports do MUI existente:
```typescript
import {
  Box, Button, Card, CardContent, TextField, Typography, Alert, CircularProgress,
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions,
} from '@mui/material';
```

E adicionar `useState` ao import do React:
```typescript
import { useEffect, useState } from 'react';
```

**Step 2: Adicionar estado para o dialog**

Dentro de `CustomerFormPage`, após as declarações de form (`useForm`):

```typescript
const [savedCustomer, setSavedCustomer] = useState<{ id: string; nome: string } | null>(null);
```

**Step 3: Modificar o onSubmit para mostrar dialog ao criar**

```typescript
const onSubmit = async (data: FormData) => {
  const payload = {
    nome: data.nome,
    cpfCnpj: data.cpfCnpj,
    whatsapp: data.whatsapp || undefined,
    email: data.email || undefined,
  };
  try {
    if (isEdit && id) {
      await customersService.update(id, payload);
      navigate('/workshop/customers');
    } else {
      const created = await customersService.create(payload);
      setSavedCustomer({ id: created.id, nome: created.nome });
      // não navegar ainda — dialog irá aparecer
    }
  } catch (err: any) {
    setError('root', {
      message: err?.response?.data?.message ?? 'Erro ao salvar cliente.',
    });
  }
};
```

**Step 4: Adicionar o Dialog ao final do JSX**

Logo antes do `</Box>` final do return (após o Card existente):

```tsx
<Dialog open={Boolean(savedCustomer)}>
  <DialogTitle>Cadastrar veículo?</DialogTitle>
  <DialogContent>
    <DialogContentText>
      Deseja cadastrar um veículo para <strong>{savedCustomer?.nome}</strong>?
    </DialogContentText>
  </DialogContent>
  <DialogActions>
    <Button onClick={() => navigate('/workshop/customers')}>
      Não
    </Button>
    <Button
      variant="contained"
      onClick={() => navigate(`/workshop/vehicles/new?customerId=${savedCustomer?.id}`)}
    >
      Sim
    </Button>
  </DialogActions>
</Dialog>
```

**Step 5: Verificar TypeScript**

```bash
cd apps/frontend && npx tsc -b 2>&1
```

Expected: zero errors.

**Step 6: Commit**

```bash
git add apps/frontend/src/pages/workshop/customers/CustomerFormPage.tsx
git commit -m "feat(customers): show dialog to add vehicle after new customer creation

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 4: Busca de cliente por CPF no cadastro de veículo

**Files:**
- Modify: `apps/frontend/src/pages/workshop/vehicles/VehicleFormPage.tsx`

**Context:** O campo `customerId` (UUID manual) será substituído por um campo CPF + botão "Buscar". O schema Zod mantém `customerId: z.string().uuid()` — o campo é preenchido internamente após a busca. O endpoint `GET /workshop/customers?search=<cpf>&limit=1` já existe e filtra por CPF/nome.

**Step 1: Adicionar imports necessários**

Completar o import do MUI (adicionar `FormHelperText`):
```typescript
import {
  Box, Button, Card, CardContent, TextField, Typography, Alert, CircularProgress,
  FormHelperText,
} from '@mui/material';
```

Adicionar `useState` e `setValue` ao form:
```typescript
import { useEffect, useState } from 'react';
```

Adicionar import do service de clientes:
```typescript
import { customersService } from '../../../services/customers.service';
```

**Step 2: Adicionar `setValue` ao useForm**

```typescript
const {
  register,
  handleSubmit,
  reset,
  setValue,                    // ← adicionar
  formState: { errors, isSubmitting },
  setError,
} = useForm<FormData>({ resolver: zodResolver(schema) as Resolver<FormData> });
```

**Step 3: Adicionar estados para o campo CPF**

Após o `useForm`, antes do `useEffect`:

```typescript
const [cpfInput, setCpfInput] = useState('');
const [customerName, setCustomerName] = useState<string | null>(null);
const [cpfError, setCpfError] = useState<string | null>(null);
const [searching, setSearching] = useState(false);
```

**Step 4: Criar função de busca**

```typescript
const handleCpfSearch = async () => {
  const cpf = cpfInput.trim();
  if (!cpf) return;
  setSearching(true);
  setCpfError(null);
  setCustomerName(null);
  try {
    const result = await customersService.list({ search: cpf, limit: 1 });
    const found = result.data.find((c) => c.cpfCnpj === cpf);
    if (found) {
      setValue('customerId', found.id, { shouldValidate: true });
      setCustomerName(found.nome);
    } else {
      setValue('customerId', '', { shouldValidate: false });
      setCpfError('Cliente não encontrado para o CPF informado.');
    }
  } catch {
    setCpfError('Erro ao buscar cliente. Tente novamente.');
  } finally {
    setSearching(false);
  }
};
```

**Step 5: Atualizar o useEffect para busca reversa quando customerId vem via query param**

O useEffect existente já define `customerId` via reset. Estender para também buscar o nome do cliente quando vem pre-preenchido:

```typescript
useEffect(() => {
  const prefilledCustomerId = searchParams.get('customerId');
  if (isEdit && id) {
    vehiclesService.getById(id).then((v) => {
      reset({ customerId: v.customerId, placa: v.placa, marca: v.marca, modelo: v.modelo, ano: v.ano, km: v.km });
      // Busca reversa: exibir o nome do cliente na edição
      customersService.getById(v.customerId).then((c) => {
        setCpfInput(c.cpfCnpj);
        setCustomerName(c.nome);
      }).catch(() => {/* ignora erro de display */});
    });
  } else if (prefilledCustomerId) {
    reset({ customerId: prefilledCustomerId, placa: '', marca: '', modelo: '', ano: currentYear, km: 0 });
    // Busca reversa: exibir o nome do cliente quando vindo do dialog pós-cadastro
    customersService.getById(prefilledCustomerId).then((c) => {
      setCpfInput(c.cpfCnpj);
      setCustomerName(c.nome);
    }).catch(() => {/* ignora erro de display */});
  }
}, [id, isEdit, reset, searchParams]);
```

**Step 6: Substituir o campo "ID do Cliente" no JSX**

Substituir o TextField atual:
```tsx
// REMOVER:
<TextField
  label="ID do Cliente"
  fullWidth
  margin="normal"
  {...register('customerId')}
  error={!!errors.customerId}
  helperText={errors.customerId?.message}
/>

// ADICIONAR:
<Box sx={{ mt: 1, mb: 0.5 }}>
  <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
    <TextField
      label="CPF do Cliente"
      value={cpfInput}
      onChange={(e) => setCpfInput(e.target.value.replace(/\D/g, ''))}
      onBlur={handleCpfSearch}
      inputProps={{ maxLength: 14 }}
      sx={{ flex: 1 }}
      error={Boolean(cpfError || errors.customerId)}
    />
    <Button
      variant="outlined"
      onClick={handleCpfSearch}
      disabled={searching || !cpfInput.trim()}
      sx={{ mt: 0.5, minWidth: 90, height: 56 }}
    >
      {searching ? <CircularProgress size={20} /> : 'Buscar'}
    </Button>
  </Box>
  {customerName && (
    <Typography variant="body2" color="success.main" sx={{ mt: 0.5 }}>
      ✓ {customerName}
    </Typography>
  )}
  {cpfError && (
    <Alert severity="error" sx={{ mt: 1 }}>{cpfError}</Alert>
  )}
  {errors.customerId && !cpfError && (
    <FormHelperText error>{errors.customerId.message}</FormHelperText>
  )}
</Box>
```

**Step 7: Verificar TypeScript**

```bash
cd apps/frontend && npx tsc -b 2>&1
```

Expected: zero errors.

**Step 8: Commit**

```bash
git add apps/frontend/src/pages/workshop/vehicles/VehicleFormPage.tsx
git commit -m "feat(vehicles): replace customer UUID field with CPF lookup

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```
