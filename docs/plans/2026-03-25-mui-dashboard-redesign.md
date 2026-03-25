# Design: MUI Dashboard Redesign

**Date:** 2026-03-25
**Approach:** Shell-first — update AppLayout + theme first, then apply global component overrides

---

## Scope

Full redesign: layout shell + theme + global component overrides.
Pages are NOT rewritten individually — component polishes are applied via MUI theme overrides.

---

## 1. Theme (`apps/frontend/src/theme/theme.ts`)

### Palette

| Token | Light | Dark |
|---|---|---|
| `primary.main` | `#1565C0` | `#4A90D9` |
| `primary.light` | `#42A5F5` | `#74B3E2` |
| `background.default` | `#F0F4F8` | `#0A1929` |
| `background.paper` | `#FFFFFF` | `#132F4C` |
| `secondary.main` | `#00D97E` | `#00D97E` |

### Typography
- Font: Inter (unchanged)
- Add `fontWeightMedium: 500`
- `h5`: `1.375rem`, `h6`: `1.125rem`

### Shape
- `borderRadius: 12`

### Component Overrides
- `MuiCard`: `defaultProps: { variant: 'outlined' }`, subtle `boxShadow`
- `MuiTableHead`: `background: alpha(primary, 0.04)`, header cells `fontWeight: 600`
- `MuiButton`: `textTransform: 'none'`, `fontWeight: 600`
- `MuiChip`: `borderRadius: 6`

---

## 2. AppLayout Shell (`apps/frontend/src/layouts/AppLayout.tsx`)

### Sidebar

| State | Width | Content |
|---|---|---|
| Expanded | `240px` | Icon + label |
| Mini | `64px` | Icon only + Tooltip on hover |
| Mobile | Hidden | Temporary Drawer with overlay |

- Toggle button (ChevronLeft / ChevronRight) inside the sidebar header
- State persisted in `localStorage` key `sidebar_open`
- Mobile breakpoint: `< sm` — hamburger icon in AppBar opens temporary Drawer

### AppBar
- Left: Logo "Practicus" (desktop) / hamburger MenuIcon (mobile)
- Right: theme toggle (LightMode/DarkMode icon) + Avatar
- Avatar: initials of the logged-in user (e.g., "JD" for "João Doe"), colored with `primary.main`
- Avatar click opens `Menu` dropdown with:
  - User name (Typography, non-clickable)
  - User email (Typography caption, non-clickable)
  - `<Divider />`
  - "Sair" MenuItem (triggers logout + navigate to /login)
- Remove standalone LogoutIcon from AppBar

### Main Content Area
- `padding: theme.spacing(3)`
- `maxWidth: 1400px` centered

---

## 3. Files Changed

| File | Change |
|---|---|
| `src/theme/theme.ts` | New palette, typography, shape, component overrides |
| `src/layouts/AppLayout.tsx` | Mini/collapsible sidebar, avatar menu, mobile support |

No page files are modified.

---

## 4. Out of Scope

- Breadcrumbs (not requested)
- Search bar (not requested)
- Notifications bell (not requested)
- Rewriting individual page layouts
