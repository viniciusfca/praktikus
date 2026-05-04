import { useAdminWhatsapp } from '../hooks/useAdminWhatsapp';
import { Card } from '../components/Card';
import { KpiCard } from '../components/KpiCard';
import { Skeleton } from '../components/Skeleton';
import { EmptyState } from '../components/EmptyState';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { DataTable } from '../components/DataTable';
import { formatNumber, formatPercent } from '../lib/format';
import { SEGMENT_COLOR, SEGMENT_LABEL } from '../lib/segment-colors';
import { STATUS_LABEL, STATUS_VARIANT, type AdminTenantStatus } from '../lib/status-labels';
import type { TenantSegment } from '@praktikus/shared';

export function WhatsappPage() {
  const { data, loading, error } = useAdminWhatsapp();
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
        <KpiCard
          label="Adesão"
          value={data.kpis.adoptionRate}
          formatValue={(v) => formatPercent(v as number)}
        />
        <KpiCard label="MRR add-on" value={null} />
        <KpiCard
          label="Plano STARTER"
          value={data.kpis.starterCount}
          formatValue={(v) => formatNumber(v as number)}
        />
        <KpiCard
          label="Plano PRO + ENTERPRISE"
          value={data.kpis.proCount + data.kpis.enterpriseCount}
          formatValue={(v) => formatNumber(v as number)}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Card title="Quem usa">
          <DataTable
            data={data.using}
            emptyTitle="Ninguém ativou ainda"
            columns={[
              {
                key: 'name',
                header: 'Cliente',
                render: (t) => <strong>{t.nomeFantasia}</strong>,
              },
              {
                key: 'seg',
                header: 'Segmento',
                render: (t) =>
                  SEGMENT_LABEL[t.segment as TenantSegment] ?? t.segment,
              },
              {
                key: 'plan',
                header: 'Plano',
                render: (t) => (
                  <Badge variant="info">{t.whatsappPlan ?? '—'}</Badge>
                ),
              },
              { key: 'vol', header: 'Volume mensal', render: () => '—' },
            ]}
          />
        </Card>
        <Card title="Não usam">
          <DataTable
            data={data.notUsing}
            emptyTitle="Todos os elegíveis já usam"
            columns={[
              {
                key: 'name',
                header: 'Cliente',
                render: (t) => <strong>{t.nomeFantasia}</strong>,
              },
              {
                key: 'seg',
                header: 'Segmento',
                render: (t) =>
                  SEGMENT_LABEL[t.segment as TenantSegment] ?? t.segment,
              },
              {
                key: 'st',
                header: 'Status',
                render: (t) => (
                  <Badge variant={STATUS_VARIANT[t.status as AdminTenantStatus]}>
                    {STATUS_LABEL[t.status as AdminTenantStatus]}
                  </Badge>
                ),
              },
              {
                key: 'cta',
                header: '',
                render: () => (
                  <Button disabled title="Em breve">
                    Oferecer
                  </Button>
                ),
              },
            ]}
          />
        </Card>
      </div>

      <Card title="Adesão por segmento">
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {data.adoptionBySegment.map((s) => (
            <li
              key={s.segment}
              style={{
                display: 'grid',
                gridTemplateColumns: '120px 1fr 80px',
                gap: 12,
                alignItems: 'center',
                padding: '6px 0',
              }}
            >
              <span
                style={{ color: SEGMENT_COLOR[s.segment as TenantSegment] }}
              >
                {SEGMENT_LABEL[s.segment as TenantSegment] ?? s.segment}
              </span>
              <div
                style={{
                  height: 8,
                  background: 'var(--adm-bg-muted)',
                  borderRadius: 4,
                }}
              >
                <div
                  style={{
                    width: `${(s.rate * 100).toFixed(0)}%`,
                    height: '100%',
                    background: SEGMENT_COLOR[s.segment as TenantSegment],
                    borderRadius: 4,
                  }}
                />
              </div>
              <span style={{ fontSize: 12, fontWeight: 600 }}>
                {formatPercent(s.rate)} ({s.using}/{s.eligible})
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
