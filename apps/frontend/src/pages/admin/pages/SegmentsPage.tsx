import { useAdminSegments } from '../hooks/useAdminSegments';
import { Card } from '../components/Card';
import { StackedBar } from '../components/charts/StackedBar';
import { Skeleton } from '../components/Skeleton';
import { EmptyState } from '../components/EmptyState';
import { formatNumber } from '../lib/format';
import { SEGMENT_COLOR, SEGMENT_LABEL } from '../lib/segment-colors';
import { STATUS_LABEL, type AdminTenantStatus } from '../lib/status-labels';
import type { TenantSegment } from '@praktikus/shared';

const STATUS_COLORS: Record<AdminTenantStatus, string> = {
  ACTIVE: 'var(--adm-success)',
  TRIAL: 'var(--adm-info)',
  OVERDUE: 'var(--adm-warning)',
  SUSPENDED: 'var(--adm-danger)',
};

export function SegmentsPage() {
  const { data, loading, error } = useAdminSegments();
  if (error) return <EmptyState title="Erro" message={error} />;
  if (loading || !data) return <Skeleton width="100%" height={200} />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card title="Composição por segmento">
        <StackedBar
          height={20}
          segments={data.segments.map((s) => ({
            label: SEGMENT_LABEL[s.segment as TenantSegment] ?? s.segment,
            value: s.total,
            color: SEGMENT_COLOR[s.segment as TenantSegment] ?? '#888',
          }))}
        />
        <div style={{ fontSize: 12, marginTop: 8, color: 'var(--adm-fg-muted)' }}>
          Total: <strong>{formatNumber(data.totalTenants)}</strong> tenants
        </div>
      </Card>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: 16,
        }}
      >
        {data.segments.map((s) => {
          const segKey = s.segment as TenantSegment;
          return (
            <Card key={s.segment}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 12,
                }}
              >
                <span
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: 4,
                    background: SEGMENT_COLOR[segKey] ?? '#888',
                  }}
                />
                <strong>{SEGMENT_LABEL[segKey] ?? s.segment}</strong>
                <span
                  style={{
                    marginLeft: 'auto',
                    fontSize: 11,
                    color: 'var(--adm-fg-muted)',
                  }}
                >
                  {s.newLast30Days} novos / 30d
                </span>
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: 8,
                  fontSize: 12,
                }}
              >
                <div>
                  Ativos: <strong>{s.byStatus.ACTIVE ?? 0}</strong>
                </div>
                <div>
                  Trial: <strong>{s.byStatus.TRIAL ?? 0}</strong>
                </div>
                <div>
                  WhatsApp: <strong>{s.whatsappCount}</strong>
                </div>
                <div>MRR: —</div>
              </div>
              <div style={{ marginTop: 12 }}>
                <StackedBar
                  segments={(['ACTIVE', 'TRIAL', 'OVERDUE', 'SUSPENDED'] as AdminTenantStatus[]).map(
                    (st) => ({
                      label: STATUS_LABEL[st],
                      value: s.byStatus[st] ?? 0,
                      color: STATUS_COLORS[st],
                    }),
                  )}
                />
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
