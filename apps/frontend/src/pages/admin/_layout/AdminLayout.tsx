import { Outlet, useLocation } from 'react-router-dom';
import { AdminSidebar } from './AdminSidebar';
import { AdminTopbar } from './AdminTopbar';
import '../styles/admin-tokens.css';
import '../styles/admin-components.css';

const TITLES: Record<string, string> = {
  '/admin': 'Visão geral',
  '/admin/clientes': 'Clientes',
  '/admin/segmentos': 'Segmentos',
  '/admin/whatsapp': 'WhatsApp',
  '/admin/financeiro': 'Financeiro',
};

export function AdminLayout() {
  const loc = useLocation();
  const title = TITLES[loc.pathname] ?? 'Admin';
  return (
    <div className="adm-root adm-shell">
      <AdminSidebar />
      <div className="adm-shell__main">
        <AdminTopbar title={title} />
        <main className="adm-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
