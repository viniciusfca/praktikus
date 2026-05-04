import type { ReactNode } from 'react';

interface Props {
  search?: ReactNode;
  chips?: ReactNode;
  actions?: ReactNode;
}

export function FilterBar({ search, chips, actions }: Props) {
  return (
    <div
      className="adm-filterbar"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flexWrap: 'wrap',
        padding: '12px 16px',
        background: 'var(--adm-surface)',
        border: '1px solid var(--adm-border)',
        borderRadius: 'var(--adm-radius-md)',
      }}
    >
      {search && <div style={{ flex: '1 1 240px' }}>{search}</div>}
      {chips && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{chips}</div>
      )}
      {actions && <div style={{ marginLeft: 'auto' }}>{actions}</div>}
    </div>
  );
}
