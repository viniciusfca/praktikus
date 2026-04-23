import { useState } from 'react';
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
import { Card, CardTitle, labelStyle } from './Card';
import { authService } from '../../services/auth.service';

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

export function AccountTab() {
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
