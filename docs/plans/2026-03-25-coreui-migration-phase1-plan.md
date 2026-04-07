# CoreUI Migration — Phase 1: Setup + Layout

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Install CoreUI packages, update ThemeProvider to also drive CoreUI's CSS-variable theme, and fully rewrite AppLayout using CSidebar + CHeader — keeping MUI installed so all pages continue to compile.

**Architecture:** CoreUI and MUI coexist temporarily. ThemeProvider gains a side-effect that sets `data-coreui-theme` on `<html>` whenever the user toggles light/dark, while still wrapping MUI's ThemeProvider. AppLayout becomes fully CoreUI-based with a collapsible sidebar (narrow/full), mobile overlay, session countdown, theme toggle, and avatar dropdown. Pages are untouched in Phase 1.

**Tech Stack:** `@coreui/react`, `@coreui/icons-react`, `@coreui/icons` (new); `@mui/material` kept until Phase 5 final cleanup.

---

### Task 1: Install CoreUI packages and add CSS import

**Files:**
- Modify: `apps/frontend/package.json`
- Modify: `apps/frontend/src/main.tsx`

**Step 1: Add CoreUI dependencies**

In `apps/frontend/package.json`, add to `"dependencies"`:
```json
"@coreui/coreui": "^5.3.1",
"@coreui/icons": "^3.0.1",
"@coreui/icons-react": "^2.3.0",
"@coreui/react": "^5.6.0"
```

**Step 2: Install**

```bash
cd apps/frontend && pnpm install
```

Expected: packages install, lockfile updates, no errors.

**Step 3: Add CoreUI CSS import to `apps/frontend/src/main.tsx`**

Current file:
```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
```

New file — add CoreUI CSS import at the top:
```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import '@coreui/coreui/dist/css/coreui.min.css';
import App from './App.tsx';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
```

**Step 4: Verify TypeScript compiles**

```bash
cd apps/frontend && pnpm build
```

Expected: BUILD success. No type errors.

**Step 5: Commit**

```bash
git add apps/frontend/package.json pnpm-lock.yaml apps/frontend/src/main.tsx
git commit -m "feat(frontend): install @coreui/react and add CSS import"
```

---

### Task 2: Update ThemeProvider to drive CoreUI theme

**Files:**
- Modify: `apps/frontend/src/theme/ThemeProvider.tsx`

**Context:** ThemeProvider currently wraps MUI's `ThemeProvider` and `CssBaseline`. We keep that intact so all MUI pages continue to work. We add a `useEffect` that mirrors the mode to CoreUI's `data-coreui-theme` attribute on `<html>`.

**Step 1: Rewrite `apps/frontend/src/theme/ThemeProvider.tsx`**

```tsx
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ThemeProvider as MuiThemeProvider, CssBaseline } from '@mui/material';
import type { PaletteMode } from '@mui/material';
import { getTheme } from './theme';

interface ThemeContextType {
  mode: PaletteMode;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  mode: 'dark',
  toggleTheme: () => {},
});

export const useThemeMode = () => useContext(ThemeContext);

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<PaletteMode>(
    () => (localStorage.getItem('theme-mode') as PaletteMode) ?? 'dark'
  );

  // Mirror mode to CoreUI's CSS-variable theme system
  useEffect(() => {
    document.documentElement.setAttribute('data-coreui-theme', mode);
  }, [mode]);

  const toggleTheme = () => {
    setMode((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem('theme-mode', next);
      return next;
    });
  };

  const theme = useMemo(() => getTheme(mode), [mode]);

  return (
    <ThemeContext.Provider value={{ mode, toggleTheme }}>
      <MuiThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </MuiThemeProvider>
    </ThemeContext.Provider>
  );
}
```

**Step 2: Verify build**

```bash
cd apps/frontend && pnpm build
```

Expected: BUILD success.

**Step 3: Commit**

```bash
git add apps/frontend/src/theme/ThemeProvider.tsx
git commit -m "feat(theme): mirror mode to data-coreui-theme attribute"
```

---

### Task 3: Rewrite AppLayout with CoreUI sidebar and header

**Files:**
- Modify: `apps/frontend/src/layouts/AppLayout.tsx`

**Context:** The current layout uses MUI Drawer (permanent/temporary) and AppBar. The new layout uses:
- `CSidebar` with `narrow` prop for the desktop mini/full toggle (240px full, ~56px narrow/icons-only)
- Mobile: `overlaid` + `visible` state for a temporary overlay drawer
- `CHeader` positioned sticky at the top with session countdown, theme toggle, and avatar CDropdown
- `useSessionCountdown` hook is kept unchanged
- Sidebar open state is still persisted in `localStorage('sidebar_open')`

