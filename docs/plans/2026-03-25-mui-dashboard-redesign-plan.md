# MUI Dashboard Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Adopt the MUI Dashboard template visual style across the Praktikus frontend — new palette, mini/collapsible sidebar, avatar menu — by changing only `theme.ts` and `AppLayout.tsx`.

**Architecture:** Shell-first approach. Update the theme with the new palette, typography, shape, and global component overrides first (so every page picks up changes automatically). Then rewrite AppLayout with the new sidebar behavior and avatar menu. No page files are modified.

**Tech Stack:** React 18, MUI v6, TypeScript, react-router-dom v6, Zustand (auth store)

---

### Task 1: Update theme.ts

**Files:**
- Modify: `apps/frontend/src/theme/theme.ts`

**Step 1: Replace the theme file content**

```typescript
import { createTheme, alpha } from '@mui/material';
import type { PaletteMode } from '@mui/material';

export const getTheme = (mode: PaletteMode) =>
  createTheme({
    palette: {
      mode,
      ...(mode === 'dark'
        ? {
            background: {
              default: '#0A1929',
              paper: '#132F4C',
            },
            primary: {
              main: '#4A90D9',
              light: '#74B3E2',
            },
            secondary: {
              main: '#00D97E',
            },
          }
        : {
            background: {
              default: '#F0F4F8',
              paper: '#FFFFFF',
            },
            primary: {
              main: '#1565C0',
              light: '#42A5F5',
            },
            secondary: {
              main: '#00D97E',
            },
          }),
    },
    typography: {
      fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
      fontWeightMedium: 500,
      h5: { fontSize: '1.375rem' },
      h6: { fontSize: '1.125rem' },
    },
    shape: {
      borderRadius: 12,
    },
    components: {
      MuiCard: {
        defaultProps: { variant: 'outlined' },
        styleOverrides: {
          root: ({ theme }) => ({
            boxShadow: 'none',
            border: `1px solid ${theme.palette.divider}`,
          }),
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            fontWeight: 600,
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: 6,
          },
        },
      },
      MuiTableHead: {
        styleOverrides: {
          root: ({ theme }) => ({
            backgroundColor: alpha(theme.palette.primary.main, 0.04),
            '& .MuiTableCell-head': {
              fontWeight: 600,
            },
          }),
        },
      },
    },
  });
```

**Step 2: Check TypeScript**

```bash
cd apps/frontend && npx tsc -b
```
Expected: no errors.

**Step 3: Commit**

```bash
git add apps/frontend/src/theme/theme.ts
git commit -m "feat(theme): adopt MUI Dashboard palette, typography, shape and component overrides"
```

---

### Task 2: Rewrite AppLayout.tsx

**Files:**
- Modify: `apps/frontend/src/layouts/AppLayout.tsx`

**Step 1: Replace AppLayout.tsx with the new implementation**

