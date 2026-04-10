import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { AppThemeProvider } from './theme/ThemeProvider';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { RegisterRecyclingPage } from './pages/auth/RegisterRecyclingPage';
import { AppLayout } from './layouts/AppLayout';
import { RecyclingLayout } from './layouts/RecyclingLayout';
import { RecyclingDashboardPage } from './pages/recycling/DashboardPage';
import { EmployeesPage } from './pages/recycling/employees/EmployeesPage';
import { EmployeeFormPage } from './pages/recycling/employees/EmployeeFormPage';
import { EmployeePermissionsPage } from './pages/recycling/employees/EmployeePermissionsPage';
import { ProductsPage } from './pages/recycling/products/ProductsPage';
import { ProductFormPage } from './pages/recycling/products/ProductFormPage';
import { SuppliersPage } from './pages/recycling/suppliers/SuppliersPage';
import { SupplierFormPage } from './pages/recycling/suppliers/SupplierFormPage';
import { CashRegisterPage } from './pages/recycling/cash-register/CashRegisterPage';
import { PurchasesPage } from './pages/recycling/purchases/PurchasesPage';
import { NewPurchasePage } from './pages/recycling/purchases/NewPurchasePage';
import { StockPage } from './pages/recycling/stock/StockPage';
import { BuyersPage } from './pages/recycling/buyers/BuyersPage';
import { BuyerFormPage } from './pages/recycling/buyers/BuyerFormPage';
import { SalesPage } from './pages/recycling/sales/SalesPage';
import { NewSalePage } from './pages/recycling/sales/NewSalePage';
import { RecyclingReportsPage } from './pages/recycling/reports/ReportsPage';
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
          <Route path="/register/recycling" element={<RegisterRecyclingPage />} />
          <Route path="/quotes/:token" element={<QuoteApprovalPage />} />
          <Route path="/suspended" element={<SuspendedPage />} />
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
            <Route path="products/new" element={<ProductFormPage />} />
            <Route path="products/:id/edit" element={<ProductFormPage />} />
            <Route path="suppliers" element={<SuppliersPage />} />
            <Route path="suppliers/new" element={<SupplierFormPage />} />
            <Route path="suppliers/:id/edit" element={<SupplierFormPage />} />
            <Route path="cash-register" element={<CashRegisterPage />} />
            <Route path="purchases" element={<PurchasesPage />} />
            <Route path="purchases/new" element={<NewPurchasePage />} />
            <Route path="stock" element={<StockPage />} />
            <Route path="buyers" element={<BuyersPage />} />
            <Route path="buyers/new" element={<BuyerFormPage />} />
            <Route path="buyers/:id/edit" element={<BuyerFormPage />} />
            <Route path="sales" element={<SalesPage />} />
            <Route path="sales/new" element={<NewSalePage />} />
            <Route path="reports" element={<RecyclingReportsPage />} />
          </Route>
        </Routes>
    </AppThemeProvider>
  );
}

export default App;
