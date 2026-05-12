import { useState, useCallback, useEffect, useMemo } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  CSidebar,
  CSidebarBrand,
  CSidebarNav,
  CNavItem,
  CNavLink,
  CHeader,
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
  cilCash,
  cilBasket,
  cilLayers,
  cilCart,
  cilPeople,
  cilFactory,
  cilList,
  cilGroup,
  cilSettings,
  cilMenu,
  cilChevronLeft,
  cilSun,
  cilMoon,
  cilAccountLogout,
  cilTruck,
  cilSpeech,
} from '@coreui/icons';
import { useAuthStore } from '../store/auth.store';
import { usePermissionsStore } from '../store/permissions.store';
import { useThemeMode } from '../theme/ThemeProvider';
import { useSessionCountdown } from '../hooks/useSessionCountdown';
import { Logo } from '../components/Logo';
import type { EmployeePermissions } from '../services/recycling/employees.service';

const STORAGE_KEY = 'recycling_sidebar_open';

type NavItem = {
  label: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: use IconType from @coreui/icons when properly exported
  icon: any;
  path: string;
  ownerOnly: boolean;
  requiredFeature?: 'whatsapp';
  requiresPermission?: keyof EmployeePermissions;
};

const navItems: NavItem[] = [
  { label: 'Dashboard', icon: cilSpeedometer, path: '/recycling/dashboard', ownerOnly: false },
  { label: 'Caixa', icon: cilCash, path: '/recycling/cash-register', ownerOnly: false, requiresPermission: 'canOpenCloseCash' },
  { label: 'Compras', icon: cilBasket, path: '/recycling/purchases', ownerOnly: false, requiresPermission: 'canRegisterPurchases' },
  { label: 'Estoque', icon: cilLayers, path: '/recycling/stock', ownerOnly: false, requiresPermission: 'canViewStock' },
  { label: 'Vendas', icon: cilCart, path: '/recycling/sales', ownerOnly: false, requiresPermission: 'canRegisterSales' },
  { label: 'Coletas', icon: cilTruck, path: '/recycling/coletas', ownerOnly: false, requiresPermission: 'canManageColetas' },
  { label: 'Fornecedores', icon: cilPeople, path: '/recycling/suppliers', ownerOnly: false, requiresPermission: 'canManageSuppliers' },
  { label: 'Compradores', icon: cilFactory, path: '/recycling/buyers', ownerOnly: false, requiresPermission: 'canManageBuyers' },
  { label: 'Produtos', icon: cilList, path: '/recycling/products', ownerOnly: false, requiresPermission: 'canManageProducts' },
  { label: 'WhatsApp', icon: cilSpeech, path: '/whatsapp', ownerOnly: false, requiredFeature: 'whatsapp' },
  { label: 'Funcionários', icon: cilGroup, path: '/recycling/employees', ownerOnly: true },
  { label: 'Configurações', icon: cilSettings, path: '/recycling/settings', ownerOnly: true },
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

function TenantBanner({ status, trialEndsAt, basePath }: { status?: string; trialEndsAt?: string | null; basePath: string }) {
  const navigate = useNavigate();

  if (status === 'OVERDUE') {
    return (
      <div style={{ background: '#dc2626', color: '#fff', padding: '8px 16px', textAlign: 'center', fontSize: 14 }}>
        Sua assinatura está em atraso. Pague agora para evitar a suspensão.{' '}
        <button
          type="button"
          onClick={() => navigate(`${basePath}/settings`)}
          style={{
            color: '#fff',
            textDecoration: 'underline',
            cursor: 'pointer',
            background: 'none',
            border: 'none',
            padding: 0,
            font: 'inherit',
          }}
        >
          Pagar agora
        </button>
      </div>
    );
  }

  if (status === 'TRIAL' && trialEndsAt) {
    const diffDays = Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (diffDays >= 0) {
      const isUrgent = diffDays <= 7;
      return (
        <div
          style={{
            background: isUrgent ? '#fde68a' : '#fef3c7',
            color: '#92400e',
            padding: '8px 16px',
            textAlign: 'center',
            fontSize: 14,
          }}
        >
          {isUrgent ? '⚠️ ' : ''}Seu trial termina em <strong>{diffDays} {diffDays === 1 ? 'dia' : 'dias'}</strong>. Cadastre uma forma de pagamento.{' '}
          <button
            type="button"
            onClick={() => navigate(`${basePath}/settings`)}
            style={{
              color: '#92400e',
              textDecoration: 'underline',
              cursor: 'pointer',
              background: 'none',
              border: 'none',
              padding: 0,
              font: 'inherit',
            }}
          >
            Cadastrar agora
          </button>
        </div>
      );
    }
  }

  return null;
}

export function RecyclingLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);
  const permissions = usePermissionsStore((s) => s.permissions);
  const fetchPermissions = usePermissionsStore((s) => s.fetch);
  const { mode, toggleTheme } = useThemeMode();

  // Carrega as permissões granulares do usuário logado quando entrar no layout
  // do recycling. OWNER faz bypass no backend, mas continuamos chamando para
  // manter o estado consistente caso o user troque de tenant/sessão.
  useEffect(() => {
    if (user?.sub && user.tenant_segment === 'RECYCLING') {
      fetchPermissions().catch(() => {
        // Falha silenciosa — store já zera estado em caso de erro.
      });
    }
  }, [user?.sub, user?.tenant_segment, fetchPermissions]);

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

  const { display: sessionDisplay, isWarning } = useSessionCountdown(user?.exp);

  const sidebarNav = useMemo(
    () =>
      navItems
        .filter((item) => {
          if (item.ownerOnly && user?.role !== 'OWNER') return false;
          if (item.requiredFeature === 'whatsapp' && !user?.whatsapp_enabled) return false;
          if (item.requiresPermission) {
            // OWNER tem acesso total — bypass.
            if (user?.role === 'OWNER') return true;
            // Sem permissões carregadas: esconder por segurança.
            if (!permissions) return false;
            return permissions[item.requiresPermission];
          }
          return true;
        })
        .map((item) => {
          const active =
            location.pathname === item.path ||
            location.pathname.startsWith(item.path + '/');

          const showLabel = sidebarOpen || isMobile;
          const navItem = (
            <CNavItem key={item.label}>
              <CNavLink
                as={Link}
                to={item.path}
                active={active}
                onClick={() => isMobile && setMobileVisible(false)}
              >
                <CIcon icon={item.icon} customClassName="nav-icon" />
                {showLabel && <span className="nav-label">{item.label}</span>}
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
    [location.pathname, sidebarOpen, isMobile, user?.role, user?.whatsapp_enabled, permissions]
  );

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar */}
      <CSidebar
        className="border-end"
        colorScheme={mode}
        narrow={!isMobile && !sidebarOpen}
        visible={isMobile ? mobileVisible : true}
        overlaid={isMobile}
        onVisibleChange={(val: boolean) => {
          if (isMobile) setMobileVisible(val);
        }}
      >
        <CSidebarBrand
          as="div"
          className="d-flex align-items-center px-3"
          style={{ minHeight: 56, gap: 8, textDecoration: 'none' }}
        >
          {(sidebarOpen || isMobile) ? (
            <>
              <Logo size={26} />
              {!isMobile && (
                <button
                  className="sidebar-collapse-btn ms-auto"
                  onClick={handleToggleSidebar}
                  aria-label="Collapse sidebar"
                  type="button"
                >
                  <CIcon icon={cilChevronLeft} size="sm" />
                </button>
              )}
            </>
          ) : (
            <button
              className="sidebar-collapse-btn sidebar-collapse-btn--expand mx-auto"
              onClick={handleToggleSidebar}
              aria-label="Expand sidebar"
              type="button"
            >
              <Logo variant="icon" size={26} />
            </button>
          )}
        </CSidebarBrand>
        <hr className="m-0" />
        <CSidebarNav>{sidebarNav}</CSidebarNav>
      </CSidebar>

      {/* Main wrapper */}
      <div className="wrapper d-flex flex-column flex-grow-1">
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
                  {sessionDisplay}
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
                <CDropdownToggle caret={false} className="p-0 border-0 bg-transparent" aria-label="Open user menu">
                  <CAvatar
                    size="sm"
                    color="primary"
                    textColor="white"
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
          <TenantBanner
            status={user?.tenant_status}
            trialEndsAt={user?.trial_ends_at}
            basePath="/recycling"
          />
          <Outlet />
        </div>
      </div>
    </div>
  );
}
