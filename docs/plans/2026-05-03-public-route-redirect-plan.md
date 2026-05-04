# Public Route Redirect — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When an authenticated user hits a public route (`/`, `/login`, `/register*`, `/forgot-password`), redirect them to their segment dashboard (or `/suspended` if the tenant is suspended) instead of rendering the public page.

**Architecture:** New component `PublicOnlyRoute` mirrors the existing `PrivateRoute` pattern: reads `useAuthStore`, waits for hydration, and either renders `children` (when not authenticated) or returns `<Navigate>` (when authenticated). Six routes in `App.tsx` get wrapped; three intentionally do not.

**Tech Stack:** React 19, react-router-dom v6, Zustand store (`useAuthStore`), Vitest + React Testing Library.

**Spec de referência:** [docs/plans/2026-05-03-public-route-redirect-design.md](2026-05-03-public-route-redirect-design.md)

---

## File Structure

- **Create:** `apps/frontend/src/components/PublicOnlyRoute.tsx` — single component, mirrors `PrivateRoute.tsx` shape and conventions.
- **Create:** `apps/frontend/src/components/PublicOnlyRoute.test.tsx` — Vitest spec covering 5 scenarios (not auth, suspended, workshop, recycling, not hydrated).
- **Modify:** `apps/frontend/src/App.tsx` — wrap 6 public routes with `<PublicOnlyRoute>`. Three routes remain bare (`/reset-password/:token`, `/quotes/:token`, `/suspended`).

---

## Task 1: Create `PublicOnlyRoute` component (TDD)

**Files:**
- Create: `apps/frontend/src/components/PublicOnlyRoute.test.tsx`
- Create: `apps/frontend/src/components/PublicOnlyRoute.tsx`

- [ ] **Step 1.1: Write the failing test**

Cria `apps/frontend/src/components/PublicOnlyRoute.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import { PublicOnlyRoute } from './PublicOnlyRoute';

vi.mock('../store/auth.store', () => ({
  useAuthStore: vi.fn(),
}));

import { useAuthStore } from '../store/auth.store';
const mockUseAuthStore = useAuthStore as any;

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/"
          element={
            <PublicOnlyRoute>
              <div>Landing</div>
            </PublicOnlyRoute>
          }
        />
        <Route path="/workshop/dashboard" element={<div>Workshop Dashboard</div>} />
        <Route path="/recycling/dashboard" element={<div>Recycling Dashboard</div>} />
        <Route path="/suspended" element={<div>Suspended Page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('PublicOnlyRoute', () => {
  it('renders children when not authenticated', () => {
    mockUseAuthStore.mockImplementation((selector: any) =>
      selector({ isAuthenticated: false, isHydrated: true, user: null }),
    );
    renderAt('/');
    expect(screen.getByText('Landing')).toBeInTheDocument();
  });

  it('redirects WORKSHOP authenticated user to /workshop/dashboard', () => {
    mockUseAuthStore.mockImplementation((selector: any) =>
      selector({
        isAuthenticated: true,
        isHydrated: true,
        user: { tenant_status: 'ACTIVE', tenant_segment: 'WORKSHOP' },
      }),
    );
    renderAt('/');
    expect(screen.queryByText('Landing')).not.toBeInTheDocument();
    expect(screen.getByText('Workshop Dashboard')).toBeInTheDocument();
  });

  it('redirects RECYCLING authenticated user to /recycling/dashboard', () => {
    mockUseAuthStore.mockImplementation((selector: any) =>
      selector({
        isAuthenticated: true,
        isHydrated: true,
        user: { tenant_status: 'ACTIVE', tenant_segment: 'RECYCLING' },
      }),
    );
    renderAt('/');
    expect(screen.queryByText('Landing')).not.toBeInTheDocument();
    expect(screen.getByText('Recycling Dashboard')).toBeInTheDocument();
  });

  it('redirects SUSPENDED user to /suspended (regardless of segment)', () => {
    mockUseAuthStore.mockImplementation((selector: any) =>
      selector({
        isAuthenticated: true,
        isHydrated: true,
        user: { tenant_status: 'SUSPENDED', tenant_segment: 'WORKSHOP' },
      }),
    );
    renderAt('/');
    expect(screen.queryByText('Landing')).not.toBeInTheDocument();
    expect(screen.getByText('Suspended Page')).toBeInTheDocument();
  });

  it('renders nothing while not yet hydrated', () => {
    mockUseAuthStore.mockImplementation((selector: any) =>
      selector({ isAuthenticated: false, isHydrated: false, user: null }),
    );
    const { container } = renderAt('/');
    expect(container.firstChild).toBeNull();
  });
});
```

