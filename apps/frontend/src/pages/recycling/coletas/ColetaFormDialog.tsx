import { useEffect, useState } from 'react';
import {
  CModal, CModalBody, CModalFooter, CModalHeader, CModalTitle,
  CButton, CForm, CFormInput, CFormLabel, CFormSelect, CFormTextarea, CAlert, CSpinner,
} from '@coreui/react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { coletasService, type Coleta } from '../../../services/recycling/coletas.service';
import { suppliersService, type Supplier } from '../../../services/recycling/suppliers.service';
import { employeesService, type Employee } from '../../../services/recycling/employees.service';

const schema = z.object({
  supplierId: z.string().uuid({ message: 'Selecione um fornecedor' }),
  scheduledDate: z.string().min(1, 'Informe a data'),
  scheduledTime: z.string().min(1, 'Informe o horário'),
  employeeId: z.string().optional(),
  notes: z.string().max(1000).optional(),
});
type FormValues = z.infer<typeof schema>;

export function ColetaFormDialog({
  open,
  onClose,
  onSaved,
  editing,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  editing: Coleta | null;
}) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [search, setSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    handleSubmit, reset, formState: { errors }, control, register,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { supplierId: '', scheduledDate: '', scheduledTime: '', employeeId: '', notes: '' },
  });

  useEffect(() => {
    if (!open) return;
    suppliersService.list(1, 50, search || undefined).then((r) => setSuppliers(r.data));
  }, [open, search]);

  useEffect(() => {
    if (!open) return;
    employeesService.list().then(setEmployees).catch(() => setEmployees([]));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      const d = new Date(editing.scheduledAt);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const hh = String(d.getHours()).padStart(2, '0');
      const mi = String(d.getMinutes()).padStart(2, '0');
      reset({
        supplierId: editing.supplierId,
        scheduledDate: `${yyyy}-${mm}-${dd}`,
        scheduledTime: `${hh}:${mi}`,
        employeeId: editing.employeeId ?? '',
        notes: editing.notes ?? '',
      });
    } else {
      reset({ supplierId: '', scheduledDate: '', scheduledTime: '', employeeId: '', notes: '' });
    }
    setError(null);
  }, [open, editing, reset]);

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    setError(null);
    try {
      const scheduledAt = new Date(`${values.scheduledDate}T${values.scheduledTime}:00`).toISOString();
      const payload = {
        supplierId: values.supplierId,
        scheduledAt,
        employeeId: values.employeeId || null,
        notes: values.notes || null,
      };
      if (editing) {
        await coletasService.update(editing.id, payload);
      } else {
        await coletasService.create(payload);
      }
      onSaved();
      onClose();
    } catch (e: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
      setError(e?.response?.data?.message ?? 'Erro ao salvar coleta.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <CModal visible={open} onClose={onClose} alignment="center">
      <CModalHeader>
        <CModalTitle>{editing ? 'Editar coleta' : 'Nova coleta'}</CModalTitle>
      </CModalHeader>
      <CForm onSubmit={handleSubmit(onSubmit)}>
        <CModalBody>
          {error && <CAlert color="danger" className="mb-3">{error}</CAlert>}

          <div className="mb-3">
            <CFormLabel htmlFor="supplierSearch">Buscar fornecedor</CFormLabel>
            <CFormInput
              id="supplierSearch"
              placeholder="Digite para filtrar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="mb-3">
            <CFormLabel>Fornecedor *</CFormLabel>
            <Controller
              control={control}
              name="supplierId"
              render={({ field }) => (
                <CFormSelect {...field} invalid={!!errors.supplierId}>
                  <option value="">— Selecione —</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </CFormSelect>
              )}
            />
            {errors.supplierId && <div className="invalid-feedback d-block">{errors.supplierId.message}</div>}
          </div>

          <div className="row">
            <div className="col-6 mb-3">
              <CFormLabel>Data *</CFormLabel>
              <CFormInput type="date" {...register('scheduledDate')} invalid={!!errors.scheduledDate} />
              {errors.scheduledDate && <div className="invalid-feedback d-block">{errors.scheduledDate.message}</div>}
            </div>
            <div className="col-6 mb-3">
              <CFormLabel>Hora *</CFormLabel>
              <CFormInput type="time" {...register('scheduledTime')} invalid={!!errors.scheduledTime} />
              {errors.scheduledTime && <div className="invalid-feedback d-block">{errors.scheduledTime.message}</div>}
            </div>
          </div>

          <div className="mb-3">
            <CFormLabel>Motorista (opcional)</CFormLabel>
            <Controller
              control={control}
              name="employeeId"
              render={({ field }) => (
                <CFormSelect {...field}>
                  <option value="">— Sem motorista vinculado —</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>{e.name}</option>
                  ))}
                </CFormSelect>
              )}
            />
          </div>

          <div className="mb-3">
            <CFormLabel>Observações</CFormLabel>
            <CFormTextarea rows={3} {...register('notes')} />
          </div>
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" variant="outline" onClick={onClose} disabled={submitting}>
            Cancelar
          </CButton>
          <CButton type="submit" color="primary" disabled={submitting}>
            {submitting ? <CSpinner size="sm" /> : (editing ? 'Salvar' : 'Criar')}
          </CButton>
        </CModalFooter>
      </CForm>
    </CModal>
  );
}
