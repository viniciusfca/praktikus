import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  CAlert,
  CButton,
  CFormFeedback,
  CFormInput,
  CFormLabel,
  CNav,
  CNavItem,
  CNavLink,
  CSpinner,
  CTabContent,
  CTabPane,
} from '@coreui/react';
import CIcon from '@coreui/icons-react';
import {
  cilBuilding,
  cilUser,
  cilCreditCard,
  cilCloudUpload,
  cilCheck,
  cilExternalLink,
} from '@coreui/icons';
import { PageHead } from '../../../components/PageHead';
import { useAuthStore } from '../../../store/auth.store';
import { companyService, type CompanyProfile, type UpdateCompanyPayload } from '../../../services/company.service';
import { authService } from '../../../services/auth.service';

// ── Schemas ─────────────────────────────────────────────────────────────────
const companySchema = z.object({
  nomeFantasia: z.string().min(2, 'Mínimo 2 caracteres'),
  razaoSocial: z.string().min(3, 'Mínimo 3 caracteres'),
  telefone: z.string().optional(),
  street: z.string().optional(),
  number: z.string().optional(),
  complement: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
});
type CompanyForm = z.infer<typeof companySchema>;

const passwordSchema = z
  .object({
    currentPassword: z.string().min(8, 'Mínimo 8 caracteres'),
    newPassword: z.string().min(8, 'Mínimo 8 caracteres'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'As senhas não coincidem',
    path: ['confirmPassword'],
  });
type PasswordForm = z.infer<typeof passwordSchema>;

// ── Shared styles ───────────────────────────────────────────────────────────
const labelStyle = { fontWeight: 500, fontSize: 13 };

// ── Card shell ──────────────────────────────────────────────────────────────
function Card({
  children,
  header,
  padding = 20,
}: {
  children: React.ReactNode;
  header?: React.ReactNode;
  padding?: number | string;
}) {
  return (
    <div
      style={{
        background: 'var(--cui-card-bg)',
        border: '1px solid var(--cui-border-color)',
        borderRadius: 14,
        overflow: 'hidden',
      }}
    >
      {header && (
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--cui-border-color)' }}>
          {header}
        </div>
      )}
      <div style={{ padding: typeof padding === 'number' ? padding : padding }}>{children}</div>
    </div>
  );
}

function CardTitle({ title, desc }: { title: string; desc?: string }) {
  return (
    <div>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--cui-body-color)' }}>{title}</div>
      {desc && <div style={{ fontSize: 12.5, color: 'var(--cui-secondary-color)', marginTop: 2 }}>{desc}</div>}
    </div>
  );
}

