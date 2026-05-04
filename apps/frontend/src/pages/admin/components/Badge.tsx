import type { ReactNode } from 'react';

type Variant = 'default' | 'success' | 'warning' | 'danger' | 'info';

interface Props {
  variant?: Variant;
  children: ReactNode;
}

export function Badge({ variant = 'default', children }: Props) {
  const cls = variant === 'default' ? 'adm-badge' : `adm-badge adm-badge--${variant}`;
  return <span className={cls}>{children}</span>;
}
