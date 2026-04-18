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
  CFormFeedback,
  CFormInput,
  CFormLabel,
  CFormSelect,
  CSpinner,
} from '@coreui/react';
import { productsService } from '../../../services/recycling/products.service';
import { unitsService, type Unit } from '../../../services/recycling/units.service';

const schema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  unitId: z.string().uuid('Selecione uma unidade válida'),
  pricePerUnit: z.number().positive('Preço deve ser maior que zero'),
});

type FormData = z.infer<typeof schema>;

export function ProductFormPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEditing = Boolean(id);

  const [units, setUnits] = useState<Unit[]>([]);
  const [loadingUnits, setLoadingUnits] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  useEffect(() => {
    const loadUnits = async () => {
      setLoadingUnits(true);
      try {
        const data = await unitsService.list();
        setUnits(data);
      } catch {
        // silently fail — user will see empty select
      } finally {
        setLoadingUnits(false);
      }
    };
    loadUnits();
  }, []);

  useEffect(() => {
    if (!isEditing) return;
    const loadProduct = async () => {
      try {
        const product = await productsService.getById(id!);
        reset({
          name: product.name,
          unitId: product.unitId,
          pricePerUnit: product.pricePerUnit,
        });
      } catch {
        setError('root', { message: 'Erro ao carregar produto.' });
      }
    };
    loadProduct();
  }, [id, isEditing, reset, setError]);

  const onSubmit = async (data: FormData) => {
    try {
      if (isEditing) {
        await productsService.update(id!, data);
      } else {
        await productsService.create(data);
      }
      navigate('/recycling/products');
    } catch (err: any) {
      setError('root', {
        message: err?.response?.data?.message ?? 'Erro ao salvar produto.',
      });
    }
  };

  return (
    <div style={{ maxWidth: 560 }}>
      <h5 className="fw-bold mb-4">{isEditing ? 'Editar Produto' : 'Novo Produto'}</h5>

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
              <CFormLabel>Unidade de Medida</CFormLabel>
              <CFormSelect {...register('unitId')} invalid={!!errors.unitId} disabled={loadingUnits}>
                <option value="">Selecione...</option>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.abbreviation})
                  </option>
                ))}
              </CFormSelect>
              {errors.unitId && <CFormFeedback invalid>{errors.unitId.message}</CFormFeedback>}
            </div>
            <div className="mb-4">
              <CFormLabel>Preço por Unidade (R$)</CFormLabel>
              <CFormInput
                type="number"
                step="0.0001"
                min="0"
                {...register('pricePerUnit', { valueAsNumber: true })}
                invalid={!!errors.pricePerUnit}
              />
              {errors.pricePerUnit && <CFormFeedback invalid>{errors.pricePerUnit.message}</CFormFeedback>}
            </div>
            <div className="d-flex gap-2">
              <CButton
                color="secondary"
                variant="outline"
                className="flex-grow-1"
                onClick={() => navigate('/recycling/products')}
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
