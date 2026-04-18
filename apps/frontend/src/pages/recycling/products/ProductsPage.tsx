import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  CAlert,
  CButton,
  CFormFeedback,
  CFormInput,
  CFormLabel,
  CFormSelect,
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
import { cilPlus, cilPen, cilRecycle } from '@coreui/icons';
import { productsService, type Product } from '../../../services/recycling/products.service';
import { unitsService, type Unit } from '../../../services/recycling/units.service';

// ── Schema ──────────────────────────────────────────────────────────────────
const schema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  unitId: z.string().uuid('Selecione uma unidade válida'),
  pricePerUnit: z.number().positive('Preço deve ser maior que zero'),
});

type FormData = z.infer<typeof schema>;

// ── Helpers ─────────────────────────────────────────────────────────────────
const labelStyle = { fontWeight: 500, fontSize: 13 };

function formatPrice(price: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(price);
}

// ── Form Dialog ─────────────────────────────────────────────────────────────

interface ProductFormDialogProps {
  open: boolean;
  editing: Product | null;
  units: Unit[];
  onClose: () => void;
  onSaved: () => void;
}

function ProductFormDialog({ open, editing, units, onClose, onSaved }: ProductFormDialogProps) {
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- clear stale UI state on dialog open
    setSubmitError(null);
    if (editing) {
      reset({
        name: editing.name,
        unitId: editing.unitId,
        pricePerUnit: Number(editing.pricePerUnit),
      });
    } else {
      reset({ name: '', unitId: '', pricePerUnit: 0 });
    }
  }, [open, editing, reset]);

  const onSubmit = async (data: FormData) => {
    setSubmitError(null);
    try {
      if (editing) {
        await productsService.update(editing.id, data);
      } else {
        await productsService.create(data);
      }
      onSaved();
      onClose();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setSubmitError(e?.response?.data?.message ?? 'Erro ao salvar produto.');
    }
  };

  return (
    <CModal visible={open} onClose={onClose} size="sm">
      <CModalHeader>
        <CModalTitle>{editing ? 'Editar produto' : 'Novo produto'}</CModalTitle>
      </CModalHeader>
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <CModalBody>
          {submitError && (
            <CAlert color="danger" className="mb-3">
              {submitError}
            </CAlert>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <CFormLabel style={labelStyle}>Nome *</CFormLabel>
              <CFormInput
                placeholder="Ex.: Alumínio latinha"
                {...register('name')}
                invalid={!!errors.name}
              />
              {errors.name && <CFormFeedback invalid>{errors.name.message}</CFormFeedback>}
            </div>

            <div>
              <CFormLabel style={labelStyle}>Unidade de medida *</CFormLabel>
              <CFormSelect {...register('unitId')} invalid={!!errors.unitId}>
                <option value="">Selecione...</option>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.abbreviation})
                  </option>
                ))}
              </CFormSelect>
              {errors.unitId && <CFormFeedback invalid>{errors.unitId.message}</CFormFeedback>}
              {units.length === 0 && (
                <div style={{ fontSize: 11.5, color: '#b45309', marginTop: 4 }}>
                  Nenhuma unidade cadastrada. Crie em Configurações → Unidades de medida.
                </div>
              )}
            </div>

            <div>
              <CFormLabel style={labelStyle}>Preço por unidade (R$) *</CFormLabel>
              <CFormInput
                type="number"
                step="0.0001"
                min="0"
                placeholder="0,00"
                {...register('pricePerUnit', { valueAsNumber: true })}
                invalid={!!errors.pricePerUnit}
              />
              {errors.pricePerUnit && (
                <CFormFeedback invalid>{errors.pricePerUnit.message}</CFormFeedback>
              )}
            </div>
          </div>
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </CButton>
          <CButton type="submit" color="primary" disabled={isSubmitting}>
            {isSubmitting ? <CSpinner size="sm" /> : 'Salvar'}
          </CButton>
        </CModalFooter>
      </form>
    </CModal>
  );
}

// ── Main page ───────────────────────────────────────────────────────────────

