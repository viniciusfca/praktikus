import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
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
  CSpinner,
} from '@coreui/react';
import { authService } from '../../services/auth.service';
import { useAuthStore } from '../../store/auth.store';

const step1Schema = z.object({
  cnpj: z.string().regex(/^\d{14}$/, 'CNPJ deve conter 14 dígitos numéricos'),
  razaoSocial: z.string().min(3, 'Razão Social deve ter no mínimo 3 caracteres'),
  nomeFantasia: z.string().min(2, 'Nome Fantasia deve ter no mínimo 2 caracteres'),
  telefone: z.string().optional(),
});

const step2Schema = z
  .object({
    ownerName: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres'),
    email: z.string().email('E-mail inválido'),
    password: z.string().min(8, 'Senha deve ter no mínimo 8 caracteres'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'As senhas não coincidem',
    path: ['confirmPassword'],
  });

type Step1Data = z.infer<typeof step1Schema>;
type Step2Data = z.infer<typeof step2Schema>;

const STEPS = ['Dados da Oficina', 'Dados do Responsável'];

export function RegisterPage() {
  const navigate = useNavigate();
  const setTokens = useAuthStore((s) => s.setTokens);
  const [activeStep, setActiveStep] = useState(0);
  const [step1Data, setStep1Data] = useState<Step1Data | null>(null);
  const [error, setError] = useState<string | null>(null);

  const form1 = useForm<Step1Data>({ resolver: zodResolver(step1Schema) });
  const form2 = useForm<Step2Data>({ resolver: zodResolver(step2Schema) });

  const onStep1Submit = (data: Step1Data) => {
    setStep1Data(data);
    setActiveStep(1);
  };

  const onStep2Submit = async (data: Step2Data) => {
    if (!step1Data) return;
    setError(null);
    try {
      const { confirmPassword: _discard, ...rest } = data;
      const tokens = await authService.register({ ...step1Data, ...rest });
      setTokens(tokens);
      navigate('/workshop/dashboard');
    } catch (err: unknown) {
      const msg = (err as any)?.response?.data?.message;
      setError(msg ?? 'Erro ao cadastrar. Tente novamente.');
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <CCard style={{ width: '100%', maxWidth: 520 }}>
        <CCardBody className="p-4">
          <h5 className="fw-bold text-center mb-1">Practicus</h5>
          <p className="text-secondary text-center mb-3">Cadastre sua oficina — 30 dias grátis</p>

          {/* Step indicator */}
          <div className="d-flex align-items-center mb-4">
            {STEPS.map((label, i) => (
              <div key={label} className="d-flex align-items-center" style={{ flex: 1 }}>
                <div className="d-flex align-items-center gap-2">
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      backgroundColor: i <= activeStep ? 'var(--cui-primary)' : 'var(--cui-secondary-bg)',
                      color: i <= activeStep ? '#fff' : 'var(--cui-body-color)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.75rem',
                      fontWeight: 'bold',
                      flexShrink: 0,
                    }}
                  >
                    {i + 1}
                  </div>
                  <span style={{ fontSize: '0.8rem', fontWeight: i === activeStep ? 600 : 400 }}>{label}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <div
                    style={{
                      flex: 1,
                      height: 1,
                      backgroundColor: 'var(--cui-border-color)',
                      margin: '0 8px',
                    }}
                  />
                )}
              </div>
            ))}
          </div>

          {error && <CAlert color="danger" className="mb-3">{error}</CAlert>}

          {activeStep === 0 && (
            <form onSubmit={form1.handleSubmit(onStep1Submit)} noValidate>
              <div className="mb-3">
                <CFormLabel>CNPJ</CFormLabel>
                <CFormInput
                  placeholder="Apenas números (14 dígitos)"
                  aria-label="CNPJ"
                  {...form1.register('cnpj')}
                  invalid={!!form1.formState.errors.cnpj}
                />
                {form1.formState.errors.cnpj && (
                  <CFormFeedback invalid>{form1.formState.errors.cnpj.message}</CFormFeedback>
                )}
              </div>
              <div className="mb-3">
                <CFormLabel>Razão Social</CFormLabel>
                <CFormInput
                  aria-label="Razão Social"
                  {...form1.register('razaoSocial')}
                  invalid={!!form1.formState.errors.razaoSocial}
                />
                {form1.formState.errors.razaoSocial && (
                  <CFormFeedback invalid>{form1.formState.errors.razaoSocial.message}</CFormFeedback>
                )}
              </div>
              <div className="mb-3">
                <CFormLabel>Nome Fantasia</CFormLabel>
                <CFormInput
                  aria-label="Nome Fantasia"
                  {...form1.register('nomeFantasia')}
                  invalid={!!form1.formState.errors.nomeFantasia}
                />
                {form1.formState.errors.nomeFantasia && (
                  <CFormFeedback invalid>{form1.formState.errors.nomeFantasia.message}</CFormFeedback>
                )}
              </div>
              <div className="mb-4">
                <CFormLabel>Telefone</CFormLabel>
                <CFormInput {...form1.register('telefone')} />
              </div>
              <CButton type="submit" color="primary" className="w-100">
                Próximo
              </CButton>
            </form>
          )}

          {activeStep === 1 && (
            <form onSubmit={form2.handleSubmit(onStep2Submit)} noValidate>
              <div className="mb-3">
                <CFormLabel>Seu nome</CFormLabel>
                <CFormInput
                  aria-label="Seu nome"
                  {...form2.register('ownerName')}
                  invalid={!!form2.formState.errors.ownerName}
                />
                {form2.formState.errors.ownerName && (
                  <CFormFeedback invalid>{form2.formState.errors.ownerName.message}</CFormFeedback>
                )}
              </div>
              <div className="mb-3">
                <CFormLabel>E-mail</CFormLabel>
                <CFormInput
                  type="email"
                  aria-label="E-mail"
                  {...form2.register('email')}
                  invalid={!!form2.formState.errors.email}
                />
                {form2.formState.errors.email && (
                  <CFormFeedback invalid>{form2.formState.errors.email.message}</CFormFeedback>
                )}
              </div>
              <div className="mb-3">
                <CFormLabel>Senha</CFormLabel>
                <CFormInput
                  type="password"
                  aria-label="Senha"
                  {...form2.register('password')}
                  invalid={!!form2.formState.errors.password}
                />
                {form2.formState.errors.password && (
                  <CFormFeedback invalid>{form2.formState.errors.password.message}</CFormFeedback>
                )}
              </div>
              <div className="mb-4">
                <CFormLabel>Confirmar senha</CFormLabel>
                <CFormInput
                  type="password"
                  aria-label="Confirmar senha"
                  {...form2.register('confirmPassword')}
                  invalid={!!form2.formState.errors.confirmPassword}
                />
                {form2.formState.errors.confirmPassword && (
                  <CFormFeedback invalid>{form2.formState.errors.confirmPassword.message}</CFormFeedback>
                )}
              </div>
              <div className="d-flex gap-2">
                <CButton color="secondary" variant="outline" className="flex-grow-1" onClick={() => setActiveStep(0)}>
                  Voltar
                </CButton>
                <CButton
                  type="submit"
                  color="primary"
                  className="flex-grow-1"
                  disabled={form2.formState.isSubmitting}
                >
                  {form2.formState.isSubmitting ? <CSpinner size="sm" /> : 'Cadastrar'}
                </CButton>
              </div>
            </form>
          )}

          <p className="text-center mt-3 mb-0" style={{ fontSize: '0.875rem' }}>
            Já tem conta?{' '}
            <Link to="/login" style={{ color: 'inherit' }}>Entrar</Link>
          </p>
        </CCardBody>
      </CCard>
    </div>
  );
}
