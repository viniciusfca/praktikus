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
  CFormSelect,
  CRow,
  CSpinner,
} from '@coreui/react';
import { suppliersService } from '../../../services/recycling/suppliers.service';

const schema = z.object({
  name: z.string().min(2, 'Nome deve ter ao menos 2 caracteres'),
  documentType: z.enum(['CPF', 'CNPJ', '']).optional(),
  document: z.string().optional(),
  phone: z.string().optional(),
  street: z.string().optional(),
  number: z.string().optional(),
  complement: z.string().optional(),
  city: z.string().optional(),
  state: z.string().max(2, 'UF deve ter 2 caracteres').optional(),
  zip: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.documentType) {
    if (!data.document) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Documento é obrigatório quando o tipo é selecionado', path: ['document'] });
    } else if (data.documentType === 'CPF' && !/^\d{11}$/.test(data.document)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'CPF deve ter 11 dígitos', path: ['document'] });
    } else if (data.documentType === 'CNPJ' && !/^\d{14}$/.test(data.document)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'CNPJ deve ter 14 dígitos', path: ['document'] });
    }
  }
});

type FormData = z.infer<typeof schema>;

export function SupplierFormPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEditing = Boolean(id);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const documentType = watch('documentType');

  useEffect(() => {
    if (!isEditing) return;
    const loadSupplier = async () => {
      setLoading(true);
      try {
        const supplier = await suppliersService.getById(id!);
        reset({
          name: supplier.name,
          documentType: supplier.documentType ?? '',
          document: supplier.document ?? '',
          phone: supplier.phone ?? '',
          street: supplier.address?.street ?? '',
          number: supplier.address?.number ?? '',
          complement: supplier.address?.complement ?? '',
          city: supplier.address?.city ?? '',
          state: supplier.address?.state ?? '',
          zip: supplier.address?.zip ?? '',
        });
      } catch {
        setError('root', { message: 'Erro ao carregar fornecedor.' });
      } finally {
        setLoading(false);
      }
    };
    loadSupplier();
  }, [id, isEditing, reset, setError]);

  const onSubmit = async (data: FormData) => {
    const hasAddress = data.street || data.city || data.zip;
    const payload = {
      name: data.name,
      document: data.document && data.documentType ? data.document : null,
      documentType: (data.documentType ? data.documentType : null) as 'CPF' | 'CNPJ' | null,
      phone: data.phone || null,
      address: hasAddress ? {
        street: data.street ?? '',
        number: data.number ?? '',
        complement: data.complement || undefined,
        city: data.city ?? '',
        state: data.state ?? '',
        zip: data.zip ?? '',
      } : null,
    };

    try {
      if (isEditing) {
        await suppliersService.update(id!, payload);
      } else {
        await suppliersService.create(payload);
      }
      navigate('/recycling/suppliers');
    } catch (err: any) {
      setError('root', {
        message: err?.response?.data?.message ?? 'Erro ao salvar fornecedor.',
      });
    }
  };

  if (loading) {
    return <div className="text-center py-5"><CSpinner /></div>;
  }

  return (
    <div style={{ maxWidth: 720 }}>
      <h5 className="fw-bold mb-4">{isEditing ? 'Editar Fornecedor' : 'Novo Fornecedor'}</h5>

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

            <CRow className="mb-3">
              <CCol md={4}>
                <CFormLabel>Tipo de Documento</CFormLabel>
                <CFormSelect {...register('documentType')} invalid={!!errors.documentType}>
                  <option value="">Sem documento</option>
                  <option value="CPF">CPF</option>
                  <option value="CNPJ">CNPJ</option>
                </CFormSelect>
                {errors.documentType && <CFormFeedback invalid>{errors.documentType.message}</CFormFeedback>}
              </CCol>
              {documentType && (
                <CCol md={8}>
                  <CFormLabel>
                    {documentType === 'CPF' ? 'CPF (11 dígitos)' : 'CNPJ (14 dígitos)'}
                  </CFormLabel>
                  <CFormInput
                    {...register('document')}
                    placeholder={documentType === 'CPF' ? '00000000000' : '00000000000000'}
                    invalid={!!errors.document}
                  />
                  {errors.document && <CFormFeedback invalid>{errors.document.message}</CFormFeedback>}
                </CCol>
              )}
            </CRow>

            <div className="mb-4">
              <CFormLabel>Telefone</CFormLabel>
              <CFormInput {...register('phone')} placeholder="(00) 00000-0000" invalid={!!errors.phone} />
              {errors.phone && <CFormFeedback invalid>{errors.phone.message}</CFormFeedback>}
            </div>

            <h6 className="fw-semibold mb-3">Endereço (opcional)</h6>

            <CRow className="mb-3">
              <CCol md={9}>
                <CFormLabel>Logradouro</CFormLabel>
                <CFormInput {...register('street')} invalid={!!errors.street} />
                {errors.street && <CFormFeedback invalid>{errors.street.message}</CFormFeedback>}
              </CCol>
              <CCol md={3}>
                <CFormLabel>Número</CFormLabel>
                <CFormInput {...register('number')} invalid={!!errors.number} />
                {errors.number && <CFormFeedback invalid>{errors.number.message}</CFormFeedback>}
              </CCol>
            </CRow>

            <div className="mb-3">
              <CFormLabel>Complemento</CFormLabel>
              <CFormInput {...register('complement')} />
            </div>

            <CRow className="mb-4">
              <CCol md={5}>
                <CFormLabel>Cidade</CFormLabel>
                <CFormInput {...register('city')} invalid={!!errors.city} />
                {errors.city && <CFormFeedback invalid>{errors.city.message}</CFormFeedback>}
              </CCol>
              <CCol md={2}>
                <CFormLabel>UF</CFormLabel>
                <CFormInput {...register('state')} maxLength={2} invalid={!!errors.state} />
                {errors.state && <CFormFeedback invalid>{errors.state.message}</CFormFeedback>}
              </CCol>
              <CCol md={5}>
                <CFormLabel>CEP</CFormLabel>
                <CFormInput {...register('zip')} placeholder="00000-000" invalid={!!errors.zip} />
                {errors.zip && <CFormFeedback invalid>{errors.zip.message}</CFormFeedback>}
              </CCol>
            </CRow>

            <div className="d-flex gap-2">
              <CButton
                color="secondary"
                variant="outline"
                className="flex-grow-1"
                onClick={() => navigate('/recycling/suppliers')}
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
