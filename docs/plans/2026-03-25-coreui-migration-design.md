# CoreUI Migration Design

## Goal

Replace MUI (Material UI) with CoreUI free React admin template across the entire frontend, adopting CoreUI's layout components, theming system, and Chart.js charts for a modern, clean admin look.

## Motivation

- CoreUI free template provides a polished, professional admin dashboard style out of the box
- Built-in light/dark toggle via `data-coreui-theme` attribute (no custom ThemeProvider needed)
- `@coreui/chartjs` integration with Chart.js for better chart ergonomics than Recharts
- Consistent design language across sidebar, header, cards, tables, badges, and forms

## Architecture

### Package Changes

**Add:**
- `@coreui/react` — core components (layout, sidebar, header, cards, tables, badges, forms, modals, dropdowns)
- `@coreui/icons-react` + `@coreui/icons` — icon set replacing `@mui/icons-material`
- `chart.js` + `react-chartjs-2` + `@coreui/chartjs` — charts replacing `recharts`

**Remove:**
- `@mui/material`
- `@mui/icons-material`
- `@emotion/react` + `@emotion/styled` (MUI peer deps)
- `recharts`

**Keep unchanged:**
- `react-hook-form` + `zod` + `@hookform/resolvers`
- `zustand`
- `axios`
- `react-router-dom`
- `@react-pdf/renderer`

### Theming

Replace MUI `ThemeProvider` + `createTheme` with CoreUI CSS variables:

```ts
// New ThemeProvider.tsx
type ThemeMode = 'light' | 'dark';

function applyTheme(mode: ThemeMode) {
  document.documentElement.setAttribute('data-coreui-theme', mode);
}
```

No custom color tokens needed — CoreUI's default palette is used as-is for Phase 1. If customizations are needed later, CSS variable overrides can be applied in `index.css`.

### Layout

Replace MUI `Drawer` + `AppBar` with CoreUI layout primitives:

- `CSidebar` + `CSidebarNav` + `CNavItem` — collapsible sidebar with mini mode
- `CHeader` + `CHeaderNav` — top app bar with theme toggle and avatar dropdown
- `CContainer` — main content wrapper

Sidebar state (expanded/mini) still persisted in `localStorage('sidebar_open')`.

Mobile support: CoreUI's `CSidebar` has built-in `visible` prop and backdrop overlay for mobile.

### Charts

Replace Recharts with CoreUI/Chart.js:

| Recharts component | CoreUI/Chart.js replacement |
|---|---|
| `<BarChart>` | `<CChartBar>` |
| `<PieChart>` | `<CChartDoughnut>` |
| Custom stat cards | `<CWidgetStatsA>` |

### Forms

CoreUI provides `CFormInput`, `CFormLabel`, `CFormFeedback` etc. but `react-hook-form` integration uses standard `<input>` elements — CoreUI form components are just styled wrappers and work with `register()` via the `ref` prop.

For selects and complex inputs, CoreUI's `CFormSelect` or native `<select>` can be used.

## Migration Strategy

Incremental migration by area — app remains functional throughout. Each phase leaves no MUI imports in the touched files.

### Phase 1: Setup + Layout

**Tasks:**
1. Install CoreUI packages, remove MUI packages from `package.json`
2. Remove MUI `ThemeProvider` wiring from `main.tsx`/`App.tsx`, add CoreUI CSS import + new `ThemeProvider.tsx`
3. Rewrite `AppLayout.tsx` using `CSidebar`, `CHeader`, avatar dropdown, session countdown
4. Update all nav item icons from `@mui/icons-material` to `@coreui/icons-react`
5. Update `PrivateRoute.tsx` and `App.tsx` to remove any remaining MUI refs

**Outcome:** App boots with CoreUI layout, all pages visible (content may still use MUI components temporarily if any remain, but layout is fully CoreUI).