**Icon mapping** (from `@coreui/icons`):
- Dashboard → `cilSpeedometer`
- Agendamentos → `cilCalendar`
- Ordens de Serviço → `cilNotes`
- Clientes → `cilPeople`
- Veículos → `cilCarAlt`
- Catálogo → `cilList`
- Relatórios → `cilChartLine`
- Configurações → `cilSettings`

**Step 1: Write `apps/frontend/src/layouts/AppLayout.tsx`**

```tsx
import { useState, useCallback, useEffect, useMemo } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  CSidebar,
  CSidebarBrand,
  CSidebarNav,
  CSidebarToggler,
  CNavItem,
  CNavLink,
  CHeader,
  CHeaderNav,
  CHeaderToggler,
  CContainer,
  CDropdown,
  CDropdownToggle,
  CDropdownMenu,
  CDropdownItem,
  CDropdownDivider,
  CAvatar,
  CTooltip,
} from '@coreui/react';
import CIcon from '@coreui/icons-react';
import {
  cilSpeedometer,
  cilCalendar,
  cilNotes,
  cilPeople,
  cilCarAlt,
  cilList,
  cilChartLine,
  cilSettings,
  cilMenu,
  cilChevronLeft,
  cilSun,
  cilMoon,
  cilAccountLogout,
} from '@coreui/icons';
import { useAuthStore } from '../store/auth.store';
import { useThemeMode } from '../theme/ThemeProvider';
import { useSessionCountdown } from '../hooks/useSessionCountdown';

const STORAGE_KEY = 'sidebar_open';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const navItems: Array<{ label: string; icon: any; path: string; ownerOnly: boolean }> = [
  { label: 'Dashboard', icon: cilSpeedometer, path: '/workshop/dashboard', ownerOnly: false },
  { label: 'Agendamentos', icon: cilCalendar, path: '/workshop/appointments', ownerOnly: false },
  { label: 'Ordens de Serviço', icon: cilNotes, path: '/workshop/service-orders', ownerOnly: false },
  { label: 'Clientes', icon: cilPeople, path: '/workshop/customers', ownerOnly: false },
  { label: 'Veículos', icon: cilCarAlt, path: '/workshop/vehicles', ownerOnly: false },
  { label: 'Catálogo', icon: cilList, path: '/workshop/catalog', ownerOnly: false },
  { label: 'Relatórios', icon: cilChartLine, path: '/workshop/reports', ownerOnly: true },
  { label: 'Configurações', icon: cilSettings, path: '/workshop/settings', ownerOnly: false },
];

function getInitials(name: string | undefined | null): string {
  if (!name) return '?';
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
}

export function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);
  const { mode, toggleTheme } = useThemeMode();

  // Detect mobile (< 768px)
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  );

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Desktop: sidebar expanded/narrow (persisted)
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored !== null ? stored === 'true' : true;
  });

  // Mobile: overlay visible
  const [mobileVisible, setMobileVisible] = useState(false);

  const handleToggleSidebar = useCallback(() => {
    setSidebarOpen((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  }, []);

  const handleLogout = useCallback(async () => {
    await logout();
    navigate('/login');
  }, [logout, navigate]);

  const { minutes, seconds, isWarning } = useSessionCountdown(user?.exp);

  const sidebarNav = useMemo(
    () =>
      navItems
        .filter((item) => !item.ownerOnly || user?.role === 'OWNER')
        .map((item) => {
          const active =
            location.pathname === item.path ||
            location.pathname.startsWith(item.path + '/');

          const navItem = (
            <CNavItem key={item.label}>
              <CNavLink
                as={Link}
                to={item.path}
                active={active}
                onClick={() => isMobile && setMobileVisible(false)}
              >
                <CIcon icon={item.icon} customClassName="nav-icon" />
                {item.label}
              </CNavLink>
            </CNavItem>
          );

          // When sidebar is narrow (desktop mini mode), wrap with tooltip
          if (!sidebarOpen && !isMobile) {
            return (
              <CTooltip key={item.label} content={item.label} placement="right">
                <span>{navItem}</span>
              </CTooltip>
            );
          }

          return navItem;
        }),
    [location.pathname, sidebarOpen, isMobile, user?.role]
  );

  return (
    <>
      {/* Sidebar */}
      <CSidebar
        className="border-end"
        colorScheme="dark"
        // Desktop: always visible; narrow=icons-only when collapsed
        // Mobile: overlay mode
        narrow={!isMobile && !sidebarOpen}
        visible={isMobile ? mobileVisible : true}
        overlaid={isMobile}
        onVisibilityChange={(val) => {
          if (isMobile) setMobileVisible(val);
        }}
      >
        <CSidebarBrand
          className="d-flex align-items-center justify-content-between px-3"
          style={{ minHeight: 56 }}
        >
          {(sidebarOpen || isMobile) && (
            <span className="fw-bold text-primary fs-5">Praktikus</span>
          )}
          {!isMobile && (
            <button
              className="btn btn-sm btn-ghost-secondary ms-auto"
              onClick={handleToggleSidebar}
              aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
              style={{ border: 'none', background: 'none' }}
            >
              <CIcon
                icon={cilChevronLeft}
                style={{
                  transition: 'transform 0.2s',
                  transform: sidebarOpen ? 'none' : 'rotate(180deg)',
                }}
              />
            </button>
          )}
        </CSidebarBrand>
        <hr className="m-0" />
        <CSidebarNav>{sidebarNav}</CSidebarNav>
        {!isMobile && <CSidebarToggler onClick={handleToggleSidebar} />}
      </CSidebar>

      {/* Main wrapper */}
      <div className="wrapper d-flex flex-column min-vh-100">
        <CHeader position="sticky" className="p-0 border-bottom">
          <CContainer fluid className="px-3 gap-2">
            {/* Mobile hamburger */}
            {isMobile && (
              <CHeaderToggler
                onClick={() => setMobileVisible(true)}
                aria-label="Open sidebar"
              >
                <CIcon icon={cilMenu} size="lg" />
              </CHeaderToggler>
            )}

            <div className="ms-auto d-flex align-items-center gap-2">
              {/* Session countdown */}
              {user && (
                <small
                  aria-label="Session time remaining"
                  aria-live="off"
                  style={{
                    color: isWarning
                      ? 'var(--cui-warning)'
                      : 'var(--cui-secondary-color)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {String(minutes).padStart(2, '0')}:
                  {String(seconds).padStart(2, '0')}
                </small>
              )}

              {/* Theme toggle */}
              <button
                className="btn btn-ghost-secondary btn-sm"
                onClick={toggleTheme}
                aria-label={
                  mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'
                }
              >
                <CIcon icon={mode === 'dark' ? cilSun : cilMoon} />
              </button>

              {/* Avatar dropdown */}
              <CDropdown variant="nav-item" alignment="end">
                <CDropdownToggle caret={false} className="p-0 border-0 bg-transparent">
                  <CAvatar
                    size="sm"
                    color="primary"
                    textColor="white"
                    aria-label="Open user menu"
                    style={{ cursor: 'pointer' }}
                  >
                    {getInitials(user?.name)}
                  </CAvatar>
                </CDropdownToggle>
                <CDropdownMenu style={{ minWidth: 200 }}>
                  <div className="px-3 py-2">
                    <div className="fw-semibold text-truncate">
                      {user?.name ?? '—'}
                    </div>
                    <small className="text-secondary text-truncate d-block">
                      {user?.email ?? '—'}
                    </small>
                  </div>
                  <CDropdownDivider />
                  <CDropdownItem
                    onClick={handleLogout}
                    className="text-danger"
                    style={{ cursor: 'pointer' }}
                  >
                    <CIcon icon={cilAccountLogout} className="me-2" />
                    Sair
                  </CDropdownItem>
                </CDropdownMenu>
              </CDropdown>
            </div>
          </CContainer>
        </CHeader>

        {/* Page content */}
        <div className="body flex-grow-1 p-3 p-md-4">
          <Outlet />
        </div>
      </div>
    </>
  );
}
```

