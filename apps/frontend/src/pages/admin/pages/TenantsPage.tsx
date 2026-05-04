import { useEffect, useState } from 'react';
import { useAdminTenants, type TenantFilters } from '../hooks/useAdminTenants';
import { Card } from '../components/Card';
import { Chip } from '../components/Chip';
import { FilterBar } from '../components/FilterBar';
import { DataTable } from '../components/DataTable';
import { KpiCard } from '../components/KpiCard';
import { Badge } from '../components/Badge';
import { Avatar } from '../components/Avatar';
import { HealthBar } from '../components/HealthBar';
import { Button } from '../components/Button';
import { formatNumber } from '../lib/format';
import {
  STATUS_LABEL,
  STATUS_VARIANT,
  type AdminTenantStatus,
} from '../lib/status-labels';
import { SEGMENT_COLOR, SEGMENT_LABEL } from '../lib/segment-colors';
import type { TenantSegment } from '@praktikus/shared';

const FILTERS_KEY = 'pk_admin_filters_clientes';

const STATUSES: AdminTenantStatus[] = [
  'ACTIVE',
  'TRIAL',
  'OVERDUE',
  'SUSPENDED',
];

function loadFilters(): TenantFilters {
  try {
    const raw = localStorage.getItem(FILTERS_KEY);
    if (!raw) return { status: 'all', segment: 'all', wpp: 'all', q: '' };
    return { ...JSON.parse(raw), page: 1 };
  } catch {
    return { status: 'all', segment: 'all', wpp: 'all', q: '' };
  }
}

