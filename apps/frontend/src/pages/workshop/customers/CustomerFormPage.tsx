import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CSpinner,
} from '@coreui/react';
import { customersService } from '../../../services/customers.service';

const schema = z.object({
  nome: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres'),
  cpfCnpj: z
    .string()
    .regex(/^\d{11}$|^\d{14}$/, 'CPF deve ter 11 dígitos ou CNPJ 14 dígitos'),
  whatsapp: z.string().optional(),
  email: z.string().email('E-mail inválido').optional().or(z.literal('')),
});

type FormData = z.infer<typeof schema>;

export function CustomerFormPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const [savedCustomer, setSavedCustomer] = useState<{ id: string; nome: string } | null>(null);

  useEffect(() => {
    if (isEdit && id) {
      customersService.getById(id).then((customer) => {
        reset({
          nome: customer.nome,
          cpfCnpj: customer.cpfCnpj,
          whatsapp: customer.whatsapp ?? '',
          email: customer.email ?? '',
        });
      });
    }
  }, [id, isEdit, reset]);

  const onSubmit = async (data: FormData) => {
    const payload = {
      nome: data.nome,
      cpfCnpj: data.cpfCnpj,
      whatsapp: data.whatsapp || undefined,
      email: data.email || undefined,
    };
    try {
      if (isEdit && id) {
        await customersService.update(id, payload);
        navigate('/workshop/customers');
      } else {
        const created = await customersService.create(payload);
        setSavedCustomer({ id: created.id, nome: created.nome });
      }
    } catch (err: any) {
      setError('root', {
        message: err?.response?.data?.message ?? 'Erro ao salvar cliente.',
      });
    }
  };

  return (
    <div style={{ maxWidth: 560 }}>
      <h5 className="fw-bold mb-4">{isEdit ? 'Editar Cliente' : 'Novo Cliente'}</h5>

      <CCard>
        <CCardBody className="p-4">
          {errors.root && (
            <CAlert color="danger" className="mb-3">{errors.root.message}</CAlert>
          )}
          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <div className="mb-3">
              <CFormLabel>Nome</CFormLabel>
              <CFormInput {...register('nome')} invalid={!!errors.nome} />
              {errors.nome && <CFormFeedback invalid>{errors.nome.message}</CFormFeedback>}
            </div>
            <div className="mb-3">
              <CFormLabel>CPF / CNPJ (somente números)</CFormLabel>
              <CFormInput {...register('cpfCnpj')} maxLength={14} invalid={!!errors.cpfCnpj} />
              {errors.cpfCnpj && <CFormFeedback invalid>{errors.cpfCnpj.message}</CFormFeedback>}
            </div>
            <div className="mb-3">
              <CFormLabel>WhatsApp (opcional)</CFormLabel>
              <CFormInput {...register('whatsapp')} />
            </div>
            <div className="mb-4">
              <CFormLabel>E-mail (opcional)</CFormLabel>
              <CFormInput type="email" {...register('email')} invalid={!!errors.email} />
              {errors.email && <CFormFeedback invalid>{errors.email.message}</CFormFeedback>}
            </div>
            <div className="d-flex gap-2">
              <CButton color="secondary" variant="outline" className="flex-grow-1" onClick={() => navigate('/workshop/customers')}>
                Cancelar
              </CButton>
              <CButton type="submit" color="primary" className="flex-grow-1" disabled={isSubmitting}>
                {isSubmitting ? <CSpinner size="sm" /> : 'Salvar'}
              </CButton>
            </div>
          </form>
        </CCardBody>
      </CCard>

      <CModal visible={Boolean(savedCustomer)} onClose={() => navigate('/workshop/customers')}>
        <CModalHeader>
          <CModalTitle>Cadastrar veículo?</CModalTitle>
        </CModalHeader>
        <CModalBody>
          Deseja cadastrar um veículo para <strong>{savedCustomer?.nome}</strong>?
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" onClick={() => navigate('/workshop/customers')}>Não</CButton>
          <CButton
            color="primary"
            onClick={() => navigate(`/workshop/vehicles/new?customerId=${savedCustomer?.id}`)}
          >
            Sim
          </CButton>
        </CModalFooter>
      </CModal>
    </div>
  );
}
