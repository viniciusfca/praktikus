import { useAdminOverview } from '../hooks/useAdminOverview';
import { Card } from '../components/Card';
import { KpiCard } from '../components/KpiCard';
import { DonutChart } from '../components/charts/DonutChart';
import { StackedBar } from '../components/charts/StackedBar';
import { BrazilTilemap } from '../components/charts/BrazilTilemap';
import { Skeleton } from '../components/Skeleton';
import { EmptyState } from '../components/EmptyState';
import { Badge } from '../components/Badge';
import { formatNumber } from '../lib/format';
import {
  STATUS_LABEL,
  STATUS_VARIANT,
  type AdminTenantStatus,
} from '../lib/status-labels';
import { SEGMENT_COLOR, SEGMENT_LABEL } from '../lib/segment-colors';
import type { TenantSegment } from '@praktikus/shared';

const STATUS_COLORS: Record<AdminTenantStatus, string> = {
  ACTIVE: 'var(--adm-success)',
  TRIAL: 'var(--adm-info)',
  OVERDUE: 'var(--adm-warning)',
  SUSPENDED: 'var(--adm-danger)',
};

export function OverviewPage() {
  const { data, loading, error } = useAdminOverview();

  if (error) {
    return <EmptyState title="Erro" message={error} />;
  }
  if (loading || !data) {
    return (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
        }}
      >
        {/* NOSONAR(typescript:S6479) — lista estática de skeletons sem identidade; índice é a única chave possível */}
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} height={88} />
        ))}
      </div>
    );
  }

  const k = data.kpis;
  const adoption =
    k.activeTenants.value + k.trialTenants.value > 0
      ? k.whatsappTenants.value /
        (k.activeTenants.value + k.trialTenants.value)
      : 0;

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
          label="Clientes ativos"
          value={k.activeTenants.value}
          formatValue={(v) => formatNumber(v as number)}
          delta={k.activeTenants.deltaVsLastMonth}
          sparkline={k.activeTenants.sparkline}
        />
        <KpiCard
          label="Em trial"
          value={k.trialTenants.value}
          formatValue={(v) => formatNumber(v as number)}
          delta={k.trialTenants.deltaVsLastMonth}
          sparkline={k.trialTenants.sparkline}
        />
        <KpiCard
          label="Usam WhatsApp"
          value={k.whatsappTenants.value}
          formatValue={(v) =>
            `${formatNumber(v as number)} (${(adoption * 100).toFixed(0)}%)`
          }
          delta={k.whatsappTenants.deltaVsLastMonth}
          sparkline={k.whatsappTenants.sparkline}
        />
        <KpiCard label="MRR" value={null} />
      </div>

      <div
        style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}
      >
        <Card title="MRR (últimos 6 meses)">
          <div style={{ position: 'relative', height: 240 }}>
            <Skeleton width="100%" height={240} />
            <Badge variant="info">
              <span style={{ fontSize: 9 }}>Fase 1.5</span>
            </Badge>
          </div>
        </Card>
        <Card title="Distribuição por status">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              flexWrap: 'wrap',
            }}
          >
            <DonutChart
              size={140}
              data={data.statusDistribution.map((s) => ({
                label: STATUS_LABEL[s.status as AdminTenantStatus] ?? s.status,
                value: s.count,
                color:
                  STATUS_COLORS[s.status as AdminTenantStatus] ??
                  'var(--adm-fg-subtle)',
              }))}
            />
            <ul
              style={{
                listStyle: 'none',
                padding: 0,
                margin: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                fontSize: 12,
              }}
            >
              {data.statusDistribution.map((s) => (
                <li
                  key={s.status}
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background:
                        STATUS_COLORS[s.status as AdminTenantStatus] ??
                        'var(--adm-fg-subtle)',
                    }}
                  />
                  <Badge
                    variant={
                      STATUS_VARIANT[s.status as AdminTenantStatus] ??
                      'default'
                    }
                  >
                    {STATUS_LABEL[s.status as AdminTenantStatus] ?? s.status}
                  </Badge>
                  <span style={{ fontWeight: 600 }}>{s.count}</span>
                </li>
              ))}
            </ul>
          </div>
        </Card>
      </div>

      <div
        style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}
      >
        <Card title="Distribuição por segmento">
          <StackedBar
            segments={data.segmentDistribution.map((s) => ({
              label: SEGMENT_LABEL[s.segment as TenantSegment] ?? s.segment,
              value: s.count,
              color: SEGMENT_COLOR[s.segment as TenantSegment] ?? '#888',
            }))}
          />
          <ul
            style={{
              listStyle: 'none',
              padding: 0,
              margin: '12px 0 0',
              display: 'flex',
              gap: 12,
              fontSize: 12,
            }}
          >
            {data.segmentDistribution.map((s) => (
              <li
                key={s.segment}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background:
                      SEGMENT_COLOR[s.segment as TenantSegment] ?? '#888',
                  }}
                />
                {SEGMENT_LABEL[s.segment as TenantSegment] ?? s.segment} ·{' '}
                <strong>{s.count}</strong>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Trials expirando (próximos 7 dias)">
          {data.trialsExpiring.length === 0 ? (
            <EmptyState
              title="Nenhum trial expirando"
              message="Tudo tranquilo nos próximos 7 dias."
            />
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {data.trialsExpiring.map((t) => (
                <li
                  key={t.tenantId}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '6px 0',
                    borderBottom: '1px solid var(--adm-border)',
                    fontSize: 13,
                  }}
                >
                  <span>{t.nomeFantasia}</span>
                  <span style={{ color: 'var(--adm-warning)', fontWeight: 600 }}>
                    {t.daysLeft}d
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card title="Distribuição por UF">
        <BrazilTilemap data={data.ufDistribution} />
      </Card>

      <Card title="Atividade recente">
        <EmptyState
          title="Sem dados ainda"
          message="Eventos vão aparecer aqui quando o log de atividades estiver disponível (Fase 1.5)."
        />
      </Card>
    </div>
  );
}
