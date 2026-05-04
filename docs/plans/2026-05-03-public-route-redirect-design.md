# Design: Redirect de rotas públicas quando autenticado

**Data:** 2026-05-03
**Status:** Proposta — pronta para virar plano de execução

---

## Problema

Quando um usuário autenticado navega para uma rota pública (ex: digita `localhost:8080/` na URL), o frontend renderiza a página pública mesmo já estando logado. A `LandingPage` mostra CTAs "Cadastre-se / Login", parecendo que a sessão expirou — mas o token JWT continua válido no localStorage. É um bug de roteamento, não de autenticação.

**Reprodução:** loga no app, depois digita `localhost:8080/` na barra → vê a landing page.

**Rotas afetadas hoje** (em [App.tsx:58-66](../../apps/frontend/src/App.tsx#L58-L66)):
- `/` → `LandingPage`
- `/login` → `LoginPage`
- `/register` → `RegisterSegmentPage`
- `/register/workshop` → `RegisterPage`
- `/register/recycling` → `RegisterRecyclingPage`
- `/forgot-password` → `ForgotPasswordPage`

Todas renderizam sem checar `useAuthStore`.

---

## Solução

Componente novo `PublicOnlyRoute` que espelha o padrão de [`PrivateRoute`](../../apps/frontend/src/components/PrivateRoute.tsx) existente: lê `useAuthStore` e redireciona o usuário autenticado para o dashboard apropriado.

### Decisão por estado

| Estado | Comportamento |
|---|---|
| `!isAuthenticated` | Renderiza `children` normalmente |
| `isAuthenticated && tenant_status === 'SUSPENDED'` | `<Navigate to="/suspended" replace />` |
| `isAuthenticated && tenant_segment === 'WORKSHOP'` | `<Navigate to="/workshop/dashboard" replace />` |
| `isAuthenticated && tenant_segment === 'RECYCLING'` | `<Navigate to="/recycling/dashboard" replace />` |

`replace` no `Navigate` evita poluir o histórico do browser (back-button volta para a página anterior, não para a pública intermediária).

### Rotas a serem envolvidas

| Rota | Wrap em PublicOnlyRoute? | Motivo |
|---|---|---|
| `/` | ✓ | landing — usuário logado deve ir pro dashboard |
| `/login` | ✓ | já está logado |
| `/register` | ✓ | seleção de segmento — não faz sentido recadastrar |
| `/register/workshop` | ✓ | form de cadastro |
| `/register/recycling` | ✓ | form de cadastro |
| `/forgot-password` | ✓ | já está logado, não precisa recuperar senha |
| `/reset-password/:token` | ✗ | usuário pode usar token de reset mesmo logado em outra conta |
| `/quotes/:token` | ✗ | token de aprovação de orçamento — fluxo do cliente final, fora do tenant |
| `/suspended` | ✗ | é a página de aterrissagem para usuários suspended |

---

## Arquivos afetados

- **Criar:** `apps/frontend/src/components/PublicOnlyRoute.tsx`
- **Criar:** `apps/frontend/src/components/PublicOnlyRoute.test.tsx` (cobre os 4 estados de decisão)
- **Modificar:** `apps/frontend/src/App.tsx` (envolver 6 rotas com `<PublicOnlyRoute>`)

---

## Diagrama de decisão

```
Usuário acessa rota pública (/, /login, /register*, /forgot-password)
    │
    ├─ isAuthenticated == false  ──▶  Renderiza a página pública (landing/login/etc)
    │
    └─ isAuthenticated == true
            │
            ├─ tenant_status === 'SUSPENDED'  ──▶  /suspended
            │
            ├─ tenant_segment === 'RECYCLING' ──▶  /recycling/dashboard
            │
            └─ tenant_segment === 'WORKSHOP'  ──▶  /workshop/dashboard
                                                  (default — fallback se segment indefinido)
```

---

## Edge cases

- **Token expirado mas presente no localStorage:** o `useAuthStore` decodifica o JWT e o campo `exp` está disponível. Se `exp <= now`, considerar `isAuthenticated = false`. Verificar se a store já faz isso hoje; caso não, esse comportamento é fora do escopo deste fix (issue separado).
- **`tenant_segment` undefined no JWT:** fallback para `/workshop/dashboard` (mesmo default usado em `auth.service.ts:generateTokens`).
- **Rotas de filhos `/workshop/*` e `/recycling/*` permanecem inalteradas:** seguem usando `<PrivateRoute requiredSegment="...">`.

---

## Testes

`PublicOnlyRoute.test.tsx` cobre exatamente 4 cenários (espelhando o teste de `PrivateRoute`):

1. Não autenticado → renderiza children
2. Autenticado + SUSPENDED → redireciona para `/suspended`
3. Autenticado + WORKSHOP → redireciona para `/workshop/dashboard`
4. Autenticado + RECYCLING → redireciona para `/recycling/dashboard`

Mock do `useAuthStore` segue o padrão já usado em `PrivateRoute.test.tsx`.

---

## Estimativa

~3 tarefas atômicas, ~30 minutos de implementação:

1. Criar `PublicOnlyRoute.tsx` + spec (TDD).
2. Envolver as 6 rotas em `App.tsx`.
3. Smoke test manual: logar, digitar `/` na URL, confirmar redirect para dashboard correto.

---

## Próximos passos

1. User review deste spec.
2. Geração do plano de execução via skill `superpowers:writing-plans`.
3. Implementação via `superpowers:subagent-driven-development` (ou inline, dada a simplicidade).
