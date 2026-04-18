import type { ReactNode } from 'react';

export const labelStyle = { fontWeight: 500, fontSize: 13 };

interface CardProps {
  children: ReactNode;
  header?: ReactNode;
  padding?: number | string;
}

export function Card({ children, header, padding = 20 }: CardProps) {
  return (
    <div
      style={{
        background: 'var(--cui-card-bg)',
        border: '1px solid var(--cui-border-color)',
        borderRadius: 14,
        overflow: 'hidden',
      }}
    >
      {header && (
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--cui-border-color)' }}>
          {header}
        </div>
      )}
      <div style={{ padding: typeof padding === 'number' ? padding : padding }}>{children}</div>
    </div>
  );
}

interface CardTitleProps {
  title: string;
  desc?: string;
}

export function CardTitle({ title, desc }: CardTitleProps) {
  return (
    <div>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--cui-body-color)' }}>{title}</div>
      {desc && (
        <div style={{ fontSize: 12.5, color: 'var(--cui-secondary-color)', marginTop: 2 }}>{desc}</div>
      )}
    </div>
  );
}