- [ ] **Step 1.2: Run the test to verify it fails**

Run from repo root:
```
source "$HOME/.nvm/nvm.sh" && nvm use 20 > /dev/null && pnpm --filter frontend test -- --run PublicOnlyRoute
```

Expected: FAIL with "Cannot find module './PublicOnlyRoute'" (or similar import error).

- [ ] **Step 1.3: Implement the component**

Cria `apps/frontend/src/components/PublicOnlyRoute.tsx`:

```typescript
import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';

interface Props {
  children: ReactNode;
}

export function PublicOnlyRoute({ children }: Props) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isHydrated = useAuthStore((s) => s.isHydrated);
  const user = useAuthStore((s) => s.user);

  if (!isHydrated) return null;
  if (!isAuthenticated) return <>{children}</>;

  if (user?.tenant_status === 'SUSPENDED') {
    return <Navigate to="/suspended" replace />;
  }

  const redirectTo =
    user?.tenant_segment === 'RECYCLING'
      ? '/recycling/dashboard'
      : '/workshop/dashboard';
  return <Navigate to={redirectTo} replace />;
}
```

- [ ] **Step 1.4: Run the test to verify it passes**

```
source "$HOME/.nvm/nvm.sh" && nvm use 20 > /dev/null && pnpm --filter frontend test -- --run PublicOnlyRoute
```

Expected: 5/5 passing.

- [ ] **Step 1.5: TypeScript and lint sanity check**

```
source "$HOME/.nvm/nvm.sh" && nvm use 20 > /dev/null && pnpm --filter frontend build
```

Expected: clean build (no TS errors). The "chunks larger than 500kB" warning is pre-existing and may be ignored.

- [ ] **Step 1.6: Commit**

```bash
git add apps/frontend/src/components/PublicOnlyRoute.tsx apps/frontend/src/components/PublicOnlyRoute.test.tsx
git commit -m "feat(frontend): add PublicOnlyRoute component to redirect authed users"
```

---

## Task 2: Wrap public routes in `App.tsx`

**Files:**
- Modify: `apps/frontend/src/App.tsx`

- [ ] **Step 2.1: Add import at the top of `App.tsx`**

Add this line near the existing `import { PrivateRoute } from './components/PrivateRoute';` (line 45):

```typescript
import { PublicOnlyRoute } from './components/PublicOnlyRoute';
```

- [ ] **Step 2.2: Wrap the 6 public routes**

Replace the existing public route definitions in `App.tsx` (lines 58-63) with versions wrapped in `<PublicOnlyRoute>`:

```tsx
<Route
  path="/"
  element={
    <PublicOnlyRoute>
      <LandingPage />
    </PublicOnlyRoute>
  }
/>
<Route
  path="/login"
  element={
    <PublicOnlyRoute>
      <LoginPage />
    </PublicOnlyRoute>
  }
/>
<Route
  path="/register"
  element={
    <PublicOnlyRoute>
      <RegisterSegmentPage />
    </PublicOnlyRoute>
  }
/>
<Route
  path="/register/workshop"
  element={
    <PublicOnlyRoute>
      <RegisterPage />
    </PublicOnlyRoute>
  }
/>
<Route
  path="/register/recycling"
  element={
    <PublicOnlyRoute>
      <RegisterRecyclingPage />
    </PublicOnlyRoute>
  }
/>
<Route
  path="/forgot-password"
  element={
    <PublicOnlyRoute>
      <ForgotPasswordPage />
    </PublicOnlyRoute>
  }
/>
```

The 3 routes that **must remain unwrapped** (per spec) stay exactly as they are:

