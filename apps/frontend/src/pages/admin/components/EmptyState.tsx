import type { ReactNode } from 'react';

interface Props {
  title: string;
  message?: string;
  action?: ReactNode;
}

export function EmptyState({ title, message, action }: Props) {
  return (
    <div className="adm-empty">
      <div className="adm-empty__title">{title}</div>
      {message && <div className="adm-empty__msg">{message}</div>}
      {action && <div style={{ marginTop: 12 }}>{action}</div>}
    </div>
  );
}
