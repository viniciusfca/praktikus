import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { AppThemeProvider } from './theme/ThemeProvider';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { AppLayout } from './layouts/AppLayout';
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
import { QuoteApprovalPage } from './pages/public/QuoteApprovalPage';
import { SuspendedPage } from './pages/public/SuspendedPage';
import { PrivateRoute } from './components/PrivateRoute';
import { useAuthStore } from './store/auth.store';

function App() {
  const hydrate = useAuthStore((s) => s.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  return (
    <AppThemeProvider>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/quotes/:token" element={<QuoteApprovalPage />} />
          <Route path="/suspended" element={<SuspendedPage />} />
          <Route
            path="/workshop"
            element={
              <PrivateRoute>
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
        </Routes>
    </AppThemeProvider>
  );
}

export default App;