```tsx
<Route path="/reset-password/:token" element={<ResetPasswordPage />} />
<Route path="/quotes/:token" element={<QuoteApprovalPage />} />
<Route path="/suspended" element={<SuspendedPage />} />
```

- [ ] **Step 2.3: Run all frontend tests to confirm nothing else broke**

```
source "$HOME/.nvm/nvm.sh" && nvm use 20 > /dev/null && pnpm --filter frontend test -- --run
```

Expected: all suites pass (the previous full run reported 21 suites / 99 tests; this change should add 5 new tests in `PublicOnlyRoute.test.tsx`, totaling 22 suites / 104 tests).

- [ ] **Step 2.4: Frontend production build sanity check**

```
source "$HOME/.nvm/nvm.sh" && nvm use 20 > /dev/null && pnpm --filter frontend build
```

Expected: clean build. Confirms `App.tsx` and `PublicOnlyRoute.tsx` compile under `tsc -b`.

- [ ] **Step 2.5: Manual smoke test (the demoable acceptance test)**

Start the dev environment:
```
docker compose up -d  postgres redis
source "$HOME/.nvm/nvm.sh" && nvm use 20 > /dev/null
pnpm --filter backend start:dev &
pnpm --filter frontend dev &
```

Walk through these scenarios in the browser at `http://localhost:8080`:

1. **Not logged in** — navigate to `/` → see Landing page. Navigate to `/login` → see Login form. Navigate to `/register` → see segment picker. ✓
2. **Logged in (WORKSHOP tenant)** — log in with a workshop tenant. Manually navigate to `/` → expect immediate redirect to `/workshop/dashboard`. Navigate to `/login` → same redirect. Navigate to `/register/recycling` → same redirect. ✓
3. **Logged in (RECYCLING tenant)** — repeat scenario 2 but starting with a recycling tenant. All public routes should redirect to `/recycling/dashboard`. ✓
4. **Suspended tenant** — set `UPDATE tenants SET status = 'SUSPENDED' WHERE id = '<id>'` in psql. Refresh app. Navigate to `/` → expect redirect to `/suspended`. Revert with `UPDATE tenants SET status = 'ACTIVE' WHERE id = '<id>'` after the test. ✓
5. **Cross-route confirmation** — `/reset-password/some-fake-token` should still render the reset page even if logged in. `/quotes/some-fake-token` should still render the quote page even if logged in. ✓

If any scenario fails, capture the error and stop. Otherwise stop the backend/frontend processes (`kill %1 %2`) and proceed.

- [ ] **Step 2.6: Commit**

```bash
git add apps/frontend/src/App.tsx
git commit -m "fix(routing): redirect authenticated users away from public routes"
```

---

## Self-Review

**1. Spec coverage:**
- Spec §"Decisão por estado" → Task 1's tests cover all 4 branches (not auth, suspended, workshop, recycling) plus the hydration guard. ✓
- Spec §"Rotas a serem envolvidas" → Task 2 wraps exactly the 6 routes listed (`/`, `/login`, `/register`, `/register/workshop`, `/register/recycling`, `/forgot-password`); the 3 unwrapped routes stay bare. ✓
- Spec §"Edge cases" → token expiration is handled by `useAuthStore.hydrate()` (clears expired tokens), so `isAuthenticated=false` follows automatically; `tenant_segment` undefined falls back to workshop dashboard, mirroring the convention used in `auth.service.ts:generateTokens`. ✓

**2. Placeholder scan:** No TBD/TODO. Each step has actual code or actual commands.

**3. Type consistency:** `PublicOnlyRoute` interface (`{ children: ReactNode }`) matches what `App.tsx` passes (a single element). The `useAuthStore` selector signature matches the existing `PrivateRoute` usage (subscribes to `isAuthenticated`, `isHydrated`, `user` separately). The `JwtUser.tenant_status` and `JwtUser.tenant_segment` literals (`'SUSPENDED'`, `'WORKSHOP'`, `'RECYCLING'`) match the union type defined in [auth.store.ts:8-18](../../apps/frontend/src/store/auth.store.ts).
