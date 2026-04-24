import { useEffect, useRef, useState } from 'react';
import {
  CModal, CModalBody, CModalFooter, CModalHeader, CModalTitle,
  CButton, CForm, CFormInput, CFormLabel, CFormSelect, CFormTextarea, CAlert, CSpinner,
} from '@coreui/react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { TimeInput } from '../../../components/inputs';
import { coletasService, type Coleta } from '../../../services/recycling/coletas.service';
import { suppliersService, type Supplier } from '../../../services/recycling/suppliers.service';
import { employeesService, type Employee } from '../../../services/recycling/employees.service';

const schema = z.object({
  supplierId: z.string().uuid({ message: 'Selecione um fornecedor' }),
  scheduledDate: z.string().min(1, 'Informe a data'),
  scheduledTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Hora inválida (use HH:mm, 24h)'),
  employeeId: z.string().optional(),
  notes: z.string().max(1000).optional(),
});
type FormValues = z.infer<typeof schema>;

function formatDocument(doc: string | null, type: 'CPF' | 'CNPJ' | null): string {
  if (!doc) return '';
  if (type === 'CPF' && doc.length === 11) {
    return `${doc.slice(0, 3)}.${doc.slice(3, 6)}.${doc.slice(6, 9)}-${doc.slice(9)}`;
  }
  if (type === 'CNPJ' && doc.length === 14) {
    return `${doc.slice(0, 2)}.${doc.slice(2, 5)}.${doc.slice(5, 8)}/${doc.slice(8, 12)}-${doc.slice(12)}`;
  }
  return doc;
}

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
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Autocomplete state
  const [supplierQuery, setSupplierQuery] = useState('');
  const [supplierResults, setSupplierResults] = useState<Supplier[]>([]);
  const [searching, setSearching] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    handleSubmit, reset, formState: { errors }, control, register, setValue,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { supplierId: '', scheduledDate: '', scheduledTime: '', employeeId: '', notes: '' },
  });

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
      // Pré-carrega o fornecedor selecionado para exibir no input
      suppliersService.getById(editing.supplierId).then(setSelectedSupplier).catch(() => setSelectedSupplier(null));
    } else {
      reset({ supplierId: '', scheduledDate: '', scheduledTime: '', employeeId: '', notes: '' });
      setSelectedSupplier(null);
    }
    setSupplierQuery('');
    setSupplierResults([]);
    setPanelOpen(false);
    setError(null);
  }, [open, editing, reset]);

  // Debounced supplier search
  useEffect(() => {
    if (!open) return;
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    const query = supplierQuery.trim();
    if (query.length < 2) {
      setSupplierResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    searchDebounceRef.current = setTimeout(() => {
      suppliersService.list(1, 20, query)
        .then((r) => setSupplierResults(r.data))
        .catch(() => setSupplierResults([]))
        .finally(() => setSearching(false));
    }, 250);
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [supplierQuery, open]);

  const selectSupplier = (s: Supplier) => {
    setSelectedSupplier(s);
    setValue('supplierId', s.id, { shouldValidate: true });
    setSupplierQuery('');
    setPanelOpen(false);
  };

  const clearSupplier = () => {
    setSelectedSupplier(null);
    setValue('supplierId', '', { shouldValidate: true });
    setSupplierQuery('');
    setSupplierResults([]);
  };

  const handleSupplierKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (supplierResults.length > 0) selectSupplier(supplierResults[0]);
    } else if (e.key === 'Escape') {
      setPanelOpen(false);
    }
  };

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

  const showPanel = panelOpen && supplierQuery.trim().length >= 2;

  return (
    <CModal visible={open} onClose={onClose} alignment="center" className="pk-modal-mobile">
      <CModalHeader>
        <CModalTitle>{editing ? 'Editar coleta' : 'Nova coleta'}</CModalTitle>
      </CModalHeader>
      <CForm onSubmit={handleSubmit(onSubmit)}>
        <CModalBody>
          {error && <CAlert color="danger" className="mb-3">{error}</CAlert>}

          {/* Hidden field registered with RHF for validation */}
          <Controller control={control} name="supplierId" render={({ field }) => <input type="hidden" {...field} />} />

          <div className="mb-3" style={{ position: 'relative' }}>
            <CFormLabel htmlFor="supplierSearch">Fornecedor *</CFormLabel>
            {selectedSupplier ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                  padding: '8px 12px',
                  border: '1px solid var(--cui-border-color)',
                  borderRadius: 6,
                  background: 'var(--cui-card-cap-bg)',
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {selectedSupplier.name}
                  </div>
                  {selectedSupplier.document && (
                    <div style={{ fontSize: 12, color: 'var(--cui-secondary-color)' }}>
                      {formatDocument(selectedSupplier.document, selectedSupplier.documentType)}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={clearSupplier}
                  aria-label="Remover fornecedor selecionado"
                  style={{
                    border: 0,
                    background: 'transparent',
                    color: 'var(--cui-secondary-color)',
                    cursor: 'pointer',
                    fontSize: 18,
                    padding: '0 4px',
                    lineHeight: 1,
                  }}
                >
                  ×
                </button>
              </div>
            ) : (
              <>
                <CFormInput
                  id="supplierSearch"
                  placeholder="Digite o nome ou CPF/CNPJ..."
                  value={supplierQuery}
                  onChange={(e) => { setSupplierQuery(e.target.value); setPanelOpen(true); }}
                  onFocus={() => setPanelOpen(true)}
                  onBlur={() => setTimeout(() => setPanelOpen(false), 150)}
                  onKeyDown={handleSupplierKeyDown}
                  invalid={!!errors.supplierId}
                  autoComplete="off"
                />
                {showPanel && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      zIndex: 1050,
                      marginTop: 2,
                      maxHeight: 260,
                      overflowY: 'auto',
                      background: 'var(--cui-card-bg)',
                      border: '1px solid var(--cui-border-color)',
                      borderRadius: 6,
                      boxShadow: '0 8px 24px rgba(10,12,13,0.12)',
                    }}
                  >
                    {searching && (
                      <div style={{ padding: 12, display: 'flex', justifyContent: 'center' }}>
                        <CSpinner size="sm" color="primary" />
                      </div>
                    )}
                    {!searching && supplierResults.length === 0 && (
                      <div style={{ padding: 12, color: 'var(--cui-secondary-color)', fontSize: 13, textAlign: 'center' }}>
                        Nenhum fornecedor encontrado.
                      </div>
                    )}
                    {!searching && supplierResults.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => selectSupplier(s)}
                        style={{
                          display: 'block',
                          width: '100%',
                          padding: '8px 12px',
                          border: 0,
                          background: 'transparent',
                          textAlign: 'left',
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                          borderBottom: '1px solid var(--cui-border-color)',
                        }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--cui-card-cap-bg)'; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
                      >
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{s.name}</div>
                        {s.document && (
                          <div style={{ fontSize: 11, color: 'var(--cui-secondary-color)' }}>
                            {formatDocument(s.document, s.documentType)}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
            {errors.supplierId && <div className="invalid-feedback d-block">{errors.supplierId.message}</div>}
          </div>

          <div className="row">
            <div className="col-6 mb-3">
              <CFormLabel>Data *</CFormLabel>
              <CFormInput type="date" lang="pt-BR" {...register('scheduledDate')} invalid={!!errors.scheduledDate} />
              {errors.scheduledDate && <div className="invalid-feedback d-block">{errors.scheduledDate.message}</div>}
            </div>
            <div className="col-6 mb-3">
              <CFormLabel>Hora *</CFormLabel>
              <Controller
                control={control}
                name="scheduledTime"
                render={({ field }) => (
                  <TimeInput
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    invalid={!!errors.scheduledTime}
                  />
                )}
              />
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
