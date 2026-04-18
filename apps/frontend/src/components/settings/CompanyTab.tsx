import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  CAlert,
  CButton,
  CFormFeedback,
  CFormInput,
  CFormLabel,
  CSpinner,
} from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilCloudUpload } from '@coreui/icons';
import { Card, CardTitle, labelStyle } from './Card';
import {
  companyService,
  type CompanyProfile,
  type UpdateCompanyPayload,
} from '../../services/company.service';

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

export function CompanyTab() {
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
        <Card header={<CardTitle title="Dados da empresa" desc="Razão social, nome fantasia e contato" />}>
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