export function TenantsPage() {
  const [filters, setFilters] = useState<TenantFilters>(() => loadFilters());

  useEffect(() => {
    localStorage.setItem(
      FILTERS_KEY,
      JSON.stringify({
        status: filters.status,
        segment: filters.segment,
        wpp: filters.wpp,
        q: filters.q,
      }),
    );
  }, [filters.status, filters.segment, filters.wpp, filters.q]);

  const { data, loading, error } = useAdminTenants(filters);
  const counters = data?.countersByStatus;

  function setStatus(s: AdminTenantStatus | 'all') {
    setFilters((f) => ({ ...f, status: s, page: 1 }));
  }
  function setSegment(s: TenantFilters['segment']) {
    setFilters((f) => ({ ...f, segment: s, page: 1 }));
  }
  function setWpp(s: TenantFilters['wpp']) {
    setFilters((f) => ({ ...f, wpp: s, page: 1 }));
  }
  function clear() {
    setFilters({
      status: 'all',
      segment: 'all',
      wpp: 'all',
      q: '',
      page: 1,
      pageSize: 25,
    });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
        }}
      >
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setStatus(filters.status === s ? 'all' : s)}
            style={{
              all: 'unset',
              cursor: 'pointer',
              border:
                filters.status === s
                  ? '2px solid var(--adm-accent)'
                  : '1px solid var(--adm-border)',
              borderRadius: 'var(--adm-radius-md)',
              transition: 'all .12s ease',
            }}
          >
            <KpiCard
              label={STATUS_LABEL[s]}
              value={counters ? counters[s] : null}
              formatValue={(v) => formatNumber(v as number)}
            />
          </button>
        ))}
      </div>

      <Card>
        <FilterBar
          search={
            <input
              type="search"
              placeholder="Buscar por nome, CNPJ, slug…"
              value={filters.q ?? ''}
              onChange={(e) =>
                setFilters((f) => ({ ...f, q: e.target.value, page: 1 }))
              }
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid var(--adm-border)',
                borderRadius: 6,
                fontSize: 13,
              }}
            />
          }
          chips={
            <>
              <Chip
                active={filters.segment === 'all'}
                onClick={() => setSegment('all')}
              >
                Todos os segmentos
              </Chip>
              <Chip
                active={filters.segment === 'WORKSHOP'}
                onClick={() => setSegment('WORKSHOP')}
              >
                Oficina
              </Chip>
              <Chip
                active={filters.segment === 'RECYCLING'}
                onClick={() => setSegment('RECYCLING')}
              >
                Recicláveis
              </Chip>
              <span style={{ width: 1, background: 'var(--adm-border)' }} />
              <Chip active={filters.wpp === 'all'} onClick={() => setWpp('all')}>
                WhatsApp: todos
              </Chip>
              <Chip active={filters.wpp === 'yes'} onClick={() => setWpp('yes')}>
                Usa
              </Chip>
              <Chip active={filters.wpp === 'no'} onClick={() => setWpp('no')}>
                Não usa
              </Chip>
            </>
          }
          actions={<Button onClick={clear}>Limpar filtros</Button>}
        />

        <div style={{ marginTop: 12 }}>
          {error ? (
            <div style={{ color: 'var(--adm-danger)' }}>{error}</div>
          ) : (
            <DataTable
              isLoading={loading}
              data={data?.data ?? []}
              emptyTitle="Nenhum cliente encontrado"
              emptyMessage="Ajuste os filtros pra ver resultados."
              emptyAction={<Button onClick={clear}>Limpar filtros</Button>}
              columns={[
                {
                  key: 'cliente',
                  header: 'Cliente',
                  render: (t) => (
                    <div
                      style={{
                        display: 'flex',
                        gap: 8,
                        alignItems: 'center',
                      }}
                    >
                      <Avatar
                        name={t.nomeFantasia}
                        color={
                          SEGMENT_COLOR[t.segment as TenantSegment] ??
                          'var(--adm-accent)'
                        }
                      />
                      <div>
                        <div style={{ fontWeight: 600 }}>{t.nomeFantasia}</div>
                        <div
                          style={{
                            fontSize: 11,
                            color: 'var(--adm-fg-muted)',
                          }}
                        >
                          {t.cnpj}
                          {t.city && (
                            <>
                              {' '}
                              · {t.city}/{t.state}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ),
                },
                {
                  key: 'segment',
                  header: 'Segmento',
                  render: (t) => (
                    <span
                      style={{
                        color: SEGMENT_COLOR[t.segment as TenantSegment],
                        fontWeight: 600,
                      }}
                    >
                      {SEGMENT_LABEL[t.segment as TenantSegment] ?? t.segment}
                    </span>
                  ),
                },
                {
                  key: 'status',
                  header: 'Status',
                  render: (t) => (
                    <Badge variant={STATUS_VARIANT[t.status as AdminTenantStatus]}>
                      {STATUS_LABEL[t.status as AdminTenantStatus]}
                    </Badge>
                  ),
                },
                { key: 'plan', header: 'Plano', render: () => '—' },
                {
                  key: 'wpp',
                  header: 'WhatsApp',
                  render: (t) => (
                    <Badge variant={t.whatsappEnabled ? 'success' : 'default'}>
                      {t.whatsappEnabled ? 'On' : 'Off'}
                    </Badge>
                  ),
                },
                {
                  key: 'health',
                  header: 'Saúde',
                  render: (t) => <HealthBar score={t.healthScore} />,
                },
                { key: 'mrr', header: 'MRR', render: () => '—' },
                { key: 'lastSeen', header: 'Última atividade', render: () => '—' },
                {
                  key: 'actions',
                  header: '',
                  render: () => (
                    <Button disabled title="Em breve">
                      Ver
                    </Button>
                  ),
                },
              ]}
            />
          )}

          {data && data.total > 0 && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: 12,
                fontSize: 12,
                color: 'var(--adm-fg-muted)',
              }}
            >
              <span>
                Página {data.page} ·{' '}
                {(data.page - 1) * data.pageSize + 1}–
                {Math.min(data.page * data.pageSize, data.total)} de {data.total}
              </span>
              <span style={{ display: 'flex', gap: 8 }}>
                <Button
                  disabled={data.page === 1}
                  onClick={() =>
                    setFilters((f) => ({ ...f, page: (f.page ?? 1) - 1 }))
                  }
                >
                  Anterior
                </Button>
                <Button
                  disabled={data.page * data.pageSize >= data.total}
                  onClick={() =>
                    setFilters((f) => ({ ...f, page: (f.page ?? 1) + 1 }))
                  }
                >
                  Próxima
                </Button>
              </span>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
