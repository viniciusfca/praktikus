import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  CAlert,
  CButton,
  CCard,
  CCardBody,
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
import { useAuthStore } from '../../../store/auth.store';
import { companyService, type CompanyProfile, type UpdateCompanyPayload } from '../../../services/company.service';
import { authService } from '../../../services/auth.service';

// ---- Schemas ----

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

// ---- CompanyTab ----

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
    }).catch(() => setLoading(false));
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

  if (loading) return <div className="text-center py-4"><CSpinner /></div>;

  return (
    <>
      {success && <CAlert color="success" className="mb-3">{success}</CAlert>}
      {error && <CAlert color="danger" className="mb-3">{error}</CAlert>}

      {/* Logo section */}
      <div className="mb-4 d-flex align-items-center gap-3">
        {profile?.logoUrl ? (
          <img
            src={profile.logoUrl}
            alt="Logo"
            style={{ width: 64, height: 64, objectFit: 'contain', borderRadius: 8, border: '1px solid var(--cui-border-color)' }}
          />
        ) : (
          <div style={{ width: 64, height: 64, borderRadius: 8, border: '1px solid var(--cui-border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--cui-secondary-color)' }}>
            Logo
          </div>
        )}
        <div>
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
          >
            {logoUploading ? <CSpinner size="sm" /> : 'Enviar logo'}
          </CButton>
          <div className="text-secondary mt-1" style={{ fontSize: '0.75rem' }}>JPG ou PNG, máx. 2 MB</div>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="row g-3">
          <div className="col-12 col-md-6">
            <CFormLabel>Nome Fantasia</CFormLabel>
            <CFormInput aria-label="Nome Fantasia" {...register('nomeFantasia')} invalid={!!errors.nomeFantasia} />
            {errors.nomeFantasia && <CFormFeedback invalid>{errors.nomeFantasia.message}</CFormFeedback>}
          </div>
          <div className="col-12 col-md-6">
            <CFormLabel>Razão Social</CFormLabel>
            <CFormInput aria-label="Razão Social" {...register('razaoSocial')} invalid={!!errors.razaoSocial} />
            {errors.razaoSocial && <CFormFeedback invalid>{errors.razaoSocial.message}</CFormFeedback>}
          </div>
          <div className="col-12 col-md-4">
            <CFormLabel>Telefone</CFormLabel>
            <CFormInput {...register('telefone')} />
          </div>
          <div className="col-12 col-md-6">
            <CFormLabel>Rua</CFormLabel>
            <CFormInput {...register('street')} />
          </div>
          <div className="col-12 col-md-2">
            <CFormLabel>Número</CFormLabel>
            <CFormInput {...register('number')} />
          </div>
          <div className="col-12 col-md-4">
            <CFormLabel>Complemento</CFormLabel>
            <CFormInput {...register('complement')} />
          </div>
          <div className="col-12 col-md-4">
            <CFormLabel>Cidade</CFormLabel>
            <CFormInput {...register('city')} />
          </div>
          <div className="col-6 col-md-2">
            <CFormLabel>Estado</CFormLabel>
            <CFormInput {...register('state')} maxLength={2} />
          </div>
          <div className="col-6 col-md-2">
            <CFormLabel>CEP</CFormLabel>
            <CFormInput {...register('zip')} />
          </div>
        </div>
        <div className="mt-4">
          <CButton type="submit" color="primary" disabled={isSubmitting}>
            {isSubmitting ? <CSpinner size="sm" /> : 'Salvar'}
          </CButton>
        </div>
      </form>
    </>
  );
}

// ---- AccountTab ----

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
    <>
      {success && <CAlert color="success" className="mb-3">{success}</CAlert>}
      {error && <CAlert color="danger" className="mb-3">{error}</CAlert>}
      <form onSubmit={handleSubmit(onSubmit)} noValidate style={{ maxWidth: 400 }}>
        <div className="mb-3">
          <CFormLabel>Senha Atual</CFormLabel>
          <CFormInput
            type="password"
            aria-label="Senha Atual"
            {...register('currentPassword')}
            invalid={!!errors.currentPassword}
          />
          {errors.currentPassword && <CFormFeedback invalid>{errors.currentPassword.message}</CFormFeedback>}
        </div>
        <div className="mb-3">
          <CFormLabel>Nova Senha</CFormLabel>
          <CFormInput
            type="password"
            aria-label="Nova Senha"
            {...register('newPassword')}
            invalid={!!errors.newPassword}
          />
          {errors.newPassword && <CFormFeedback invalid>{errors.newPassword.message}</CFormFeedback>}
        </div>
        <div className="mb-4">
          <CFormLabel>Confirmar Nova Senha</CFormLabel>
          <CFormInput
            type="password"
            aria-label="Confirmar Nova Senha"
            {...register('confirmPassword')}
            invalid={!!errors.confirmPassword}
          />
          {errors.confirmPassword && <CFormFeedback invalid>{errors.confirmPassword.message}</CFormFeedback>}
        </div>
        <CButton type="submit" color="primary" disabled={isSubmitting}>
          {isSubmitting ? <CSpinner size="sm" /> : 'Alterar senha'}
        </CButton>
      </form>
    </>
  );
}

// ---- SettingsPage ----

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
    <div className="p-3">
      <h4 className="mb-4">Configurações</h4>
      <CCard>
        <CCardBody>
          <CNav variant="tabs" className="mb-4">
            <CNavItem>
              <CNavLink active={activeTab === 0} onClick={() => setActiveTab(0)} style={{ cursor: 'pointer' }}>
                Empresa
              </CNavLink>
            </CNavItem>
            <CNavItem>
              <CNavLink active={activeTab === 1} onClick={() => setActiveTab(1)} style={{ cursor: 'pointer' }}>
                Minha Conta
              </CNavLink>
            </CNavItem>
          </CNav>
          <CTabContent>
            <CTabPane visible={activeTab === 0}>
              <CompanyTab />
            </CTabPane>
            <CTabPane visible={activeTab === 1}>
              <AccountTab />
            </CTabPane>
          </CTabContent>
        </CCardBody>
      </CCard>
    </div>
  );
}
