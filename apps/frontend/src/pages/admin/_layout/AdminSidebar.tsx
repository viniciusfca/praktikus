import { NavLink } from 'react-router-dom';
import { Avatar } from '../components/Avatar';
import { Badge } from '../components/Badge';
import { usePlatformAuthStore } from '../../../store/platform-auth.store';

const NAV = [
  { to: '/admin', label: 'Visão geral', exact: true },
  { to: '/admin/clientes', label: 'Clientes' },
  { to: '/admin/segmentos', label: 'Segmentos' },
  { to: '/admin/whatsapp', label: 'WhatsApp' },
  { to: '/admin/financeiro', label: 'Financeiro' },
];

const COMING = [
  { label: 'Suporte' },
  { label: 'Configurações' },
];

export function AdminSidebar() {
  const user = usePlatformAuthStore((s) => s.user);
  const logout = usePlatformAuthStore((s) => s.logout);

  return (
    <aside
      style={{
        background: 'var(--brand-950)',
        color: '#DCE6E6',
        height: '100vh',
        position: 'sticky',
        top: 0,
        display: 'flex',
        flexDirection: 'column',
        padding: '20px 12px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '0 8px 16px',
          borderBottom: '1px solid #1F3536',
          marginBottom: 12,
        }}
      >
        <strong style={{ fontSize: 16, color: '#fff' }}>Praktikus</strong>
        <Badge variant="info">Admin</Badge>
      </div>

      <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.exact}
            style={({ isActive }) => ({
              padding: '10px 12px',
              borderRadius: 8,
              color: isActive ? '#fff' : '#86AEB0',
              background: isActive ? '#122020' : 'transparent',
              border: isActive ? '1px solid #1F3536' : '1px solid transparent',
              fontSize: 13,
              fontWeight: isActive ? 600 : 500,
              textDecoration: 'none',
              transition: 'all .12s ease',
            })}
          >
            {item.label}
          </NavLink>
        ))}

        <div style={{ height: 12 }} />

        {COMING.map((item) => (
          <div
            key={item.label}
            style={{
              padding: '10px 12px',
              borderRadius: 8,
              color: '#4E5757',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'not-allowed',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
            title="Em breve"
          >
            <span>{item.label}</span>
            <span
              style={{
                fontSize: 9,
                fontWeight: 600,
                textTransform: 'uppercase',
                color: '#558D8F',
              }}
            >
              Em breve
            </span>
          </div>
        ))}
      </nav>

      <div
        style={{
          paddingTop: 16,
          borderTop: '1px solid #1F3536',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <Avatar name={user?.name ?? '?'} size={32} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: '#fff',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {user?.name ?? '—'}
          </div>
          <div style={{ fontSize: 10, color: '#86AEB0' }}>
            Platform Owner
          </div>
        </div>
        <button
          onClick={() => {
            void logout().then(() => {
              window.location.href = '/admin/login';
            });
          }}
          style={{
            background: 'transparent',
            border: '1px solid #1F3536',
            color: '#86AEB0',
            padding: '4px 8px',
            fontSize: 11,
            borderRadius: 6,
            cursor: 'pointer',
          }}
        >
          Sair
        </button>
      </div>
    </aside>
  );
}
