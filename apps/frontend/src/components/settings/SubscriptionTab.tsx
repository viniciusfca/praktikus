import { useEffect, useState } from 'react';
import { CAlert, CButton, CSpinner } from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilCheck, cilExternalLink } from '@coreui/icons';
import { Card, CardTitle } from './Card';
import { companyService, type CompanyProfile } from '../../services/company.service';

const STATUS_MAP: Record<string, { label: string; color: string; bg: string; border: string }> = {
  TRIAL:     { label: 'Trial',     color: 'var(--cui-primary)', bg: 'rgba(52, 142, 145, 0.1)',  border: 'rgba(52, 142, 145, 0.3)' },
  ACTIVE:    { label: 'Ativo',     color: '#15803d',            bg: 'rgba(22, 163, 74, 0.1)',   border: 'rgba(22, 163, 74, 0.3)' },
  OVERDUE:   { label: 'Em atraso', color: '#b45309',            bg: 'rgba(217, 119, 6, 0.1)',   border: 'rgba(217, 119, 6, 0.3)' },
  SUSPENDED: { label: 'Suspenso',  color: '#b91c1c',            bg: 'rgba(220, 38, 38, 0.1)',   border: 'rgba(220, 38, 38, 0.3)' },
};

export function SubscriptionTab() {
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [trialDaysLeft, setTrialDaysLeft] = useState<number | null>(null);

  useEffect(() => {
    companyService.getProfile()
      .then((p) => {
        setProfile(p);
        if (p.status === 'TRIAL' && p.trialEndsAt) {
          const diff = new Date(p.trialEndsAt).getTime() - Date.now();
          setTrialDaysLeft(Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24))));
        }
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-center py-4"><CSpinner size="sm" color="primary" /></div>;
  if (error || !profile) return <CAlert color="danger">Erro ao carregar dados de assinatura.</CAlert>;

  const statusInfo = STATUS_MAP[profile.status] ?? {
    label: profile.status,
    color: 'var(--cui-secondary-color)',
    bg: 'rgba(107,114,128,0.1)',
    border: 'rgba(107,114,128,0.3)',
  };

  const nextDate = profile.status === 'TRIAL' ? profile.trialEndsAt : profile.billingAnchorDate;
  const formattedDate = nextDate ? new Date(nextDate).toLocaleDateString('pt-BR') : '—';
  const dateLabel =
    profile.status === 'TRIAL'
      ? 'Fim do trial'
      : profile.status === 'OVERDUE'
        ? 'Vencimento em atraso'
        : 'Próxima cobrança';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 720 }}>
      {/* Highlight banner */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          padding: 18,
          background: statusInfo.bg,
          border: `1px solid ${statusInfo.border}`,
          borderRadius: 14,
        }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: statusInfo.color,
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <CIcon icon={cilCheck} size="lg" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--cui-body-color)' }}>
            {profile.status === 'TRIAL' && trialDaysLeft !== null
              ? `Seu trial termina em ${trialDaysLeft} dia${trialDaysLeft !== 1 ? 's' : ''}`
              : profile.status === 'ACTIVE'
                ? 'Sua assinatura está ativa'
                : profile.status === 'OVERDUE'
                  ? 'Há um pagamento em atraso'
                  : 'Assinatura suspensa'}
          </div>
          <div style={{ fontSize: 13, color: 'var(--cui-secondary-color)', marginTop: 2 }}>
            {profile.status === 'TRIAL'
              ? 'Ative um plano para continuar sem interrupção.'
              : `${dateLabel}: ${formattedDate}`}
          </div>
        </div>
        <span
          style={{
            padding: '4px 12px',
            borderRadius: 999,
            background: '#fff',
            color: statusInfo.color,
            fontSize: 11.5,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            border: `1px solid ${statusInfo.border}`,
          }}
        >
          {statusInfo.label}
        </span>
      </div>

      {/* Billing info */}
      <Card header={<CardTitle title="Informações de cobrança" />}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div>
            <div
              style={{
                fontSize: 11,
                color: 'var(--cui-secondary-color)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                fontWeight: 600,
                marginBottom: 4,
              }}
            >
              Status
            </div>
            <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--cui-body-color)' }}>
              {statusInfo.label}
            </div>
          </div>
          <div>
            <div
              style={{
                fontSize: 11,
                color: 'var(--cui-secondary-color)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                fontWeight: 600,
                marginBottom: 4,
              }}
            >
              {dateLabel}
            </div>
            <div
              style={{
                fontSize: 14,
                fontWeight: 500,
                color: 'var(--cui-body-color)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {formattedDate}
            </div>
          </div>
        </div>
        <div style={{ marginTop: 18 }}>
          <CButton
            color="primary"
            variant="outline"
            href="https://www.asaas.com/login"
            target="_blank"
            rel="noopener noreferrer"
            style={{ borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            Gerenciar assinatura <CIcon icon={cilExternalLink} size="sm" />
          </CButton>
        </div>
      </Card>
    </div>
  );
}