**Step 2: Verify TypeScript compiles**

```bash
cd apps/frontend && pnpm build
```

Expected: BUILD success. If any icon names fail to resolve (e.g., `cilCarAlt` not found), check available icon names via:
```bash
node -e "const icons = require('@coreui/icons'); console.log(Object.keys(icons).filter(k => k.toLowerCase().includes('car')))"
```
and substitute the correct name.

**Step 3: Start dev server and visually verify**

```bash
cd apps/frontend && pnpm dev
```

Open http://localhost:5173 and log in. Check:
- [ ] Sidebar shows icons + labels when expanded
- [ ] Chevron button collapses sidebar to icon-only narrow mode
- [ ] Narrow state is persisted on page reload
- [ ] Session countdown visible in header (MM:SS format)
- [ ] Theme toggle switches dark/light — CoreUI layout AND MUI pages both reflect the change
- [ ] Avatar initials visible; click opens dropdown with name, email, and "Sair"
- [ ] "Sair" logs out and redirects to /login
- [ ] On mobile (resize to < 768px): hamburger icon visible, sidebar hidden, tap hamburger opens overlay sidebar, tap outside closes it

**Step 4: Commit**

```bash
git add apps/frontend/src/layouts/AppLayout.tsx
git commit -m "feat(layout): rewrite AppLayout with CoreUI CSidebar + CHeader"
```
