import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
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
import { AuthShell } from '../../components/AuthShell';
import { Stepper } from '../../components/Stepper';
import { authService } from '../../services/auth.service';
import { useAuthStore } from '../../store/auth.store';
import { stripDigits, formatCnpj, formatPhone } from '../../utils/masks';

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

const STEPS = ['Dados da empresa', 'Dados do responsável'];

const labelStyle = { fontWeight: 500, fontSize: 13 };

export function RegisterRecyclingPage() {
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
      const tokens = await authService.registerRecycling({ ...step1Data, ...rest });
      setTokens(tokens);
      navigate('/recycling/dashboard');
    } catch (err: unknown) {
      const msg = (err as any)?.response?.data?.message;
      setError(msg ?? 'Erro ao cadastrar. Tente novamente.');
    }
  };

  return (
    <AuthShell>
      <h1 style={{ margin: '0 0 6px', fontSize: 24, letterSpacing: '-0.02em', fontWeight: 600 }}>
        Crie sua conta
      </h1>
      <p style={{ margin: '0 0 10px', color: 'var(--cui-secondary-color)' }}>
        Cadastre sua recicladora — 30 dias grátis.
      </p>

      <Stepper steps={STEPS} current={activeStep} />

      {error && (
        <CAlert color="danger" className="mb-3">
          {error}
        </CAlert>
      )}

      {activeStep === 0 && (
        <form
          onSubmit={form1.handleSubmit(onStep1Submit)}
          noValidate
          style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
        >
          <div>
            <CFormLabel style={labelStyle}>CNPJ</CFormLabel>
            <Controller
              control={form1.control}
              name="cnpj"
              render={({ field }) => (
                <CFormInput
                  placeholder="00.000.000/0000-00"
                  aria-label="CNPJ"
                  value={formatCnpj(field.value || '')}
                  onChange={(e) => field.onChange(stripDigits(e.target.value))}
                  onBlur={field.onBlur}
                  ref={field.ref}
                  invalid={!!form1.formState.errors.cnpj}
                />
              )}
            />
            {form1.formState.errors.cnpj && (
              <CFormFeedback invalid>{form1.formState.errors.cnpj.message}</CFormFeedback>
            )}
          </div>

          <div>
            <CFormLabel style={labelStyle}>Razão social</CFormLabel>
            <CFormInput
              aria-label="Razão Social"
              {...form1.register('razaoSocial')}
              invalid={!!form1.formState.errors.razaoSocial}
            />
            {form1.formState.errors.razaoSocial && (
              <CFormFeedback invalid>{form1.formState.errors.razaoSocial.message}</CFormFeedback>
            )}
          </div>

          <div>
            <CFormLabel style={labelStyle}>Nome fantasia</CFormLabel>
            <CFormInput
              aria-label="Nome Fantasia"
              {...form1.register('nomeFantasia')}
              invalid={!!form1.formState.errors.nomeFantasia}
            />
            {form1.formState.errors.nomeFantasia && (
              <CFormFeedback invalid>{form1.formState.errors.nomeFantasia.message}</CFormFeedback>
            )}
          </div>

          <div>
            <CFormLabel style={labelStyle}>Telefone</CFormLabel>
            <Controller
              control={form1.control}
              name="telefone"
              render={({ field }) => (
                <CFormInput
                  placeholder="(11) 99999-9999"
                  aria-label="Telefone"
                  value={formatPhone(field.value || '')}
                  onChange={(e) => field.onChange(stripDigits(e.target.value))}
                  onBlur={field.onBlur}
                  ref={field.ref}
                />
              )}
            />
          </div>

          <CButton
            type="submit"
            color="primary"
            size="lg"
            style={{ width: '100%', marginTop: 4, borderRadius: 8 }}
          >
            Próximo →
          </CButton>

          <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--cui-secondary-color)', margin: 0 }}>
            Já tem conta?{' '}
            <Link
              to="/login"
              style={{ color: 'var(--cui-primary)', fontWeight: 500, textDecoration: 'none' }}
            >
              Entrar
            </Link>
          </p>
        </form>
      )}

      {activeStep === 1 && (
        <form
          onSubmit={form2.handleSubmit(onStep2Submit)}
          noValidate
          style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
        >
          <div>
            <CFormLabel style={labelStyle}>Seu nome</CFormLabel>
            <CFormInput
              aria-label="Seu nome"
              {...form2.register('ownerName')}
              invalid={!!form2.formState.errors.ownerName}
            />
            {form2.formState.errors.ownerName && (
              <CFormFeedback invalid>{form2.formState.errors.ownerName.message}</CFormFeedback>
            )}
          </div>

          <div>
            <CFormLabel style={labelStyle}>E-mail</CFormLabel>
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

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <CFormLabel style={labelStyle}>Senha</CFormLabel>
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

            <div>
              <CFormLabel style={labelStyle}>Confirmar</CFormLabel>
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
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10 }}>
            <CButton
              color="secondary"
              variant="outline"
              size="lg"
              onClick={() => setActiveStep(0)}
              style={{ borderRadius: 8 }}
            >
              Voltar
            </CButton>
            <CButton
              type="submit"
              color="primary"
              size="lg"
              disabled={form2.formState.isSubmitting}
              style={{ borderRadius: 8 }}
            >
              {form2.formState.isSubmitting ? <CSpinner size="sm" /> : 'Cadastrar e começar →'}
            </CButton>
          </div>
        </form>
      )}
    </AuthShell>
  );
}