```typescript
import { useState, useCallback } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Box, Drawer, List, ListItem, ListItemButton, ListItemIcon, ListItemText,
  AppBar, Toolbar, Typography, IconButton, Divider, Tooltip,
  Avatar, Menu, MenuItem, useMediaQuery, useTheme,
} from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import EventIcon from '@mui/icons-material/Event';
import AssignmentIcon from '@mui/icons-material/Assignment';
import PeopleIcon from '@mui/icons-material/People';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import InventoryIcon from '@mui/icons-material/Inventory';
import BarChartIcon from '@mui/icons-material/BarChart';
import SettingsIcon from '@mui/icons-material/Settings';
import MenuIcon from '@mui/icons-material/Menu';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import { useAuthStore } from '../store/auth.store';
import { useThemeMode } from '../theme/ThemeProvider';

const DRAWER_WIDTH = 240;
const DRAWER_MINI = 64;
const STORAGE_KEY = 'sidebar_open';

const navItems = [
  { label: 'Dashboard', icon: <DashboardIcon />, path: '/workshop/dashboard', ownerOnly: false },
  { label: 'Agendamentos', icon: <EventIcon />, path: '/workshop/appointments', ownerOnly: false },
  { label: 'Ordens de Serviço', icon: <AssignmentIcon />, path: '/workshop/service-orders', ownerOnly: false },
  { label: 'Clientes', icon: <PeopleIcon />, path: '/workshop/customers', ownerOnly: false },
  { label: 'Veículos', icon: <DirectionsCarIcon />, path: '/workshop/vehicles', ownerOnly: false },
  { label: 'Catálogo', icon: <InventoryIcon />, path: '/workshop/catalog', ownerOnly: false },
  { label: 'Relatórios', icon: <BarChartIcon />, path: '/workshop/reports', ownerOnly: true },
  { label: 'Configurações', icon: <SettingsIcon />, path: '/workshop/settings', ownerOnly: false },
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
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // Sidebar open state — persisted in localStorage, default true on desktop
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored !== null ? stored === 'true' : true;
  });

  // Mobile drawer state (temporary)
  const [mobileOpen, setMobileOpen] = useState(false);

  // Avatar dropdown
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const handleToggleSidebar = useCallback(() => {
    setSidebarOpen((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  }, []);

  const handleLogout = async () => {
    setAnchorEl(null);
    await logout();
    navigate('/login');
  };

  const drawerWidth = isMobile ? DRAWER_WIDTH : sidebarOpen ? DRAWER_WIDTH : DRAWER_MINI;

  const drawerContent = (
    <>
      <Toolbar
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: sidebarOpen || isMobile ? 'space-between' : 'center',
          px: sidebarOpen || isMobile ? 2 : 0,
          minHeight: 64,
        }}
      >
        {(sidebarOpen || isMobile) && (
          <Typography variant="h6" fontWeight="bold" color="primary" noWrap>
            Praktikus
          </Typography>
        )}
        {!isMobile && (
          <IconButton onClick={handleToggleSidebar} size="small">
            <ChevronLeftIcon
              sx={{
                transition: 'transform 0.2s',
                transform: sidebarOpen ? 'rotate(0deg)' : 'rotate(180deg)',
              }}
            />
          </IconButton>
        )}
      </Toolbar>
      <Divider />
      <List sx={{ pt: 1 }}>
        {navItems
          .filter((item) => !item.ownerOnly || user?.role === 'OWNER')
          .map((item) => {
            const active = location.pathname === item.path ||
              location.pathname.startsWith(item.path + '/');
            const button = (
              <ListItem key={item.label} disablePadding>
                <ListItemButton
                  component={Link}
                  to={item.path}
                  selected={active}
                  onClick={() => isMobile && setMobileOpen(false)}
                  sx={{
                    mx: 1,
                    borderRadius: 2,
                    justifyContent: sidebarOpen || isMobile ? 'initial' : 'center',
                    px: sidebarOpen || isMobile ? 2 : 1.5,
                  }}
                >
                  <ListItemIcon
                    sx={{
                      minWidth: sidebarOpen || isMobile ? 40 : 'unset',
                      color: active ? 'primary.main' : 'text.secondary',
                    }}
                  >
                    {item.icon}
                  </ListItemIcon>
                  {(sidebarOpen || isMobile) && (
                    <ListItemText
                      primary={item.label}
                      primaryTypographyProps={{ fontSize: '0.875rem', fontWeight: active ? 600 : 400 }}
                    />
                  )}
                </ListItemButton>
              </ListItem>
            );
            if (!sidebarOpen && !isMobile) {
              return (
                <Tooltip key={item.label} title={item.label} placement="right">
                  {button}
                </Tooltip>
              );
            }
            return button;
          })}
      </List>
    </>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {/* AppBar */}
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          zIndex: (t) => t.zIndex.drawer + 1,
          borderBottom: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
          color: 'text.primary',
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          ml: { sm: `${drawerWidth}px` },
          transition: (t) =>
            t.transitions.create(['width', 'margin'], {
              easing: t.transitions.easing.sharp,
              duration: t.transitions.duration.leavingScreen,
            }),
        }}
      >
        <Toolbar sx={{ gap: 1 }}>
          {isMobile && (
            <IconButton
              edge="start"
              onClick={() => setMobileOpen(true)}
              sx={{ mr: 1 }}
            >
              <MenuIcon />
            </IconButton>
          )}
          <Box sx={{ flexGrow: 1 }} />

          {/* Theme toggle */}
          <IconButton onClick={toggleTheme} size="small">
            {mode === 'dark' ? <LightModeIcon fontSize="small" /> : <DarkModeIcon fontSize="small" />}
          </IconButton>

          {/* Avatar */}
          <IconButton
            onClick={(e) => setAnchorEl(e.currentTarget)}
            size="small"
            sx={{ ml: 0.5 }}
          >
            <Avatar
              sx={{ width: 32, height: 32, fontSize: '0.8rem', bgcolor: 'primary.main' }}
            >
              {getInitials(user?.name)}
            </Avatar>
          </IconButton>

          {/* Avatar dropdown menu */}
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={() => setAnchorEl(null)}
            transformOrigin={{ horizontal: 'right', vertical: 'top' }}
            anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
            slotProps={{ paper: { sx: { minWidth: 200, mt: 0.5 } } }}
          >
            <Box sx={{ px: 2, py: 1.5 }}>
              <Typography variant="subtitle2" fontWeight={600} noWrap>
                {user?.name ?? '—'}
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap>
                {user?.email ?? '—'}
              </Typography>
            </Box>
            <Divider />
            <MenuItem onClick={handleLogout} sx={{ color: 'error.main' }}>
              Sair
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      {/* Desktop permanent/mini drawer */}
      {!isMobile && (
        <Drawer
          variant="permanent"
          sx={{
            width: drawerWidth,
            flexShrink: 0,
            whiteSpace: 'nowrap',
            transition: (t) =>
              t.transitions.create('width', {
                easing: t.transitions.easing.sharp,
                duration: sidebarOpen
                  ? t.transitions.duration.enteringScreen
                  : t.transitions.duration.leavingScreen,
              }),
            '& .MuiDrawer-paper': {
              width: drawerWidth,
              overflowX: 'hidden',
              transition: (t) =>
                t.transitions.create('width', {
                  easing: t.transitions.easing.sharp,
                  duration: sidebarOpen
                    ? t.transitions.duration.enteringScreen
                    : t.transitions.duration.leavingScreen,
                }),
              boxSizing: 'border-box',
            },
          }}
        >
          {drawerContent}
        </Drawer>
      )}

      {/* Mobile temporary drawer */}
      {isMobile && (
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box' },
          }}
        >
          {drawerContent}
        </Drawer>
      )}

      {/* Main content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          maxWidth: 1400,
          transition: (t) =>
            t.transitions.create(['width', 'margin'], {
              easing: t.transitions.easing.sharp,
              duration: t.transitions.duration.leavingScreen,
            }),
        }}
      >
        <Toolbar />
        <Outlet />
      </Box>
    </Box>
  );
}
```

