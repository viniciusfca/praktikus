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
  CAlert,
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: use IconType from @coreui/icons when properly exported
const navItems: Array<{ label: string; icon: any; path: string; ownerOnly: boolean }> = [
  { label: 'Dashboard', icon: cilSpeedometer, path: '/workshop/dashboard', ownerOnly: false },
  { label: 'Agendamentos', icon: cilCalendar, path: '/workshop/appointments', ownerOnly: false },
  { label: 'Ordens de Serviço', icon: cilNotes, path: '/workshop/service-orders', ownerOnly: false },
  { label: 'Clientes', icon: cilPeople, path: '/workshop/customers', ownerOnly: false },
  { label: 'Veículos', icon: cilCarAlt, path: '/workshop/vehicles', ownerOnly: false },
  { label: 'Catálogo', icon: cilList, path: '/workshop/catalog', ownerOnly: false },
  { label: 'Relatórios', icon: cilChartLine, path: '/workshop/reports', ownerOnly: true },
  { label: 'Configurações', icon: cilSettings, path: '/workshop/settings', ownerOnly: true },
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
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar */}
      <CSidebar
        className="border-end"
        colorScheme="dark"
        narrow={!isMobile && !sidebarOpen}
        visible={isMobile ? mobileVisible : true}
        overlaid={isMobile}
        onVisibleChange={(val: boolean) => {
          if (isMobile) setMobileVisible(val);
        }}
      >
        <CSidebarBrand
          className="d-flex align-items-center justify-content-between px-3"
          style={{ minHeight: 56 }}
        >
          {(sidebarOpen || isMobile) && (
            <span className="fw-bold text-primary fs-5">Practicus</span>
          )}
          {!isMobile && (
            <button
              className="btn btn-sm btn-ghost-secondary ms-auto"
              onClick={handleToggleSidebar}
              aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
              style={{ border: 'none', background: 'none', color: 'inherit' }}
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
          {user?.tenant_status === 'OVERDUE' && (
            <CAlert color="warning" className="mb-3 text-center py-2">
              Pagamento em atraso. Regularize para evitar suspensão da conta.
            </CAlert>
          )}
          <Outlet />
        </div>
      </div>
    </div>
  );
}