// ── Company tab ─────────────────────────────────────────────────────────────
function CompanyTab() {
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } =
    useForm<CompanyForm>({ resolver: zodResolver(companySchema) });

  useEffect(() => {
    companyService.getProfile().then((p) => {
      setProfile(p);
      reset({
        nomeFantasia: p.nomeFantasia,
        razaoSocial: p.razaoSocial,
        telefone: p.telefone ?? '',
        street: p.endereco?.street ?? '',
        number: p.endereco?.number ?? '',
        complement: p.endereco?.complement ?? '',
        city: p.endereco?.city ?? '',
        state: p.endereco?.state ?? '',
        zip: p.endereco?.zip ?? '',
      });
      setLoading(false);
    }).catch(() => {
      setError('Erro ao carregar dados da empresa.');
      setLoading(false);
    });
  }, [reset]);

  const onSubmit = async (data: CompanyForm) => {
    setSuccess(null);
    setError(null);
    try {
      const payload: UpdateCompanyPayload = {
        nomeFantasia: data.nomeFantasia,
        razaoSocial: data.razaoSocial,
        telefone: data.telefone,
        endereco: {
          street: data.street ?? '',
          number: data.number ?? '',
          complement: data.complement,
          city: data.city ?? '',
          state: data.state ?? '',
          zip: data.zip ?? '',
        },
      };
      const updated = await companyService.updateProfile(payload);
      setProfile(updated);
      setSuccess('Dados salvos com sucesso.');
    } catch {
      setError('Erro ao salvar. Tente novamente.');
    }
  };

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoUploading(true);
    setError(null);
    try {
      const updated = await companyService.uploadLogo(file);
      setProfile(updated);
      setSuccess('Logo atualizada.');
    } catch {
      setError('Erro ao enviar logo. Use JPG ou PNG (máx. 2 MB).');
    } finally {
      setLogoUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  if (loading) return <div className="text-center py-4"><CSpinner size="sm" color="primary" /></div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {success && <CAlert color="success" className="mb-0">{success}</CAlert>}
      {error && <CAlert color="danger" className="mb-0">{error}</CAlert>}

      {/* Logo card */}
      <Card header={<CardTitle title="Logo" desc="Aparece no PDF da OS e em comunicações" />}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {profile?.logoUrl ? (
            <img
              src={profile.logoUrl}
              alt="Logo"
              style={{
                width: 72,
                height: 72,
                objectFit: 'contain',
                borderRadius: 10,
                border: '1px solid var(--cui-border-color)',
                background: 'var(--cui-card-cap-bg)',
                padding: 6,
              }}
            />
          ) : (
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: 10,
                border: '1px dashed var(--cui-border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--cui-secondary-color)',
                background: 'var(--cui-card-cap-bg)',
                fontSize: 11,
                fontWeight: 500,
              }}
            >
              Logo
            </div>
          )}
          <div style={{ flex: 1 }}>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png"
              style={{ display: 'none' }}
              onChange={handleLogoChange}
            />
            <CButton
              color="secondary"
              variant="outline"
              size="sm"
              disabled={logoUploading}
              onClick={() => fileInputRef.current?.click()}
              style={{ borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              {logoUploading ? (
                <CSpinner size="sm" />
              ) : (
                <>
                  <CIcon icon={cilCloudUpload} size="sm" />
                  {profile?.logoUrl ? 'Trocar logo' : 'Enviar logo'}
                </>
              )}
            </CButton>
            <div style={{ fontSize: 12, color: 'var(--cui-secondary-color)', marginTop: 6 }}>
              JPG ou PNG, máx. 2 MB
            </div>
          </div>
        </div>
      </Card>

      {/* Dados da empresa */}
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <Card
          header={<CardTitle title="Dados da empresa" desc="Razão social, nome fantasia e contato" />}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <CFormLabel style={labelStyle}>Nome fantasia</CFormLabel>
              <CFormInput {...register('nomeFantasia')} invalid={!!errors.nomeFantasia} />
              {errors.nomeFantasia && <CFormFeedback invalid>{errors.nomeFantasia.message}</CFormFeedback>}
            </div>
            <div>
              <CFormLabel style={labelStyle}>Razão social</CFormLabel>
              <CFormInput {...register('razaoSocial')} invalid={!!errors.razaoSocial} />
              {errors.razaoSocial && <CFormFeedback invalid>{errors.razaoSocial.message}</CFormFeedback>}
            </div>
            <div>
              <CFormLabel style={labelStyle}>Telefone</CFormLabel>
              <CFormInput {...register('telefone')} placeholder="(11) 3333-4444" />
            </div>
          </div>
        </Card>

        {/* Endereço */}
        <div style={{ marginTop: 16 }}>
          <Card header={<CardTitle title="Endereço" desc="Endereço fiscal da empresa" />}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 14 }}>
              <div style={{ gridColumn: 'span 8' }}>
                <CFormLabel style={labelStyle}>Rua</CFormLabel>
                <CFormInput {...register('street')} />
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <CFormLabel style={labelStyle}>Número</CFormLabel>
                <CFormInput {...register('number')} />
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <CFormLabel style={labelStyle}>CEP</CFormLabel>
                <CFormInput {...register('zip')} placeholder="00000-000" />
              </div>
              <div style={{ gridColumn: 'span 4' }}>
                <CFormLabel style={labelStyle}>Complemento</CFormLabel>
                <CFormInput {...register('complement')} />
              </div>
              <div style={{ gridColumn: 'span 6' }}>
                <CFormLabel style={labelStyle}>Cidade</CFormLabel>
                <CFormInput {...register('city')} />
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <CFormLabel style={labelStyle}>Estado</CFormLabel>
                <CFormInput {...register('state')} maxLength={2} placeholder="SP" />
              </div>
            </div>
          </Card>
        </div>

        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
          <CButton type="submit" color="primary" disabled={isSubmitting} style={{ borderRadius: 8, minWidth: 120 }}>
            {isSubmitting ? <CSpinner size="sm" /> : 'Salvar alterações'}
          </CButton>
        </div>
      </form>
    </div>
  );
}

