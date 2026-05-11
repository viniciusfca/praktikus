import { useEffect, useState } from 'react';

const THEME_KEY = 'pk_admin_theme';

interface Props {
  title: string;
}

export function AdminTopbar({ title }: Props) {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem(THEME_KEY) as 'light' | 'dark') ?? 'light';
  });

  useEffect(() => {
    const root = document.querySelector('.adm-root');
    if (root) root.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  return (
    <div className="adm-topbar">
      <div>
        <div style={{ fontSize: 16, fontWeight: 600 }}>{title}</div>
        <div style={{ fontSize: 11, color: 'var(--adm-fg-muted)' }}>
          Praktikus · Console do administrador
        </div>
      </div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <button
          onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
          aria-label="Alternar tema"
          style={{
            background: 'transparent',
            border: '1px solid var(--adm-border)',
            borderRadius: 8,
            padding: '6px 10px',
            fontSize: 12,
            cursor: 'pointer',
            color: 'var(--adm-fg-muted)',
          }}
        >
          {theme === 'light' ? 'Dark' : 'Light'}
        </button>
      </div>
    </div>
  );
}
