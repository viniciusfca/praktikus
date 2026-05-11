import { CBadge } from '@coreui/react';
import type { BillingSummary } from '../../services/billing.service';

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  TRIAL:     { label: 'Trial',     color: 'info' },
  ACTIVE:    { label: 'Ativo',     color: 'success' },
  OVERDUE:   { label: 'Em atraso', color: 'warning' },
  SUSPENDED: { label: 'Suspenso',  color: 'danger' },
};

export function BillingStatusCard({ summary }: { summary: BillingSummary }) {
  const status = STATUS_LABEL[summary.status] ?? { label: summary.status, color: 'secondary' };
  const formatBRL = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  let nextLine: string;
  if (summary.status === 'TRIAL' && summary.daysUntilTrialEnds !== null) {
    nextLine = `Trial termina em ${summary.daysUntilTrialEnds} dia${summary.daysUntilTrialEnds !== 1 ? 's' : ''}`;
  } else if (summary.nextDueDate) {
    nextLine = `Próxima cobrança em ${new Date(summary.nextDueDate).toLocaleDateString('pt-BR')}`;
  } else {
    nextLine = '—';
  }

  return (
    <div style={{ padding: 18, border: '1px solid #e3e7e7', borderRadius: 12, background: '#fff' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <strong style={{ fontSize: 16 }}>{summary.planName}</strong>
        <CBadge color={status.color}>{status.label}</CBadge>
      </div>
      <div style={{ fontSize: 22, fontWeight: 700 }}>{formatBRL(summary.planValue)}/mês</div>
      <div style={{ fontSize: 13, color: '#5b6868', marginTop: 6 }}>{nextLine}</div>
      {summary.canceledAt && (
        <div style={{ marginTop: 8, fontSize: 13, color: '#b91c1c' }}>
          Cancelada em {new Date(summary.canceledAt).toLocaleDateString('pt-BR')}.
        </div>
      )}
    </div>
  );
}
