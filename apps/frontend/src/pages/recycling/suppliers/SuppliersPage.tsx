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
import { cilPlus, cilPen, cilTrash, cilSearch, cilPeople } from '@coreui/icons';
import { suppliersService, type Supplier } from '../../../services/recycling/suppliers.service';

// ── Schema ──────────────────────────────────────────────────────────────────
const schema = z
  .object({
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
  })
  .superRefine((data, ctx) => {
    if (data.documentType) {
      if (!data.document) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Documento é obrigatório quando o tipo é selecionado',
          path: ['document'],
        });
      } else if (data.documentType === 'CPF' && !/^\d{11}$/.test(data.document)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'CPF deve ter 11 dígitos',
          path: ['document'],
        });
      } else if (data.documentType === 'CNPJ' && !/^\d{14}$/.test(data.document)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'CNPJ deve ter 14 dígitos',
          path: ['document'],
        });
      }
    }
  });

type FormData = z.infer<typeof schema>;

// ── Helpers ─────────────────────────────────────────────────────────────────
const labelStyle = { fontWeight: 500, fontSize: 13 };

function formatDocument(document: string | null, documentType: 'CPF' | 'CNPJ' | null): string {
  if (!document || !documentType) return '—';
  if (documentType === 'CPF') {
    return document.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }
  return document.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
}

function SupplierAvatar({ name }: { name: string }) {
  return (
    <div
      aria-hidden
      style={{
        width: 30,
        height: 30,
        borderRadius: 999,
        background: 'rgba(52,142,145,0.12)',
        color: 'var(--cui-primary)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 11.5,
        fontWeight: 600,
        flexShrink: 0,
      }}
    >
      {getInitials(name)}
    </div>
  );
}

// ── Form Dialog ─────────────────────────────────────────────────────────────

interface SupplierFormDialogProps {
  open: boolean;
  editing: Supplier | null;
  onClose: () => void;
  onSaved: () => void;
}