// ── Account tab ─────────────────────────────────────────────────────────────
function AccountTab() {
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } =
    useForm<PasswordForm>({ resolver: zodResolver(passwordSchema) });

  const onSubmit = async (data: PasswordForm) => {
    setSuccess(null);
    setError(null);
    try {
      await authService.changePassword(data.currentPassword, data.newPassword);
      setSuccess('Senha alterada com sucesso.');
      reset();
    } catch {
      setError('Senha atual incorreta ou erro ao alterar.');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {success && <CAlert color="success" className="mb-0">{success}</CAlert>}
      {error && <CAlert color="danger" className="mb-0">{error}</CAlert>}

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <Card header={<CardTitle title="Alterar senha" desc="Defina uma nova senha de acesso" />}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 440 }}>
            <div>
              <CFormLabel style={labelStyle}>Senha atual</CFormLabel>
              <CFormInput
                type="password"
                {...register('currentPassword')}
                invalid={!!errors.currentPassword}
              />
              {errors.currentPassword && <CFormFeedback invalid>{errors.currentPassword.message}</CFormFeedback>}
            </div>
            <div>
              <CFormLabel style={labelStyle}>Nova senha</CFormLabel>
              <CFormInput
                type="password"
                {...register('newPassword')}
                invalid={!!errors.newPassword}
              />
              {errors.newPassword && <CFormFeedback invalid>{errors.newPassword.message}</CFormFeedback>}
            </div>
            <div>
              <CFormLabel style={labelStyle}>Confirmar nova senha</CFormLabel>
              <CFormInput
                type="password"
                {...register('confirmPassword')}
                invalid={!!errors.confirmPassword}
              />
              {errors.confirmPassword && <CFormFeedback invalid>{errors.confirmPassword.message}</CFormFeedback>}
            </div>
          </div>
        </Card>

        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
          <CButton type="submit" color="primary" disabled={isSubmitting} style={{ borderRadius: 8, minWidth: 120 }}>
            {isSubmitting ? <CSpinner size="sm" /> : 'Alterar senha'}
          </CButton>
        </div>
      </form>
    </div>
  );
}

// ── Subscription tab ────────────────────────────────────────────────────────
const STATUS_MAP: Record<string, { label: string; color: string; bg: string; border: string }> = {
  TRIAL:     { label: 'Trial',     color: 'var(--cui-primary)', bg: 'rgba(52, 142, 145, 0.1)',  border: 'rgba(52, 142, 145, 0.3)' },
  ACTIVE:    { label: 'Ativo',     color: '#15803d',            bg: 'rgba(22, 163, 74, 0.1)',   border: 'rgba(22, 163, 74, 0.3)' },
  OVERDUE:   { label: 'Em atraso', color: '#b45309',            bg: 'rgba(217, 119, 6, 0.1)',   border: 'rgba(217, 119, 6, 0.3)' },
  SUSPENDED: { label: 'Suspenso',  color: '#b91c1c',            bg: 'rgba(220, 38, 38, 0.1)',   border: 'rgba(220, 38, 38, 0.3)' },
};

function SubscriptionTab() {
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    companyService.getProfile()
      .then(setProfile)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-center py-4"><CSpinner size="sm" color="primary" /></div>;
  if (error || !profile) return <CAlert color="danger">Erro ao carregar dados de assinatura.</CAlert>;

  const statusInfo = STATUS_MAP[profile.status] ?? { label: profile.status, color: 'var(--cui-secondary-color)', bg: 'rgba(107,114,128,0.1)', border: 'rgba(107,114,128,0.3)' };

  const nextDate = profile.status === 'TRIAL'
    ? profile.trialEndsAt
    : profile.billingAnchorDate;

  const formattedDate = nextDate ? new Date(nextDate).toLocaleDateString('pt-BR') : '—';
  const dateLabel =
    profile.status === 'TRIAL'
      ? 'Fim do trial'
      : profile.status === 'OVERDUE'
        ? 'Vencimento em atraso'
        : 'Próxima cobrança';

  // Days to trial end
  let trialDaysLeft: number | null = null;
  if (profile.status === 'TRIAL' && profile.trialEndsAt) {
    const diff = new Date(profile.trialEndsAt).getTime() - Date.now();
    trialDaysLeft = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }

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
            <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--cui-body-color)', fontVariantNumeric: 'tabular-nums' }}>
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

// ── Tab definitions ─────────────────────────────────────────────────────────
const TABS = [
  { label: 'Empresa', icon: cilBuilding },
  { label: 'Minha conta', icon: cilUser },
  { label: 'Assinatura', icon: cilCreditCard },
];

// ── Main page ───────────────────────────────────────────────────────────────
export function SettingsPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [activeTab, setActiveTab] = useState(0);

  useEffect(() => {
    if (user && user.role !== 'OWNER') {
      navigate('/workshop/dashboard', { replace: true });
    }
  }, [user, navigate]);

  if (!user || user.role !== 'OWNER') return null;

  return (
    <>
      <PageHead title="Configurações" subtitle="Gerencie os dados da sua empresa, conta e assinatura" />

      <div style={{ borderBottom: '1px solid var(--cui-border-color)', marginBottom: 20 }}>
        <CNav variant="tabs" className="pk-tabs" style={{ border: 0 }}>
          {TABS.map((t, i) => (
            <CNavItem key={t.label}>
              <CNavLink
                active={activeTab === i}
                onClick={() => setActiveTab(i)}
                style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <CIcon icon={t.icon} size="sm" /> {t.label}
              </CNavLink>
            </CNavItem>
          ))}
        </CNav>
      </div>

      <CTabContent>
        <CTabPane visible={activeTab === 0}><CompanyTab /></CTabPane>
        <CTabPane visible={activeTab === 1}><AccountTab /></CTabPane>
        <CTabPane visible={activeTab === 2}><SubscriptionTab /></CTabPane>
      </CTabContent>
    </>
  );
}
