import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  CAlert,
  CButton,
  CCard,
  CCardBody,
  CCol,
  CFormFeedback,
  CFormInput,
  CFormLabel,
  CRow,
  CSpinner,
} from '@coreui/react';
import { buyersService } from '../../../services/recycling/buyers.service';

const schema = z.object({
  name: z.string().min(2, 'Nome deve ter ao menos 2 caracteres'),
  cnpj: z.string().regex(/^\d{14}$/, 'CNPJ deve ter 14 dígitos').optional().or(z.literal('')),
  phone: z.string().optional(),
  contactName: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export function BuyerFormPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEditing = Boolean(id);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (!isEditing) return;
    const loadBuyer = async () => {
      setLoading(true);
      try {
        const buyer = await buyersService.getById(id!);
        reset({
          name: buyer.name,
          cnpj: buyer.cnpj ?? '',
          phone: buyer.phone ?? '',
          contactName: buyer.contactName ?? '',
        });
      } catch {
        setError('root', { message: 'Erro ao carregar comprador.' });
      } finally {
        setLoading(false);
      }
    };
    loadBuyer();
  }, [id, isEditing, reset, setError]);

  const onSubmit = async (data: FormData) => {
    const payload = {
      name: data.name,
      cnpj: data.cnpj || null,
      phone: data.phone || null,
      contactName: data.contactName || null,
    };

    try {
      if (isEditing) {
        await buyersService.update(id!, payload);
      } else {
        await buyersService.create(payload);
      }
      navigate('/recycling/buyers');
    } catch (err: unknown) {
      const anyErr = err as { response?: { data?: { message?: string | string[] } } };
      const msg = anyErr?.response?.data?.message;
      setError('root', {
        message: Array.isArray(msg) ? msg.join(', ') : (msg ?? 'Erro ao salvar comprador.'),
      });
    }
  };

  if (loading) {
    return <div className="text-center py-5"><CSpinner /></div>;
  }

  return (
    <div style={{ maxWidth: 600 }}>
      <h5 className="fw-bold mb-4">{isEditing ? 'Editar Comprador' : 'Novo Comprador'}</h5>

      <CCard>
        <CCardBody className="p-4">
          {errors.root && (
            <CAlert color="danger" className="mb-3">{errors.root.message}</CAlert>
          )}
          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <div className="mb-3">
              <CFormLabel>Nome *</CFormLabel>
              <CFormInput {...register('name')} invalid={!!errors.name} />
              {errors.name && <CFormFeedback invalid>{errors.name.message}</CFormFeedback>}
            </div>

            <div className="mb-3">
              <CFormLabel>CNPJ (14 dígitos, opcional)</CFormLabel>
              <CFormInput
                {...register('cnpj')}
                placeholder="00000000000000"
                invalid={!!errors.cnpj}
              />
              {errors.cnpj && <CFormFeedback invalid>{errors.cnpj.message}</CFormFeedback>}
            </div>

            <CRow className="mb-3">
              <CCol md={6}>
                <CFormLabel>Telefone</CFormLabel>
                <CFormInput {...register('phone')} placeholder="(00) 00000-0000" invalid={!!errors.phone} />
                {errors.phone && <CFormFeedback invalid>{errors.phone.message}</CFormFeedback>}
              </CCol>
              <CCol md={6}>
                <CFormLabel>Nome do Contato</CFormLabel>
                <CFormInput {...register('contactName')} invalid={!!errors.contactName} />
                {errors.contactName && <CFormFeedback invalid>{errors.contactName.message}</CFormFeedback>}
              </CCol>
            </CRow>

            <div className="d-flex gap-2">
              <CButton
                color="secondary"
                variant="outline"
                className="flex-grow-1"
                onClick={() => navigate('/recycling/buyers')}
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
