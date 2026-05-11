import { Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense, useEffect } from 'react';
import { PlatformOnlyRoute } from './pages/admin/_layout/PlatformOnlyRoute';
import { usePlatformAuthStore } from './store/platform-auth.store';
import { AppThemeProvider } from './theme/ThemeProvider';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { RegisterRecyclingPage } from './pages/auth/RegisterRecyclingPage';
import { RegisterSegmentPage } from './pages/auth/RegisterSegmentPage';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage';
import { AppLayout } from './layouts/AppLayout';
import { RecyclingLayout } from './layouts/RecyclingLayout';
import { RecyclingDashboardPage } from './pages/recycling/DashboardPage';
import { EmployeesPage } from './pages/recycling/employees/EmployeesPage';
import { EmployeeFormPage } from './pages/recycling/employees/EmployeeFormPage';
import { EmployeePermissionsPage } from './pages/recycling/employees/EmployeePermissionsPage';
import { ProductsPage } from './pages/recycling/products/ProductsPage';
import { SuppliersPage } from './pages/recycling/suppliers/SuppliersPage';
import { CashRegisterPage } from './pages/recycling/cash-register/CashRegisterPage';
import { PurchasesPage } from './pages/recycling/purchases/PurchasesPage';
import { NewPurchasePage } from './pages/recycling/purchases/NewPurchasePage';
import { StockPage } from './pages/recycling/stock/StockPage';
import { BuyersPage } from './pages/recycling/buyers/BuyersPage';
import { SalesPage } from './pages/recycling/sales/SalesPage';
import { NewSalePage } from './pages/recycling/sales/NewSalePage';
import { ColetasPage } from './pages/recycling/coletas/ColetasPage';
import { RecyclingReportsPage } from './pages/recycling/reports/ReportsPage';
import { SettingsPage as RecyclingSettingsPage } from './pages/recycling/settings/SettingsPage';
import { DashboardPage } from './pages/workshop/DashboardPage';
import { CustomersPage } from './pages/workshop/customers/CustomersPage';
import { CustomerFormPage } from './pages/workshop/customers/CustomerFormPage';
import { CustomerDetailPage } from './pages/workshop/customers/CustomerDetailPage';
import { VehiclesPage } from './pages/workshop/vehicles/VehiclesPage';
import { VehicleFormPage } from './pages/workshop/vehicles/VehicleFormPage';
import { VehicleHistoryPage } from './pages/workshop/vehicles/VehicleHistoryPage';
import { CatalogPage } from './pages/workshop/catalog/CatalogPage';
import { AppointmentsPage } from './pages/workshop/appointments/AppointmentsPage';
import { ServiceOrdersPage } from './pages/workshop/service-orders/ServiceOrdersPage';
import { ServiceOrderDetailPage } from './pages/workshop/service-orders/ServiceOrderDetailPage';
import { ReportsPage } from './pages/workshop/reports/ReportsPage';
import { SettingsPage } from './pages/workshop/settings/SettingsPage';
import { WhatsappStubPage } from './pages/whatsapp/WhatsappStubPage';
import { QuoteApprovalPage } from './pages/public/QuoteApprovalPage';
import { SuspendedPage } from './pages/public/SuspendedPage';
import { MockCheckoutPage } from './pages/dev/MockCheckoutPage';
import { PrivateRoute } from './components/PrivateRoute';
import { PublicOnlyRoute } from './components/PublicOnlyRoute';
import { useAuthStore } from './store/auth.store';

const AdminLayout = lazy(() =>
  import('./pages/admin/_layout/AdminLayout').then((m) => ({ default: m.AdminLayout })),
);
const AdminLoginPage = lazy(() =>
  import('./pages/admin/pages/LoginPage').then((m) => ({ default: m.LoginPage })),
);
const AdminOverviewPage = lazy(() =>
  import('./pages/admin/pages/OverviewPage').then((m) => ({ default: m.OverviewPage })),
);
const AdminTenantsPage = lazy(() =>
  import('./pages/admin/pages/TenantsPage').then((m) => ({ default: m.TenantsPage })),
);
const AdminSegmentsPage = lazy(() =>
  import('./pages/admin/pages/SegmentsPage').then((m) => ({ default: m.SegmentsPage })),
);
const AdminWhatsappPage = lazy(() =>
  import('./pages/admin/pages/WhatsappPage').then((m) => ({ default: m.WhatsappPage })),
);
const AdminFinancialPage = lazy(() =>
  import('./pages/admin/pages/FinancialPage').then((m) => ({ default: m.FinancialPage })),
);