function SupplierFormDialog({ open, editing, onClose, onSaved }: SupplierFormDialogProps) {
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const documentType = watch('documentType');

  useEffect(() => {
    if (!open) return;
    setSubmitError(null);
    if (editing) {
      reset({
        name: editing.name,
        documentType: editing.documentType ?? '',
        document: editing.document ?? '',
        phone: editing.phone ?? '',
        street: editing.address?.street ?? '',
        number: editing.address?.number ?? '',
        complement: editing.address?.complement ?? '',
        city: editing.address?.city ?? '',
        state: editing.address?.state ?? '',
        zip: editing.address?.zip ?? '',
      });
    } else {
      reset({
        name: '',
        documentType: '',
        document: '',
        phone: '',
        street: '',
        number: '',
        complement: '',
        city: '',
        state: '',
        zip: '',
      });
    }
  }, [open, editing, reset]);

  const onSubmit = async (data: FormData) => {
    setSubmitError(null);
    const hasAddress = data.street || data.city || data.zip;
    const payload = {
      name: data.name,
      document: data.document && data.documentType ? data.document : null,
      documentType: (data.documentType ? data.documentType : null) as 'CPF' | 'CNPJ' | null,
      phone: data.phone || null,
      address: hasAddress
        ? {
            street: data.street ?? '',
            number: data.number ?? '',
            complement: data.complement || undefined,
            city: data.city ?? '',
            state: data.state ?? '',
            zip: data.zip ?? '',
          }
        : null,
    };

    try {
      if (editing) {
        await suppliersService.update(editing.id, payload);
      } else {
        await suppliersService.create(payload);
      }
      onSaved();
      onClose();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setSubmitError(e?.response?.data?.message ?? 'Erro ao salvar fornecedor.');
    }
  };

  return (
    <CModal visible={open} onClose={onClose} size="lg">
      <CModalHeader>
        <CModalTitle>{editing ? 'Editar fornecedor' : 'Novo fornecedor'}</CModalTitle>
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
              <CFormInput {...register('name')} invalid={!!errors.name} />
              {errors.name && <CFormFeedback invalid>{errors.name.message}</CFormFeedback>}
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: documentType ? '180px 1fr' : '1fr 1fr',
                gap: 12,
              }}
            >
              <div>
                <CFormLabel style={labelStyle}>Tipo de documento</CFormLabel>
                <CFormSelect {...register('documentType')}>
                  <option value="">Sem documento</option>
                  <option value="CPF">CPF</option>
                  <option value="CNPJ">CNPJ</option>
                </CFormSelect>
              </div>
              {documentType ? (
                <div>
                  <CFormLabel style={labelStyle}>
                    {documentType === 'CPF' ? 'CPF (11 dígitos)' : 'CNPJ (14 dígitos)'}
                  </CFormLabel>
                  <CFormInput
                    {...register('document')}
                    placeholder={documentType === 'CPF' ? '00000000000' : '00000000000000'}
                    invalid={!!errors.document}
                  />
                  {errors.document && <CFormFeedback invalid>{errors.document.message}</CFormFeedback>}
                </div>
              ) : (
                <div>
                  <CFormLabel style={labelStyle}>Telefone</CFormLabel>
                  <CFormInput {...register('phone')} placeholder="(00) 00000-0000" />
                </div>
              )}
            </div>

            {documentType && (
              <div>
                <CFormLabel style={labelStyle}>Telefone</CFormLabel>
                <CFormInput {...register('phone')} placeholder="(00) 00000-0000" />
              </div>
            )}

            <div
              style={{
                height: 1,
                background: 'var(--cui-border-color)',
                margin: '4px 0',
              }}
            />

            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--cui-secondary-color)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}
            >
              Endereço (opcional)
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 12 }}>
              <div style={{ gridColumn: 'span 9' }}>
                <CFormLabel style={labelStyle}>Logradouro</CFormLabel>
                <CFormInput {...register('street')} />
              </div>
              <div style={{ gridColumn: 'span 3' }}>
                <CFormLabel style={labelStyle}>Número</CFormLabel>
                <CFormInput {...register('number')} />
              </div>
              <div style={{ gridColumn: 'span 12' }}>
                <CFormLabel style={labelStyle}>Complemento</CFormLabel>
                <CFormInput {...register('complement')} />
              </div>
              <div style={{ gridColumn: 'span 6' }}>
                <CFormLabel style={labelStyle}>Cidade</CFormLabel>
                <CFormInput {...register('city')} />
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <CFormLabel style={labelStyle}>UF</CFormLabel>
                <CFormInput {...register('state')} maxLength={2} placeholder="SP" />
              </div>
              <div style={{ gridColumn: 'span 4' }}>
                <CFormLabel style={labelStyle}>CEP</CFormLabel>
                <CFormInput {...register('zip')} placeholder="00000-000" />
              </div>
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