export function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [productsData, unitsData] = await Promise.all([
        productsService.list(true),
        unitsService.list(),
      ]);
      setProducts(productsData);
      setUnits(unitsData);
    } catch {
      setError('Erro ao carregar produtos.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleToggleActive = async (product: Product) => {
    try {
      await productsService.update(product.id, { active: !product.active });
      loadData();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      alert(e?.response?.data?.message ?? 'Erro ao atualizar produto.');
    }
  };

  const getUnitAbbreviation = (unitId: string): string => {
    const unit = units.find((u) => u.id === unitId);
    return unit ? unit.abbreviation : '—';
  };

  const openCreate = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = (product: Product) => {
    setEditing(product);
    setModalOpen(true);
  };

  const activeCount = products.filter((p) => p.active).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Page head */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 20,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: 22,
              fontWeight: 600,
              letterSpacing: '-0.02em',
              color: 'var(--cui-body-color)',
            }}
          >
            Produtos
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13.5, color: 'var(--cui-secondary-color)' }}>
            {products.length > 0
              ? `${products.length} ${products.length === 1 ? 'produto' : 'produtos'}${activeCount < products.length ? ` · ${activeCount} ${activeCount === 1 ? 'ativo' : 'ativos'}` : ''}`
              : 'Cadastre os materiais recicláveis que você opera'}
          </p>
        </div>
        <CButton
          color="primary"
          onClick={openCreate}
          style={{ borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <CIcon icon={cilPlus} size="sm" /> Novo produto
        </CButton>
      </div>

      {error && <CAlert color="danger" className="mb-0">{error}</CAlert>}

      {/* Table card */}
      <div className="pk-table-card">
        <CTable hover responsive className="mb-0">
          <CTableHead>
            <CTableRow>
              <CTableHeaderCell>Produto</CTableHeaderCell>
              <CTableHeaderCell>Unidade</CTableHeaderCell>
              <CTableHeaderCell style={{ textAlign: 'right' }}>Preço unit.</CTableHeaderCell>
              <CTableHeaderCell>Status</CTableHeaderCell>
              <CTableHeaderCell style={{ textAlign: 'right' }}>Ações</CTableHeaderCell>
            </CTableRow>
          </CTableHead>
          <CTableBody>
            {loading ? (
              <CTableRow>
                <CTableDataCell colSpan={5} className="text-center py-4">
                  <CSpinner size="sm" color="primary" />
                </CTableDataCell>
              </CTableRow>
            ) : products.length === 0 ? (
              <CTableRow>
                <CTableDataCell colSpan={5} className="text-center py-5">
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
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
                      <CIcon icon={cilRecycle} size="lg" style={{ color: 'var(--cui-primary)' }} />
                    </div>
                    <div style={{ fontWeight: 600, color: 'var(--cui-body-color)' }}>
                      Nenhum produto cadastrado
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--cui-secondary-color)' }}>
                      Cadastre o primeiro material para começar.
                    </div>
                  </div>
                </CTableDataCell>
              </CTableRow>
            ) : (
              products.map((p) => (
                <CTableRow key={p.id}>
                  <CTableDataCell>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div
                        aria-hidden
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 8,
                          background: 'rgba(52,142,145,0.1)',
                          color: 'var(--cui-primary)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <CIcon icon={cilRecycle} size="sm" />
                      </div>
                      <span style={{ fontWeight: 500, color: 'var(--cui-body-color)' }}>{p.name}</span>
                    </div>
                  </CTableDataCell>
                  <CTableDataCell
                    style={{
                      color: 'var(--cui-secondary-color)',
                      fontSize: 13,
                      fontFamily: "'JetBrains Mono', monospace",
                    }}
                  >
                    {getUnitAbbreviation(p.unitId)}
                  </CTableDataCell>
                  <CTableDataCell
                    style={{
                      textAlign: 'right',
                      fontVariantNumeric: 'tabular-nums',
                      fontWeight: 600,
                      color: 'var(--cui-body-color)',
                    }}
                  >
                    {formatPrice(p.pricePerUnit)}
                  </CTableDataCell>
                  <CTableDataCell>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '3px 10px',
                        borderRadius: 999,
                        fontSize: 11.5,
                        fontWeight: 600,
                        color: p.active ? '#15803d' : 'var(--cui-secondary-color)',
                        background: p.active
                          ? 'rgba(22,163,74,0.12)'
                          : 'var(--cui-card-cap-bg)',
                        border: p.active ? 'none' : '1px solid var(--cui-border-color)',
                      }}
                    >
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          background: p.active ? '#16a34a' : 'var(--cui-secondary-color)',
                        }}
                      />
                      {p.active ? 'Ativo' : 'Inativo'}
                    </span>
                  </CTableDataCell>
                  <CTableDataCell style={{ textAlign: 'right' }}>
                    <CButton
                      color="secondary"
                      variant="ghost"
                      size="sm"
                      onClick={() => openEdit(p)}
                      title="Editar"
                    >
                      <CIcon icon={cilPen} />
                    </CButton>
                    <CButton
                      color={p.active ? 'warning' : 'success'}
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggleActive(p)}
                      title={p.active ? 'Desativar' : 'Ativar'}
                    >
                      {p.active ? 'Desativar' : 'Ativar'}
                    </CButton>
                  </CTableDataCell>
                </CTableRow>
              ))
            )}
          </CTableBody>
        </CTable>
      </div>

      <ProductFormDialog
        open={modalOpen}
        editing={editing}
        units={units}
        onClose={() => setModalOpen(false)}
        onSaved={loadData}
      />
    </div>
  );
}
