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
  CSpinner,
} from '@coreui/react';
import { employeesService } from '../../../services/recycling/employees.service';

const schema = z.object({
  name: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres'),
  email: z.string().email('E-mail inválido'),
  password: z.string().min(8, 'Senha deve ter no mínimo 8 caracteres'),
});

type FormData = z.infer<typeof schema>;

export function EmployeeFormPage() {
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    try {
      await employeesService.create(data);
      navigate('/recycling/employees');
    } catch (err: any) {
      setError('root', {
        message: err?.response?.data?.message ?? 'Erro ao salvar funcionário.',
      });
    }
  };

  return (
    <div style={{ maxWidth: 560 }}>
      <h5 className="fw-bold mb-4">Novo Funcionário</h5>

      <CCard>
        <CCardBody className="p-4">
          {errors.root && (
            <CAlert color="danger" className="mb-3">{errors.root.message}</CAlert>
          )}
          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <div className="mb-3">
              <CFormLabel>Nome</CFormLabel>
              <CFormInput {...register('name')} invalid={!!errors.name} />
              {errors.name && <CFormFeedback invalid>{errors.name.message}</CFormFeedback>}
            </div>
            <div className="mb-3">
              <CFormLabel>E-mail</CFormLabel>
              <CFormInput type="email" {...register('email')} invalid={!!errors.email} />
              {errors.email && <CFormFeedback invalid>{errors.email.message}</CFormFeedback>}
            </div>
            <div className="mb-4">
              <CFormLabel>Senha</CFormLabel>
              <CFormInput type="password" {...register('password')} invalid={!!errors.password} />
              {errors.password && <CFormFeedback invalid>{errors.password.message}</CFormFeedback>}
            </div>
            <div className="d-flex gap-2">
              <CButton
                color="secondary"
                variant="outline"
                className="flex-grow-1"
                onClick={() => navigate('/recycling/employees')}
              >
                Cancelar
              </CButton>
              <CButton type="submit" color="primary" className="flex-grow-1" disabled={isSubmitting}>
                {isSubmitting ? <CSpinner size="sm" /> : 'Salvar'}
              </CButton>
            </div>
          </form>
        </CCardBody>
      </CCard>
    </div>
  );
}