**Step 2: Check TypeScript**

```bash
cd apps/frontend && npx tsc -b
```
Expected: no errors. Fix any reported type issues before committing.

**Step 3: Verify useThemeMode exposes `mode`**

Open `apps/frontend/src/theme/ThemeProvider.tsx` and confirm `useThemeMode()` returns `{ mode, toggleTheme }`. If it only returns `{ toggleTheme }`, add `mode` to the return value.

**Step 4: Commit**

```bash
git add apps/frontend/src/layouts/AppLayout.tsx
git commit -m "feat(layout): mini/collapsible sidebar, avatar menu, mobile support"
```

---

### Task 3: Fix ThemeProvider if needed

**Files:**
- Modify: `apps/frontend/src/theme/ThemeProvider.tsx` (only if `mode` is not already exposed)

**Step 1: Check current ThemeProvider**

Read `apps/frontend/src/theme/ThemeProvider.tsx` and check what `useThemeMode` returns.

**Step 2: If `mode` is missing, add it to the context**

Find the context value and add `mode` alongside `toggleTheme`:

```typescript
// In the context value object, add:
mode,
// In the context type, add:
mode: PaletteMode;
```

**Step 3: TypeScript check + commit**

```bash
cd apps/frontend && npx tsc -b
git add apps/frontend/src/theme/ThemeProvider.tsx
git commit -m "feat(theme): expose mode from useThemeMode context"
```

---

### Task 4: Visual Smoke Test

**Step 1: Run dev server**

```bash
cd apps/frontend && pnpm dev
```

**Step 2: Check desktop layout**

1. Open `http://localhost:5173`
2. Login → Workshop
3. Sidebar should show expanded (240px) with icons + labels
4. Click the ChevronLeft button → sidebar collapses to 64px (icons only)
5. Hover an icon → Tooltip with label appears
6. Reload → sidebar state preserved (localStorage)

**Step 3: Check mobile layout**

1. DevTools → toggle to mobile viewport (< 600px)
2. Sidebar should be hidden, hamburger icon in AppBar
3. Click hamburger → temporary Drawer opens with full nav
4. Click a nav item → Drawer closes, page navigates

**Step 4: Check avatar menu**

1. Click avatar in AppBar → dropdown opens with user name + email
2. Click "Sair" → logs out, redirects to /login

**Step 5: Check theme toggle**

1. Click sun/moon icon → theme switches light/dark
2. Verify new palette colors (blue #1565C0 light / #4A90D9 dark)
