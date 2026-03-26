import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useForm, type Resolver } from 'react-hook-form';
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
  CInputGroup,
  CSpinner,
} from '@coreui/react';
import { vehiclesService } from '../../../services/vehicles.service';
import { customersService } from '../../../services/customers.service';

const currentYear = new Date().getFullYear();

const schema = z.object({
  customerId: z.string().uuid('ID do cliente inválido'),
  placa: z
    .string()
    .regex(/^[A-Z]{3}\d{4}$|^[A-Z]{3}\d[A-Z]\d{2}$/, 'Placa inválida (ex: ABC1234 ou ABC1D23)'),
  marca: z.string().min(1, 'Marca obrigatória'),
  modelo: z.string().min(1, 'Modelo obrigatório'),
  ano: z.coerce
    .number()
    .int()
    .min(1900, 'Ano inválido')
    .max(currentYear + 1, `Ano máximo: ${currentYear + 1}`),
  km: z.coerce.number().int().min(0, 'KM não pode ser negativo'),
});

type FormData = z.infer<typeof schema>;

export function VehicleFormPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const isEdit = Boolean(id);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<FormData>({ resolver: zodResolver(schema) as Resolver<FormData> });

  const [cpfInput, setCpfInput] = useState('');
  const [customerName, setCustomerName] = useState<string | null>(null);
  const [cpfError, setCpfError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);

  const handleCpfSearch = async () => {
    const cpf = cpfInput.trim();
    if (!cpf || searching) return;
    setSearching(true);
    setCpfError(null);
    setCustomerName(null);
    try {
      const result = await customersService.list({ search: cpf, limit: 1 });
      const found = result.data.find((c) => c.cpfCnpj === cpf);
      if (found) {
        setValue('customerId', found.id, { shouldValidate: true });
        setCustomerName(found.nome);
      } else {
        setValue('customerId', '', { shouldValidate: false });
        setCpfError('Cliente não encontrado para o CPF informado.');
      }
    } catch {
      setCpfError('Erro ao buscar cliente. Tente novamente.');
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    const prefilledCustomerId = searchParams.get('customerId');
    if (isEdit && id) {
      vehiclesService.getById(id).then((v) => {
        reset({ customerId: v.customerId, placa: v.placa, marca: v.marca, modelo: v.modelo, ano: v.ano, km: v.km });
        customersService.getById(v.customerId).then((c) => {
          setCpfInput(c.cpfCnpj);
          setCustomerName(c.nome);
        }).catch(() => { /* display-only */ });
      });
    } else if (prefilledCustomerId) {
      reset({ customerId: prefilledCustomerId, placa: '', marca: '', modelo: '', ano: currentYear, km: 0 });
      customersService.getById(prefilledCustomerId).then((c) => {
        setCpfInput(c.cpfCnpj);
        setCustomerName(c.nome);
      }).catch(() => { /* display-only */ });
    }
  }, [id, isEdit, reset, searchParams]);

  const onSubmit = async (data: FormData) => {
    try {
      if (isEdit && id) {
        await vehiclesService.update(id, data);
      } else {
        await vehiclesService.create(data);
      }
      navigate(-1);
    } catch (err: any) {
      setError('root', {
        message: err?.response?.data?.message ?? 'Erro ao salvar veículo.',
      });
    }
  };

  return (
    <div style={{ maxWidth: 560 }}>
      <h5 className="fw-bold mb-4">{isEdit ? 'Editar Veículo' : 'Novo Veículo'}</h5>
      <CCard>
        <CCardBody className="p-4">
          {errors.root && (
            <CAlert color="danger" className="mb-3">{errors.root.message}</CAlert>
          )}
          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            {/* CPF search */}
            <div className="mb-3">
              <CFormLabel>CPF do Cliente</CFormLabel>
              <CInputGroup>
                <CFormInput
                  value={cpfInput}
                  onChange={(e) => setCpfInput(e.target.value.replace(/\D/g, ''))}
                  onBlur={handleCpfSearch}
                  maxLength={14}
                  invalid={Boolean(cpfError || errors.customerId)}
                />
                <CButton
                  color="secondary"
                  variant="outline"
                  onClick={handleCpfSearch}
                  disabled={searching || !cpfInput.trim()}
                  style={{ minWidth: 80 }}
                >
                  {searching ? <CSpinner size="sm" /> : 'Buscar'}
                </CButton>
              </CInputGroup>
              {customerName && (
                <div className="text-success small mt-1">✓ {customerName}</div>
              )}
              {cpfError && <CAlert color="danger" className="mt-2 py-2">{cpfError}</CAlert>}
              {errors.customerId && !cpfError && (
                <CFormFeedback invalid style={{ display: 'block' }}>
                  {errors.customerId.message}
                </CFormFeedback>
              )}
            </div>

            <div className="mb-3">
              <CFormLabel>Placa (ex: ABC1234)</CFormLabel>
              <CFormInput
                {...register('placa')}
                maxLength={7}
                style={{ textTransform: 'uppercase' }}
                invalid={!!errors.placa}
              />
              {errors.placa && <CFormFeedback invalid>{errors.placa.message}</CFormFeedback>}
            </div>

            <div className="mb-3">
              <CFormLabel>Marca</CFormLabel>
              <CFormInput {...register('marca')} invalid={!!errors.marca} />
              {errors.marca && <CFormFeedback invalid>{errors.marca.message}</CFormFeedback>}
            </div>

            <div className="mb-3">
              <CFormLabel>Modelo</CFormLabel>
              <CFormInput {...register('modelo')} invalid={!!errors.modelo} />
              {errors.modelo && <CFormFeedback invalid>{errors.modelo.message}</CFormFeedback>}
            </div>

            <div className="d-flex gap-3 mb-4">
              <div className="flex-grow-1">
                <CFormLabel>Ano</CFormLabel>
                <CFormInput type="number" {...register('ano')} invalid={!!errors.ano} />
                {errors.ano && <CFormFeedback invalid>{errors.ano.message}</CFormFeedback>}
              </div>
              <div className="flex-grow-1">
                <CFormLabel>KM</CFormLabel>
                <CFormInput type="number" {...register('km')} invalid={!!errors.km} />
                {errors.km && <CFormFeedback invalid>{errors.km.message}</CFormFeedback>}
              </div>
            </div>

            <div className="d-flex gap-2">
              <CButton color="secondary" variant="outline" className="flex-grow-1" onClick={() => navigate(-1)}>
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
