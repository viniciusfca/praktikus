import type { SoStatus } from '../services/service-orders.service';

type StatusConfig = { label: string; color: string; bg: string };

const STATUS_MAP: Record<SoStatus, StatusConfig> = {
  ORCAMENTO:       { label: 'Orçamento',    color: '#6b7280', bg: 'rgba(107, 114, 128, 0.12)' },
  APROVADO:        { label: 'Aprovado',     color: 'var(--cui-primary)', bg: 'rgba(52, 142, 145, 0.12)' },
  EM_EXECUCAO:     { label: 'Em execução',  color: 'var(--cui-primary)', bg: 'rgba(52, 142, 145, 0.12)' },
  AGUARDANDO_PECA: { label: 'Aguard. peça', color: '#d97706', bg: 'rgba(217, 119, 6, 0.12)' },
  FINALIZADA:      { label: 'Finalizada',   color: '#16a34a', bg: 'rgba(22, 163, 74, 0.12)' },
  ENTREGUE:        { label: 'Entregue',     color: '#16a34a', bg: 'rgba(22, 163, 74, 0.12)' },
};

export function SoStatusBadge({ status }: { status: SoStatus }) {
  const s = STATUS_MAP[status];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '3px 10px',
        borderRadius: 999,
        fontSize: 11.5,
        fontWeight: 600,
        color: s.color,
        background: s.bg,
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
      {s.label}
    </span>
  );
}

export function PaymentBadge({ status }: { status: 'PAGO' | 'PENDENTE' | string }) {
  const paid = status === 'PAGO';
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '2px 8px',
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        color: paid ? '#16a34a' : '#6b7280',
        background: paid ? 'rgba(22, 163, 74, 0.1)' : 'rgba(107, 114, 128, 0.1)',
        border: `1px solid ${paid ? 'rgba(22, 163, 74, 0.25)' : 'rgba(107, 114, 128, 0.25)'}`,
      }}
    >
      {paid ? 'pago' : 'pendente'}
    </span>
  );
}