export function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const limit = 20;

  const loadSuppliers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await suppliersService.list(page, limit, search || undefined);
      setSuppliers(result.data);
      setTotal(result.total);
    } catch {
      setError('Erro ao carregar fornecedores.');
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    loadSuppliers();
  }, [loadSuppliers]);

  const handleSearch = () => {
    setPage(1);
    setSearch(searchInput);
  };

  const handleDelete = async (supplier: Supplier) => {
    if (!confirm(`Excluir fornecedor "${supplier.name}"?`)) return;
    try {
      await suppliersService.delete(supplier.id);
      loadSuppliers();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      alert(e?.response?.data?.message ?? 'Erro ao excluir fornecedor.');
    }
  };

  const openCreate = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = (supplier: Supplier) => {
    setEditing(supplier);
    setModalOpen(true);
  };

  const totalPages = Math.ceil(total / limit) || 1;
  const shownFrom = total === 0 ? 0 : (page - 1) * limit + 1;
  const shownTo = Math.min(page * limit, total);

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
            Fornecedores
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13.5, color: 'var(--cui-secondary-color)' }}>
            {total > 0
              ? `${total} ${total === 1 ? 'fornecedor cadastrado' : 'fornecedores cadastrados'}`
              : 'Cadastre fornecedores para registrar compras'}
          </p>
        </div>
        <CButton
          color="primary"
          onClick={openCreate}
          style={{ borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <CIcon icon={cilPlus} size="sm" /> Novo fornecedor
        </CButton>
      </div>

      {error && <CAlert color="danger" className="mb-0">{error}</CAlert>}

      {/* Table card */}
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
              placeholder="Buscar por nome ou documento..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              onBlur={handleSearch}
              style={{ paddingLeft: 36 }}
              size="sm"
              aria-label="Buscar fornecedores"
            />
          </div>
        </div>

        <CTable hover responsive className="mb-0">
          <CTableHead>
            <CTableRow>
              <CTableHeaderCell>Nome</CTableHeaderCell>
              <CTableHeaderCell>Documento</CTableHeaderCell>
              <CTableHeaderCell>Telefone</CTableHeaderCell>
              <CTableHeaderCell>Cidade</CTableHeaderCell>
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
            ) : suppliers.length === 0 ? (
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
                      <CIcon icon={cilPeople} size="lg" style={{ color: 'var(--cui-primary)' }} />
                    </div>
                    <div style={{ fontWeight: 600, color: 'var(--cui-body-color)' }}>
                      {search ? 'Nenhum resultado' : 'Nenhum fornecedor ainda'}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--cui-secondary-color)' }}>
                      {search
                        ? 'Tente ajustar sua busca.'
                        : 'Cadastre o primeiro fornecedor para começar.'}
                    </div>
                  </div>
                </CTableDataCell>
              </CTableRow>
            ) : (
              suppliers.map((s) => (
                <CTableRow key={s.id}>
                  <CTableDataCell>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <SupplierAvatar name={s.name} />
                      <span style={{ fontWeight: 500, color: 'var(--cui-body-color)' }}>{s.name}</span>
                    </div>
                  </CTableDataCell>
                  <CTableDataCell
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 12,
                      color: 'var(--cui-secondary-color)',
                    }}
                  >
                    {formatDocument(s.document, s.documentType)}
                  </CTableDataCell>
                  <CTableDataCell style={{ color: 'var(--cui-body-color)', fontSize: 13 }}>
                    {s.phone ?? '—'}
                  </CTableDataCell>
                  <CTableDataCell style={{ color: 'var(--cui-secondary-color)', fontSize: 13 }}>
                    {s.address?.city
                      ? `${s.address.city}${s.address.state ? `/${s.address.state}` : ''}`
                      : '—'}
                  </CTableDataCell>
                  <CTableDataCell style={{ textAlign: 'right' }}>
                    <CButton
                      color="secondary"
                      variant="ghost"
                      size="sm"
                      onClick={() => openEdit(s)}
                      title="Editar"
                    >
                      <CIcon icon={cilPen} />
                    </CButton>
                    <CButton
                      color="danger"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(s)}
                      title="Excluir"
                    >
                      <CIcon icon={cilTrash} />
                    </CButton>
                  </CTableDataCell>
                </CTableRow>
              ))
            )}
          </CTableBody>
        </CTable>

        <div className="pk-table-footer">
          <span>
            {total > 0 ? `Mostrando ${shownFrom}–${shownTo} de ${total}` : 'Nenhum registro'}
          </span>
          {total > limit && (
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
              <CButton
                color="secondary"
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
                aria-label="Página anterior"
              >
                ‹
              </CButton>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '0 10px',
                  fontWeight: 500,
                  color: 'var(--cui-body-color)',
                }}
              >
                {page} / {totalPages}
              </span>
              <CButton
                color="secondary"
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
                aria-label="Próxima página"
              >
                ›
              </CButton>
            </div>
          )}
        </div>
      </div>

      <SupplierFormDialog
        open={modalOpen}
        editing={editing}
        onClose={() => setModalOpen(false)}
        onSaved={loadSuppliers}
      />
    </div>
  );
}
