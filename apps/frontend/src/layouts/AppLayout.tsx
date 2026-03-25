import { useState, useCallback, useMemo } from 'react';
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
import { useSessionCountdown } from '../hooks/useSessionCountdown';

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

  const { minutes, seconds, isWarning } = useSessionCountdown(user?.exp);

  const handleLogout = useCallback(async () => {
    setAnchorEl(null);
    await logout();
    navigate('/login');
  }, [logout, navigate]);

  const drawerWidth = isMobile ? DRAWER_WIDTH : sidebarOpen ? DRAWER_WIDTH : DRAWER_MINI;

  const drawerContent = useMemo(() => (
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
            Practicus
          </Typography>
        )}
        {!isMobile && (
          <IconButton onClick={handleToggleSidebar} size="small" aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}>
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
  ), [sidebarOpen, isMobile, location.pathname, user?.role, handleToggleSidebar]);

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
              duration: sidebarOpen
                ? t.transitions.duration.enteringScreen
                : t.transitions.duration.leavingScreen,
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

          {/* Session countdown */}
          {user && (
            <Typography
              variant="caption"
              sx={{
                color: isWarning ? 'warning.main' : 'text.disabled',
                fontVariantNumeric: 'tabular-nums',
                mr: 0.5,
              }}
            >
              {`${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`}
            </Typography>
          )}

          {/* Theme toggle */}
          <IconButton onClick={toggleTheme} size="small" aria-label={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
            {mode === 'dark' ? <LightModeIcon fontSize="small" /> : <DarkModeIcon fontSize="small" />}
          </IconButton>

          {/* Avatar */}
          <IconButton
            onClick={(e) => setAnchorEl(e.currentTarget)}
            size="small"
            aria-label="Open user menu"
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
              duration: sidebarOpen
                ? t.transitions.duration.enteringScreen
                : t.transitions.duration.leavingScreen,
            }),
        }}
      >
        <Toolbar />
        <Outlet />
      </Box>
    </Box>
  );
}
