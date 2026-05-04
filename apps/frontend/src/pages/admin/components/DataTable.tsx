import type { ReactNode } from 'react';
import { Skeleton } from './Skeleton';
import { EmptyState } from './EmptyState';

interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  width?: string | number;
}

interface Props<T> {
  columns: Column<T>[];
  data: T[];
  isLoading?: boolean;
  emptyTitle?: string;
  emptyMessage?: string;
  emptyAction?: ReactNode;
}

export function DataTable<T extends { id: string }>({
  columns,
  data,
  isLoading,
  emptyTitle = 'Nenhum resultado',
  emptyMessage,
  emptyAction,
}: Props<T>) {
  if (isLoading) {
    return (
      <div style={{ padding: 16 }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} style={{ marginBottom: 8 }}>
            <Skeleton height={36} />
          </div>
        ))}
      </div>
    );
  }
  if (data.length === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        message={emptyMessage}
        action={emptyAction}
      />
    );
  }
  return (
    <table
      className="adm-table"
      style={{ width: '100%', borderCollapse: 'collapse' }}
    >
      <thead>
        <tr>
          {columns.map((c) => (
            <th
              key={c.key}
              style={{
                textAlign: 'left',
                padding: '10px 12px',
                fontSize: 11,
                fontWeight: 600,
                textTransform: 'uppercase',
                color: 'var(--adm-fg-muted)',
                borderBottom: '1px solid var(--adm-border)',
                width: c.width,
              }}
            >
              {c.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((row) => (
          <tr
            key={row.id}
            style={{ borderBottom: '1px solid var(--adm-border)' }}
          >
            {columns.map((c) => (
              <td
                key={c.key}
                style={{ padding: '10px 12px', fontSize: 13 }}
              >
                {c.render(row)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
