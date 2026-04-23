import type { ReactNode } from 'react';

interface PageHeadProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export function PageHead({ title, subtitle, actions }: PageHeadProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 20,
        flexWrap: 'wrap',
        marginBottom: 20,
      }}
    >
      <div>
        <h1
          style={{
            margin: 0,
            fontSize: 22,
            fontWeight: 600,
            letterSpacing: '-0.02em',
            color: 'var(--cui-body-color)',
          }}
        >
          {title}
        </h1>
        {subtitle && (
          <p style={{ margin: '4px 0 0', fontSize: 13.5, color: 'var(--cui-secondary-color)' }}>
            {subtitle}
          </p>
        )}
      </div>
      {actions && <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>{actions}</div>}
    </div>
  );
}
