import { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  CAlert,
  CButton,
  CFormFeedback,
  CFormInput,
  CFormLabel,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CSpinner,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilPlus, cilPen, cilTrash, cilSearch, cilOptions } from '@coreui/icons';
import { labelStyle } from '../../../components/settings/Card';
import { unitsService, type Unit } from '../../../services/recycling/units.service';

const unitSchema = z.object({
  name: z.string().min(2, 'Mínimo 2 caracteres'),
  abbreviation: z.string().min(1, 'Obrigatório').max(10, 'Máximo 10 caracteres'),
});
type UnitForm = z.infer<typeof unitSchema>;

export function UnitsTab() {
  const [items, setItems] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Unit | null>(null);

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } =
    useForm<UnitForm>({ resolver: zodResolver(unitSchema) });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await unitsService.list();
      setItems(data);
    } catch {
      setError('Erro ao carregar unidades.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (u) => u.name.toLowerCase().includes(q) || u.abbreviation.toLowerCase().includes(q),
    );
  }, [items, search]);

  const openCreate = () => {
    setEditing(null);
    reset({ name: '', abbreviation: '' });
    setModalOpen(true);
  };

  const openEdit = (unit: Unit) => {
    setEditing(unit);
    reset({ name: unit.name, abbreviation: unit.abbreviation });
    setModalOpen(true);
  };

  const onSubmit = async (values: UnitForm) => {
    try {
      if (editing) {
        await unitsService.update(editing.id, values);
      } else {
        await unitsService.create(values);
      }
      setModalOpen(false);
      load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      alert(msg ?? 'Erro ao salvar unidade.');
    }
  };

  const handleDelete = async (unit: Unit) => {
    if (!confirm(`Deseja excluir a unidade "${unit.name}"?`)) return;
    try {
      await unitsService.delete(unit.id);
      load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      alert(msg ?? 'Erro ao excluir unidade. Pode haver produtos vinculados.');
    }
  };

  return (
    <div>
      {error && <CAlert color="danger" className="mb-3">{error}</CAlert>}

      <div className="pk-table-card">
        <div className="pk-table-toolbar">
          <div style={{ position: 'relative', flex: 1, maxWidth: 360 }}>
            <CIcon
              icon={cilSearch}
              style={{
                position: 'absolute',
                left: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--cui-secondary-color)',
                pointerEvents: 'none',
                width: 14,
                height: 14,
              }}
            />
            <CFormInput
              placeholder="Buscar por nome ou abreviação..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: 36 }}
              size="sm"
              aria-label="Buscar unidades"
            />
          </div>
          <CButton
            color="primary"
            size="sm"
            onClick={openCreate}
            style={{ borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <CIcon icon={cilPlus} size="sm" /> Nova unidade
          </CButton>
        </div>

        <CTable hover responsive className="mb-0">
          <CTableHead>
            <CTableRow>
              <CTableHeaderCell>Nome</CTableHeaderCell>
              <CTableHeaderCell>Abreviação</CTableHeaderCell>
              <CTableHeaderCell style={{ textAlign: 'right' }}>Ações</CTableHeaderCell>
            </CTableRow>
          </CTableHead>
          <CTableBody>
            {loading ? (
              <CTableRow>
                <CTableDataCell colSpan={3} className="text-center py-4">
                  <CSpinner size="sm" color="primary" />
                </CTableDataCell>
              </CTableRow>
            ) : filtered.length === 0 ? (
              <CTableRow>
                <CTableDataCell colSpan={3} className="text-center py-5">
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 12,
                        background: 'rgba(52,142,145,0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <CIcon icon={cilOptions} size="lg" style={{ color: 'var(--cui-primary)' }} />
                    </div>
                    <div style={{ fontWeight: 600 }}>Nenhuma unidade encontrada</div>
                    <div style={{ fontSize: 13, color: 'var(--cui-secondary-color)' }}>
                      {search ? 'Tente ajustar sua busca.' : 'Cadastre a primeira unidade (ex: Quilograma / kg).'}
                    </div>
                  </div>
                </CTableDataCell>
              </CTableRow>
            ) : filtered.map((unit) => (
              <CTableRow key={unit.id}>
                <CTableDataCell style={{ fontWeight: 500 }}>{unit.name}</CTableDataCell>
                <CTableDataCell
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 12,
                    color: 'var(--cui-secondary-color)',
                  }}
                >
                  {unit.abbreviation}
                </CTableDataCell>
                <CTableDataCell style={{ textAlign: 'right' }}>
                  <CButton color="secondary" variant="ghost" size="sm" onClick={() => openEdit(unit)} title="Editar">
                    <CIcon icon={cilPen} />
                  </CButton>
                  <CButton color="danger" variant="ghost" size="sm" onClick={() => handleDelete(unit)} title="Excluir">
                    <CIcon icon={cilTrash} />
                  </CButton>
                </CTableDataCell>
              </CTableRow>
            ))}
          </CTableBody>
        </CTable>
      </div>

      <CModal visible={modalOpen} onClose={() => setModalOpen(false)} size="sm">
        <CModalHeader>
          <CModalTitle>{editing ? 'Editar unidade' : 'Nova unidade'}</CModalTitle>
        </CModalHeader>
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <CModalBody>
            <div className="d-flex flex-column gap-3">
              <div>
                <CFormLabel style={labelStyle}>Nome *</CFormLabel>
                <CFormInput placeholder="Ex: Quilograma" {...register('name')} invalid={!!errors.name} />
                {errors.name && <CFormFeedback invalid>{errors.name.message}</CFormFeedback>}
              </div>
              <div>
                <CFormLabel style={labelStyle}>Abreviação *</CFormLabel>
                <CFormInput
                  placeholder="Ex: kg"
                  {...register('abbreviation')}
                  invalid={!!errors.abbreviation}
                  maxLength={10}
                />
                {errors.abbreviation && <CFormFeedback invalid>{errors.abbreviation.message}</CFormFeedback>}
              </div>
            </div>
          </CModalBody>
          <CModalFooter>
            <CButton color="secondary" variant="outline" onClick={() => setModalOpen(false)}>
              Cancelar
            </CButton>
            <CButton type="submit" color="primary" disabled={isSubmitting}>
              {isSubmitting ? <CSpinner size="sm" /> : 'Salvar'}
            </CButton>
          </CModalFooter>
        </form>
      </CModal>
    </div>
  );
}