> Note: Since ALL MUI packages are removed in this phase, every page that still uses MUI components will break until migrated. The recommended approach is to migrate layout and ALL pages in rapid succession, not leaving MUI in any file.

Given this, Phase 1 also includes rewriting all shared UI patterns (Cards, Buttons, Alerts, TextFields) to CoreUI equivalents so pages compile.

### Phase 2: Dashboard + Reports

**Tasks:**
1. Rewrite `DashboardPage.tsx` — summary stat cards using `CWidgetStatsA`, KPI grid
2. Rewrite `ReportsPage.tsx` — bar chart with `CChartBar`, doughnut with `CChartDoughnut`
3. Remove `recharts` from `package.json`

### Phase 3: Customers + Vehicles

**Tasks:**
1. Rewrite `CustomersPage.tsx` — `CTable`, `CBadge`, search input
2. Rewrite `CustomerFormPage.tsx` — `CForm`, `CFormInput`, `CFormFeedback`, post-save dialog
3. Rewrite `VehiclesPage.tsx` — `CTable`, filter chips
4. Rewrite `VehicleFormPage.tsx` — CPF lookup UI with `CInputGroup`, `CButton`

### Phase 4: Service Orders + Appointments

**Tasks:**
1. Rewrite `ServiceOrdersPage.tsx` — `CTable`, status badges, action buttons
2. Rewrite `ServiceOrderFormPage.tsx` — multi-section `CCard` layout, line items
3. Rewrite `AppointmentsPage.tsx` — `CTable` or calendar view
4. Rewrite `AppointmentDrawer.tsx` → `CModal` (CoreUI uses modals, not drawers)

### Phase 5: Catalog + Settings + Public pages

**Tasks:**
1. Rewrite `CatalogPage.tsx` + `CatalogFormPage.tsx`
2. Rewrite `SettingsPage.tsx`
3. Rewrite `LoginPage.tsx` + `RegisterPage.tsx` — centered card layout
4. Rewrite `QuoteApprovalPage.tsx` — public-facing, minimal styling

## CoreUI Component Mapping

| MUI | CoreUI |
|---|---|
| `Box` | `div` / `CContainer` / `CRow` / `CCol` |
| `Card` + `CardContent` | `CCard` + `CCardBody` |
| `Typography` | `h1–h6`, `p`, `small`, or `CCardTitle`/`CCardText` |
| `Button` | `CButton` |
| `TextField` | `CFormInput` (+ `CFormLabel` + `CFormFeedback`) |
| `Alert` | `CAlert` |
| `CircularProgress` | `CSpinner` |
| `Chip` | `CBadge` |
| `Table` | `CTable` + `CTableHead` + `CTableBody` + `CTableRow` + `CTableDataCell` |
| `Dialog` / `Modal` | `CModal` + `CModalHeader` + `CModalBody` + `CModalFooter` |
| `Drawer` (form) | `COffcanvas` |
| `Select` | `CFormSelect` |
| `Tabs` | `CNav` + `CNavItem` + `CTabContent` + `CTabPane` |
| `Tooltip` | `CTooltip` |
| `IconButton` | `CButton variant="ghost"` or plain `<button>` |
| `FormHelperText` | `CFormFeedback` |
| `Divider` | `<hr>` or `CDropdownDivider` |
| `Avatar` | `CAvatar` |
| `Menu` + `MenuItem` | `CDropdown` + `CDropdownMenu` + `CDropdownItem` |
| `LinearProgress` | `CProgress` + `CProgressBar` |

## File Tree (Phase 1 touches)

```
apps/frontend/src/
  main.tsx                          — remove MuiThemeProvider wiring
  App.tsx                           — remove MUI imports
  theme/
    ThemeProvider.tsx               — rewrite: data-coreui-theme toggle
    theme.ts                        — DELETE (no longer needed)
  layouts/
    AppLayout.tsx                   — full rewrite with CoreUI layout
  index.css                         — add CoreUI CSS import (or in main.tsx)
```
