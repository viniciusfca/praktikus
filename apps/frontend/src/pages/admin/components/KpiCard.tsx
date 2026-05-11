import type { ReactNode } from 'react';
import { Skeleton } from './Skeleton';
import { SparklineSvg } from './charts/SparklineSvg';

interface Props {
  label: string;
  value: number | string | null;
  formatValue?: (v: number | string) => string;
  delta?: number | null;
  sparkline?: number[];
  icon?: ReactNode;
  /** Tooltip mostrado quando value=null */
  nullHint?: string;
}

function resolveSparklineNode(
  isNull: boolean,
  sparkline: number[] | undefined,
): ReactNode {
  if (isNull) return <Skeleton width={80} height={32} />;
  if (sparkline && sparkline.length > 0) return <SparklineSvg data={sparkline} />;
  return null;
}

export function KpiCard({
  label,
  value,
  formatValue,
  delta,
  sparkline,
  icon,
  nullHint = 'Disponível na Fase 1.5',
}: Props) {
  const isNull = value == null;
  let display: string;
  if (value == null) {
    display = '—';
  } else if (formatValue) {
    display = formatValue(value);
  } else {
    display = String(value);
  }

  const sparklineNode = resolveSparklineNode(isNull, sparkline);

  return (
    <div
      className="adm-kpi adm-card"
      title={isNull ? nullHint : undefined}
      style={{ position: 'relative', minHeight: 88 }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          color: 'var(--adm-fg-muted)',
          fontSize: 11,
          textTransform: 'uppercase',
          letterSpacing: 0.04,
          fontWeight: 600,
          marginBottom: 8,
        }}
      >
        {icon}
        {label}
      </div>
      <div
        style={{
          fontSize: 26,
          fontWeight: 700,
          fontVariantNumeric: 'tabular-nums',
          color: isNull ? 'var(--adm-fg-subtle)' : 'var(--adm-fg)',
        }}
      >
        {display}
      </div>
      {!isNull && delta != null && (
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: delta >= 0 ? 'var(--adm-success)' : 'var(--adm-danger)',
          }}
        >
          {delta >= 0 ? '+' : ''}
          {delta}%
        </div>
      )}
      <div
        style={{ position: 'absolute', right: 16, bottom: 16 }}
        aria-hidden="true"
      >
        {sparklineNode}
      </div>
    </div>
  );
}