function App() {
  const hydrate = useAuthStore((s) => s.hydrate);
  const platformHydrate = usePlatformAuthStore((s) => s.hydrate);

  useEffect(() => {
    hydrate();
    platformHydrate();
  }, [hydrate, platformHydrate]);

  return (
    <AppThemeProvider>
        <Routes>
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
          <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
          <Route path="/quotes/:token" element={<QuoteApprovalPage />} />
          <Route path="/suspended" element={<SuspendedPage />} />
          <Route path="/dev/mock-checkout" element={<MockCheckoutPage />} />
          <Route
            path="/workshop"
            element={
              <PrivateRoute requiredSegment="WORKSHOP">
                <AppLayout />
              </PrivateRoute>
            }
          >
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="customers" element={<CustomersPage />} />
            <Route path="customers/new" element={<CustomerFormPage />} />
            <Route path="customers/:id" element={<CustomerDetailPage />} />
            <Route path="customers/:id/edit" element={<CustomerFormPage />} />
            <Route path="vehicles" element={<VehiclesPage />} />
            <Route path="vehicles/new" element={<VehicleFormPage />} />
            <Route path="vehicles/:id/history" element={<VehicleHistoryPage />} />
            <Route path="vehicles/:id/edit" element={<VehicleFormPage />} />
            <Route path="catalog" element={<CatalogPage />} />
            <Route path="appointments" element={<AppointmentsPage />} />
            <Route path="service-orders" element={<ServiceOrdersPage />} />
            <Route path="service-orders/:id" element={<ServiceOrderDetailPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
          <Route
            path="/recycling"
            element={
              <PrivateRoute requiredSegment="RECYCLING">
                <RecyclingLayout />
              </PrivateRoute>
            }
          >
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<RecyclingDashboardPage />} />
            <Route path="employees" element={<EmployeesPage />} />
            <Route path="employees/new" element={<EmployeeFormPage />} />
            <Route path="employees/:id/permissions" element={<EmployeePermissionsPage />} />
            <Route path="products" element={<ProductsPage />} />
            <Route path="suppliers" element={<SuppliersPage />} />
            <Route path="cash-register" element={<CashRegisterPage />} />
            <Route path="purchases" element={<PurchasesPage />} />
            <Route path="purchases/new" element={<NewPurchasePage />} />
            <Route path="stock" element={<StockPage />} />
            <Route path="buyers" element={<BuyersPage />} />
            <Route path="sales" element={<SalesPage />} />
            <Route path="sales/new" element={<NewSalePage />} />
            <Route path="coletas" element={<ColetasPage />} />
            <Route path="reports" element={<RecyclingReportsPage />} />
            <Route path="settings" element={<RecyclingSettingsPage />} />
          </Route>
          {/* /whatsapp is cross-segment. Layout uses AppLayout in Fase 1; will switch to a dedicated WhatsApp shell in Fase 2 (see spec §7.2). */}
          <Route
            path="/whatsapp"
            element={
              <PrivateRoute>
                <AppLayout />
              </PrivateRoute>
            }
          >
            <Route index element={<WhatsappStubPage />} />
          </Route>
          <Route
            path="/admin/login"
            element={
              <Suspense fallback={null}>
                <AdminLoginPage />
              </Suspense>
            }
          />
          <Route
            path="/admin"
            element={
              <PlatformOnlyRoute>
                <Suspense fallback={null}>
                  <AdminLayout />
                </Suspense>
              </PlatformOnlyRoute>
            }
          >
            <Route index element={<Suspense fallback={null}><AdminOverviewPage /></Suspense>} />
            <Route path="clientes" element={<Suspense fallback={null}><AdminTenantsPage /></Suspense>} />
            <Route path="segmentos" element={<Suspense fallback={null}><AdminSegmentsPage /></Suspense>} />
            <Route path="whatsapp" element={<Suspense fallback={null}><AdminWhatsappPage /></Suspense>} />
            <Route path="financeiro" element={<Suspense fallback={null}><AdminFinancialPage /></Suspense>} />
          </Route>
        </Routes>
    </AppThemeProvider>
  );
}

export default App;
