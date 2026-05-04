import type { ReactNode } from 'react';

interface Props {
  active?: boolean;
  onClick?: () => void;
  children: ReactNode;
}

export function Chip({ active = false, onClick, children }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="adm-chip"
      data-active={active ? 'true' : 'false'}
      style={{
        padding: '6px 12px',
        fontSize: 12,
        fontWeight: 500,
        borderRadius: 999,
        border: '1px solid var(--adm-border)',
        background: active ? 'var(--adm-accent-soft)' : 'var(--adm-surface)',
        color: active ? 'var(--adm-accent)' : 'var(--adm-fg-muted)',
        cursor: 'pointer',
        transition: 'all .12s ease',
      }}
    >
      {children}
    </button>
  );
}
