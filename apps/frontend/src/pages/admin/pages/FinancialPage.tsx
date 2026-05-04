import { useAdminFinancial } from '../hooks/useAdminFinancial';
import { Card } from '../components/Card';
import { KpiCard } from '../components/KpiCard';
import { Skeleton } from '../components/Skeleton';
import { EmptyState } from '../components/EmptyState';
import { formatNumber } from '../lib/format';

export function FinancialPage() {
  const { data, loading, error } = useAdminFinancial();
  if (error) return <EmptyState title="Erro" message={error} />;
  if (loading || !data) return <Skeleton width="100%" height={200} />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
        }}
      >
        <KpiCard label="MRR" value={null} />
        <KpiCard label="ARR" value={null} />
        <KpiCard label="Ticket médio" value={null} />
        <KpiCard label="Churn 30d" value={null} />
      </div>

      <Card title="Distribuição financeira (visão básica)">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 16,
          }}
        >
          <div>
            <div style={{ fontSize: 11, color: 'var(--adm-fg-muted)' }}>
              Pagantes (ACTIVE)
            </div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>
              {formatNumber(data.basicDistribution.active)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--adm-fg-muted)' }}>
              Em atraso (OVERDUE)
            </div>
            <div
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: 'var(--adm-warning)',
              }}
            >
              {formatNumber(data.basicDistribution.overdue)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--adm-fg-muted)' }}>
              Suspensos (total)
            </div>
            <div
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: 'var(--adm-danger)',
              }}
            >
              {formatNumber(data.basicDistribution.suspended)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--adm-fg-muted)' }}>
              Suspensos últimos 30d
            </div>
            <div
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: 'var(--adm-danger)',
              }}
            >
              {formatNumber(data.basicDistribution.suspendedLast30Days)}
            </div>
          </div>
        </div>
      </Card>

      <Card title="Cobranças recentes">
        <EmptyState
          title="Sem dados ainda"
          message="A integração com Asaas (sync de cobranças) entra na Fase 1.5."
        />
      </Card>
    </div>
  );
}
